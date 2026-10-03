import {spawnSync} from 'node:child_process'
import {existsSync,lstatSync,realpathSync,readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {inflateRawSync} from 'node:zlib'
import {hash,verifyProof,ancestryError} from './proof.mjs'
import {smoke} from './smoke.mjs'
import {
 BANNER_RECOVERY_RELEASE,
 adminApiVersion,
 tiktokContentPostingVersion,
 bannerFunctionVersion,
 deploymentMode,
 edgeScope,
 validateBannerAncestry,
 validateBannerRecoveryManifest,
 validateBannerPromotionCandidate,
 validateBannerVerifyJwt,
 validateBannerWorktreeStatus,
 validateKnownBannerDesignFailure,
} from './edge-scope.mjs'
import {verifyArchiveTree} from './archive-proof.mjs'
import {deploymentTarget,deploymentOptions,dryRunPlan,assertTargetIdentity} from './targets.mjs'

const root=fileURLToPath(new URL('../../',import.meta.url))
let cli=null
let target=null
const vercelReadyTimeoutMs=10*60*1000
const vercelReadyPollIntervalMs=5*1000
const vercelTransientStates=new Set(['QUEUED','BUILDING','INITIALIZING','COMPLETING'])
const vercelTerminalStates=new Set(['ERROR','CANCELED'])
const vercelCandidateUrlPattern=/^https:\/\/smartcorretorai-[a-z0-9]+-smart-corretor-ai-s-projects\.vercel\.app\/?$/
const bannerRecoveryReadyCandidate=Object.freeze({
 url:'https://smartcorretorai-fremde96m-smart-corretor-ai-s-projects.vercel.app',
 id:'dpl_An5uMoKDMQPhU1PjAr1NWSfDVBH7',
 sha:'4865f9b57859495c01fa53925b3ab35ee70933c2',
})
const bannerVercelIdentity=Object.freeze({
 projectId:'prj_U3MEwzheOk76LJzPIdx3OyLQbs5g',
 ownerId:'team_Jhfx1Tk09PX2qGSgri0sSvsQ',
 projectName:'smartcorretorai',
})
export const BANNER_PROMOTION_BACKEND_VERSION=75
export const BANNER_RUNTIME_ENTRY='supabase/functions/gerar-hero-ia/index.ts'
export const BANNER_RUNTIME_CLOSURE=Object.freeze([
 'core/copy-engine/index.ts',
 'server/guest-banner/promotion.mjs',
 'server/guest-banner/result.mjs',
 'supabase/functions/_shared/banner-publication-options.ts',
 'supabase/functions/_shared/economic-catalog.ts',
 'supabase/functions/_shared/google-ads.ts',
 'supabase/functions/_shared/official-hashtags.ts',
 'supabase/functions/_shared/supabase-admin-credential.ts',
 'supabase/functions/gerar-hero-ia/economy.ts',
 'supabase/functions/gerar-hero-ia/guest-input.ts',
 'supabase/functions/gerar-hero-ia/guest-runtime.ts',
 BANNER_RUNTIME_ENTRY,
].sort())
export const BANNER_CONFIG_BLOB_SHA256='C18A0DC34CFEDE87D00783DA1B071BAD911D5E501219AF842B2C5699348D9D19'
const bannerConfigPath='supabase/config.toml'
const forbiddenBannerConfigSections=['[functions.tiktok-connection]','[functions.tiktok-callback]']
const require=createRequire(import.meta.url)
const babelParse=require(path.join(root,'frontend/node_modules/@babel/parser')).parse

export function executeCommand(command,args,{cwd=root,inherit=false,spawn=spawnSync,platform=process.platform,env}={}){
 const windowsCommand=platform==='win32'&&(['vercel','supabase'].includes(command)||command.endsWith('.cmd'))
 const r=spawn(command,args,{cwd,encoding:inherit?undefined:'utf8',stdio:inherit?'inherit':['ignore','pipe','inherit'],shell:windowsCommand,...(env?{env}:{})})
 const label=path.basename(command)
 if(r.error){
  const code=typeof r.error.code==='string'?r.error.code:'SPAWN_ERROR'
  if(code==='ENOENT')throw Error('Comando obrigatório não encontrado (ENOENT): '+label)
  throw Error('Falha ao iniciar comando obrigatório ('+code+'): '+label)
 }
 if(r.status!==0)throw Error('Comando obrigatório falhou: '+label+' '+args[0])
 return inherit?'':r.stdout.trim()
}
function run(command,args,cwd=root,inherit=false){return executeCommand(command,args,{cwd,inherit})}

export const BANNER_FRONTEND_TEST_ENV=Object.freeze({
 VITE_SUPABASE_URL:'https://smartcorretorai-banner-tests.invalid',
 VITE_SUPABASE_ANON_KEY:'fictional-anon-key-for-banner-tests.invalid',
})
const bannerNetworkGuardMarker='BANNER_TEST_NETWORK_TO_INVALID_BLOCKED'
const bannerNetworkGuardSource=`
const marker=${JSON.stringify(bannerNetworkGuardMarker)}
const originalFetch=globalThis.fetch
let blocked=false
globalThis.fetch=async function(input,init){
 const value=typeof input==='string'?input:input?.url
 let url
 try {url=new URL(value)} catch {}
 if(url?.hostname.endsWith('.invalid')){blocked=true;throw Error(marker)}
 return originalFetch.call(this,input,init)
}
process.on('exit',()=>{if(blocked){process.stderr.write(marker+'\\n');process.exitCode=1}})
`
const bannerNetworkGuardOption='--import=data:text/javascript;base64,'+Buffer.from(bannerNetworkGuardSource).toString('base64')

export function createBannerFrontendTestEnv(parentEnv=process.env){
 const existing=typeof parentEnv.NODE_OPTIONS==='string'?parentEnv.NODE_OPTIONS.trim():''
 return {...parentEnv,...BANNER_FRONTEND_TEST_ENV,NODE_OPTIONS:[existing,bannerNetworkGuardOption].filter(Boolean).join(' ')}
}

export function runBannerFrontendCommand(command,args,cwd,{execute=executeCommand,parentEnv=process.env,inherit=true}={}){
 return execute(command,args,{cwd,inherit,env:createBannerFrontendTestEnv(parentEnv)})
}

function unsafeExecutableValue(value){return /[\0\r\n&|;<>`"']|\$\(/.test(value)}

const expectedVercelCliVersion='59.13.1'
const expectedSupabaseCliVersion='2.116.0'

function versionLines(value){
 return typeof value==='string'?value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean):[]
}

function uniqueVersion(candidates,label){
 const versions=[...new Set(candidates)]
 if(versions.length!==1)throw Error(`DEPLOY BLOQUEADO: versão instalada da ${label} ausente ou ambígua`)
 return versions[0]
}

export function parseVercelCliVersion({stdout='',stderr=''}={}){
 const candidates=[]
 for(const line of [...versionLines(stdout),...versionLines(stderr)]){
  const match=line.match(/^(?:Vercel CLI )?(\d+\.\d+\.\d+)$/)
  if(!match)throw Error('DEPLOY BLOQUEADO: output inesperado da Vercel CLI --version')
  candidates.push(match[1])
 }
 const version=uniqueVersion(candidates,'Vercel CLI')
 if(version!==expectedVercelCliVersion)throw Error(`DEPLOY BLOQUEADO: Vercel CLI deve ser exatamente ${expectedVercelCliVersion}`)
 return version
}

const supabaseUpdateNotice=/^A new version of Supabase CLI is available: v\d+\.\d+\.\d+ \(currently installed v\d+\.\d+\.\d+\)$/
const supabaseUpdateHelp='We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli'

export function parseSupabaseCliVersion({stdout='',stderr=''}={}){
 const candidates=[]
 for(const line of versionLines(stdout)){
  const match=line.match(/^(\d+\.\d+\.\d+)$/)
  if(!match)throw Error('DEPLOY BLOQUEADO: output inesperado da Supabase CLI --version')
  candidates.push(match[1])
 }
 for(const line of versionLines(stderr)){
  if(!supabaseUpdateNotice.test(line)&&line!==supabaseUpdateHelp)throw Error('DEPLOY BLOQUEADO: output inesperado da Supabase CLI --version')
 }
 const version=uniqueVersion(candidates,'Supabase CLI')
 if(version!==expectedSupabaseCliVersion)throw Error(`DEPLOY BLOQUEADO: Supabase CLI deve ser exatamente ${expectedSupabaseCliVersion}`)
 return version
}

function executeCliVersion(command,{cwd=root,spawn=spawnSync,platform=process.platform}={}){
 const windowsCommand=platform==='win32'&&(['vercel','supabase'].includes(command)||command.endsWith('.cmd'))
 const result=spawn(command,['--version'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:windowsCommand})
 const label=path.basename(command)
 if(result.error){
  const code=typeof result.error.code==='string'?result.error.code:'SPAWN_ERROR'
  if(code==='ENOENT')throw Error('Comando obrigatório não encontrado (ENOENT): '+label)
  throw Error('Falha ao iniciar comando obrigatório ('+code+'): '+label)
 }
 if(result.status!==0)throw Error('Comando obrigatório falhou: '+label+' --version')
 return {stdout:result.stdout??'',stderr:result.stderr??''}
}

export function resolveVercelCli({
 env=process.env,
 cwd=root,
 spawn=spawnSync,
 platform=process.platform,
 exists=existsSync,
 stat=lstatSync,
 log=console.log,
}={}){
 const explicit=Object.prototype.hasOwnProperty.call(env,'VERCEL_CLI')
 const localCommand=path.join(cwd,'node_modules','.bin',platform==='win32'?'vercel.cmd':'vercel')
 let command=exists(localCommand)?localCommand:'vercel',source=exists(localCommand)?'project-local':'PATH'
 if(explicit){
  const configured=env.VERCEL_CLI
  if(typeof configured!=='string'||configured.trim()==='')throw Error('DEPLOY BLOQUEADO: VERCEL_CLI está vazia')
  if(configured!==configured.trim()||unsafeExecutableValue(configured))throw Error('DEPLOY BLOQUEADO: VERCEL_CLI deve conter somente um caminho de executável')
  command=path.resolve(cwd,configured)
  source='VERCEL_CLI'
  if(!exists(command)||!stat(command).isFile())throw Error('DEPLOY BLOQUEADO: VERCEL_CLI não aponta para um arquivo executável existente')
 }
 let output
 try {output=executeCliVersion(command,{cwd,spawn,platform})}
 catch(error){
  if(!explicit&&/\(ENOENT\)/.test(error.message))throw Error('DEPLOY BLOQUEADO: Vercel CLI ausente; defina VERCEL_CLI com um executável local válido')
  throw error
 }
 const version=parseVercelCliVersion(output)
 log(JSON.stringify({vercelCli:{source,path:explicit?command:'vercel',version}}))
 return command
}

export function resolveSupabaseCli({
 env=process.env,
 cwd=root,
 spawn=spawnSync,
 platform=process.platform,
 exists=existsSync,
 stat=lstatSync,
 log=console.log,
}={}){
 const explicit=Object.prototype.hasOwnProperty.call(env,'SUPABASE_CLI')
 let command='supabase',source='PATH'
 if(explicit){
  const configured=env.SUPABASE_CLI
  if(typeof configured!=='string'||configured.trim()==='')throw Error('DEPLOY BLOQUEADO: SUPABASE_CLI está vazia')
  if(configured!==configured.trim()||unsafeExecutableValue(configured))throw Error('DEPLOY BLOQUEADO: SUPABASE_CLI deve conter somente um caminho de executável')
  command=path.resolve(cwd,configured)
  source='SUPABASE_CLI'
  if(!exists(command)||!stat(command).isFile())throw Error('DEPLOY BLOQUEADO: SUPABASE_CLI não aponta para um arquivo executável existente')
 }
 let output
 try {output=executeCliVersion(command,{cwd,spawn,platform})}
 catch(error){
  if(!explicit&&/\(ENOENT\)/.test(error.message))throw Error('DEPLOY BLOQUEADO: Supabase CLI ausente; defina SUPABASE_CLI com um executável local válido')
  throw error
 }
 const version=parseSupabaseCliVersion(output)
 log(JSON.stringify({supabaseCli:{source,path:explicit?command:'supabase',version}}))
 return command
}
const git=(...args)=>run('git',args)
const vc=(args,cwd=root)=>run(cli,[...args,'--scope',target.teamId],cwd)

const posix=value=>value.replaceAll('\\','/')
const inside=(parent,target)=>{const relative=path.relative(parent,target);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))}

function assertAllowedBannerRuntimePath(relative){
 const value=posix(relative),lower=value.toLowerCase(),base=path.posix.basename(lower)
 if(value!==relative||path.posix.isAbsolute(value)||value.startsWith('../')||value.includes('/../'))throw Error('DEPLOY BLOQUEADO: caminho runtime inválido: '+relative)
 if(lower.startsWith('frontend/')||lower.startsWith('supabase/migrations/')||/(^|\/)(workers?|jobs?|cron)(\/|$)/.test(lower))throw Error('DEPLOY BLOQUEADO: componente proibido no bundle Banner: '+relative)
 if(base==='.env'||base.startsWith('.env.')||/\.(?:pem|key|p12)$/.test(base)||/(^|\/)secrets?(\/|$)/.test(lower))throw Error('DEPLOY BLOQUEADO: secret/env proibido no bundle Banner: '+relative)
 if(/(^|\/)(?:tiktok-connection|tiktok-callback|_shared\/tiktok|tiktokintegration|config\/tiktok|tiktok-oauth-connection)(\/|\.|$)/.test(lower))throw Error('DEPLOY BLOQUEADO: TikTok proibido no bundle Banner: '+relative)
 if(/(^|\/)(?:instagram-connection|instagram-callback|instagram-publish|_shared\/instagram|meta-oauth|social-publish-[^/]*|social-media-lease)(\/|\.|$)/.test(lower))throw Error('DEPLOY BLOQUEADO: Meta/social proibido no bundle Banner: '+relative)
 const edge=lower.match(/^supabase\/functions\/([^/]+)\//)?.[1]
 if(edge&&edge!=='gerar-hero-ia'&&edge!=='_shared')throw Error('DEPLOY BLOQUEADO: outra Edge Function no bundle Banner: '+relative)
 return value
}

function assertExactCaseAndSafeRealpath(repoRoot,absolute){
 const rootAbsolute=path.resolve(repoRoot),rootReal=realpathSync(rootAbsolute)
 if(!inside(rootAbsolute,absolute))throw Error('DEPLOY BLOQUEADO: path traversal fora do repositório')
 const segments=path.relative(rootAbsolute,absolute).split(path.sep).filter(Boolean)
 let current=rootAbsolute
 for(const segment of segments){
  const names=readdirSync(current)
  if(!names.includes(segment)){
   if(names.some(name=>name.toLowerCase()===segment.toLowerCase()))throw Error('DEPLOY BLOQUEADO: case mismatch em import local: '+segment)
   throw Error('DEPLOY BLOQUEADO: import local inexistente: '+segment)
  }
  current=path.join(current,segment)
  const metadata=lstatSync(current)
  if(metadata.isSymbolicLink()&&!inside(rootReal,realpathSync(current)))throw Error('DEPLOY BLOQUEADO: symlink externo no bundle Banner')
 }
 const resolved=realpathSync(absolute)
 if(!inside(rootReal,resolved))throw Error('DEPLOY BLOQUEADO: caminho real fora do repositório')
 return resolved
}

function runtimeSpecifiers(source,file){
 let ast
 try {ast=babelParse(source,{sourceType:'module',plugins:['typescript','importAttributes']})}
 catch {throw Error('DEPLOY BLOQUEADO: fonte runtime inválida: '+file)}
 const specifiers=[]
 const add=node=>{const value=node?.value;if(typeof value==='string')specifiers.push(value)}
 const walk=node=>{
  if(!node||typeof node!=='object')return
  if(node.type==='ImportDeclaration'){
   const runtime=node.importKind!=='type'&&(node.specifiers.length===0||node.specifiers.some(specifier=>specifier.type!=='ImportSpecifier'||specifier.importKind!=='type'))
   if(runtime)add(node.source)
  } else if((node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration')&&node.source&&node.exportKind!=='type')add(node.source)
  else if(node.type==='ImportExpression'){
   if(node.source?.type!=='StringLiteral')throw Error('DEPLOY BLOQUEADO: import dinâmico não literal em '+file)
   add(node.source)
  } else if(node.type==='CallExpression'&&node.callee?.type==='Import'){
   if(node.arguments?.length!==1||node.arguments[0]?.type!=='StringLiteral')throw Error('DEPLOY BLOQUEADO: import dinâmico não literal em '+file)
   add(node.arguments[0])
  }
  if(node.type==='CallExpression'){
   const callee=node.callee
   const member=callee?.type==='MemberExpression'&&!callee.computed&&callee.object?.type==='Identifier'&&callee.property?.type==='Identifier'?callee.object.name+'.'+callee.property.name:''
   const direct=callee?.type==='Identifier'?callee.name:''
   if(['Deno.readFile','Deno.readTextFile','Deno.open','Bun.file'].includes(member)||['readFile','readFileSync','readTextFile'].includes(direct))throw Error('DEPLOY BLOQUEADO: leitura runtime de asset local não declarada em '+file)
  }
  if(node.type==='NewExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='URL'&&node.arguments?.[0]?.type==='StringLiteral'&&node.arguments[0].value.startsWith('.'))throw Error('DEPLOY BLOQUEADO: asset local via URL não suportado em '+file)
  for(const [key,value] of Object.entries(node)){
   if(['loc','start','end'].includes(key))continue
   if(Array.isArray(value))for(const child of value)walk(child)
   else if(value&&typeof value==='object')walk(value)
  }
 }
 walk(ast.program)
 return specifiers
}

function resolveLocalSpecifier(repoRoot,fromFile,specifier){
 if(path.isAbsolute(specifier)||specifier.startsWith('file:'))throw Error('DEPLOY BLOQUEADO: import absoluto inesperado em '+fromFile)
 const base=path.resolve(repoRoot,path.dirname(fromFile),specifier)
 if(!inside(path.resolve(repoRoot),base))throw Error('DEPLOY BLOQUEADO: path traversal em import de '+fromFile)
 const candidates=path.extname(base)?[base]:[base,...['.ts','.tsx','.js','.jsx','.mjs','.json'].map(extension=>base+extension),...['.ts','.tsx','.js','.jsx','.mjs','.json'].map(extension=>path.join(base,'index'+extension))]
 const absolute=candidates.find(candidate=>existsSync(candidate))
 if(!absolute)throw Error('DEPLOY BLOQUEADO: import local não resolvido em '+fromFile+': '+specifier)
 assertExactCaseAndSafeRealpath(repoRoot,absolute)
 return assertAllowedBannerRuntimePath(posix(path.relative(repoRoot,absolute)))
}

export function resolveBannerRuntimeClosure({repoRoot,entry=BANNER_RUNTIME_ENTRY,trackedFiles}){
 const tracked=trackedFiles instanceof Set?trackedFiles:new Set(trackedFiles||[])
 const pending=[assertAllowedBannerRuntimePath(posix(entry))],visited=new Set()
 while(pending.length){
  const file=pending.pop()
  if(visited.has(file))continue
  const absolute=path.resolve(repoRoot,file)
  assertExactCaseAndSafeRealpath(repoRoot,absolute)
  if(!tracked.has(file))throw Error('DEPLOY BLOQUEADO: arquivo runtime não rastreado no commit: '+file)
  visited.add(file)
  for(const specifier of runtimeSpecifiers(readFileSync(absolute,'utf8'),file)){
   if(specifier.startsWith('http:')||specifier.startsWith('https:')||specifier.startsWith('npm:')||specifier.startsWith('jsr:')||specifier.startsWith('node:'))continue
   if(!specifier.startsWith('.')&&!path.isAbsolute(specifier)&&!specifier.startsWith('file:'))continue
   pending.push(resolveLocalSpecifier(repoRoot,file,specifier))
  }
 }
 return [...visited].sort()
}

export function validateBannerRuntimeClosure(closure,expected=BANNER_RUNTIME_CLOSURE){
 const actual=[...closure].sort(),wanted=[...expected].sort()
 if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Error('DEPLOY BLOQUEADO: closure runtime Banner diverge do manifesto aprovado')
 return true
}

export async function validateBannerRuntimeBundle({repoRoot,entry=BANNER_RUNTIME_ENTRY,closure,buildImpl}){
 const build=buildImpl||(await import(pathToFileURL(path.join(root,'frontend/node_modules/esbuild/lib/main.js')).href)).build
 let result
 try {result=await build({absWorkingDir:repoRoot,entryPoints:[entry],bundle:true,write:false,platform:'neutral',format:'esm',external:['https://*','http://*','npm:*','jsr:*'],logLevel:'silent',metafile:true})}
 catch(error){throw Error('DEPLOY BLOQUEADO: bundle local gerar-hero-ia falhou: '+(error?.errors?.map(item=>item.text).join('; ')||error?.message||'erro desconhecido'))}
 const inputs=Object.keys(result.metafile?.inputs||{}).map(posix).filter(value=>!value.startsWith('http:')&&!value.startsWith('https:')).sort()
 if(JSON.stringify(inputs)!==JSON.stringify([...closure].sort()))throw Error('DEPLOY BLOQUEADO: closure e metafile esbuild divergentes')
 return inputs
}

export function validateBannerConfigWorktree(diff){
 if(String(diff||'').trim())throw Error('DEPLOY BLOQUEADO: supabase/config.toml do worktree diverge do commit aprovado')
 return true
}

export function validateBannerConfigBlob(blob){
 if(!Buffer.isBuffer(blob))throw Error('DEPLOY BLOQUEADO: blob Git de supabase/config.toml inválido')
 for(const section of forbiddenBannerConfigSections)if(blob.includes(Buffer.from(section)))throw Error('DEPLOY BLOQUEADO: TikTok proibido no config.toml do hotfix Banner')
 if(hash(blob).toUpperCase()!==BANNER_CONFIG_BLOB_SHA256)throw Error('DEPLOY BLOQUEADO: blob Git de supabase/config.toml diverge do baseline aprovado')
 return true
}

export function readBannerConfigBlob(sha,{cwd=root,spawn=spawnSync}={}){
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error('DEPLOY BLOQUEADO: SHA inválido para leitura do config.toml')
 const result=spawn('git',['cat-file','blob',`${sha}:${bannerConfigPath}`],{cwd,encoding:null,stdio:['ignore','pipe','pipe']})
 if(result.error)throw Error('DEPLOY BLOQUEADO: falha ao ler blob Git de supabase/config.toml')
 if(result.status!==0||!Buffer.isBuffer(result.stdout))throw Error('DEPLOY BLOQUEADO: blob Git de supabase/config.toml indisponível')
 validateBannerConfigBlob(result.stdout)
 return Buffer.from(result.stdout)
}

export function validateBannerConfigArtifact(actual,approvedBlob,label='artefato Edge'){
 if(!Buffer.isBuffer(actual)||!Buffer.isBuffer(approvedBlob)||!actual.equals(approvedBlob))throw Error(`DEPLOY BLOQUEADO: supabase/config.toml do ${label} diverge byte a byte do blob Git aprovado`)
 return true
}

export function readZipEntryBytes(file,entryName){
 const archive=readFileSync(file),eocdSignature=0x06054b50,centralSignature=0x02014b50,localSignature=0x04034b50
 let eocd=-1
 for(let offset=archive.length-22;offset>=Math.max(0,archive.length-65557);offset--)if(archive.readUInt32LE(offset)===eocdSignature){eocd=offset;break}
 if(eocd<0)throw Error('DEPLOY BLOQUEADO: ZIP Edge inválido')
 const entries=archive.readUInt16LE(eocd+10),centralOffset=archive.readUInt32LE(eocd+16)
 let offset=centralOffset,found=null
 for(let index=0;index<entries;index++){
  if(offset+46>archive.length||archive.readUInt32LE(offset)!==centralSignature)throw Error('DEPLOY BLOQUEADO: diretório central do ZIP Edge inválido')
  const flags=archive.readUInt16LE(offset+8),method=archive.readUInt16LE(offset+10),compressedSize=archive.readUInt32LE(offset+20),size=archive.readUInt32LE(offset+24),nameLength=archive.readUInt16LE(offset+28),extraLength=archive.readUInt16LE(offset+30),commentLength=archive.readUInt16LE(offset+32),localOffset=archive.readUInt32LE(offset+42)
  const name=archive.subarray(offset+46,offset+46+nameLength).toString('utf8')
  if(name===entryName){
   if(found||flags&1||![0,8].includes(method)||[compressedSize,size,localOffset].includes(0xffffffff))throw Error('DEPLOY BLOQUEADO: entrada config.toml inválida no ZIP Edge')
   if(localOffset+30>archive.length||archive.readUInt32LE(localOffset)!==localSignature)throw Error('DEPLOY BLOQUEADO: entrada local config.toml inválida no ZIP Edge')
   const localNameLength=archive.readUInt16LE(localOffset+26),localExtraLength=archive.readUInt16LE(localOffset+28),start=localOffset+30+localNameLength+localExtraLength,end=start+compressedSize
   if(end>archive.length)throw Error('DEPLOY BLOQUEADO: conteúdo config.toml truncado no ZIP Edge')
   const compressed=archive.subarray(start,end),data=method===0?Buffer.from(compressed):inflateRawSync(compressed)
   if(data.length!==size)throw Error('DEPLOY BLOQUEADO: tamanho config.toml inválido no ZIP Edge')
   found=data
  }
  offset+=46+nameLength+extraLength+commentLength
 }
 if(!found)throw Error('DEPLOY BLOQUEADO: supabase/config.toml ausente no ZIP Edge')
 return found
}

async function official(){
 const info=JSON.parse(vc(['inspect',target.alias,'--json']))
 const detail=JSON.parse(vc(['api','/v13/deployments/'+info.id,'--raw']))
 if(detail.readyState!=='READY'||!detail.meta?.githubCommitSha)throw Error('DEPLOY BLOQUEADO: SHA oficial indisponível')
 assertTargetIdentity(target,detail)
 return {sha:detail.meta.githubCommitSha,id:info.id}
}

let edgeCli=null
function functionsList(){return JSON.parse(run(edgeCli,['functions','list','--project-ref',BANNER_RECOVERY_RELEASE.projectRef,'--output','json']))}
function adminVersion(){return adminApiVersion(functionsList())}
function tiktokContentPostingVersionActive(){return tiktokContentPostingVersion(functionsList())}
function bannerVersion(expected=null){return bannerFunctionVersion(functionsList(),expected)}
function isAncestor(ancestor,descendant){return spawnSync('git',['merge-base','--is-ancestor',ancestor,descendant],{cwd:root}).status===0}

function validateBannerLocal(current,sha){
 if(current.sha!==BANNER_RECOVERY_RELEASE.baseSha||current.id!==BANNER_RECOVERY_RELEASE.frontendDeploymentId)throw Error('DEPLOY BLOQUEADO: baseline oficial do hotfix Banner mudou')
 validateBannerWorktreeStatus(git('status','--porcelain','--untracked-files=normal'))
 validateBannerAncestry({
  baseIsAncestor:isAncestor(BANNER_RECOVERY_RELEASE.baseSha,sha),
  functionalIsAncestor:isAncestor(BANNER_RECOVERY_RELEASE.functionalSha,sha),
 })
 const paths=git('diff','--name-only',BANNER_RECOVERY_RELEASE.baseSha,sha).split('\n').filter(Boolean)
 validateBannerRecoveryManifest(paths)
 validateBannerVerifyJwt(readFileSync(path.join(root,'supabase/config.toml'),'utf8'))
 return paths
}

export function bannerTests({
 runCommon=run,
 runFrontend=runBannerFrontendCommand,
 spawn=spawnSync,
 validateDesign=validateKnownBannerDesignFailure,
 read=readFileSync,
 platform=process.platform,
}={}){
 runCommon(process.execPath,['--test','--test-isolation=none','scripts/production/banner-recovery-release.test.mjs','scripts/production/admin-release.test.mjs','scripts/production/guard.test.mjs'],root,true)
 runCommon(process.execPath,['--test',
  'supabase/functions/gerar-hero-ia/recover-batch.test.mjs',
  'supabase/functions/gerar-hero-ia/economy.test.ts',
  'supabase/functions/gerar-hero-ia/economy-contract.test.ts',
  'supabase/functions/gerar-hero-ia/creation-runtime.test.ts',
  'supabase/functions/gerar-hero-ia/guest-input.test.mjs',
  'supabase/functions/gerar-hero-ia/guest-images-payload.test.mjs',
 ],root,true)
 const frontendRoot=path.join(root,'frontend')
 runFrontend(process.execPath,['--test',
  'tests/banner-conversation-rhythm.test.mjs',
  'tests/banner-conversational-guest.test.mjs',
  'tests/banner-frontend-recovery.test.mjs',
  'tests/banner-generation-error.test.mjs',
  'tests/banner-social-publish-render.test.mjs',
  'tests/banner-social-publish.test.mjs',
  'tests/hero-commercial-terms.test.mjs',
  'tests/hero-image-preview-lightbox.test.mjs',
  'tests/hero-public-copy.test.mjs',
  'tests/quick-banners-conversation.test.mjs',
  'tests/quick-banners-economy.test.mjs',
  'tests/studio-hero-design-system.test.mjs',
  ],frontendRoot)
 const designTest=path.join(frontendRoot,'tests/banner-design-system.test.mjs')
 const expected=spawn(process.execPath,['--test','--test-reporter=tap',designTest],{cwd:frontendRoot,encoding:'utf8',env:createBannerFrontendTestEnv()})
 validateDesign({
  status:expected.status,
  output:(expected.stdout||'')+(expected.stderr||''),
  testSource:read(designTest,'utf8'),
  bannerSource:read(path.join(frontendRoot,'src/pages/HeroNext.jsx'),'utf8'),
 })
 const npm=platform==='win32'?'npm.cmd':'npm'
 runFrontend(npm,['run','build'],frontendRoot)
}

const responseHeader=(headers,name)=>typeof headers?.get==='function'?headers.get(name):headers?.[name]??headers?.[name.toLowerCase()]??null

export function validateVercelProtectionResponse(response){
 if(response?.status!==302)throw Error('DEPLOY BLOQUEADO: candidato protegido não retornou o 302 Vercel esperado')
 if(!/^vercel$/i.test(String(responseHeader(response.headers,'server')||'').trim()))throw Error('DEPLOY BLOQUEADO: candidato protegido sem assinatura Server da Vercel')
 let location
 try {location=new URL(String(responseHeader(response.headers,'location')||''))} catch {throw Error('DEPLOY BLOQUEADO: Location inválido na proteção Vercel')}
 if(location.origin!=='https://vercel.com'||location.pathname!=='/sso-api')throw Error('DEPLOY BLOQUEADO: redirect inesperado na proteção Vercel')
 return true
}

export async function protectedCandidateSmoke(url,{fetchImpl=fetch}={}){
 if(url!==bannerRecoveryReadyCandidate.url)throw Error('DEPLOY BLOQUEADO: candidato protegido não é o deployment aprovado')
 const response=await fetchImpl(url+'/',{redirect:'manual',cache:'no-store'})
 validateVercelProtectionResponse(response)
 return true
}

export function validateProtectedBannerCandidateMetadata({url,info,detail,current,fresh,backendVersion}){
 if(url!==bannerRecoveryReadyCandidate.url)throw Error('DEPLOY BLOQUEADO: URL do candidato protegido divergente')
 if(info?.id!==bannerRecoveryReadyCandidate.id||detail?.id!==bannerRecoveryReadyCandidate.id)throw Error('DEPLOY BLOQUEADO: deployment ID do candidato protegido divergente')
 if(info?.readyState!=='READY'||detail?.readyState!=='READY')throw Error('DEPLOY BLOQUEADO: candidato protegido não está READY')
 if(detail?.meta?.githubCommitSha!==bannerRecoveryReadyCandidate.sha)throw Error('DEPLOY BLOQUEADO: SHA do candidato protegido divergente')
 if(detail?.projectId!==bannerVercelIdentity.projectId||detail?.ownerId!==bannerVercelIdentity.ownerId||detail?.name!==bannerVercelIdentity.projectName)throw Error('DEPLOY BLOQUEADO: projeto/team do candidato protegido divergente')
 if(current?.id!==BANNER_RECOVERY_RELEASE.frontendDeploymentId||current?.sha!==BANNER_RECOVERY_RELEASE.baseSha)throw Error('DEPLOY BLOQUEADO: baseline oficial do hotfix Banner mudou')
 if(fresh?.id!==current.id||fresh?.sha!==current.sha)throw Error('DEPLOY BLOQUEADO: Production mudou antes da promoção')
 if(info.id===fresh.id)throw Error('DEPLOY BLOQUEADO: candidato Banner já está no alias oficial')
 if(backendVersion!==BANNER_PROMOTION_BACKEND_VERSION)throw Error('DEPLOY BLOQUEADO: gerar-hero-ia deve estar exatamente na versão 75 para promoção')
 return true
}

export async function publicBannerSmoke({expectedSha,fetchImpl=fetch,origin='https://www.smartcorretorai.com'}={}){
 const release=await fetchImpl(origin+'/production-release.json',{redirect:'manual',cache:'no-store'})
 if(release.status!==200)throw Error('Smoke pós-deploy: production-release.json não retornou 200')
 const releaseBody=await release.json()
 if(releaseBody?.sha!==expectedSha)throw Error('Smoke pós-deploy: SHA oficial divergente')
 for(const route of ['/','/criar-anuncio','/dashboard','/admin']){
  const response=await fetchImpl(origin+route,{redirect:'manual',cache:'no-store'})
  const type=String(responseHeader(response.headers,'content-type')||'').toLowerCase()
  const body=await response.text()
  if(response.status!==200||!type.startsWith('text/html')||!/SmartCorretorAI/i.test(body)||/Login\s*[–-]\s*Vercel|vercel\.com\/sso-api/i.test(body))throw Error('Smoke pós-deploy falhou: '+route)
 }
 return true
}

async function bannerUnauthenticatedSmoke(){
 const response=await fetch(`https://${BANNER_RECOVERY_RELEASE.projectRef}.supabase.co/functions/v1/${BANNER_RECOVERY_RELEASE.functionName}`,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recover_batch',client_request_id:'00000000-0000-4000-8000-000000000000'}),
 })
 if(response.status!==401)throw Error('DEPLOY BLOQUEADO: gerar-hero-ia aceitou recovery sem autenticação')
}

function terminalPollingError(message){
 const error=Error(message)
 error.vercelPollingTerminal=true
 return error
}

export async function waitForVercelReady({inspect,timeoutMs=vercelReadyTimeoutMs,intervalMs=vercelReadyPollIntervalMs,now=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onWait=()=>{}}){
 if(typeof inspect!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<0||!Number.isFinite(intervalMs)||intervalMs<=0)throw Error('Configuração inválida do polling Vercel')
 const startedAt=now()
 let lastInspectionError=null
 for(;;){
  try {
   const info=await inspect()
   const state=String(info?.readyState||'').toUpperCase()
   lastInspectionError=null
   if(state==='READY')return info
   if(vercelTerminalStates.has(state))throw terminalPollingError('DEPLOY BLOQUEADO: deployment Vercel terminou em '+state)
   if(!vercelTransientStates.has(state))throw terminalPollingError('DEPLOY BLOQUEADO: estado Vercel desconhecido: '+(state||'<vazio>'))
   onWait({state,elapsedMs:now()-startedAt})
  } catch(error) {
   if(error?.vercelPollingTerminal)throw error
   lastInspectionError=error
   onWait({state:'INSPECTION_RETRY',elapsedMs:now()-startedAt})
  }
  const elapsedMs=now()-startedAt
  if(elapsedMs>=timeoutMs)throw Error('DEPLOY BLOQUEADO: timeout aguardando Vercel READY'+(lastInspectionError?' após falha transitória de inspeção':''))
  await sleep(Math.min(intervalMs,timeoutMs-elapsedMs))
 }
}

function bannerCandidateExpectation(url,currentHeadSha){
 return url===bannerRecoveryReadyCandidate.url?bannerRecoveryReadyCandidate:{url,id:null,sha:currentHeadSha}
}

export function validateBannerStageOneCandidate({url,info,detail,expectedCandidateSha,expectedCandidateId=null,current,fresh,backendVersion}){
 if(!vercelCandidateUrlPattern.test(url))throw Error('DEPLOY BLOQUEADO: URL explícita do candidato Banner inválida')
 if(info?.readyState!=='READY'||detail?.readyState!=='READY')throw Error('DEPLOY BLOQUEADO: candidato Banner não está READY')
 if(!info?.id||info.id!==detail.id)throw Error('DEPLOY BLOQUEADO: identidade do candidato Banner divergente')
 if(expectedCandidateId&&info.id!==expectedCandidateId)throw Error('DEPLOY BLOQUEADO: deployment ID do candidato Banner divergente')
 if(detail.meta?.githubCommitSha!==expectedCandidateSha)throw Error('DEPLOY BLOQUEADO: SHA do candidato Banner divergente')
 if(detail.projectId!==bannerVercelIdentity.projectId||detail.ownerId!==bannerVercelIdentity.ownerId||detail.name!==bannerVercelIdentity.projectName)throw Error('DEPLOY BLOQUEADO: projeto/team do candidato Banner divergente')
 if(current.sha!==BANNER_RECOVERY_RELEASE.baseSha||current.id!==BANNER_RECOVERY_RELEASE.frontendDeploymentId)throw Error('DEPLOY BLOQUEADO: baseline oficial do hotfix Banner mudou')
 if(fresh.sha!==current.sha||fresh.id!==current.id)throw Error('DEPLOY BLOQUEADO: Production mudou durante o build')
 if(info.id===fresh.id)throw Error('DEPLOY BLOQUEADO: candidato Banner já está no alias oficial')
 if(backendVersion!==BANNER_RECOVERY_RELEASE.edgeVersion)throw Error('DEPLOY BLOQUEADO: gerar-hero-ia não permanece na versão de baseline')
 return true
}

export async function acquireBannerStageOneCandidate({explicitUrl='',createDeployment,inspectDeployment,inspectDeploymentDetail,readOfficial,readBackendVersion,currentHeadSha,current,polling={}}){
 const reuseUrl=String(explicitUrl||'').trim()
 const reused=Boolean(reuseUrl)
 const url=reused?reuseUrl:await createDeployment()
 const expectation=bannerCandidateExpectation(url,currentHeadSha)
 const info=await waitForVercelReady({inspect:()=>inspectDeployment(url),...polling})
 const detail=await inspectDeploymentDetail(info.id)
 const fresh=await readOfficial()
 const backendVersion=await readBackendVersion()
 validateBannerStageOneCandidate({url,info,detail,expectedCandidateSha:expectation.sha,expectedCandidateId:expectation.id,current,fresh,backendVersion})
 return {url,info,detail,fresh,reused,candidateSha:expectation.sha}
}

async function promoteBanner(current,sha){
 validateBannerLocal(current,sha)
 const backendVersion=bannerVersion(BANNER_PROMOTION_BACKEND_VERSION)
 const url=String(process.env.BANNER_RECOVERY_CANDIDATE_URL||'').trim()
 const info=JSON.parse(vc(['inspect',url,'--json']))
 const detail=JSON.parse(vc(['api','/v13/deployments/'+info.id,'--raw']))
 const fresh=await official()
 const expectation=bannerCandidateExpectation(url,sha)
 if(expectation.id&&info.id!==expectation.id)throw Error('DEPLOY BLOQUEADO: deployment ID do candidato Banner divergente')
 validateBannerPromotionCandidate({url,info,detail,sha:expectation.sha,current,fresh,backendVersion})
 validateProtectedBannerCandidateMetadata({url,info,detail,current,fresh,backendVersion})
 await protectedCandidateSmoke(url)
 vc(['promote',url,'--yes'])
 await publicBannerSmoke({expectedSha:expectation.sha})
 console.log(JSON.stringify({sha:expectation.sha,gateSha:sha,deploymentId:info.id,backendVersion,ready:info.readyState,alias:'www.smartcorretorai.com',postSmoke:'PASS'}))
}

export async function main(args=process.argv.slice(2)){
 target=deploymentTarget(args)
 const {dryRun,candidateOnly}=deploymentOptions(args)
 if(dryRun){
  console.log(JSON.stringify(dryRunPlan(target,git('rev-parse','HEAD'),{candidateOnly})))
  return
 }
 cli=resolveVercelCli()
edgeCli=resolveSupabaseCli()
const mode=deploymentMode(args)
const deployVideoSocialMetadata=mode==='--video-social-metadata'
const deployAdminApi=mode==='--admin-api'
const deployTikTokContentPosting=mode==='--tiktok-content-posting'
const deployBannerRecovery=mode==='--banner-recovery-hotfix'
const promoteBannerRecovery=mode==='--banner-recovery-promote'
 if(candidateOnly&&(deployVideoSocialMetadata||deployAdminApi||deployTikTokContentPosting||deployBannerRecovery||promoteBannerRecovery))throw Error('DEPLOY BLOQUEADO: --candidate-only não pode ser combinado com modos de Edge/Banner')
 if(target.name!=='smartcorretorai'&&(deployVideoSocialMetadata||deployAdminApi||deployTikTokContentPosting||deployBannerRecovery||promoteBannerRecovery))throw Error('DEPLOY BLOQUEADO: modos de Edge/Banner pertencem somente ao target smartcorretorai')
const selectedFunctions=edgeScope(args)
const current=await official(),sha=git('rev-parse','HEAD')
if(deployTikTokContentPosting)tiktokContentPostingVersionActive()

if(promoteBannerRecovery){
 await promoteBanner(current,sha)
 process.exit(0)
}

const previousAdminVersion=deployAdminApi?adminVersion():null
const previousBannerVersion=deployBannerRecovery?bannerVersion(BANNER_RECOVERY_RELEASE.edgeVersion):null
if(deployAdminApi&&previousAdminVersion!==Number(process.env.ADMIN_API_EXPECTED_VERSION))throw Error('DEPLOY BLOQUEADO: versão da admin-api difere do backup validado')
let bannerRuntimeClosure=null,bannerConfigBlob=null
if(deployBannerRecovery){
 validateBannerLocal(current,sha)
 const trackedFiles=new Set(git('ls-tree','-r','--name-only',sha).split('\n').filter(Boolean).map(posix))
 bannerRuntimeClosure=resolveBannerRuntimeClosure({repoRoot:root,trackedFiles})
 validateBannerRuntimeClosure(bannerRuntimeClosure)
 if(git('diff','--name-only',sha,'--',...bannerRuntimeClosure))throw Error('DEPLOY BLOQUEADO: dependência runtime diverge do blob aprovado')
 validateBannerConfigWorktree(git('diff','--name-only',sha,'--',bannerConfigPath))
 bannerConfigBlob=readBannerConfigBlob(sha)
 await validateBannerRuntimeBundle({repoRoot:root,closure:bannerRuntimeClosure})
}
else {
 if(!isAncestor(current.sha,sha))throw Error(ancestryError)
 if(git('diff','HEAD','--name-only'))throw Error('DEPLOY BLOQUEADO: crie checkpoint antes de publicar')
}
smoke(root)
if(deployAdminApi)run(process.execPath,['--test','--test-isolation=none','scripts/production/admin-release.test.mjs','scripts/production/guard.test.mjs'],root,true)
if(deployVideoSocialMetadata)run(process.execPath,['--test','--test-isolation=none','frontend/tests/video-social-metadata.test.mjs','supabase/functions/social-publish-video/runtime.test.ts','frontend/tests/social-publish-ui-state.test.mjs'],root,true)
if(deployBannerRecovery)bannerTests()
else run(process.execPath,['--test','--test-isolation=none','frontend/tests/home-groups.test.mjs','frontend/tests/account-analytics.test.mjs','frontend/tests/banner-conversational-guest.test.mjs'],root,true)

const stage=path.join(root,'experiments','production-releases',sha+'-'+Date.now());mkdirSync(stage,{recursive:true})
const zip=stage+'.zip'
const packagePaths=['frontend','core','api','server','scripts/production','supabase/functions/_shared','vercel.json','.vercelignore','package.json','package-lock.json']
git('-c','core.autocrlf=false','archive','--format=zip','--output='+zip,sha,...packagePaths)
if(process.platform==='win32')run(process.env.POWERSHELL_CLI||'pwsh',['-NoProfile','-File',path.join(root,'scripts/production/extract-archive.ps1'),'-ArchivePath',zip,'-DestinationPath',stage])
else run('unzip',['-o',zip,'-d',stage])
console.log(JSON.stringify({archiveFilesVerified:verifyArchiveTree(git('ls-tree','-r','-z',sha,'--',...packagePaths),stage)}))
const revisions=[...git('rev-list',sha,'^'+current.sha).split('\n').filter(Boolean),current.sha]
const proof={sha,baseline:current.sha,bootstrap:current.sha==='75a6a0611c8cc7bbfa038817f129c3ad60477bb9',commits:revisions.map(id=>({sha:id,body:spawnSync('git',['cat-file','commit',id],{cwd:root}).stdout.toString('base64')})),files:{}}
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else {const relative=path.relative(stage,p).replaceAll('\\','/');if(e.name!=='vercel.json'&&e.name!=='.vercelignore'&&!e.name.startsWith('.env')&&!relative.startsWith('supabase/')&&!relative.endsWith('.log')&&!relative.includes('/node_modules/'))proof.files[relative]=hash(readFileSync(p))}}}
walk(stage);verifyProof(proof,current.sha,stage);writeFileSync(path.join(stage,'.production-proof.json'),JSON.stringify(proof))
const stagedVercelConfig=JSON.parse(readFileSync(path.join(stage,'vercel.json'),'utf8'))
stagedVercelConfig.buildCommand=target.buildCommand
stagedVercelConfig.outputDirectory=target.outputDirectory
writeFileSync(path.join(stage,'vercel.json'),JSON.stringify(stagedVercelConfig,null,2))
mkdirSync(path.join(stage,'.vercel'),{recursive:true});writeFileSync(path.join(stage,'.vercel/project.json'),JSON.stringify({projectId:target.projectId,orgId:target.teamId}))
console.log('Guard PASS; candidato '+sha+' contém Production '+current.sha)
let url,info,fresh,candidateSha=sha
if(deployBannerRecovery){
 const candidate=await acquireBannerStageOneCandidate({
  explicitUrl:process.env.BANNER_RECOVERY_CANDIDATE_URL,
  createDeployment:()=>{
   const output=vc(['deploy','--prod','--skip-domain','--yes','--meta','githubCommitSha='+sha],stage)
   const match=output.match(/https:\/\/smartcorretorai-[a-z0-9]+-smart-corretor-ai-s-projects\.vercel\.app/g)
   if(!match)throw Error('Deployment não identificado; domínio oficial não alterado')
   return match.at(-1)
  },
  inspectDeployment:candidateUrl=>JSON.parse(vc(['inspect',candidateUrl,'--json'])),
  inspectDeploymentDetail:deploymentId=>JSON.parse(vc(['api','/v13/deployments/'+deploymentId,'--raw'])),
  readOfficial:official,
  readBackendVersion:()=>bannerVersion(BANNER_RECOVERY_RELEASE.edgeVersion),
  currentHeadSha:sha,current,
  polling:{onWait:({state})=>console.log('Aguardando Vercel READY: '+state)},
 })
 ;({url,info,fresh,candidateSha}=candidate)
 console.log(candidate.reused?'Candidato Vercel explícito validado e reutilizado; nenhum novo deployment foi criado.':'Candidato Vercel criado e confirmado READY.')
} else {
 const output=vc(['deploy','--prod','--skip-domain','--yes','--build-env','PRODUCTION_TARGET='+target.name,'--meta','githubCommitSha='+sha],stage)
 const match=output.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g)
 if(!match)throw Error('Deployment não identificado; domínio oficial não alterado')
 url=match.at(-1)
 info=JSON.parse(vc(['inspect',url,'--json']))
 if(info.readyState!=='READY')throw Error('Deployment não está READY')
 assertTargetIdentity(target,JSON.parse(vc(['api','/v13/deployments/'+info.id,'--raw'])))
 fresh=await official()
 if(fresh.id!==current.id)throw Error('DEPLOY BLOQUEADO: Production mudou durante o build; execute novamente')
}

if(deployVideoSocialMetadata||deployAdminApi||deployTikTokContentPosting||deployBannerRecovery){
 const edgeStage=stage+'-edge',edgeZip=edgeStage+'.zip';mkdirSync(edgeStage,{recursive:true})
 const edgeArchivePaths=deployBannerRecovery?[...bannerRuntimeClosure,'supabase/config.toml']:['supabase/functions','supabase/config.toml']
 git('-c','core.autocrlf=false','archive','--format=zip','--output='+edgeZip,sha,...edgeArchivePaths)
 if(deployBannerRecovery)validateBannerConfigArtifact(readZipEntryBytes(edgeZip,bannerConfigPath),bannerConfigBlob,'ZIP Edge')
 if(process.platform==='win32')run(process.env.POWERSHELL_CLI||'pwsh',['-NoProfile','-File',path.join(root,'scripts/production/extract-archive.ps1'),'-ArchivePath',edgeZip,'-DestinationPath',edgeStage])
 else run('unzip',['-o',edgeZip,'-d',edgeStage])
 console.log(JSON.stringify({edgeArchiveFilesVerified:verifyArchiveTree(git('ls-tree','-r','-z',sha,'--',...edgeArchivePaths),edgeStage)}))
 if(deployBannerRecovery){
  const stagedClosure=resolveBannerRuntimeClosure({repoRoot:edgeStage,trackedFiles:new Set(bannerRuntimeClosure)})
  validateBannerRuntimeClosure(stagedClosure,bannerRuntimeClosure)
  validateBannerConfigArtifact(readFileSync(path.join(edgeStage,bannerConfigPath)),bannerConfigBlob,'staging Edge')
  await validateBannerRuntimeBundle({repoRoot:edgeStage,closure:stagedClosure})
 }
 if(deployAdminApi&&adminVersion()!==previousAdminVersion)throw Error('DEPLOY BLOQUEADO: admin-api mudou durante o build')
 if(deployBannerRecovery&&bannerVersion()!==previousBannerVersion)throw Error('DEPLOY BLOQUEADO: gerar-hero-ia mudou durante o build')
 const deployArgs=['functions','deploy',...selectedFunctions,'--project-ref',BANNER_RECOVERY_RELEASE.projectRef,'--use-api','--workdir',edgeStage]
 if(deployBannerRecovery)deployArgs.push('--no-verify-jwt')
 run(edgeCli,deployArgs,root,true)
 if(deployAdminApi){
  const version=adminVersion()
  if(version<=previousAdminVersion)throw Error('DEPLOY BLOQUEADO: versão da admin-api não avançou')
  const response=await fetch(`https://${BANNER_RECOVERY_RELEASE.projectRef}.supabase.co/functions/v1/admin-api`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'guest_banner_metrics',period:7})})
  if(response.status!==401)throw Error('DEPLOY BLOQUEADO: gate sem sessão da admin-api divergente')
  console.log(JSON.stringify({adminApiVersion:version,previousAdminVersion,verifyJwt:true,unauthenticatedStatus:response.status}))
 }
 if(deployBannerRecovery){
  const version=bannerVersion()
  if(version<=previousBannerVersion)throw Error('DEPLOY BLOQUEADO: versão de gerar-hero-ia não avançou')
  await bannerUnauthenticatedSmoke()
  console.log(JSON.stringify({mode:'banner-recovery-hotfix',sha:candidateSha,gateSha:sha,deploymentId:info.id,candidateUrl:url,ready:info.readyState,baselineDeploymentId:current.id,baselineSha:current.sha,previousBannerVersion,newBannerVersion:version,verifyJwt:false,promotion:'PENDING_EXPLICIT_APPROVAL'}))
 }
 const afterEdges=await official()
 if(afterEdges.id!==current.id)throw Error('DEPLOY BLOQUEADO: Production mudou durante a publicação das funções')
}

if(deployBannerRecovery){
 await protectedCandidateSmoke(url)
 console.log('Candidato Banner pronto. Use --banner-recovery-promote somente após aprovação humana explícita.')
 process.exit(0)
}

if(candidateOnly){
 for(const route of target.smokeRoutes){
  const response=await fetch(new URL(route,url),{redirect:'manual',cache:'no-store'})
  const body=await response.text()
  if(response.status!==200||!String(responseHeader(response.headers,'content-type')||'').toLowerCase().startsWith('text/html')||!body.includes(target.brand))throw Error('Smoke candidate falhou: '+route)
 }
 console.log(JSON.stringify({target:target.name,projectId:target.projectId,deploymentUrl:url,deploymentId:info.id,sha,status:info.readyState,smoke:'PASS',promotion:'skipped by --candidate-only'}))
 return
}

vc(['promote',url,'--yes'])
if(target.name==='smartcorretorai'){
 const release=await fetch('https://www.smartcorretorai.com/production-release.json',{cache:'no-store'}).then(r=>r.json())
 if(release.sha!==sha)throw Error('Smoke pós-deploy: SHA oficial divergente')
}
for(const route of target.smokeRoutes){const r=await fetch('https://'+target.alias+route);if(!r.ok)throw Error('Smoke pós-deploy falhou: '+route)}
console.log(JSON.stringify({target:target.name,sha,deploymentId:info.id,ready:info.readyState,alias:target.alias,postSmoke:'PASS'}))
}

if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))await main()

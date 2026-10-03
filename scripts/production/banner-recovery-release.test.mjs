import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {hash} from './proof.mjs'
import {
 BANNER_RECOVERY_RELEASE,
 bannerFunctionVersion,
 deploymentMode,
 edgeScope,
 validateBannerAncestry,
 validateBannerPromotionCandidate,
 validateBannerRecoveryManifest,
 validateBannerVerifyJwt,
 validateBannerWorktreeStatus,
 validateKnownBannerDesignFailure,
} from './edge-scope.mjs'
import {
 BANNER_RUNTIME_CLOSURE,
 BANNER_RUNTIME_ENTRY,
 BANNER_FRONTEND_TEST_ENV,
 BANNER_CONFIG_BLOB_SHA256,
 BANNER_PROMOTION_BACKEND_VERSION,
 acquireBannerStageOneCandidate,
 bannerTests,
 createBannerFrontendTestEnv,
 executeCommand,
 protectedCandidateSmoke,
 publicBannerSmoke,
 parseSupabaseCliVersion,
 parseVercelCliVersion,
 resolveBannerRuntimeClosure,
 resolveSupabaseCli,
 resolveVercelCli,
 runBannerFrontendCommand,
 readBannerConfigBlob,
 readZipEntryBytes,
 validateBannerConfigArtifact,
 validateBannerConfigBlob,
 validateBannerConfigWorktree,
 validateProtectedBannerCandidateMetadata,
 validateBannerRuntimeBundle,
 validateBannerRuntimeClosure,
 validateBannerStageOneCandidate,
 validateVercelProtectionResponse,
 waitForVercelReady,
} from './deploy.mjs'

const allowed=[...BANNER_RECOVERY_RELEASE.functionalPaths,...BANNER_RECOVERY_RELEASE.gatePaths]
const deploySource=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
const root=fileURLToPath(new URL('../../',import.meta.url))
const approvedConfigBlob=Buffer.from(readFileSync(path.join(root,'supabase/config.toml'),'utf8').replaceAll('\r\n','\n'))
const candidateUrl='https://smartcorretorai-fremde96m-smart-corretor-ai-s-projects.vercel.app'
const candidateId='dpl_An5uMoKDMQPhU1PjAr1NWSfDVBH7'
const candidateSha='4865f9b57859495c01fa53925b3ab35ee70933c2'
const baseline={sha:BANNER_RECOVERY_RELEASE.baseSha,id:BANNER_RECOVERY_RELEASE.frontendDeploymentId}
const vercelIdentity={projectId:'prj_U3MEwzheOk76LJzPIdx3OyLQbs5g',ownerId:'team_Jhfx1Tk09PX2qGSgri0sSvsQ',name:'smartcorretorai'}
const candidateDetail=overrides=>({id:candidateId,readyState:'READY',...vercelIdentity,meta:{githubCommitSha:candidateSha},...overrides})

function cliDouble(overrides={}){
 const calls=[]
 const values={
  env:{VERCEL_CLI:'tools/vercel.cmd'},cwd:'C:\\candidate',platform:'win32',
  exists:()=>true,stat:()=>({isFile:()=>true}),log:()=>{},
  spawn:(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'59.13.1\n',stderr:''}},
  ...overrides,
 }
 return {values,calls}
}

test('VERCEL_CLI válida é resolvida e usada sem concatenar argumentos',()=>{
 const fixture=cliDouble()
 const command=resolveVercelCli(fixture.values)
 assert.equal(command,path.resolve(fixture.values.cwd,'tools/vercel.cmd'))
 assert.equal(fixture.calls.length,1)
 assert.deepEqual(fixture.calls[0].args.slice(0,3),['/d','/s','/c'])
 assert.match(fixture.calls[0].args[3],/vercel\.cmd" "--version""$/)
 assert.equal(fixture.calls[0].options.shell,false)
})

test('parser Vercel identifica os formatos oficiais da versão instalada',()=>{
 assert.equal(parseVercelCliVersion({stdout:'Vercel CLI 59.13.1\n'}),'59.13.1')
 assert.equal(parseVercelCliVersion({stdout:'59.13.1\n'}),'59.13.1')
 assert.equal(parseVercelCliVersion({stdout:'59.13.1\n',stderr:'Vercel CLI 59.13.1\n'}),'59.13.1')
})

test('parser Vercel bloqueia versão divergente, ausente, ambígua ou output inesperado',()=>{
 assert.throws(()=>parseVercelCliVersion({stdout:'Vercel CLI 59.14.0\n'}),/exatamente 59\.13\.1/)
 assert.throws(()=>parseVercelCliVersion({stdout:''}),/ausente ou ambígua/)
 assert.throws(()=>parseVercelCliVersion({stdout:'59.13.1\n59.14.0\n'}),/ausente ou ambígua/)
 assert.throws(()=>parseVercelCliVersion({stdout:'installed version: 59.13.1\n'}),/output inesperado/)
})

test('VERCEL_CLI ausente permite fallback vercel no PATH após validar versão',()=>{
 const fixture=cliDouble({env:{},exists:()=>false})
 assert.equal(resolveVercelCli(fixture.values),'vercel')
 assert.deepEqual(fixture.calls[0].args.slice(0,3),['/d','/s','/c'])
 assert.match(fixture.calls[0].args[3],/"vercel" "--version""$/)
 assert.equal(fixture.calls[0].options.shell,false)
})

test('VERCEL_CLI ausente e vercel fora do PATH aborta sem retry',()=>{
 let calls=0
 const fixture=cliDouble({
  env:{},
  spawn:()=>{
   calls++
   return {status:null,stdout:'',stderr:'',error:Object.assign(Error('missing'),{code:'ENOENT'})}
  },
 })
 assert.throws(()=>resolveVercelCli(fixture.values),/Vercel CLI ausente/)
 assert.equal(calls,1)
})

test('VERCEL_CLI inexistente aborta antes de executar qualquer comando',()=>{
 const fixture=cliDouble({exists:()=>false})
 assert.throws(()=>resolveVercelCli(fixture.values),/não aponta para um arquivo executável existente/)
 assert.equal(fixture.calls.length,0)
})

test('falha de --version aborta',()=>{
 const fixture=cliDouble({spawn:()=>({status:1,stdout:'',stderr:'invalid'})})
 assert.throws(()=>resolveVercelCli(fixture.values),/Comando obrigatório falhou/)
})

test('ENOENT é identificado explicitamente e não recebe retry',()=>{
 let calls=0
 const spawn=()=>{calls++;return {status:null,stdout:'',stderr:'',error:Object.assign(Error('missing'),{code:'ENOENT'})}}
 assert.throws(()=>executeCommand('missing-vercel',['--version'],{spawn,platform:'linux'}),/não encontrado \(ENOENT\): missing-vercel/)
 assert.equal(calls,1)
})

for(const value of ['vercel.cmd && whoami','vercel.cmd|whoami','vercel.cmd;whoami','vercel.cmd > output','$(whoami)','`whoami`','"vercel.cmd"'])test(`VERCEL_CLI rejeita shell injection: ${value}`,()=>{
 const fixture=cliDouble({env:{VERCEL_CLI:value}})
 assert.throws(()=>resolveVercelCli(fixture.values),/somente um caminho/)
 assert.equal(fixture.calls.length,0)
})

test('resolução da CLI não usa npx, download nem chamada remota antes de --version',()=>{
 const helper=resolveVercelCli.toString()+executeCommand.toString()
 assert.doesNotMatch(helper,/\bnpx\b|npm\s+install|https?:\/\//)
 const fixture=cliDouble()
 resolveVercelCli(fixture.values)
 assert.equal(fixture.calls.every(call=>call.args.at(-1).includes('"--version"')),true)
 const initialization=deploySource.indexOf('resolveVercelRuntime()')
 const deploymentBaseline=deploySource.indexOf('const current=candidateOnly?{sha,id:null,bootstrap:true}:await official()')
 assert.ok(initialization>0&&deploymentBaseline>initialization)
})

function supabaseCliDouble(overrides={}){
 const calls=[]
 const values={
  env:{SUPABASE_CLI:'tools/supabase.cmd'},cwd:'C:\\candidate',platform:'win32',
  exists:()=>true,stat:()=>({isFile:()=>true}),log:()=>{},
  spawn:(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'2.116.0\n',stderr:''}},
  ...overrides,
 }
 return {values,calls}
}

test('SUPABASE_CLI válida é resolvida e usada com argumentos separados',()=>{
 const fixture=supabaseCliDouble()
 const command=resolveSupabaseCli(fixture.values)
 assert.equal(command,path.resolve(fixture.values.cwd,'tools/supabase.cmd'))
 assert.equal(fixture.calls.length,1)
 assert.deepEqual(fixture.calls[0].args.slice(0,3),['/d','/s','/c'])
 assert.match(fixture.calls[0].args[3],/supabase\.cmd" "--version""$/)
 assert.equal(fixture.calls[0].options.shell,false)
})

test('parser Supabase separa versão instalada do aviso de atualização',()=>{
 const stderr='A new version of Supabase CLI is available: v2.117.0 (currently installed v2.116.0)\nWe recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli\n'
 assert.equal(parseSupabaseCliVersion({stdout:'2.116.0\n',stderr}),'2.116.0')
})

test('parser Supabase bloqueia versão divergente, aviso isolado, ambiguidade e warning desconhecido',()=>{
 const notice='A new version of Supabase CLI is available: v2.117.0 (currently installed v2.116.0)\n'
 assert.throws(()=>parseSupabaseCliVersion({stdout:'2.117.0\n'}),/exatamente 2\.116\.0/)
 assert.throws(()=>parseSupabaseCliVersion({stderr:notice}),/ausente ou ambígua/)
 assert.throws(()=>parseSupabaseCliVersion({stdout:'2.116.0\n2.117.0\n'}),/ausente ou ambígua/)
 assert.throws(()=>parseSupabaseCliVersion({stdout:'2.116.0\n',stderr:'available: v2.117.0\n'}),/output inesperado/)
})

test('parsers não registram outputs inesperados nem credenciais',()=>{
 const logs=[]
 const fixture=supabaseCliDouble({
  log:value=>logs.push(value),
  spawn:()=>({status:0,stdout:'2.116.0\n',stderr:'client_secret=must-not-log\n'}),
 })
 assert.throws(()=>resolveSupabaseCli(fixture.values),/output inesperado/)
 assert.deepEqual(logs,[])
})

test('SUPABASE_CLI ausente permite fallback supabase no PATH após validar versão',()=>{
 const fixture=supabaseCliDouble({env:{},exists:()=>false})
 assert.equal(resolveSupabaseCli(fixture.values),'supabase')
 assert.deepEqual(fixture.calls[0].args.slice(0,3),['/d','/s','/c'])
 assert.match(fixture.calls[0].args[3],/"supabase" "--version""$/)
 assert.equal(fixture.calls[0].options.shell,false)
})

test('SUPABASE_CLI ausente e supabase fora do PATH aborta sem retry',()=>{
 let calls=0
 const fixture=supabaseCliDouble({
  env:{},
  spawn:()=>{
   calls++
   return {status:null,stdout:'',stderr:'',error:Object.assign(Error('missing'),{code:'ENOENT'})}
  },
 })
 assert.throws(()=>resolveSupabaseCli(fixture.values),/Supabase CLI ausente/)
 assert.equal(calls,1)
})

test('SUPABASE_CLI inexistente aborta antes de executar qualquer comando',()=>{
 const fixture=supabaseCliDouble({exists:()=>false})
 assert.throws(()=>resolveSupabaseCli(fixture.values),/não aponta para um arquivo executável existente/)
 assert.equal(fixture.calls.length,0)
})

test('falha de --version da Supabase CLI aborta',()=>{
 const fixture=supabaseCliDouble({spawn:()=>({status:1,stdout:'',stderr:'invalid'})})
 assert.throws(()=>resolveSupabaseCli(fixture.values),/Comando obrigatório falhou/)
})

for(const value of ['supabase.cmd && whoami','supabase.cmd|whoami','supabase.cmd;whoami','supabase.cmd > output','$(whoami)','`whoami`','"supabase.cmd"',' supabase.cmd'])test(`SUPABASE_CLI rejeita shell injection: ${value}`,()=>{
 const fixture=supabaseCliDouble({env:{SUPABASE_CLI:value}})
 assert.throws(()=>resolveSupabaseCli(fixture.values),/somente um caminho/)
 assert.equal(fixture.calls.length,0)
})

test('Supabase CLI é validada antes de operação remota e não usa npx ou instalação',()=>{
 const helper=resolveSupabaseCli.toString()+executeCommand.toString()
 assert.doesNotMatch(helper,/\bnpx\b|npm\s+install|https?:\/\//)
 const fixture=supabaseCliDouble()
 resolveSupabaseCli(fixture.values)
 assert.equal(fixture.calls.every(call=>call.args.at(-1).includes('"--version"')),true)
 const initialization=deploySource.indexOf('edgeCli=resolveSupabaseCli()')
 const deploymentBaseline=deploySource.indexOf('const current=candidateOnly?{sha,id:null,bootstrap:true}:await official()')
 assert.ok(initialization>0&&deploymentBaseline>initialization)
})

test('functions list e functions deploy usam exclusivamente a mesma Supabase CLI resolvida',()=>{
 assert.match(deploySource,/function functionsList\(\)\{return JSON\.parse\(run\(edgeCli,\['functions','list'/)
 assert.match(deploySource,/run\(edgeCli,deployArgs,root,true\)/)
 assert.equal((deploySource.match(/edgeCli=resolveSupabaseCli\(\)/g)||[]).length,1)
})

test('subprocessos de teste frontend e build recebem somente os placeholders locais',()=>{
 const calls=[]
 const execute=(command,args,options)=>{calls.push({command,args,options});return ''}
 const parentEnv={PATH:'local-path'}
 runBannerFrontendCommand('node',['--test','frontend.test.mjs'],'C:\\frontend',{execute,parentEnv})
 runBannerFrontendCommand('npm.cmd',['run','build'],'C:\\frontend',{execute,parentEnv})
 assert.equal(calls.length,2)
 for(const call of calls){
  assert.equal(call.options.env.VITE_SUPABASE_URL,BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_URL)
  assert.equal(call.options.env.VITE_SUPABASE_ANON_KEY,BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_ANON_KEY)
  assert.match(call.options.env.NODE_OPTIONS,/--import=data:text\/javascript;base64,/)
 }
 assert.deepEqual(parentEnv,{PATH:'local-path'})
})

test('placeholders são fictícios, usam .invalid e não exigem credencial real',()=>{
 assert.equal(new URL(BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_URL).hostname.endsWith('.invalid'),true)
 assert.match(BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_ANON_KEY,/fictional|invalid/)
 assert.doesNotMatch(BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_URL,/supabase\.co/)
})

test('tentativa de fetch para .invalid falha o subprocesso mesmo quando capturada',()=>{
 const env=createBannerFrontendTestEnv({PATH:process.env.PATH,SystemRoot:process.env.SystemRoot})
 const result=spawnSync(process.execPath,['-e',`fetch('${BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_URL}').catch(()=>{})`],{env,encoding:'utf8'})
 assert.notEqual(result.status,0)
 assert.match(result.stderr,/BANNER_TEST_NETWORK_TO_INVALID_BLOCKED/)
})

test('ambiente fictício não é propagado para CLIs, deploy de função ou smoke remoto',()=>{
 const calls=[]
 const spawn=(command,args,options)=>{calls.push({command,args,options});return {status:0,stdout:'1.0.0\n',stderr:''}}
 executeCommand('vercel',['--version'],{spawn,platform:'linux'})
 executeCommand('supabase',['functions','list'],{spawn,platform:'linux'})
 assert.equal(calls.every(call=>call.options.env===undefined),true)
 assert.match(deploySource,/run\(edgeCli,deployArgs,root,true\)/)
 assert.match(deploySource,/await bannerUnauthenticatedSmoke\(\)/)
 const smokeSource=deploySource.slice(deploySource.indexOf('async function bannerUnauthenticatedSmoke'),deploySource.indexOf('function terminalPollingError'))
 assert.doesNotMatch(smokeSource,/BANNER_FRONTEND_TEST_ENV/)
})

test('gate não cria .env nem modifica process.env permanentemente',()=>{
 const before={url:process.env.VITE_SUPABASE_URL,key:process.env.VITE_SUPABASE_ANON_KEY,options:process.env.NODE_OPTIONS}
 const created=createBannerFrontendTestEnv(process.env)
 assert.equal(created.VITE_SUPABASE_URL,BANNER_FRONTEND_TEST_ENV.VITE_SUPABASE_URL)
 assert.deepEqual({url:process.env.VITE_SUPABASE_URL,key:process.env.VITE_SUPABASE_ANON_KEY,options:process.env.NODE_OPTIONS},before)
 assert.doesNotMatch(deploySource,/writeFileSync\([^\n]*(?:\.env|VITE_SUPABASE)/)
})

test('orquestração real do modo Banner usa isolamento na antiga linha 322 e os dois renders passam',()=>{
 const commonCalls=[],frontendCalls=[]
 const runCommon=(command,args,cwd,inherit)=>{commonCalls.push({command,args,cwd,inherit});return ''}
 const runFrontend=(command,args,cwd)=>{
  frontendCalls.push({command,args,cwd})
  if(args[0]==='--test'){
   assert.ok(args.includes('tests/banner-social-publish-render.test.mjs'))
   return runBannerFrontendCommand(command,['--test','tests/banner-social-publish-render.test.mjs'],cwd,{inherit:false})
  }
  return ''
 }
 bannerTests({
  runCommon,runFrontend,platform:'win32',
  spawn:()=>({status:1,stdout:'expected design baseline',stderr:''}),
  validateDesign:()=>true,read:()=>'',
 })
 assert.equal(commonCalls.length,2)
 assert.ok(commonCalls[0].args.includes('scripts/production/banner-recovery-release.test.mjs'))
 assert.ok(commonCalls[1].args.includes('supabase/functions/gerar-hero-ia/recover-batch.test.mjs'))
 assert.equal(frontendCalls.length,2)
 assert.equal(frontendCalls[0].args[0],'--test')
 assert.deepEqual(frontendCalls[1].args,['run','build'])
})

test('modo Banner não possui executor comum residual para subprocesso frontend',()=>{
 const source=bannerTests.toString()
 assert.doesNotMatch(source,/runCommon\(process\.execPath,\['--test',\s*'tests\//)
 assert.match(source,/runFrontend\(process\.execPath,\['--test',[\s\S]*?tests\/banner-social-publish-render\.test\.mjs/)
 assert.match(source,/spawn\(process\.execPath,[\s\S]*?env:createBannerFrontendTestEnv\(\)/)
 assert.match(source,/runFrontend\(npm,\['run','build'\],frontendRoot\)/)
 assert.doesNotMatch(source,/\bvc\(|edgeCli|functions['"],['"]deploy|https:\/\//)
})

function tempRepository(t,files){
 const directory=mkdtempSync(path.join(tmpdir(),'sca-banner-closure-'))
 for(const [relative,content] of Object.entries(files)){
  const target=path.join(directory,relative)
  mkdirSync(path.dirname(target),{recursive:true})
  writeFileSync(target,content)
 }
 t.after(()=>rmSync(directory,{recursive:true,force:true}))
 return {directory,tracked:new Set(Object.keys(files).map(value=>value.replaceAll('\\','/')))}
}

function runtimeStage(t,omit=[]){
 const directory=mkdtempSync(path.join(tmpdir(),'sca-banner-stage-'))
 for(const relative of BANNER_RUNTIME_CLOSURE){
  if(omit.includes(relative))continue
  const target=path.join(directory,relative)
  mkdirSync(path.dirname(target),{recursive:true})
  copyFileSync(path.join(root,relative),target)
 }
 const config=path.join(directory,'supabase/config.toml')
 mkdirSync(path.dirname(config),{recursive:true})
 writeFileSync(config,approvedConfigBlob)
 t.after(()=>rmSync(directory,{recursive:true,force:true}))
 return directory
}

test('closure runtime atual contém exatamente os 13 arquivos aprovados',async()=>{
  const closure=resolveBannerRuntimeClosure({repoRoot:root,trackedFiles:new Set(BANNER_RUNTIME_CLOSURE)})
  assert.equal(closure.length,13)
 assert.deepEqual(closure,BANNER_RUNTIME_CLOSURE)
 assert.equal(validateBannerRuntimeClosure(closure),true)
 assert.ok(closure.includes('core/copy-engine/index.ts'))
 assert.ok(closure.includes('server/guest-banner/promotion.mjs'))
 assert.ok(closure.includes('server/guest-banner/result.mjs'))
  assert.ok(closure.includes('supabase/functions/_shared/google-ads.ts'))
  assert.ok(closure.includes('supabase/functions/_shared/virtual-staging/presentation.ts'))
 assert.deepEqual(await validateBannerRuntimeBundle({repoRoot:root,closure}),closure)
})

test('import local inexistente é bloqueado',t=>{
 const repo=tempRepository(t,{'index.ts':"import './missing.ts'\n"})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:repo.tracked}),/import local não resolvido|inexistente/)
})

test('import dinâmico local não literal é bloqueado',t=>{
 const repo=tempRepository(t,{'index.ts':"const target='./runtime.ts'; import(target)\n",'runtime.ts':'export const ok=true\n'})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:repo.tracked}),/import dinâmico não literal/)
})

test('arquivo runtime não rastreado é bloqueado',t=>{
 const repo=tempRepository(t,{'index.ts':"import './runtime.ts'\n",'runtime.ts':'export const ok=true\n'})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:new Set(['index.ts'])}),/não rastreado/)
})

test('path traversal para fora do repositório é bloqueado',t=>{
 const repo=tempRepository(t,{'nested/index.ts':"import '../../outside.ts'\n"})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'nested/index.ts',trackedFiles:repo.tracked}),/path traversal/)
})

test('symlink que resolve fora do repositório é bloqueado',t=>{
 const repo=tempRepository(t,{'index.ts':"import './external/runtime.ts'\n"})
 const outside=mkdtempSync(path.join(tmpdir(),'sca-banner-outside-'))
 writeFileSync(path.join(outside,'runtime.ts'),'export const outside=true\n')
 symlinkSync(outside,path.join(repo.directory,'external'),'junction')
 t.after(()=>rmSync(outside,{recursive:true,force:true}))
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:new Set(['index.ts','external/runtime.ts'])}),/symlink externo|fora do repositório/)
})

for(const [label,relative] of [
 ['TikTok','supabase/functions/_shared/tiktok/runtime.ts'],
 ['Meta','supabase/functions/_shared/instagram/runtime.ts'],
 ['migration','supabase/migrations/20990101000000_bad.sql'],
 ['outra Edge Function','supabase/functions/other-function/index.ts'],
 ['frontend','frontend/src/runtime.ts'],
])test(`${label} é proibido na closure runtime`,t=>{
 const repo=tempRepository(t,{'index.ts':`import './${relative}'\n`,[relative]:'export const forbidden=true\n'})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:repo.tracked}),/proibido|outra Edge Function/)
})

test('leitura runtime de asset local não declarada é bloqueada',t=>{
 const repo=tempRepository(t,{'index.ts':"const content=Deno.readTextFile('./asset.txt')\n",'asset.txt':'x'})
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:repo.directory,entry:'index.ts',trackedFiles:repo.tracked}),/asset local não declarada/)
})

test('divergência entre closure e metafile esbuild é bloqueada',async()=>{
 const buildImpl=async()=>({metafile:{inputs:{[BANNER_RUNTIME_ENTRY]:{}}}})
 await assert.rejects(validateBannerRuntimeBundle({repoRoot:root,closure:BANNER_RUNTIME_CLOSURE,buildImpl}),/closure e metafile esbuild divergentes/)
})

test('staging incompleto reproduz a falha local antes do Supabase',async t=>{
 const stage=runtimeStage(t,['core/copy-engine/index.ts','server/guest-banner/promotion.mjs','server/guest-banner/result.mjs'])
 assert.throws(()=>resolveBannerRuntimeClosure({repoRoot:stage,trackedFiles:new Set(BANNER_RUNTIME_CLOSURE)}),/import local não resolvido|inexistente/)
 await assert.rejects(validateBannerRuntimeBundle({repoRoot:stage,closure:BANNER_RUNTIME_CLOSURE}),/bundle local gerar-hero-ia falhou/)
})

test('staging completo resolve e faz bundle local com os mesmos 13 inputs',async t=>{
 const stage=runtimeStage(t)
 const closure=resolveBannerRuntimeClosure({repoRoot:stage,trackedFiles:new Set(BANNER_RUNTIME_CLOSURE)})
 assert.deepEqual(closure,BANNER_RUNTIME_CLOSURE)
 assert.deepEqual(await validateBannerRuntimeBundle({repoRoot:stage,closure}),BANNER_RUNTIME_CLOSURE)
 assert.equal(validateBannerConfigArtifact(readFileSync(path.join(stage,'supabase/config.toml')),approvedConfigBlob,'staging Edge'),true)
})

function storedZipEntry(name,data){
 const nameBytes=Buffer.from(name),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22)
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26)
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28)
 const centralOffset=local.length+nameBytes.length+data.length
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+nameBytes.length,12);end.writeUInt32LE(centralOffset,16)
 return Buffer.concat([local,nameBytes,data,central,nameBytes,end])
}

test('worktree CRLF corresponde ao commit, mas o guard do hotfix bloqueia o config atual com TikTok',()=>{
 const worktree=readFileSync(path.join(root,'supabase/config.toml'))
 assert.ok(worktree.includes(Buffer.from('\r\n')))
 assert.equal(approvedConfigBlob.includes(Buffer.from('\r\n')),false)
 assert.deepEqual(Buffer.from(worktree.toString('utf8').replaceAll('\r\n','\n')),approvedConfigBlob)
 assert.equal(validateBannerConfigWorktree(''),true)
 assert.match(approvedConfigBlob.toString('utf8'),/\[functions\.tiktok-connection\]/)
 assert.throws(()=>validateBannerConfigBlob(approvedConfigBlob),/TikTok proibido/)
 assert.throws(()=>readBannerConfigBlob('a'.repeat(40),{spawn:()=>({status:0,stdout:approvedConfigBlob})}),/TikTok proibido/)
})

test('alteração real do config, TikTok, verify_jwt, newline e BOM são bloqueados',()=>{
 const changed=Buffer.from(approvedConfigBlob);changed[10]^=1
 assert.throws(()=>validateBannerConfigArtifact(changed,approvedConfigBlob,'staging Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigBlob(Buffer.concat([approvedConfigBlob,Buffer.from('\n[functions.tiktok-connection]\nverify_jwt = false\n')])),/TikTok proibido/)
 assert.throws(()=>validateBannerConfigBlob(Buffer.concat([approvedConfigBlob,Buffer.from('\n[functions.tiktok-callback]\nverify_jwt = false\n')])),/TikTok proibido/)
 const verifyChanged=Buffer.from(approvedConfigBlob.toString('utf8').replace('verify_jwt = false','verify_jwt = true'))
 assert.throws(()=>validateBannerConfigArtifact(verifyChanged,approvedConfigBlob,'staging Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigArtifact(approvedConfigBlob.subarray(0,-1),approvedConfigBlob,'staging Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigArtifact(Buffer.concat([approvedConfigBlob,Buffer.from('\n')]),approvedConfigBlob,'staging Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigArtifact(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),approvedConfigBlob]),approvedConfigBlob,'staging Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigWorktree('supabase/config.toml'),/worktree diverge/)
})

test('config.toml do ZIP e do staging devem ser idênticos ao blob Git',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'sca-banner-config-zip-')),zip=path.join(directory,'edge.zip')
 t.after(()=>rmSync(directory,{recursive:true,force:true}))
 writeFileSync(zip,storedZipEntry('supabase/config.toml',approvedConfigBlob))
 const zipConfig=readZipEntryBytes(zip,'supabase/config.toml')
 assert.equal(validateBannerConfigArtifact(zipConfig,approvedConfigBlob,'ZIP Edge'),true)
 assert.equal(validateBannerConfigArtifact(Buffer.from(approvedConfigBlob),approvedConfigBlob,'staging Edge'),true)
 const corrupted=Buffer.from(zipConfig);corrupted[0]^=1
 assert.throws(()=>validateBannerConfigArtifact(corrupted,approvedConfigBlob,'ZIP Edge'),/diverge byte a byte/)
 assert.throws(()=>validateBannerConfigArtifact(corrupted,zipConfig,'staging Edge'),/diverge byte a byte/)
})

test('gate prova blobs Git, archive mínimo e validação local antes do deploy remoto',()=>{
 assert.match(deploySource,/git\('ls-tree','-r','--name-only',sha\)/)
 assert.match(deploySource,/git\('diff','--name-only',sha,'--',\.\.\.bannerRuntimeClosure\)/)
 assert.match(deploySource,/edgeArchivePaths=deployBannerRecovery\?\[\.\.\.bannerRuntimeClosure,'supabase\/config\.toml'\]/)
 assert.match(deploySource,/readBannerConfigBlob\(sha\)/)
 assert.match(deploySource,/readZipEntryBytes\(edgeZip,bannerConfigPath\)/)
 const localValidation=deploySource.indexOf('await validateBannerRuntimeBundle({repoRoot:edgeStage')
 const remoteDeploy=deploySource.indexOf('run(edgeCli,deployArgs')
 assert.ok(localValidation>0&&remoteDeploy>localValidation)
 const helpers=resolveBannerRuntimeClosure.toString()+validateBannerRuntimeBundle.toString()+validateBannerRuntimeClosure.toString()
 assert.doesNotMatch(helpers,/\bvercel\b|supabase\.co|functions['"],['"]deploy|\bpromote\b/)
})

function fakePolling(states,{timeoutMs=100,intervalMs=10}={}){
 let time=0,index=0
 const waits=[]
 return {
  inspect:async()=>({id:candidateId,readyState:states[Math.min(index++,states.length-1)]}),
  timeoutMs,intervalMs,
  now:()=>time,
  sleep:async ms=>{waits.push(ms);time+=ms},
  waits,
 }
}

function resumeFixture(overrides={}){
 let deployments=0
 const values={
  explicitUrl:candidateUrl,
  createDeployment:async()=>{deployments++;return candidateUrl},
  inspectDeployment:async()=>({id:candidateId,readyState:'READY'}),
  inspectDeploymentDetail:async()=>candidateDetail(),
  readOfficial:async()=>({...baseline}),
  readBackendVersion:async()=>BANNER_RECOVERY_RELEASE.edgeVersion,
  currentHeadSha:'f'.repeat(40),current:{...baseline},
  ...overrides,
 }
 return {values,deploymentCount:()=>deployments}
}

test('polling aceita READY imediato sem espera',async()=>{
 const polling=fakePolling(['READY'])
 const info=await waitForVercelReady(polling)
 assert.equal(info.readyState,'READY')
 assert.deepEqual(polling.waits,[])
})

test('polling percorre QUEUED -> BUILDING -> COMPLETING -> READY',async()=>{
 const polling=fakePolling(['QUEUED','BUILDING','COMPLETING','READY'])
 const info=await waitForVercelReady(polling)
 assert.equal(info.readyState,'READY')
 assert.deepEqual(polling.waits,[10,10,10])
})

test('incidente real COMPLETING -> READY aguarda e só então prossegue',async()=>{
 const polling=fakePolling(['COMPLETING','READY'])
 const info=await waitForVercelReady(polling)
 assert.equal(info.readyState,'READY')
 assert.deepEqual(polling.waits,[10])
})

test('polling reconhece INITIALIZING como estado transitório',async()=>{
 const polling=fakePolling(['INITIALIZING','READY'])
 const info=await waitForVercelReady(polling)
 assert.equal(info.readyState,'READY')
 assert.deepEqual(polling.waits,[10])
})

for(const state of ['ERROR','CANCELED'])test(`polling aborta imediatamente em ${state}`,async()=>{
 const polling=fakePolling([state])
 await assert.rejects(waitForVercelReady(polling),new RegExp(state))
 assert.deepEqual(polling.waits,[])
})

test('polling aborta por timeout sem tratar estado transitório como sucesso',async()=>{
 const polling=fakePolling(['COMPLETING'],{timeoutMs:20,intervalMs:10})
 await assert.rejects(waitForVercelReady(polling),/timeout aguardando Vercel READY/)
 assert.deepEqual(polling.waits,[10,10])
})

test('polling trata estado desconhecido como falha fechada',async()=>{
 const polling=fakePolling(['MYSTERY'])
 await assert.rejects(waitForVercelReady(polling),/estado Vercel desconhecido: MYSTERY/)
 assert.deepEqual(polling.waits,[])
})

test('falha transitória de inspeção pode ser seguida por READY',async()=>{
 let calls=0,time=0
 const info=await waitForVercelReady({
  inspect:async()=>{if(calls++===0)throw Error('Completing');return {id:candidateId,readyState:'READY'}},
  timeoutMs:20,intervalMs:10,now:()=>time,sleep:async ms=>{time+=ms},
 })
 assert.equal(info.readyState,'READY')
 assert.equal(calls,2)
})

test('polling não contém promoção nem publicação de backend e precede o bloco Edge',()=>{
 const helperSource=waitForVercelReady.toString()+acquireBannerStageOneCandidate.toString()
 assert.doesNotMatch(helperSource,/\bpromote\b|functions['"],['"]deploy/)
 assert.match(deploySource,/const candidate=await acquireBannerStageOneCandidate\([\s\S]*?if\(deployVideoSocialMetadata\|\|deployAdminApi\|\|deployTikTokContentPosting\|\|deployBannerRecovery\)/)
})

test('retomada não consulta nem publica backend antes de READY',async()=>{
 let time=0,inspections=0,backendReads=0
 const fixture=resumeFixture({
  inspectDeployment:async()=>({id:candidateId,readyState:inspections++===0?'COMPLETING':'READY'}),
  readBackendVersion:async()=>{backendReads++;return BANNER_RECOVERY_RELEASE.edgeVersion},
  polling:{timeoutMs:20,intervalMs:10,now:()=>time,sleep:async ms=>{assert.equal(backendReads,0);time+=ms}},
 })
 await acquireBannerStageOneCandidate(fixture.values)
 assert.equal(backendReads,1)
})

test('retomada aceita candidato READY do SHA exato sem criar segundo deployment',async()=>{
 const fixture=resumeFixture()
 const result=await acquireBannerStageOneCandidate(fixture.values)
 assert.equal(result.url,candidateUrl)
 assert.equal(result.reused,true)
 assert.equal(fixture.deploymentCount(),0)
})

test('retomada rejeita SHA errado',async()=>{
 const fixture=resumeFixture({inspectDeploymentDetail:async()=>({id:candidateId,readyState:'READY',meta:{githubCommitSha:'0'.repeat(40)}})})
 await assert.rejects(acquireBannerStageOneCandidate(fixture.values),/SHA do candidato Banner divergente/)
})

test('retomada do candidato conhecido rejeita deployment ID diferente',async()=>{
 const fixture=resumeFixture({
  inspectDeployment:async()=>({id:'dpl_other',readyState:'READY'}),
  inspectDeploymentDetail:async()=>({id:'dpl_other',readyState:'READY',meta:{githubCommitSha:candidateSha}}),
 })
 await assert.rejects(acquireBannerStageOneCandidate(fixture.values),/deployment ID do candidato Banner divergente/)
})

test('retomada rejeita candidato que não chega a READY',async()=>{
 let time=0
 const fixture=resumeFixture({
  inspectDeployment:async()=>({id:candidateId,readyState:'COMPLETING'}),
  polling:{timeoutMs:20,intervalMs:10,now:()=>time,sleep:async ms=>{time+=ms}},
 })
 await assert.rejects(acquireBannerStageOneCandidate(fixture.values),/timeout aguardando Vercel READY/)
})

test('retomada rejeita alias oficial divergente',async()=>{
 const fixture=resumeFixture({readOfficial:async()=>({...baseline,id:'dpl_changed'})})
 await assert.rejects(acquireBannerStageOneCandidate(fixture.values),/Production mudou/)
})

test('retomada rejeita backend diferente da v74',async()=>{
 const fixture=resumeFixture({readBackendVersion:async()=>BANNER_RECOVERY_RELEASE.edgeVersion+1})
 await assert.rejects(acquireBannerStageOneCandidate(fixture.values),/não permanece na versão de baseline/)
})

test('retomada rejeita candidato já promovido',()=>{
 assert.throws(()=>validateBannerStageOneCandidate({
  url:candidateUrl,
  info:{id:baseline.id,readyState:'READY'},
 detail:candidateDetail({id:baseline.id}),
  expectedCandidateSha:candidateSha,current:{...baseline},fresh:{...baseline},backendVersion:BANNER_RECOVERY_RELEASE.edgeVersion,
 }),/já está no alias oficial/)
})

const protectionResponse=(status,{location='https://vercel.com/sso-api?url=protected&nonce=test',server='Vercel'}={})=>({status,headers:new Headers({location,server})})
const protectedMetadata=overrides=>({
 url:candidateUrl,
 info:{id:candidateId,readyState:'READY'},
 detail:candidateDetail(),
 current:{...baseline},fresh:{...baseline},backendVersion:BANNER_PROMOTION_BACKEND_VERSION,
 ...overrides,
})

test('302 exato da proteção Vercel e metadados autenticados aprovados aceitam o candidato',async()=>{
 assert.equal(validateProtectedBannerCandidateMetadata(protectedMetadata()),true)
 let requested
 assert.equal(await protectedCandidateSmoke(candidateUrl,{fetchImpl:async(url,options)=>{requested={url,options};return protectionResponse(302)}}),true)
 assert.equal(requested.url,candidateUrl+'/')
 assert.equal(requested.options.redirect,'manual')
})

for(const status of [301,307,200,401,403,404,500,503])test(`proteção Vercel bloqueia status ${status}`,()=>{
 assert.throws(()=>validateVercelProtectionResponse(protectionResponse(status)),/302 Vercel esperado/)
})

test('proteção Vercel bloqueia domínio, path e assinatura Server divergentes',()=>{
 assert.throws(()=>validateVercelProtectionResponse(protectionResponse(302,{location:'https://example.com/sso-api'})),/redirect inesperado/)
 assert.throws(()=>validateVercelProtectionResponse(protectionResponse(302,{location:'https://vercel.com/login'})),/redirect inesperado/)
 assert.throws(()=>validateVercelProtectionResponse(protectionResponse(302,{server:'example'})),/assinatura Server/)
})

test('metadados protegidos bloqueiam READY, SHA, ID, projeto/team e alias divergentes',()=>{
 assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({info:{id:candidateId,readyState:'BUILDING'}})),/não está READY/)
 assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({detail:candidateDetail({meta:{githubCommitSha:'0'.repeat(40)}})})),/SHA do candidato/)
 assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({info:{id:'dpl_other',readyState:'READY'}})),/deployment ID/)
 assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({detail:candidateDetail({projectId:'prj_other'})})),/projeto\/team/)
 assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({fresh:{...baseline,id:'dpl_changed'}})),/Production mudou/)
})

test('promoção exige backend exatamente v75 ACTIVE com verify_jwt=false',()=>{
 const active={slug:'gerar-hero-ia',version:75,status:'ACTIVE',verify_jwt:false}
 assert.equal(bannerFunctionVersion([active],BANNER_PROMOTION_BACKEND_VERSION),75)
 assert.equal(validateProtectedBannerCandidateMetadata(protectedMetadata({backendVersion:75})),true)
 for(const version of [74,76,100])assert.throws(()=>validateProtectedBannerCandidateMetadata(protectedMetadata({backendVersion:version})),/exatamente na versão 75/)
 assert.throws(()=>bannerFunctionVersion([{...active,status:'INACTIVE'}],75))
 assert.throws(()=>bannerFunctionVersion([{...active,verify_jwt:true}],75))
})

const publicFetch=({pageStatus=200,pageBody='<html><title>SmartCorretorAI</title></html>',pageType='text/html; charset=utf-8',releaseStatus=200,releaseSha=candidateSha}={})=>async url=>url.endsWith('/production-release.json')?{status:releaseStatus,json:async()=>({sha:releaseSha})}:{status:pageStatus,headers:new Headers({'content-type':pageType}),text:async()=>pageBody}

test('smoke público pós-promoção exige release e páginas SmartCorretorAI com 200',async()=>{
 assert.equal(await publicBannerSmoke({expectedSha:candidateSha,fetchImpl:publicFetch()}),true)
 await assert.rejects(publicBannerSmoke({expectedSha:candidateSha,fetchImpl:publicFetch({pageStatus:302})}),/Smoke pós-deploy falhou/)
 await assert.rejects(publicBannerSmoke({expectedSha:candidateSha,fetchImpl:publicFetch({pageBody:'<html><title>Login – Vercel</title></html>'})}),/Smoke pós-deploy falhou/)
})

test('modo Banner é exclusivo e seleciona somente gerar-hero-ia',()=>{
 assert.equal(deploymentMode(['--banner-recovery-hotfix']),'--banner-recovery-hotfix')
 assert.deepEqual(edgeScope(['--banner-recovery-hotfix']),['gerar-hero-ia'])
 assert.throws(()=>edgeScope(['--banner-recovery-hotfix','--admin-api']))
 assert.throws(()=>edgeScope(['--banner-recovery-hotfix','--video-social-metadata']))
 assert.throws(()=>edgeScope(['--banner-recovery-hotfix','--banner-recovery-promote']))
 assert.throws(()=>edgeScope(['--banner-recovery-hotfix','--anything']))
})

test('promoção Banner é uma ação explícita separada sem escopo Edge',()=>{
 assert.equal(deploymentMode(['--banner-recovery-promote']),'--banner-recovery-promote')
 assert.deepEqual(edgeScope(['--banner-recovery-promote']),[])
 assert.match(deploySource,/BANNER_RECOVERY_CANDIDATE_URL/)
 assert.match(deploySource,/promotion:'PENDING_EXPLICIT_APPROVAL'/)
 assert.match(deploySource,/validateBannerPromotionCandidate/)
 assert.match(deploySource,/if\(deployBannerRecovery\)[\s\S]*?return\s*[\s\S]*?vc\(\['promote'[\s\S]*?finally \{\s*cleanupReleaseStage\(stage\)/)
 const promotionSource=deploySource.slice(deploySource.indexOf('async function promoteBanner'),deploySource.indexOf('export async function main'))
 assert.doesNotMatch(promotionSource,/functions','deploy|migration|secrets?\s+set|bannerTests\(|npm.*build|runFrontend|git\([^\n]*archive/)
 assert.match(promotionSource,/bannerVersion\(BANNER_PROMOTION_BACKEND_VERSION\)/)
 assert.ok(promotionSource.indexOf('protectedCandidateSmoke')<promotionSource.indexOf("vc(['promote'"))
 assert.ok(promotionSource.indexOf("vc(['promote'")<promotionSource.indexOf('publicBannerSmoke'))
})

test('metadados Vercel simulados só aceitam o candidato exato e backend já publicado',()=>{
 const sha='4'.repeat(40)
 const url='https://smartcorretorai-abc123-smart-corretor-ai-s-projects.vercel.app'
 const current={sha:BANNER_RECOVERY_RELEASE.baseSha,id:BANNER_RECOVERY_RELEASE.frontendDeploymentId}
 const valid={url,info:{id:'dpl_candidate',readyState:'READY'},detail:{readyState:'READY',meta:{githubCommitSha:sha}},sha,current,fresh:{...current},backendVersion:75}
 assert.equal(validateBannerPromotionCandidate(valid),true)
 assert.throws(()=>validateBannerPromotionCandidate({...valid,url:'https://example.invalid'}))
 assert.throws(()=>validateBannerPromotionCandidate({...valid,detail:{...valid.detail,meta:{githubCommitSha:'5'.repeat(40)}}}))
 assert.throws(()=>validateBannerPromotionCandidate({...valid,fresh:{...current,id:'dpl_changed'}}))
 assert.throws(()=>validateBannerPromotionCandidate({...valid,backendVersion:74}))
})

test('allowlist exata separa arquivos funcionais e arquivos do gate',()=>{
 const result=validateBannerRecoveryManifest(allowed)
 assert.deepEqual(result.functional,BANNER_RECOVERY_RELEASE.functionalPaths)
 assert.deepEqual(result.gate,BANNER_RECOVERY_RELEASE.gatePaths)
 assert.throws(()=>validateBannerRecoveryManifest(allowed.slice(1)),/manifesto incompleto/)
})

for(const [label,file] of [
 ['migration','supabase/migrations/20990101000000_bad.sql'],
 ['App.jsx','frontend/src/App.jsx'],
 ['config.toml','supabase/config.toml'],
 ['TikTok','supabase/functions/tiktok-callback/index.ts'],
 ['Meta','frontend/src/lib/meta-oauth-connection.js'],
 ['social publish','supabase/functions/social-publish-banner/index.ts'],
 ['worker','supabase/functions/social-worker/index.ts'],
 ['job','server/jobs/banner.mjs'],
 ['cron','scripts/cron/banner.mjs'],
 ['outro produto','frontend/src/pages/StudioHero.jsx'],
])test(`${label} fora da allowlist é bloqueado`,()=>assert.throws(()=>validateBannerRecoveryManifest([...allowed,file])))

test('worktree sujo e ancestry incorreta são bloqueados',()=>{
 assert.equal(validateBannerWorktreeStatus(''),true)
 assert.throws(()=>validateBannerWorktreeStatus(' M frontend/src/App.jsx'))
 assert.equal(validateBannerAncestry({baseIsAncestor:true,functionalIsAncestor:true}),true)
 assert.throws(()=>validateBannerAncestry({baseIsAncestor:false,functionalIsAncestor:true}))
 assert.throws(()=>validateBannerAncestry({baseIsAncestor:true,functionalIsAncestor:false}))
})

test('verify_jwt=false e baseline remoto da gerar-hero-ia são obrigatórios',()=>{
 assert.equal(validateBannerVerifyJwt('[functions.gerar-hero-ia]\nverify_jwt = false\n'),false)
 assert.throws(()=>validateBannerVerifyJwt('[functions.gerar-hero-ia]\nverify_jwt = true\n'))
 const active={slug:'gerar-hero-ia',version:74,status:'ACTIVE',verify_jwt:false}
 assert.equal(bannerFunctionVersion([active],74),74)
 assert.throws(()=>bannerFunctionVersion([{...active,verify_jwt:true}],74))
 assert.throws(()=>bannerFunctionVersion([{...active,version:75}],74))
})

test('somente o baseline de falha aprovado ou uma suíte Banner totalmente aprovada pode ser aceita',()=>{
 const baseline={status:1,output:'# tests 6\n# pass 5\n# fail 1\npreserves Banner actions while migrating controls to ProductButton',testSource:'assert.match(x, /disabled=\\{!canGenerate\\}/)',bannerSource:'disabled={!canGenerate || (guestMode && guestConsumed)}'}
 assert.equal(validateKnownBannerDesignFailure(baseline),true)
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,output:baseline.output.replace('# fail 1','# fail 2')}))
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,output:baseline.output.replace('preserves Banner actions while migrating controls to ProductButton','outra falha')}))
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,bannerSource:'disabled={!canGenerate}'}))
 assert.equal(validateKnownBannerDesignFailure({status:0,output:'# tests 6\n# pass 6\n# fail 0'}),true)
 assert.throws(()=>validateKnownBannerDesignFailure({status:0,output:'# tests 6\n# pass 5\n# fail 1'}))
})

test('guard estrito aceita o TAP aprovado do banner-design-system',()=>{
 const frontend=path.join(root,'frontend'),testFile=path.join(frontend,'tests/banner-design-system.test.mjs')
 assert.equal(validateKnownBannerDesignFailure({
  status:0,
  output:'# tests 6\n# suites 0\n# pass 6\n# fail 0\n',
  testSource:readFileSync(testFile,'utf8'),
  bannerSource:readFileSync(path.join(frontend,'src/pages/HeroNext.jsx'),'utf8'),
 }),true)
})

test('modo Banner não contém comandos de migration, db push, secrets ou smoke pago',()=>{
 assert.doesNotMatch(deploySource,/\bdb\s+push\b|migration\s+(?:up|apply)|secrets?\s+set/i)
 assert.doesNotMatch(deploySource,/SMART_TOKEN_COSTS|75\s*ST|handleGenerate\(/)
 assert.match(deploySource,/functions','deploy',\.\.\.selectedFunctions/)
 assert.match(deploySource,/--no-verify-jwt/)
 assert.match(deploySource,/previousBannerVersion/)
 assert.match(deploySource,/frontendDeploymentId/)
})

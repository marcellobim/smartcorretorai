import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {hash,verifyProof,ancestryError} from './proof.mjs'
import {smoke} from './smoke.mjs'
const root=fileURLToPath(new URL('../../',import.meta.url)),scope='smart-corretor-ai-s-projects'
const cli=process.env.VERCEL_CLI || 'vercel'
function run(command,args,cwd=root,inherit=false){
 const r=spawnSync(command,args,{cwd,encoding:inherit?undefined:'utf8',stdio:inherit?'inherit':['ignore','pipe','inherit'],shell:process.platform==='win32'&&command.endsWith('.cmd')})
 if(r.status!==0)throw Error('Comando obrigatório falhou: '+command+' '+args[0])
 return inherit?'':r.stdout.trim()
}
const git=(...args)=>run('git',args)
const vc=(args,cwd=root)=>run(cli,[...args,'--scope',scope],cwd)
async function official(){
 const info=JSON.parse(vc(['inspect','www.smartcorretorai.com','--json']))
 const detail=JSON.parse(vc(['api','/v13/deployments/'+info.id,'--raw']))
 if(detail.readyState!=='READY'||!detail.meta?.githubCommitSha)throw Error('DEPLOY BLOQUEADO: SHA oficial indisponível')
 return {sha:detail.meta.githubCommitSha,id:info.id}
}
const current=await official(),sha=git('rev-parse','HEAD')
if(spawnSync('git',['merge-base','--is-ancestor',current.sha,sha],{cwd:root}).status!==0)throw Error(ancestryError)
if(git('diff','HEAD','--name-only'))throw Error('DEPLOY BLOQUEADO: crie checkpoint antes de publicar')
smoke(root)
run(process.execPath,['--test','--test-isolation=none','frontend/tests/home-groups.test.mjs','frontend/tests/account-analytics.test.mjs','frontend/tests/banner-conversational-guest.test.mjs'],root,true)
const stage=path.join(root,'experiments','production-releases',sha+'-'+Date.now());mkdirSync(stage,{recursive:true})
const zip=stage+'.zip'
git('archive','--format=zip','--output='+zip,sha,'frontend','core','api','server','scripts/production','supabase/functions/_shared','vercel.json','.vercelignore','package.json','package-lock.json')
// One shell for this reversible extraction; no filesystem deletion or path from remote input.
if(process.platform==='win32')run('powershell',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${stage.replaceAll("'","''")}' -Force`])
else run('unzip',['-o',zip,'-d',stage])
const revisions=[...git('rev-list',sha,'^'+current.sha).split('\n').filter(Boolean),current.sha]
const proof={sha,baseline:current.sha,bootstrap:current.sha==='75a6a0611c8cc7bbfa038817f129c3ad60477bb9',commits:revisions.map(id=>({sha:id,body:spawnSync('git',['cat-file','commit',id],{cwd:root}).stdout.toString('base64')})),files:{}}
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else {const relative=path.relative(stage,p).replaceAll('\\','/');if(e.name!=='vercel.json'&&e.name!=='.vercelignore'&&!e.name.startsWith('.env')&&!relative.startsWith('supabase/')&&!relative.endsWith('.log')&&!relative.includes('/node_modules/'))proof.files[relative]=hash(readFileSync(p))}}}
walk(stage);verifyProof(proof,current.sha,stage);writeFileSync(path.join(stage,'.production-proof.json'),JSON.stringify(proof))
mkdirSync(path.join(stage,'.vercel'),{recursive:true});copyFileSync(path.join(root,'.vercel/project.json'),path.join(stage,'.vercel/project.json'))
console.log('Guard PASS; candidato '+sha+' contém Production '+current.sha)
// Production build checks proof + live baseline again. Official domain stays untouched until promotion.
const output=vc(['deploy','--prod','--skip-domain','--yes','--meta','githubCommitSha='+sha],stage)
const match=output.match(/https:\/\/smartcorretorai-[a-z0-9]+-smart-corretor-ai-s-projects\.vercel\.app/g)
if(!match)throw Error('Deployment não identificado; domínio oficial não alterado')
const url=match.at(-1),info=JSON.parse(vc(['inspect',url,'--json']))
if(info.readyState!=='READY')throw Error('Deployment não está READY')
const fresh=await official()
if(fresh.id!==current.id)throw Error('DEPLOY BLOQUEADO: Production mudou durante o build; execute novamente')
vc(['promote',url,'--yes'])
const release=await fetch('https://www.smartcorretorai.com/production-release.json',{cache:'no-store'}).then(r=>r.json())
if(release.sha!==sha)throw Error('Smoke pós-deploy: SHA oficial divergente')
for(const route of ['/','/criar-anuncio','/dashboard','/admin']){const r=await fetch('https://www.smartcorretorai.com'+route);if(!r.ok)throw Error('Smoke pós-deploy falhou: '+route)}
console.log(JSON.stringify({sha,deploymentId:info.id,ready:info.readyState,alias:'www.smartcorretorai.com',postSmoke:'PASS'}))

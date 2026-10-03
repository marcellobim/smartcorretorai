import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync} from 'node:fs'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {deploymentTarget,deploymentOptions,dryRunPlan,assertTargetIdentity} from './targets.mjs'
import {resolveVercelCli,resolveSupabaseCli,releaseStagePath,assertReleaseStagePath,createReleaseStage,cleanupReleaseStage} from './deploy.mjs'

test('release stage paths are portable and never end with an invalid separator',()=>{
 const sha='a'.repeat(40),name=`${sha}-123`
 assert.equal(releaseStagePath({repoRoot:'C:\\repo',sha,now:123,pathApi:path.win32}),`C:\\repo\\experiments\\production-releases\\${name}`)
 assert.equal(releaseStagePath({repoRoot:'/repo',sha,now:123,pathApi:path.posix}),`/repo/experiments/production-releases/${name}`)
 assert.equal(name.endsWith('\\,'),false)
 assert.equal(name.endsWith('/,'),false)
})

test('release stage cleanup removes only its current untracked stage and zip',t=>{
 const repoRoot=mkdtempSync(path.join(tmpdir(),'sca-release-stage-')),sha='b'.repeat(40)
 const stage=createReleaseStage({repoRoot,sha,now:456})
 t.after(()=>cleanupReleaseStage(stage,{repoRoot,isTracked:()=>false}))
 assert.equal(existsSync(stage),true)
 cleanupReleaseStage(stage,{repoRoot,isTracked:()=>false})
 assert.equal(existsSync(stage),false)
})

test('release stage guard rejects roots, paths outside releases and tracked paths',()=>{
 const repoRoot=path.join(tmpdir(),'sca-release-guard'),sha='c'.repeat(40)
 assert.throws(()=>assertReleaseStagePath(path.join(repoRoot,'experiments','production-releases'),{repoRoot}),/fora do stage/)
 assert.throws(()=>assertReleaseStagePath(path.join(repoRoot,'frontend',`${sha}-1`),{repoRoot}),/fora do stage/)
 const stage=releaseStagePath({repoRoot,sha,now:1})
 assert.throws(()=>cleanupReleaseStage(stage,{repoRoot,isTracked:()=>true}),/caminho rastreado/)
})

test('target is mandatory and rejects unknown values',()=>{
 assert.throws(()=>deploymentTarget([]),/--target válido/)
 assert.throws(()=>deploymentTarget(['--target','other']),/target desconhecido/)
})
test('candidate-only is explicit and dry-run skips promotion',()=>{
 const options=deploymentOptions(['--target','snetia','--candidate-only','--dry-run'])
 assert.deepEqual(options,{candidateOnly:true,dryRun:true})
 const plan=dryRunPlan(deploymentTarget(['--target','snetia']),'b'.repeat(40),options)
 assert.equal(plan.promotion,'skipped by --candidate-only')
 assert.equal(plan.productionAliasInspect,'skipped by --candidate-only')
 assert.equal(plan.rollbackBaseline,'skipped by --candidate-only')
 assert.throws(()=>deploymentOptions(['--candidate-only','--candidate-only']),/mais de uma vez/)
})
test('candidate-only bootstrap skips alias proof while normal deploy retains it',()=>{
 const source=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
 assert.match(source,/const current=candidateOnly\?\{sha,id:null,bootstrap:true\}:await official\(\)/)
 assert.match(source,/if\(!candidateOnly&&!isAncestor\(current\.sha,sha\)\)/)
 assert.match(source,/if\(!candidateOnly\)\{\s*fresh=await official\(\)/)
})
test('candidate-only returns before the generic promotion call',()=>{
 const source=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
 const candidate=source.indexOf('if(candidateOnly){',source.indexOf('if(deployBannerRecovery){'))
 const promotion=source.indexOf("vc(['promote',url,'--yes'])",candidate)
 assert.ok(candidate>=0)
 assert.ok(promotion>candidate)
 assert.ok(source.slice(candidate,promotion).includes('return'))
})
test('staged Vercel execution passes an explicit portable --cwd and cleanup covers candidate completion',()=>{
 const source=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
 assert.match(source,/\[\.\.\.args,'--cwd',path\.resolve\(cwd\),'--scope',target\.teamId\]/)
 assert.match(source,/const stage=createReleaseStage\(\{sha\}\)\s*try \{/)
 assert.match(source,/if\(candidateOnly\)\{[\s\S]*?return\s*\}[\s\S]*?finally \{\s*cleanupReleaseStage\(stage\)/)
 assert.ok(source.indexOf('if(dryRun){')<source.indexOf('const stage=createReleaseStage({sha})'))
})
test('Vercel CLI resolver deterministically prefers the pinned project binary',()=>{
 const logs=[]
 const command=resolveVercelCli({
  cwd:'C:\\repo',platform:'win32',env:{},
  exists:value=>value.endsWith('node_modules\\.bin\\vercel.cmd'),
  stat:()=>({isFile:()=>true}),
  spawn:(file,args)=>({status:0,stdout:'Vercel CLI 59.13.1\n',stderr:''}),
  log:value=>logs.push(value),
 })
 assert.match(command,/node_modules\\.bin\\vercel\.cmd$/)
 assert.match(logs[0],/project-local/)
})
test('Supabase CLI resolver deterministically prefers the pinned project binary',()=>{
 const logs=[]
 const command=resolveSupabaseCli({
  cwd:'C:\\repo',platform:'win32',env:{},
  exists:value=>value.endsWith('node_modules\\.bin\\supabase.cmd'),
  stat:()=>({isFile:()=>true}),
  spawn:()=>({status:0,stdout:'2.116.0\n',stderr:''}),
  log:value=>logs.push(value),
 })
 assert.match(command,/node_modules\\.bin\\supabase\.cmd$/)
 assert.match(logs[0],/project-local/)
})
test('dry-run plans are isolated by target',()=>{
 const sha='a'.repeat(40),snetia=dryRunPlan(deploymentTarget(['--target','snetia']),sha),legacy=dryRunPlan(deploymentTarget(['--target','smartcorretorai']),sha)
 assert.equal(snetia.projectId,'prj_NdHb7sL026aEo0Qn9cvkM9MNLOlA')
 assert.equal(snetia.alias,'snetia.com')
 assert.equal(snetia.buildCommand,'npm --prefix frontend run build')
 assert.equal(snetia.outputDirectory,'frontend/dist')
 assert.deepEqual(snetia.smokeRoutes,['/','/login','/cadastro','/auth/callback','/redefinir-senha','/planos'])
 assert.equal(legacy.projectId,'prj_U3MEwzheOk76LJzPIdx3OyLQbs5g')
 assert.equal(legacy.alias,'www.smartcorretorai.com')
 assert.equal(legacy.buildCommand,'node scripts/production/build.mjs')
 assert.throws(()=>assertTargetIdentity(deploymentTarget(['--target','snetia']),{projectId:legacy.projectId,ownerId:legacy.teamId,name:legacy.target}),/identidade Vercel/)
})

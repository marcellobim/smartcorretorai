import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {deploymentTarget,deploymentOptions,dryRunPlan,assertTargetIdentity} from './targets.mjs'
import {resolveVercelCli,resolveSupabaseCli} from './deploy.mjs'

test('target is mandatory and rejects unknown values',()=>{
 assert.throws(()=>deploymentTarget([]),/--target válido/)
 assert.throws(()=>deploymentTarget(['--target','other']),/target desconhecido/)
})
test('candidate-only is explicit and dry-run skips promotion',()=>{
 const options=deploymentOptions(['--target','snetia','--candidate-only','--dry-run'])
 assert.deepEqual(options,{candidateOnly:true,dryRun:true})
 const plan=dryRunPlan(deploymentTarget(['--target','snetia']),'b'.repeat(40),options)
 assert.equal(plan.promotion,'skipped by --candidate-only')
 assert.throws(()=>deploymentOptions(['--candidate-only','--candidate-only']),/mais de uma vez/)
})
test('candidate-only returns before the generic promotion call',()=>{
 const source=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
 const candidate=source.indexOf('if(candidateOnly){',source.indexOf('if(deployBannerRecovery){'))
 const promotion=source.indexOf("vc(['promote',url,'--yes'])",candidate)
 assert.ok(candidate>=0)
 assert.ok(promotion>candidate)
 assert.ok(source.slice(candidate,promotion).includes('return'))
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

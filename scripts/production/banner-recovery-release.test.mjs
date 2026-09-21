import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
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
 acquireBannerStageOneCandidate,
 validateBannerStageOneCandidate,
 waitForVercelReady,
} from './deploy.mjs'

const allowed=[...BANNER_RECOVERY_RELEASE.functionalPaths,...BANNER_RECOVERY_RELEASE.gatePaths]
const deploySource=readFileSync(new URL('./deploy.mjs',import.meta.url),'utf8')
const root=fileURLToPath(new URL('../../',import.meta.url))
const candidateUrl='https://smartcorretorai-fremde96m-smart-corretor-ai-s-projects.vercel.app'
const candidateId='dpl_An5uMoKDMQPhU1PjAr1NWSfDVBH7'
const candidateSha='4865f9b57859495c01fa53925b3ab35ee70933c2'
const baseline={sha:BANNER_RECOVERY_RELEASE.baseSha,id:BANNER_RECOVERY_RELEASE.frontendDeploymentId}

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
  inspectDeploymentDetail:async()=>({id:candidateId,readyState:'READY',meta:{githubCommitSha:candidateSha}}),
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
 assert.match(deploySource,/const candidate=await acquireBannerStageOneCandidate\([\s\S]*?if\(deployVideoSocialMetadata\|\|deployAdminApi\|\|deployBannerRecovery\)/)
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
 detail:{id:baseline.id,readyState:'READY',meta:{githubCommitSha:candidateSha}},
  expectedCandidateSha:candidateSha,current:{...baseline},fresh:{...baseline},backendVersion:BANNER_RECOVERY_RELEASE.edgeVersion,
 }),/já está no alias oficial/)
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
 assert.match(deploySource,/if\(deployBannerRecovery\)[\s\S]*?process\.exit\(0\)[\s\S]*?vc\(\['promote'/)
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

test('somente a falha banner-design-system comprovada pode ser aceita',()=>{
 const baseline={status:1,output:'# tests 6\n# pass 5\n# fail 1\npreserves Banner actions while migrating controls to ProductButton',testSource:'assert.match(x, /disabled=\\{!canGenerate\\}/)',bannerSource:'disabled={!canGenerate || (guestMode && guestConsumed)}'}
 assert.equal(validateKnownBannerDesignFailure(baseline),true)
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,output:baseline.output.replace('# fail 1','# fail 2')}))
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,output:baseline.output.replace('preserves Banner actions while migrating controls to ProductButton','outra falha')}))
 assert.throws(()=>validateKnownBannerDesignFailure({...baseline,bannerSource:'disabled={!canGenerate}'}))
})

test('saída real do banner-design-system corresponde exatamente à única falha aceita',()=>{
 const frontend=path.join(root,'frontend')
 const testFile=path.join(frontend,'tests/banner-design-system.test.mjs')
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap',testFile],{cwd:frontend,encoding:'utf8'})
 assert.equal(validateKnownBannerDesignFailure({
  status:result.status,
  output:(result.stdout||'')+(result.stderr||''),
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

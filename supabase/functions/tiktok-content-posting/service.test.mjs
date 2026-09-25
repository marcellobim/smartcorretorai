import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createPostingService} from './service.mjs'
import {createPostingHandler} from './handler.mjs'
import {probeMp4} from '../_shared/tiktok-posting/mp4-probe.ts'
import {callTikTokPosting,parseTikTokPreparation,postingConfirmation} from '../../../frontend/src/lib/tiktok-content-posting.js'
const user='11111111-1111-4111-8111-111111111111',creation='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',key='44444444-4444-4444-8444-444444444444'
const identity={userId:user,environment:'sandbox',appId:'a'.repeat(64)}
const bytes=readFileSync(new URL('../../../frontend/public/demos-videos/video-campanha.mp4',import.meta.url))
const creator={creator_avatar_url:'https://example.test/avatar.png',creator_username:'fixture',creator_nickname:'Fixture',privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60}
const options={title:'Fixture',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false,is_aigc:true}
const consent={confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}
function setup(){
 let time=Date.now(),job=null,seq=[],override={},creatorError=null
 const clone=x=>structuredClone(x)
 const connection={id:cid,user_id:user,environment:'sandbox',app_id:identity.appId,open_id:'fictional',scopes:['user.info.basic','video.publish'],connection_status:'active',token_version:2,access_token_expires_at:new Date(time+3600000).toISOString(),refresh_token_expires_at:new Date(time+86400000).toISOString()}
 const deps={now:()=>time,creation:async()=>({id:creation,user_id:user,status:'completed',mode:'smart_tour_gemini_omni',output_video_path:user+'/'+creation+'/smart-tour.mp4',...override}),
  connection:async()=>connection,preview:async()=>`https://signed.example.test/video/${creation}`,bytes:async()=>bytes,probe:probeMp4,access:async()=>{seq.push('decrypt');return 'fictional-access'},
  seal:async b=>JSON.stringify(b),unseal:async s=>JSON.parse(s),
  latest:async()=>clone(job),byKey:async(_,k)=>job?.idempotency_key===k?clone(job):null,job:async()=>clone(job),
  client:{creatorInfo:async()=>{seq.push('creator');return creatorError||{ok:true,data:creator}},status:async()=>{seq.push('status');return {ok:true,data:{status:'published',provider_status:'PUBLISH_COMPLETE'}}}},
  repository:{
   create:async j=>{seq.push('create');if(!job||job.idempotency_key!==j.idempotency_key)job={...j,id:key,status:'awaiting_confirmation',revision:1,init_attempts:0,upload_attempts:0};return clone(job)},
   claim:async(id,rev)=>{if(rev!==job.revision||Date.parse(job.claim_expires_at)>time)throw Error('CAS');job={...job,revision:rev+1,claim_token:key,claim_expires_at:new Date(time+120000).toISOString(),status:['initializing','uploading'].includes(job.status)?'reconciliation_required':job.status};return clone(job)},
   transition:async(j,next,details={})=>{if(j.revision!==job.revision)throw Error('CAS');seq.push(next);job={...job,status:next,revision:job.revision+1,init_attempts:job.init_attempts+(next==='initializing'?1:0),upload_attempts:job.upload_attempts+(next==='uploading'?1:0),publish_id:details.publishId||job.publish_id,provider_status:details.providerStatus||job.provider_status};return clone(job)},
   closeIrrecoverable:async(j)=>{assert.equal(j.status,'reconciliation_required');assert.equal(j.publish_id,null);assert.equal(j.upload_attempts,0);job={...job,status:'failed',closure_reason:'init_no_publish_id_irrecoverable',completed_at:new Date(time).toISOString()};return clone(job)}
  },
  uploadFetch:async(url,init)=>{
   seq.push(init.method);if(init.method==='POST')return new Response(JSON.stringify({error:{code:'ok'},data:{publish_id:'fixture-publish',upload_url:'https://open-upload.tiktokapis.com/video/?upload_id=fixture&upload_token=fixture'}}),{status:200})
   assert.equal(job.publish_id,'fixture-publish');assert.equal(job.status,'uploading');assert.equal(init.body.byteLength,bytes.length);return new Response('',{status:201})
  }}
 const service=createPostingService(deps)
 return {deps,service,seq,connection,options,consent,override,advance:()=>{time+=121000},job:()=>job,setJob:v=>{job=v},setCreatorError:v=>{creatorError=v}}
}
async function ready(s){const p=await s.service.prepare(identity,{creation_id:creation});return {creation_id:creation,idempotency_key:key,preparation:p.preparation,options:{...options},consent:{...consent}}}
test('prepare response crosses wrapper and strict frontend parser into TikTok configuration',async()=>{
 const s=setup(),response=await s.service.prepare(identity,{creation_id:creation})
 const client={auth:{getSession:async()=>({data:{session:{access_token:'synthetic',user:{id:user}}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}},functions:{invoke:async()=>({data:response,error:null})}}
 const parsed=parseTikTokPreparation(await callTikTokPosting(client,{action:'prepare',creation_id:creation},user),creation)
 assert.equal(parsed.account.display_name,'Fixture');assert.equal(parsed.creator.creator_username,'fixture');assert.equal(parsed.preview_url,'https://signed.example.test/video/'+creation);assert.equal(s.job(),null);assert.deepEqual(s.seq,['decrypt','creator']);assert.ok(!JSON.stringify(parsed).includes('fictional-access'));assert.ok(!JSON.stringify(parsed).includes('upload_token'))
})
test('incomplete prepare response remains rejected by strict frontend parser',()=>assert.throws(()=>parseTikTokPreparation({product_type:'video_imobiliario',creation_id:creation,is_aigc:true,privacy_level:null},creation)))
test('confirm browser projection is exact and the server derives AIGC',async()=>{
 const request=postingConfirmation(creation,key,'fixture-preparation',{...options,is_aigc:false},{...consent})
 assert.deepEqual(Object.keys(request).sort(),['action','consent','creation_id','idempotency_key','options','preparation'].sort())
 assert.ok(!Object.hasOwn(request,'product_type'));assert.ok(!Object.hasOwn(request.options,'is_aigc'))
 const s=setup(),prepared=await s.service.prepare(identity,{creation_id:creation})
 const confirmed=await s.service.confirm(identity,{...request,preparation:prepared.preparation})
 assert.equal(confirmed.job.status,'processing');assert.equal(s.job().confirmed_options.is_aigc,true)
})
for(const patch of [{user_id:cid},{status:'processing'},{mode:'free_ai'},{output_video_path:'arbitrary'}])test('ownership/product/path fail closed '+JSON.stringify(patch),async()=>{const s=setup();Object.assign(s.override,patch);await assert.rejects(s.service.prepare(identity,{creation_id:creation}));assert.deepEqual(s.seq,[])})
for(const patch of [{scopes:['user.info.basic']},{access_token_expires_at:new Date(0).toISOString()},{access_token_expires_at:null},{environment:'production'}])test('capability and lifetime reject '+JSON.stringify(patch),async()=>{const s=setup();Object.assign(s.connection,patch);await assert.rejects(s.service.prepare(identity,{creation_id:creation}),/reauthorization/);assert.deepEqual(s.seq,[])})
test('confirm persists publish id before PUT; retries and reopens recover same job without another init',async()=>{
 const s=setup(),input=await ready(s);const result=await s.service.confirm(identity,input)
 assert.equal(result.job.status,'processing');assert.ok(s.seq.indexOf('uploading')<s.seq.indexOf('PUT'))
 await s.service.confirm(identity,input);await s.service.prepare(identity,{creation_id:creation})
 assert.equal(s.seq.filter(v=>v==='POST').length,1);assert.equal(s.seq.filter(v=>v==='PUT').length,1)
 s.advance();const status=await s.service.status(identity,{job_id:key});assert.equal(status.job.status,'published');assert.equal(s.seq.filter(v=>v==='POST').length,1)
})
test('double confirmation races never send two init requests',async()=>{const s=setup(),input=await ready(s);await Promise.all([s.service.confirm(identity,input),s.service.confirm(identity,input)]);assert.equal(s.seq.filter(v=>v==='POST').length,1)})
test('same idempotency key with changed intent rejected',async()=>{const s=setup(),input=await ready(s);await s.service.confirm(identity,input);await assert.rejects(s.service.confirm(identity,{...input,options:{...options,title:'changed'}}),/idempotency_conflict/)})
test('changed media/connection version blocks before job',async()=>{const s=setup(),input=await ready(s);s.connection.token_version++;await assert.rejects(s.service.confirm(identity,input),/media_changed/);assert.equal(s.job(),null)})
test('missing consent/private branded options blocked before init',async()=>{for(const patch of [{consent:{...consent,confirmed:false}},{options:{...options,brand_content_toggle:true}}]){const s=setup(),input=await ready(s);await assert.rejects(s.service.confirm(identity,{...input,...patch}));assert.equal(s.job(),null)}})
test('init timeout reconciles without PUT or retry',async()=>{const s=setup();s.deps.uploadFetch=async()=>{s.seq.push('POST');throw Error('timeout')};const input=await ready(s);assert.equal((await s.service.confirm(identity,input)).job.status,'reconciliation_required');await s.service.confirm(identity,input);assert.equal(s.seq.filter(x=>x==='POST').length,1);assert.ok(!s.seq.includes('PUT'))})
test('irrecoverable no-publish job closes without deletion and a new intent can proceed',async()=>{
 const s=setup();s.setJob({id:key,user_id:user,environment:'sandbox',app_id:identity.appId,status:'reconciliation_required',publish_id:null,init_attempts:1,upload_attempts:0,error_code:'init_uncertain',idempotency_key:key,confirmed_options:options})
 const closed=await s.service.close_irrecoverable(identity,{job_id:key});assert.equal(closed.job.status,'failed');assert.equal(s.job().closure_reason,'init_no_publish_id_irrecoverable')
 const prepared=await s.service.prepare(identity,{creation_id:creation});assert.ok(prepared.preparation)
 const input={creation_id:creation,idempotency_key:'55555555-5555-4555-8555-555555555555',preparation:prepared.preparation,options:{...options},consent:{...consent}}
 assert.equal((await s.service.confirm(identity,input)).job.status,'processing');assert.equal(s.seq.filter(x=>x==='POST').length,1)
})
test('failed publish id acknowledgement prevents PUT and later status reconciles',async()=>{const s=setup();const transition=s.deps.repository.transition;s.deps.repository.transition=async(j,n,d)=>{if(n==='uploading')throw Error('ack_unknown');return transition(j,n,d)};const input=await ready(s);await s.service.confirm(identity,input);assert.ok(!s.seq.includes('PUT'));s.advance();assert.equal((await s.service.status(identity,{job_id:key})).job.status,'reconciliation_required')})
test('429 prepare is explicit and does not create job',async()=>{const s=setup();s.setCreatorError({ok:false,error:{category:'rate_limit'}});await assert.rejects(s.service.prepare(identity,{creation_id:creation}),/rate_limit/);assert.equal(s.job(),null)})
test('HTTP JWT/Admin gate executes before service and forbids extra fields',async()=>{
 let calls=0;const handler=createPostingHandler({origin:'https://app.example.test',authorize:async jwt=>{if(jwt!=='fixture-admin')throw Error();return identity},service:{prepare:async()=>{calls++;return {}}}})
 for(const token of [null,'fixture-common']){const r=await handler(new Request('https://x.test',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify({action:'prepare',creation_id:creation})}));assert.ok([401,403].includes(r.status))}
 for(const extra of ['url','bucket','user_id','path','upload_url','publish_id']){const r=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify({action:'prepare',creation_id:creation,[extra]:'untrusted'})}));assert.equal(r.status,400)}
 assert.equal(calls,0)
})
test('public confirm and status schemas remain exact',async()=>{
 let captured
 const handler=createPostingHandler({origin:'https://app.example.test',authorize:async()=>identity,service:{
  confirm:async(_identity,input)=>{captured=input;return {job:{job_id:key,status:'processing',creation_id:creation,product_type:'video_imobiliario'}}},
  status:async(_identity,input)=>({job:{job_id:input.job_id,status:'processing',creation_id:creation,product_type:'video_imobiliario'}}),
 }})
 const confirm={action:'confirm',creation_id:creation,idempotency_key:key,preparation:'fixture-preparation',options:{title:'Fixture',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false},consent:{confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}}
 let response=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify(confirm)}))
 assert.equal(response.status,200);assert.deepEqual(captured,confirm)
 response=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify({...confirm,product_type:'video_imobiliario'})}))
 assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'invalid_input'})
 response=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify({action:'status',job_id:key})}))
 assert.equal(response.status,200)
})
test('prepare 4xx telemetry identifies the sanitized validation stage and code',async()=>{
 const events=[]
 const handler=createPostingHandler({origin:'https://app.example.test',authorize:async()=>identity,telemetry:event=>events.push(event),service:{prepare:async()=>{const error=Error('creation_unavailable');error.prepareStage='creation';throw error}}})
 let response=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify({action:'prepare',creation_id:creation})}))
 assert.equal(response.status,400);assert.deepEqual(await response.json(),{ok:false,error:'creation_unavailable',stage:'creation'});assert.deepEqual(events,[{operation:'prepare',validation_stage:'creation',error_code:'creation_unavailable'}])
 response=await handler(new Request('https://x.test',{method:'POST',headers:{authorization:'Bearer fixture-admin'},body:JSON.stringify({action:'prepare',creation_id:creation,extra:true})}))
 assert.equal(response.status,400);assert.deepEqual(await response.json(),{ok:false,error:'invalid_input',stage:'request_schema'});assert.deepEqual(events.at(-1),{operation:'prepare',validation_stage:'request_schema',error_code:'invalid_input'})
})

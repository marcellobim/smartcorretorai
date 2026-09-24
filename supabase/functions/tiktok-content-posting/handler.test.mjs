import test from 'node:test'
import assert from 'node:assert/strict'
import {createContentPostingHandler,parsePostingInput} from './handler.mjs'
import {creationResolver,VIDEO_MODES} from '../_shared/tiktok-posting/creation-resolver.mjs'
import {createPostingClient} from '../_shared/tiktok-posting/posting-client.mjs'
import {sha256} from '../_shared/tiktok-posting/contract.mjs'
import {storageAdapters} from './storage.mjs'
const U='11111111-1111-4111-8111-111111111111', C='22222222-2222-4222-8222-222222222222'
const K='33333333-3333-4333-8333-333333333333', J='44444444-4444-4444-8444-444444444444'
const connectionId='55555555-5555-4555-8555-555555555555', app='a'.repeat(64)
const bytes=new Uint8Array(128).fill(1), hash=await sha256(bytes)
const creator={creator_avatar_url:'https://example.test/avatar',creator_username:'fixture',creator_nickname:'Fixture',privacy_level_options:['SELF_ONLY'],comment_disabled:false,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60}
const probe={container:'mp4',parse_valid:true,integrity:'structural_sample_bounds',codec:'h264',width:720,height:1280,fps:24,duration_ms:8000,content_length:128,content_sha256:hash}
const options={title:'Imóvel',privacy_level:'SELF_ONLY',disable_comment:false,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false}
const consent={confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}
const intent=(action='confirm')=>({action,product_type:'video_imobiliario',creation_id:C,...(action==='confirm'?{idempotency_key:K,options:{...options},consent:{...consent}}:{})})
function fixture() {
 let time=Date.now(),job=null
 const calls=[]
 const row={id:C,user_id:U,status:'completed',mode:'smart_tour_gemini_omni',output_video_path:U+'/'+C+'/smart-tour.mp4'}
 const connection={id:connectionId,user_id:U,environment:'sandbox',app_id:app,open_id:'synthetic',connection_status:'active',scopes:['user.info.basic','video.publish'],refresh_token_expires_at:new Date(time+86400000).toISOString(),access_token_expires_at:new Date(time+3600000).toISOString()}
 const deps={
  now:()=>time,environment:'sandbox',appId:app,frontendOrigin:'https://example.test',
  auth:{auth:{getUser:async()=>({data:{user:{id:U}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}}},
  admin:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:U}})})})})},
  readConnection:async()=>connection,decrypt:async()=>{calls.push('decrypt');return 'synthetic-secret'},
  resolveTikTokPublishableCreation:creationResolver({readCreation:async()=>row,inspectObject:async()=>({contentType:'video/mp4',size:128})}),
  loadBytes:async()=>bytes,probe:async()=>probe,preview:async()=> 'https://example.test/short-lived-preview',
  readJob:async()=>job,
  repository:{
   create:async snapshot=>{
    calls.push('create')
    if(job){if(job.request_fingerprint!==snapshot.request_fingerprint)throw Error('posting_idempotency_conflict');return structuredClone(job)}
    job={...snapshot,id:J,status:'awaiting_confirmation',revision:1,init_attempts:0}
    return structuredClone(job)
   },
   claim:async(id,revision)=>{
    calls.push('claim')
    if(job.revision!==revision||Date.parse(job.claim_expires_at)>time)throw Error('cas')
    if(['initializing','uploading'].includes(job.status))job.status='reconciliation_required'
    job={...job,revision:revision+1,claim_token:K,claim_expires_at:new Date(time+120000).toISOString()}
    return structuredClone(job)
   },
   transition:async(current,next,extra={})=>{
    calls.push(next)
    if(current.revision!==job.revision)throw Error('cas')
    job={...job,status:next,revision:job.revision+1,...(extra.publishId?{publish_id:extra.publishId}:{}),error_code:extra.errorCode,
     provider_status:extra.providerStatus,next_poll_at:new Date(time+10000).toISOString()}
    return structuredClone(job)
   },
  },
  fetcher:async(url,request)=>{
   if(String(url).includes('creator_info')) {calls.push('creator');return Response.json({error:{code:'ok'},data:creator})}
   if(String(url).includes('video/init')) {calls.push('init');return Response.json({error:{code:'ok'},data:{publish_id:'fixture.publish',upload_url:'https://open-upload.tiktokapis.com/video/?upload_id=fixture&upload_token=synthetic'}})}
   if(String(url).includes('status/fetch')) {calls.push('status');return Response.json({error:{code:'ok'},data:{status:'PUBLISH_COMPLETE'}})}
   calls.push('put')
   assert.equal(job.publish_id,'fixture.publish')
   assert.equal(request.headers.Authorization,undefined)
   return new Response(null,{status:201})
  },
 }
 deps.client=createPostingClient({fetcher:(...args)=>deps.fetcher(...args),now:()=>time})
 const run=async(input=intent())=>{
  const response=await createContentPostingHandler(deps)(new Request('https://example.test/post',{method:'POST',headers:{authorization:'Bearer synthetic-jwt','content-type':'application/json'},body:JSON.stringify(input)}))
  return {status:response.status,body:await response.json()}
 }
 return {deps,calls,row,connection,run,get job(){return job},advance:()=>{time+=121000}}
}
test('four active presets resolve one owner-scoped persisted Video Imobiliario',async()=>{
 assert.deepEqual(VIDEO_MODES,['animate-images','campaign-video','narrated-video','virtual-agent'])
 const f=fixture(),r=await f.deps.resolveTikTokPublishableCreation('video_imobiliario',C,U)
 assert.equal(r.product,'video_imobiliario');assert.equal(r.objectPath,U+'/'+C+'/smart-tour.mp4')
 for(const product of ['studio_ia_commercial','commercial','virtual-agent','narrated_tour','free_text'])await assert.rejects(f.deps.resolveTikTokPublishableCreation(product,C,U))
 for(const patch of [{user_id:K},{status:'generating'},{mode:'dynamic_reel'},{output_video_path:K+'/'+C+'/smart-tour.mp4'},{mode:'smart_tour_gemini_omni_short_video'}]){
  const g=fixture();Object.assign(g.row,patch);await assert.rejects(g.deps.resolveTikTokPublishableCreation('video_imobiliario',C,U))
 }
})
test('strict request rejects destination, identity, credentials and unsolicited options',()=>{
 for(const field of ['url','bucket','path','user_id','app_id','environment','upload_url','publish_id','token','connection_id']){
  assert.throws(()=>parsePostingInput({...intent(),[field]:'forbidden'}))
  assert.throws(()=>parsePostingInput({...intent(),options:{...options,[field]:'forbidden'}}))
 }
 assert.throws(()=>parsePostingInput({...intent(),options:{...options,is_aigc:false}}))
 assert.throws(()=>parsePostingInput({...intent(),options:{...options,privacy_level:undefined,extra:true}}))
 assert.throws(()=>parsePostingInput({action:'status',job_id:J,url:'forbidden'}))
})
test('prepare queries creator and probes media without a job, init or PUT',async()=>{
 const f=fixture(),r=await f.run(intent('prepare'))
 assert.equal(r.status,200);assert.equal(r.body.privacy_level,null);assert.equal(r.body.is_aigc,true)
 assert.deepEqual(f.calls,['decrypt','creator'])
 assert.equal(f.job,null)
 assert.doesNotMatch(JSON.stringify(r.body),/synthetic-secret|object_path|open_id|app_id|bucket/)
})
test('auth, admin, MFA and sandbox fail before any media/provider call',async()=>{
 for(const alter of [
  d=>{d.auth.auth.getUser=async()=>({error:true})},
  d=>{d.admin.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})},
  d=>{d.auth.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal1'}})},
  d=>{d.environment='production'},
 ]){
  const f=fixture();alter(f.deps);assert.ok((await f.run()).status>=400);assert.deepEqual(f.calls,[])
 }
})
test('expired, insufficient lifetime, missing scope and wrong-identity connections require reauthorization',async()=>{
 for(const patch of [{access_token_expires_at:new Date(0).toISOString()},{access_token_expires_at:new Date(Date.now()+120000).toISOString()},{scopes:['user.info.basic']},{user_id:K},{app_id:'b'.repeat(64)},{environment:'production'}]){
  const f=fixture();Object.assign(f.connection,patch);assert.equal((await f.run()).body.error,'posting_reauthorization_required');assert.deepEqual(f.calls,[])
 }
})
test('confirm has exact order, AIGC and idempotent retry never reinitializes',async()=>{
 const f=fixture(),r=await f.run()
 assert.equal(r.body.status,'processing')
 assert.deepEqual(f.calls,['decrypt','creator','create','claim','queued','initializing','init','uploading','put','processing'])
 assert.equal(f.job.confirmed_options.is_aigc,true)
 assert.doesNotMatch(JSON.stringify(f.job),/upload_token|synthetic-secret/)
 assert.doesNotMatch(JSON.stringify(r.body),/publish_id|upload_token|synthetic-secret|claim_token/)
 await f.run()
 assert.equal(f.calls.filter(x=>x==='init').length,1)
 const changed=intent();changed.options.title='Outra legenda'
 assert.equal((await f.run(changed)).body.error,'posting_idempotency_conflict')
})
test('parallel confirmations use one claim and one init',async()=>{
 const f=fixture();await Promise.all([f.run(),f.run()])
 assert.equal(f.calls.filter(x=>x==='init').length,1);assert.equal(f.calls.filter(x=>x==='put').length,1)
})
test('options, consent and duration fail before durable job or init',async()=>{
 for(const edit of [
  i=>{i.options.privacy_level=null},i=>{i.options.disable_duet=false},
  i=>{i.consent.confirmed=false},i=>{i.consent.music_usage_confirmed=false},
  i=>{i.options.brand_content_toggle=true},
 ]){
  const f=fixture(),i=intent();edit(i);assert.ok((await f.run(i)).status>=400);assert.ok(!f.calls.includes('create'))
 }
 const f=fixture();f.deps.probe=async()=>({...probe,duration_ms:61000});assert.ok((await f.run()).status>=400)
})
test('init timeout becomes reconciliation with no retry or PUT',async()=>{
 const f=fixture(),original=f.deps.fetcher
 f.deps.fetcher=async(url,...args)=>{if(String(url).includes('video/init'))throw Error('raw-provider-secret');return original(url,...args)}
 assert.equal((await f.run()).body.status,'reconciliation_required')
 await f.run();assert.ok(!f.calls.includes('put'))
})
test('invalid upload destination retains publish id without PUT',async()=>{
 const f=fixture(),original=f.deps.fetcher
 f.deps.fetcher=async(url,...args)=>String(url).includes('video/init')?Response.json({error:{code:'ok'},data:{publish_id:'fixture.publish',upload_url:'https://evil.test'}}):original(url,...args)
 assert.equal((await f.run()).body.status,'reconciliation_required');assert.equal(f.job.publish_id,'fixture.publish');assert.ok(!f.calls.includes('put'))
})
test('publish-id persistence failure never PUTs; lease recovery never initializes',async()=>{
 const f=fixture(),original=f.deps.repository.transition
 f.deps.repository.transition=async(job,next,extra)=>{if(next==='uploading')throw Error('database raw secret');return original(job,next,extra)}
 const r=await f.run();assert.equal(r.status,202);assert.ok(!f.calls.includes('put'))
 f.advance()
 const s=await f.run({action:'status',job_id:J})
 assert.equal(s.body.status,'reconciliation_required');assert.equal(f.calls.filter(x=>x==='init').length,1);assert.ok(!f.calls.includes('status'))
})
test('PUT timeout retains id; status persists completion and never creates a post',async()=>{
 const f=fixture(),original=f.deps.fetcher
 f.deps.fetcher=async(url,...args)=>{if(String(url).includes('open-upload'))throw Error('timeout');return original(url,...args)}
 assert.equal((await f.run()).body.status,'reconciliation_required');assert.equal(f.job.publish_id,'fixture.publish')
 f.advance()
 const r=await f.run({action:'status',job_id:J})
 assert.equal(r.body.status,'published');assert.equal(r.body.status_label,'Publicado')
 assert.equal(f.job.provider_status,'PUBLISH_COMPLETE')
 await f.run({action:'status',job_id:J})
 assert.equal(f.calls.filter(x=>x==='status').length,1);assert.equal(f.calls.filter(x=>x==='init').length,1)
})
test('status fails closed on another owner, app or environment',async()=>{
 for(const field of ['user_id','environment','app_id']){
  const f=fixture();await f.run();f.job[field]='other'
  assert.equal((await f.run({action:'status',job_id:J})).body.error,'posting_job_unavailable');assert.ok(!f.calls.includes('status'))
 }
})
test('status waits on a live lease and maps provider FAILED without leaking raw reason',async()=>{
 const f=fixture();await f.run();await f.run({action:'status',job_id:J});assert.ok(!f.calls.includes('status'))
 f.advance();f.deps.client={...f.deps.client,status:async()=>({ok:true,data:{status:'failed',provider_status:'FAILED',error_category:'invalid_media'}})}
 assert.equal((await f.run({action:'status',job_id:J})).body.status_label,'Falhou');assert.equal(f.job.error_code,'provider_failed')
})
test('storage download bounds actual bytes and rejects redirects/MIME/length mismatch',async()=>{
 for(const [response,expected] of [
  [new Response(bytes,{headers:{'content-type':'video/mp4'}}),128],
  [new Response(bytes,{headers:{'content-type':'video/mp4'}}),127],
  [new Response(bytes,{headers:{'content-type':'text/plain'}}),128],
 ]){
  const adapter=storageAdapters({admin:{},supabaseUrl:'https://project.supabase.co',serviceKey:'synthetic',fetcher:async(url,options)=>{assert.equal(options.redirect,'error');assert.ok(String(url).startsWith('https://project.supabase.co/storage/'));return response}})
  const call=adapter.loadBytes({bucket:'studio-videos',objectPath:U+'/'+C+'/smart-tour.mp4',media:{size:expected}})
  if(expected===128&&response.headers.get('content-type')==='video/mp4')assert.equal((await call).byteLength,128)
  else await assert.rejects(call)
 }
})

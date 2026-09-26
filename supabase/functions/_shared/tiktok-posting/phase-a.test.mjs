import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {MAX_BYTES,sha256,prepareJob,authorizeControl,parseIntent,validateOptions,validateTransition,STATES} from './contract.mjs'
import {singleChunk,validateUploadUrl,executeFileUpload,putUpload} from './file-upload.mjs'
import {postingRepository} from './repository.mjs'
const USER='11111111-1111-4111-8111-111111111111',CREATION='22222222-2222-4222-8222-222222222222'
const CONNECTION='33333333-3333-4333-8333-333333333333',KEY='44444444-4444-4444-8444-444444444444'
const NOW=Date.parse('2026-09-23T12:00:00Z')
const bytes=new Uint8Array(32).fill(1),hash=await sha256(bytes)
const options={title:'Fixture',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:true,is_aigc:true}
const creator={privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60}
const connection={id:CONNECTION,user_id:USER,environment:'sandbox',app_id:'a'.repeat(64),open_id:'fictional-open-id',connection_status:'active'}
const creation={id:CREATION,user_id:USER,status:'completed',mode:'smart_tour_gemini_omni',output_video_path:USER+'/'+CREATION+'/smart-tour.mp4'}
const media={contentType:'video/mp4',size:32,etag:'fixture-etag',version:'fixture-version'}
const info={container:'mp4',codec:'h264',width:720,height:1280,durationMs:8000,fps:24,size:32,etag:media.etag,version:media.version,sha256:hash}
const base=()=>({input:{creation_id:CREATION,connection_id:CONNECTION,idempotency_key:KEY,confirmed_options:structuredClone(options)},
 identity:{userId:USER,environment:'sandbox',appId:connection.app_id},readCreation:async()=>({...creation}),readConnection:async()=>({...connection}),
 inspectObject:async()=>({...media}),probe:async()=>({...info}),creator:structuredClone(creator),creatorCheckedAt:new Date(NOW-1000).toISOString(),now:NOW})
test('trusted preflight derives exact product/bucket/path and stable fingerprint',async()=>{
 const a=await prepareJob(base()),b=await prepareJob({...base(),now:NOW+1000})
 assert.equal(a.product,'video_imobiliario');assert.equal(a.object_path,creation.output_video_path)
 assert.equal(a.bucket,'studio-videos');assert.equal(a.content_sha256,hash);assert.equal(a.request_fingerprint,b.request_fingerprint)
})
for(const key of ['bucket','path','url','user_id','environment','app_id','source_type'])test('frontend forbidden field '+key,()=>{
 const d=base();d.input[key]='untrusted';assert.throws(()=>parseIntent(d.input),/posting_input_invalid/)
})
for(const [name,patch] of [['wrong owner',{user_id:CONNECTION}],['incomplete',{status:'processing'}],['Studio IA mode',{mode:'dynamic_reel'}],['other product',{mode:'free_ai'}],['wrong path',{output_video_path:'other/video.mp4'}]])test('creation rejects '+name,async()=>{
 await assert.rejects(prepareJob({...base(),readCreation:async()=>({...creation,...patch})}),/posting_creation_invalid/)
})
for(const [name,patch] of [['owner',{user_id:CONNECTION}],['environment',{environment:'production'}],['app',{app_id:'b'.repeat(64)}],['inactive',{connection_status:'revoked'}]])test('connection rejects '+name,async()=>{
 await assert.rejects(prepareJob({...base(),readConnection:async()=>({...connection,...patch})}),/posting_connection_invalid/)
})
for(const patch of [{contentType:'image/png'},{size:0},{size:MAX_BYTES+1}])test('invalid storage metadata '+JSON.stringify(patch),async()=>{
 await assert.rejects(prepareJob({...base(),inspectObject:async()=>({...media,...patch})}),/posting_media_invalid/)
})
for(const patch of [{container:'mov'},{codec:'unknown'},{width:0},{durationMs:0},{fps:0},{etag:'changed'},{sha256:''}])test('actual probe rejects '+JSON.stringify(patch),async()=>{
 await assert.rejects(prepareJob({...base(),probe:async()=>({...info,...patch})}),/posting_probe_invalid/)
})
test('missing probe is fail closed, never inferred from generation settings',async()=>{await assert.rejects(prepareJob({...base(),probe:async()=>null}),/posting_probe_invalid/)})
test('creator constraints and stale consent',async()=>{
 await assert.rejects(prepareJob({...base(),creatorCheckedAt:new Date(NOW-300001).toISOString()}),/posting_consent_stale/)
 assert.throws(()=>validateOptions({...options,privacy_level:'PUBLIC_TO_EVERYONE'},creator,8000),/posting_options_invalid/)
 assert.throws(()=>validateOptions({...options,disable_comment:false},creator,8000),/posting_options_invalid/)
 assert.throws(()=>validateOptions({...options,access_token:'fictional'},creator,8000),/posting_input_invalid/)
})
function authDeps({valid=true,admin=true,aal='aal2',environment='sandbox'}={}) {
 return {jwt:'fixture-jwt',environment,appId:connection.app_id,
 auth:{auth:{getUser:async()=>({data:{user:valid?{id:USER}:null},error:valid?null:{}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal},error:null})}}},
 admin:{from:name=>{assert.equal(name,'admin_users');return {select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:USER}:null,error:null})})})}}}}
}
test('Admin gate reuses authenticated getUser, admin_users and AAL2',async()=>{
 assert.equal((await authorizeControl(authDeps())).userId,USER)
 for(const patch of [{valid:false},{admin:false},{aal:'aal1'},{environment:'production'}])await assert.rejects(authorizeControl(authDeps(patch)))
})
test('single chunk handles small files and exact 50 MiB boundary',()=>{
 for(const n of [1,32,MAX_BYTES])assert.deepEqual(singleChunk(n),{source:'FILE_UPLOAD',video_size:n,chunk_size:n,total_chunk_count:1})
 for(const n of [0,-1,MAX_BYTES+1,1.5])assert.throws(()=>singleChunk(n))
})
const upload='https://open-upload.tiktokapis.com/video/?upload_id=fixture&upload_token=fixture'
test('upload destination exact allowlist rejects SSRF, redirects and credentials',()=>{
 assert.equal(validateUploadUrl(upload),upload)
 for(const value of ['http://open-upload.tiktokapis.com/video/','https://open-upload.tiktokapis.com.evil.test/video/?upload_id=a&upload_token=b',
 'https://user@open-upload.tiktokapis.com/video/?upload_id=a&upload_token=b','https://open-upload.tiktokapis.com:444/video/?upload_id=a&upload_token=b',
 'https://open-upload.tiktokapis.com/other/?upload_id=a&upload_token=b',upload+'#fragment'])assert.throws(()=>validateUploadUrl(value))
})
async function harness({init='ok',put='ok',persistFail=false,diagnosticFail=false,changed=false}={}) {
 let job={...await prepareJob(base()),id:KEY,status:'queued',revision:1,claim_token:KEY,claim_expires_at:new Date(Date.now()+120000).toISOString(),creator_info_checked_at:new Date(Date.now()-1000).toISOString(),init_attempts:0,upload_attempts:0}
 const events=[],writes=[]
 const repository={transition:async(current,next,extra={})=>{
  events.push('persist:'+next);writes.push({next,...extra})
  validateTransition(current,next,{revision:job.revision,claim:job.claim_token,errorCode:extra.errorCode})
  if(persistFail&&next==='uploading')throw Error('posting_repository_unavailable')
  job={...job,status:next,revision:job.revision+1,publish_id:extra.publishId??job.publish_id,error_code:extra.errorCode??job.error_code,
   init_attempts:job.init_attempts+(next==='initializing'?1:0),upload_attempts:job.upload_attempts+(next==='uploading'?1:0)}
  return {...job}
 },persistInitDiagnostic:async(current,diagnostic)=>{
  if(diagnosticFail)throw Error('posting_repository_unavailable')
  job={...job,provider_http_status:diagnostic.httpStatus,provider_error_code:diagnostic.providerCode,provider_error_message:diagnostic.providerMessage,provider_log_id:diagnostic.providerLogId,failure_stage:'init'}
  return {...job}
 }}
 const fetcher=async(url,request)=>{
  if(request.method==='POST'){
   events.push('init');assert.equal(url,'https://open.tiktokapis.com/v2/post/publish/video/init/')
   assert.equal(JSON.parse(request.body).source_info.source,'FILE_UPLOAD')
   assert.equal(request.redirect,'error')
   if(init==='timeout')return new Promise((_,reject)=>request.signal.addEventListener('abort',()=>reject(Object.assign(new Error('timeout'),{name:'AbortError'})),{once:true}))
   if(init==='abort')throw Object.assign(new Error('abort'),{name:'AbortError'})
   if(init==='transport')throw Error('private provider failure')
   if(init==='http')return new Response(JSON.stringify({error:{code:'invalid_param',message:'Invalid post_info',log_id:'safe-log'}}),{status:400})
   if(init==='tiktok')return new Response(JSON.stringify({error:{code:'invalid_param',message:'Invalid post_info',log_id:'safe-log'}}),{status:200})
   if(init==='unsafe')return new Response(JSON.stringify({error:{code:'invalid_param',message:'Bearer fixture-access https://private.example/upload_url',log_id:'not safe!'}}),{status:400})
   if(init==='invalidjson')return new Response('{',{status:200})
   if(init==='missing')return new Response(JSON.stringify({error:{code:'ok'},data:{upload_url:upload}}),{status:200})
   return new Response(JSON.stringify({error:{code:'ok'},data:{publish_id:'fixture-publish',upload_url:init==='badurl'?'https://evil.test':upload}}),{status:200})
  }
  events.push('put');assert.equal(job.publish_id,'fixture-publish');assert.equal(job.status,'uploading')
  assert.equal(request.headers.Authorization,undefined)
  assert.equal(request.headers['Content-Length'],'32');assert.equal(request.headers['Content-Range'],'bytes 0-31/32')
  assert.deepEqual(request.body,bytes)
  if(put==='timeout')throw Error('private upload failure')
  return new Response(null,{status:201})
 }
 const run=()=>executeFileUpload({job:{...job},repository,accessToken:'fixture-access',loadBytes:async()=>changed?new Uint8Array(32):bytes,fetcher,initTimeoutMs:init==='timeout'?1:20000})
 return {run,events,writes,get:()=>job}
}
test('persist publish_id ACK precedes PUT; URL never persisted or returned',async()=>{
 const h=await harness(),r=await h.run()
 assert.deepEqual(h.events,['persist:initializing','init','persist:uploading','put','persist:processing'])
 assert.deepEqual(r,{status:'processing'})
 assert.doesNotMatch(JSON.stringify(h.writes),/upload_url|upload_token|fixture-access|https:/)
})
test('init timeout moves to reconciliation, never retries init',async()=>{
 const h=await harness({init:'timeout'});assert.equal((await h.run()).status,'reconciliation_required')
 assert.equal(h.events.filter(x=>x==='init').length,1);assert.equal(h.events.includes('put'),false)
 await assert.rejects(h.run(),/posting_not_ready/)
})
test('PUT timeout preserves publish id and forbids blind retry',async()=>{
 const h=await harness({put:'timeout'});assert.equal((await h.run()).status,'reconciliation_required')
 assert.equal(h.get().publish_id,'fixture-publish');await assert.rejects(h.run(),/posting_not_ready/)
})
test('persistence failure after init never starts upload',async()=>{
 const h=await harness({persistFail:true});await assert.rejects(h.run(),/posting_repository_unavailable/)
 assert.equal(h.events.includes('put'),false)
})
test('bad upload URL retains publish id for reconciliation',async()=>{
 const h=await harness({init:'badurl'});assert.equal((await h.run()).status,'reconciliation_required')
 assert.equal(h.get().publish_id,'fixture-publish');assert.equal(h.events.includes('put'),false)
})
test('changed authorized bytes block before provider init',async()=>{
 const h=await harness({changed:true});assert.deepEqual(await h.run(),{status:'blocked'});assert.equal(h.events.includes('init'),false)
})
test('CAS rejects stale revision, expired lease and arbitrary transitions',()=>{
 const j={status:'queued',revision:2,claim_token:KEY,claim_expires_at:new Date(NOW+1000).toISOString(),init_attempts:0}
 assert.throws(()=>validateTransition(j,'initializing',{revision:1,claim:KEY,now:NOW}),/posting_cas_conflict/)
 assert.throws(()=>validateTransition(j,'initializing',{revision:2,claim:KEY,now:NOW+2000}),/posting_cas_conflict/)
 assert.throws(()=>validateTransition(j,'published',{revision:2,claim:KEY,now:NOW}),/posting_transition_invalid/)
 assert.deepEqual(STATES.published,[])
})
test('repository maps only allowed RPC arguments',async()=>{
 const calls=[],repo=postingRepository({rpc:async(name,args)=>{calls.push({name,args});return {data:{id:KEY},error:null}}})
 await repo.transition({id:KEY,revision:3,claim_token:KEY},'uploading',{publishId:'fixture-publish',upload_url:upload})
 assert.equal(calls[0].args.p_publish_id,'fixture-publish');assert.doesNotMatch(JSON.stringify(calls),/upload_token|upload_url/)
})
test('double click model reuses key, different fingerprint rejects (real concurrency requires PostgreSQL)',async()=>{
 const records=new Map(),job=await prepareJob(base())
 const repo=postingRepository({rpc:async(name,{p_job:j})=>{
  assert.equal(name,'create_tiktok_publish_job')
  const key=[j.user_id,j.environment,j.app_id,j.idempotency_key].join(':')
  const old=records.get(key)
  if(old&&old.request_fingerprint!==j.request_fingerprint)return {error:{}}
  if(!old)records.set(key,{...j,id:KEY})
  return {data:records.get(key)}
 }})
 const [a,b]=await Promise.all([repo.create(job),repo.create(job)])
 assert.equal(a.id,b.id);assert.equal(records.size,1)
 await assert.rejects(repo.create({...job,request_fingerprint:'b'.repeat(64)}))
})
const sql=readFileSync(new URL('../../../migrations/20260923010000_create_tiktok_publish_jobs.sql',import.meta.url),'utf8')
test('SQL schema contract: identity FK, bounds, idempotency, partial active uniqueness',()=>{
 for(const fragment of ["REFERENCES public.tiktok_connections(id,user_id,environment,app_id,open_id)","content_length <= 52428800",
 "UNIQUE(user_id,environment,app_id,idempotency_key)","WHERE publish_id IS NOT NULL","WHERE status NOT IN ('published','blocked','failed')",
 "output_video_path=j.object_path","pg_advisory_xact_lock","FOR UPDATE","posting_snapshot_immutable"])assert.ok(sql.includes(fragment),fragment)
})
test('Video Imobiliário source contract allows only the persisted smart-tour mode and product',()=>{
 const source=readFileSync(new URL('../../../migrations/20260924050000_tiktok_video_imobiliario_source.sql',import.meta.url),'utf8')
 assert.match(source,/j\.product IS DISTINCT FROM 'video_imobiliario'/)
 assert.match(source,/mode='smart_tour_gemini_omni'/)
 assert.match(source,/\/smart-tour\.mp4/)
 assert.doesNotMatch(source,/mode='dynamic_reel'/)
})
test('SQL RLS/grants: service only RPC writes, no excess table privileges',()=>{
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/)
 assert.match(sql,/REVOKE ALL ON TABLE public.tiktok_publish_jobs FROM PUBLIC,anon,authenticated,service_role/)
 assert.match(sql,/GRANT SELECT ON TABLE public.tiktok_publish_jobs TO service_role/)
 assert.doesNotMatch(sql,/GRANT (?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER) ON TABLE/)
 const names=[...sql.matchAll(/CREATE FUNCTION public\.(\w+)\(/g)].map(x=>x[1])
 assert.equal(names.length,4)
 for(const name of names)assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.'+name))
 assert.equal((sql.match(/SET search_path = pg_catalog, public/g)||[]).length,4)
})
test('SQL transition/lease safety and no credential fields',()=>{
 for(const text of ['j.revision IS DISTINCT FROM p_revision','j.claim_token IS DISTINCT FROM p_claim','posting_publish_id_immutable',
 "'reconciliation_required'","scopes @> ARRAY['user.info.basic','video.publish']","posting_failure_unconfirmed"])assert.ok(sql.includes(text))
 const table=sql.split('CREATE TABLE public.tiktok_publish_jobs (')[1].split('CREATE UNIQUE INDEX')[0]
 assert.doesNotMatch(table,/\b(?:access_token|refresh_token|upload_url|client_secret|signed_url)\s+(?:text|jsonb)/i)
 const names=[...sql.matchAll(/CONSTRAINT (\w+)/g)].map(x=>x[1]);assert.equal(names.length,new Set(names).size)
 assert.ok(names.every(x=>x.length<=63))
})

test('createJobFromControl rejects missing authentication before reading media',async()=>{
 const {createJobFromControl}=await import('./contract.mjs')
 let read=false
 await assert.rejects(createJobFromControl({...base(),...authDeps({valid:false}),readCreation:async()=>{read=true;return creation},repository:{create:()=>assert.fail('must not persist')}}))
 assert.equal(read,false)
})
test('CAS rejects NULL-like revision and a missing lease deadline',()=>{
 const j={status:'queued',revision:2,claim_token:KEY,claim_expires_at:null,init_attempts:0}
 assert.throws(()=>validateTransition(j,'initializing',{revision:null,claim:KEY,now:NOW}),/posting_cas_conflict/)
 assert.throws(()=>validateTransition(j,'initializing',{revision:2,claim:KEY,now:NOW}),/posting_cas_conflict/)
})
test('INIT classifications preserve safe diagnostics without upload',async()=>{
 for(const [init,status,code] of [
  ['timeout','reconciliation_required','init_timeout'],['abort','reconciliation_required','init_abort'],['transport','reconciliation_required','init_transport_error'],
  ['http','failed','init_provider_rejected'],['tiktok','failed','init_provider_rejected'],['invalidjson','reconciliation_required','init_invalid_json'],
  ['missing','reconciliation_required','init_missing_publish_id']
 ]){
  const h=await harness({init});assert.equal((await h.run()).status,status,init);assert.equal(h.get().error_code,code,init);assert.equal(h.events.includes('put'),false,init)
 }
})
test('INIT diagnostic strips secrets and secondary persistence failures preserve the original failure',async()=>{
 const unsafe=await harness({init:'unsafe'});assert.equal((await unsafe.run()).status,'failed');assert.deepEqual({http:unsafe.get().provider_http_status,code:unsafe.get().provider_error_code,message:unsafe.get().provider_error_message,log:unsafe.get().provider_log_id,stage:unsafe.get().failure_stage},{http:400,code:'invalid_param',message:null,log:null,stage:'init'});assert.doesNotMatch(JSON.stringify(unsafe.get()),/fixture-access|private\.example|upload_url/)
 const failed=await harness({init:'http',diagnosticFail:true});assert.equal((await failed.run()).status,'failed');assert.equal(failed.get().error_code,'init_provider_rejected');assert.equal(failed.events.includes('put'),false)
})

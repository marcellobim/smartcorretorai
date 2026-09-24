import test from 'node:test'
import assert from 'node:assert/strict'
import {inspect} from 'node:util'
import {createPostingClient,POSTING_LIMITS,classifyPostingError} from './posting-client.mjs'
import {parseCreatorInfo,initialPostingSelection,confirmedPostInfo,creatorSnapshot} from './posting-options.mjs'
const token='synthetic-access-never-log'
const upload='https://open-upload.tiktokapis.com/video/?upload_id=fixture&upload_token=synthetic-only'
const creator={creator_avatar_url:'https://example.test/avatar.png',creator_username:'fixture',creator_nickname:'Fixture',
 privacy_level_options:['SELF_ONLY','PUBLIC_TO_EVERYONE'],comment_disabled:false,duet_disabled:false,stitch_disabled:false,max_video_post_duration_sec:60}
const probe={container:'mp4',codec:'h264',width:720,height:1280,duration_ms:8000,fps:24,content_length:3659097,
 content_sha256:'a'.repeat(64),parse_valid:true,integrity:'structural_sample_bounds'}
const options={title:'Fixture',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,
 brand_content_toggle:false,brand_organic_toggle:false,is_aigc:true}
const consent={confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}
const initArgs=()=>({accessToken:token,creator:structuredClone(creator),probe:{...probe},options:{...options},consent:{...consent}})
const response=(data,status=200,code='ok')=>new Response(JSON.stringify({data,error:{code,message:token,log_id:'private'},open_id:'private-open-id'}),{status})
function harness(data,status=200,code='ok'){
 const calls=[]
 const client=createPostingClient({fetcher:async(url,request)=>{calls.push({url,request});return response(data,status,code)}})
 return {client,calls}
}
test('no default network transport',()=>assert.throws(()=>createPostingClient(),/configuration/))
test('creator success projects only required fields and fixed request',async()=>{
 const {client,calls}=harness({...creator,access_token:token,open_id:'private'})
 const r=await client.creatorInfo({accessToken:token})
 assert.deepEqual(r,{ok:true,data:creator})
 assert.equal(calls[0].url,'https://open.tiktokapis.com/v2/post/publish/creator_info/query/')
 assert.equal(calls[0].request.method,'POST');assert.equal(calls[0].request.redirect,'error')
 assert.equal(calls[0].request.headers.Authorization,'Bearer '+token)
 assert.equal(calls[0].request.body,'{}')
})
for(const [name,patch] of [['empty privacy',{privacy_level_options:[]}],['unknown privacy',{privacy_level_options:['UNKNOWN']}],
 ['missing field',{creator_nickname:undefined}],['malformed boolean',{comment_disabled:'false'}],['bad duration',{max_video_post_duration_sec:0}],
 ['bad avatar',{creator_avatar_url:'javascript:alert(1)'}],['duplicate privacy',{privacy_level_options:['SELF_ONLY','SELF_ONLY']}]]){
 test('creator rejects '+name,async()=>assert.equal((await harness({...creator,...patch}).client.creatorInfo({accessToken:token})).ok,false))
}
test('creator missing payload',async()=>assert.equal((await harness(undefined).client.creatorInfo({accessToken:token})).ok,false))
test('privacy and interactions start unselected; no fallback',()=>{
 const selection=initialPostingSelection(creator)
 assert.equal(selection.privacy_level,null)
 for(const key of ['allow_comment','allow_duet','allow_stitch'])assert.equal(selection[key],false)
 assert.throws(()=>confirmedPostInfo({...initArgs(),options:{...options,privacy_level:null}}))
})
for(const kind of ['comment','duet','stitch'])test('disabled '+kind+' blocks enabling',()=>{
 assert.throws(()=>confirmedPostInfo({...initArgs(),creator:{...creator,[kind+'_disabled']:true},options:{...options,['disable_'+kind]:false}}))
})
for(const [name,patch,category] of [
 ['long media',{probe:{...probe,duration_ms:61000}},'invalid_media'],
 ['missing consent',{consent:undefined},'invalid_options'],
 ['AIGC off',{options:{...options,is_aigc:false}},'invalid_options'],
 ['privacy not offered',{options:{...options,privacy_level:'FOLLOWER_OF_CREATOR'}},'invalid_options'],
 ['disclosure without type',{consent:{...consent,commercial_disclosure:true}},'invalid_options'],
 ['brand without disclosure',{options:{...options,brand_organic_toggle:true}},'invalid_options'],
 ['paid private',{options:{...options,brand_content_toggle:true},consent:{...consent,commercial_disclosure:true,branded_content_policy_confirmed:true}},'invalid_options'],
 ['paid without policy',{options:{...options,privacy_level:'PUBLIC_TO_EVERYONE',brand_content_toggle:true},consent:{...consent,commercial_disclosure:true}},'invalid_options']
]){
 test('init preflight '+name,async()=>{const h=harness({});const r=await h.client.init({...initArgs(),...patch});assert.equal(r.error.category,category);assert.equal(h.calls.length,0)})
}
test('commercial own/paid/both selections are explicit and not rewritten',()=>{
 for(const [own,paid] of [[true,false],[false,true],[true,true]]){
  const input={...initArgs(),options:{...options,privacy_level:'PUBLIC_TO_EVERYONE',brand_organic_toggle:own,brand_content_toggle:paid},
   consent:{...consent,commercial_disclosure:true,branded_content_policy_confirmed:paid}}
  assert.deepEqual(confirmedPostInfo(input),input.options)
 }
})
test('init exact FILE_UPLOAD payload; backend URL capability is not serializable',async()=>{
 const h=harness({publish_id:'fixture-publish',upload_url:upload})
 const r=await h.client.init(initArgs())
 assert.equal(r.ok,true)
 const {post_info,source_info}=JSON.parse(h.calls[0].request.body)
 assert.deepEqual(post_info,options)
 assert.deepEqual(source_info,{source:'FILE_UPLOAD',video_size:probe.content_length,chunk_size:probe.content_length,total_chunk_count:1})
 assert.equal(h.calls[0].url,'https://open.tiktokapis.com/v2/post/publish/video/init/')
 assert.equal(JSON.stringify(r),'{"ok":true,"publish_id":"fixture-publish"}')
 assert.ok(!inspect(r).includes(upload));assert.equal(r.takeUploadUrl(),upload);assert.throws(()=>r.takeUploadUrl())
})
for(const [name,data] of [
 ['missing publish',{upload_url:upload}],['missing URL',{publish_id:'fixture-publish'}],
 ['invalid URL',{publish_id:'fixture-publish',upload_url:'http://open-upload.tiktokapis.com/video/?upload_id=a&upload_token=b'}],
 ['wrong host',{publish_id:'fixture-publish',upload_url:'https://evil.test/video/?upload_id=a&upload_token=b'}]
]){
 test('init response '+name,async()=>{const r=await harness(data).client.init(initArgs());assert.equal(r.ok,false);assert.equal(r.error.ambiguous,true)
  if(data.publish_id)assert.equal(r.publish_id,data.publish_id)
  assert.ok(!JSON.stringify(r).includes('upload_token'))
 })
}
for(const operation of ['creator','init','status']){
 for(const [name,status,code,category] of [['HTTP200 error',200,'scope_not_authorized','auth_scope'],['401',401,'access_token_invalid','auth_scope'],['429',429,'rate_limit_exceeded','rate_limit'],['5xx',503,'internal_error','provider_temporary']]){
  test(operation+' '+name,async()=>{
   const h=harness({},status,code)
   const r=operation==='creator'?await h.client.creatorInfo({accessToken:token}):operation==='init'?await h.client.init(initArgs()):await h.client.status({accessToken:token,publishId:'fixture-publish'})
   assert.equal(r.ok,false);assert.equal(r.error.category,category);assert.equal(r.error.retry_automatically,false);assert.equal(h.calls.length,1)
   assert.ok(!JSON.stringify(r).includes(token))
  })
 }
 test(operation+' timeout no retry',async()=>{
  let calls=0;const c=createPostingClient({timeoutMs:5,fetcher:()=>{calls++;return new Promise(()=>{})}})
  const r=operation==='creator'?await c.creatorInfo({accessToken:token}):operation==='init'?await c.init(initArgs()):await c.status({accessToken:token,publishId:'fixture-publish'})
  assert.equal(r.ok,false);assert.equal(r.error.category,'unknown_ambiguous');assert.equal(r.error.ambiguous,operation==='init');assert.equal(calls,1)
 })
}
for(const [provider,status] of [['PROCESSING_UPLOAD','processing'],['PUBLISH_COMPLETE','published'],['FAILED','failed']]){
 test('status '+provider,async()=>{
  const h=harness({status:provider,fail_reason:'picture_size_check_failed',publicaly_available_post_id:[],raw:token})
  const r=await h.client.status({accessToken:token,publishId:'fixture-publish'})
  assert.equal(r.ok,true);assert.equal(r.data.provider_status,provider);assert.equal(r.data.status,status)
  assert.equal(h.calls[0].request.body,'{"publish_id":"fixture-publish"}')
  if(provider==='FAILED')assert.equal(r.data.error_category,'invalid_media')
 })
}
for(const s of ['UNKNOWN','SEND_TO_USER_INBOX','PROCESSING_DOWNLOAD'])test('status fails closed '+s,async()=>{
 const r=await harness({status:s}).client.status({accessToken:token,publishId:'fixture-publish'})
 assert.equal(r.ok,false);assert.equal(r.error.category,'unknown_ambiguous')
 assert.equal(r.error.provider_status,s==='UNKNOWN'?null:s)
})
test('status preserves int64 public IDs without rounding',async()=>{
 const c=createPostingClient({fetcher:async()=>new Response('{"error":{"code":"ok"},"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7123456789012345678]}}')})
 const r=await c.status({accessToken:token,publishId:'fixture-publish'})
 assert.deepEqual(r.data.provider_post_ids,['7123456789012345678'])
})
test('unknown fail reason is never echoed',async()=>{
 const r=await harness({status:'FAILED',fail_reason:token}).client.status({accessToken:token,publishId:'fixture-publish'})
 assert.equal(r.data.error_category,'unknown_ambiguous');assert.ok(!JSON.stringify(r).includes(token))
})
test('rolling local limits cover all operations and expire; no tokens retained as keys',async()=>{
 let now=0,calls=0
 const c=createPostingClient({now:()=>now,fetcher:async url=>{calls++;return response(url.includes('creator_info')?creator:url.includes('video/init')?{publish_id:'fixture-publish',upload_url:upload}:{status:'PROCESSING_UPLOAD'})}})
 for(const op of ['creator','init','status']){
  const call=()=>op==='creator'?c.creatorInfo({accessToken:token}):op==='init'?c.init(initArgs()):c.status({accessToken:token,publishId:'fixture-publish'})
  for(let i=0;i<POSTING_LIMITS[op];i++)assert.equal((await call()).ok,true)
  const n=calls,r=await call();assert.equal(r.error.category,'rate_limit');assert.equal(calls,n);assert.equal(r.error.retry_after_ms,60000)
 }
 now=60000;assert.equal((await c.creatorInfo({accessToken:token})).ok,true)
})
test('sanitized error taxonomy',()=>{
 for(const [code,expected] of [['duration_check_failed','invalid_media'],['privacy_level_option_mismatch','invalid_options'],['spam_risk_user_banned_from_posting','creator_restriction'],['publish_cancelled','provider_permanent'],['internal','provider_temporary']])assert.equal(classifyPostingError(code),expected)
})
test('no logs, persistence or global fetch; secrets never enter serializable results',async()=>{
 const oldFetch=globalThis.fetch,oldLog=console.log,oldError=console.error;let logs=0
 globalThis.fetch=()=>assert.fail('real network forbidden');console.log=()=>logs++;console.error=()=>logs++
 try{
  const h=harness({publish_id:'fixture-publish',upload_url:upload,open_id:'secret-open-id',client_secret:'synthetic-client-secret'})
  const r=await h.client.init(initArgs())
  const serial=JSON.stringify(r)+inspect(r)
  for(const privateValue of [token,upload,'secret-open-id','synthetic-client-secret'])assert.ok(!serial.includes(privateValue))
  assert.equal(logs,0)
 }finally{globalThis.fetch=oldFetch;console.log=oldLog;console.error=oldError}
})
test('creator projection feeds unchanged Phase A snapshot',()=>{
 assert.deepEqual(Object.keys(creatorSnapshot(creator)).sort(),['privacy_level_options','comment_disabled','duet_disabled','stitch_disabled','max_video_post_duration_sec'].sort())
})
test('bounded malformed response and HTTP200 without code never succeed',async()=>{
 for(const body of ['invalid','{}','x'.repeat(131073)]){
  const c=createPostingClient({fetcher:async()=>new Response(body)})
  assert.equal((await c.creatorInfo({accessToken:token})).ok,false)
 }
})

test('branded content cannot silently select follower-only privacy',()=>{
 const a=initArgs();a.creator.privacy_level_options=['FOLLOWER_OF_CREATOR'];a.options.privacy_level='FOLLOWER_OF_CREATOR';a.options.brand_content_toggle=true;a.consent.commercial_disclosure=true;a.consent.branded_content_policy_confirmed=true
 assert.throws(()=>confirmedPostInfo(a))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {createDraftService} from './draft-service.mjs'
import {sha256} from '../_shared/tiktok-posting/contract.mjs'

const user='11111111-1111-4111-8111-111111111111',creation='22222222-2222-4222-8222-222222222222',connectionId='33333333-3333-4333-8333-333333333333',key='44444444-4444-4444-8444-444444444444'
const identity={userId:user,environment:'sandbox',appId:'a'.repeat(64)}
const bytes=new Uint8Array(128).fill(8),hash=await sha256(bytes)
test('Draft prepare/confirm uses Inbox FILE_UPLOAD, persists one publish id, delivers Inbox, and reopens without a second INIT',async()=>{
 let now=Date.now(),job=null,inits=0
 const c={id:connectionId,user_id:user,environment:'sandbox',app_id:identity.appId,open_id:'fixture',connection_status:'active',scopes:['user.info.basic','video.upload'],token_version:1,access_token_expires_at:new Date(now+3_600_000).toISOString(),refresh_token_expires_at:new Date(now+3_600_000).toISOString()}
 const repository={
  create:async value=>{if(job)return job;job={...value,id:key,status:'awaiting_confirmation',revision:1,init_attempts:0,upload_attempts:0,claim_token:null,claim_expires_at:null};return job},
  claim:async()=>{job={...job,claim_token:key,claim_expires_at:new Date(now+60_000).toISOString(),revision:job.revision+1};return job},
  transition:async(_job,next,extra={})=>{job={...job,status:next,revision:job.revision+1,publish_id:extra.publishId??job.publish_id,provider_status:extra.providerStatus??job.provider_status,error_code:extra.errorCode??job.error_code,init_attempts:job.init_attempts+(next==='initializing'),upload_attempts:job.upload_attempts+(next==='uploading')};return job},
  persistInitDiagnostic:async()=>assert.fail('unexpected INIT diagnostic'),
 }
 const d={now:()=>now,repository,connection:async()=>c,creation:async()=>({id:creation,user_id:user,status:'completed',mode:'smart_tour_gemini_omni',output_video_path:`${user}/${creation}/smart-tour.mp4`}),bytes:async()=>bytes,probe:async()=>({container:'mp4',codec:'h264',width:720,height:1280,duration_ms:8000,durationMs:8000,fps:24,content_sha256:hash,sha256:hash}),access:async()=> 'fixture-access',preview:async()=> 'https://preview.example.test/video.mp4',seal:async v=>JSON.stringify(v),unseal:async v=>JSON.parse(v),latest:async()=>job,byKey:async(_i,k)=>job?.idempotency_key===k?job:null,job:async()=>job,uploadFetch:async(_url,request)=>{if(request.method==='POST'){inits++;const body=JSON.parse(request.body);assert.deepEqual(Object.keys(body),['source_info']);return new Response(JSON.stringify({error:{code:'ok'},data:{publish_id:'inbox-1',upload_url:'https://open-upload.tiktokapis.com/video/?upload_id=x&upload_token=y'}}),{status:200})}assert.equal(request.method,'PUT');assert.equal(request.headers['Content-Type'],'video/mp4');return new Response(null,{status:201})},client:{status:async()=>({ok:true,data:{status:'inbox_delivered',provider_status:'SEND_TO_USER_INBOX'}})}}
 const service=createDraftService(d),prepared=await service.draft_prepare(identity,{creation_id:creation})
 const confirmed=await service.draft_confirm(identity,{creation_id:creation,idempotency_key:key,preparation:prepared.preparation})
 assert.equal(confirmed.job.status,'processing');assert.equal(job.publish_id,'inbox-1');assert.equal(inits,1)
 const reopened=await service.draft_confirm(identity,{creation_id:creation,idempotency_key:key,preparation:prepared.preparation});assert.equal(reopened.job.job_id,key);assert.equal(inits,1)
 now+=61_000;job={...job,claim_expires_at:new Date(now-1).toISOString(),next_poll_at:new Date(now-1).toISOString()};const delivered=await service.draft_status(identity,{job_id:key});assert.equal(delivered.job.status,'inbox_delivered');assert.equal(inits,1)
})

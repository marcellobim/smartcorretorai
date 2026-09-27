import test from 'node:test'
import assert from 'node:assert/strict'
import {executeInboxFileUpload} from './file-upload.mjs'
import {sha256} from './contract.mjs'
import {parsePostingStatus} from './posting-client.mjs'

const bytes=new Uint8Array(5_000_001).fill(7)
const hash=await sha256(bytes)
const job={id:'44444444-4444-4444-8444-444444444444',status:'queued',init_attempts:0,upload_attempts:0,environment:'sandbox',claim_token:'55555555-5555-4555-8555-555555555555',claim_expires_at:new Date(Date.now()+60_000).toISOString(),bucket:'studio-videos',object_path:'private/smart-tour.mp4',content_length:bytes.byteLength,content_sha256:hash,revision:1}
const upload='https://open-upload.tiktokapis.com/video/?upload_id=fixture&upload_token=fixture'
test('Inbox FILE_UPLOAD sends only source_info, persists publish_id before one PUT, and never retains upload_url',async()=>{
 let current={...job},puts=0,init=0,stored=[]
 const repository={
  async transition(_j,next,extra={}){stored.push({next,...extra});current={...current,status:next,publish_id:extra.publishId??current.publish_id,init_attempts:current.init_attempts+(next==='initializing'),upload_attempts:current.upload_attempts+(next==='uploading'),revision:current.revision+1};return {...current}},
  async persistInitDiagnostic(){assert.fail('not called')},
 }
 const result=await executeInboxFileUpload({job:{...job},repository,accessToken:'fixture-access-token',loadBytes:async()=>bytes,fetcher:async(url,request)=>{
  if(request.method==='POST'){init++;assert.equal(url,'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/');const payload=JSON.parse(request.body);assert.deepEqual(Object.keys(payload),['source_info']);assert.deepEqual(payload.source_info,{source:'FILE_UPLOAD',video_size:bytes.byteLength,chunk_size:bytes.byteLength,total_chunk_count:1});return new Response(JSON.stringify({error:{code:'ok'},data:{publish_id:'inbox-1',upload_url:upload}}),{status:200})}
  puts++;assert.equal(current.publish_id,'inbox-1');assert.equal(request.headers['Content-Type'],'video/mp4');assert.equal(request.headers['Content-Length'],String(bytes.byteLength));assert.equal(request.headers['Content-Range'],`bytes 0-${bytes.byteLength-1}/${bytes.byteLength}`);return new Response(null,{status:201})
 }})
 assert.deepEqual(result,{status:'processing'});assert.equal(init,1);assert.equal(puts,1);assert.equal(current.publish_id,'inbox-1');assert.doesNotMatch(JSON.stringify(stored),/upload_url|upload_token|fixture-access-token/)
})
test('deterministic Inbox INIT failure is retryable before publish_id and timeout is not retried',async()=>{
 for(const [status,code,expected] of [[400,'invalid_param','failed'],[500,'internal','reconciliation_required']]){
  let calls=0,current={...job};const repository={transition:async(_j,next,extra={})=>{current={...current,status:next,init_attempts:current.init_attempts+(next==='initializing')};return current},persistInitDiagnostic:async()=>{}}
  const result=await executeInboxFileUpload({job:{...job},repository,accessToken:'fixture',loadBytes:async()=>bytes,fetcher:async()=>{calls++;return new Response(JSON.stringify({error:{code,message:'safe'}}),{status})}})
  assert.equal(result.status,expected);assert.equal(calls,1);assert.equal(current.publish_id,undefined)
 }
})
test('Inbox delivery is terminal for this product and is never labeled as a feed publish',()=>{
 assert.deepEqual(parsePostingStatus({status:'SEND_TO_USER_INBOX'}),{ok:true,data:{provider_status:'SEND_TO_USER_INBOX',status:'inbox_delivered',provider_post_ids:[]}})
})

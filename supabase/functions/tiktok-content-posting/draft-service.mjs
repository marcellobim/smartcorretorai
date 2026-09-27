import {fingerprint,prepareJob,VIDEO_IMOBILIARIO_FILE,VIDEO_IMOBILIARIO_MODE} from '../_shared/tiktok-posting/contract.mjs'
import {executeInboxFileUpload} from '../_shared/tiktok-posting/file-upload.mjs'
import {isRecoveryCandidate,publicJob} from './service.mjs'

const terminal=new Set(['inbox_delivered','published','failed','blocked'])
const draftOptions=Object.freeze({title:'',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false,is_aigc:true})
const draftCreator=duration=>({privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:Math.max(1,Math.ceil(duration/1000))})

// This intentionally uses a separate action surface.  Direct Post keeps its
// creator_info/options contract in service.mjs; Inbox never reads or sends it.
export function createDraftService(d){
 const now=d.now||Date.now
 const owned=(job,i)=>job&&job.user_id===i.userId&&job.environment==='sandbox'&&job.app_id===i.appId
 const connection=async i=>{const c=await d.connection(i);if(!c||!owned(c,i)||c.connection_status!=='active'||!c.scopes.includes('user.info.basic')||!c.scopes.includes('video.upload')||c.scopes.some(s=>!['user.info.basic','video.upload','video.publish'].includes(s))||Date.parse(c.access_token_expires_at)<=now()+300000||Date.parse(c.refresh_token_expires_at)<=now())throw Error('reauthorization_required');return c}
 const creation=async(i,id)=>{const c=await d.creation(id,i.userId);if(!c||c.id!==id||c.user_id!==i.userId||c.status!=='completed'||c.mode!==VIDEO_IMOBILIARIO_MODE||c.output_video_path!==i.userId+'/'+id+'/'+VIDEO_IMOBILIARIO_FILE)throw Error('creation_unavailable');return c}
 const material=async(i,id)=>{const cr=await creation(i,id),c=await connection(i),bytes=await d.bytes(cr.output_video_path),probe=await d.probe(bytes),token=await d.access(c,i);return {cr,c,bytes,probe,token,checked:new Date(now()).toISOString()}}
 return {
  async draft_prepare(i,input){
   await creation(i,input.creation_id);const existing=await d.latest(i,input.creation_id)
   if(isRecoveryCandidate(existing)){if(!owned(existing,i))throw Error('creation_unavailable');return {job:publicJob(existing)}}
   const m=await material(i,input.creation_id);const preview_url=await d.preview(m.cr.output_video_path)
   return {product_type:'video_imobiliario',creation_id:input.creation_id,delivery:'inbox',preparation:await d.seal({user:i.userId,creation:input.creation_id,connection:m.c.id,version:m.c.token_version,hash:m.probe.content_sha256,expires:now()+300000}),preview_url,account:{display_name:null}}
  },
  async draft_confirm(i,input){
   await creation(i,input.creation_id);const existing=await d.byKey(i,input.idempotency_key)
   if(existing){if(!owned(existing,i)||existing.creation_id!==input.creation_id)throw Error('idempotency_conflict');return {job:publicJob(existing)}}
   const latest=await d.latest(i,input.creation_id);if(isRecoveryCandidate(latest)){if(!owned(latest,i))throw Error('creation_unavailable');return {job:publicJob(latest)}}
   const binding=await d.unseal(input.preparation);if(binding.user!==i.userId||binding.creation!==input.creation_id||binding.expires<=now())throw Error('preparation_expired')
   const m=await material(i,input.creation_id);if(binding.connection!==m.c.id||binding.version!==m.c.token_version||binding.hash!==m.probe.content_sha256)throw Error('media_changed')
   const args=await prepareJob({input:{creation_id:input.creation_id,connection_id:m.c.id,idempotency_key:input.idempotency_key,confirmed_options:draftOptions},identity:i,readCreation:async()=>m.cr,readConnection:async()=>m.c,inspectObject:async()=>({contentType:'video/mp4',size:m.bytes.byteLength,etag:null,version:null}),probe:async()=>({...m.probe,durationMs:m.probe.duration_ms,size:m.bytes.byteLength,sha256:m.probe.content_sha256,etag:null,version:null}),creator:draftCreator(m.probe.duration_ms),creatorCheckedAt:m.checked,now:now()})
   let job;try{job=await d.repository.create(args)}catch{const raced=await d.latest(i,input.creation_id);if(isRecoveryCandidate(raced)&&owned(raced,i))return {job:publicJob(raced)};throw Error('posting_unavailable')}
   if(job.status!=='awaiting_confirmation')return {job:publicJob(job)}
   try{job=await d.repository.claim(job.id,job.revision)}catch{return {job:publicJob(await d.job(i,job.id)||job)}}
   job=await d.repository.transition(job,'queued')
   try{await executeInboxFileUpload({job,repository:d.repository,accessToken:m.token,loadBytes:async()=>m.bytes,fetcher:d.uploadFetch,now:now(),initTelemetry:d.initTelemetry})}catch{}
   return {job:publicJob(await d.job(i,job.id))}
  },
  async draft_resolve_pending(i,input){await creation(i,input.creation_id);const job=await d.byKey(i,input.idempotency_key);if(!job)return {pending:true};if(!owned(job,i)||job.creation_id!==input.creation_id)throw Error('creation_unavailable');return {job:publicJob(job)}},
  async draft_status(i,input){let job=await d.job(i,input.job_id);if(!owned(job,i))throw Error('creation_unavailable');if(terminal.has(job.status)||Date.parse(job.claim_expires_at)>now()||Date.parse(job.next_poll_at)>now())return {job:publicJob(job)};try{job=await d.repository.claim(job.id,job.revision)}catch{return {job:publicJob(await d.job(i,job.id)||job)};};if(!job.publish_id)return {job:publicJob(job)};const c=await connection(i);const result=await d.client.status({accessToken:await d.access(c,i),publishId:job.publish_id});if(!result.ok)return {job:publicJob(job)};job=await d.repository.transition(job,result.data.status,{providerStatus:result.data.provider_status,errorCode:result.data.status==='failed'?'provider_failed':null});return {job:publicJob(job)}}
 }
}

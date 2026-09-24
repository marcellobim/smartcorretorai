import {fingerprint,prepareJob} from '../_shared/tiktok-posting/contract.mjs'
import {creatorSnapshot,confirmedPostInfo} from '../_shared/tiktok-posting/posting-options.mjs'
import {executeFileUpload} from '../_shared/tiktok-posting/file-upload.mjs'
const terminal=new Set(['published','failed','blocked'])
export const publicJob=j=>({job_id:j.id,status:j.status,provider_status:j.provider_status||null})
export function createPostingService(d){
 const now=d.now||Date.now
 const connection=async identity=>{
  const c=await d.connection(identity)
  if(!c||c.user_id!==identity.userId||c.environment!=='sandbox'||c.app_id!==identity.appId||c.connection_status!=='active'||!c.scopes.includes('user.info.basic')||!c.scopes.includes('video.publish')||c.scopes.some(s=>!['user.info.basic','video.publish'].includes(s))||!Number.isFinite(Date.parse(c.access_token_expires_at))||!Number.isFinite(Date.parse(c.refresh_token_expires_at))||Date.parse(c.access_token_expires_at)<=now()+300000||Date.parse(c.refresh_token_expires_at)<=now())throw Error('reauthorization_required')
  return c
 }
 const creation=async (identity,id)=>{
  const c=await d.creation(id,identity.userId)
  if(!c||c.id!==id||c.user_id!==identity.userId||c.status!=='completed'||c.mode!=='dynamic_reel'||c.output_video_path!==identity.userId+'/'+id+'/video.mp4')throw Error('creation_unavailable')
  return c
 }
 const owned=(j,i)=>j&&j.user_id===i.userId&&j.environment==='sandbox'&&j.app_id===i.appId
 const material=async (identity,id)=>{
  const cr=await creation(identity,id),c=await connection(identity)
  const bytes=await d.bytes(cr.output_video_path)
  const probe=await d.probe(bytes)
  const token=await d.access(c,identity)
  const result=await d.client.creatorInfo({accessToken:token})
  if(!result.ok)throw Error(result.error.category==='rate_limit'?'rate_limit':result.error.category==='creator_restriction'?'creator_restriction':'reauthorization_required')
  const creator=result.data
  if(probe.duration_ms>creator.max_video_post_duration_sec*1000)throw Error('invalid_media')
  return {cr,c,bytes,probe,token,creator,checked:new Date(now()).toISOString()}
 }
 return {
  async prepare(i,input){
   await creation(i,input.creation_id)
   const existing=await d.latest(i,input.creation_id)
   if(existing){if(!owned(existing,i))throw Error('creation_unavailable');return {job:publicJob(existing)}}
   const m=await material(i,input.creation_id)
   const preparation=await d.seal({user:i.userId,creation:input.creation_id,connection:m.c.id,version:m.c.token_version,hash:m.probe.content_sha256,expires:now()+300000})
   return {preparation,account:{display_name:m.creator.creator_nickname},creator:creatorSnapshot(m.creator),media:{width:m.probe.width,height:m.probe.height,duration_ms:m.probe.duration_ms},preview_creation_id:input.creation_id}
  },
  async confirm(i,input){
   await creation(i,input.creation_id)
   const existing=await d.byKey(i,input.idempotency_key)
   if(existing){
    if(!owned(existing,i)||existing.creation_id!==input.creation_id||await fingerprint(existing.confirmed_options)!==await fingerprint(input.options))throw Error('idempotency_conflict')
    return {job:publicJob(existing)}
   }
   const latest=await d.latest(i,input.creation_id)
   if(latest){if(!owned(latest,i))throw Error('creation_unavailable');return {job:publicJob(latest)}}
   const binding=await d.unseal(input.preparation)
   if(binding.user!==i.userId||binding.creation!==input.creation_id||binding.expires<=now())throw Error('preparation_expired')
   const m=await material(i,input.creation_id)
   if(binding.connection!==m.c.id||binding.version!==m.c.token_version||binding.hash!==m.probe.content_sha256)throw Error('media_changed')
   const options=confirmedPostInfo({creator:m.creator,probe:m.probe,options:input.options,consent:input.consent})
   const args=await prepareJob({input:{creation_id:input.creation_id,connection_id:m.c.id,idempotency_key:input.idempotency_key,confirmed_options:options},identity:i,
    readCreation:async()=>m.cr,readConnection:async()=>m.c,
    inspectObject:async()=>({contentType:'video/mp4',size:m.bytes.byteLength,etag:null,version:null}),
    probe:async()=>({...m.probe,durationMs:m.probe.duration_ms,size:m.bytes.byteLength,sha256:m.probe.content_sha256,etag:null,version:null}),
    creator:creatorSnapshot(m.creator),creatorCheckedAt:m.checked,now:now()})
   let job
   try{job=await d.repository.create(args)}catch{
    const raced=await d.latest(i,input.creation_id);if(raced&&owned(raced,i))return {job:publicJob(raced)}
    throw Error('posting_unavailable')
   }
   if(job.status!=='awaiting_confirmation')return {job:publicJob(job)}
   try{job=await d.repository.claim(job.id,job.revision)}catch{return {job:publicJob(await d.job(i,job.id)||job)}}
   job=await d.repository.transition(job,'queued')
   try{
    await executeFileUpload({job,repository:d.repository,accessToken:m.token,loadBytes:async()=>m.bytes,fetcher:d.uploadFetch,now:now()})
   }catch{
    // Never retry init after an unknown response or failed persistence acknowledgement.
    const current=await d.job(i,job.id)
    return {job:current?publicJob(current):{job_id:job.id,status:'reconciliation_required',provider_status:null}}
   }
   return {job:publicJob(await d.job(i,job.id))}
  },
  async status(i,input){
   let job=await d.job(i,input.job_id)
   if(!owned(job,i))throw Error('creation_unavailable')
   if(terminal.has(job.status))return {job:publicJob(job)}
   if(Date.parse(job.claim_expires_at)>now()||Date.parse(job.next_poll_at)>now())return {job:publicJob(job)}
   try{job=await d.repository.claim(job.id,job.revision)}catch{return {job:publicJob(await d.job(i,job.id)||job)}}
   if(['awaiting_confirmation','queued'].includes(job.status)){
    job=await d.repository.transition(job,'blocked',{errorCode:'preflight_failed'})
    return {job:publicJob(job)}
   }
   if(!job.publish_id)return {job:publicJob(job)}
   const c=await connection(i)
   if(c.id!==job.connection_id)throw Error('reauthorization_required')
   const result=await d.client.status({accessToken:await d.access(c,i),publishId:job.publish_id})
   if(!result.ok){
    if(result.error.category==='rate_limit')throw Error('rate_limit')
    if(job.status==='processing')job=await d.repository.transition(job,'reconciliation_required',{errorCode:'provider_failed'})
    return {job:publicJob(job)}
   }
   job=await d.repository.transition(job,result.data.status,{providerStatus:result.data.provider_status,errorCode:result.data.status==='failed'?'provider_failed':null})
   return {job:publicJob(job)}
  }
 }
}

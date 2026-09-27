import {fingerprint,prepareJob,VIDEO_IMOBILIARIO_FILE,VIDEO_IMOBILIARIO_MODE} from '../_shared/tiktok-posting/contract.mjs'
import {creatorSnapshot,confirmedPostInfo} from '../_shared/tiktok-posting/posting-options.mjs'
import {executePullFromUrl} from '../_shared/tiktok-posting/pull-from-url.mjs'
const terminal=new Set(['published','failed','blocked'])
// A failed INIT with no provider identifier was explicitly rejected.  Every
// other non-terminal state is uncertain and must be recovered rather than
// retried automatically.
export const isRecoveryCandidate=j=>Boolean(j)&&(!terminal.has(j.status)||Boolean(j.publish_id))
export const publicJob=j=>({job_id:j.id,creation_id:j.creation_id,product_type:'video_imobiliario',status:j.status,provider_status:j.provider_status||null,
 ...(j.status==='failed'&&!j.publish_id&&j.error_code==='init_provider_rejected'?{retryable:true}:{}),
 ...(j.failure_stage==='init'?{failure_stage:'init',provider_http_status:j.provider_http_status||null,provider_error_code:j.provider_error_code||null,provider_error_message:j.provider_error_message||null,provider_log_id:j.provider_log_id||null}:{})})
export function createPostingService(d){
 const now=d.now||Date.now
 const connection=async identity=>{
  const c=await d.connection(identity)
  if(!c||c.user_id!==identity.userId||c.environment!=='sandbox'||c.app_id!==identity.appId||c.connection_status!=='active'||!c.scopes.includes('user.info.basic')||!c.scopes.includes('video.publish')||c.scopes.some(s=>!['user.info.basic','video.publish'].includes(s))||!Number.isFinite(Date.parse(c.access_token_expires_at))||!Number.isFinite(Date.parse(c.refresh_token_expires_at))||Date.parse(c.access_token_expires_at)<=now()+300000||Date.parse(c.refresh_token_expires_at)<=now())throw Error('reauthorization_required')
  return c
 }
 const creation=async (identity,id)=>{
  const c=await d.creation(id,identity.userId)
  if(!c||c.id!==id||c.user_id!==identity.userId||c.status!=='completed'||c.mode!==VIDEO_IMOBILIARIO_MODE||c.output_video_path!==identity.userId+'/'+id+'/'+VIDEO_IMOBILIARIO_FILE)throw Error('creation_unavailable')
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
   try{await creation(i,input.creation_id)}catch(error){error.prepareStage='creation';throw error}
   let existing
   try{existing=await d.latest(i,input.creation_id)}catch(error){error.prepareStage='existing_job';throw error}
   if(isRecoveryCandidate(existing)){if(!owned(existing,i)){const error=Error('creation_unavailable');error.prepareStage='existing_job';throw error}return {job:publicJob(existing)}}
   let m
   try{m=await material(i,input.creation_id)}catch(error){error.prepareStage='pre_creator_preflight';throw error}
   let previewUrl
   try{previewUrl=await d.preview(m.cr.output_video_path)}catch(error){error.prepareStage='preview';throw error}
   const preparation=await d.seal({user:i.userId,creation:input.creation_id,connection:m.c.id,version:m.c.token_version,hash:m.probe.content_sha256,expires:now()+300000})
   return {
    product_type:'video_imobiliario',creation_id:input.creation_id,is_aigc:true,privacy_level:null,
    preparation,preview_url:previewUrl,account:{display_name:m.creator.creator_nickname},
    creator:{creator_nickname:m.creator.creator_nickname,creator_username:m.creator.creator_username,...creatorSnapshot(m.creator)},
    media:{width:m.probe.width,height:m.probe.height,duration_ms:m.probe.duration_ms},
   }
  },
  async confirm(i,input){
   await creation(i,input.creation_id)
   const requestedOptions={...input.options,is_aigc:true}
   const existing=await d.byKey(i,input.idempotency_key)
   if(existing){
    if(!owned(existing,i)||existing.creation_id!==input.creation_id||await fingerprint(existing.confirmed_options)!==await fingerprint(requestedOptions))throw Error('idempotency_conflict')
    return {job:publicJob(existing)}
   }
   const latest=await d.latest(i,input.creation_id)
   if(isRecoveryCandidate(latest)){if(!owned(latest,i))throw Error('creation_unavailable');return {job:publicJob(latest)}}
   const binding=await d.unseal(input.preparation)
   if(binding.user!==i.userId||binding.creation!==input.creation_id||binding.expires<=now())throw Error('preparation_expired')
   const m=await material(i,input.creation_id)
   if(binding.connection!==m.c.id||binding.version!==m.c.token_version||binding.hash!==m.probe.content_sha256)throw Error('media_changed')
   // AIGC is a fixed server-side property of this Video Imobiliario contract.
   const options=confirmedPostInfo({creator:m.creator,probe:m.probe,options:requestedOptions,consent:input.consent})
   const args=await prepareJob({input:{creation_id:input.creation_id,connection_id:m.c.id,idempotency_key:input.idempotency_key,confirmed_options:options},identity:i,
    readCreation:async()=>m.cr,readConnection:async()=>m.c,
    inspectObject:async()=>({contentType:'video/mp4',size:m.bytes.byteLength,etag:null,version:null}),
    probe:async()=>({...m.probe,durationMs:m.probe.duration_ms,size:m.bytes.byteLength,sha256:m.probe.content_sha256,etag:null,version:null}),
    creator:creatorSnapshot(m.creator),creatorCheckedAt:m.checked,now:now()})
   let job
   try{job=await d.repository.create(args)}catch{
    const raced=await d.latest(i,input.creation_id);if(isRecoveryCandidate(raced)&&owned(raced,i))return {job:publicJob(raced)}
    throw Error('posting_unavailable')
   }
   if(job.status!=='awaiting_confirmation')return {job:publicJob(job)}
   try{job=await d.repository.claim(job.id,job.revision)}catch{return {job:publicJob(await d.job(i,job.id)||job)}}
   job=await d.repository.transition(job,'queued')
   try{
    await executePullFromUrl({job,repository:d.repository,accessToken:m.token,client:d.client,pullUrl:d.pullUrl,now:now()})
   }catch{
    // Never retry init after an unknown response or failed persistence acknowledgement.
    const current=await d.job(i,job.id)
    return {job:current?publicJob(current):{job_id:job.id,creation_id:input.creation_id,product_type:'video_imobiliario',status:'reconciliation_required',provider_status:null}}
   }
   return {job:publicJob(await d.job(i,job.id))}
  },
  async resolve_pending(i,input){
   await creation(i,input.creation_id)
   const job=await d.byKey(i,input.idempotency_key)
   if(!job)return {pending:true}
   if(!owned(job,i)||job.creation_id!==input.creation_id)throw Error('creation_unavailable')
   return {job:publicJob(job)}
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
  },
  async close_irrecoverable(i,input){
   const job=await d.job(i,input.job_id)
   if(!owned(job,i))throw Error('creation_unavailable')
   const closed=await d.repository.closeIrrecoverable(job,i)
   return {job:publicJob(closed)}
  }
 }
}

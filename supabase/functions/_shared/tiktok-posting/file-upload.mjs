import {MAX_BYTES,fail,sha256,validateOptions} from './contract.mjs'
const INIT='https://open.tiktokapis.com/v2/post/publish/video/init/'
const publishId=value=>typeof value==='string'&&/^[A-Za-z0-9_.~:-]{1,64}$/.test(value)
const providerCode=value=>typeof value==='string'&&/^[a-z0-9_.-]{1,64}$/i.test(value)?value:null
const deterministicCodes=new Set(['access_token_invalid','access_token_expired','scope_not_authorized','video_publish_not_authorized','user_not_authorized','privacy_level_not_supported','creator_not_eligible','duration_exceeds_limit','invalid_video','invalid_video_format','invalid_parameter','invalid_post_info','rate_limit_exceeded'])
const telemetry=(sink,event,detail={})=>{try{sink?.({event:'tiktok_direct_post_init',stage:event,...detail})}catch{}}
class InitFailure extends Error { constructor(code,ambiguous){super(code);this.code=code;this.ambiguous=ambiguous} }
const initFailure=(code,ambiguous)=>{throw new InitFailure(code,ambiguous)}
const deterministicProviderFailure=code=>deterministicCodes.has(code)
export function singleChunk(size) {
 if(!Number.isSafeInteger(size)||size<=0||size>MAX_BYTES) fail('posting_media_invalid')
 return {source:'FILE_UPLOAD',video_size:size,chunk_size:size,total_chunk_count:1}
}
export function validateUploadUrl(value) {
 let u
 try { u=new URL(value) } catch { fail('posting_upload_destination_invalid') }
 // Exact documented hosts only; no wildcard, userinfo, port, redirect or client-supplied destination.
 if(typeof value!=='string'||value.length>256||u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
 !['open-upload.tiktokapis.com','upload.us.tiktokapis.com'].includes(u.hostname)||
 !['/video/','/upload/'].includes(u.pathname)||
 !u.searchParams.get('upload_id')||!u.searchParams.get('upload_token')) fail('posting_upload_destination_invalid')
 return value
}
export async function initUpload({job,accessToken,fetcher,initTelemetry,initTimeoutMs=20000}) {
 const options=validateOptions(job.confirmed_options,job.creator_info_snapshot,job.duration_ms)
 const body=JSON.stringify({post_info:options,source_info:singleChunk(job.content_length)})
 if(!accessToken||typeof fetcher!=='function') fail('posting_not_ready')
 const controller=new AbortController();let timedOut=false
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},initTimeoutMs)
 let r
 telemetry(initTelemetry,'init_request_started')
 try { r=await fetcher(INIT,{method:'POST',redirect:'error',signal:controller.signal,
  headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json; charset=UTF-8'},body})
 } catch(error) {
  clearTimeout(timer)
  if(timedOut){telemetry(initTelemetry,'timeout');initFailure('init_timeout',true)}
  if(error?.name==='AbortError'){telemetry(initTelemetry,'abort');initFailure('init_abort',true)}
  telemetry(initTelemetry,'transport_error');initFailure('init_transport_error',true)
 }
 clearTimeout(timer)
 let payload
 try { payload=await r.json() } catch {telemetry(initTelemetry,'invalid_json',{http_status:r.status});initFailure('init_invalid_json',true)}
 const code=providerCode(payload?.error?.code)
 if(code&&code!=='ok')telemetry(initTelemetry,'tiktok_error_code',{provider_code:code,http_status:r.status})
 if(!r.ok){
  telemetry(initTelemetry,'http_non_2xx',{http_status:r.status})
  const safe=deterministicProviderFailure(code)||([400,401,403,422].includes(r.status)&&code!==null)
  initFailure(safe?'init_provider_rejected':'init_http_ambiguous',!safe)
 }
 if(code!=='ok')initFailure(deterministicProviderFailure(code)?'init_provider_rejected':'init_provider_ambiguous',!deterministicProviderFailure(code))
 const id=payload.data?.publish_id
 if(!publishId(id)){telemetry(initTelemetry,'missing_publish_id',{http_status:r.status});initFailure('init_missing_publish_id',true)}
 let uploadUrl=null
 try { uploadUrl=validateUploadUrl(payload.data?.upload_url) } catch {telemetry(initTelemetry,'invalid_upload_url',{http_status:r.status})}
 if(!uploadUrl)return {publishId:id,uploadUrl:null,initErrorCode:'init_invalid_upload_url'}
 telemetry(initTelemetry,'success',{http_status:r.status})
 return {publishId:id,uploadUrl}
}
export async function putUpload({uploadUrl,bytes,job,fetcher}) {
 validateUploadUrl(uploadUrl)
 if(!(bytes instanceof Uint8Array)||bytes.byteLength!==job.content_length||await sha256(bytes)!==job.content_sha256) fail('posting_media_changed')
 try {
  const size=bytes.byteLength
  const r=await fetcher(uploadUrl,{method:'PUT',redirect:'error',signal:AbortSignal.timeout(60000),
   headers:{'Content-Type':'video/mp4','Content-Length':String(size),'Content-Range':'bytes 0-'+(size-1)+'/'+size},body:bytes})
  // Entire single chunk accepted. 206 is not completion of this one-chunk contract.
  if(r.status!==201) fail('posting_upload_uncertain')
  await r.body?.cancel()
 } catch { fail('posting_upload_uncertain') }
}
export async function executeFileUpload({job,repository,accessToken,loadBytes,fetcher,now=Date.now(),initTelemetry,initTimeoutMs=20000}) {
 // repository must apply server-side CAS; no fallback and no automatic retry.
 if(job.status!=='queued'||job.init_attempts!==0||job.environment!=='sandbox'||
 !job.claim_token||!accessToken||!Number.isFinite(Date.parse(job.claim_expires_at))||Date.parse(job.claim_expires_at)<=now) fail('posting_not_ready')
 let bytes
 try {
  bytes=await loadBytes({bucket:job.bucket,objectPath:job.object_path,etag:job.object_etag,version:job.object_version})
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==job.content_length||await sha256(bytes)!==job.content_sha256) fail('posting_media_changed')
  validateOptions(job.confirmed_options,job.creator_info_snapshot,job.duration_ms)
  const checked=Date.parse(job.creator_info_checked_at)
  if(!Number.isFinite(checked)||checked>now||now-checked>300000) fail('posting_consent_stale')
 } catch {
  await repository.transition(job,'blocked',{errorCode:'preflight_failed'})
  return {status:'blocked'}
 }
 job=await repository.transition(job,'initializing')
 let result
 try { result=await initUpload({job,accessToken,fetcher,initTelemetry,initTimeoutMs}) }
 catch(error) {
  const failure=error instanceof InitFailure?error:new InitFailure('init_transport_error',true)
  const status=failure.ambiguous?'reconciliation_required':'failed'
  await repository.transition(job,status,{errorCode:failure.code})
  return {status}
 }
 // This write must ACK before any PUT. uploadUrl is never passed to repository.
 job=await repository.transition(job,'uploading',{publishId:result.publishId})
 if(!result.uploadUrl) {
  await repository.transition(job,'reconciliation_required',{errorCode:result.initErrorCode})
  return {status:'reconciliation_required'}
 }
 try { await putUpload({uploadUrl:result.uploadUrl,bytes,job,fetcher}) }
 catch {
  await repository.transition(job,'reconciliation_required',{errorCode:'upload_uncertain'})
  return {status:'reconciliation_required'}
 }
 await repository.transition(job,'processing')
 return {status:'processing'} // no URL, token or provider payload returned to UI
}

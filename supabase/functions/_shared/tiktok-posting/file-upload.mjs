import {MAX_BYTES,fail,sha256,validateOptions} from './contract.mjs'
const INIT='https://open.tiktokapis.com/v2/post/publish/video/init/'
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
export async function initUpload({job,accessToken,fetcher}) {
 const options=validateOptions(job.confirmed_options,job.creator_info_snapshot,job.duration_ms)
 const body=JSON.stringify({post_info:options,source_info:singleChunk(job.content_length)})
 if(!accessToken||typeof fetcher!=='function') fail('posting_not_ready')
 try {
  const r=await fetcher(INIT,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json; charset=UTF-8'},body})
  const payload=await r.json()
  if(!r.ok||payload?.error?.code!=='ok') fail('posting_init_uncertain')
  const id=payload.data?.publish_id
  if(typeof id!=='string'||!/^[A-Za-z0-9_.~:-]{1,64}$/.test(id)) fail('posting_init_uncertain')
  // Retain id even when URL validation fails, so reconciliation can use it.
  let uploadUrl=null
  try { uploadUrl=validateUploadUrl(payload.data?.upload_url) } catch {}
  return {publishId:id,uploadUrl}
 } catch { fail('posting_init_uncertain') }
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
export async function executeFileUpload({job,repository,accessToken,loadBytes,fetcher,now=Date.now()}) {
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
 try { result=await initUpload({job,accessToken,fetcher}) }
 catch {
  await repository.transition(job,'reconciliation_required',{errorCode:'init_uncertain'})
  return {status:'reconciliation_required'}
 }
 // This write must ACK before any PUT. uploadUrl is never passed to repository.
 job=await repository.transition(job,'uploading',{publishId:result.publishId})
 if(!result.uploadUrl) {
  await repository.transition(job,'reconciliation_required',{errorCode:'init_uncertain'})
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
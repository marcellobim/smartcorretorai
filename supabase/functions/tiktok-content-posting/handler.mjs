import { authorizeControl, fail, fingerprint } from '../_shared/tiktok-posting/contract.mjs'
import { isUuid, PUBLISHABLE_PRODUCTS } from '../_shared/tiktok-posting/creation-resolver.mjs'
import { confirmedPostInfo, creatorSnapshot } from '../_shared/tiktok-posting/posting-options.mjs'
import { putUpload } from '../_shared/tiktok-posting/file-upload.mjs'

const labels = Object.freeze({
 awaiting_confirmation:'Publicando', queued:'Publicando', initializing:'Publicando',
 uploading:'Publicando', processing:'Processando', published:'Publicado',
 failed:'Falhou', blocked:'Falhou', reconciliation_required:'Verificação necessária',
})
const terminal = new Set(['published','failed','blocked'])
const keys = (value, allowed) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) ||
     Object.keys(value).some(k => !allowed.includes(k)) ||
     allowed.some(k => !Object.hasOwn(value,k))) fail('posting_input_invalid')
}
export function parsePostingInput(input) {
 const common = ['action','product_type','creation_id']
 if (input?.action === 'status') {
  keys(input,['action','job_id'])
  if (!isUuid(input.job_id)) fail('posting_input_invalid')
 } else {
  if (!['prepare','confirm'].includes(input?.action)) fail('posting_input_invalid')
  keys(input,input.action === 'prepare' ? common : [...common,'idempotency_key','options','consent'])
  if (!PUBLISHABLE_PRODUCTS.includes(input.product_type) || !isUuid(input.creation_id) ||
      input.action === 'confirm' && !isUuid(input.idempotency_key)) fail('posting_input_invalid')
  if (input.action === 'confirm') {
   keys(input.options,['title','privacy_level','disable_comment','disable_duet','disable_stitch','brand_content_toggle','brand_organic_toggle'])
   keys(input.consent,['confirmed','commercial_disclosure','music_usage_confirmed','branded_content_policy_confirmed'])
  }
 }
 return input
}
const sanitizedJob = job => ({
 job_id:job.id, product_type:job.product, creation_id:job.creation_id,
 status:job.status, status_label:labels[job.status] || 'Verificação necessária',
 error_code: ['preflight_failed','init_uncertain','upload_uncertain','lease_expired','provider_failed','persistence_uncertain'].includes(job.error_code) ? job.error_code : null,
})
async function boundedInput(request) {
 if (Number(request.headers.get('content-length')) > 16384) fail('posting_input_invalid')
 const reader = request.body?.getReader()
 if (!reader) fail('posting_input_invalid')
 let text = '', size = 0
 const decoder = new TextDecoder()
 try {
  while (true) {
   const {value,done} = await reader.read()
   if (done) break
   size += value.byteLength
   if (size > 16384) fail('posting_input_invalid')
   text += decoder.decode(value,{stream:true})
  }
  return JSON.parse(text + decoder.decode())
 } finally { await reader.cancel().catch(() => {}) }
}
export function createContentPostingHandler(deps) {
 const now = deps.now || Date.now
 const reply = (request, status, body) => new Response(body === null ? null : JSON.stringify(body), {
  status, headers: {
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   ...(request.headers.get('origin') === deps.frontendOrigin ? {'Access-Control-Allow-Origin':deps.frontendOrigin} : {}),
  },
 })
 async function ownedJob(id,identity) {
  const job = await deps.readJob(id,identity)
  if (!job || job.user_id !== identity.userId || job.environment !== identity.environment ||
      job.app_id !== identity.appId) fail('posting_job_unavailable')
  return job
 }
 async function connectionFor(identity,connectionId) {
  const connection = await deps.readConnection(identity,connectionId)
  if (!connection || connection.user_id !== identity.userId || connection.environment !== 'sandbox' ||
      connection.app_id !== identity.appId || connection.connection_status !== 'active' ||
      connectionId && connection.id !== connectionId ||
      !['user.info.basic','video.publish'].every(scope => connection.scopes?.includes(scope)) ||
      connection.scopes.some(scope => !['user.info.basic','video.publish'].includes(scope)) ||
      !connection.open_id || !(Date.parse(connection.refresh_token_expires_at) > now()) ||
      !(Date.parse(connection.access_token_expires_at) > now() + 180000)) fail('posting_reauthorization_required')
  return connection
 }
 async function handleStatus(input,identity) {
  let job = await ownedJob(input.job_id,identity)
  if (terminal.has(job.status)) return sanitizedJob(job)
  if (Date.parse(job.claim_expires_at) > now()) return sanitizedJob(job)
  const recoverLease = ['initializing','uploading'].includes(job.status)
  if (!recoverLease && (!job.publish_id || !['processing','reconciliation_required'].includes(job.status) ||
      Date.parse(job.next_poll_at) > now())) return sanitizedJob(job)
  const connection = job.publish_id ? await connectionFor(identity,job.connection_id) : null
  try { job = await deps.repository.claim(job.id,job.revision) }
  catch { return sanitizedJob(await ownedJob(job.id,identity)) }
  if (!job.publish_id) return sanitizedJob(job)
  let accessToken
  try {
   accessToken = await deps.decrypt(connection,identity)
   const result = await deps.client.status({accessToken,publishId:job.publish_id})
   if (!result.ok) {
    if (job.status === 'processing') job = await deps.repository.transition(job,'reconciliation_required',{errorCode:'persistence_uncertain'})
    return sanitizedJob(job)
   }
   job = await deps.repository.transition(job,result.data.status,{
    providerStatus:result.data.provider_status,
    errorCode:result.data.status === 'failed' ? 'provider_failed' : null,
   })
   return sanitizedJob(job)
  } finally { accessToken = null }
 }
 return async request => {
  if (request.method === 'OPTIONS') return reply(request,204,null)
  if (request.method !== 'POST') return reply(request,405,{error:'method_not_allowed'})
  let durableJob = null
  try {
   const jwt = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '')?.[1]
   const identity = await authorizeControl({jwt,auth:deps.auth,admin:deps.admin,environment:deps.environment,appId:deps.appId})
   const input = parsePostingInput(await boundedInput(request))
   if (input.action === 'status') return reply(request,200,await handleStatus(input,identity))
   const creation = await deps.resolveTikTokPublishableCreation(input.product_type,input.creation_id,identity.userId)
   const connection = await connectionFor(identity)
   let accessToken
   try {
    accessToken = await deps.decrypt(connection,identity)
    const creatorResult = await deps.client.creatorInfo({accessToken})
    if (!creatorResult.ok) fail(creatorResult.error.category === 'auth_scope' ? 'posting_reauthorization_required' : 'posting_creator_unavailable')
    const creator = creatorResult.data
    const checkedAt = new Date(now()).toISOString()
    const bytes = await deps.loadBytes(creation)
    const probe = await deps.probe(bytes,creator.max_video_post_duration_sec)
    if (probe.content_length !== creation.media.size) fail('posting_media_changed')
    if (input.action === 'prepare') {
     return reply(request,200,{
      product_type:creation.product,creation_id:creation.creationId,
      creator, media:{content_type:'video/mp4',size:probe.content_length,width:probe.width,height:probe.height,duration_ms:probe.duration_ms},
      preview_url:await deps.preview(creation),preview_expires_in:300,
      privacy_level:null,is_aigc:true,
     })
    }
    const options = confirmedPostInfo({creator,probe,options:{...input.options,is_aigc:true},consent:input.consent})
    const snapshot = {
     user_id:identity.userId,connection_id:connection.id,environment:identity.environment,app_id:identity.appId,connection_open_id:connection.open_id,
     creation_id:creation.creationId,product:creation.product,bucket:creation.bucket,object_path:creation.objectPath,
     object_etag:creation.media.etag ?? null,object_version:creation.media.version ?? null,
     content_sha256:probe.content_sha256,content_type:'video/mp4',content_length:probe.content_length,
     width:probe.width,height:probe.height,duration_ms:probe.duration_ms,codec:probe.codec,
     idempotency_key:input.idempotency_key,confirmed_options:options,
     creator_info_snapshot:creatorSnapshot(creator),creator_info_checked_at:checkedAt,
     confirmed_at:new Date(now()).toISOString(),consent_version:'tiktok-commercial-v1',
    }
    snapshot.request_fingerprint = await fingerprint({
     user:snapshot.user_id,connection:snapshot.connection_id,environment:snapshot.environment,app:snapshot.app_id,
     creation:snapshot.creation_id,product:snapshot.product,media:snapshot.content_sha256,
     options,consent:snapshot.consent_version,consent_choices:input.consent,
    })
    let job = await deps.repository.create(snapshot)
    durableJob = job
    if (!['awaiting_confirmation','queued'].includes(job.status) || Date.parse(job.claim_expires_at) > now()) return reply(request,200,sanitizedJob(job))
    try { job = await deps.repository.claim(job.id,job.revision) }
    catch { return reply(request,200,sanitizedJob(await ownedJob(job.id,identity))) }
    if (job.status === 'awaiting_confirmation') job = await deps.repository.transition(job,'queued')
    // Snapshot is bound to the exact bounded bytes already probed in this request.
    // The database rechecks admin, token lifetime and fresh creator constraints on init.
    job = await deps.repository.transition(job,'initializing')
    const init = await deps.client.init({accessToken,creator,probe,options,consent:input.consent})
    if (init.publish_id) {
     // ACK must precede consuming the in-memory upload capability and any PUT.
     job = await deps.repository.transition(job,'uploading',{publishId:init.publish_id})
    }
    if (!init.ok) {
     job = await deps.repository.transition(job,'reconciliation_required',{errorCode:'init_uncertain'})
     return reply(request,200,sanitizedJob(job))
    }
    try { await putUpload({uploadUrl:init.takeUploadUrl(),bytes,job,fetcher:deps.fetcher}) }
    catch {
     job = await deps.repository.transition(job,'reconciliation_required',{errorCode:'upload_uncertain'})
     return reply(request,200,sanitizedJob(job))
    }
    job = await deps.repository.transition(job,'processing')
    return reply(request,200,sanitizedJob(job))
   } finally { accessToken = null }
  } catch (error) {
   // Never echo database/provider messages, token envelopes, paths or URLs.
   if (durableJob) return reply(request,202,{...sanitizedJob(durableJob),status:'reconciliation_required',status_label:'Verificação necessária',error_code:'persistence_uncertain'})
   if (error?.name === 'AdminAuthorizationError' || error?.name === 'AdminMfaRequiredError') return reply(request,403,{error:'posting_admin_mfa_required'})
   const allowed = new Set(['posting_unauthorized','posting_input_invalid','posting_creation_invalid','posting_media_invalid','posting_media_changed','posting_reauthorization_required','posting_creator_unavailable','posting_job_unavailable','posting_idempotency_conflict','invalid_options','invalid_media'])
   const code = allowed.has(error?.message) ? error.message : 'posting_unavailable'
   return reply(request,code === 'posting_unauthorized' ? 401 : code === 'posting_reauthorization_required' || code === 'posting_idempotency_conflict' ? 409 : code === 'posting_input_invalid' || code === 'invalid_options' ? 400 : 422,{error:code})
  }
 }
}

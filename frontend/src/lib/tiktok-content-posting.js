// One browser contract for all four Video Imobiliario presets.
export const TIKTOK_VIDEO_PRODUCT = 'video_imobiliario'
export const TIKTOK_VIDEO_PRESETS = Object.freeze(['animate-images','campaign-video','narrated-video','virtual-agent'])
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export const TIKTOK_JOB_LABELS = Object.freeze({awaiting_confirmation:'Enviando ao TikTok',queued:'Enviando ao TikTok',initializing:'Enviando ao TikTok',uploading:'Enviando ao TikTok',processing:'Processando',inbox_delivered:'TikTok: Enviado',published:'Publicado',failed:'Falhou',blocked:'Falhou',reconciliation_required:'Verificar'})
export const TIKTOK_ERRORS = Object.freeze({
 posting_reauthorization_required:'Autorize novamente a publicação em Configurações → TikTok.',
 posting_admin_mfa_required:'Confirme a autenticação multifator em Configurações → TikTok.',
 posting_creation_invalid:'Este vídeo ainda não está disponível para publicação.',
 posting_media_invalid:'Este vídeo não atende aos requisitos do TikTok.',
 posting_media_changed:'O vídeo mudou. Revise a criação antes de publicar.',
 posting_creator_unavailable:'Não foi possível consultar as opções desta conta. Tente novamente mais tarde.',
 posting_idempotency_conflict:'Esta solicitação já foi registrada com outras opções. Verifique o envio anterior.',
 invalid_options:'Revise a privacidade e os consentimentos.',
 invalid_media:'Este vídeo não atende aos requisitos do TikTok.',
})
const fail = () => { throw Error('Não foi possível verificar a publicação. Sua criação está preservada.') }
const keyFor = (userId,creationId) => {
 if (!uuid(userId) || !uuid(creationId)) fail()
 return 'smartcorretorai:tiktok:video:v1:'+userId+':'+creationId
}
export function readTikTokRecovery(storage,userId,creationId) {
 try {
  const value = JSON.parse(storage.getItem(keyFor(userId,creationId)) || 'null')
  if (!value) return null
 if (!uuid(value.idempotency_key) || value.creation_id !== creationId || (!value.job_id && (typeof value.preparation !== 'string' || value.preparation.length<1 || value.preparation.length>4096)) ||
      value.product_type !== TIKTOK_VIDEO_PRODUCT || value.job_id && !uuid(value.job_id)) fail()
  return value
 } catch { throw Error('Não foi possível recuperar o envio salvo. Verifique o armazenamento deste navegador antes de publicar.') }
}
export function writeTikTokRecovery(storage,userId,creationId,value) {
 try { storage.setItem(keyFor(userId,creationId),JSON.stringify(value)) }
 catch { throw Error('Permita o armazenamento deste navegador para recuperar esta publicação com segurança.') }
}
export async function callTikTokPosting(client,body,userId) {
 const {data:sessionData,error:sessionError} = await client.auth.getSession()
 const session=sessionData?.session
 if (sessionError || !session?.access_token || session.user?.id !== userId) fail()
 const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
 if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw Error(TIKTOK_ERRORS.posting_admin_mfa_required)
 const {data,error} = await client.functions.invoke('tiktok-content-posting',{body,headers:{Authorization:'Bearer '+session.access_token}})
 if (error || data?.error) {
  let code = data?.error, body = data
  try { body ||= await error?.context?.clone().json(); code ||= body?.error } catch {}
  const failure = Error(TIKTOK_ERRORS[code] || 'Não foi possível confirmar o resultado. Verifique o envio antes de tentar novamente.')
  if (typeof body?.stage === 'string' && /^[a-z_]+$/.test(body.stage) && typeof code === 'string' && /^[a-z_]+$/.test(code)) failure.tiktokDiagnostic = { stage: body.stage, error: code }
  throw failure
 }
 return data
}
export function parseTikTokJob(value,creationId) {
 if (!value || !uuid(value.job_id) || value.creation_id !== creationId ||
     value.product_type !== TIKTOK_VIDEO_PRODUCT || !Object.hasOwn(TIKTOK_JOB_LABELS,value.status)) fail()
 if (Object.hasOwn(value,'retryable') && (typeof value.retryable !== 'boolean'||value.retryable&&value.status!=='failed')) fail()
 const job={job_id:value.job_id,status:value.status,...(value.provider_status==='SEND_TO_USER_INBOX'?{provider_status:'SEND_TO_USER_INBOX'}:{}),...(value.retryable===true?{retryable:true}:{})}
 if (!Object.hasOwn(value,'failure_stage')) return job
 const message=value.provider_error_message
 if(value.failure_stage!=='init'||!Number.isInteger(value.provider_http_status)||value.provider_http_status<100||value.provider_http_status>599||
    typeof value.provider_error_code!=='string'||!/^[A-Za-z0-9_.-]{1,64}$/.test(value.provider_error_code)||
    (message!==null&&(typeof message!=='string'||message.length<1||message.length>240||!/^[\p{L}\p{N} .,:;()'"!?_-]+$/u.test(message)||/(bearer|access[_ -]?token|refresh[_ -]?token|authorization|https?:\/\/|upload_url|open_id)/i.test(message)))||
    (value.provider_log_id!==null&&(typeof value.provider_log_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.provider_log_id)))) return job
 return {...job,failure_stage:'init',provider_http_status:value.provider_http_status,provider_error_code:value.provider_error_code,provider_error_message:message,provider_log_id:value.provider_log_id}
}
export const isTikTokTerminalWithoutProviderSend=job=>job?.status==='failed'&&job?.retryable===true
export const nextTikTokRecovery=(saved,job)=>isTikTokTerminalWithoutProviderSend(job)?null:{...saved,...job}
export function parseTikTokPreparation(value,creationId) {
 if(value?.delivery==='inbox'&&value.product_type===TIKTOK_VIDEO_PRODUCT&&value.creation_id===creationId&&typeof value.preparation==='string'&&value.preparation.length>0){
  let preview;try{preview=new URL(value.preview_url)}catch{fail()};if(preview.protocol!=='https:'||preview.username||preview.password)fail();return value
 }
 const c=value?.creator
 const levels=['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY']
 let preview
 try { preview=new URL(value.preview_url) } catch { fail() }
 if (value.product_type !== TIKTOK_VIDEO_PRODUCT || value.creation_id !== creationId ||
     value.is_aigc !== true || value.privacy_level !== null || preview.protocol !== 'https:' ||
     preview.username || preview.password || !c || typeof c.creator_nickname !== 'string' ||
     typeof c.creator_username !== 'string' || !Array.isArray(c.privacy_level_options) ||
     !c.privacy_level_options.length || c.privacy_level_options.some(x=>!levels.includes(x)) ||
     ['comment_disabled','duet_disabled','stitch_disabled'].some(x=>typeof c[x]!=='boolean') ||
     !Number.isFinite(c.max_video_post_duration_sec) || !Number.isFinite(value.media?.duration_ms) ||
     value.media.duration_ms > c.max_video_post_duration_sec*1000) fail()
 return value
}
export function postingConfirmation(creationId,idempotencyKey,preparation,options,consent) {
 if (!uuid(creationId) || !uuid(idempotencyKey) || typeof preparation!=='string' || preparation.length<1 || preparation.length>4096) fail()
 // Projection keeps all storage, identity and provider capabilities out of HTTP input.
 return {action:'confirm',creation_id:creationId,idempotency_key:idempotencyKey,preparation,
  options:Object.fromEntries(['title','privacy_level','disable_comment','disable_duet','disable_stitch','brand_content_toggle','brand_organic_toggle'].map(k=>[k,options[k]])),
  consent:Object.fromEntries(['confirmed','commercial_disclosure','music_usage_confirmed','branded_content_policy_confirmed'].map(k=>[k,consent[k]]))}
}

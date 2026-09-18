import { getProductDraftStorageKey, readProductDraft } from './product-draft.js'

export const VIDEO_REAUTH_MESSAGE = 'Sua sessão não é mais válida. Entre novamente para continuar. A geração não será reenviada automaticamente.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const UPLOAD_RECOVERY_TTL = 24 * 60 * 60 * 1000

// Read the SDK's HTTP error body without consuming the original Response.
// A transport failure or a permission-denied 403 alone is not a revoked session.
export async function isVideoSessionInvalid(error, data) {
  let body = data
  try { if (error?.context?.clone) body = await error.context.clone().json() } catch { /* optional error body */ }
  const code = String(body?.code || body?.error_code || error?.code || '')
  const message = String(body?.error || body?.message || error?.message || '')
  return Number(error?.context?.status ?? error?.status) === 401
    || /^(session_not_found|session_expired|bad_jwt|invalid_jwt|user_not_found)$/.test(code)
    || /session_not_found|session (?:not found|expired|invalid)|invalid session|auth session missing|sess[aã]o.{0,25}(?:expir|inv[aá]lid)/i.test(message)
}

export async function requireVideoSession(client, expectedUserId) {
  const { data, error } = await client.auth.getUser()
  if (await isVideoSessionInvalid(error) || (!error && !data?.user)) {
    throw Object.assign(new Error(VIDEO_REAUTH_MESSAGE), { code: 'session_not_found' })
  }
  if (error) throw new Error('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.')
  if (data.user.id !== expectedUserId) throw new Error('Entre com a mesma conta para retomar este briefing.')
}

export function validVideoUploads(value, userId, now = Date.now()) {
  if (!value || !UUID.test(value.requestId || '') || !UUID.test(userId || '')
    || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt > UPLOAD_RECOVERY_TTL
    || !Array.isArray(value.paths) || !value.paths.length || value.paths.length > 5) return null
  const prefix = `${userId}/smart-tour/${value.requestId}/`
  if (new Set(value.paths).size !== value.paths.length || value.paths.some(p => typeof p !== 'string'
    || !p.startsWith(prefix) || !/^0[1-5]\.(jpg|png)$/.test(p.slice(prefix.length)))) return null
  return { requestId: value.requestId, savedAt: value.savedAt, paths: [...value.paths] }
}

export async function verifyVideoUploads(client, value, userId) {
  const uploads = validVideoUploads(value, userId)
  if (!uploads) throw new Error('As fotos salvas não estão disponíveis. Selecione as fotos novamente; seu briefing foi preservado.')
  const { data, error } = await client.storage.from('studio-videos').list(`${userId}/smart-tour/${uploads.requestId}`, { limit: 10 })
  if (error) throw error
  if (uploads.paths.some(p => !data?.some(object => object.name === p.split('/').at(-1) && object.id))) {
    throw new Error('Uma foto salva não está mais disponível. Selecione as fotos novamente; seu briefing foi preservado.')
  }
  return uploads
}

export function videoLoginDestination(storage, userId) {
  const draft = readProductDraft(storage, { productKey: 'video-imobiliario', schemaVersion: 1, userId })
  return draft?.resumeAfterLogin === true ? '/smart-tour-ai' : '/dashboard'
}

export function hasVideoLoginRecovery(storage) {
  try {
    const record = JSON.parse(storage?.getItem(getProductDraftStorageKey('video-imobiliario', 1)) || 'null')
    return Boolean(record?.userId) && videoLoginDestination(storage, record.userId) === '/smart-tour-ai'
  } catch { return false }
}

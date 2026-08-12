export const INSTAGRAM_PUBLISH_FUNCTION = 'instagram-publish'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_ERROR_CODES = new Set([
  'instagram_not_connected',
  'instagram_reconnect_required',
  'invalid_media_source',
  'publish_in_progress',
  'instagram_publish_failed',
])

export const INSTAGRAM_PUBLISH_MESSAGES = Object.freeze({
  instagram_not_connected: 'Conecte seu Instagram em Configurações.',
  instagram_reconnect_required: 'Reconecte seu Instagram em Configurações.',
  invalid_media_source: 'A mídia não está disponível para publicação no Instagram.',
  publish_in_progress: 'Esta publicação já está sendo processada.',
  instagram_publish_failed: 'Não foi possível publicar no Instagram.',
})

export class InstagramPublishClientError extends Error {
  constructor(code = 'instagram_publish_failed') {
    const safeCode = SAFE_ERROR_CODES.has(code) ? code : 'instagram_publish_failed'
    super(INSTAGRAM_PUBLISH_MESSAGES[safeCode])
    this.name = 'InstagramPublishClientError'
    this.code = safeCode
  }
}

const readSafeErrorCode = async (data, error) => {
  if (SAFE_ERROR_CODES.has(data?.code)) return data.code
  const response = error?.context
  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json()
      if (SAFE_ERROR_CODES.has(payload?.code)) return payload.code
    } catch {
      // A resposta bruta nunca é exposta; somente códigos allowlisted são aceitos.
    }
  }
  return 'instagram_publish_failed'
}

export function createInstagramPublishIdempotencyKey(cryptoApi = globalThis.crypto) {
  const key = cryptoApi?.randomUUID?.()
  if (!UUID_PATTERN.test(String(key || ''))) throw new InstagramPublishClientError()
  return key
}

export function getInstagramPublishCandidate(generationResult) {
  const completedJob = (generationResult?.jobs || []).find((job) => (
    job?.status === 'completed' && job?.imageUrl && UUID_PATTERN.test(String(job?.generationId || ''))
  ))
  if (completedJob) return completedJob

  const generationId = generationResult?.generation_id || generationResult?.hero_generation_id || ''
  if (generationResult?.status !== 'completed' || !generationResult?.imageUrl || !UUID_PATTERN.test(String(generationId))) return null
  return { generationId, formatLabel: 'Arte principal', imageUrl: generationResult.imageUrl }
}

export async function publishInstagramImage(client, {
  generationId,
  caption = '',
  idempotencyKey,
}) {
  if (!UUID_PATTERN.test(String(generationId || '')) || !UUID_PATTERN.test(String(idempotencyKey || ''))) {
    throw new InstagramPublishClientError('invalid_media_source')
  }

  const normalizedCaption = typeof caption === 'string' ? caption.trim() : ''
  const { data, error } = await client.functions.invoke(INSTAGRAM_PUBLISH_FUNCTION, {
    body: {
      source: { type: 'hero_generation', id: generationId },
      caption: normalizedCaption,
      idempotency_key: idempotencyKey,
    },
  })

  if (error || data?.success !== true || data?.published !== true) {
    throw new InstagramPublishClientError(await readSafeErrorCode(data, error))
  }
  return { success: true, published: true, replayed: data.replayed === true }
}

export function createInstagramPublishAttempt({ client, cryptoApi = globalThis.crypto } = {}) {
  let idempotencyKey = ''
  let locked = false

  return {
    async publish({ generationId, caption = '' }) {
      if (locked) return { started: false, reason: 'locked' }
      locked = true
      idempotencyKey ||= createInstagramPublishIdempotencyKey(cryptoApi)
      const result = await publishInstagramImage(client, { generationId, caption, idempotencyKey })
      return { started: true, ...result }
    },
  }
}

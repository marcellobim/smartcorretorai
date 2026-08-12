import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { InstagramPublishError } from '../_shared/instagram/publish-client.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAPTION_LIMIT = 2200
const REPLAYABLE_FAILURE_CODES = new Set([
  'instagram_not_connected',
  'instagram_reconnect_required',
  'invalid_media_source',
  'instagram_publish_failed',
])

export type InstagramPublicationStatus = 'processing' | 'publishing' | 'published' | 'failed'

export type PublicationClaim =
  | { kind: 'created'; publicationId: string }
  | { kind: 'existing'; status: InstagramPublicationStatus; sourceId: string; errorCode?: string | null }

export type InstagramPublishRuntimeDependencies = {
  authenticate: (token: string) => Promise<{ id: string } | null>
  getConnection: (userId: string) => Promise<{ instagramUserId: string; pageAccessToken: string; reconnectRequired?: boolean } | null>
  resolveMedia: (userId: string, sourceId: string) => Promise<{ bucket: string; path: string; mimeType: string } | null>
  createSignedUrl: (bucket: string, path: string, expiresInSeconds: number) => Promise<string>
  claimPublication: (input: { userId: string; idempotencyKey: string; sourceId: string }) => Promise<PublicationClaim>
  markPublishing: (userId: string, publicationId: string, containerId: string) => Promise<void>
  markPublished: (userId: string, publicationId: string, postId: string) => Promise<void>
  markFailed: (userId: string, publicationId: string, errorCode: string) => Promise<void>
  createContainer: (input: { instagramUserId: string; pageAccessToken: string; imageUrl: string; caption?: string }) => Promise<string>
  publishContainer: (input: { instagramUserId: string; pageAccessToken: string; creationId: string }) => Promise<string>
  log?: (stage: 'instagram_publish_start' | 'media_resolved' | 'container_created' | 'media_published' | 'publication_failed', details?: Record<string, unknown>) => void
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '').trim() : ''
}

const errorResponse = (code: string, status: number) => jsonResponse({ success: false, code }, status)

const parseRequest = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if ('user_id' in record || 'image_url' in record || 'video_url' in record || 'media_url' in record) return null
  if (!record.source || typeof record.source !== 'object' || Array.isArray(record.source)) return null
  const source = record.source as Record<string, unknown>
  if (source.type !== 'hero_generation' || typeof source.id !== 'string' || !UUID_PATTERN.test(source.id)) return null
  if (Object.keys(source).some(key => !['type', 'id'].includes(key))) return null
  if (typeof record.idempotency_key !== 'string' || !UUID_PATTERN.test(record.idempotency_key)) return null
  if (record.caption !== undefined && record.caption !== null && typeof record.caption !== 'string') return null
  const caption = typeof record.caption === 'string' ? record.caption.trim() : ''
  if (Array.from(caption).length > CAPTION_LIMIT) return null
  return { sourceId: source.id, idempotencyKey: record.idempotency_key, caption }
}

const safeFailure = (error: unknown) => {
  if (error instanceof InstagramPublishError) {
    return {
      code: error.publicCode,
      details: {
        ...(error.httpStatus !== undefined ? { http_status: error.httpStatus } : {}),
        ...(error.metaCode !== undefined ? { meta_code: error.metaCode } : {}),
        ...(error.metaSubcode !== undefined ? { meta_subcode: error.metaSubcode } : {}),
      },
    }
  }
  return { code: 'instagram_publish_failed', details: {} }
}

export async function handleInstagramPublish(request: Request, dependencies: InstagramPublishRuntimeDependencies) {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 405)

  const token = bearerToken(request)
  if (!token) return errorResponse('unauthorized', 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return errorResponse('unauthorized', 401)

  const parsed = await request.json().then(parseRequest).catch(() => null)
  if (!parsed) return errorResponse('invalid_media_source', 400)

  const media = await dependencies.resolveMedia(user.id, parsed.sourceId).catch(() => null)
  if (!media || !['image/jpeg', 'image/png'].includes(media.mimeType)) {
    return errorResponse('invalid_media_source', 400)
  }

  let claim: PublicationClaim
  try {
    claim = await dependencies.claimPublication({
      userId: user.id,
      idempotencyKey: parsed.idempotencyKey,
      sourceId: parsed.sourceId,
    })
  } catch {
    return errorResponse('instagram_publish_failed', 502)
  }

  if (claim.kind === 'existing') {
    if (claim.sourceId !== parsed.sourceId) return errorResponse('invalid_media_source', 409)
    if (claim.status === 'published') return jsonResponse({ success: true, published: true, replayed: true })
    if (claim.status === 'processing' || claim.status === 'publishing') return errorResponse('publish_in_progress', 409)
    const storedCode = claim.errorCode && REPLAYABLE_FAILURE_CODES.has(claim.errorCode)
      ? claim.errorCode
      : 'instagram_publish_failed'
    return errorResponse(storedCode, 409)
  }

  const connection = await dependencies.getConnection(user.id).catch(() => null)
  if (connection?.reconnectRequired) {
    await dependencies.markFailed(user.id, claim.publicationId, 'instagram_reconnect_required').catch(() => undefined)
    return errorResponse('instagram_reconnect_required', 401)
  }
  if (!connection?.instagramUserId || !connection.pageAccessToken) {
    await dependencies.markFailed(user.id, claim.publicationId, 'instagram_not_connected').catch(() => undefined)
    return errorResponse('instagram_not_connected', 409)
  }

  dependencies.log?.('instagram_publish_start', { caption_present: Boolean(parsed.caption) })
  dependencies.log?.('media_resolved')

  let containerCreated = false
  try {
    const imageUrl = await dependencies.createSignedUrl(media.bucket, media.path, 15 * 60)
    const containerId = await dependencies.createContainer({
      instagramUserId: connection.instagramUserId,
      pageAccessToken: connection.pageAccessToken,
      imageUrl,
      ...(parsed.caption ? { caption: parsed.caption } : {}),
    })
    containerCreated = true
    await dependencies.markPublishing(user.id, claim.publicationId, containerId)
    dependencies.log?.('container_created')

    const postId = await dependencies.publishContainer({
      instagramUserId: connection.instagramUserId,
      pageAccessToken: connection.pageAccessToken,
      creationId: containerId,
    })
    await dependencies.markPublished(user.id, claim.publicationId, postId)
    dependencies.log?.('media_published')
    return jsonResponse({ success: true, published: true })
  } catch (error) {
    const failure = safeFailure(error)
    dependencies.log?.('publication_failed', failure.details)
    if (!containerCreated) {
      await dependencies.markFailed(user.id, claim.publicationId, failure.code).catch(() => undefined)
    }
    return errorResponse(failure.code, failure.code === 'instagram_reconnect_required' ? 401 : 502)
  }
}

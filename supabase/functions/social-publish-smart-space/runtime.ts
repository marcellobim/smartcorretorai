const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGE_ASSET_PATTERN = /^[0-4]:[a-z0-9_]{1,40}$/
const TRANSFORMATION_VIDEO_ASSET_PATTERN = /^[0-4]:transformation_video$/
const SOURCE_TYPES = new Set(['smart_space_image', 'smart_space_transform', 'smart_space_life', 'smart_space_broker'])
const DESTINATIONS = new Set(['instagram', 'facebook'])
const IDENTITY_FAILURE_CODES = new Set([
  'smart_space_image_request_invalid',
  'smart_space_image_item_invalid',
  'smart_space_transform_request_invalid',
  'smart_space_transform_item_invalid',
  'smart_space_video_economy_invalid',
  'smart_space_video_job_invalid',
  'smart_space_media_storage_invalid',
  'smart_space_social_connection_invalid',
])
const OPTION_ID = 'smart-space-no-caption'
const MAX_CAPTION_LENGTH = 2200
const MAX_REQUEST_BYTES = 12_288
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type SmartSpaceDestination = 'instagram' | 'facebook'
export type SmartSpaceParsedIntent = { sourceType: string; sourceId: string; mediaAssetId: string; optionId: string; captionSnapshot: string }
export type SmartSpaceIntent = SmartSpaceParsedIntent & {
  connectionId: string
  bucket: 'studio-videos'
  objectPath: string
  contentType: 'image/jpeg' | 'video/mp4'
  contentLength: number
}
export type SmartSpaceRecovery = { jobId: string; destination: SmartSpaceDestination; status: string; externalPostId: string | null; externalPostLink: string | null; publicErrorCode: string | null; captionSnapshot: string }

type ParsedRequest = { action: 'publish' | 'recovery'; intent: SmartSpaceParsedIntent; destinations: SmartSpaceDestination[] }
type Job = { id: string; status: string; reused: boolean }
type Claim = { jobId: string; claimToken: string } | null

export type SmartSpacePublishDependencies = {
  authenticate(token: string): Promise<{ id: string } | null>
  resolveIntent(userId: string, input: SmartSpaceParsedIntent): Promise<SmartSpaceIntent | null>
  deriveIdempotencyKey(userId: string, intent: SmartSpaceParsedIntent, destination: SmartSpaceDestination): Promise<string>
  createOrReuseJob(input: { userId: string; intent: SmartSpaceIntent; destination: SmartSpaceDestination; idempotencyKey: string }): Promise<Job | null>
  findJob(userId: string, idempotencyKey: string, destination: SmartSpaceDestination): Promise<SmartSpaceRecovery | null>
  claimJob(jobId: string): Promise<Claim>
  createLease(input: { jobId: string; intent: SmartSpaceIntent; capabilityHash: string }): Promise<boolean>
  hashCapability(capability: string): Promise<string>
  randomCapability(): string
  invokeWorker(input: { destination: SmartSpaceDestination; intent: SmartSpaceIntent; jobId: string; claimToken: string; capability: string }): Promise<{ ok: boolean; code?: string }>
  log?(stage: string, details?: Record<string, unknown>): void
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '').trim() : ''
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const safeFailure = (code: string, status: number) => json({ ok: false, code }, status)

async function parseRequest(request: Request): Promise<ParsedRequest | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null
  const raw = await request.text().catch(() => '')
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort().join(',')
  if (keys !== 'action,destinations,media_asset_id,option_id,source'
      && keys !== 'action,caption_snapshot,destinations,media_asset_id,option_id,source') return null
  if (record.action !== 'publish' && record.action !== 'recovery') return null
  if (!record.source || typeof record.source !== 'object' || Array.isArray(record.source)) return null
  const source = record.source as Record<string, unknown>
  if (Object.keys(source).sort().join(',') !== 'id,type' || typeof source.type !== 'string' || !SOURCE_TYPES.has(source.type)
      || typeof source.id !== 'string' || !UUID_PATTERN.test(source.id)) return null
  if (record.option_id !== OPTION_ID || typeof record.media_asset_id !== 'string') return null
  const captionSnapshot = typeof record.caption_snapshot === 'string' ? record.caption_snapshot : ''
  if (Array.from(captionSnapshot).length > MAX_CAPTION_LENGTH) return null
  const validMediaAsset = source.type === 'smart_space_image'
    ? IMAGE_ASSET_PATTERN.test(record.media_asset_id)
    : source.type === 'smart_space_transform'
      ? TRANSFORMATION_VIDEO_ASSET_PATTERN.test(record.media_asset_id)
      : record.media_asset_id === source.id
  if (!validMediaAsset) return null
  if (!Array.isArray(record.destinations) || record.destinations.length < 1 || record.destinations.length > 2) return null
  const destinations = [...new Set(record.destinations)]
  if (destinations.length !== record.destinations.length || destinations.some(item => typeof item !== 'string' || !DESTINATIONS.has(item))) return null
  return { action: record.action, intent: { sourceType: source.type, sourceId: source.id, mediaAssetId: record.media_asset_id, optionId: OPTION_ID, captionSnapshot }, destinations: destinations as SmartSpaceDestination[] }
}

const publicResult = (recovery: SmartSpaceRecovery | null, fallbackDestination: SmartSpaceDestination) => ({
  destination: recovery?.destination || fallbackDestination,
  job_id: recovery?.jobId || null,
  status: recovery?.status || 'failed',
  external_post_id: recovery?.externalPostId || null,
  external_post_link: recovery?.externalPostLink || null,
  error: recovery?.publicErrorCode || (recovery ? null : 'social_publish_failed'),
  caption_snapshot: recovery?.captionSnapshot ?? null,
})
const overallStatus = (results: ReturnType<typeof publicResult>[]) => {
  const published = results.filter(result => result.status === 'published').length
  return published === results.length ? 'published' : published > 0 ? 'partial_success'
    : results.some(result => ['queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled'].includes(result.status)) ? 'processing' : 'failed'
}

async function publishOne(userId: string, intent: SmartSpaceIntent, destination: SmartSpaceDestination, dependencies: SmartSpacePublishDependencies) {
  const idempotencyKey = await dependencies.deriveIdempotencyKey(userId, intent, destination)
  const job = await dependencies.createOrReuseJob({ userId, intent, destination, idempotencyKey }).catch(() => null)
  if (!job) return publicResult(null, destination)
  if (!['queued', 'retry_scheduled'].includes(job.status)) return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  const claim = await dependencies.claimJob(job.id).catch(() => null)
  if (!claim) return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  const capability = dependencies.randomCapability()
  const capabilityHash = await dependencies.hashCapability(capability)
  if (!await dependencies.createLease({ jobId: job.id, intent, capabilityHash }).catch(() => false)) return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  dependencies.log?.('worker_invoked', { destination, media: intent.contentType })
  await dependencies.invokeWorker({ destination, intent, jobId: job.id, claimToken: claim.claimToken, capability }).catch(() => ({ ok: false, code: 'worker_unavailable' }))
  return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
}

export async function handleSmartSpacePublish(request: Request, dependencies: SmartSpacePublishDependencies) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return safeFailure('method_not_allowed', 405)
  const token = bearerToken(request)
  if (!token) return safeFailure('unauthorized', 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return safeFailure('unauthorized', 401)
  const parsed = await parseRequest(request)
  if (!parsed) return safeFailure('invalid_smart_space_publication', 400)
  if (parsed.action === 'recovery') {
    const results = await Promise.all(parsed.destinations.map(async destination => {
      const key = await dependencies.deriveIdempotencyKey(user.id, parsed.intent, destination)
      return publicResult(await dependencies.findJob(user.id, key, destination).catch(() => null), destination)
    }))
    return json({ ok: true, action: parsed.action, status: overallStatus(results), results, smart_tokens: 0 })
  }
  let identityFailureCode = ''
  const intent = await dependencies.resolveIntent(user.id, parsed.intent).catch(error => {
    const code = error instanceof Error ? error.message : ''
    identityFailureCode = IDENTITY_FAILURE_CODES.has(code) ? code : ''
    return null
  })
  if (!intent) return safeFailure(identityFailureCode || 'smart_space_publication_identity_invalid', 409)
  const results = await Promise.all(parsed.destinations.map(destination => publishOne(user.id, intent, destination, dependencies)))
  return json({ ok: true, action: parsed.action, status: overallStatus(results), results, smart_tokens: 0 })
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SMART_TOUR_OPTION_PATTERN = /^smart-tour-caption-option-[1-3]$/
const STUDIO_OPTION_PATTERN = /^studio-caption-option-[1-3]$/
const SOURCE_TYPES = new Set(['video_imobiliario', 'studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel'])
const DESTINATIONS = new Set(['instagram', 'facebook'])
const MAX_REQUEST_BYTES = 12_288
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type VideoDestination = 'instagram' | 'facebook'
export type VideoIntent = {
  sourceType: string
  sourceId: string
  mediaAssetId: string
  optionId: string
  captionSnapshot: string
  connectionId: string
  bucket: 'studio-videos'
  objectPath: string
  contentType: 'video/mp4'
  contentLength: number
}
type VideoJob = { id: string; status: string; reused: boolean }
type VideoClaim = { jobId: string; claimToken: string } | null
export type VideoRecovery = { jobId: string; destination: VideoDestination; status: string; externalPostId: string | null; externalPostLink: string | null; publicErrorCode: string | null; captionSnapshot?: string }
type ParsedIntent = { sourceType: string; sourceId: string; mediaAssetId: string; optionId: string; captionSnapshot: string | null }
type ParsedRequest = { action: 'publish' | 'recovery'; intent: ParsedIntent; destinations: VideoDestination[] }

export type VideoSocialPublishDependencies = {
  authenticate(token: string): Promise<{ id: string } | null>
  resolveIntent(userId: string, input: ParsedIntent): Promise<VideoIntent | null>
  deriveIdempotencyKey(userId: string, intent: ParsedIntent, destination: VideoDestination): Promise<string>
  createOrReuseJob(input: { userId: string; intent: VideoIntent; destination: VideoDestination; idempotencyKey: string }): Promise<VideoJob | null>
  findJob(userId: string, idempotencyKey: string, destination: VideoDestination): Promise<VideoRecovery | null>
  claimJob(jobId: string): Promise<VideoClaim>
  createLease(input: { jobId: string; intent: VideoIntent; capabilityHash: string }): Promise<boolean>
  hashCapability(capability: string): Promise<string>
  randomCapability(): string
  invokeWorker(input: { destination: VideoDestination; jobId: string; claimToken: string; capability: string }): Promise<{ ok: boolean; code?: string }>
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
  if (Object.keys(source).sort().join(',') !== 'id,type' || typeof source.type !== 'string' || !SOURCE_TYPES.has(source.type) || typeof source.id !== 'string' || !UUID_PATTERN.test(source.id)) return null
  const studioSource = source.type !== 'video_imobiliario'
  const captionSnapshot = record.caption_snapshot === undefined ? null : record.caption_snapshot
  if (record.media_asset_id !== source.id || typeof record.option_id !== 'string'
      || (studioSource ? !STUDIO_OPTION_PATTERN.test(record.option_id) : !SMART_TOUR_OPTION_PATTERN.test(record.option_id))
      || (captionSnapshot !== null && (typeof captionSnapshot !== 'string' || Array.from(captionSnapshot).length > 2200))) return null
  if (!Array.isArray(record.destinations) || record.destinations.length < 1 || record.destinations.length > 2) return null
  const destinations = [...new Set(record.destinations)]
  if (destinations.length !== record.destinations.length || destinations.some(item => typeof item !== 'string' || !DESTINATIONS.has(item))) return null
  return { action: record.action, intent: { sourceType: source.type, sourceId: source.id, mediaAssetId: record.media_asset_id, optionId: record.option_id, captionSnapshot }, destinations: destinations as VideoDestination[] }
}

const publicResult = (recovery: VideoRecovery | null, fallbackDestination: VideoDestination) => ({
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
    : results.some(result => ['queued', 'processing', 'publishing', 'reconciliation_required'].includes(result.status)) ? 'processing' : 'failed'
}

async function publishOne(userId: string, intent: VideoIntent, destination: VideoDestination, dependencies: VideoSocialPublishDependencies) {
  const idempotencyKey = await dependencies.deriveIdempotencyKey(userId, intent, destination)
  const job = await dependencies.createOrReuseJob({ userId, intent, destination, idempotencyKey }).catch(() => null)
  if (!job) return publicResult(null, destination)
  if (job.status !== 'queued' && job.status !== 'retry_scheduled') return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  const claim = await dependencies.claimJob(job.id).catch(() => null)
  if (!claim) return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  const capability = dependencies.randomCapability()
  const capabilityHash = await dependencies.hashCapability(capability)
  if (!await dependencies.createLease({ jobId: job.id, intent, capabilityHash }).catch(() => false)) return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
  dependencies.log?.('worker_invoked', { destination })
  await dependencies.invokeWorker({ destination, jobId: job.id, claimToken: claim.claimToken, capability }).catch(() => ({ ok: false, code: 'worker_unavailable' }))
  return publicResult(await dependencies.findJob(userId, idempotencyKey, destination).catch(() => null), destination)
}

export async function handleVideoSocialPublish(request: Request, dependencies: VideoSocialPublishDependencies) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return safeFailure('method_not_allowed', 405)
  const token = bearerToken(request)
  if (!token) return safeFailure('unauthorized', 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return safeFailure('unauthorized', 401)
  const parsed = await parseRequest(request)
  if (!parsed) return safeFailure('invalid_video_publication', 400)
  if (parsed.action === 'recovery') {
    const results = await Promise.all(parsed.destinations.map(async destination => {
      const key = await dependencies.deriveIdempotencyKey(user.id, parsed.intent, destination)
      return publicResult(await dependencies.findJob(user.id, key, destination).catch(() => null), destination)
    }))
    return json({ ok: true, action: parsed.action, status: overallStatus(results), results, smart_tokens: 0 })
  }
  const intent = await dependencies.resolveIntent(user.id, parsed.intent).catch(() => null)
  if (!intent) return safeFailure('video_publication_identity_invalid', 409)
  const results = await Promise.all(parsed.destinations.map(destination => publishOne(user.id, intent, destination, dependencies)))
  return json({ ok: true, action: parsed.action, status: overallStatus(results), results, smart_tokens: 0 })
}

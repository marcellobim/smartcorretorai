const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/
const META_ID_PATTERN = /^\d+(?:_\d+)?$/
const MAX_REQUEST_BYTES = 1024

export type ExistingFacebookJob = {
  id: string
  userId: string
  connectionId: string
  socialAccountId: string
  platform: 'facebook'
  caption: string
  claimToken: string
}

export type ExistingFacebookMediaLease = {
  id: string
  jobId: string
  capabilityHash: string
  expiresAt: string
  contentType: string
  contentLength: number
}

export type ExistingFacebookAccount = {
  socialAccountId: string
  pageId: string
  pageName: string
  pageAccessToken: string
  userAccessToken: string
}

export type FacebookPhotoResult = {
  postId: string
  permalink: string | null
}

export type FacebookJobPublishDependencies = {
  getJob(jobId: string, claimToken: string): Promise<ExistingFacebookJob | null>
  getLease(jobId: string): Promise<ExistingFacebookMediaLease | null>
  hashCapability(capability: string): Promise<string>
  validateLeaseUrl(capability: string, contentType: string, contentLength: number): Promise<boolean>
  getActiveAccount(job: ExistingFacebookJob): Promise<ExistingFacebookAccount | null>
  validateCapability(account: ExistingFacebookAccount): Promise<boolean>
  recordConnectionValidation(job: ExistingFacebookJob): Promise<boolean>
  beginExternalPublish(input: { jobId: string; claimToken: string; leaseId: string }): Promise<boolean>
  publishPhoto(input: { pageId: string; pageAccessToken: string; imageUrl: string; caption: string }): Promise<FacebookPhotoResult>
  completeJob(input: { jobId: string; claimToken: string; postId: string; permalink: string | null }): Promise<boolean>
  markReconciliationRequired(input: { jobId: string; claimToken: string }): Promise<boolean>
  buildLeaseUrl(capability: string): string
  now?: () => number
  log?: (stage: string, details?: Record<string, unknown>) => void
  expectedContentTypes?: readonly string[]
}

type ParsedRequest = { jobId: string; claimToken: string; capability: string }

async function parseRequest(request: Request): Promise<ParsedRequest | null> {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return null
  const raw = await request.text().catch(() => '')
  if (!raw || new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(',') !== 'claim_token,job_id,lease_capability') return null
  if (typeof record.job_id !== 'string' || !UUID_PATTERN.test(record.job_id)) return null
  if (typeof record.claim_token !== 'string' || !UUID_PATTERN.test(record.claim_token)) return null
  if (typeof record.lease_capability !== 'string' || !CAPABILITY_PATTERN.test(record.lease_capability)) return null
  return { jobId: record.job_id, claimToken: record.claim_token, capability: record.lease_capability }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

const safeFailure = (code: string, status = 409, details: Record<string, unknown> = {}) => (
  json({ ok: false, code, ...details }, status)
)

export async function handleFacebookJobPublish(
  request: Request,
  dependencies: FacebookJobPublishDependencies,
) {
  if (request.method !== 'POST') return safeFailure('method_not_allowed', 405)
  const input = await parseRequest(request)
  if (!input) return safeFailure('invalid_request', 400)

  const job = await dependencies.getJob(input.jobId, input.claimToken).catch(() => null)
  if (!job || job.id !== input.jobId || job.claimToken !== input.claimToken
      || job.platform !== 'facebook' || !UUID_PATTERN.test(job.socialAccountId)) {
    return safeFailure('job_unavailable', 404)
  }

  const lease = await dependencies.getLease(job.id).catch(() => null)
  const capabilityHash = await dependencies.hashCapability(input.capability).catch(() => '')
  const leaseExpiry = lease ? Date.parse(lease.expiresAt) : Number.NaN
  const now = dependencies.now?.() ?? Date.now()
  if (!lease || lease.jobId !== job.id || lease.capabilityHash !== capabilityHash
      || !Number.isFinite(leaseExpiry) || leaseExpiry <= now
      || !(dependencies.expectedContentTypes || ['image/jpeg', 'image/png']).includes(lease.contentType) || lease.contentLength <= 0) {
    return safeFailure('lease_unavailable', 409)
  }
  if (!await dependencies.validateLeaseUrl(input.capability, lease.contentType, lease.contentLength).catch(() => false)) {
    return safeFailure('lease_unavailable', 409)
  }

  const account = await dependencies.getActiveAccount(job).catch(() => null)
  if (!account || account.socialAccountId !== job.socialAccountId
      || !META_ID_PATTERN.test(account.pageId) || !account.pageAccessToken || !account.userAccessToken) {
    return safeFailure('connection_unavailable', 409)
  }
  if (!await dependencies.validateCapability(account).catch(() => false)) {
    return safeFailure('facebook_reconnect_required', 401)
  }
  if (!await dependencies.recordConnectionValidation(job).catch(() => false)) {
    return safeFailure('connection_validation_persist_failed', 409)
  }
  if (!await dependencies.beginExternalPublish({
    jobId: job.id,
    claimToken: input.claimToken,
    leaseId: lease.id,
  }).catch(() => false)) {
    return safeFailure('publish_start_rejected', 409, { publish_count: 0 })
  }

  dependencies.log?.('external_publish_started')
  let result: FacebookPhotoResult
  try {
    result = await dependencies.publishPhoto({
      pageId: account.pageId,
      pageAccessToken: account.pageAccessToken,
      imageUrl: dependencies.buildLeaseUrl(input.capability),
      caption: job.caption,
    })
  } catch {
    await dependencies.markReconciliationRequired({ jobId: job.id, claimToken: input.claimToken }).catch(() => false)
    dependencies.log?.('reconciliation_required')
    return safeFailure('facebook_publish_ambiguous', 502, { publish_count: 1 })
  }

  if (!META_ID_PATTERN.test(result.postId)
      || (result.permalink !== null && !result.permalink.startsWith('https://www.facebook.com/'))) {
    await dependencies.markReconciliationRequired({ jobId: job.id, claimToken: input.claimToken }).catch(() => false)
    return safeFailure('facebook_publish_ambiguous', 502, { publish_count: 1 })
  }

  if (!await dependencies.completeJob({
    jobId: job.id,
    claimToken: input.claimToken,
    postId: result.postId,
    permalink: result.permalink,
  }).catch(() => false)) {
    await dependencies.markReconciliationRequired({ jobId: job.id, claimToken: input.claimToken }).catch(() => false)
    return safeFailure('completion_persist_failed', 409, { publish_count: 1 })
  }

  dependencies.log?.('published')
  return json({
    ok: true,
    job_id: job.id,
    destination: 'facebook',
    page_name: account.pageName,
    post_id: result.postId,
    final_status: 'published',
    lease_closed: true,
    publish_count: 1,
  })
}

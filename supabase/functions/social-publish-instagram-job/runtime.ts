const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/
const META_ID_PATTERN = /^\d+$/
const MAX_REQUEST_BYTES = 1024

export type InstagramContainerStatus = 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED'

export type ExistingSocialJob = {
  id: string
  userId: string
  connectionId: string
  caption: string
  claimToken: string
}

export type ExistingMediaLease = {
  id: string
  jobId: string
  capabilityHash: string
  expiresAt: string
  contentType: string
  contentLength: number
}

export type ExistingMetaAccount = {
  instagramUserId: string
  instagramUsername: string
  pageName: string
  pageAccessToken: string
}

export type PublishedPostDetail = {
  id: string
  permalink: string | null
  caption: string | null
  username: string | null
}

export type InstagramJobPublishDependencies = {
  getJob(jobId: string, claimToken: string): Promise<ExistingSocialJob | null>
  getLease(jobId: string): Promise<ExistingMediaLease | null>
  hashCapability(capability: string): Promise<string>
  validateLeaseUrl(capability: string, contentType: string, contentLength: number): Promise<boolean>
  getActiveAccount(job: ExistingSocialJob): Promise<ExistingMetaAccount | null>
  validateConnection(account: ExistingMetaAccount): Promise<boolean>
  recordConnectionValidation(job: ExistingSocialJob): Promise<boolean>
  createContainer(input: { instagramUserId: string; pageAccessToken: string; imageUrl: string; caption: string }): Promise<string>
  startContainerPolling(input: { jobId: string; claimToken: string; containerId: string; leaseId: string }): Promise<boolean>
  getContainerStatus(input: { containerId: string; pageAccessToken: string }): Promise<InstagramContainerStatus>
  recordPoll(input: { jobId: string; claimToken: string; containerId: string; status: InstagramContainerStatus; nextPollAt?: string }): Promise<boolean>
  deferPollTimeout(input: { jobId: string; claimToken: string; containerId: string; nextPollAt: string }): Promise<boolean>
  publishContainer(input: { instagramUserId: string; pageAccessToken: string; containerId: string }): Promise<string>
  markReconciliationRequired(input: { jobId: string; claimToken: string }): Promise<boolean>
  getPostDetail(input: { postId: string; pageAccessToken: string }): Promise<PublishedPostDetail | null>
  completeJob(input: { jobId: string; claimToken: string; containerId: string; postId: string; permalink: string | null }): Promise<boolean>
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => number
  maxPolls?: number
  pollIntervalMs?: number
  buildLeaseUrl(capability: string): string
  log?: (stage: string, details?: Record<string, unknown>) => void
  expectedContentType?: string
  expectedInstagramUsername?: string | null
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

function safeFailure(code: string, status = 409, details: Record<string, unknown> = {}) {
  return json({ ok: false, code, ...details }, status)
}

export async function handleInstagramJobPublish(
  request: Request,
  dependencies: InstagramJobPublishDependencies,
) {
  if (request.method !== 'POST') return safeFailure('method_not_allowed', 405)
  const input = await parseRequest(request)
  if (!input) return safeFailure('invalid_request', 400)

  const job = await dependencies.getJob(input.jobId, input.claimToken).catch(() => null)
  if (!job || job.id !== input.jobId || job.claimToken !== input.claimToken) {
    return safeFailure('job_unavailable', 404)
  }

  const lease = await dependencies.getLease(job.id).catch(() => null)
  const capabilityHash = await dependencies.hashCapability(input.capability).catch(() => '')
  const leaseExpiry = lease ? Date.parse(lease.expiresAt) : Number.NaN
  const now = dependencies.now?.() ?? Date.now()
  if (!lease || lease.jobId !== job.id || lease.capabilityHash !== capabilityHash
      || !Number.isFinite(leaseExpiry) || leaseExpiry <= now
      || lease.contentType !== (dependencies.expectedContentType || 'image/jpeg') || lease.contentLength <= 0) {
    return safeFailure('lease_unavailable', 409)
  }
  if (!await dependencies.validateLeaseUrl(input.capability, lease.contentType, lease.contentLength).catch(() => false)) {
    return safeFailure('lease_unavailable', 409)
  }

  const account = await dependencies.getActiveAccount(job).catch(() => null)
  const expectedInstagramUsername = dependencies.expectedInstagramUsername === undefined
    ? 'smartcorretorai'
    : dependencies.expectedInstagramUsername
  if (!account || !account.instagramUsername
      || (expectedInstagramUsername && account.instagramUsername.toLowerCase() !== expectedInstagramUsername.toLowerCase())
      || !META_ID_PATTERN.test(account.instagramUserId) || !account.pageAccessToken) {
    return safeFailure('connection_unavailable', 409)
  }
  if (!await dependencies.validateConnection(account).catch(() => false)) {
    return safeFailure('connection_validation_failed', 401)
  }
  if (!await dependencies.recordConnectionValidation(job).catch(() => false)) {
    return safeFailure('connection_validation_persist_failed', 409)
  }

  dependencies.log?.('preflight_passed')
  let containerId = ''
  try {
    containerId = await dependencies.createContainer({
      instagramUserId: account.instagramUserId,
      pageAccessToken: account.pageAccessToken,
      imageUrl: dependencies.buildLeaseUrl(input.capability),
      caption: job.caption,
    })
  } catch {
    dependencies.log?.('container_failed')
    return safeFailure('container_create_failed', 502, { container_count: 0, publish_count: 0 })
  }
  if (!META_ID_PATTERN.test(containerId)) return safeFailure('container_create_failed', 502)

  if (!await dependencies.startContainerPolling({
    jobId: job.id,
    claimToken: input.claimToken,
    containerId,
    leaseId: lease.id,
  }).catch(() => false)) {
    return safeFailure('container_persist_failed', 409, { container_id: containerId, container_count: 1, publish_count: 0 })
  }
  dependencies.log?.('container_persisted')

  const statuses: InstagramContainerStatus[] = []
  const maxPolls = dependencies.maxPolls ?? 20
  const pollIntervalMs = dependencies.pollIntervalMs ?? 2000
  const sleep = dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
  let finished = false

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    let status: InstagramContainerStatus
    try {
      status = await dependencies.getContainerStatus({ containerId, pageAccessToken: account.pageAccessToken })
    } catch {
      const nextPollAt = new Date((dependencies.now?.() ?? Date.now()) + 5 * 60_000).toISOString()
      await dependencies.deferPollTimeout({ jobId: job.id, claimToken: input.claimToken, containerId, nextPollAt }).catch(() => false)
      return safeFailure('poll_failed', 502, { container_id: containerId, container_count: 1, publish_count: 0, statuses })
    }
    statuses.push(status)
    if (status === 'FINISHED') {
      if (!await dependencies.recordPoll({ jobId: job.id, claimToken: input.claimToken, containerId, status }).catch(() => false)) {
        return safeFailure('poll_persist_failed', 409, { container_id: containerId, container_count: 1, publish_count: 0, statuses })
      }
      finished = true
      break
    }
    if (status === 'ERROR' || status === 'EXPIRED') {
      await dependencies.recordPoll({ jobId: job.id, claimToken: input.claimToken, containerId, status }).catch(() => false)
      return safeFailure(status === 'ERROR' ? 'container_error' : 'container_expired', 409, {
        container_id: containerId, container_count: 1, publish_count: 0, statuses,
      })
    }
    const nextPollAt = new Date((dependencies.now?.() ?? Date.now()) + pollIntervalMs).toISOString()
    if (!await dependencies.recordPoll({ jobId: job.id, claimToken: input.claimToken, containerId, status, nextPollAt }).catch(() => false)) {
      return safeFailure('poll_persist_failed', 409, { container_id: containerId, container_count: 1, publish_count: 0, statuses })
    }
    if (attempt + 1 < maxPolls) await sleep(pollIntervalMs)
  }

  if (!finished) {
    const nextPollAt = new Date((dependencies.now?.() ?? Date.now()) + 5 * 60_000).toISOString()
    await dependencies.deferPollTimeout({ jobId: job.id, claimToken: input.claimToken, containerId, nextPollAt }).catch(() => false)
    return safeFailure('poll_timeout', 504, { container_id: containerId, container_count: 1, publish_count: 0, statuses })
  }

  let postId = ''
  try {
    postId = await dependencies.publishContainer({
      instagramUserId: account.instagramUserId,
      pageAccessToken: account.pageAccessToken,
      containerId,
    })
  } catch {
    await dependencies.markReconciliationRequired({ jobId: job.id, claimToken: input.claimToken }).catch(() => false)
    return safeFailure('media_publish_failed', 502, { container_id: containerId, container_count: 1, publish_count: 1, statuses })
  }
  if (!META_ID_PATTERN.test(postId)) {
    await dependencies.markReconciliationRequired({ jobId: job.id, claimToken: input.claimToken }).catch(() => false)
    return safeFailure('media_publish_failed', 502, { container_id: containerId, container_count: 1, publish_count: 1, statuses })
  }

  const postDetail = await dependencies.getPostDetail({ postId, pageAccessToken: account.pageAccessToken }).catch(() => null)
  const permalink = postDetail?.id === postId ? postDetail.permalink : null
  if (!await dependencies.completeJob({
    jobId: job.id,
    claimToken: input.claimToken,
    containerId,
    postId,
    permalink,
  }).catch(() => false)) {
    return safeFailure('completion_persist_failed', 409, {
      container_id: containerId, post_id: postId, container_count: 1, publish_count: 1, statuses,
    })
  }

  const visible = Boolean(postDetail
    && postDetail.id === postId
    && postDetail.username?.toLowerCase() === account.instagramUsername.toLowerCase()
    && postDetail.caption === job.caption
    && postDetail.permalink?.startsWith('https://www.instagram.com/'))
  dependencies.log?.('published', { visible })
  return json({
    ok: true,
    job_id: job.id,
    account: `@${account.instagramUsername}`,
    container_id: containerId,
    post_id: postId,
    final_status: 'published',
    lease_closed: true,
    caption_matches: postDetail?.caption === job.caption,
    post_visible: visible,
    container_count: 1,
    publish_count: 1,
    statuses,
  })
}

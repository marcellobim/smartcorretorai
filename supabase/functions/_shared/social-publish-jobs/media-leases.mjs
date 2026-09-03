const MAX_TTL_SECONDS = 24 * 60 * 60
const ALLOWED_METHODS = new Set(['GET', 'HEAD'])
const TERMINAL_JOB_STATES = new Set(['published', 'failed', 'cancelled'])

const assertDate = (value, code) => {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error(code)
  return parsed
}

const assertOpaqueToken = token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error('invalid_opaque_lease_token')
  }
}

export async function createSocialMediaLease(input, dependencies) {
  const now = assertDate(input?.now ?? new Date(), 'invalid_lease_time')
  const ttlSeconds = input?.ttlSeconds
  const requiredWindowSeconds = input?.requiredExternalWindowSeconds
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > MAX_TTL_SECONDS
    || !Number.isInteger(requiredWindowSeconds) || requiredWindowSeconds < 60
    || requiredWindowSeconds > ttlSeconds) {
    throw new Error('invalid_lease_ttl')
  }

  const job = await dependencies.loadJob(input.jobId)
  if (!job || job.status !== 'processing' || job.externalPublishStartedAt) {
    throw new Error('job_not_leaseable')
  }
  if (!job.media || job.media.bucket !== input.bucket || job.media.path !== input.objectPath) {
    throw new Error('job_object_mismatch')
  }

  const object = await dependencies.headPrivateObject(input.bucket, input.objectPath)
  if (!object || object.isPublic || object.ownerId !== job.userId) throw new Error('private_owned_object_required')
  if (object.contentType !== input.contentType || object.contentLength !== input.contentLength) {
    throw new Error('object_metadata_mismatch')
  }

  const opaqueToken = await dependencies.generateOpaqueToken()
  assertOpaqueToken(opaqueToken)
  const tokenHash = await dependencies.hashOpaqueToken(opaqueToken)
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
  const persisted = await dependencies.persistLease({
    jobId: job.id,
    userId: job.userId,
    bucket: input.bucket,
    objectPath: input.objectPath,
    contentType: object.contentType,
    contentLength: object.contentLength,
    opaqueTokenHash: tokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    requiredExternalWindowSeconds: requiredWindowSeconds,
  })

  const baseUrl = String(dependencies.leaseBaseUrl || '').replace(/\/$/, '')
  if (!/^https:\/\//.test(baseUrl)) throw new Error('invalid_lease_base_url')
  return {
    leaseId: persisted.leaseId,
    url: `${baseUrl}/${opaqueToken}`,
    expiresAt: expiresAt.toISOString(),
    contentType: object.contentType,
    contentLength: object.contentLength,
  }
}

export function assertLeaseWindowForExternalStart(lease, options = {}) {
  const now = assertDate(options.now ?? new Date(), 'invalid_lease_time')
  const requiredSeconds = options.requiredExternalWindowSeconds
  if (!Number.isInteger(requiredSeconds) || requiredSeconds < 60 || requiredSeconds > MAX_TTL_SECONDS) {
    throw new Error('invalid_external_window')
  }
  if (!lease || lease.status !== 'active') throw new Error('lease_not_active')
  const expiresAt = assertDate(lease.expiresAt, 'invalid_lease_expiry')
  if (expiresAt.getTime() - now.getTime() < requiredSeconds * 1000) {
    throw new Error('insufficient_lease_window')
  }
  return true
}

export async function serveSocialMediaLease(request, dependencies, options = {}) {
  const method = String(request?.method || '').toUpperCase()
  if (!ALLOWED_METHODS.has(method)) return { status: 405, headers: { Allow: 'GET, HEAD' }, body: null }
  assertOpaqueToken(request.opaqueToken)
  const now = assertDate(options.now ?? new Date(), 'invalid_lease_time')
  const tokenHash = await dependencies.hashOpaqueToken(request.opaqueToken)
  const lease = await dependencies.resolveLeaseByHash(tokenHash)
  if (!lease || lease.status === 'revoked' || lease.status === 'closed') return { status: 410, headers: {}, body: null }
  if (lease.status !== 'active' || assertDate(lease.expiresAt, 'invalid_lease_expiry') <= now) {
    return { status: 410, headers: {}, body: null }
  }

  const object = await dependencies.headPrivateObject(lease.bucket, lease.objectPath)
  if (!object || object.isPublic || object.ownerId !== lease.userId
    || object.contentType !== lease.contentType || object.contentLength !== lease.contentLength) {
    return { status: 404, headers: {}, body: null }
  }

  const headers = {
    'Content-Type': lease.contentType,
    'Content-Length': String(lease.contentLength),
    'Cache-Control': 'private, no-store',
  }
  if (method === 'HEAD') return { status: 200, headers, body: null }
  const body = await dependencies.readPrivateObject(lease.bucket, lease.objectPath)
  return { status: 200, headers, body }
}

export async function revokeSocialMediaLease(leaseId, dependencies) {
  if (typeof leaseId !== 'string' || !leaseId) throw new Error('invalid_lease_id')
  return dependencies.revokeLease(leaseId)
}

export async function cleanupSocialMediaLease(job, lease, dependencies, options = {}) {
  const now = assertDate(options.now ?? new Date(), 'invalid_lease_time')
  if (!job || !lease || lease.jobId !== job.id) throw new Error('lease_job_mismatch')
  if (job.externalContainerStatus === 'IN_PROGRESS') {
    return { closed: false, deleted: false, reason: 'external_container_in_progress' }
  }
  if (!TERMINAL_JOB_STATES.has(job.status)) {
    return { closed: false, deleted: false, reason: 'job_not_terminal' }
  }

  const closed = lease.status === 'active' ? await dependencies.closeLease(lease.id) : false
  const expired = assertDate(lease.expiresAt, 'invalid_lease_expiry') <= now
  let deleted = false
  if (expired) {
    await dependencies.deletePrivateObject(lease.bucket, lease.objectPath)
    deleted = true
  }
  return { closed: Boolean(closed), deleted, reason: expired ? 'retention_elapsed' : 'terminal_closed' }
}

export const SOCIAL_MEDIA_LEASE_MAX_TTL_SECONDS = MAX_TTL_SECONDS

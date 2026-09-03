const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const MAX_LEASE_TTL_MS = 24 * 60 * 60 * 1000
const COMPATIBLE_JOB_STATES = new Set([
  'processing',
  'publishing',
  'reconciliation_required',
  'retry_scheduled',
])

export type SocialMediaLease = {
  id: string
  job_id: string
  user_id: string
  bucket_id: string
  object_path: string
  content_type: 'image/jpeg' | 'image/png' | 'video/mp4'
  content_length: number
  opaque_token_hash: string
  status: 'active' | 'revoked' | 'expired' | 'closed'
  created_at: string
  expires_at: string
}
export type SocialPublishJobLeaseScope = {
  id: string
  user_id: string
  status: string
  media_lease_id: string | null
}

export type SocialMediaLeaseDependencies = {
  findLeaseByHash(hash: string): Promise<SocialMediaLease | null>
  findJob(jobId: string): Promise<SocialPublishJobLeaseScope | null>
  getBucket(bucketId: string): Promise<{ id: string; public: boolean } | null>
  downloadObject(bucketId: string, objectPath: string): Promise<Blob | null>
  now?: () => number
  log?: (event: 'social_media_lease', details: {
    method: string
    outcome: string
  }) => void
}

function capabilityFromUrl(rawUrl: string) {
  const url = new URL(rawUrl)
  if (url.search || url.hash) return ''
  const marker = '/social-media-lease/'
  const markerIndex = url.pathname.lastIndexOf(marker)
  if (markerIndex < 0) return ''
  const capability = url.pathname.slice(markerIndex + marker.length)
  return CAPABILITY_PATTERN.test(capability) ? capability : ''
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function hashCapability(capability: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(capability))
  return toHex(new Uint8Array(digest))
}

function responseHeaders(contentType?: string, contentLength?: number) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
  })
  if (contentType) headers.set('Content-Type', contentType)
  if (contentLength !== undefined) headers.set('Content-Length', String(contentLength))
  return headers
}

function unavailable(method: string) {
  return new Response(method === 'HEAD' ? null : 'Not found', {
    status: 404,
    headers: responseHeaders('text/plain; charset=utf-8', method === 'HEAD' ? 0 : 9),
  })
}

function methodNotAllowed(method: string) {
  const headers = responseHeaders('text/plain; charset=utf-8', 18)
  headers.set('Allow', 'GET, HEAD')
  return new Response('Method not allowed', { status: 405, headers })
}

function validLeaseWindow(lease: SocialMediaLease, now: number) {
  const createdAt = Date.parse(lease.created_at)
  const expiresAt = Date.parse(lease.expires_at)
  return Number.isFinite(createdAt)
    && Number.isFinite(expiresAt)
    && expiresAt > now
    && expiresAt > createdAt
    && expiresAt - createdAt <= MAX_LEASE_TTL_MS
}

function validObjectPath(lease: SocialMediaLease) {
  if (!lease.object_path.startsWith(`${lease.user_id}/`) || lease.object_path.length > 1024) return false
  const segments = lease.object_path.split('/')
  return segments.every(segment => segment && segment !== '.' && segment !== '..')
}

function validJobScope(lease: SocialMediaLease, job: SocialPublishJobLeaseScope | null) {
  if (!job || job.id !== lease.job_id || job.user_id !== lease.user_id || !COMPATIBLE_JOB_STATES.has(job.status)) {
    return false
  }
  if (job.status === 'processing') return job.media_lease_id === null || job.media_lease_id === lease.id
  return job.media_lease_id === lease.id
}

export async function handleSocialMediaLease(
  request: Request,
  dependencies: SocialMediaLeaseDependencies,
) {
  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    dependencies.log?.('social_media_lease', { method, outcome: 'method_blocked' })
    return methodNotAllowed(method)
  }

  const capability = capabilityFromUrl(request.url)
  if (!capability) {
    dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
    return unavailable(method)
  }

  try {
    const capabilityHash = await hashCapability(capability)
    if (!SHA256_PATTERN.test(capabilityHash)) return unavailable(method)

    const lease = await dependencies.findLeaseByHash(capabilityHash)
    const now = dependencies.now?.() ?? Date.now()
    if (!lease
      || lease.opaque_token_hash !== capabilityHash
      || lease.status !== 'active'
      || !validLeaseWindow(lease, now)
      || !validObjectPath(lease)) {
      dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
      return unavailable(method)
    }

    const job = await dependencies.findJob(lease.job_id)
    if (!validJobScope(lease, job)) {
      dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
      return unavailable(method)
    }

    const bucket = await dependencies.getBucket(lease.bucket_id)
    if (!bucket || bucket.id !== lease.bucket_id || bucket.public) {
      dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
      return unavailable(method)
    }

    const object = await dependencies.downloadObject(lease.bucket_id, lease.object_path)
    if (!object
      || object.type.toLowerCase() !== lease.content_type
      || object.size !== lease.content_length) {
      dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
      return unavailable(method)
    }

    const headers = responseHeaders(lease.content_type, lease.content_length)
    headers.set('Content-Disposition', 'inline')
    dependencies.log?.('social_media_lease', { method, outcome: 'served' })
    return new Response(method === 'HEAD' ? null : object, { status: 200, headers })
  } catch {
    dependencies.log?.('social_media_lease', { method, outcome: 'unavailable' })
    return unavailable(method)
  }
}

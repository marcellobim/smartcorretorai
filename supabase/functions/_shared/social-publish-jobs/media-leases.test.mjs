import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertLeaseWindowForExternalStart,
  cleanupSocialMediaLease,
  createSocialMediaLease,
  revokeSocialMediaLease,
  serveSocialMediaLease,
} from './media-leases.mjs'

const NOW = new Date('2026-08-30T12:00:00.000Z')
const TOKEN = 'opaque_token_abcdefghijklmnopqrstuvwxyz_123456'

const baseFixture = overrides => {
  const calls = { head: [], read: [], persist: [], revoke: [], close: [], delete: [], list: 0, public: 0 }
  const job = {
    id: 'job-lease-1', userId: 'user-1', status: 'processing', externalPublishStartedAt: null,
    media: { bucket: 'private-media', path: 'user-1/jobs/job-lease-1/photo.jpg' },
  }
  const object = { ownerId: 'user-1', isPublic: false, contentType: 'image/jpeg', contentLength: 12345 }
  const lease = {
    id: 'lease-1', jobId: job.id, userId: job.userId, status: 'active',
    bucket: job.media.bucket, objectPath: job.media.path,
    contentType: object.contentType, contentLength: object.contentLength,
    expiresAt: '2026-08-31T12:00:00.000Z',
  }
  const dependencies = {
    leaseBaseUrl: 'https://leases.example.test/media',
    loadJob: async () => ({ ...job, ...(overrides?.job || {}) }),
    headPrivateObject: async (bucket, path) => {
      calls.head.push({ bucket, path })
      return { ...object, ...(overrides?.object || {}) }
    },
    generateOpaqueToken: async () => TOKEN,
    hashOpaqueToken: async token => `hash:${token}`,
    persistLease: async input => { calls.persist.push(input); return { leaseId: lease.id } },
    resolveLeaseByHash: async () => ({ ...lease, ...(overrides?.lease || {}) }),
    readPrivateObject: async (bucket, path) => { calls.read.push({ bucket, path }); return 'binary-body' },
    revokeLease: async id => { calls.revoke.push(id); return true },
    closeLease: async id => { calls.close.push(id); return true },
    deletePrivateObject: async (bucket, path) => { calls.delete.push({ bucket, path }) },
  }
  return { calls, job, object, lease, dependencies }
}

const createInput = overrides => ({
  jobId: 'job-lease-1', bucket: 'private-media', objectPath: 'user-1/jobs/job-lease-1/photo.jpg',
  contentType: 'image/jpeg', contentLength: 12345, ttlSeconds: 86400,
  requiredExternalWindowSeconds: 3600, now: NOW, ...overrides,
})

test('valid lease creation returns an opaque URL and exact metadata', async () => {
  const { dependencies, calls } = baseFixture()
  const result = await createSocialMediaLease(createInput(), dependencies)
  assert.equal(result.url, `https://leases.example.test/media/${TOKEN}`)
  assert.equal(result.contentType, 'image/jpeg')
  assert.equal(result.contentLength, 12345)
  assert.equal(calls.persist[0].opaqueTokenHash, `hash:${TOKEN}`)
  assert.equal(result.url.includes('access_token'), false)
})

test('object owned by another user is blocked', async () => {
  const { dependencies } = baseFixture({ object: { ownerId: 'user-2' } })
  await assert.rejects(createSocialMediaLease(createInput(), dependencies), /private_owned_object_required/)
})

test('different object from the job binding is blocked', async () => {
  const { dependencies } = baseFixture()
  await assert.rejects(createSocialMediaLease(createInput({ objectPath: 'user-1/other.jpg' }), dependencies), /job_object_mismatch/)
})

test('expired lease cannot be served', async () => {
  const { dependencies } = baseFixture({ lease: { expiresAt: '2026-08-30T11:59:59.000Z' } })
  const response = await serveSocialMediaLease({ method: 'GET', opaqueToken: TOKEN }, dependencies, { now: NOW })
  assert.equal(response.status, 410)
})

test('revoked lease cannot be served', async () => {
  const { dependencies, calls } = baseFixture({ lease: { status: 'revoked' } })
  assert.equal(await revokeSocialMediaLease('lease-1', dependencies), true)
  assert.deepEqual(calls.revoke, ['lease-1'])
  const response = await serveSocialMediaLease({ method: 'GET', opaqueToken: TOKEN }, dependencies, { now: NOW })
  assert.equal(response.status, 410)
})

test('GET returns the private object with exact type and size', async () => {
  const { dependencies } = baseFixture()
  const response = await serveSocialMediaLease({ method: 'GET', opaqueToken: TOKEN }, dependencies, { now: NOW })
  assert.equal(response.status, 200)
  assert.equal(response.headers['Content-Type'], 'image/jpeg')
  assert.equal(response.headers['Content-Length'], '12345')
  assert.equal(response.body, 'binary-body')
})

test('HEAD returns metadata without reading the object body', async () => {
  const { dependencies, calls } = baseFixture()
  const response = await serveSocialMediaLease({ method: 'HEAD', opaqueToken: TOKEN }, dependencies, { now: NOW })
  assert.equal(response.status, 200)
  assert.equal(response.body, null)
  assert.equal(calls.read.length, 0)
})

test('methods other than GET and HEAD are blocked', async () => {
  const { dependencies } = baseFixture()
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await serveSocialMediaLease({ method, opaqueToken: TOKEN }, dependencies, { now: NOW })
    assert.equal(response.status, 405)
    assert.equal(response.headers.Allow, 'GET, HEAD')
  }
})

test('IN_PROGRESS prevents lease closure and premature media deletion', async () => {
  const { dependencies, calls, job, lease } = baseFixture({ lease: { expiresAt: '2026-08-30T11:00:00.000Z' } })
  const result = await cleanupSocialMediaLease(
    { ...job, status: 'failed', externalContainerStatus: 'IN_PROGRESS' },
    { ...lease, expiresAt: '2026-08-30T11:00:00.000Z' }, dependencies, { now: NOW },
  )
  assert.deepEqual(result, { closed: false, deleted: false, reason: 'external_container_in_progress' })
  assert.equal(calls.close.length, 0)
  assert.equal(calls.delete.length, 0)
})

test('published permits safe lease closure and cleanup after retention', async () => {
  const { dependencies, calls, job, lease } = baseFixture()
  const result = await cleanupSocialMediaLease(
    { ...job, status: 'published', externalContainerStatus: 'FINISHED' },
    { ...lease, expiresAt: '2026-08-30T11:00:00.000Z' }, dependencies, { now: NOW },
  )
  assert.equal(result.closed, true)
  assert.equal(result.deleted, true)
  assert.deepEqual(calls.close, ['lease-1'])
  assert.equal(calls.delete.length, 1)
})

test('external start is rejected when lease lacks the required remaining window', () => {
  assert.throws(() => assertLeaseWindowForExternalStart(
    { status: 'active', expiresAt: '2026-08-30T12:30:00.000Z' },
    { now: NOW, requiredExternalWindowSeconds: 3600 },
  ), /insufficient_lease_window/)
})

test('media remains private and no permanent-public or list operation exists', async () => {
  const { dependencies, calls } = baseFixture()
  await createSocialMediaLease(createInput(), dependencies)
  assert.equal('listObjects' in dependencies, false)
  assert.equal('makePublic' in dependencies, false)
  assert.equal(calls.list, 0)
  assert.equal(calls.public, 0)
})

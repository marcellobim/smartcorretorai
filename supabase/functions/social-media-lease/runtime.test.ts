import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  handleSocialMediaLease,
  type SocialMediaLease,
  type SocialMediaLeaseDependencies,
  type SocialPublishJobLeaseScope,
} from './runtime.ts'

const NOW = Date.parse('2026-08-30T18:00:00.000Z')
const CAPABILITY = '0123456789abcdef0123456789abcdef0123456789a'
const HASH = '263b9741bfc84598b8f5688c5481887c8493d40b0b557de2f2f9b0329139c5db'
const USER_ID = '653b5a06-9b7a-4009-9a8c-6e3ea701460c'
const JOB_ID = 'cad35ada-6bef-4e0c-9f22-80433a36f60b'
const LEASE_ID = 'b2ad5c61-0820-4d5a-bce6-acde10726225'
const BUCKET = 'smartcorretor-assets'
const PATH = `${USER_ID}/hero-ia-next/source/hero-principal.jpg`
const BYTES = new TextEncoder().encode('jpeg-fixture')

const storedLease = (overrides: Partial<SocialMediaLease> = {}): SocialMediaLease => ({
  id: LEASE_ID,
  job_id: JOB_ID,
  user_id: USER_ID,
  bucket_id: BUCKET,
  object_path: PATH,
  content_type: 'image/jpeg',
  content_length: BYTES.length,
  opaque_token_hash: HASH,
  status: 'active',
  created_at: '2026-08-30T17:55:00.000Z',
  expires_at: '2026-08-31T17:55:00.000Z',
  ...overrides,
})

const storedJob = (overrides: Partial<SocialPublishJobLeaseScope> = {}): SocialPublishJobLeaseScope => ({
  id: JOB_ID,
  user_id: USER_ID,
  status: 'processing',
  media_lease_id: null,
  ...overrides,
})

function request(method = 'GET', capability = CAPABILITY) {
  return new Request(`https://project.supabase.co/functions/v1/social-media-lease/${capability}`, { method })
}

function setup(options: {
  lease?: SocialMediaLease | null
  job?: SocialPublishJobLeaseScope | null
  bucket?: { id: string; public: boolean } | null
  object?: Blob | null
} = {}) {
  const calls: Array<{ bucket: string; path: string }> = []
  const logs: Array<Record<string, string>> = []
  const lease = options.lease === undefined ? storedLease() : options.lease
  const job = options.job === undefined ? storedJob() : options.job
  const bucket = options.bucket === undefined ? { id: BUCKET, public: false } : options.bucket
  const object = options.object === undefined ? new Blob([BYTES], { type: 'image/jpeg' }) : options.object
  const dependencies: SocialMediaLeaseDependencies = {
    findLeaseByHash: async hash => hash === HASH ? lease : null,
    findJob: async jobId => jobId === JOB_ID ? job : null,
    getBucket: async bucketId => bucketId === BUCKET ? bucket : null,
    downloadObject: async (bucketId, objectPath) => {
      calls.push({ bucket: bucketId, path: objectPath })
      return bucketId === BUCKET && objectPath === PATH ? object : null
    },
    now: () => NOW,
    log: (_event, details) => logs.push(details),
  }
  return { dependencies, calls, logs }
}

test('GET serves only the exact private JPEG with safe headers', async () => {
  const context = setup()
  const response = await handleSocialMediaLease(request(), context.dependencies)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.equal(response.headers.get('content-length'), String(BYTES.length))
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), BYTES)
  assert.deepEqual(context.calls, [{ bucket: BUCKET, path: PATH }])
})

test('HEAD validates the exact object and returns headers without a body', async () => {
  const context = setup()
  const response = await handleSocialMediaLease(request('HEAD'), context.dependencies)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/jpeg')
  assert.equal(response.headers.get('content-length'), String(BYTES.length))
  assert.equal((await response.arrayBuffer()).byteLength, 0)
  assert.deepEqual(context.calls, [{ bucket: BUCKET, path: PATH }])
})

test('expired, overlong and revoked leases are unavailable', async () => {
  for (const lease of [
    storedLease({ expires_at: '2026-08-30T17:59:59.000Z' }),
    storedLease({ created_at: '2026-08-29T17:54:59.000Z' }),
    storedLease({ status: 'revoked' }),
  ]) {
    assert.equal((await handleSocialMediaLease(request(), setup({ lease }).dependencies)).status, 404)
  }
})

test('invalid capability and query/path mutations do not enumerate leases', async () => {
  for (const url of [
    'https://project.supabase.co/functions/v1/social-media-lease/invalid',
    `https://project.supabase.co/functions/v1/social-media-lease/${CAPABILITY}/other.jpg`,
    `https://project.supabase.co/functions/v1/social-media-lease/${CAPABILITY}?path=other.jpg`,
  ]) {
    const response = await handleSocialMediaLease(new Request(url), setup().dependencies)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not found')
  }
})

test('foreign paths, public buckets and incompatible jobs are unavailable', async () => {
  const cases = [
    setup({ lease: storedLease({ object_path: 'other-user/hero.jpg' }) }),
    setup({ bucket: { id: BUCKET, public: true } }),
    setup({ job: storedJob({ user_id: 'other-user' }) }),
    setup({ job: storedJob({ status: 'queued' }) }),
    setup({ job: storedJob({ status: 'publishing', media_lease_id: 'different-lease' }) }),
  ]
  for (const context of cases) {
    assert.equal((await handleSocialMediaLease(request(), context.dependencies)).status, 404)
  }
})

test('missing object and mismatched Content-Type or Content-Length are unavailable', async () => {
  for (const context of [
    setup({ object: null }),
    setup({ object: new Blob([BYTES], { type: 'image/png' }) }),
    setup({ object: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }) }),
  ]) {
    assert.equal((await handleSocialMediaLease(request(), context.dependencies)).status, 404)
  }
})

test('POST, PUT, DELETE and OPTIONS are blocked without object access', async () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const context = setup()
    const response = await handleSocialMediaLease(request(method), context.dependencies)
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET, HEAD')
    assert.equal(context.calls.length, 0)
  }
})

test('logs never receive capability, hash, user id or object path', async () => {
  const context = setup()
  await handleSocialMediaLease(request(), context.dependencies)
  const rendered = JSON.stringify(context.logs)
  for (const secret of [CAPABILITY, HASH, USER_ID, PATH]) assert.doesNotMatch(rendered, new RegExp(secret))
})

test('Edge entrypoint uses server credentials and config exposes only capability authentication', () => {
  const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  const config = readFileSync(new URL('../../config.toml', import.meta.url), 'utf8')
  assert.match(index, /resolveSupabaseAdminCredential\(\)\.key/)
  assert.doesNotMatch(index, /Access-Control-Allow-Origin|withCors|signedUrl|createSignedUrl/)
  assert.match(config, /\[functions\.social-media-lease\]\s+verify_jwt = false/)
})

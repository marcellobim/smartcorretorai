import test from 'node:test'
import assert from 'node:assert/strict'
import { handleInstagramJobPublish, type InstagramContainerStatus, type InstagramJobPublishDependencies } from './runtime.ts'

const JOB_ID = 'cad35ada-6bef-4e0c-9f22-80433a36f60b'
const CLAIM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CAP = '0123456789abcdef0123456789abcdef0123456789a'
const HASH = 'hash'
const CONTAINER = '18000000000000001'
const POST = '18000000000000002'
const CAPTION = 'TESTE - Publicação de validação do SmartCorretorAI.'

const request = (overrides = {}) => new Request('https://local/social-publish-instagram-job', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ job_id: JOB_ID, claim_token: CLAIM, lease_capability: CAP, ...overrides }),
})
function setup(statuses: InstagramContainerStatus[] = ['FINISHED']) {
  const calls = { create: 0, publish: 0, polls: [] as InstagramContainerStatus[], complete: 0, reconcile: 0 }
  const queue = [...statuses]
  const dependencies: InstagramJobPublishDependencies = {
    getJob: async () => ({ id: JOB_ID, userId: 'user', connectionId: 'connection', caption: CAPTION, claimToken: CLAIM }),
    getLease: async () => ({ id: 'lease', jobId: JOB_ID, capabilityHash: HASH, expiresAt: '2026-08-31T18:00:00.000Z', contentType: 'image/jpeg', contentLength: 166013 }),
    hashCapability: async () => HASH,
    validateLeaseUrl: async () => true,
    getActiveAccount: async () => ({ instagramUserId: '17841400000000000', instagramUsername: 'smartcorretorai', pageName: 'SmartCorretorAI', pageAccessToken: 'secret' }),
    validateConnection: async () => true,
    recordConnectionValidation: async () => true,
    createContainer: async input => { calls.create += 1; assert.equal(input.caption, CAPTION); return CONTAINER },
    startContainerPolling: async () => true,
    getContainerStatus: async () => queue.shift() || 'IN_PROGRESS',
    recordPoll: async input => { calls.polls.push(input.status); return true },
    deferPollTimeout: async () => true,
    publishContainer: async () => { calls.publish += 1; return POST },
    markReconciliationRequired: async () => { calls.reconcile += 1; return true },
    getPostDetail: async () => ({ id: POST, permalink: 'https://www.instagram.com/p/test/', caption: CAPTION, username: 'smartcorretorai' }),
    completeJob: async () => { calls.complete += 1; return true },
    sleep: async () => undefined,
    now: () => Date.parse('2026-08-30T18:00:00.000Z'),
    maxPolls: statuses.length || 1,
    pollIntervalMs: 1,
    buildLeaseUrl: capability => `https://project/functions/v1/social-media-lease/${capability}`,
  }
  return { dependencies, calls }
}

test('creates one container, waits for FINISHED and publishes exactly once', async () => {
  const context = setup(['IN_PROGRESS', 'FINISHED'])
  const response = await handleInstagramJobPublish(request(), context.dependencies)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.final_status, 'published')
  assert.equal(body.caption_matches, true)
  assert.equal(body.post_visible, true)
  assert.deepEqual(context.calls, { create: 1, publish: 1, polls: ['IN_PROGRESS', 'FINISHED'], complete: 1, reconcile: 0 })
})

test('ERROR and EXPIRED stop without media_publish or another container', async () => {
  for (const status of ['ERROR', 'EXPIRED'] as const) {
    const context = setup([status])
    const response = await handleInstagramJobPublish(request(), context.dependencies)
    assert.equal(response.status, 409)
    assert.equal(context.calls.create, 1)
    assert.equal(context.calls.publish, 0)
    assert.equal(context.calls.complete, 0)
  }
})

test('poll timeout stops with the same container and no publish', async () => {
  const context = setup(['IN_PROGRESS', 'IN_PROGRESS'])
  const response = await handleInstagramJobPublish(request(), context.dependencies)
  assert.equal(response.status, 504)
  assert.equal(context.calls.create, 1)
  assert.equal(context.calls.publish, 0)
})

test('media_publish failure is not retried and requires reconciliation', async () => {
  const context = setup(['FINISHED'])
  context.dependencies.publishContainer = async () => { context.calls.publish += 1; throw new Error('ambiguous') }
  const response = await handleInstagramJobPublish(request(), context.dependencies)
  assert.equal(response.status, 502)
  assert.equal(context.calls.create, 1)
  assert.equal(context.calls.publish, 1)
  assert.equal(context.calls.reconcile, 1)
})

test('invalid lease or connection fails before any Meta publishing operation', async () => {
  const lease = setup()
  lease.dependencies.validateLeaseUrl = async () => false
  assert.equal((await handleInstagramJobPublish(request(), lease.dependencies)).status, 409)
  assert.equal(lease.calls.create, 0)
  const connection = setup()
  connection.dependencies.validateConnection = async () => false
  assert.equal((await handleInstagramJobPublish(request(), connection.dependencies)).status, 401)
  assert.equal(connection.calls.create, 0)
})

test('request cannot alter caption, account, asset or destination', async () => {
  for (const extra of [{ caption: 'changed' }, { user_id: 'other' }, { image_url: 'https://other' }, { destination: 'facebook' }]) {
    const context = setup()
    assert.equal((await handleInstagramJobPublish(request(extra), context.dependencies)).status, 400)
    assert.equal(context.calls.create, 0)
  }
})

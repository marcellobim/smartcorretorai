import test from 'node:test'
import assert from 'node:assert/strict'
import { pollSocialPublishContainer } from './polling.mjs'

const NOW = new Date('2026-08-30T12:00:00.000Z')

const job = overrides => ({
  jobId: 'job-1',
  claimToken: 'claim-1',
  expectedStatus: 'publishing',
  externalContainerId: 'container-existing-1',
  pollAttemptCount: 2,
  nextPollAt: null,
  ...overrides,
})

const fixture = statusOrError => {
  const calls = { fetch: [], results: [], timeouts: [], create: 0, publish: 0 }
  return {
    calls,
    dependencies: {
      fetchExternalContainerStatus: async input => {
        calls.fetch.push(input)
        if (statusOrError instanceof Error) throw statusOrError
        return statusOrError
      },
      persistResult: async input => { calls.results.push(input) },
      persistTimeout: async input => { calls.timeouts.push(input) },
    },
  }
}

test('IN_PROGRESS keeps the same job waiting and schedules another poll', async () => {
  const { dependencies, calls } = fixture('IN_PROGRESS')
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.outcome, 'waiting')
  assert.equal(result.mediaPublishAllowed, false)
  assert.equal(result.pollAttemptCount, 3)
  assert.ok(Date.parse(result.nextPollAt) > NOW.getTime())
  assert.equal(calls.results[0].externalStatus, 'IN_PROGRESS')
  assert.equal(calls.results[0].nextPollAt, result.nextPollAt)
})

test('FINISHED is the only result that enables future media publish', async () => {
  const { dependencies, calls } = fixture('FINISHED')
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.outcome, 'ready_for_publish')
  assert.equal(result.mediaPublishAllowed, true)
  assert.equal(result.nextPollAt, null)
  assert.equal(calls.results[0].externalStatus, 'FINISHED')
})

test('ERROR becomes failed with a sanitized error', async () => {
  const { dependencies } = fixture('ERROR')
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.outcome, 'failed')
  assert.equal(result.errorCode, 'social_publish_failed')
  assert.equal(result.mediaPublishAllowed, false)
})

test('EXPIRED becomes failed without requesting another container', async () => {
  const { dependencies, calls } = fixture('EXPIRED')
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.outcome, 'failed')
  assert.equal(result.errorCode, 'external_container_expired')
  assert.equal(result.mediaPublishAllowed, false)
  assert.equal(calls.create, 0)
})

test('ambiguous timeout schedules the same container and does not create or publish', async () => {
  const { dependencies, calls } = fixture(new Error('timeout with raw provider details'))
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.outcome, 'waiting')
  assert.equal(result.reason, 'ambiguous_timeout')
  assert.equal(result.externalContainerId, 'container-existing-1')
  assert.equal(calls.timeouts[0].externalContainerId, 'container-existing-1')
  assert.equal(calls.create, 0)
  assert.equal(calls.publish, 0)
})

test('an existing container is queried and persisted by the same id', async () => {
  const { dependencies, calls } = fixture('IN_PROGRESS')
  await pollSocialPublishContainer(job({ externalContainerId: 'container-stable-77' }), dependencies, { now: NOW })
  assert.deepEqual(calls.fetch, [{ externalContainerId: 'container-stable-77' }])
  assert.equal(calls.results[0].externalContainerId, 'container-stable-77')
})

test('polling has no container creation capability and never duplicates one', async () => {
  for (const status of ['IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED']) {
    const { dependencies, calls } = fixture(status)
    await pollSocialPublishContainer(job(), dependencies, { now: NOW })
    assert.equal('createExternalContainer' in dependencies, false)
    assert.equal(calls.create, 0)
  }
})

test('no state except FINISHED permits publish and polling itself never publishes', async () => {
  for (const status of ['IN_PROGRESS', 'ERROR', 'EXPIRED']) {
    const { dependencies, calls } = fixture(status)
    const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
    assert.equal(result.mediaPublishAllowed, false)
    assert.equal(calls.publish, 0)
  }
  const { dependencies, calls } = fixture('FINISHED')
  const result = await pollSocialPublishContainer(job(), dependencies, { now: NOW })
  assert.equal(result.mediaPublishAllowed, true)
  assert.equal(calls.publish, 0)
})

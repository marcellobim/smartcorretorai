import test from 'node:test'
import assert from 'node:assert/strict'

import { createMetaRegistrationDispatcher } from '../src/lib/meta-registration-dispatcher.js'

function createHarness({ marketing = 'granted', ready = false } = {}) {
  let currentMarketing = marketing
  let currentReady = ready
  let sent = 0
  const dispatcher = createMetaRegistrationDispatcher({
    isMarketingGranted: () => currentMarketing === 'granted',
    isReady: () => currentReady,
    send: () => {
      sent += 1
      return true
    },
  })

  return {
    dispatcher,
    sent: () => sent,
    setMarketing: value => { currentMarketing = value },
    setReady: value => { currentReady = value },
  }
}

test('marketing granted and Meta ready sends CompleteRegistration exactly once', () => {
  const harness = createHarness({ ready: true })

  assert.equal(harness.dispatcher.request(), true)
  assert.equal(harness.dispatcher.request(), false)
  assert.equal(harness.dispatcher.flush(), false)
  assert.equal(harness.sent(), 1)
})

test('marketing granted queues one registration until Meta becomes ready', () => {
  const harness = createHarness()

  assert.equal(harness.dispatcher.request(), true)
  assert.equal(harness.dispatcher.request(), true)
  assert.equal(harness.dispatcher.flush(), false)
  assert.equal(harness.sent(), 0)

  harness.setReady(true)
  assert.equal(harness.dispatcher.flush(), true)
  assert.equal(harness.dispatcher.flush(), false)
  assert.equal(harness.dispatcher.request(), false)
  assert.equal(harness.sent(), 1)
})

test('repeated provider flushes and requests never duplicate a registration', () => {
  const harness = createHarness()

  harness.dispatcher.request()
  harness.dispatcher.request()
  harness.setReady(true)
  harness.dispatcher.flush()
  harness.dispatcher.flush()
  harness.dispatcher.request()

  assert.equal(harness.sent(), 1)
})

test('marketing revocation clears a pending registration before Meta becomes ready', () => {
  const harness = createHarness()

  assert.equal(harness.dispatcher.request(), true)
  harness.setMarketing('denied')
  harness.dispatcher.revoke()
  harness.setReady(true)
  assert.equal(harness.dispatcher.flush(), false)

  harness.setMarketing('granted')
  assert.equal(harness.dispatcher.flush(), false)
  assert.equal(harness.sent(), 0)
})

test('marketing denied never queues or sends a registration', () => {
  const harness = createHarness({ marketing: 'denied' })

  assert.equal(harness.dispatcher.request(), false)
  harness.setReady(true)
  assert.equal(harness.dispatcher.request(), false)
  assert.equal(harness.dispatcher.flush(), false)
  assert.equal(harness.sent(), 0)
})

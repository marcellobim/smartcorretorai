import test from 'node:test'
import assert from 'node:assert/strict'

import { validOrigin } from './security.mjs'

const headers = (origin, host = new URL(origin).host) => ({
  origin,
  host,
  'sec-fetch-site': 'same-origin',
})

test('the guest Banner accepts the official SNETIA origins without trusting arbitrary hosts', () => {
  const env = { GUEST_APP_ORIGIN: 'https://www.smartcorretorai.com' }

  assert.equal(validOrigin(headers('https://snetia.com'), env), true)
  assert.equal(validOrigin(headers('https://www.snetia.com'), env), true)
  assert.equal(validOrigin(headers('https://www.smartcorretorai.com'), env), true)
  assert.equal(validOrigin(headers('https://attacker.example'), env), false)
  assert.equal(validOrigin(headers('https://snetia.com', 'attacker.example'), env), false)
})

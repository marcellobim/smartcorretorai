import test from 'node:test'
import assert from 'node:assert/strict'

import { createGuestHandler } from './handler.mjs'
import { startGuestPromotion } from './promotion.mjs'

const env = {
  VERCEL: '1',
  GUEST_APP_ORIGIN: 'https://www.smartcorretorai.com',
  GUEST_SESSION_HMAC_SECRET: 's'.repeat(32),
  GUEST_NETWORK_HMAC_SECRET: 'n'.repeat(32),
}

const response = () => ({
  headers: new Map(),
  statusCode: 0,
  body: '',
  setHeader(name, value) { this.headers.set(name, value) },
  end(body) { this.body = body },
})

const eventRequest = (origin, host = new URL(origin).host) => ({
  method: 'POST',
  headers: {
    origin,
    host,
    'sec-fetch-site': 'same-origin',
    'content-type': 'application/json',
    'x-vercel-forwarded-for': '203.0.113.7',
  },
  body: JSON.stringify({ action: 'event', eventType: 'guest_banner_started' }),
})

test('a SNETIA guest entry reaches the protected promotion gate without provider work', async () => {
  let rpcCalls = 0
  const handler = createGuestHandler({
    env,
    tokenFactory: () => 'a'.repeat(43),
    transport: {
      async rpc(name) {
        rpcCalls += 1
        assert.equal(name, 'guest_banner_open')
        return { allowed: true, newSession: true, expiresAt: '2099-01-01T00:00:00.000Z' }
      },
      async banner() { throw Error('provider must not be called for guest entry') },
    },
  })
  const res = response()

  await handler(eventRequest('https://snetia.com'), res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, generationEnabled: true })
  assert.equal(rpcCalls, 1)
  assert.match(res.headers.get('Set-Cookie'), /__Host-sca-guest=/)
})

test('the guest endpoint still rejects a non-official origin before any gate or provider work', async () => {
  let calls = 0
  const handler = createGuestHandler({
    env,
    transport: {
      async rpc() { calls += 1; return { allowed: true } },
      async banner() { calls += 1; return {} },
    },
  })
  const res = response()

  await handler(eventRequest('https://attacker.example'), res)

  assert.equal(res.statusCode, 403)
  assert.deepEqual(JSON.parse(res.body), { error: 'origin_not_allowed' })
  assert.equal(calls, 0)
})

test('an already-used Banner trial never dispatches a provider request or an ST operation', async () => {
  const rpcCalls = []
  let dispatchCalls = 0
  const result = await startGuestPromotion({
    sessionHash: 'session-hash',
    networkHash: 'network-hash',
    clientRequestId: '00000000-0000-4000-8000-000000000000',
    banner: {},
  }, {
    async rpc(name) {
      rpcCalls.push(name)
      if (name === 'guest_banner_rate_take') return true
      if (name === 'guest_banner_reserve') return { error: 'promotion_used' }
      throw Error(`unexpected RPC: ${name}`)
    },
    async prepare() { return { prompt: 'stubbed', images: [] } },
    async dispatch() { dispatchCalls += 1 },
  })

  assert.deepEqual(result, { error: 'promotion_used' })
  assert.deepEqual(rpcCalls, ['guest_banner_rate_take', 'guest_banner_reserve'])
  assert.equal(dispatchCalls, 0)
  assert.equal(rpcCalls.some((name) => /smart|token/i.test(name)), false)
})

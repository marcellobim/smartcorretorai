import assert from 'node:assert/strict'
import test from 'node:test'
import type { TikTokOAuthStateRepository } from '../_shared/tiktok/types.ts'
import {
  createTikTokConnectionHandler,
  validateTikTokConfiguredRedirectUri,
  validateTikTokFrontendOrigin,
} from './handler.ts'
import type {
  TikTokAccountStatusRecord,
  TikTokConnectionStatusRecord,
} from './handler.ts'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CLIENT_KEY = 'public-client-key'
const SESSION_TOKEN = 'fake-session-token'
const FRONTEND_ORIGIN = 'https://app.example.test'
const REDIRECT_URI = 'https://project.example.test/functions/v1/tiktok-callback'
const NOW = Date.UTC(2026, 8, 19, 12)
const CONNECTION_ID = '22222222-2222-4222-8222-222222222222'

const activeConnection = (overrides: Partial<TikTokConnectionStatusRecord> = {}): TikTokConnectionStatusRecord => ({
  id: CONNECTION_ID,
  userId: USER_ID,
  environment: 'sandbox', appId: 'a'.repeat(64),
  connectionStatus: 'active',
  accessTokenExpiresAt: new Date(NOW + 30_000).toISOString(),
  refreshTokenExpiresAt: new Date(NOW + 60_000).toISOString(),
  scopes: ['user.info.basic'],
  updatedAt: new Date(NOW).toISOString(),
  ...overrides,
})

const activeAccount = (overrides: Partial<TikTokAccountStatusRecord> = {}): TikTokAccountStatusRecord => ({
  tiktokConnectionId: CONNECTION_ID,
  userId: USER_ID,
  environment: 'sandbox', appId: 'a'.repeat(64),
  accountStatus: 'active',
  displayName: 'Conta TikTok',
  ...overrides,
})

const setup = (options: {
  authenticated?: boolean
  authThrows?: boolean
  connections?: readonly TikTokConnectionStatusRecord[]
  accounts?: readonly TikTokAccountStatusRecord[]
  statusThrows?: 'connections' | 'accounts'
  redirectUri?: string
  frontendOrigin?: string
} = {}) => {
  const persisted: unknown[] = []
  const logs: string[] = []
  const statusCalls: Array<{ operation: string; userId: string; connectionIds?: readonly string[] }> = []
  const repository: TikTokOAuthStateRepository = {
    async persistChallenge(record) { persisted.push(record) },
    async consumeChallenge() { return null },
  }
  const handler = createTikTokConnectionHandler({
    identity: { environment: 'sandbox', appId: 'a'.repeat(64) },
    clientKey: CLIENT_KEY,
    redirectUri: options.redirectUri ?? REDIRECT_URI,
    frontendOrigin: options.frontendOrigin ?? FRONTEND_ORIGIN,
    stateRepository: repository,
    statusRepository: {
      async listConnections(userId) {
        statusCalls.push({ operation: 'connections', userId })
        if (options.statusThrows === 'connections') throw new Error('private_database_failure')
        return options.connections ?? []
      },
      async listAccounts(userId, connectionIds) {
        statusCalls.push({ operation: 'accounts', userId, connectionIds })
        if (options.statusThrows === 'accounts') throw new Error('private_database_failure')
        return options.accounts ?? []
      },
    },
    now: () => NOW,
    randomBytes: length => new Uint8Array(length).fill(7),
    async authenticate(token) {
      assert.equal(token, SESSION_TOKEN)
      if (options.authThrows) throw new Error('private_auth_failure')
      return options.authenticated === false ? null : { userId: USER_ID }
    },
    log: message => logs.push(message),
  })
  return { handler, persisted, logs, statusCalls }
}

const request = (authorization?: string, method = 'POST', url = 'https://edge.example.test/tiktok-connection') => new Request(url, {
  method,
  headers: authorization ? { Authorization: authorization } : undefined,
})

test('answers Supabase client preflight with the exact required CORS headers', async () => {
  const { handler } = setup()
  const response = await handler(new Request('https://edge.example.test/tiktok-connection', {
    method: 'OPTIONS',
    headers: {
      Origin: FRONTEND_ORIGIN,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,x-client-info,apikey,content-type,x-retry-count',
    },
  }))
  const allowedHeaders = new Set(
    (response.headers.get('access-control-allow-headers') ?? '').split(',').map(value => value.trim()),
  )
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), FRONTEND_ORIGIN)
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS')
  assert.deepEqual(allowedHeaders, new Set([
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-retry-count',
  ]))
  assert.equal(await response.text(), '')
})

test('does not grant CORS to an origin different from the configured origin', async () => {
  const { handler } = setup()
  const response = await handler(new Request('https://edge.example.test/tiktok-connection', {
    method: 'OPTIONS',
    headers: { Origin: 'https://other.example.test' },
  }))
  assert.equal(response.status, 204)
  assert.equal(response.headers.has('access-control-allow-origin'), false)
  assert.equal(response.headers.get('vary'), 'Origin')
})

test('configuration fails closed for missing, empty or invalid redirect URIs', () => {
  const invalid = [
    undefined,
    '',
    'http://project.example.test/functions/v1/tiktok-callback',
    'https://user:password@project.example.test/functions/v1/tiktok-callback',
    'https://project.example.test/functions/v1/tiktok-callback?next=unsafe',
    'https://project.example.test/functions/v1/tiktok-callback#unsafe',
    'https://project.example.test/functions/v1/other-callback',
  ]
  for (const redirectUri of invalid) {
    assert.throws(
      () => validateTikTokConfiguredRedirectUri(redirectUri as string),
      /invalid_tiktok_redirect_uri/,
    )
  }
  assert.equal(validateTikTokConfiguredRedirectUri(REDIRECT_URI), REDIRECT_URI)
})

test('configuration accepts only an HTTPS frontend origin without path, query, fragment or userinfo', () => {
  for (const frontendOrigin of [
    undefined,
    '',
    'http://app.example.test',
    'https://user:password@app.example.test',
    'https://app.example.test/path',
    'https://app.example.test?query=unsafe',
    'https://app.example.test#unsafe',
  ]) {
    assert.throws(() => validateTikTokFrontendOrigin(frontendOrigin as string), /invalid_tiktok_frontend_origin/)
  }
  assert.equal(validateTikTokFrontendOrigin(FRONTEND_ORIGIN), FRONTEND_ORIGIN)
})

test('rejects a request without an authenticated user', async () => {
  const { handler } = setup()
  const response = await handler(request())
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'authentication_required' })
})

test('rejects an invalid Supabase session without exposing the auth failure', async () => {
  const { handler } = setup({ authThrows: true })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'invalid_session' })
})

test('creates and persists a secure authorization challenge', async () => {
  const { handler, persisted } = setup()
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`))
  const body = await response.json() as { authorization_url: string }
  const url = new URL(body.authorization_url)
  assert.equal(response.status, 200)
  assert.equal(persisted.length, 1)
  assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('scope'), 'user.info.basic')
  assert.equal(url.searchParams.get('state')?.length, 43)
})

test('always uses exactly the configured callback URI', async () => {
  const { handler } = setup()
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`))
  const body = await response.json() as { authorization_url: string }
  assert.equal(new URL(body.authorization_url).searchParams.get('redirect_uri'), REDIRECT_URI)
})

test('ignores redirect URI supplied through request URL, header or body', async () => {
  const { handler } = setup()
  const response = await handler(new Request(
    'https://edge.example.test/tiktok-connection?redirect_uri=https://evil.example/callback',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SESSION_TOKEN}`,
        'Content-Type': 'application/json',
        'X-TikTok-Redirect-Uri': 'https://evil.example/callback',
      },
      body: JSON.stringify({ redirect_uri: 'https://evil.example/callback' }),
    },
  ))
  const body = await response.json() as { authorization_url: string }
  assert.equal(new URL(body.authorization_url).searchParams.get('redirect_uri'), REDIRECT_URI)
})

test('returns only the sanitized authorization URL', async () => {
  const { handler } = setup()
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`))
  const body = await response.json() as Record<string, unknown>
  assert.deepEqual(Object.keys(body), ['authorization_url'])
  const serialized = JSON.stringify(body)
  assert.equal(serialized.includes(SESSION_TOKEN), false)
  assert.equal(serialized.includes('client_secret'), false)
  assert.equal(serialized.includes('access_token'), false)
  assert.equal(serialized.includes('refresh_token'), false)
})

test('logs only allowlisted telemetry fields', async () => {
  const { handler, logs } = setup()
  await handler(request(`Bearer ${SESSION_TOKEN}`))
  assert.equal(logs.length, 1)
  assert.deepEqual(JSON.parse(logs[0]), {
    event: 'tiktok_oauth',
    stage: 'authorization',
    http_status: 200,
  })
  assert.equal(logs[0].includes(SESSION_TOKEN), false)
})

test('GET rejects a request without a Bearer token', async () => {
  const { handler } = setup()
  const response = await handler(request(undefined, 'GET'))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'authentication_required' })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('GET rejects an invalid session', async () => {
  const { handler } = setup({ authenticated: false })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'invalid_session' })
})

test('GET returns exactly disconnected when no usable connection exists', async () => {
  const { handler } = setup()
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { connected: false, status: 'disconnected' })
})

test('GET returns the minimal public account for a usable connection', async () => {
  const { handler } = setup({ connections: [activeConnection()], accounts: [activeAccount()] })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    connected: true, status: 'connected',
    account: { display_name: 'Conta TikTok' },
  })
})

test('GET permits a null display name', async () => {
  const { handler } = setup({
    connections: [activeConnection()],
    accounts: [activeAccount({ displayName: null })],
  })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), {
    connected: true, status: 'connected',
    account: { display_name: null },
  })
})

for (const connectionStatus of ['expired', 'revoked', 'reconnect_required']) {
  test(`GET treats ${connectionStatus} connections as disconnected`, async () => {
    const { handler } = setup({
      connections: [activeConnection({ connectionStatus })],
      accounts: [activeAccount()],
    })
    const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
    assert.deepEqual(await response.json(), { connected: false, status: connectionStatus === 'revoked' ? 'disconnected' : 'reconnect_required' })
  })
}

test('GET treats an expired refresh token as reconnect_required', async () => {
  const { handler } = setup({
    connections: [activeConnection({ refreshTokenExpiresAt: new Date(NOW).toISOString() })],
    accounts: [activeAccount()],
  })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), { connected: false, status: 'reconnect_required' })
})

test('GET treats a connection without user.info.basic as reconnect_required', async () => {
  const { handler } = setup({
    connections: [activeConnection({ scopes: ['video.publish'] })],
    accounts: [activeAccount()],
  })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), { connected: false, status: 'reconnect_required' })
})

test('GET treats a missing account as disconnected', async () => {
  const { handler } = setup({ connections: [activeConnection()] })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), { connected: false, status: 'disconnected' })
})

for (const accountStatus of ['unavailable', 'disconnected']) {
  test(`GET treats an ${accountStatus} account as disconnected`, async () => {
    const { handler } = setup({
      connections: [activeConnection()],
      accounts: [activeAccount({ accountStatus })],
    })
    const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
    assert.deepEqual(await response.json(), { connected: false, status: 'disconnected' })
  })
}

test('GET deterministically selects the most recently updated usable connection', async () => {
  const olderId = '33333333-3333-4333-8333-333333333333'
  const newerId = '44444444-4444-4444-8444-444444444444'
  const { handler } = setup({
    connections: [
      activeConnection({ id: olderId, updatedAt: new Date(NOW - 1_000).toISOString() }),
      activeConnection({ id: newerId, updatedAt: new Date(NOW + 1_000).toISOString() }),
    ],
    accounts: [
      activeAccount({ tiktokConnectionId: olderId, displayName: 'Anterior' }),
      activeAccount({ tiktokConnectionId: newerId, displayName: 'Atual' }),
    ],
  })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), {
    connected: true, status: 'connected',
    account: { display_name: 'Atual' },
  })
})

test('GET derives user_id only from auth.getUser and ignores request-controlled values', async () => {
  const { handler, statusCalls } = setup({ connections: [activeConnection()] })
  await handler(request(
    `Bearer ${SESSION_TOKEN}`,
    'GET',
    'https://edge.example.test/tiktok-connection?user_id=attacker-controlled',
  ))
  assert.equal(statusCalls.length, 2)
  assert.equal(statusCalls.every(call => call.userId === USER_ID), true)
})

test('GET never accepts another user connection or account', async () => {
  const otherUserId = '55555555-5555-4555-8555-555555555555'
  const { handler } = setup({
    connections: [
      activeConnection({ userId: otherUserId }),
      activeConnection(),
    ],
    accounts: [
      activeAccount({ userId: otherUserId, displayName: 'Outra pessoa' }),
      activeAccount({ displayName: 'Minha conta' }),
    ],
  })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  assert.deepEqual(await response.json(), {
    connected: true, status: 'connected',
    account: { display_name: 'Minha conta' },
  })
})

test('GET response never contains private connection or account fields', async () => {
  const { handler } = setup({ connections: [activeConnection()], accounts: [activeAccount()] })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
  const serialized = JSON.stringify(await response.json())
  for (const forbidden of [
    'open_id', 'username', 'avatar', 'scopes', 'expires', 'connection_status',
    'account_status', 'ciphertext', 'nonce', 'auth_tag', 'key_version', 'token',
    'secret', CONNECTION_ID, USER_ID,
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

for (const statusThrows of ['connections', 'accounts'] as const) {
  test(`GET sanitizes a ${statusThrows} database failure`, async () => {
    const { handler } = setup({
      connections: [activeConnection()],
      accounts: [activeAccount()],
      statusThrows,
    })
    const response = await handler(request(`Bearer ${SESSION_TOKEN}`, 'GET'))
    const responseText = await response.text()
    assert.equal(response.status, 503)
    assert.deepEqual(JSON.parse(responseText), { error: 'tiktok_connection_status_unavailable' })
    assert.equal(responseText.includes('private_database_failure'), false)
  })
}

test('POST remains isolated from status queries', async () => {
  const { handler, persisted, statusCalls } = setup({ statusThrows: 'connections' })
  const response = await handler(request(`Bearer ${SESSION_TOKEN}`))
  assert.equal(response.status, 200)
  assert.equal(persisted.length, 1)
  assert.deepEqual(statusCalls, [])
})

test('GET never calls an expired access token connected and never refreshes', async () => {
  const { handler } = setup({ connections: [activeConnection({ accessTokenExpiresAt: new Date(NOW).toISOString() })], accounts: [activeAccount()] })
  assert.deepEqual(await (await handler(request('Bearer ' + SESSION_TOKEN, 'GET'))).json(), { connected: false, status: 'access_token_expired' })
})
for (const mismatch of [{ environment: 'production' }, { appId: 'b'.repeat(64) }]) {
  test('GET filters other environment/app connections and accounts: ' + JSON.stringify(mismatch), async () => {
    for (const options of [
      { connections: [activeConnection(mismatch)], accounts: [activeAccount()] },
      { connections: [activeConnection()], accounts: [activeAccount(mismatch)] },
    ]) {
      const { handler } = setup(options)
      const response = await handler(request('Bearer ' + SESSION_TOKEN, 'GET', 'https://edge.example.test/tiktok-connection?environment=production'))
      assert.deepEqual(await response.json(), { connected: false, status: 'disconnected' })
    }
  })
}

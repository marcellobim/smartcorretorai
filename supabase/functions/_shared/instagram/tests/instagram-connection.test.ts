import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildFacebookOAuthUrl,
  buildFrontendInstagramRedirect,
  createSignedOAuthState,
  INSTAGRAM_OAUTH_SCOPES,
  INSTAGRAM_OAUTH_STATE_TTL_SECONDS,
  verifySignedOAuthState,
} from '../oauth.ts'
import { resolveInstagramConnection } from '../meta-client.ts'
import type { InstagramOAuthTelemetryEvent } from '../telemetry.ts'
import { handleInstagramConnection, type InstagramConnectionDependencies } from '../../../instagram-connection/runtime.ts'
import { handleInstagramCallback, type InstagramCallbackDependencies } from '../../../instagram-callback/runtime.ts'

const USER_ID = '7a66d5cb-16de-4d31-a718-c98f4917af72'
const NONCE = '7f1348e8-50b0-4a67-bf0a-bad53ddc8438'
const STATE_SECRET = 'state-secret-with-at-least-thirty-two-characters'
const NOW = Date.UTC(2026, 7, 10, 12, 0, 0)

const request = (method: string, token = 'valid-token') => new Request('https://local/instagram-connection', {
  method,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
})

const dependencies = (overrides: Partial<InstagramConnectionDependencies> = {}): InstagramConnectionDependencies => ({
  authenticate: async token => token === 'valid-token' ? { id: USER_ID } : null,
  createAuthorizationUrl: async () => 'https://www.facebook.com/v99.0/dialog/oauth?safe=true',
  getConnection: async () => null,
  deleteConnection: async () => {},
  now: () => NOW,
  ...overrides,
})

test('POST requires Supabase auth and never accepts user_id from a body', async () => {
  assert.equal((await handleInstagramConnection(request('POST', ''), dependencies())).status, 401)
  assert.equal((await handleInstagramConnection(request('POST', 'invalid'), dependencies())).status, 401)
  let receivedUserId = ''
  const response = await handleInstagramConnection(new Request('https://local/instagram-connection', {
    method: 'POST',
    headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'attacker-controlled' }),
  }), dependencies({ createAuthorizationUrl: async userId => { receivedUserId = userId; return 'https://www.facebook.com/oauth' } }))
  assert.equal(response.status, 200)
  assert.equal(receivedUserId, USER_ID)
})

test('OPTIONS is 200 and the connection endpoint allows only GET, POST and DELETE', async () => {
  const options = await handleInstagramConnection(request('OPTIONS', ''), dependencies())
  assert.equal(options.status, 200)
  assert.match(options.headers.get('Access-Control-Allow-Methods') || '', /GET, POST, DELETE, OPTIONS/)
  assert.equal((await handleInstagramConnection(request('PATCH'), dependencies())).status, 405)
})

test('OAuth URL contains only the exact legacy scopes and configured version', async () => {
  const state = await createSignedOAuthState({ userId: USER_ID, secret: STATE_SECRET, now: NOW, nonce: NONCE })
  const authorizationUrl = buildFacebookOAuthUrl({
    appId: '1166177798972049',
    redirectUri: 'https://project.supabase.co/functions/v1/instagram-callback',
    graphApiVersion: 'v99.0',
    state,
  })
  const url = new URL(authorizationUrl)
  assert.equal(url.origin, 'https://www.facebook.com')
  assert.equal(url.pathname, '/v99.0/dialog/oauth')
  assert.deepEqual(url.searchParams.get('scope')?.split(','), [...INSTAGRAM_OAUTH_SCOPES])
  assert.equal(url.searchParams.get('redirect_uri'), 'https://project.supabase.co/functions/v1/instagram-callback')
  assert.equal(url.searchParams.get('state'), state)
  assert.doesNotMatch(authorizationUrl, /app_secret|access_token/i)
})

test('OAuth state is signed, bound to the user and expires after ten minutes', async () => {
  const state = await createSignedOAuthState({ userId: USER_ID, secret: STATE_SECRET, now: NOW, nonce: NONCE })
  const payload = await verifySignedOAuthState(state, STATE_SECRET, NOW + (INSTAGRAM_OAUTH_STATE_TTL_SECONDS - 1) * 1000)
  assert.equal(payload.userId, USER_ID)
  assert.equal(payload.expiresAt - payload.issuedAt, 600)
  await assert.rejects(() => verifySignedOAuthState(`${state.slice(0, -1)}x`, STATE_SECRET, NOW), /invalid_oauth_state/)
  await assert.rejects(() => verifySignedOAuthState(state, STATE_SECRET, NOW + (INSTAGRAM_OAUTH_STATE_TTL_SECONDS + 1) * 1000), /expired_oauth_state/)
})

test('GET returns disconnected or a sanitized connected status without identifiers or tokens', async () => {
  const disconnected = await (await handleInstagramConnection(request('GET'), dependencies())).json()
  assert.deepEqual(disconnected, { ok: true, connected: false, instagram_username: null, token_expires_at: null, status: 'disconnected' })

  const connectedResponse = await handleInstagramConnection(request('GET'), dependencies({
    getConnection: async () => ({ ig_username: 'conta_profissional', token_expires_at: '2026-09-10T12:00:00.000Z' }),
  }))
  const connectedText = await connectedResponse.text()
  assert.match(connectedText, /"connected":true/)
  assert.match(connectedText, /conta_profissional/)
  assert.doesNotMatch(connectedText, /access_token|page_access_token|page_id|ig_user_id/i)
})

test('GET marks expired records safely', async () => {
  const response = await handleInstagramConnection(request('GET'), dependencies({
    getConnection: async () => ({ ig_username: 'conta_profissional', token_expires_at: '2026-07-10T12:00:00.000Z' }),
  }))
  assert.deepEqual(await response.json(), {
    ok: true,
    connected: false,
    instagram_username: 'conta_profissional',
    token_expires_at: '2026-07-10T12:00:00.000Z',
    status: 'expired',
  })
})

test('DELETE is idempotent and derives ownership only from the authenticated user', async () => {
  const deleted: string[] = []
  const deps = dependencies({ deleteConnection: async userId => { deleted.push(userId) } })
  for (let index = 0; index < 2; index += 1) {
    const response = await handleInstagramConnection(request('DELETE'), deps)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, connected: false, status: 'disconnected' })
  }
  assert.deepEqual(deleted, [USER_ID, USER_ID])
})

test('callback rejects invalid and expired state without exposing code or token', async () => {
  const connectedRedirect = buildFrontendInstagramRedirect('https://app.smartcorretor.example', 'conectado')
  const errorRedirect = buildFrontendInstagramRedirect('https://app.smartcorretor.example', 'erro')
  const events: InstagramOAuthTelemetryEvent[] = []
  const validState = await createSignedOAuthState({ userId: USER_ID, secret: STATE_SECRET, now: NOW, nonce: NONCE })
  const callbackDependencies = (now: number): InstagramCallbackDependencies => ({
    connectedRedirect,
    errorRedirect,
    completeConnection: async (_code, state) => { await verifySignedOAuthState(state, STATE_SECRET, now) },
    log: event => events.push(event),
  })
  const invalid = await handleInstagramCallback(new Request('https://local/callback?code=private-code&state=invalid'), callbackDependencies(NOW))
  assert.equal(invalid.status, 303)
  assert.equal(invalid.headers.get('location'), errorRedirect)
  const expired = await handleInstagramCallback(new Request(`https://local/callback?code=private-code&state=${encodeURIComponent(validState)}`), callbackDependencies(NOW + 601_000))
  assert.equal(expired.headers.get('location'), errorRedirect)
  assert.doesNotMatch(JSON.stringify(events), /private-code|access_token|page_access_token|state-secret/i)
})

test('callback success redirects with status only and never returns OAuth secrets', async () => {
  const connectedRedirect = buildFrontendInstagramRedirect('https://app.smartcorretor.example', 'conectado')
  const errorRedirect = buildFrontendInstagramRedirect('https://app.smartcorretor.example', 'erro')
  let completed = false
  const response = await handleInstagramCallback(new Request('https://local/callback?code=private-code&state=signed-state'), {
    connectedRedirect,
    errorRedirect,
    completeConnection: async () => { completed = true },
  })
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), 'https://app.smartcorretor.example/configuracoes?instagram=conectado')
  assert.equal(completed, true)
  assert.doesNotMatch(response.headers.get('location') || '', /code|state|token|page_id|ig_user_id/i)
})

test('Meta exchange is fully backend-side and selects exactly one linked professional account', async () => {
  const calls: URL[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) {
      return Response.json({ access_token: 'short-user-token' })
    }
    if (url.pathname.endsWith('/oauth/access_token')) {
      return Response.json({ access_token: 'long-user-token', expires_in: 5_184_000 })
    }
    if (url.pathname.endsWith('/debug_token')) {
      return Response.json({ data: { scopes: [...INSTAGRAM_OAUTH_SCOPES], granular_scopes: [] } })
    }
    return Response.json({ data: [{ id: 'page-1', name: 'Page', access_token: 'page-token', instagram_business_account: { id: 'ig-1', username: 'conta_profissional' } }] })
  }) as typeof fetch

  const connection = await resolveInstagramConnection({
    code: 'private-code', userId: USER_ID, appId: '1166177798972049', appSecret: 'private-app-secret',
    redirectUri: 'https://project.supabase.co/functions/v1/instagram-callback', graphApiVersion: 'v99.0', fetcher, now: NOW,
  })
  assert.equal(calls.length, 4)
  assert.equal(connection.user_id, USER_ID)
  assert.equal(connection.page_id, 'page-1')
  assert.equal(connection.ig_user_id, 'ig-1')
  assert.equal(connection.ig_username, 'conta_profissional')
  assert.equal(connection.access_token, 'long-user-token')
  assert.equal(connection.page_access_token, 'page-token')
  assert.ok(calls[3].searchParams.has('appsecret_proof'))
})

test('Meta exchange fails closed when no linked account or multiple accounts exist', async () => {
  const fetcherFor = (pages: unknown[]) => (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return Response.json({ data: { scopes: [...INSTAGRAM_OAUTH_SCOPES], granular_scopes: [] } })
    return Response.json({ data: pages })
  }) as typeof fetch
  const base = { code: 'code', userId: USER_ID, appId: '1166177798972049', appSecret: 'app-secret', redirectUri: 'https://project.supabase.co/functions/v1/instagram-callback', graphApiVersion: 'v99.0', now: NOW }
  await assert.rejects(() => resolveInstagramConnection({ ...base, fetcher: fetcherFor([]) }), error => {
    assert.equal((error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.stage, 'eligible_count')
    assert.equal((error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.eligible_count, 0)
    return true
  })
  const page = (id: string) => ({ id: `page-${id}`, access_token: `page-token-${id}`, instagram_business_account: { id: `ig-${id}` } })
  await assert.rejects(() => resolveInstagramConnection({ ...base, fetcher: fetcherFor([page('1'), page('2')]) }), error => {
    assert.equal((error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.stage, 'eligible_count')
    assert.equal((error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.eligible_count, 2)
    return true
  })
})

test('implementation contains no publishing endpoint, frontend secret or unsafe token response', () => {
  const files = [
    new URL('../oauth.ts', import.meta.url),
    new URL('../meta-client.ts', import.meta.url),
    new URL('../../../instagram-connection/index.ts', import.meta.url),
    new URL('../../../instagram-connection/runtime.ts', import.meta.url),
    new URL('../../../instagram-callback/index.ts', import.meta.url),
    new URL('../../../instagram-callback/runtime.ts', import.meta.url),
  ]
  const source = files.map(file => readFileSync(file, 'utf8')).join('\n')
  assert.doesNotMatch(source, /media_publish|instagram-publish|VITE_META|VITE_.*SECRET/i)
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\([^\n]*(?:token|code|state|redirect)/i)
  assert.match(source, /auth\.getUser\(token\)/)
  assert.match(source, /META_APP_SECRET/)
  assert.match(source, /META_OAUTH_STATE_SECRET/)
})

test('migration adds page_id and blocks direct browser access to stored tokens', () => {
  const migration = readFileSync(new URL('../../../../migrations/20260810010000_secure_instagram_social_connections.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN IF NOT EXISTS page_id TEXT/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.social_connections FROM anon, authenticated/)
  assert.match(migration, /GRANT ALL ON TABLE public\.social_connections TO service_role/)
  assert.doesNotMatch(migration, /access_token\s*=|app_secret|credential/i)
})

test('Supabase config keeps callback public at gateway while both functions enforce their own contracts', () => {
  const config = readFileSync(new URL('../../../../config.toml', import.meta.url), 'utf8')
  assert.match(config, /\[functions\.instagram-connection\]\s+verify_jwt = false/)
  assert.match(config, /\[functions\.instagram-callback\]\s+verify_jwt = false/)
})

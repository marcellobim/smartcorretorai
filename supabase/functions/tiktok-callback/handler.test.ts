import assert from 'node:assert/strict'
import test from 'node:test'
import type { TikTokFetch } from '../_shared/tiktok/client.ts'
import { createTikTokTokenKeyring } from '../_shared/tiktok/token-crypto.ts'
import type { TikTokOAuthStateRepository } from '../_shared/tiktok/types.ts'
import { hashTikTokOAuthState } from '../_shared/tiktok/oauth.ts'
import {
  createTikTokCallbackHandler,
  type TikTokLoginPersistenceInput,
  validateTikTokConfiguredRedirectUri,
  validateTikTokFrontendOrigin,
  validateTikTokFrontendReturnUri,
} from './handler.ts'

const STATE = 'A'.repeat(43)
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OPEN_ID = 'fake-open-id'
const ACCESS_TOKEN = 'fake-access-token-private'
const REFRESH_TOKEN = 'fake-refresh-token-private'
const CLIENT_SECRET = 'fake-client-secret-private'
const REDIRECT_URI = 'https://project.example.test/functions/v1/tiktok-callback'
const FRONTEND_ORIGIN = 'https://app.example.test'
const RETURN_URI = 'https://app.example.test/configuracoes/integracoes/tiktok'
const NOW = Date.UTC(2026, 8, 19, 12)

type SetupOptions = {
  persistError?: boolean
  accountMismatch?: boolean
  time?: number
  availableState?: boolean
  providerScope?: string
  tokenExchangeError?: boolean
  providerError?: Record<string, string>
  redirectUri?: string
  frontendOrigin?: string
  frontendReturnUri?: string
  inspectState?: 'missing' | { appId?: string; expiresAt?: string; consumedAt?: string | null }
}

const keyring = async () => createTikTokTokenKeyring({
  activeVersion: 'test-v1',
  keys: { 'test-v1': btoa(String.fromCharCode(...new Uint8Array(32).fill(19))) },
})

const setup = async (options: SetupOptions = {}) => {
  let available = options.availableState !== false
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const persisted: TikTokLoginPersistenceInput[] = []
  const logs: string[] = []
  const stateRepository: TikTokOAuthStateRepository = {
    async persistChallenge() { throw new Error('not_used') },
    async consumeChallenge() {
      if (!available) return null
      available = false
      return { userId: USER_ID }
    },
    async inspectChallenge(input) {
      if (options.inspectState === 'missing' || !options.inspectState) return null
      return {
        stateHash: input.stateHash,
        environment: 'sandbox',
        appId: options.inspectState.appId ?? 'a'.repeat(64),
        expiresAt: options.inspectState.expiresAt ?? new Date(NOW + 60_000).toISOString(),
        consumedAt: options.inspectState.consumedAt ?? null,
      }
    },
  }
  const fetcher: TikTokFetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.endsWith('/v2/oauth/token/')) {
      if (options.tokenExchangeError) return Response.json({ error: 'provider_private_error' }, { status: 400 })
      if (options.providerError) return Response.json({ error: options.providerError }, { status: 400 })
      return Response.json({
        open_id: OPEN_ID,
        access_token: ACCESS_TOKEN,
        refresh_token: REFRESH_TOKEN,
        expires_in: 3600,
        refresh_expires_in: 86400,
        scope: options.providerScope ?? 'user.info.basic',
        token_type: 'Bearer',
      })
    }
    if (url.startsWith('https://open.tiktokapis.com/v2/user/info/')) {
      return Response.json({
        data: { user: { open_id: options.accountMismatch ? 'wrong-account' : OPEN_ID, display_name: 'Test Account', avatar_url: 'https://example.test/avatar.png' } },
        error: { code: 'ok' },
      })
    }
    throw new Error('unexpected_fake_request')
  }
  const handler = createTikTokCallbackHandler({
    identity: { environment: 'sandbox', appId: 'a'.repeat(64) },
    clientKey: 'public-client-key',
    clientSecret: CLIENT_SECRET,
    redirectUri: options.redirectUri ?? REDIRECT_URI,
    frontendOrigin: options.frontendOrigin ?? FRONTEND_ORIGIN,
    frontendReturnUri: options.frontendReturnUri ?? RETURN_URI,
    stateRepository,
    tokenKeyring: await keyring(),
    fetcher,
    async persistLogin(input) { if(options.persistError) throw new Error('private_persistence_error'); persisted.push(input) },
    now: () => options.time ?? NOW,
    log: message => logs.push(message),
  })
  return { handler, calls, persisted, logs }
}

test('configuration fails closed for invalid redirect URI, frontend origin and return URI', async () => {
  for (const redirectUri of [
    undefined,
    '',
    'http://project.example.test/functions/v1/tiktok-callback',
    'https://user:password@project.example.test/functions/v1/tiktok-callback',
    'https://project.example.test/functions/v1/tiktok-callback?query=unsafe',
    'https://project.example.test/functions/v1/tiktok-callback#unsafe',
    'https://project.example.test/functions/v1/other-callback',
  ]) assert.throws(() => validateTikTokConfiguredRedirectUri(redirectUri as string), /invalid_tiktok_redirect_uri/)

  for (const frontendOrigin of [
    undefined,
    '',
    'http://app.example.test',
    'https://user:password@app.example.test',
    'https://app.example.test/path',
    'https://app.example.test?query=unsafe',
    'https://app.example.test#unsafe',
  ]) assert.throws(() => validateTikTokFrontendOrigin(frontendOrigin as string), /invalid_tiktok_frontend_origin/)

  for (const frontendReturnUri of [
    undefined,
    '',
    'http://app.example.test/configuracoes/integracoes/tiktok',
    'https://user:password@app.example.test/configuracoes/integracoes/tiktok',
    'https://other.example.test/configuracoes/integracoes/tiktok',
    'https://app.example.test/configuracoes',
    'https://app.example.test/configuracoes/integracoes/tiktok?query=unsafe',
    'https://app.example.test/configuracoes/integracoes/tiktok#unsafe',
  ]) assert.throws(
    () => validateTikTokFrontendReturnUri(frontendReturnUri as string, FRONTEND_ORIGIN),
    /invalid_tiktok_frontend_return_uri/,
  )

  assert.equal(validateTikTokConfiguredRedirectUri(REDIRECT_URI), REDIRECT_URI)
  assert.equal(validateTikTokFrontendOrigin(FRONTEND_ORIGIN), FRONTEND_ORIGIN)
  assert.equal(validateTikTokFrontendReturnUri(RETURN_URI, FRONTEND_ORIGIN), RETURN_URI)
})

const callback = (parameters: Record<string, string>) => {
  const url = new URL('https://project.example.test/functions/v1/tiktok-callback')
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value)
  return new Request(url)
}

const callbackEntries = (entries: readonly (readonly [string, string])[], path = '/functions/v1/tiktok-callback', method = 'GET') => {
  const url = new URL(`https://project.example.test${path}`)
  for (const [name, value] of entries) url.searchParams.append(name, value)
  return new Request(url, { method })
}

const location = (response: Response) => new URL(response.headers.get('location')!)
const diagnosticStage = (response: Response) => location(response).searchParams.get('diagnostic_stage')
const diagnosticReason = (response: Response) => location(response).searchParams.get('diagnostic_reason')

const assertSanitized = (response: Response, logs: string[]) => {
  const exposed = `${response.headers.get('location') ?? ''}\n${logs.join('\n')}`
  for (const secret of [STATE, ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET, 'provider_private_error']) {
    assert.equal(exposed.includes(secret), false)
  }
}

test('redirects safely when code is absent', async () => {
  const { handler, logs } = await setup()
  const response = await handler(callback({ state: STATE }))
  assert.equal(response.status, 303)
  assert.equal(location(response).searchParams.get('reason'), 'code_missing')
  assert.equal(diagnosticStage(response), 'state_validation')
  assert.equal(diagnosticReason(response), 'code_missing')
  assertSanitized(response, logs)
})

test('redirects safely when state is absent', async () => {
  const { handler, logs } = await setup()
  const response = await handler(callback({ code: 'fake-code' }))
  assert.equal(response.status, 303)
  assert.equal(location(response).searchParams.get('reason'), 'state_invalid')
  assert.equal(diagnosticStage(response), 'state_validation')
  assert.equal(diagnosticReason(response), 'state_missing')
  assertSanitized(response, logs)
})

test('consumes state and sanitizes an error returned by TikTok', async () => {
  const { handler, calls, logs } = await setup()
  const response = await handler(callback({ state: STATE, error: 'access_denied', error_description: 'provider_private_error' }))
  assert.equal(response.status, 303)
  assert.equal(location(response).searchParams.get('reason'), 'authorization_denied')
  assert.equal(diagnosticStage(response), 'state_validation')
  assert.equal(calls.length, 0)
  assertSanitized(response, logs)
})

test('rejects a malformed state before token exchange', async () => {
  const { handler, calls } = await setup()
  const response = await handler(callback({ state: 'invalid', code: 'fake-code' }))
  assert.equal(location(response).searchParams.get('reason'), 'state_invalid')
  assert.equal(diagnosticStage(response), 'state_validation')
  assert.equal(calls.length, 0)
})

test('rejects an expired or unavailable state', async () => {
  const { handler, calls } = await setup({ availableState: false })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(response).searchParams.get('reason'), 'state_invalid')
  assert.equal(diagnosticStage(response), 'state_validation')
  assert.equal(calls.length, 0)
})

test('prevents replay after a state has been consumed', async () => {
  const { handler } = await setup()
  const first = await handler(callback({ state: STATE, code: 'fake-code' }))
  const replay = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(first).searchParams.get('tiktok'), 'connected')
  assert.equal(location(replay).searchParams.get('reason'), 'state_invalid')
  assert.equal(diagnosticStage(replay), 'state_validation')
})

test('rejects insufficient scopes without exposing provider tokens', async () => {
  const { handler, persisted, logs } = await setup({ providerScope: 'video.upload' })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(response).searchParams.get('reason'), 'scope_missing')
  assert.equal(diagnosticStage(response), 'scope_validation')
  assert.equal(persisted.length, 0)
  assertSanitized(response, logs)
})

test('uses only the simulated HTTP client for token exchange and account lookup', async () => {
  const { handler, calls } = await setup()
  await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://open.tiktokapis.com/v2/oauth/token/')
  assert.equal(calls[1].url.startsWith('https://open.tiktokapis.com/v2/user/info/'), true)
  const body = calls[0].init?.body as URLSearchParams
  assert.equal(body.get('code'), 'fake-code')
  assert.equal(body.get('client_secret'), CLIENT_SECRET)
  assert.equal(body.get('redirect_uri'), REDIRECT_URI)
})

test('ignores provider-controlled redirect destinations and returns only to the configured frontend URI', async () => {
  const { handler, calls } = await setup()
  const response = await handler(callback({
    state: STATE,
    code: 'fake-code',
    redirect_uri: 'https://evil.example/callback',
    return_to: 'https://evil.example/return',
  }))
  assert.equal(location(response).toString(), `${RETURN_URI}?tiktok=connected&diagnostic_stage=final_redirect`)
  const tokenBody = calls[0].init?.body as URLSearchParams
  assert.equal(tokenBody.get('redirect_uri'), REDIRECT_URI)
})

test('persists only independently encrypted token envelopes', async () => {
  const { handler, persisted } = await setup()
  await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(persisted.length, 1)
  const record = persisted[0]
  assert.equal(record.userId, USER_ID)
  assert.equal(record.openId, OPEN_ID)
  assert.notEqual(record.accessTokenCiphertext, ACCESS_TOKEN)
  assert.notEqual(record.refreshTokenCiphertext, REFRESH_TOKEN)
  assert.notEqual(record.accessTokenNonce, record.refreshTokenNonce)
  assert.deepEqual(record.scopes, ['user.info.basic'])
})

test('returns a sanitized 303 success redirect and safe telemetry', async () => {
  const { handler, logs } = await setup()
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(response.status, 303)
  assert.equal(location(response).toString(), `${RETURN_URI}?tiktok=connected&diagnostic_stage=final_redirect`)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(logs.length, 1)
  assert.deepEqual(JSON.parse(logs[0]), {
    event: 'tiktok_oauth',
    stage: 'success',
    http_status: 303,
    scope_count: 1,
    state_consumed: true,
    account_resolved: true,
  })
  assertSanitized(response, logs)
})

test('sanitizes token exchange failures from response and logs', async () => {
  const { handler, logs } = await setup({ providerError: { code: 'invalid_grant', message: `Bearer ${ACCESS_TOKEN}`, log_id: 'safe-log' } })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(response.status, 303)
  assert.equal(location(response).searchParams.get('reason'), 'callback_invalid')
  assert.equal(diagnosticStage(response), 'token_exchange')
  assert.equal(location(response).searchParams.get('provider_http_status'), '400')
  assert.equal(location(response).searchParams.get('provider_error_code'), 'invalid_grant')
  assert.equal(location(response).searchParams.get('provider_error_message'), null)
  assert.equal(location(response).searchParams.get('provider_log_id'), 'safe-log')
  assertSanitized(response, logs)
})

test('classifies every pre-consumption rejection without echoing OAuth values', async () => {
  const cases: Array<readonly [string, Request]> = [
    ['invalid_method_or_path', callbackEntries([['state', STATE], ['code', 'fake-code']], '/functions/v1/tiktok-callback', 'POST')],
    ['invalid_method_or_path', callbackEntries([['state', STATE], ['code', 'fake-code']], '/functions/v1/other-callback')],
    ['state_missing', callbackEntries([['code', 'fake-code']])],
    ['state_duplicate', callbackEntries([['state', STATE], ['state', 'B'.repeat(43)], ['code', 'fake-code']])],
    ['state_empty', callbackEntries([['state', ''], ['code', 'fake-code']])],
    ['state_too_long', callbackEntries([['state', 'A'.repeat(129)], ['code', 'fake-code']])],
    ['state_control_character', callbackEntries([['state', `A${String.fromCharCode(0)}B`], ['code', 'fake-code']])],
    ['error_duplicate', callbackEntries([['state', STATE], ['code', 'fake-code'], ['error', 'one'], ['error', 'two']])],
    ['code_missing', callbackEntries([['state', STATE]])],
  ]
  for (const [expected, request] of cases) {
    const { handler, logs } = await setup()
    const response = await handler(request)
    assert.equal(response.status, 303)
    assert.equal(diagnosticReason(response), expected)
    assertSanitized(response, logs)
  }
})

test('reports only the sanitized received method, origin and path for route rejections', async () => {
  const cases: Array<readonly [Request, Record<string, string>]> = [
    [
      callbackEntries([['state', STATE], ['code', 'fake-code']], '/functions/v1/tiktok-callback?state=ignored', 'POST'),
      { diagnostic_method: 'POST', diagnostic_origin: 'https://project.example.test', diagnostic_path: '/functions/v1/tiktok-callback', diagnostic_method_match: 'false', diagnostic_origin_match: 'true', diagnostic_path_match: 'true' },
    ],
    [
      callbackEntries([['state', STATE], ['code', 'fake-code']], '/functions/v1/other-callback'),
      { diagnostic_method: 'GET', diagnostic_origin: 'https://project.example.test', diagnostic_path: '/functions/v1/other-callback', diagnostic_method_match: 'true', diagnostic_origin_match: 'true', diagnostic_path_match: 'false' },
    ],
    [
      new Request('https://other.example.test/functions/v1/tiktok-callback?state=ignored&code=ignored'),
      { diagnostic_method: 'GET', diagnostic_origin: 'https://other.example.test', diagnostic_path: '/functions/v1/tiktok-callback', diagnostic_method_match: 'true', diagnostic_origin_match: 'false', diagnostic_path_match: 'true' },
    ],
  ]
  for (const [request, expected] of cases) {
    const { handler, logs } = await setup()
    const response = await handler(request)
    const result = location(response).searchParams
    assert.equal(diagnosticReason(response), 'invalid_method_or_path')
    for (const [name, value] of Object.entries(expected)) assert.equal(result.get(name), value)
    assert.equal(response.headers.get('location')?.includes('ignored'), false)
    assertSanitized(response, logs)
  }
})

test('correlates a matching persisted state without exposing the raw state', async () => {
  const { handler, logs } = await setup({ availableState: false, inspectState: { expiresAt: new Date(Date.now() + 60_000).toISOString() } })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  const expected = (await hashTikTokOAuthState(STATE)).slice(0, 16)
  const result = location(response).searchParams
  assert.equal(result.get('created_state_fp'), expected)
  assert.equal(result.get('sent_state_fp'), expected)
  assert.equal(result.get('received_state_fp'), expected)
  assert.equal(result.get('environment'), 'sandbox')
  assert.equal(result.get('app_id_match'), 'true')
  assert.equal(result.get('state_found'), 'true')
  assert.equal(result.get('state_expired'), 'false')
  assert.equal(result.get('state_already_consumed'), 'false')
  assertSanitized(response, logs)
})

test('identifies a different received state by fingerprint without revealing either value', async () => {
  const differentState = 'B'.repeat(43)
  const { handler, logs } = await setup({ availableState: false, inspectState: 'missing' })
  const response = await handler(callback({ state: differentState, code: 'fake-code' }))
  const result = location(response).searchParams
  assert.equal(result.get('received_state_fp'), (await hashTikTokOAuthState(differentState)).slice(0, 16))
  assert.equal(result.get('created_state_fp'), 'unknown')
  assert.equal(result.get('sent_state_fp'), 'unknown')
  assert.equal(result.get('state_found'), 'false')
  assert.equal(result.get('app_id_match'), 'unknown')
  assert.equal(result.get('state_expired'), 'unknown')
  assert.equal(result.get('state_already_consumed'), 'unknown')
  const exposed = `${response.headers.get('location') ?? ''}\n${logs.join('\n')}`
  assert.equal(exposed.includes(differentState), false)
  assert.equal(exposed.includes(STATE), false)
})

test('persistence error consumes state, returns sanitized error and never success', async () => {
  const { handler, persisted, logs } = await setup({ persistError: true })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(response).searchParams.get('reason'), 'callback_invalid')
  assert.equal(diagnosticStage(response), 'persistence')
  assert.equal(persisted.length, 0)
  assertSanitized(response, logs)
  const replay = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(replay).searchParams.get('reason'), 'state_invalid')
})
test('callback uses trusted identity and durations only even with a skewed application clock', async () => {
  const { handler, persisted } = await setup({ time: 0 })
  await handler(callback({ state: STATE, code: 'fake-code', environment: 'production', app_id: 'untrusted' }))
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].environment, 'sandbox')
  assert.equal(persisted[0].appId, 'a'.repeat(64))
  assert.equal(persisted[0].account.openId, persisted[0].openId)
  assert.equal(persisted[0].accessTokenExpiresIn, 3600)
  assert.doesNotMatch(JSON.stringify(persisted[0]), /created_at|updated_at|ExpiresAt/)
})
test('account identity mismatch never reaches persistence', async () => {
  const { handler, persisted, logs } = await setup({ accountMismatch: true })
  const response = await handler(callback({ state: STATE, code: 'fake-code' }))
  assert.equal(location(response).searchParams.get('reason'), 'callback_invalid')
  assert.equal(diagnosticStage(response), 'user_info')
  assert.equal(persisted.length, 0)
  assertSanitized(response, logs)
})

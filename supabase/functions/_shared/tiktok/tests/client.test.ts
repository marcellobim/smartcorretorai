import test from 'node:test'
import assert from 'node:assert/strict'
import {
  exchangeTikTokAuthorizationCode,
  fetchTikTokAccount,
  refreshTikTokAccessToken,
  revokeTikTokAccess,
  TIKTOK_REVOKE_ENDPOINT,
  TIKTOK_TOKEN_ENDPOINT,
  TIKTOK_USER_INFO_ENDPOINT,
  type TikTokFetch,
} from '../client.ts'

const ACCESS_TOKEN = 'fake-access-token-for-unit-test'
const REFRESH_TOKEN = 'fake-refresh-token-for-unit-test'
const CLIENT_SECRET = 'fake-client-secret-for-unit-test'
const REDIRECT_URI = 'https://project.supabase.co/functions/v1/tiktok-callback'
const tokenPayload = {
  open_id: 'test-open-id', access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN,
  expires_in: 86400, refresh_expires_in: 31536000, scope: 'user.info.basic', token_type: 'Bearer',
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

test('authorization code exchange uses fixed endpoint and form body without URL secrets', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: TikTokFetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return response(tokenPayload)
  }
  const tokens = await exchangeTikTokAuthorizationCode({
    clientKey: 'client-key', clientSecret: CLIENT_SECRET, code: 'fake-code', redirectUri: REDIRECT_URI, fetcher,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, TIKTOK_TOKEN_ENDPOINT)
  assert.equal(calls[0].url.includes(CLIENT_SECRET), false)
  assert.equal(calls[0].init?.method, 'POST')
  const body = calls[0].init?.body as URLSearchParams
  assert.equal(body.get('grant_type'), 'authorization_code')
  assert.equal(body.get('redirect_uri'), REDIRECT_URI)
  assert.equal(tokens.openId, 'test-open-id')
  assert.deepEqual(tokens.scopes, ['user.info.basic'])
})

test('refresh remains fully injected and accepts rotated refresh tokens', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: TikTokFetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return response({ ...tokenPayload, refresh_token: 'rotated-fake-refresh-token' })
  }
  const tokens = await refreshTikTokAccessToken({
    clientKey: 'client-key', clientSecret: CLIENT_SECRET, refreshToken: REFRESH_TOKEN, fetcher,
  })
  assert.equal(calls[0].url, TIKTOK_TOKEN_ENDPOINT)
  assert.equal((calls[0].init?.body as URLSearchParams).get('grant_type'), 'refresh_token')
  assert.equal(tokens.refreshToken, 'rotated-fake-refresh-token')
})

test('revocation uses fixed endpoint through the injected client', async () => {
  let called = ''
  const result = await revokeTikTokAccess({
    clientKey: 'client-key', clientSecret: CLIENT_SECRET, accessToken: ACCESS_TOKEN,
    fetcher: async url => { called = String(url); return response({ data: {}, error: { code: 'ok' } }) },
  })
  assert.equal(called, TIKTOK_REVOKE_ENDPOINT)
  assert.deepEqual(result, { revoked: true })
})

test('account lookup sends token only in Authorization header and returns sanitized identity', async () => {
  let requestUrl = ''
  let authorization = ''
  const account = await fetchTikTokAccount({
    accessToken: ACCESS_TOKEN,
    fetcher: async (url, init) => {
      requestUrl = String(url)
      authorization = new Headers(init?.headers).get('Authorization') || ''
      return response({ data: { user: { open_id: 'test-open-id', display_name: 'Test Creator', avatar_url: 'https://example.com/a.png' } } })
    },
  })
  assert.equal(new URL(requestUrl).origin + new URL(requestUrl).pathname, TIKTOK_USER_INFO_ENDPOINT)
  assert.equal(requestUrl.includes(ACCESS_TOKEN), false)
  assert.equal(authorization, `Bearer ${ACCESS_TOKEN}`)
  assert.deepEqual(account, { openId: 'test-open-id', displayName: 'Test Creator', avatarUrl: 'https://example.com/a.png' })
})

test('provider and network failures expose only stable sanitized errors', async () => {
  const base = { clientKey: 'client-key', clientSecret: CLIENT_SECRET, code: 'fake-code', redirectUri: REDIRECT_URI }
  await assert.rejects(
    () => exchangeTikTokAuthorizationCode({ ...base, fetcher: async () => response({ error: 'contains-sensitive-provider-body' }, 400) }),
    /^Error: tiktok_token_exchange_failed$/,
  )
  await assert.rejects(
    () => exchangeTikTokAuthorizationCode({ ...base, fetcher: async () => { throw new Error('network detail') } }),
    /^Error: tiktok_token_exchange_failed$/,
  )
  await assert.rejects(
    () => exchangeTikTokAuthorizationCode({
      ...base,
      fetcher: async () => response({ data: {}, error: { code: 'invalid_grant', message: 'contains-sensitive-provider-body' } }),
    }),
    /^Error: tiktok_token_exchange_failed$/,
  )
})

test('missing required scope and malformed token response fail closed', async () => {
  const base = { clientKey: 'client-key', clientSecret: CLIENT_SECRET, code: 'fake-code', redirectUri: REDIRECT_URI }
  await assert.rejects(
    () => exchangeTikTokAuthorizationCode({ ...base, fetcher: async () => response({ ...tokenPayload, scope: 'video.list' }) }),
    /tiktok_required_scope_missing/,
  )
  await assert.rejects(
    () => exchangeTikTokAuthorizationCode({ ...base, fetcher: async () => response({ ...tokenPayload, access_token: '' }) }),
    /tiktok_token_response_invalid/,
  )
})

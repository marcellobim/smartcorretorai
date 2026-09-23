import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTikTokConnectionStatus,
  redirectToTikTokOAuth,
  startTikTokOAuthConnection,
  TIKTOK_CONNECTION_ENDPOINT,
  validateTikTokAuthorizationUrl,
} from '../src/lib/tiktok-oauth-connection.js'
import { getTikTokCallbackUri } from '../src/config/tiktok.js'

const SESSION_TOKEN = 'supabase-session-token'
const STATE = 'A'.repeat(43)
const ENVIRONMENT = { VITE_SUPABASE_URL: 'https://project.example.test' }
const TIKTOK_CALLBACK_URI = getTikTokCallbackUri(ENVIRONMENT)
const validAuthorizationUrl = (() => {
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.searchParams.set('client_key', 'public-client-key')
  url.searchParams.set('redirect_uri', TIKTOK_CALLBACK_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'user.info.basic')
  url.searchParams.set('state', STATE)
  return url.toString()
})()

const client = ({ session = { access_token: SESSION_TOKEN }, response, error = null } = {}) => {
  const invocations = []
  return {
    auth: {
      async getSession() { return { data: { session }, error: null } },
    },
    functions: {
      async invoke(name, options) {
        invocations.push({ name, options })
        return { data: response, error }
      },
    },
    invocations,
  }
}

const start = (supabase, environment = ENVIRONMENT) => startTikTokOAuthConnection(supabase, environment)
const redirect = (supabase, assign, environment = ENVIRONMENT) => redirectToTikTokOAuth(supabase, assign, environment)

test('POST requires a Supabase session before invoking the Edge Function', async () => {
  for (const session of [null, {}, { access_token: '' }]) {
    const supabase = client({ session })
    await assert.rejects(() => start(supabase), /tiktok_session_required/)
    assert.deepEqual(supabase.invocations, [])
  }
})

test('POST invokes only tiktok-connection with the explicit Bearer JWT', async () => {
  const supabase = client({ response: { authorization_url: validAuthorizationUrl } })
  assert.equal(await start(supabase), validAuthorizationUrl)
  assert.equal(TIKTOK_CONNECTION_ENDPOINT, 'tiktok-connection')
  assert.deepEqual(supabase.invocations, [{
    name: 'tiktok-connection',
    options: {
      method: 'POST',
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
    },
  }])
})

test('redirect occurs only after strict validation of the official authorization URL', async () => {
  const redirects = []
  const supabase = client({ response: { authorization_url: validAuthorizationUrl } })
  await redirect(supabase, url => redirects.push(url))
  assert.deepEqual(redirects, [validAuthorizationUrl])
})

test('POST rejects unsafe hosts, HTTP, paths, callback, scope and extra parameters', async () => {
  const mutations = [
    url => { url.hostname = 'evil.example' },
    url => { url.protocol = 'http:' },
    url => { url.pathname = '/oauth/authorize/' },
    url => { url.searchParams.set('redirect_uri', 'https://evil.example/callback') },
    url => { url.searchParams.set('scope', 'user.info.basic,video.publish') },
    url => { url.searchParams.set('extra', 'unexpected') },
    url => { url.searchParams.set('client_secret', 'forbidden') },
    url => { url.searchParams.set('access_token', 'forbidden') },
    url => { url.searchParams.set('refresh_token', 'forbidden') },
  ]
  for (const mutate of mutations) {
    const url = new URL(validAuthorizationUrl)
    mutate(url)
    const supabase = client({ response: { authorization_url: url.toString() } })
    await assert.rejects(() => start(supabase), /tiktok_oauth/)
  }
})

test('POST rejects malformed state, duplicate parameters and unexpected response fields', async () => {
  const malformedState = new URL(validAuthorizationUrl)
  malformedState.searchParams.set('state', 'short')
  await assert.rejects(
    () => start(client({ response: { authorization_url: malformedState.toString() } })),
    /tiktok_oauth/,
  )

  const duplicate = new URL(validAuthorizationUrl)
  duplicate.searchParams.append('scope', 'user.info.basic')
  await assert.rejects(
    () => start(client({ response: { authorization_url: duplicate.toString() } })),
    /tiktok_oauth/,
  )

  await assert.rejects(
    () => start(client({ response: {
      authorization_url: validAuthorizationUrl,
      access_token: 'forbidden',
    } })),
    /tiktok_oauth_response/,
  )
})

test('callback derives only from a strictly valid HTTPS VITE_SUPABASE_URL', () => {
  assert.equal(
    getTikTokCallbackUri(ENVIRONMENT),
    'https://project.example.test/functions/v1/tiktok-callback',
  )
  for (const environment of [
    undefined,
    {},
    { VITE_SUPABASE_URL: '' },
    { VITE_SUPABASE_URL: 'http://project.example.test' },
    { VITE_SUPABASE_URL: 'https://user:password@project.example.test' },
    { VITE_SUPABASE_URL: 'https://project.example.test/path' },
    { VITE_SUPABASE_URL: 'https://project.example.test?query=unsafe' },
    { VITE_SUPABASE_URL: 'https://project.example.test#unsafe' },
  ]) assert.throws(() => getTikTokCallbackUri(environment), /tiktok_supabase_url/)
})

test('authorization URL must use the callback derived from the configured Supabase project', () => {
  assert.equal(validateTikTokAuthorizationUrl(validAuthorizationUrl, ENVIRONMENT), validAuthorizationUrl)
  const otherProject = new URL(validAuthorizationUrl)
  otherProject.searchParams.set(
    'redirect_uri',
    'https://other-project.example.test/functions/v1/tiktok-callback',
  )
  assert.throws(
    () => validateTikTokAuthorizationUrl(otherProject.toString(), ENVIRONMENT),
    /invalid_tiktok_oauth_url/,
  )
})

test('missing frontend Supabase configuration fails before invoking TikTok connection', async () => {
  const supabase = client({ response: { authorization_url: validAuthorizationUrl } })
  await assert.rejects(() => start(supabase, {}), /missing_tiktok_supabase_url/)
  assert.deepEqual(supabase.invocations, [])
})

test('GET requires a JWT and invokes only tiktok-connection', async () => {
  const unauthenticated = client({ session: null })
  await assert.rejects(() => getTikTokConnectionStatus(unauthenticated), /tiktok_session_required/)
  assert.deepEqual(unauthenticated.invocations, [])

  const supabase = client({ response: { connected: false, status: 'disconnected' } })
  assert.deepEqual(await getTikTokConnectionStatus(supabase), { connected: false, status: 'disconnected' })
  assert.deepEqual(supabase.invocations, [{
    name: 'tiktok-connection',
    options: {
      method: 'GET',
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
    },
  }])
})

test('GET accepts only the approved public status contracts', async () => {
  assert.deepEqual(
    await getTikTokConnectionStatus(client({ response: { connected: true, status: 'connected', account: { display_name: 'Conta TikTok' } } })),
    { connected: true, status: 'connected', account: { display_name: 'Conta TikTok' } },
  )
  assert.deepEqual(
    await getTikTokConnectionStatus(client({ response: { connected: true, status: 'connected', account: { display_name: null } } })),
    { connected: true, status: 'connected', account: { display_name: null } },
  )
})

test('GET rejects extra and sensitive fields', async () => {
  for (const response of [
    { connected: false, status: 'active' },
    { connected: true, status: 'connected', account: { display_name: 'Conta', username: 'forbidden' } },
    { connected: true, status: 'connected', account: { display_name: 'Conta', access_token: 'forbidden' } },
    { connected: true, status: 'connected', account: { display_name: 123 } },
  ]) {
    await assert.rejects(
      () => getTikTokConnectionStatus(client({ response })),
      /tiktok_connection_status_unavailable/,
    )
  }
})

test('backend failures are sanitized for POST and GET', async () => {
  await assert.rejects(
    () => start(client({ error: new Error('private backend detail') })),
    /^Error: tiktok_connection_unavailable$/,
  )
  await assert.rejects(
    () => getTikTokConnectionStatus(client({ error: new Error('private backend detail') })),
    /^Error: tiktok_connection_status_unavailable$/,
  )
})

for (const status of ['disconnected', 'access_token_expired', 'reconnect_required']) {
 test('GET preserves sanitized status '+status, async()=>{
  assert.deepEqual(await getTikTokConnectionStatus(client({response:{connected:false,status}})),{connected:false,status})
 })
}

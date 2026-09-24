import { getTikTokCallbackUri } from '../config/tiktok.js'

const TIKTOK_CONNECTION_FUNCTION = 'tiktok-connection'
const TIKTOK_OAUTH_ORIGIN = 'https://www.tiktok.com'
const TIKTOK_OAUTH_PATH = '/v2/auth/authorize/'
const TIKTOK_OAUTH_KEYS = new Set(['client_key', 'redirect_uri', 'response_type', 'scope', 'state'])
const TIKTOK_STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/

const authenticatedSession = async (client) => {
  try {
    const { data, error } = await client.auth.getSession()
    if (error || !data?.session?.access_token) throw new Error('tiktok_session_required')
    return data.session
  } catch {
    throw new Error('tiktok_session_required')
  }
}

const invokeTikTokConnection = async (client, accessToken, method, options = {}) => {
  try {
    const { data, error } = await client.functions.invoke(TIKTOK_CONNECTION_FUNCTION + (options.capabilities ? '?view=capabilities' : ''), {
      method,
      ...(options.body ? { body: options.body } : {}),
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (error) throw new Error('tiktok_connection_request_failed')
    return data
  } catch {
    throw new Error(method === 'GET'
      ? 'tiktok_connection_status_unavailable'
      : 'tiktok_connection_unavailable')
  }
}

const hasExactKeys = (value, expected) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every(key => expected.has(key))
}

export const validateTikTokAuthorizationUrl = (value, environment = import.meta.env) => {
  if (typeof value !== 'string') throw new Error('invalid_tiktok_oauth_response')
  const expectedRedirectUri = getTikTokCallbackUri(environment)

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_oauth_url')
  }

  if (
    url.origin !== TIKTOK_OAUTH_ORIGIN
    || url.pathname !== TIKTOK_OAUTH_PATH
    || url.username
    || url.password
    || url.hash
  ) throw new Error('invalid_tiktok_oauth_url')

  const parameterKeys = [...url.searchParams.keys()]
  if (
    parameterKeys.length !== TIKTOK_OAUTH_KEYS.size
    || parameterKeys.some(key => !TIKTOK_OAUTH_KEYS.has(key))
    || [...TIKTOK_OAUTH_KEYS].some(key => url.searchParams.getAll(key).length !== 1)
  ) throw new Error('unsafe_tiktok_oauth_url')

  if (
    !url.searchParams.get('client_key')
    || url.searchParams.get('redirect_uri') !== expectedRedirectUri
    || url.searchParams.get('response_type') !== 'code'
    || url.searchParams.get('scope') !== 'user.info.basic'
    || !TIKTOK_STATE_PATTERN.test(url.searchParams.get('state') ?? '')
  ) throw new Error('invalid_tiktok_oauth_url')

  return url.toString()
}

const parseAuthorizationResponse = (data, environment) => {
  if (!hasExactKeys(data, new Set(['authorization_url']))) {
    throw new Error('invalid_tiktok_oauth_response')
  }
  return validateTikTokAuthorizationUrl(data.authorization_url, environment)
}

const parseStatusResponse = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('invalid_tiktok_status_response')
  }
  if (data.connected === false && ['disconnected', 'access_token_expired', 'reconnect_required'].includes(data.status) && hasExactKeys(data, new Set(['connected', 'status']))) {
    return { connected: false, status: data.status }
  }
  if (
    data.connected === true
    && data.status === 'connected'
    && hasExactKeys(data, new Set(['connected', 'status', 'account']))
    && hasExactKeys(data.account, new Set(['display_name']))
    && (typeof data.account.display_name === 'string' || data.account.display_name === null)
  ) {
    return { connected: true, status: 'connected', account: { display_name: data.account.display_name } }
  }
  throw new Error('invalid_tiktok_status_response')
}

export const startTikTokOAuthConnection = async (client, environment = import.meta.env) => {
  getTikTokCallbackUri(environment)
  const session = await authenticatedSession(client)
  const data = await invokeTikTokConnection(client, session.access_token, 'POST')
  return parseAuthorizationResponse(data, environment)
}

export const redirectToTikTokOAuth = async (client, assign, environment = import.meta.env) => {
  if (typeof assign !== 'function') throw new Error('invalid_tiktok_oauth_redirect')
  const authorizationUrl = await startTikTokOAuthConnection(client, environment)
  assign(authorizationUrl)
  return authorizationUrl
}

export const getTikTokConnectionStatus = async (client) => {
  const session = await authenticatedSession(client)
  const data = await invokeTikTokConnection(client, session.access_token, 'GET')
  try {
    return parseStatusResponse(data)
  } catch {
    throw new Error('tiktok_connection_status_unavailable')
  }
}

export const TIKTOK_CONNECTION_ENDPOINT = TIKTOK_CONNECTION_FUNCTION

// Upgrade has its own exact URL contract. The basic validator stays unchanged.
export const validateTikTokUpgradeUrl = (value, environment = import.meta.env) => {
  let url
  try { url = new URL(value) } catch { throw new Error('invalid_tiktok_oauth_url') }
  const state = url.searchParams.get('state') ?? ''
  if (url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('scope').length !== 1
    || !/^dp\.[A-Za-z0-9_-]{43}$/.test(state)
    || url.searchParams.get('scope') !== 'user.info.basic,video.publish') throw new Error('invalid_tiktok_oauth_url')
  const basic = new URL(url)
  basic.searchParams.set('state', state.slice(3))
  basic.searchParams.set('scope', 'user.info.basic')
  validateTikTokAuthorizationUrl(basic.toString(), environment)
  return url.toString()
}

export const redirectToTikTokUpgrade = async (client, assign, environment = import.meta.env) => {
  if (typeof assign !== 'function') throw new Error('invalid_tiktok_oauth_redirect')
  getTikTokCallbackUri(environment)
  const session = await authenticatedSession(client)
  const data = await invokeTikTokConnection(client, session.access_token, 'POST', { body: { action: 'direct_post_upgrade' } })
  if (!hasExactKeys(data, new Set(['authorization_url']))) throw new Error('invalid_tiktok_oauth_response')
  assign(validateTikTokUpgradeUrl(data.authorization_url, environment))
}

export const getTikTokCapabilities = async (client) => {
  const session = await authenticatedSession(client)
  const data = await invokeTikTokConnection(client, session.access_token, 'GET', { capabilities: true })
  if (!hasExactKeys(data, new Set(['connected', 'status', 'account', 'capabilities', 'capability_status']))
    || !hasExactKeys(data.capabilities, new Set(['login_basic', 'direct_post']))
    || data.capabilities.login_basic !== true || typeof data.capabilities.direct_post !== 'boolean'
    || data.capability_status !== (data.capabilities.direct_post ? 'direct_post_authorized' : 'connected_basic'))
    throw new Error('tiktok_connection_status_unavailable')
  parseStatusResponse({ connected: data.connected, status: data.status, account: data.account })
  return { ...data.capabilities }
}

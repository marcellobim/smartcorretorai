import { DIRECT_POST_SCOPES, validateUpgradeScopes } from './capabilities.ts'
import { TIKTOK_LOGIN_SCOPES, type TikTokAccount, type TikTokTokenSet } from './types.ts'
import { validateTikTokRedirectUri } from './oauth.ts'

export const TIKTOK_TOKEN_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/token/'
export const TIKTOK_REVOKE_ENDPOINT = 'https://open.tiktokapis.com/v2/oauth/revoke/'
export const TIKTOK_USER_INFO_ENDPOINT = 'https://open.tiktokapis.com/v2/user/info/'

export type TikTokFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const requireText = (value: unknown, errorCode: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(errorCode)
  return value.trim()
}

const requirePositiveInteger = (value: unknown, errorCode: string) => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(errorCode)
  return Number(value)
}

const requestJson = async (fetcher: TikTokFetch, url: string, init: RequestInit, errorCode: string) => {
  let response: Response
  try {
    response = await fetcher(url, init)
  } catch {
    throw new Error(errorCode)
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error(errorCode)
  const record = payload as Record<string, unknown>
  const providerError = record.error
  if (typeof providerError === 'string' && providerError.trim()) throw new Error(errorCode)
  if (providerError && typeof providerError === 'object' && !Array.isArray(providerError)) {
    const code = (providerError as Record<string, unknown>).code
    if (typeof code === 'string' && code !== 'ok') throw new Error(errorCode)
  }
  return record
}

const parseTokenSet = (payload: Record<string, unknown>, capability: 'login_basic' | 'direct_post_upgrade' = 'login_basic'): TikTokTokenSet => {
  const scopes = requireText(payload.scope, 'tiktok_token_response_invalid').split(',').map(scope => scope.trim()).filter(Boolean)
  if (capability === 'direct_post_upgrade') scopes.splice(0,scopes.length,...validateUpgradeScopes(scopes))
  else if (new Set(scopes).size !== scopes.length
    || TIKTOK_LOGIN_SCOPES.some(scope => !scopes.includes(scope))
    || scopes.some(scope => !DIRECT_POST_SCOPES.includes(scope as typeof DIRECT_POST_SCOPES[number]))) throw new Error('tiktok_required_scope_missing')
  if (payload.token_type !== 'Bearer') throw new Error('tiktok_token_response_invalid')
  return Object.freeze({
    openId: requireText(payload.open_id, 'tiktok_token_response_invalid'),
    accessToken: requireText(payload.access_token, 'tiktok_token_response_invalid'),
    refreshToken: requireText(payload.refresh_token, 'tiktok_token_response_invalid'),
    accessTokenExpiresIn: requirePositiveInteger(payload.expires_in, 'tiktok_token_response_invalid'),
    refreshTokenExpiresIn: requirePositiveInteger(payload.refresh_expires_in, 'tiktok_token_response_invalid'),
    scopes: Object.freeze(scopes),
    tokenType: 'Bearer',
  })
}

const formHeaders = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }

export async function exchangeTikTokAuthorizationCode(input: {
  clientKey: string
  clientSecret: string
  code: string
  redirectUri: string
  fetcher: TikTokFetch
  capability?: 'login_basic' | 'direct_post_upgrade'
}) {
  const redirectUri = validateTikTokRedirectUri(input.redirectUri)
  const body = new URLSearchParams({
    client_key: requireText(input.clientKey, 'invalid_tiktok_client_key'),
    client_secret: requireText(input.clientSecret, 'invalid_tiktok_client_secret'),
    code: requireText(input.code, 'invalid_tiktok_authorization_code'),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  return parseTokenSet(await requestJson(input.fetcher, TIKTOK_TOKEN_ENDPOINT, {
    method: 'POST', headers: formHeaders, body,
  }, 'tiktok_token_exchange_failed'), input.capability)
}

export async function refreshTikTokAccessToken(input: {
  clientKey: string
  clientSecret: string
  refreshToken: string
  fetcher: TikTokFetch
}) {
  const body = new URLSearchParams({
    client_key: requireText(input.clientKey, 'invalid_tiktok_client_key'),
    client_secret: requireText(input.clientSecret, 'invalid_tiktok_client_secret'),
    grant_type: 'refresh_token',
    refresh_token: requireText(input.refreshToken, 'invalid_tiktok_refresh_token'),
  })
  return parseTokenSet(await requestJson(input.fetcher, TIKTOK_TOKEN_ENDPOINT, {
    method: 'POST', headers: formHeaders, body,
  }, 'tiktok_token_refresh_failed'))
}

export async function revokeTikTokAccess(input: {
  clientKey: string
  clientSecret: string
  accessToken: string
  fetcher: TikTokFetch
}) {
  const body = new URLSearchParams({
    client_key: requireText(input.clientKey, 'invalid_tiktok_client_key'),
    client_secret: requireText(input.clientSecret, 'invalid_tiktok_client_secret'),
    token: requireText(input.accessToken, 'invalid_tiktok_access_token'),
  })
  await requestJson(input.fetcher, TIKTOK_REVOKE_ENDPOINT, {
    method: 'POST', headers: formHeaders, body,
  }, 'tiktok_token_revoke_failed')
  return Object.freeze({ revoked: true as const })
}

export async function fetchTikTokAccount(input: { accessToken: string; fetcher: TikTokFetch }): Promise<TikTokAccount> {
  const url = new URL(TIKTOK_USER_INFO_ENDPOINT)
  url.searchParams.set('fields', 'open_id,display_name,avatar_url')
  const payload = await requestJson(input.fetcher, url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${requireText(input.accessToken, 'invalid_tiktok_access_token')}` },
  }, 'tiktok_account_lookup_failed')
  const data = payload.data
  const user = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>).user : null
  if (!user || typeof user !== 'object' || Array.isArray(user)) throw new Error('tiktok_account_response_invalid')
  const record = user as Record<string, unknown>
  return Object.freeze({
    openId: requireText(record.open_id, 'tiktok_account_response_invalid'),
    displayName: typeof record.display_name === 'string' && record.display_name.trim() ? record.display_name.trim() : null,
    avatarUrl: typeof record.avatar_url === 'string' && record.avatar_url.trim() ? record.avatar_url.trim() : null,
  })
}

import { validateTikTokIdentity, type TikTokIdentity } from './environment.ts'
import {
  TIKTOK_LOGIN_FLOW,
  TIKTOK_LOGIN_SCOPES,
  TIKTOK_OAUTH_PROVIDER,
  type TikTokLoginScope,
  type TikTokOAuthStateRepository,
} from './types.ts'

export const TIKTOK_AUTHORIZATION_ENDPOINT = 'https://www.tiktok.com/v2/auth/authorize/'
export const TIKTOK_OAUTH_STATE_TTL_SECONDS = 5 * 60

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CLIENT_KEY_PATTERN = /^[A-Za-z0-9._-]{6,128}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const encoder = new TextEncoder()

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const bytesToHex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')

const sha256 = async (value: string) => bytesToHex(new Uint8Array(
  await crypto.subtle.digest('SHA-256', encoder.encode(value)),
))

export function validateTikTokRedirectUri(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_redirect_uri')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('invalid_tiktok_redirect_uri')
  }
  return url.toString()
}

const validateScopes = (scopes: readonly string[]): readonly TikTokLoginScope[] => {
  if (scopes.length !== TIKTOK_LOGIN_SCOPES.length
      || scopes.some((scope, index) => scope !== TIKTOK_LOGIN_SCOPES[index])) {
    throw new Error('invalid_tiktok_login_scopes')
  }
  return scopes as readonly TikTokLoginScope[]
}

export function buildTikTokAuthorizationUrl(input: {
  clientKey: string
  redirectUri: string
  state: string
  scopes?: readonly string[]
}) {
  if (!CLIENT_KEY_PATTERN.test(input.clientKey)) throw new Error('invalid_tiktok_client_key')
  if (!STATE_PATTERN.test(input.state)) throw new Error('invalid_tiktok_oauth_state')
  const redirectUri = validateTikTokRedirectUri(input.redirectUri)
  const scopes = validateScopes(input.scopes ?? TIKTOK_LOGIN_SCOPES)
  const url = new URL(TIKTOK_AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_key', input.clientKey)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes.join(','))
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', input.state)
  return url.toString()
}

export async function createTikTokOAuthState(input: {
  userId: string
  redirectUri: string
  identity: TikTokIdentity
  randomBytes?: (length: number) => Uint8Array
}, repository: TikTokOAuthStateRepository) {
  if (!UUID_PATTERN.test(input.userId)) throw new Error('invalid_tiktok_oauth_user')
  const redirectUri = validateTikTokRedirectUri(input.redirectUri)
  const identity = validateTikTokIdentity(input.identity)
  const random = input.randomBytes?.(32) ?? crypto.getRandomValues(new Uint8Array(32))
  if (!(random instanceof Uint8Array) || random.byteLength !== 32) throw new Error('invalid_tiktok_oauth_randomness')
  const state = bytesToBase64Url(random)
  await repository.persistChallenge({
    stateHash: await sha256(state),
    userId: input.userId,
    redirectUriHash: await sha256(redirectUri),
    provider: TIKTOK_OAUTH_PROVIDER,
    flow: TIKTOK_LOGIN_FLOW,
    ...identity,
  })
  return { state }
}

export async function consumeTikTokOAuthState(input: {
  state: string
  expectedRedirectUri: string
  identity: TikTokIdentity
}, repository: TikTokOAuthStateRepository) {
  if (!STATE_PATTERN.test(input.state)) throw new Error('invalid_tiktok_oauth_state')
  const redirectUri = validateTikTokRedirectUri(input.expectedRedirectUri)
  const identity = validateTikTokIdentity(input.identity)
  const consumed = await repository.consumeChallenge({
    stateHash: await sha256(input.state),
    redirectUriHash: await sha256(redirectUri),
    provider: TIKTOK_OAUTH_PROVIDER,
    flow: TIKTOK_LOGIN_FLOW,
    ...identity,
  })
  if (!consumed || !UUID_PATTERN.test(consumed.userId)) throw new Error('tiktok_oauth_state_not_available')
  return Object.freeze({ userId: consumed.userId })
}

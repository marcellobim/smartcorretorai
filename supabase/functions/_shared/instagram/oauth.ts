export const INSTAGRAM_OAUTH_SCOPES = Object.freeze([
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
] as const)

export const INSTAGRAM_OAUTH_STATE_TTL_SECONDS = 10 * 60

type OAuthStatePayload = {
  version: 1
  userId: string
  issuedAt: number
  expiresAt: number
  nonce: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64UrlToBytes = (value: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_oauth_state')
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

const hmac = async (secret: string, value: string) => {
  if (secret.length < 32) throw new Error('invalid_oauth_state_secret')
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

const constantTimeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

export function validateGraphApiVersion(value: string) {
  if (!GRAPH_VERSION_PATTERN.test(value)) throw new Error('invalid_graph_api_version')
  return value
}

export function validatePublicUrl(value: string, name: string) {
  const url = new URL(value)
  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) throw new Error(`invalid_${name}`)
  return url.toString()
}

export async function createSignedOAuthState(input: {
  userId: string
  secret: string
  now?: number
  nonce?: string
}) {
  if (!UUID_PATTERN.test(input.userId)) throw new Error('invalid_oauth_user')
  const issuedAt = Math.floor((input.now ?? Date.now()) / 1000)
  const nonce = input.nonce || crypto.randomUUID()
  if (!UUID_PATTERN.test(nonce)) throw new Error('invalid_oauth_nonce')
  const payload: OAuthStatePayload = {
    version: 1,
    userId: input.userId,
    issuedAt,
    expiresAt: issuedAt + INSTAGRAM_OAUTH_STATE_TTL_SECONDS,
    nonce,
  }
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = bytesToBase64Url(await hmac(input.secret, encodedPayload))
  return `${encodedPayload}.${signature}`
}

export async function verifySignedOAuthState(state: string, secret: string, now = Date.now()) {
  const [encodedPayload, encodedSignature, extra] = String(state || '').split('.')
  if (!encodedPayload || !encodedSignature || extra) throw new Error('invalid_oauth_state')
  const expected = await hmac(secret, encodedPayload)
  const received = base64UrlToBytes(encodedSignature)
  if (!constantTimeEqual(expected, received)) throw new Error('invalid_oauth_state')

  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload)))
  } catch {
    throw new Error('invalid_oauth_state')
  }
  const nowSeconds = Math.floor(now / 1000)
  if (
    payload?.version !== 1
    || !UUID_PATTERN.test(payload.userId)
    || !UUID_PATTERN.test(payload.nonce)
    || !Number.isInteger(payload.issuedAt)
    || !Number.isInteger(payload.expiresAt)
    || payload.expiresAt - payload.issuedAt !== INSTAGRAM_OAUTH_STATE_TTL_SECONDS
    || payload.issuedAt > nowSeconds + 60
  ) throw new Error('invalid_oauth_state')
  if (payload.expiresAt < nowSeconds) throw new Error('expired_oauth_state')
  return payload
}

export function buildFacebookOAuthUrl(input: {
  appId: string
  redirectUri: string
  graphApiVersion: string
  state: string
}) {
  if (!/^\d{6,32}$/.test(input.appId)) throw new Error('invalid_meta_app_id')
  const version = validateGraphApiVersion(input.graphApiVersion)
  const redirectUri = validatePublicUrl(input.redirectUri, 'meta_redirect_uri')
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
  url.searchParams.set('client_id', input.appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', input.state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES.join(','))
  return url.toString()
}

export function buildFrontendInstagramRedirect(frontendUrl: string, status: 'conectado' | 'erro') {
  const url = new URL('/configuracoes', validatePublicUrl(frontendUrl, 'frontend_url'))
  url.searchParams.set('instagram', status)
  return url.toString()
}

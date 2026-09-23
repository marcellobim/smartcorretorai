import { validateTikTokIdentity, type TikTokIdentity } from './environment.ts'
const ALGORITHM = 'AES-256-GCM' as const
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export type TikTokTokenEnvelope = Readonly<{
  algorithm: typeof ALGORITHM
  ciphertext: string
  nonce: string
  authTag: string
  keyVersion: string
}>

export type TikTokTokenKeyring = Readonly<{
  activeVersion: string
  keys: ReadonlyMap<string, CryptoKey>
}>

export type TikTokTokenContext = TikTokIdentity & Readonly<{ userId: string; openId: string; kind: 'access' | 'refresh' }>
const encoder = new TextEncoder()
const aad = (context: TikTokTokenContext, keyVersion: string) => {
  validateTikTokIdentity(context)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.userId)
      || typeof context.openId !== 'string' || !context.openId.trim() || context.openId.length > 255
      || !['access', 'refresh'].includes(context.kind)) throw new Error('invalid_tiktok_token_context')
  return encoder.encode(JSON.stringify(['tiktok-token-v1', context.environment, context.appId, context.userId, context.openId, context.kind, keyVersion]))
}
const decoder = new TextDecoder('utf-8', { fatal: true })

const assertVersion = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(value)) throw new Error('invalid_tiktok_token_key_version')
  return value
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const decodeBase64 = (value: unknown, errorCode: string) => {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(errorCode)
  try {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0))
  } catch {
    throw new Error(errorCode)
  }
}

const importEncryptionKey = async (encoded: unknown) => {
  const raw = decodeBase64(encoded, 'invalid_tiktok_token_key')
  if (raw.byteLength !== KEY_BYTES) throw new Error('invalid_tiktok_token_key')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function createTikTokTokenKeyring(input: { activeVersion: string; keys: Record<string, string> }) {
  const activeVersion = assertVersion(input?.activeVersion)
  if (!input?.keys || typeof input.keys !== 'object' || Array.isArray(input.keys)) throw new Error('invalid_tiktok_token_keyring')
  const keys = new Map<string, CryptoKey>()
  for (const [version, encoded] of Object.entries(input.keys)) keys.set(assertVersion(version), await importEncryptionKey(encoded))
  if (!keys.has(activeVersion)) throw new Error('missing_active_tiktok_token_key')
  return Object.freeze({ activeVersion, keys }) satisfies TikTokTokenKeyring
}

export async function loadTikTokTokenKeyringFromEnvironment(readEnvironment: (name: string) => string | undefined) {
  const activeVersion = readEnvironment('TIKTOK_TOKEN_ACTIVE_KEY_VERSION')?.trim() || ''
  const serialized = readEnvironment('TIKTOK_TOKEN_KEYRING_JSON')?.trim() || ''
  let keys: Record<string, string>
  try {
    keys = JSON.parse(serialized)
  } catch {
    throw new Error('invalid_tiktok_token_keyring')
  }
  return createTikTokTokenKeyring({ activeVersion, keys })
}

const requireKey = (keyring: TikTokTokenKeyring, version: string) => {
  const key = keyring.keys.get(assertVersion(version))
  if (!key) throw new Error('unknown_tiktok_token_key_version')
  return key
}

export async function encryptTikTokToken(plaintext: string, keyring: TikTokTokenKeyring, context: TikTokTokenContext, options: {
  keyVersion?: string
  nonce?: Uint8Array
} = {}): Promise<TikTokTokenEnvelope> {
  if (typeof plaintext !== 'string' || !plaintext) throw new Error('missing_tiktok_token')
  const keyVersion = assertVersion(options.keyVersion || keyring.activeVersion)
  const nonce = options.nonce ? new Uint8Array(options.nonce) : crypto.getRandomValues(new Uint8Array(IV_BYTES))
  if (nonce.byteLength !== IV_BYTES) throw new Error('invalid_tiktok_token_nonce')
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128, additionalData: aad(context, keyVersion) }, requireKey(keyring, keyVersion), encoder.encode(plaintext),
  ))
  const tagOffset = sealed.byteLength - TAG_BYTES
  return Object.freeze({
    algorithm: ALGORITHM,
    ciphertext: encodeBase64(sealed.slice(0, tagOffset)),
    nonce: encodeBase64(nonce),
    authTag: encodeBase64(sealed.slice(tagOffset)),
    keyVersion,
  })
}

export async function decryptTikTokToken(envelope: TikTokTokenEnvelope, keyring: TikTokTokenKeyring, context: TikTokTokenContext) {
  if (!envelope || envelope.algorithm !== ALGORITHM) throw new Error('invalid_tiktok_token_envelope')
  const ciphertext = decodeBase64(envelope.ciphertext, 'invalid_tiktok_token_ciphertext')
  const nonce = decodeBase64(envelope.nonce, 'invalid_tiktok_token_nonce')
  const authTag = decodeBase64(envelope.authTag, 'invalid_tiktok_token_auth_tag')
  if (!ciphertext.byteLength || nonce.byteLength !== IV_BYTES || authTag.byteLength !== TAG_BYTES) {
    throw new Error('invalid_tiktok_token_envelope')
  }
  const sealed = new Uint8Array(ciphertext.byteLength + authTag.byteLength)
  sealed.set(ciphertext)
  sealed.set(authTag, ciphertext.byteLength)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128, additionalData: aad(context, envelope.keyVersion) }, requireKey(keyring, envelope.keyVersion), sealed,
    )
    return decoder.decode(plaintext)
  } catch {
    throw new Error('tiktok_token_decryption_failed')
  }
}

export async function rotateTikTokTokenEnvelope(envelope: TikTokTokenEnvelope, keyring: TikTokTokenKeyring, context: TikTokTokenContext) {
  let plaintext: string | null = await decryptTikTokToken(envelope, keyring, context)
  if (envelope.keyVersion === keyring.activeVersion) return Object.freeze({ envelope, rotated: false })
  try {
    return Object.freeze({ envelope: await encryptTikTokToken(plaintext, keyring, context), rotated: true })
  } finally {
    plaintext = null
  }
}

const serializeEnvelope = (prefix: 'access_token' | 'refresh_token', envelope: TikTokTokenEnvelope) => ({
  [`${prefix}_ciphertext`]: envelope.ciphertext,
  [`${prefix}_nonce`]: envelope.nonce,
  [`${prefix}_auth_tag`]: envelope.authTag,
})

export async function encryptTikTokConnectionForDatabase<T extends { accessToken: string; refreshToken: string }>(
  connection: T,
  keyring: TikTokTokenKeyring,
  context: Omit<TikTokTokenContext, 'kind'>,
) {
  const { accessToken, refreshToken, ...metadata } = connection
  const [accessEnvelope, refreshEnvelope] = await Promise.all([
    encryptTikTokToken(accessToken, keyring, { ...context, kind: 'access' }),
    encryptTikTokToken(refreshToken, keyring, { ...context, kind: 'refresh' }),
  ])
  return Object.freeze({
    ...metadata,
    ...serializeEnvelope('access_token', accessEnvelope),
    ...serializeEnvelope('refresh_token', refreshEnvelope),
    key_version: keyring.activeVersion,
  })
}

export const sanitizeTikTokConnectionForFrontend = (connection: Record<string, unknown>) => Object.freeze({
  id: typeof connection.id === 'string' ? connection.id : null,
  provider: connection.provider === 'tiktok' ? 'tiktok' : null,
  connection_status: typeof connection.connection_status === 'string' ? connection.connection_status : null,
  display_name: typeof connection.display_name === 'string' ? connection.display_name : null,
  access_token_expires_at: typeof connection.access_token_expires_at === 'string' ? connection.access_token_expires_at : null,
  refresh_token_expires_at: typeof connection.refresh_token_expires_at === 'string' ? connection.refresh_token_expires_at : null,
})

export const TIKTOK_TOKEN_CRYPTO_ALGORITHM = ALGORITHM

const ALGORITHM = 'AES-256-GCM' as const
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export type MetaTokenEnvelope = {
  algorithm: typeof ALGORITHM
  ciphertext: string
  nonce: string
  authTag: string
  keyVersion: string
}

export type MetaTokenKeyring = {
  activeVersion: string
  keys: ReadonlyMap<string, CryptoKey>
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

const assertVersion = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(value)) {
    throw new Error('invalid_meta_token_key_version')
  }
  return value
}

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const decodeBase64 = (value: unknown, errorCode: string) => {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(errorCode)
  }
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  } catch {
    throw new Error(errorCode)
  }
}

const importEncryptionKey = async (encoded: unknown) => {
  const raw = decodeBase64(encoded, 'invalid_meta_token_key')
  if (raw.byteLength !== KEY_BYTES) throw new Error('invalid_meta_token_key')
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function createMetaTokenKeyring(input: {
  activeVersion: string
  keys: Record<string, string>
}): Promise<MetaTokenKeyring> {
  const activeVersion = assertVersion(input?.activeVersion)
  if (!input?.keys || typeof input.keys !== 'object' || Array.isArray(input.keys)) {
    throw new Error('invalid_meta_token_keyring')
  }
  const keys = new Map<string, CryptoKey>()
  for (const [version, encoded] of Object.entries(input.keys)) {
    keys.set(assertVersion(version), await importEncryptionKey(encoded))
  }
  if (!keys.has(activeVersion)) throw new Error('missing_active_meta_token_key')
  return Object.freeze({ activeVersion, keys })
}

export async function loadMetaTokenKeyringFromEnvironment(readEnvironment: (name: string) => string | undefined) {
  const activeVersion = readEnvironment('META_TOKEN_ACTIVE_KEY_VERSION')?.trim() || ''
  const serialized = readEnvironment('META_TOKEN_KEYRING_JSON')?.trim() || ''
  let keys: Record<string, string>
  try {
    keys = JSON.parse(serialized)
  } catch {
    throw new Error('invalid_meta_token_keyring')
  }
  return createMetaTokenKeyring({ activeVersion, keys })
}

const requireKey = (keyring: MetaTokenKeyring, version: string) => {
  const key = keyring.keys.get(assertVersion(version))
  if (!key) throw new Error('unknown_meta_token_key_version')
  return key
}

export async function encryptMetaToken(
  plaintext: string,
  keyring: MetaTokenKeyring,
  options: { keyVersion?: string; nonce?: Uint8Array } = {},
): Promise<MetaTokenEnvelope> {
  if (typeof plaintext !== 'string' || !plaintext) throw new Error('missing_meta_token')
  const keyVersion = assertVersion(options.keyVersion || keyring.activeVersion)
  const key = requireKey(keyring, keyVersion)
  const nonce = options.nonce ? new Uint8Array(options.nonce) : crypto.getRandomValues(new Uint8Array(IV_BYTES))
  if (nonce.byteLength !== IV_BYTES) throw new Error('invalid_meta_token_nonce')
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, encoder.encode(plaintext)))
  const tagOffset = sealed.byteLength - TAG_BYTES
  return Object.freeze({
    algorithm: ALGORITHM,
    ciphertext: encodeBase64(sealed.slice(0, tagOffset)),
    nonce: encodeBase64(nonce),
    authTag: encodeBase64(sealed.slice(tagOffset)),
    keyVersion,
  })
}

export async function decryptMetaToken(envelope: MetaTokenEnvelope, keyring: MetaTokenKeyring): Promise<string> {
  if (!envelope || envelope.algorithm !== ALGORITHM) throw new Error('invalid_meta_token_envelope')
  const key = requireKey(keyring, envelope.keyVersion)
  const ciphertext = decodeBase64(envelope.ciphertext, 'invalid_meta_token_ciphertext')
  const nonce = decodeBase64(envelope.nonce, 'invalid_meta_token_nonce')
  const authTag = decodeBase64(envelope.authTag, 'invalid_meta_token_auth_tag')
  if (!ciphertext.byteLength || nonce.byteLength !== IV_BYTES || authTag.byteLength !== TAG_BYTES) {
    throw new Error('invalid_meta_token_envelope')
  }
  const sealed = new Uint8Array(ciphertext.byteLength + authTag.byteLength)
  sealed.set(ciphertext)
  sealed.set(authTag, ciphertext.byteLength)
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, sealed)
    return decoder.decode(plaintext)
  } catch {
    throw new Error('meta_token_decryption_failed')
  }
}

export async function rotateMetaTokenEnvelope(envelope: MetaTokenEnvelope, keyring: MetaTokenKeyring) {
  if (envelope.keyVersion === keyring.activeVersion) return { envelope, rotated: false }
  let plaintext: string | null = await decryptMetaToken(envelope, keyring)
  try {
    return { envelope: await encryptMetaToken(plaintext, keyring), rotated: true }
  } finally {
    plaintext = null
  }
}

export const serializeMetaTokenForDatabase = (prefix: 'access_token' | 'page_access_token', envelope: MetaTokenEnvelope) => ({
  [`${prefix}_ciphertext`]: envelope.ciphertext,
  [`${prefix}_nonce`]: envelope.nonce,
  [`${prefix}_auth_tag`]: envelope.authTag,
})

export async function encryptMetaConnectionForDatabase<T extends { access_token: string; page_access_token: string }>(
  connection: T,
  keyring: MetaTokenKeyring,
) {
  const { access_token: accessToken, page_access_token: pageAccessToken, ...metadata } = connection
  const [accessEnvelope, pageEnvelope] = await Promise.all([
    encryptMetaToken(accessToken, keyring),
    encryptMetaToken(pageAccessToken, keyring),
  ])
  return {
    ...metadata,
    access_token: null,
    page_access_token: null,
    ...serializeMetaTokenForDatabase('access_token', accessEnvelope),
    ...serializeMetaTokenForDatabase('page_access_token', pageEnvelope),
    key_version: keyring.activeVersion,
  }
}

export const sanitizeMetaConnectionForFrontend = (connection: Record<string, unknown>) => ({
  id: typeof connection.id === 'string' ? connection.id : null,
  platform: typeof connection.platform === 'string' ? connection.platform : null,
  connection_status: typeof connection.connection_status === 'string' ? connection.connection_status : null,
  expires_at: typeof connection.expires_at === 'string' ? connection.expires_at : null,
  last_validated_at: typeof connection.last_validated_at === 'string' ? connection.last_validated_at : null,
})

export const META_TOKEN_CRYPTO_ALGORITHM = ALGORITHM

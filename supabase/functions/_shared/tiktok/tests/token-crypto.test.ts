import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTikTokTokenKeyring,
  decryptTikTokToken,
  encryptTikTokConnectionForDatabase,
  encryptTikTokToken,
  loadTikTokTokenKeyringFromEnvironment,
  rotateTikTokTokenEnvelope,
  sanitizeTikTokConnectionForFrontend,
} from '../token-crypto.ts'

const context = { environment: 'sandbox' as const, appId: 'a'.repeat(64), userId: '11111111-1111-4111-8111-111111111111', openId: 'test-open-id', kind: 'access' as const }
const ACCESS_TOKEN = 'fake-tiktok-access-token-for-unit-test'
const REFRESH_TOKEN = 'fake-tiktok-refresh-token-for-unit-test'
const base64Key = (seed: number) => btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => (seed + index) % 256)))
const keys = { v1: base64Key(9), v2: base64Key(109) }
const keyring = await createTikTokTokenKeyring({ activeVersion: 'v2', keys })

test('AES-256-GCM encrypts and decrypts TikTok tokens without plaintext persistence', async () => {
  const envelope = await encryptTikTokToken(ACCESS_TOKEN, keyring, context)
  assert.equal(await decryptTikTokToken(envelope, keyring, context), ACCESS_TOKEN)
  assert.equal(envelope.algorithm, 'AES-256-GCM')
  assert.equal(JSON.stringify(envelope).includes(ACCESS_TOKEN), false)
})

test('every token encryption receives a fresh 96-bit nonce', async () => {
  const first = await encryptTikTokToken(ACCESS_TOKEN, keyring, context)
  const second = await encryptTikTokToken(ACCESS_TOKEN, keyring, context)
  assert.notEqual(first.nonce, second.nonce)
  assert.notEqual(first.ciphertext, second.ciphertext)
})

test('tampered authentication tag and wrong key fail with sanitized errors', async () => {
  const envelope = await encryptTikTokToken(ACCESS_TOKEN, keyring, context)
  const tampered = { ...envelope, authTag: `${envelope.authTag[0] === 'A' ? 'B' : 'A'}${envelope.authTag.slice(1)}` }
  await assert.rejects(() => decryptTikTokToken(tampered, keyring, context), /^Error: tiktok_token_decryption_failed$/)
  const wrong = await createTikTokTokenKeyring({ activeVersion: 'v2', keys: { v2: base64Key(201) } })
  await assert.rejects(() => decryptTikTokToken(envelope, wrong, context), /^Error: tiktok_token_decryption_failed$/)
})

test('old key can be read and rotated to the active version', async () => {
  const oldEnvelope = await encryptTikTokToken(ACCESS_TOKEN, keyring, context, { keyVersion: 'v1' })
  const rotated = await rotateTikTokTokenEnvelope(oldEnvelope, keyring, context)
  assert.equal(rotated.rotated, true)
  assert.equal(rotated.envelope.keyVersion, 'v2')
  assert.equal(await decryptTikTokToken(rotated.envelope, keyring, context), ACCESS_TOKEN)
})

test('keyring reads only TikTok-specific injected environment names', async () => {
  const environment = new Map([
    ['TIKTOK_TOKEN_ACTIVE_KEY_VERSION', 'v2'],
    ['TIKTOK_TOKEN_KEYRING_JSON', JSON.stringify(keys)],
  ])
  const requested: string[] = []
  const loaded = await loadTikTokTokenKeyringFromEnvironment(name => {
    requested.push(name)
    return environment.get(name)
  })
  assert.equal(loaded.activeVersion, 'v2')
  assert.deepEqual(requested, ['TIKTOK_TOKEN_ACTIVE_KEY_VERSION', 'TIKTOK_TOKEN_KEYRING_JSON'])
})

test('connection persistence encrypts access and refresh token independently', async () => {
  const stored = await encryptTikTokConnectionForDatabase({
    user_id: 'user-1', provider: 'tiktok', accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN,
  }, keyring, context)
  const serialized = JSON.stringify(stored)
  assert.equal(Object.hasOwn(stored, 'accessToken'), false)
  assert.equal(Object.hasOwn(stored, 'refreshToken'), false)
  assert.equal(stored.key_version, 'v2')
  assert.notEqual(stored.access_token_nonce, stored.refresh_token_nonce)
  assert.equal(serialized.includes(ACCESS_TOKEN), false)
  assert.equal(serialized.includes(REFRESH_TOKEN), false)
})

test('frontend serialization excludes every credential and key field', () => {
  const response = sanitizeTikTokConnectionForFrontend({
    id: 'connection-id', provider: 'tiktok', connection_status: 'active', display_name: 'Test Creator',
    access_token_ciphertext: 'ciphertext', refresh_token_ciphertext: 'ciphertext', key_version: 'v2',
    access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN,
  })
  const serialized = JSON.stringify(response)
  assert.equal(serialized.includes(ACCESS_TOKEN), false)
  assert.equal(serialized.includes(REFRESH_TOKEN), false)
  assert.doesNotMatch(serialized, /ciphertext|nonce|auth_tag|key_version/i)
})

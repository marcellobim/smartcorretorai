import test from 'node:test'
import assert from 'node:assert/strict'
import { hasVideoLoginRecovery, isVideoSessionInvalid, requireVideoSession, validVideoUploads, verifyVideoUploads, videoLoginDestination, UPLOAD_RECOVERY_TTL } from '../src/lib/smart-tour-auth-recovery.js'
import { writeProductDraft, readProductDraft } from '../src/lib/product-draft.js'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const uploads = () => ({ requestId, savedAt: Date.now(), paths: Array.from({ length: 5 }, (_, i) => `${owner}/smart-tour/${requestId}/0${i + 1}.jpg`) })
const storage = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) } }

test('SDK HTTP error body identifies session_not_found without consuming the Response', async () => {
  const context = new Response(JSON.stringify({ error_code: 'session_not_found' }), { status: 403 })
  assert.equal(await isVideoSessionInvalid({ message: 'Edge Function returned a non-2xx status code', context }), true)
  assert.equal(context.bodyUsed, false)
  assert.equal(await isVideoSessionInvalid({ context: new Response('not json', { status: 401 }) }), true)
  assert.equal(await isVideoSessionInvalid(null, { error: 'Sua sessão expirou.' }), true)
  assert.equal(await isVideoSessionInvalid(null, { error: 'session_not_found' }), true)
  for (const error of [{ status: 403, code: 'permission_denied' }, { status: 500 }, new Error('Failed to fetch')]) {
    assert.equal(await isVideoSessionInvalid(error), false)
  }
})

test('server validation rejects missing sessions and account changes; network failure is distinct', async () => {
  let providerCalls = 0
  const client = result => ({ auth: { getUser: async () => result }, functions: { invoke: () => { providerCalls++; throw Error('must never be called') } } })
  await assert.rejects(requireVideoSession(client({ data: { user: null }, error: { code: 'session_not_found', status: 403 } }), owner), /Entre novamente/)
  await assert.rejects(requireVideoSession(client({ data: {}, error: new Error('network') }), owner), /conexão/)
  await assert.rejects(requireVideoSession(client({ data: { user: { id: other } } }), owner), /mesma conta/)
  await requireVideoSession(client({ data: { user: { id: owner } } }), owner)
  assert.equal(providerCalls, 0)
})

test('photos are account scoped, bounded, ordered, unique, without signed URLs or traversal', () => {
  const value = uploads()
  assert.deepEqual(validVideoUploads(value, owner), value)
  assert.equal(validVideoUploads(value, other), null)
  assert.equal(validVideoUploads({ ...value, savedAt: Date.now() - UPLOAD_RECOVERY_TTL - 1 }, owner), null)
  for (const paths of [[], [...value.paths, value.paths[0]], [value.paths[0] + '?token=secret'], [`${owner}/smart-tour/${requestId}/../01.jpg`], ['https://example.test/01.jpg']]) {
    assert.equal(validVideoUploads({ ...value, paths }, owner), null)
  }
})

test('reuse checks private object existence with the authenticated client and never uploads or generates', async () => {
  let lists = 0
  const value = uploads()
  const client = { storage: { from: bucket => {
    assert.equal(bucket, 'studio-videos')
    return { list: async prefix => { lists++; assert.equal(prefix, `${owner}/smart-tour/${requestId}`); return { data: value.paths.map(p => ({ name: p.split('/').at(-1), id: 'object' })) } } }
  } } }
  assert.deepEqual(await verifyVideoUploads(client, value, owner), value)
  assert.equal(lists, 1)
  await assert.rejects(verifyVideoUploads(client, value, other), /não estão disponíveis/)
  assert.equal(lists, 1)
  await assert.rejects(verifyVideoUploads({ storage: { from: () => ({ list: async () => ({ data: [] }) }) } }, value, owner), /não está mais disponível/)
})

test('briefing, presenter choices and private photo references survive login for the same account only', () => {
  const store = storage()
  const draft = { property: { city: 'Cidade sintética' }, generation: { presenterGender: 'female', presenterCustomSpeech: 'Texto sintético' }, ctaEnabled: false, includePhone: false, conversation: { activeQuestionId: 'review', history: [] }, uploads: uploads(), resumeAfterLogin: true }
  assert.equal(writeProductDraft(store, { productKey: 'video-imobiliario', schemaVersion: 1, userId: owner, data: draft }), true)
  assert.equal(videoLoginDestination(store, owner), '/smart-tour-ai')
  assert.equal(hasVideoLoginRecovery(store), true)
  assert.deepEqual(readProductDraft(store, { productKey: 'video-imobiliario', schemaVersion: 1, userId: owner }), draft)
  assert.equal(videoLoginDestination(store, other), '/dashboard')
  assert.equal(readProductDraft(store, { productKey: 'video-imobiliario', schemaVersion: 1, userId: other }), null)
  assert.equal(hasVideoLoginRecovery(store), false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PRODUCT_DRAFT_TTL_MS,
  clearProductDraft,
  getProductDraftStorageKey,
  readProductDraft,
  sanitizeProductDraftValue,
  toFileMetadata,
  writeProductDraft,
} from '../src/lib/product-draft.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const hook = read('../src/hooks/useProductDraft.js')
const conversation = read('../src/hooks/useGuidedConversation.js')
const carousel = read('../src/pages/SmartCarrossel.jsx')
const banner = read('../src/pages/HeroNext.jsx')
const quickBanners = read('../src/pages/NovaCampanha.jsx')
const staging = read('../src/pages/VirtualStaging.jsx')
const auth = read('../src/lib/auth-context.jsx')

const options = { productKey: 'test-product', schemaVersion: 3, userId: 'user-a' }

test('saves and restores a namespaced, versioned draft for the same user', () => {
  const storage = new MemoryStorage()
  assert.equal(writeProductDraft(storage, { ...options, data: { step: 2, answers: { purpose: 'sale' } }, now: 1000 }), true)
  const key = getProductDraftStorageKey(options.productKey, options.schemaVersion)
  const envelope = JSON.parse(storage.getItem(key))
  assert.deepEqual(envelope, { schemaVersion: 3, userId: 'user-a', updatedAt: 1000, data: { step: 2, answers: { purpose: 'sale' } } })
  assert.deepEqual(readProductDraft(storage, { ...options, now: 2000 }), { step: 2, answers: { purpose: 'sale' } })
})

test('rejects and removes corrupted, incompatible and cross-user drafts', () => {
  for (const value of ['{broken', JSON.stringify({ schemaVersion: 2, userId: 'user-a', updatedAt: 1000, data: {} }), JSON.stringify({ schemaVersion: 3, userId: 'user-b', updatedAt: 1000, data: {} })]) {
    const storage = new MemoryStorage()
    const key = getProductDraftStorageKey(options.productKey, options.schemaVersion)
    storage.setItem(key, value)
    assert.equal(readProductDraft(storage, { ...options, now: 2000 }), null)
    assert.equal(storage.getItem(key), null)
  }
})

test('removes drafts older than seven days and renews updatedAt on save', () => {
  const storage = new MemoryStorage()
  writeProductDraft(storage, { ...options, data: { step: 1 }, now: 1000 })
  assert.equal(readProductDraft(storage, { ...options, now: 1000 + PRODUCT_DRAFT_TTL_MS + 1 }), null)
  writeProductDraft(storage, { ...options, data: { step: 2 }, now: 9000 })
  assert.equal(JSON.parse(storage.getItem(getProductDraftStorageKey(options.productKey, options.schemaVersion))).updatedAt, 9000)
})

test('never serializes credentials, CAPTCHA, binary objects, base64 or signed URLs', () => {
  const storage = new MemoryStorage()
  const unsafe = [
    { accessToken: 'private' },
    { refresh_token: 'private' },
    { captcha: 'private' },
    { image: new Blob(['binary'], { type: 'image/png' }) },
    { data: 'raw-provider-or-base64' },
    { imageUrl: 'data:image/png;base64,AAAA' },
    { privateUrl: 'https://example.com/file?token=signed' },
    { jwt: 'eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop' },
  ]
  for (const data of unsafe) assert.equal(writeProductDraft(storage, { ...options, data }), false)
  assert.equal(storage.values.size, 0)
  assert.equal(sanitizeProductDraftValue({ safe: ['choice', 2, true] }).safe[0], 'choice')
})

test('stores only inert file metadata and exposes explicit clear/restore/save/replace operations', () => {
  assert.deepEqual(toFileMetadata({ name: 'foto.jpg', size: 42, type: 'image/jpeg', lastModified: 7 }, 2), { name: 'foto.jpg', size: 42, type: 'image/jpeg', lastModified: 7, order: 2 })
  assert.match(hook, /\(\) => \(\{ restoredDraft, save, replace, clear, restore \}\)/)
  assert.match(hook, /useEffect\(\(\) => \(\) => flushPending\(\)/)
  const storage = new MemoryStorage()
  writeProductDraft(storage, { ...options, data: { files: [{ name: 'foto.jpg', size: 42, type: 'image/jpeg', lastModified: 7, order: 0 }] } })
  clearProductDraft(storage, options)
  assert.equal(storage.values.size, 0)
})

test('guided conversation accepts restored stable state and reports progress without persisting internal prompts', () => {
  assert.match(conversation, /initialState = null/)
  assert.match(conversation, /initialState\?\.activeQuestionId \?\? initialQuestionId/)
  assert.match(conversation, /onStateChangeRef\.current\?\.\(\{ activeQuestionId, history, phase \}\)/)
  assert.match(conversation, /phase !== CONVERSATION_PHASE\.QUESTION/)
})

test('Smart Carrossel restores allowlisted flow and requests physical file reselection', () => {
  assert.match(carousel, /smart-carousel:media/)
  assert.match(carousel, /smart-carousel:flow/)
  assert.match(carousel, /photoMetadata/)
  assert.match(carousel, /selecione novamente[\s\S]*imagens físicas não ficam salvas/i)
  assert.match(carousel, /initialState: restoredFlow\.conversation/)
  assert.doesNotMatch(carousel, /mediaDraft\.save\([^)]*\bfile\b/)
})

test('Banner Imobiliário restores briefing and options without image base64', () => {
  assert.match(banner, /productKey: 'banner-imobiliario'/)
  assert.match(banner, /const draft = \{ phase, goal, answers, chatIndex/)
  assert.match(banner, /imageMetadata/)
  assert.match(banner, /Selecione novamente[\s\S]*arquivos físicos não são armazenados/)
  assert.doesNotMatch(banner, /bannerDraft\.save\([^)]*uploadedImages/)
})

test('Banners Rápidos restores only essential choices and never restarts generation', () => {
  assert.match(quickBanners, /productKey: 'banners-rapidos'/)
  assert.match(quickBanners, /selectedModelUses, campaignObjective, photoMetadata, videoMetadata/)
  assert.match(quickBanners, /enabled: !isProductEntry/)
  assert.doesNotMatch(quickBanners, /quickBannerDraft\.restoredDraft[\s\S]{0,300}(?:confirmarGeracao|gerarCampanha)\(/)
})

test('Virtual Staging restores journey/options/conversation and never physical uploads', () => {
  assert.match(staging, /virtual-staging:selection/)
  assert.match(staging, /productKey: `virtual-staging:\$\{journey\.id\}`/)
  assert.match(staging, /imageMetadata/)
  assert.match(staging, /presenterMetadata/)
  assert.match(staging, /initialState: restoredJourneyDraft\.conversation/)
  assert.doesNotMatch(staging, /journeyDraft\.save\([^)]*(?:\bimages\b|presenterReference)/)
})

test('draft restore remains separate from jobs, economy and auth lifecycle', () => {
  for (const source of [carousel, banner, quickBanners, staging]) {
    assert.doesNotMatch(source, /restoredDraft[\s\S]{0,240}(?:reserve|consume|checkout|createPresentation|confirmarGeracao|createTour)\(/i)
  }
  assert.match(auth, /classifyAuthSessionTransition/)
  assert.match(read('../src/lib/auth-session-policy.js'), /SILENT_REFRESH: 'silent_refresh'/)
  assert.match(auth, /is_authorized_admin/)
  assert.match(read('../src/components/auth/AdminMfaGate.jsx'), /currentLevel === 'aal2'/)
})

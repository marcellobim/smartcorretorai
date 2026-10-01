import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PRODUCT_DRAFT_TTL_MS,
  getProductDraftStorageKey,
  readProductDraft,
  restoreProductDraftShape,
  writeProductDraft,
} from '../src/lib/product-draft.js'

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const smartTour = read('../src/pages/SmartTourAI.jsx')
const textCampaign = read('../src/pages/TextCampaign.jsx')
const smartTokens = read('../src/lib/smart-tokens.js')
const auth = read('../src/lib/auth-context.jsx')

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

test('restores only fields and types declared by the product shape', () => {
  assert.deepEqual(
    restoreProductDraftShape(
      { purpose: '', highlights: [], commercial: { price: '', enabled: false } },
      { purpose: 'sale', highlights: ['vista'], commercial: { price: '100', enabled: true, secret: 'ignored' }, injected: 'ignored' },
    ),
    { purpose: 'sale', highlights: ['vista'], commercial: { price: '100', enabled: true } },
  )
  assert.deepEqual(
    restoreProductDraftShape({ purpose: '', highlights: [] }, { purpose: 42, highlights: 'not-an-array' }),
    { purpose: '', highlights: [] },
  )
})

test('Vídeo Imobiliário saves and restores its allowlisted pre-generation flow', () => {
  assert.match(smartTour, /useProductDraft\(\{ productKey: 'video-imobiliario', schemaVersion: 1, userId: user\?\.id \}\)/)
  assert.match(smartTour, /restoreProductDraftShape\(initialProperty, restoredTourDraft\.property\)/)
  assert.match(smartTour, /restoreProductDraftShape\(initialGeneration, restoredTourDraft\.generation\)/)
  assert.match(smartTour, /initialState: restoredTourDraft\.conversation/)
  assert.match(smartTour, /activeInputFlow, property, generation, ctaEnabled, cta, includePhone, showProfessionalIdentity, imageMetadata, shortVideoMetadata, conversation:/)
  assert.match(smartTour, /toFileMetadata\(item\.file, order\)/)
  assert.match(smartTour, /Rascunho restaurado[\s\S]*arquivos físicos não são armazenados/)
  assert.doesNotMatch(smartTour, /tourDraft\.save\([^\n]*(?:\bFile\b|\bBlob\b|base64|objectURL|preview)/i)
})

test('Vídeo Imobiliário recovery preserves property data, custom speech, captions, CTA and professional identity independently', () => {
  const restored = restoreProductDraftShape(
    {
      property: { highlights: [] },
      generation: { presenterSpeechMode: 'automatic', presenterCustomSpeech: '', narration: '', captions: '' },
      ctaEnabled: false,
      cta: '',
      showProfessionalIdentity: false,
    },
    {
      property: { highlights: ['Vista para o mar', 'Varanda gourmet'] },
      generation: { presenterSpeechMode: 'custom', presenterCustomSpeech: 'Conheça este imóvel incrível.', narration: 'enabled', captions: 'disabled' },
      ctaEnabled: true,
      cta: 'Agende sua visita',
      showProfessionalIdentity: true,
    },
  )

  assert.deepEqual(restored.property.highlights, ['Vista para o mar', 'Varanda gourmet'])
  assert.equal(restored.generation.presenterSpeechMode, 'custom')
  assert.equal(restored.generation.presenterCustomSpeech, 'Conheça este imóvel incrível.')
  assert.equal(restored.generation.narration, 'enabled')
  assert.equal(restored.generation.captions, 'disabled')
  assert.equal(restored.ctaEnabled, true)
  assert.equal(restored.cta, 'Agende sua visita')
  assert.equal(restored.showProfessionalIdentity, true)
  assert.match(smartTour, /typeof restoredTourDraft\.ctaEnabled === 'boolean' \? restoredTourDraft\.ctaEnabled : null/)
  assert.match(smartTour, /typeof restoredTourDraft\.showProfessionalIdentity === 'boolean' \? restoredTourDraft\.showProfessionalIdentity : null/)
})

test('Vídeo Imobiliário gives active-job recovery priority and restore has no economic side effects', () => {
  const draftEffect = smartTour.slice(smartTour.indexOf("if (!['idle', 'error'].includes(status))"), smartTour.indexOf('const answerQuestion'))
  assert.match(draftEffect, /readSmartTourActiveJob\(sessionStorage\)\.record/)
  assert.doesNotMatch(draftEffect, /(?:functions\.invoke|storage\.from|createTour|reserve|consume|poll\()/i)
  assert.match(smartTour, /readSmartTourActiveJob\(sessionStorage\)[\s\S]*poll\(activeJob\.jobId\)/)
  assert.match(smartTour, /writeSmartTourActiveJob\(sessionStorage,[\s\S]{0,500}tourDraft\.clear\(\)/)
  assert.match(smartTour, /const reset = \(\) => \{\s*setAuthRequired\(false\)\s*setResumeAfterLogin\(false\)\s*tourDraft\.clear\(\)\s*clearSmartTourActiveJob/)
})

test('Campanha de Textos saves/restores briefing and conversation without replacing request idempotency', () => {
  assert.match(textCampaign, /useProductDraft\(\{ productKey: 'campanha-de-textos', schemaVersion: 1, userId: user\?\.id \}\)/)
  assert.match(textCampaign, /restoreProductDraftShape\(createEmptyTextCampaignAnswers\(\), restoredTextDraft\.answers\)/)
  assert.match(textCampaign, /initialState: restoredTextDraft\.conversation/)
  assert.match(textCampaign, /textDraft\.save\(\{ answers, manualCityMode, conversation: conversationSnapshot \}\)/)
  assert.match(textCampaign, /TEXT_CAMPAIGN_REQUEST_STORAGE_KEY = 'smartcorretor:text-campaign:client-request-id'/)
  assert.match(textCampaign, /requestIdPattern\.test\(stored\)/)
  assert.match(textCampaign, /client_request_id: generationRequestRef\.current/)
  assert.match(textCampaign, /const createNewCampaign = \(\) => \{\s*textDraft\.clear\(\)/)
})

test('Campanha de Textos restore does not generate or charge and price remains 25 ST', () => {
  const draftEffectStart = textCampaign.indexOf('useEffect(() => {', textCampaign.indexOf('const summaryItems'))
  const draftEffect = textCampaign.slice(draftEffectStart, textCampaign.indexOf('useEffect(() => {', draftEffectStart + 1))
  assert.doesNotMatch(draftEffect, /(?:functions\.invoke|generateCampaign|reserve|consume|client_request_id)/i)
  assert.match(smartTokens, /textCampaign:\s*25\b/)
  assert.match(textCampaign, /SMART_TOKEN_COSTS\.textCampaign/)
})

test('Campanha de Textos keeps only a completed-delivery reference for automatic recovery', () => {
  assert.match(textCampaign, /completedRequestRef/)
  assert.match(textCampaign, /textDraft\.replace\(\{ completedRequestId: generationRequestRef\.current \}\)/)
  assert.match(textCampaign, /body: \{ client_request_id: clientRequestId, recovery: true \}/)
  assert.doesNotMatch(textCampaign, /textDraft\.replace\(\{[^}]*campaign/i)
})

test('draft ownership, seven-day expiry and auth refresh protections remain shared', () => {
  const storage = new MemoryStorage()
  const options = { productKey: 'video-imobiliario', schemaVersion: 1, userId: 'user-a' }
  assert.equal(writeProductDraft(storage, { ...options, data: { property: { purpose: 'sale' } }, now: 1000 }), true)
  assert.equal(readProductDraft(storage, { ...options, userId: 'user-b', now: 2000 }), null)

  writeProductDraft(storage, { ...options, data: { property: { purpose: 'sale' } }, now: 5000 })
  assert.equal(readProductDraft(storage, { ...options, now: 5000 + PRODUCT_DRAFT_TTL_MS + 1 }), null)
  assert.equal(storage.getItem(getProductDraftStorageKey(options.productKey, options.schemaVersion)), null)

  assert.match(auth, /classifyAuthSessionTransition/)
  assert.match(read('../src/lib/auth-session-policy.js'), /SILENT_REFRESH: 'silent_refresh'/)
  assert.match(auth, /is_authorized_admin/)
  assert.match(read('../src/components/auth/AdminMfaGate.jsx'), /currentLevel === 'aal2'/)
})

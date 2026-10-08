import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

let vite
let buildHeroNextGenerationRequest
let invokeHeroNextGenerationStart

const square = { id: 'instagram_feed', label: 'Instagram/Facebook square feed', format_group: 'square_feed' }
const vertical = { id: 'story_reels', label: 'Reels/TikTok/Stories vertical', format_group: 'vertical' }
const idea = { number: 1, title: 'Essential campaign', description: 'Clean property-first direction', visualAngle: 'single_campaign_piece' }
const base = {
  goal: 'sale',
  answers: { propertyType: 'us_single_family_home', profile: 'Alto padrão', stage: 'Pronto para morar', bedrooms: '3', suites: '2', parking: '2', area: '1850', state: 'Florida', county: 'Miami-Dade', city: 'Miami', zipCode: '33139', neighborhood: '', cta: 'Fale comigo', differentials: ['Varanda gourmet'] },
  valueCondition: { mode: 'price', label: 'Valor', details: 'Valor: R$ 850.000', promptLines: [] },
  creativeIdea: idea, creativeIdeaCount: 1, uploadedImages: [], campaignBatchId: 'test-batch', formatIndex: 1, totalFormats: 2, jobIndex: 1, totalJobs: 2,
  economicContext: { clientRequestId: 'test-request', claimToken: 'claim', itemId: 'item' }, rentMode: 'hide', condoMode: 'na', iptuMode: 'na', rentGuarantee: 'nao_informar', professionalMarket: 'BR',
}

test.before(async () => {
  vite = await createServer({ root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent', define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://project.example.test'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  } })
  ;({ buildHeroNextGenerationRequest, invokeHeroNextGenerationStart } = await vite.ssrLoadModule('/src/pages/HeroNext.jsx'))
})

test.after(async () => vite?.close())

test('intercepts the exact US generation request after format instructions', async () => {
  const payload = buildHeroNextGenerationRequest({ ...base, market: 'US', locale: 'pt-BR', destination: vertical })
  const sent = []
  await invokeHeroNextGenerationStart(async (options) => { sent.push(options); return { data: { success: true } } }, payload)
  const body = sent[0].body
  assert.equal(body.market, 'US')
  assert.equal(body.locale, 'en-US')
  assert.equal(body.format_generation.format_id, 'story_reels')
  assert.equal(body.property_profile, 'High-end')
  assert.equal(body.property_stage, 'Move-in ready')
  assert.equal(body.bathrooms, '2')
  assert.equal(body.suites, '2')
  assert.equal(body.cta, 'Contact us')
  assert.equal(body.display_area, '1,850 sqft')
  assert.match(body.value_condition.details, /USD \$850,000/)
  assert.match(body.human_prompt, /OUTPUT LANGUAGE REQUIREMENT/)
  assert.match(body.human_prompt, /US English only/)
  assert.match(body.human_prompt, /bedrooms, bathrooms, parking spaces, square feet, and USD/)
  assert.doesNotMatch(body.human_prompt, /Locação|Captação de Imóveis|Fale comigo|Pronto para morar|dormitórios|suítes|vagas|m²|R\$/i)
})

test('uses the market at submission time in both directions and keeps technical destination ids', () => {
  const brAfterUs = buildHeroNextGenerationRequest({ ...base, market: 'BR', locale: 'en-US', destination: square, answers: { ...base.answers, propertyType: 'Apartamento', stage: 'Lançamento', cta: '' } })
  const usAfterBr = buildHeroNextGenerationRequest({ ...base, market: 'US', locale: 'pt-BR', destination: square })
  assert.equal(brAfterUs.market, 'BR')
  assert.equal(brAfterUs.locale, 'pt-BR')
  assert.match(brAfterUs.human_prompt, /português|imobiliária|Fale comigo/i)
  assert.equal(usAfterBr.market, 'US')
  assert.equal(usAfterBr.locale, 'en-US')
  assert.match(usAfterBr.human_prompt, /US English only/)
  assert.equal(usAfterBr.primary_destination.id, 'instagram_feed')
  assert.equal(usAfterBr.format_generation.total, 2)
})

test('keeps BR currency and area while US uses USD and square feet before the provider is called', () => {
  const br = buildHeroNextGenerationRequest({
    ...base,
    market: 'BR',
    locale: 'en-US',
    destination: square,
    answers: { ...base.answers, propertyType: 'Apartamento', area: '85', cta: 'Fale comigo' },
    valueCondition: { mode: 'price', label: 'Valor', details: 'Valor: R$ 850.000', promptLines: [] },
  })
  const us = buildHeroNextGenerationRequest({ ...base, market: 'US', locale: 'pt-BR', destination: vertical })

  assert.equal(br.locale, 'pt-BR')
  assert.equal(br.display_area, '85 m²')
  assert.match(br.value_condition.details, /R\$ 850\.000/)
  assert.equal(us.locale, 'en-US')
  assert.equal(us.display_area, '1,850 sqft')
  assert.match(us.value_condition.details, /USD \$850,000/)
  assert.equal(br.bathrooms, '')
  assert.equal(us.bathrooms, '2')
})

test('permits an absent optional US ZIP without inventing a value in the intercepted payload', async () => {
  const payload = buildHeroNextGenerationRequest({ ...base, market: 'US', destination: square, answers: { ...base.answers, zipCode: '' } })
  const sent = []
  await invokeHeroNextGenerationStart(async (options) => { sent.push(options); return { data: { success: true } } }, payload)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].body.zip_code, '')
  assert.doesNotMatch(JSON.stringify(sent[0].body), /00000|33139/)
})

test('the intercepted handler receives only visible US commercial data', async () => {
  const payload = buildHeroNextGenerationRequest({
    ...base,
    market: 'US',
    destination: square,
    answers: { ...base.answers, suites: '3' },
    valueCondition: {
      mode: 'hidden', label: 'No pricing details provided', details: '',
      promptLines: ['Do not show prices in the campaign.'],
    },
    rentMode: 'hide', condoMode: 'hide', iptuMode: 'hide',
    rentPrice: '$2,000', condoFee: '$300', iptuValue: '$100',
  })
  const sent = []
  await invokeHeroNextGenerationStart(async (options) => { sent.push(options); return { data: { success: true } } }, payload)
  const body = sent[0].body
  assert.equal(body.market, 'US')
  assert.equal(body.bathrooms, '3')
  assert.equal(body.suites, '3') // legacy compatibility remains intact
  assert.equal(body.rent_price, '')
  assert.equal(body.condo_fee, '')
  assert.equal(body.iptu, '')
  assert.equal(body.value_condition.mode, 'hidden')
  assert.doesNotMatch(body.human_prompt, /\$2,000|\$300|\$100/)
})

test('keeps the three commercial visibility modes distinct in the real request builder', () => {
  const price = buildHeroNextGenerationRequest({ ...base, market: 'US', destination: square, valueCondition: { mode: 'price', label: 'Property price provided', details: 'Price: $850,000', promptLines: ['Price: $850,000.'] } })
  const terms = buildHeroNextGenerationRequest({ ...base, market: 'US', destination: square, valueCondition: { mode: 'conditions', label: 'Commercial terms only', details: 'Financing available', promptLines: ['Commercial terms: Financing available.', 'Do not show a price.'] } })
  const hidden = buildHeroNextGenerationRequest({ ...base, market: 'US', destination: square, valueCondition: { mode: 'hidden', label: 'No pricing details provided', details: '', promptLines: ['Do not show prices in the campaign.'] } })
  assert.equal(price.value_condition.mode, 'price')
  assert.match(price.human_prompt, /\$850,000/)
  assert.equal(terms.value_condition.mode, 'conditions')
  assert.match(terms.human_prompt, /Financing available/)
  assert.doesNotMatch(terms.human_prompt, /\$850,000/)
  assert.equal(hidden.value_condition.mode, 'hidden')
  assert.doesNotMatch(hidden.human_prompt, /\$850,000/)
})

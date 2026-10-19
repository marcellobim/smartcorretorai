import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

let vite
let buildHeroNextGenerationRequest
let buildHeroNextCopyInput
let invokeHeroNextGenerationStart
let isExplicitGenerationActivation

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
  ;({ buildHeroNextGenerationRequest, buildHeroNextCopyInput, invokeHeroNextGenerationStart, isExplicitGenerationActivation } = await vite.ssrLoadModule('/src/pages/HeroNext.jsx'))
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

test('only a trusted browser activation may enter the final generation handler', () => {
  assert.equal(isExplicitGenerationActivation(), false)
  assert.equal(isExplicitGenerationActivation({ isTrusted: false }), false)
  assert.equal(isExplicitGenerationActivation({ nativeEvent: { isTrusted: false } }), false)
  assert.equal(isExplicitGenerationActivation({ isTrusted: true }), true)
  assert.equal(isExplicitGenerationActivation({ nativeEvent: { isTrusted: true } }), true)
})

test('resolves controlled Instagram/Facebook values from the active market catalog', () => {
  const us = buildHeroNextCopyInput('sale', {
    ...base.answers,
    propertyType: 'Apartamento',
    stage: 'Pré-lançamento',
  }, base.valueCondition, 'US')
  const br = buildHeroNextCopyInput('sale', {
    ...base.answers,
    propertyType: 'Apartamento',
    stage: 'Pré-lançamento',
  }, base.valueCondition, 'BR')

  assert.equal(us.language, 'en-US')
  assert.equal(us.stage, 'Pre-launch')
  assert.equal(br.language, 'pt-BR')
  assert.equal(br.stage, 'Pré-lançamento')

  const usPayload = buildHeroNextGenerationRequest({
    ...base,
    market: 'US',
    destination: square,
    answers: {
      ...base.answers,
      propertyType: 'Apartamento',
      stage: 'Pré-lançamento',
      cta: 'Agende sua visita',
      city: 'Beverly Hills',
      neighborhood: 'Sunset Plaza',
      differentials: ['Comércio próximo'],
    },
  })
  const brPayload = buildHeroNextGenerationRequest({
    ...base,
    market: 'BR',
    destination: square,
    answers: { ...base.answers, propertyType: 'Apartamento', stage: 'Pré-lançamento' },
  })
  const usRentPayload = buildHeroNextGenerationRequest({
    ...base,
    goal: 'rent',
    market: 'US',
    destination: square,
    answers: {
      ...base.answers,
      propertyType: 'us_apartment',
      stage: 'Disponível já',
      cta: 'Fale comigo',
      differentials: ['Parque próximo'],
    },
  })

  const usDelivery = JSON.stringify(usPayload.publication_options)
  const brDelivery = JSON.stringify(brPayload.publication_options)
  const usRentDelivery = JSON.stringify(usRentPayload.publication_options)

  assert.match(usDelivery, /Apartment \(Pre-launch\) for sale/)
  assert.match(usDelivery, /Sunset Plaza, Beverly Hills/)
  assert.match(usDelivery, /Schedule a showing/)
  assert.match(usDelivery, /Near shopping/)
  assert.doesNotMatch(usDelivery, /Pré-lançamento|À venda|Apartamento|Agende sua visita|Comércio próximo/)
  assert.match(usRentDelivery, /Apartment \(Available now\) for rent/)
  assert.match(usRentDelivery, /Contact us/)
  assert.match(usRentDelivery, /Near parks/)
  assert.doesNotMatch(usRentDelivery, /us_apartment|Disponível já|Para aluguel|Fale comigo|Parque próximo/)
  assert.match(brDelivery, /Apartamento/)
  assert.match(brDelivery, /Pré-lançamento/)
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

test('US Banner sends every valid reference photo and resolves controlled highlights before campaign delivery', () => {
  const images = Array.from({ length: 4 }, (_, index) => ({
    name: `property-${index + 1}.jpg`, contentType: 'image/jpeg', data: `data:image/jpeg;base64,reference-${index + 1}`,
  }))
  const highlights = [
    'Comércio próximo', 'Parque próximo', 'Fácil acesso às principais vias', 'Lazer completo',
    'Aceita financiamento', 'Entrada facilitada', 'Condições especiais', 'Documentação em ordem', 'Unidades limitadas',
  ]
  const payload = buildHeroNextGenerationRequest({
    ...base,
    market: 'US',
    destination: square,
    uploadedImages: images,
    answers: { ...base.answers, differentials: highlights },
  })

  assert.deepEqual(payload.inline_images.map((image) => image.name), images.map((image) => image.name))
  assert.match(payload.human_prompt, /Use all 4 supplied property photos as required visual reference/)
  assert.match(payload.human_prompt, /do not silently discard a valid reference photo/i)
  assert.deepEqual(payload.highlights, [
    'Near shopping', 'Near parks', 'Easy access to major routes', 'Full leisure amenities',
    'Financing available', 'Flexible down payment options', 'Special terms available', 'Clear documentation', 'Limited availability',
  ])

  const delivery = JSON.stringify(payload.publication_options)
  assert.match(delivery, /Near shopping|Near parks/)
  assert.doesNotMatch(delivery, /Comércio próximo|Parque próximo|Fácil acesso às principais vias|Lazer completo|Aceita financiamento|Entrada facilitada|Condições especiais|Documentação em ordem|Unidades limitadas|#ComercioProximo/i)
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

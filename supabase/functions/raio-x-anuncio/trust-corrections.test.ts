import assert from 'node:assert/strict'
import test from 'node:test'
import { ATTRACTION_SECTION_COMPONENTS, validateListingXrayModelOutput } from './contract.ts'
import { LISTING_XRAY_V5_CANARY_EXTRACTION } from './fixtures/listing-xray-v5-canary-fixture.ts'
import { makeFirstCanaryQualityFixture } from './fixtures/model-output-fixtures.ts'
import { normalizeListing, informationScoreFromListing } from './normalize.ts'
import { buildListingXrayOpportunities } from './opportunities.ts'
import { LISTING_XRAY_PRODUCT_CAPABILITIES } from './product-capabilities.ts'
import { finalizeListingXrayResult } from './scoring.ts'

test('fixture V5 descarta falsos preços, normaliza endereço/finalidade e sanitiza amenities', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION)
  assert.equal(Number(listing.fields.price.value), 2200)
  assert.equal(listing.fields.address.value, 'Rua das Flores, Centro, São Paulo')
  assert.equal(listing.fields.purpose.value, 'rent')
  assert.deepEqual(listing.fields.amenities.value, ['Elevador'])
  assert.equal(listing.fields.suites.state, 'NOT_FOUND')
  assert.equal(listing.fields.parkingSpaces.value, 0)
  assert.deepEqual(listing.inconsistencies, [])
  assert.equal(informationScoreFromListing(listing), 100)
})

test('recomendações usam evidence_source e respeitam vídeo 1–5 e carrossel 5–20', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION)
  const model = validateListingXrayModelOutput(makeFirstCanaryQualityFixture())
  const opportunities = buildListingXrayOpportunities({ inputKind: 'url', imageCount: 0, listing, analysis: model.listing! })
  const video = opportunities.find(item => item.product_id === 'real_estate_video')!
  const carousel = opportunities.find(item => item.product_id === 'smart_carousel')!
  assert.match(video.benefit, /até 5/i); assert.doesNotMatch(video.benefit, /30 imagens/i)
  assert.match(carousel.benefit, /5 a 20/i); assert.doesNotMatch(carousel.benefit, /30 das/i)
  assert.ok(opportunities.every(item => item.evidence && item.evidence_source))
  assert.equal(LISTING_XRAY_PRODUCT_CAPABILITIES.real_estate_video.maximum, 5)
  assert.equal(LISTING_XRAY_PRODUCT_CAPABILITIES.smart_carousel.minimum, 5)
  assert.equal(LISTING_XRAY_PRODUCT_CAPABILITIES.smart_carousel.maximum, 20)
})

test('catálogo recomendado reflete os contratos auditados dos demais produtos', () => {
  const catalog = LISTING_XRAY_PRODUCT_CAPABILITIES
  assert.equal(catalog.virtual_staging.maximum, 5); assert.equal(catalog.virtual_staging.price_st, 30)
  assert.equal(catalog.quick_banners.maximum, 5); assert.equal(catalog.quick_banners.price_st, 45)
  assert.equal(catalog.real_estate_banner.maximum, 4); assert.equal(catalog.real_estate_banner.price_st, 75)
  assert.equal(catalog.text_campaign.price_st, 25); assert.equal(catalog.commercial_real_estate.price_st, 120)
  assert.equal(catalog.life_in_property.price_st, 325); assert.equal(catalog.broker_presentation.price_st, 325)
  assert.ok(Object.values(catalog).every(item => item.route.startsWith('/') && item.cta_label && item.purpose))
})

test('Virtual Staging exige observação visual rastreável', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION)
  const model = validateListingXrayModelOutput(makeFirstCanaryQualityFixture())
  model.listing!.description.issue_codes.push('empty_room_detected')
  const url = buildListingXrayOpportunities({ inputKind: 'url', imageCount: 0, listing, analysis: model.listing! })
  const images = buildListingXrayOpportunities({ inputKind: 'images', imageCount: 4, listing: null, analysis: model.listing! })
  assert.equal(url.some(item => item.product_id === 'virtual_staging'), false)
  assert.equal(images.find(item => item.product_id === 'virtual_staging')?.evidence_source, 'model_visual_observation')
})

test('attraction abaixo de 80 sem bloco acionável é rejeitada', () => {
  const raw = makeFirstCanaryQualityFixture()
  raw.listing!.attraction.components = Object.fromEntries(Object.keys(ATTRACTION_SECTION_COMPONENTS).map(key => [key, 3]))
  raw.listing!.attraction.suggestion_mode = 'none'; raw.listing!.attraction.suggestion = null; raw.listing!.attraction.copy_text = null
  raw.listing!.attraction.issue_codes = []; raw.listing!.attraction.what_can_improve = null; raw.listing!.attraction.how_to_improve = null
  assert.throws(() => validateListingXrayModelOutput(raw), /invalid_attraction_actionability/)
})

test('grounding remove alegação de localização não confirmada sem perder resultado', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION)
  const raw = makeFirstCanaryQualityFixture()
  raw.listing!.persuasion.what_works = 'A localização privilegiada oferece infraestrutura completa, metrô, comércio e serviços.'
  raw.listing!.persuasion.copy_text = 'Próximo ao metrô, comércio e serviços para uma rotina mais prática.'
  const result = finalizeListingXrayResult({ inputKind: 'url', listing }, validateListingXrayModelOutput(raw))
  assert.doesNotMatch(result.sections.persuasion.copy_text || '', /próximo ao metrô/i)
  assert.match(result.sections.persuasion.copy_text || '', /^Se houver comércio/i)
  assert.doesNotMatch(result.sections.persuasion.what_works || '', /infraestrutura completa|metrô|comércio/i)
})

test('grounding remove clichês imobiliários e produz copy baseada em fatos confirmados', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION); const raw = makeFirstCanaryQualityFixture()
  raw.listing!.description.copy_text = 'Uma oportunidade imperdível para viver uma experiência única em um lar acolhedor.'
  const result = finalizeListingXrayResult({ inputKind: 'url', listing }, validateListingXrayModelOutput(raw)); const copy = result.sections.description.copy_text || ''
  assert.doesNotMatch(copy, /oportunidade imperdível|experiência única|lar acolhedor/i)
  assert.match(copy, /93 m²/); assert.match(copy, /2 dormitórios/); assert.match(copy, /Entre em contato/i)
  assert.doesNotMatch(copy, /\(s\)|\(ns\)|imagemns/i)
})

test('fallback grounded do canário usa concordância natural para área, dormitório e suíte', () => {
  const listing = normalizeListing(LISTING_XRAY_V5_CANARY_EXTRACTION)
  listing.fields.area = { ...listing.fields.area, state: 'CONFIRMED', value: 30 }
  listing.fields.bedrooms = { ...listing.fields.bedrooms, state: 'CONFIRMED', value: 1 }
  listing.fields.suites = { ...listing.fields.suites, state: 'CONFIRMED', value: 1 }
  const raw = makeFirstCanaryQualityFixture()
  raw.listing!.attraction.copy_text = 'Uma experiência única em um lar acolhedor.'
  const result = finalizeListingXrayResult({ inputKind: 'url', listing }, validateListingXrayModelOutput(raw))
  const copy = result.attraction.copy_text || ''
  assert.match(copy, /30 m², 1 dormitório, 1 suíte/)
  assert.doesNotMatch(copy, /\(s\)|\(ns\)|imagemns/i)
})

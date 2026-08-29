import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildListingXrayImageRequest, buildListingXrayUrlRequest, LISTING_XRAY_MAX_IMAGES, LISTING_XRAY_SMART_TOKEN_COST, normalizeListingXrayUsage, validateListingXrayModelOutput } from './contract.ts'
import { extractListing } from './extract.ts'
import { validateListingXrayImages } from './images.ts'
import { normalizeListing } from './normalize.ts'
import { finalizeListingXrayResult, labelListingXrayScore, normalizeComponentScore } from './scoring.ts'
import { makeFirstCanaryQualityFixture, makeModelOutputFixture } from './fixtures/model-output-fixtures.ts'

const fixture = async (name: string) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
const pixel = `data:image/png;base64,${btoa('safe-image')}`

test('adaptadores locais continuam convergindo para o contrato normalizado', async () => {
  for (const [name, url, adapter] of [['quintoandar.html', 'https://www.quintoandar.com.br/imovel/1', 'quintoandar'], ['zap.html', 'https://www.zapimoveis.com.br/imovel/1', 'zap_vivareal'], ['imovelweb.html', 'https://www.imovelweb.com.br/propriedades/1', 'imovelweb'], ['generic.html', 'https://imobiliaria.example/imovel/1', 'generic']] as const) {
    const extracted = extractListing(await fixture(name), url); assert.equal(extracted.adapter, adapter); assert.ok(extracted.title || extracted.description)
  }
})

test('URL usa modelo textual barato e não pede campanha automática', async () => {
  const normalized = normalizeListing(extractListing(await fixture('jsonld-complete.html'), 'https://listing.example/complete'))
  const request = buildListingXrayUrlRequest(normalized)
  assert.equal(request.model, 'gpt-4o-mini'); assert.equal(request.store, false); assert.match(request.instructions, /Nunca gere campanha de textos/)
  const schema = JSON.stringify(request.text.format.schema)
  assert.doesNotMatch(schema, /google_ads|hashtags|reels_script|whatsapp|campaign_package|"campaign"/i)
})

test('imagens usam Responses multimodal, high detail e limite cinco', () => {
  const request = buildListingXrayImageRequest([pixel, pixel, pixel], null)
  assert.equal(request.model, 'gpt-4o-mini'); const content = request.input[0].content
  assert.equal(content.filter(item => item.type === 'input_image').length, 3); assert.ok(content.filter(item => item.type === 'input_image').every(item => item.detail === 'high'))
  assert.equal(LISTING_XRAY_MAX_IMAGES, 5); assert.throws(() => buildListingXrayImageRequest(Array(6).fill(pixel), null), /invalid_image_count/)
})

test('validação de imagem rejeita SVG, MIME inválido e payload acima do limite', () => {
  assert.equal(validateListingXrayImages([{ data_url: pixel }]).length, 1)
  assert.throws(() => validateListingXrayImages([{ data_url: 'data:image/svg+xml;base64,PHN2Zz4=' }]), /invalid_image_type/)
  assert.throws(() => validateListingXrayImages([]), /invalid_image_count/)
})

test('schema cobre anúncio, publicação, insuficiente e classificação incerta', () => {
  for (const kind of ['excellent', 'append', 'replace', 'social', 'needs_more', 'unsure'] as const) assert.doesNotThrow(() => validateListingXrayModelOutput(makeModelOutputFixture(kind)))
  const output = makeModelOutputFixture('excellent') as unknown as Record<string, unknown>; output.campaign = {}; assert.throws(() => validateListingXrayModelOutput(output), /invalid_model_output/)
})

test('resultado listing preserva evidências e resultado social usa critérios próprios', async () => {
  const normalized = normalizeListing(extractListing(await fixture('jsonld-complete.html'), 'https://listing.example/complete'))
  const listing = finalizeListingXrayResult({ inputKind: 'url', listing: normalized }, validateListingXrayModelOutput(makeModelOutputFixture('excellent')))
  assert.equal(listing.content_type, 'PROPERTY_LISTING'); assert.ok(listing.sections.information); assert.equal('campaign' in listing, false)
  const social = finalizeListingXrayResult({ inputKind: 'images', listing: null }, validateListingXrayModelOutput(makeModelOutputFixture('social')))
  assert.equal(social.content_type, 'SOCIAL_PUBLICATION'); assert.ok(social.sections.visual_communication); assert.equal('information' in social.sections, false)
})

test('notas por componentes são normalizadas para 0–100 e mantêm rótulos coerentes', () => {
  const five = { a: 5, b: 5, c: 5, d: 5, e: 5 }
  assert.equal(normalizeComponentScore({ a: 0, b: 0, c: 0, d: 0, e: 0 }, five), 0)
  assert.equal(normalizeComponentScore({ a: 2, b: 3, c: 2, d: 3, e: 2 }, five), 48)
  assert.equal(normalizeComponentScore(five, five), 100)
  assert.equal(normalizeComponentScore({ a: 4, b: 5, c: 5, d: 4, e: 4 }, five), 88)
  assert.equal(labelListingXrayScore(100), 'Excelente'); assert.equal(labelListingXrayScore(88), 'Muito bom')
  assert.equal(labelListingXrayScore(75), 'Bom'); assert.equal(labelListingXrayScore(65), 'Pode melhorar'); assert.equal(labelListingXrayScore(59), 'Precisa de atenção')
})

test('primeiro canário recalcula 88/80/80/80 e nota geral ponderada 82', () => {
  const raw = makeFirstCanaryQualityFixture()
  raw.listing!.title.components = { clarity: 4, correctness: 5, readability: 5, specificity: 4, informativeness: 4 }
  raw.listing!.description.components = { clarity: 4, benefits: 4, correctness: 4, naturalness: 4, useful_coverage: 4 }
  raw.listing!.information.components = { coherence: 4, consistency: 4, completeness: 4 }
  raw.listing!.persuasion.components = { cta: 5, clarity: 4, benefits: 4, differentiators: 3, feature_to_benefit: 4 }
  const result = finalizeListingXrayResult({ inputKind: 'images', listing: null }, validateListingXrayModelOutput(raw))
  assert.deepEqual(Object.fromEntries(Object.entries(result.sections).map(([key, section]) => [key, section.score])), { title: 88, description: 80, information: 80, persuasion: 80 })
  assert.equal(result.overall_score, 82); assert.equal(result.overall_label, 'Muito bom')
})

test('fixture de qualidade separa geografia, tipo, finalidade e descrição parcial', () => {
  const fixture = validateListingXrayModelOutput(makeFirstCanaryQualityFixture())
  const observed = Object.fromEntries(fixture.listing!.observed_fields.map(field => [field.key, field]))
  assert.equal(observed.city.value, 'São Paulo'); assert.notEqual(observed.city.value, 'Lapa')
  assert.equal(observed.district.state, 'AMBIGUOUS'); assert.equal(observed.propertyType.value, 'apartamento'); assert.equal(observed.purpose.value, 'venda')
  assert.equal(fixture.listing!.description_completeness.state, 'PARTIAL')
  assert.ok(fixture.listing!.description.copy_text); assert.ok(fixture.listing!.persuasion.copy_text)
  assert.equal(fixture.priorities.length, 3); assert.ok(fixture.recommendations.length < 8); assert.ok(fixture.recommendations.every(item => item.reason.length >= 20))
})

test('problema acionável exige suggestion e copy_text; item bom não é reescrito', () => {
  const invalid = makeModelOutputFixture('excellent')
  invalid.listing!.title.issue_codes = ['missing_specificity']
  assert.throws(() => validateListingXrayModelOutput(invalid), /invalid_title/)
  const result = finalizeListingXrayResult({ inputKind: 'images', listing: null }, validateListingXrayModelOutput(makeModelOutputFixture('excellent')))
  assert.equal(result.sections.title.score, 100); assert.equal(result.sections.title.suggestion, null); assert.equal(result.sections.title.copy_text, null)
})

test('NOT_FOUND não vira zero e conflito entre capturas permanece AMBIGUOUS', () => {
  const result = finalizeListingXrayResult({ inputKind: 'images', listing: null }, validateListingXrayModelOutput(makeModelOutputFixture('inconsistency')))
  assert.equal(result.fields.parkingSpaces.state, 'AMBIGUOUS'); assert.equal(result.fields.parkingSpaces.value, null); assert.match(result.inconsistencies[0].message, /1 vaga.*2/i)
  assert.equal(result.fields.price.state, 'NOT_FOUND'); assert.equal(result.fields.price.value, null)
})

test('telemetria usa preço fixo de 10 ST e custo OpenAI real separado', () => {
  assert.equal(LISTING_XRAY_SMART_TOKEN_COST, 10)
  const usage = normalizeListingXrayUsage({ input_tokens: 12_000, output_tokens: 4_000, total_tokens: 16_000 })
  assert.equal(usage.estimated_cost_usd, 0.0042)
})

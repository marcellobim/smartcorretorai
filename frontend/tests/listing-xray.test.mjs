import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { LISTING_XRAY_MAX_IMAGES, validateListingXrayFiles } from '../src/lib/listing-xray-images.js'
import { attractionPotentialScoreLabel, clearListingXrayRecovery, listingXrayPublicFieldValue, listingXrayScoreLabel, listingXrayStorageKey, normalizeListingXrayResult, normalizeListingXraySectionScore, readListingXrayRecovery, writeListingXrayRecovery } from '../src/lib/listing-xray-result.js'

const page = readFileSync(new URL('../src/pages/RaioXAnuncio.jsx', import.meta.url), 'utf8')
const resultComponent = readFileSync(new URL('../src/components/listing-xray/ListingXRayResult.jsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/components/layout/Sidebar.jsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../src/pages/LandingPage.jsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8')
const backend = readFileSync(new URL('../../supabase/functions/raio-x-anuncio/runtime.ts', import.meta.url), 'utf8')
const contract = readFileSync(new URL('../../supabase/functions/raio-x-anuncio/contract.ts', import.meta.url), 'utf8')

const listingResult = { status: 'completed', content_type: 'PROPERTY_LISTING', overall_score: 88, overall_label: 'Muito bom', listing_quality_score: 88, attraction_potential_score: 60, summary: 'Resumo', fields: {}, inconsistencies: [], priorities: [], recommendations: [], opportunities: [{ product_id: 'real_estate_video', title: 'Transforme suas fotos', reason: 'Há várias imagens disponíveis.', benefit: 'Amplie a divulgação fora do portal.', evidence: 'Cinco imagens foram fornecidas.', evidence_source: 'listing_metadata', cta_label: 'Criar Vídeo Imobiliário', route: '/smart-tour-ai' }], attraction: { score: 60, analysis: 'A divulgação ainda pode chamar mais atenção.', what_works: 'A ficha é clara.', what_can_improve: 'O alcance ainda é limitado.', how_to_improve: 'Use outros formatos.', suggestion: 'Use outros formatos.', copy_text: 'Conheça este imóvel por um novo olhar.' }, sections: Object.fromEntries(['title', 'description', 'information', 'persuasion'].map(key => [key, { score: 88, analysis: key, what_works: `${key} funciona`, what_can_improve: null, how_to_improve: null, suggestion: null }])) }
const socialResult = { status: 'completed', content_type: 'SOCIAL_PUBLICATION', overall_score: 82, overall_label: 'Muito bom', summary: 'Resumo', priorities: [], recommendations: [], sections: Object.fromEntries(['hook', 'clarity', 'visual_communication', 'cta', 'conversion'].map(key => [key, { score: 82, analysis: key, suggestion: null }])) }
const firstCanaryResult = JSON.parse(readFileSync(new URL('./fixtures/listing-xray-first-canary-result.json', import.meta.url), 'utf8'))
function memoryStorage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } }

test('produto preservado mantém autenticação e fica fora da descoberta com entrada protegida', () => {
  assert.match(app, /path="\/raio-x-anuncio" element=\{<AvailableProductRoute product="raio-x"><AccountAnalyticsRoute[^>]*><RaioXAnuncio \/>/)
  assert.match(app, /OnboardingPrivateRoute><AppLayout/)
  assert.match(sidebar, /to: '\/raio-x-anuncio'[\s\S]*label: 'Raio-X'/)
  assert.match(dashboard, /const homeGroups = visibleProducts\(\[/)
  assert.match(sidebar, /items: visibleProducts\(group.items\)/)
  assert.match(landing, /RAIO_X_AVAILABLE && <ListingXraySpotlight/)
  assert.match(landing, /Experimentar o Raio-X/)
  assert.doesNotMatch(admin, /ListingXraySourceDiagnostic|ListingXrayImageCanary|acquire_only/)
})

test('tela inicial oferece link e imagens sem nomear portais', () => {
  assert.match(page, /Analisar pelo link/); assert.match(page, /Analisar por imagens\/capturas/); assert.match(page, /Cole o link do seu anúncio/); assert.match(page, /Envie capturas do que você quer analisar/)
  assert.match(page, /Esta análise utiliza 10 Smart Tokens/); assert.doesNotMatch(page, /ZAP|Imovelweb|QuintoAndar/)
})

test('somente falha de fonte leva ao caminho de imagens e erro interno usa mensagem correta', () => {
  assert.match(page, /SOURCE_UNAVAILABLE.*SOURCE_LOW_CONFIDENCE/); assert.match(page, /Não conseguimos analisar este anúncio pelo link/); assert.match(page, /Analisar por imagens\/capturas/)
  assert.match(page, /ANALYSIS_PROCESSING_ERROR.*PROVIDER_ERROR.*INVALID_RESULT/); assert.match(page, /Não conseguimos concluir esta análise\. Tente novamente\./)
  assert.match(page, /linkUnavailable.*source_unavailable.*source_low_confidence/); assert.doesNotMatch(page, />403<|Cloudflare|anti-bot/)
})

test('imagens aceitam uma a cinco capturas e recusam formato inseguro', () => {
  assert.equal(LISTING_XRAY_MAX_IMAGES, 5)
  assert.equal(validateListingXrayFiles([{ type: 'image/png', size: 100, name: 'a.png' }]).length, 1)
  assert.throws(() => validateListingXrayFiles(Array.from({ length: 6 }, (_, index) => ({ type: 'image/png', size: 100, name: `${index}.png` }))), /1 a 5/)
  assert.throws(() => validateListingXrayFiles([{ type: 'image/svg+xml', size: 100, name: 'a.svg' }]), /JPG, PNG ou WebP/)
})

test('classificação incerta pede escolha e captura adicional mantém client_request_id', () => {
  assert.match(page, /O que você quer analisar/); assert.match(page, /Anúncio de imóvel/); assert.match(page, /Publicação\/divulgação/)
  assert.match(page, /activeRequestRef\.current \|\| newRequestId\(\)/); assert.match(page, /Continuar análise/)
})

test('resultado final aceita contratos listing e social e rejeita campanha antiga', () => {
  const normalizedListing = normalizeListingXrayResult(listingResult); const normalizedSocial = normalizeListingXrayResult(socialResult)
  assert.equal(normalizedListing.overall_score, 88); assert.equal(normalizedListing.sections.title.label, 'Muito bom'); assert.equal(normalizedListing.description_completeness.state, 'NOT_FOUND')
  assert.equal(normalizedSocial.overall_score, 82); assert.equal(normalizedSocial.sections.hook.label, 'Muito bom')
  assert.equal(normalizedListing.opportunities.length, 1); assert.equal(normalizedListing.opportunities[0].evidence, 'Cinco imagens foram fornecidas.')
  assert.equal(normalizedListing.listing_quality_score, 88); assert.equal(normalizedListing.attraction_potential_score, 60); assert.equal(normalizedListing.attraction_potential_label, 'Há oportunidades'); assert.notEqual(normalizedListing.listing_quality_score, normalizedListing.attraction_potential_score)
  assert.throws(() => normalizeListingXrayResult({ ...listingResult, campaign: {} }), /listing_xray_result_invalid/)
  assert.match(resultComponent, /Mensagem \/ Gancho/); assert.match(resultComponent, /Comunicação visual/); assert.match(resultComponent, /Poder de convencimento/)
  assert.doesNotMatch(resultComponent, /Sua campanha de divulgação está pronta|Google Ads|Roteiro para Reels|Hashtags/)
})

test('recovery do primeiro canário corrige escala sem inventar conteúdo ausente', () => {
  const normalized = normalizeListingXrayResult(firstCanaryResult)
  assert.deepEqual(Object.fromEntries(Object.entries(normalized.sections).map(([key, section]) => [key, section.score])), { title: 88, description: 80, information: 80, persuasion: 80 })
  assert.equal(normalized.overall_score, 82); assert.equal(normalized.overall_label, 'Muito bom')
  assert.equal(normalized.description_completeness.state, 'PARTIAL')
  assert.deepEqual(normalized.recommendations, []); assert.deepEqual(normalized.priorities, [])
  assert.equal(normalizeListingXraySectionScore({ score: 0, components: { a: 0, b: 0 } }).score, 0)
  assert.equal(normalizeListingXraySectionScore({ score: 10, components: { a: 5, b: 5 } }).score, 100)
  assert.equal(listingXrayScoreLabel(70), 'Bom')
  assert.equal(attractionPotentialScoreLabel(60), 'Há oportunidades')
})

test('melhorias são copiáveis, prioridades limitadas e produtos apenas navegam', () => {
  assert.match(resultComponent, /Copiar/); assert.match(resultComponent, /slice\(0, 3\)/)
  for (const route of ['/virtual-staging', '/smart-tour-ai', '/nova-campanha', '/hero']) assert.match(resultComponent + readFileSync(new URL('../src/lib/listing-xray-result.js', import.meta.url), 'utf8'), new RegExp(route.replace('/', '\\/')))
  assert.doesNotMatch(resultComponent, /localStorage|sessionStorage|state=|prefill|navigate\([^)]*,/i)
})

test('entrega imobiliária separa correção de expansão e mantém evidência apenas no contrato', () => {
  for (const text of ['Qualidade do anúncio', 'Potencial de atração', 'Melhore seu anúncio', 'O que está bom', 'O que pode melhorar', 'Como melhorar', 'Sugestão pronta', 'Como fazer este imóvel chamar mais atenção', 'Seu anúncio é só o começo', 'Amplie sua divulgação']) assert.match(resultComponent, new RegExp(text))
  assert.match(resultComponent, /item\.cta_label/); assert.match(resultComponent, /item\.route/); assert.match(resultComponent, /slice\(0, 5\)/)
  assert.doesNotMatch(resultComponent, /Evidência:|\{item\.evidence\}/)
  const normalized = normalizeListingXrayResult(listingResult); assert.ok(normalized.opportunities[0].evidence); assert.ok(normalized.opportunities[0].evidence_source)
})

test('ficha pública traduz enums técnicos sem alterar valores livres', () => {
  assert.equal(listingXrayPublicFieldValue('purpose', 'rent'), 'Aluguel')
  assert.equal(listingXrayPublicFieldValue('purpose', 'sale'), 'Venda')
  assert.equal(listingXrayPublicFieldValue('propertyType', 'apartment'), 'Apartamento')
  assert.equal(listingXrayPublicFieldValue('city', 'São Paulo'), 'São Paulo')
  assert.match(resultComponent, /listingXrayPublicFieldValue/)
})

test('experiência pública não exibe termos técnicos internos', () => {
  for (const term of ['client_request_id', 'request_id', 'recovery', 'provider', 'confidence', 'SOURCE_UNAVAILABLE', 'reservation']) assert.doesNotMatch(resultComponent, new RegExp(term, 'i'))
})

test('descrição parcial e recomendação explicada aparecem sem campanha automática', () => {
  assert.match(resultComponent, /Descrição parcialmente visível/); assert.match(resultComponent, /Conhecer \{item\.target\[0\]\}/)
  assert.doesNotMatch(resultComponent, /Gerar campanha|Criar Google Ads|pacote Instagram/i)
})

test('recovery é user-scoped e não cria nova análise', () => {
  const storage = memoryStorage(); const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; assert.equal(writeListingXrayRecovery(storage, 'user-a', id, 'processing'), true); assert.equal(readListingXrayRecovery(storage, 'user-a').clientRequestId, id); assert.equal(readListingXrayRecovery(storage, 'user-b'), null); assert.notEqual(listingXrayStorageKey('user-a'), listingXrayStorageKey('user-b')); clearListingXrayRecovery(storage, 'user-a'); assert.equal(readListingXrayRecovery(storage, 'user-a'), null)
  assert.match(page, /action: 'recover'/); assert.match(backend, /if \(parsed\.action === 'recover'\)/)
})

test('campanha automática foi removida de schema, prompt, frontend e recovery shape', () => {
  for (const source of [page, resultComponent, contract]) assert.doesNotMatch(source, /portal_description|reels_script|google_ads|carousel.*slides/i)
  assert.match(contract, /Campanha de Textos pode aparecer apenas como recomendação/)
})

test('frontend usa Edge própria e não acessa provider/economia diretamente', () => {
  assert.match(page, /functions\.invoke\('raio-x-anuncio'/); assert.match(page, /action: 'analyze_url'/); assert.match(page, /action: 'analyze_images'/)
  assert.doesNotMatch(page, /openai|reserve_credits|consume_reserved|credit_transactions/i)
})

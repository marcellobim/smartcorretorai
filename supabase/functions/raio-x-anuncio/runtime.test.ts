import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { classifyListingXrayFailure, handleListingXray, type ListingXrayRuntimeDependencies } from './runtime.ts'
import { ListingXrayValidationError } from './contract.ts'
import { ListingXrayFetchError } from './secure-fetch.ts'
import { makeModelOutputFixture } from './fixtures/model-output-fixtures.ts'

const USER_A = '11111111-1111-4111-8111-111111111111'; const USER_B = '22222222-2222-4222-8222-222222222222'; const REQUEST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const request = (body: unknown, token = 'valid-a') => new Request('https://edge.example/raio-x-anuncio', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const html = async (name: string) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
const image = { data_url: `data:image/png;base64,${btoa('safe-image')}` }
const stored = (overrides = {}) => ({ id: 'request-id', status: 'processing', claimed: true, rateLimited: false, claimToken: 'claim-token', reservationId: 'reservation-id', result: null, continuation: null, errorCode: null, expiresAt: new Date(Date.now() + 60_000).toISOString(), reservedTokens: 10, consumedTokens: 0, refundedTokens: 0, ...overrides })
const usage = { input_tokens: 1000, output_tokens: 1000, total_tokens: 2000, estimated_cost_usd: 0.00075 }
const dependencies = (overrides = {}): ListingXrayRuntimeDependencies => ({
  authenticate: async token => ['valid-a', 'valid-aal1'].includes(token) ? { id: USER_A } : token === 'valid-b' ? { id: USER_B } : null,
  authorizeAcquireOnly: async ({ userId, token }) => userId === USER_A && token === 'valid-a', cleanup: async () => {},
  claim: async () => stored(), complete: async input => stored({ status: 'completed', claimed: false, claimToken: null, result: input.result, consumedTokens: 10 }),
  awaitInput: async input => stored({ status: 'awaiting_input', claimed: false, continuation: input.continuation, errorCode: input.errorCode }),
  finish: async input => stored({ status: input.status, claimed: false, claimToken: null, errorCode: input.errorCode, refundedTokens: 10 }), get: async () => null,
  fetchHtml: async url => ({ html: '', finalUrl: url, sourceDomain: 'listing.example', redirects: 0, bytes: 1, contentType: 'text/html', status: 200, durationMs: 1 }),
  generate: async input => ({ output: makeModelOutputFixture(input.contentTypeHint === 'SOCIAL_PUBLICATION' ? 'social' : 'excellent'), usage, model: 'gpt-4o-mini' }), ...overrides,
})

test('acquire_only permanece admin+AAL2 e não toca economia/provider', async () => {
  let effects = 0
  const deps = dependencies({ claim: async () => { effects += 1; throw new Error('unexpected') }, generate: async () => { effects += 1; throw new Error('unexpected') } })
  assert.equal((await handleListingXray(request({ action: 'acquire_only', url: 'https://listing.example/a' }, 'valid-b'), deps)).status, 403)
  assert.equal(effects, 0)
})

test('link válido reserva uma vez, entrega e liquida exatamente 10 ST', async () => {
  const source = await html('jsonld-complete.html'); const calls = { claim: 0, provider: 0, complete: 0, finish: 0 }
  const deps = dependencies({
    fetchHtml: async url => ({ html: source, finalUrl: url, sourceDomain: 'listing.example', redirects: 0, bytes: source.length, contentType: 'text/html', status: 200, durationMs: 1 }),
    claim: async input => { calls.claim += 1; assert.equal(input.inputKind, 'url'); return stored() },
    generate: async () => { calls.provider += 1; return { output: makeModelOutputFixture('excellent'), usage, model: 'gpt-4o-mini' } },
    complete: async input => { calls.complete += 1; assert.equal(input.model, 'gpt-4o-mini'); return stored({ status: 'completed', result: input.result, consumedTokens: 10 }) },
    finish: async input => { calls.finish += 1; return stored({ status: input.status }) },
  })
  const response = await handleListingXray(request({ action: 'analyze_url', client_request_id: REQUEST, url: 'https://listing.example/a' }), deps); const body = await response.json()
  assert.equal(response.status, 200); assert.equal(body.economy.consumed, 10); assert.deepEqual(calls, { claim: 1, provider: 1, complete: 1, finish: 0 })
})

test('link 403 libera integralmente e não chama OpenAI', async () => {
  let providers = 0; let terminal = null
  const deps = dependencies({ fetchHtml: async () => { throw new ListingXrayFetchError('upstream_http_403') }, generate: async () => { providers += 1; throw new Error('unexpected') }, finish: async input => { terminal = input; return stored({ status: input.status, refundedTokens: 10 }) } })
  const response = await handleListingXray(request({ action: 'analyze_url', client_request_id: REQUEST, url: 'https://listing.example/a' }), deps)
  const body = await response.json(); assert.equal(response.status, 422); assert.equal(body.code, 'SOURCE_UNAVAILABLE'); assert.equal(body.error, 'Não conseguimos analisar este anúncio pelo link.'); assert.equal(providers, 0); assert.equal(terminal.status, 'insufficient')
})

test('confidence gate baixo usa categoria própria, libera reserva e não chama provider', async () => {
  let providers = 0; let terminal = null
  const deps = dependencies({
    normalize: extraction => ({
      schemaVersion: 'listing_xray.v5', sourceUrl: extraction.sourceUrl, sourceDomain: extraction.sourceDomain, adapter: extraction.adapter, fetchedAt: new Date().toISOString(),
      fields: Object.fromEntries(['purpose', 'propertyType', 'title', 'description', 'price', 'condominiumFee', 'propertyTax', 'area', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces', 'state', 'city', 'district', 'address', 'highlights', 'amenities', 'developmentName', 'builder', 'stage'].map(key => [key, { state: 'NOT_FOUND', value: null, confidence: 0, candidates: [] }])) as never,
      detectedImageCount: { state: 'NOT_FOUND', value: null, confidence: 0, candidates: [] }, videoDetected: { state: 'NOT_FOUND', value: null, confidence: 0, candidates: [] },
      extractedText: { title: null, description: null, evidenceSnippets: [] }, extractionConfidence: { score: 0, gate: 'FAIL', reasons: ['low_extraction_confidence'], confirmedObjectiveFields: 0, categories: [] }, inconsistencies: [], confirmedFacts: {},
    }),
    generate: async () => { providers += 1; throw new Error('unexpected') },
    finish: async input => { terminal = input; return stored({ status: input.status, refundedTokens: 10, errorCode: input.errorCode }) },
  })
  const response = await handleListingXray(request({ action: 'analyze_url', client_request_id: REQUEST, url: 'https://listing.example/a' }), deps); const body = await response.json()
  assert.equal(body.code, 'SOURCE_LOW_CONFIDENCE'); assert.equal(providers, 0); assert.match(terminal.errorCode, /^source_low_confidence:/)
})

test('uma ou cinco imagens usam o mesmo preço e podem entregar listing/social', async () => {
  for (const [count, hint, expected] of [[1, null, 'PROPERTY_LISTING'], [5, 'SOCIAL_PUBLICATION', 'SOCIAL_PUBLICATION']] as const) {
    let claimedCount = 0
    const deps = dependencies({ claim: async input => { claimedCount = input.imageCount; return stored() } })
    const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: Array(count).fill(image), content_type_hint: hint }), deps); const body = await response.json()
    assert.equal(response.status, 200); assert.equal(body.result.content_type, expected); assert.equal(body.economy.consumed, 10); assert.equal(claimedCount, count)
  }
})

test('imagem insuficiente pede captura adicional sem segunda reserva ou settlement', async () => {
  let awaited = 0; let completed = 0; let finished = 0
  const deps = dependencies({ generate: async () => ({ output: makeModelOutputFixture('needs_more'), usage, model: 'gpt-4o-mini' }), awaitInput: async input => { awaited += 1; return stored({ status: 'awaiting_input', continuation: input.continuation, errorCode: input.errorCode }) }, complete: async input => { completed += 1; return stored({ status: 'completed', result: input.result }) }, finish: async input => { finished += 1; return stored({ status: input.status }) } })
  const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image], content_type_hint: null }), deps); const body = await response.json()
  assert.equal(response.status, 200); assert.equal(body.status, 'awaiting_input'); assert.equal(body.economy.reserved, 10); assert.deepEqual({ awaited, completed, finished }, { awaited: 1, completed: 0, finished: 0 })
})

test('classificação incerta pede escolha explícita, sem adivinhar', async () => {
  const deps = dependencies({ generate: async () => ({ output: makeModelOutputFixture('unsure'), usage, model: 'gpt-4o-mini' }) })
  const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image], content_type_hint: null }), deps); const body = await response.json()
  assert.equal(body.status, 'awaiting_input'); assert.equal(body.code, 'CLASSIFICATION_REQUIRED'); assert.equal(body.continuation.classification_required, true)
})

test('máximo de imagens ainda insuficiente libera 10 ST e não entrega nota', async () => {
  let terminal = null
  const deps = dependencies({ generate: async () => ({ output: makeModelOutputFixture('needs_more'), usage, model: 'gpt-4o-mini' }), finish: async input => { terminal = input; return stored({ status: input.status, refundedTokens: 10 }) } })
  const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: Array(5).fill(image), content_type_hint: null }), deps)
  assert.equal(response.status, 422); assert.equal(terminal.errorCode, 'insufficient_images')
})

test('provider/schema failure libera reserva e recovery/completed não cobram novamente', async () => {
  let finished = 0
  const failure = dependencies({ generate: async () => { throw new Error('openai_http_500') }, finish: async input => { finished += 1; return stored({ status: input.status, refundedTokens: 10 }) } })
  assert.equal((await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image] }), failure)).status, 502); assert.equal(finished, 1)
  let effects = 0; const result = { status: 'completed', content_type: 'PROPERTY_LISTING', sections: {}, priorities: [], recommendations: [] }
  const recovered = dependencies({ claim: async () => stored({ status: 'completed', claimed: false, result, consumedTokens: 10 }), get: async () => stored({ status: 'completed', claimed: false, result, consumedTokens: 10 }), generate: async () => { effects += 1; throw new Error('unexpected') } })
  assert.equal((await handleListingXray(request({ action: 'analyze_url', client_request_id: REQUEST, url: 'https://listing.example/a' }), recovered)).status, 200)
  assert.equal((await handleListingXray(request({ action: 'recover', client_request_id: REQUEST }), recovered)).status, 200); assert.equal(effects, 0)
})

test('resultado inválido e erro de provider recebem mensagens internas corretas sem fallback de fonte', async () => {
  for (const [failure, category] of [[new ListingXrayValidationError('invalid_observed_field'), 'INVALID_RESULT'], [new Error('openai_http_500'), 'PROVIDER_ERROR']] as const) {
    let terminal = null
    const deps = dependencies({ generate: async () => { throw failure }, finish: async input => { terminal = input; return stored({ status: input.status, refundedTokens: 10, errorCode: input.errorCode }) } })
    const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image] }), deps); const body = await response.json()
    assert.equal(body.code, category); assert.equal(body.error, 'Não conseguimos concluir esta análise. Tente novamente.'); assert.match(terminal.errorCode, new RegExp(`^${category.toLowerCase()}:`))
  }
  assert.equal(classifyListingXrayFailure(new Error('unexpected')).category, 'ANALYSIS_PROCESSING_ERROR')
})

test('usage já recebido é preservado quando o contrato final é inválido', async () => {
  let terminal = null
  const raw = makeModelOutputFixture('excellent') as unknown as Record<string, unknown>; (raw.listing as Record<string, unknown>).observed_fields = 'invalid'
  const deps = dependencies({ generate: async () => ({ output: raw, usage, model: 'gpt-4o-mini' }), finish: async input => { terminal = input; return stored({ status: input.status, refundedTokens: 10, errorCode: input.errorCode }) } })
  const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image] }), deps); const body = await response.json()
  assert.equal(body.code, 'INVALID_RESULT'); assert.deepEqual(terminal.usage, usage)
})

test('imagem inválida e sessão inválida bloqueiam antes de claim/provider', async () => {
  let effects = 0; const deps = dependencies({ claim: async () => { effects += 1; return stored() }, generate: async () => { effects += 1; throw new Error('unexpected') } })
  assert.equal((await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [{ data_url: 'data:image/svg+xml;base64,PHN2Zz4=' }] }), deps)).status, 400)
  assert.equal((await handleListingXray(request({ action: 'analyze_url', client_request_id: REQUEST, url: 'https://listing.example/a' }, 'invalid'), deps)).status, 401); assert.equal(effects, 0)
})

test('saldo insuficiente bloqueia antes da OpenAI e não cria efeito posterior', async () => {
  let providers = 0
  const deps = dependencies({
    claim: async () => { throw new Error('insufficient_credit_balance') },
    generate: async () => { providers += 1; throw new Error('unexpected') },
  })
  const response = await handleListingXray(request({ action: 'analyze_images', client_request_id: REQUEST, images: [image] }), deps)
  const body = await response.json()
  assert.equal(response.status, 402)
  assert.equal(body.code, 'INSUFFICIENT_SMART_TOKENS')
  assert.equal(providers, 0)
})

test('recovery deriva owner da sessão e rejeita user_id no payload', async () => {
  const calls: string[] = []; const deps = dependencies({ get: async input => { calls.push(input.userId); return input.userId === USER_A ? stored({ status: 'completed', result: { status: 'completed' }, consumedTokens: 10 }) : null } })
  assert.equal((await handleListingXray(request({ action: 'recover', client_request_id: REQUEST }, 'valid-a'), deps)).status, 200)
  assert.equal((await handleListingXray(request({ action: 'recover', client_request_id: REQUEST }, 'valid-b'), deps)).status, 404)
  assert.equal((await handleListingXray(request({ action: 'recover', client_request_id: REQUEST, user_id: USER_A }, 'valid-b'), deps)).status, 400); assert.deepEqual(calls, [USER_A, USER_B])
})

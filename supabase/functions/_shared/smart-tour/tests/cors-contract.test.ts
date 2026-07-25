import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { corsHeaders, jsonResponse, withCors } from '../../cors.ts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const read = (relativePath: string) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const generateSource = read('supabase/functions/smart-tour-generate/index.ts')
const statusSource = read('supabase/functions/smart-tour-status/index.ts')
const frontendSource = read('frontend/src/pages/SmartTourAI.jsx')

const request = (method = 'POST', origin = 'http://localhost:5173') => new Request('http://local.test/functions/v1/smart-tour', {
  method,
  headers: {
    Origin: origin,
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
    apikey: 'test-key',
    'x-client-info': 'supabase-js-test',
  },
  body: method === 'POST' ? '{}' : undefined,
})

const assertCors = (response: Response) => {
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
  const allowedHeaders = response.headers.get('Access-Control-Allow-Headers')?.toLocaleLowerCase('en-US') || ''
  for (const header of ['authorization', 'content-type', 'apikey', 'x-client-info']) assert.match(allowedHeaders, new RegExp(header))
}

test('OPTIONS from smart-tour-generate returns the shared CORS contract immediately', async () => {
  let called = false
  const handler = withCors(() => { called = true; return jsonResponse({ ok: true }) })
  const response = await handler(request('OPTIONS'))
  assert.equal(response.status, 200)
  assert.equal(called, false)
  assertCors(response)
  assert.match(generateSource, /serve\(withCors\(async req =>/)
})

test('successful POST from smart-tour-generate returns CORS', async () => {
  const response = await withCors(() => jsonResponse({ ok: true, jobId: 'job-id' }))(request())
  assert.equal(response.status, 200)
  assertCors(response)
})

test('authentication errors from smart-tour-generate return CORS', async () => {
  const response = await withCors(() => jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401))(request())
  assert.equal(response.status, 401)
  assertCors(response)
  assert.match(generateSource, /if \(!user\) return json\(\{ok:false,error:'Sua sessão expirou\.'\},401\)/)
})

test('validation errors from smart-tour-generate return CORS', async () => {
  const response = await withCors(() => jsonResponse({ ok: false, error: 'Envie de 1 a 5 imagens válidas.' }, 400))(request())
  assert.equal(response.status, 400)
  assertCors(response)
  assert.match(generateSource, /validateSmartTourRequest\(await req\.json\(\)\)/)
  assert.match(generateSource, /invalid_image_count:'Envie de 1 a 5 imagens válidas\.'/)
})

test('smart-tour-status returns CORS for every response and unexpected error path', async () => {
  assert.match(statusSource, /serve\(withCors\(async req\s*=>/)
  for (const status of [200, 400, 401, 404, 502]) {
    const response = await withCors(() => jsonResponse({ ok: status === 200 }, status))(request())
    assert.equal(response.status, status)
    assertCors(response)
  }
  const unexpected = await withCors(() => { throw new Error('private detail') })(request())
  assert.equal(unexpected.status, 500)
  assertCors(unexpected)
  assert.doesNotMatch(await unexpected.text(), /private detail/)
})

test('localhost:5173 is accepted by the homologated wildcard policy', async () => {
  const response = await withCors(() => jsonResponse({ ok: true }))(request('POST', 'http://localhost:5173'))
  assertCors(response)
  assert.equal(corsHeaders['Access-Control-Allow-Origin'], '*')
})

test('other product Edge Functions retain their approved CORS and generation markers', () => {
  const smartCarousel = read('supabase/functions/smart-carousel-creatomate/index.ts')
  const hero = read('supabase/functions/gerar-hero-ia/index.ts')
  assert.match(smartCarousel, /smart-carousel/)
  assert.match(smartCarousel, /CREATOMATE_API_KEY/)
  assert.match(hero, /Access-Control-Allow-Origin/)
  assert.match(hero, /OPENAI_API_KEY/)
  assert.match(hero, /SMARTCORRETORAI_MASTER_PROPERTY_V1/)
})

test('Smart Tour frontend payload keeps its contract and suppresses phone without CTA', () => {
  assert.match(frontendSource, /body: \{ clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: apiGeneration, selectedCta, includeProfessionalPhone: ctaEnabled === true && includePhone === true, language: 'pt-BR' \}/)
})

test('Gemini Omni model and protected professional phone contracts remain connected', () => {
  assert.match(generateSource, /prepareGeminiImages, SMART_TOUR_GEMINI_OMNI_MODEL, startGeminiOmniVideo/)
  assert.match(generateSource, /orchestrateSmartTour/)
  assert.match(generateSource, /buildSmartTourOrchestrationInput, buildSmartTourPrompt, buildSmartTourVideoPrompt, resolveSmartTourProfessionalPhone, validateSmartTourRequest/)
  assert.match(generateSource, /mode:'smart_tour_gemini_omni'/)
  assert.match(statusSource, /checkGeminiOmniVideo/)
})

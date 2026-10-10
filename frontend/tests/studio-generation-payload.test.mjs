import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

async function loadStudio() {
  const vite = await import('vite')
  const server = await vite.createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try { return await server.ssrLoadModule('/src/pages/StudioHero.jsx') } finally { await server.close() }
}

const baseAnswers = {
  objective: 'sale', oferta: 'FOR SALE', propertyType: 'APARTMENT', profile: 'LUXURY', stage: 'ready', houseLocationType: '',
  state: 'FL', county: 'Hillsborough County', city: 'Tampa', zipCode: '', neighborhoodCommunity: '',
  bedrooms: '3', bathrooms: '2', suites: '1', parking: '2', area: '', differentials: ['waterfront'],
  brokerHasBenefits: '', brokerCommission: '', brokerBenefits: [], brokerBenefitOther: '', cta: 'LEARN MORE',
  creativeMode: 'cinematic', furnishingStatus: '', decorationPolicy: '', visualStyle: 'modern', atmosphere: 'warm', pace: 'dynamic', creativeFreedom: 'guided',
  professionalIdentity: { enabled: true, name_source: 'display' },
}

function buildInput(overrides = {}) {
  const answers = { ...baseAnswers, ...(overrides.answers || {}) }
  answers.differentials = overrides.answers?.differentials || baseAnswers.differentials
  answers.rentConditions = overrides.answers?.rentConditions || []
  answers.brokerBenefits = overrides.answers?.brokerBenefits || baseAnswers.brokerBenefits
  const { answers: ignoredAnswers, ...rest } = overrides
  return {
    answers, language: 'en-US', market: 'US', isFreeAiMode: false,
    usLocation: 'Tampa, Hillsborough County, FL', normalizedLocation: '', displayLocation: '', cityValue: '', districtValue: '',
    finalFeatures: 'waterfront', professionalIdentity: { formatted: 'Jane Homes · License FL-1234 · FL' }, draftId: '11111111-1111-4111-8111-111111111111', inputImage1Path: 'safe/path.jpg',
    ...rest,
  }
}

test('the real Studio payload builder and dispatch boundary keep US cinematic geography, optional fields and identity exact', async () => {
  const { buildStudioGenerationPayload, dispatchStudioGeneration } = await loadStudio()
  const payload = buildStudioGenerationPayload(buildInput())
  const calls = []
  await dispatchStudioGeneration(async (name, body) => { calls.push({ name, body }); return { ok: true, body: {} } }, payload)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'criar-video-ia')
  assert.equal(payload.market, 'US')
  assert.equal(payload.language, 'en-US')
  assert.equal(payload.mode, 'cinematic')
  assert.deepEqual(payload.briefing.professional_identity, { enabled: true, name_source: 'display' })
  assert.deepEqual({ state: payload.briefing.state, county: payload.briefing.county, city: payload.briefing.city }, { state: 'FL', county: 'Hillsborough County', city: 'Tampa' })
  assert.equal('zipCode' in payload.briefing, false)
  assert.equal('neighborhoodCommunity' in payload.briefing, false)
  for (const forbidden of ['uf', 'cep', 'ibge', 'suites']) assert.equal(forbidden in payload.briefing, false, `${forbidden} must not leak into US payload`)
  assert.doesNotMatch(JSON.stringify(payload), /MCMV|R\$|m²|suítes|studio\./i)
})

test('the same real handler builder preserves optional US values and supports free_ai without creating a remote job', async () => {
  const { buildStudioGenerationPayload, dispatchStudioGeneration } = await loadStudio()
  const payload = buildStudioGenerationPayload(buildInput({
    isFreeAiMode: true,
    answers: { zipCode: '33602', neighborhoodCommunity: 'Downtown', professionalIdentity: { enabled: false, name_source: null } },
  }))
  let received
  await dispatchStudioGeneration(async (_name, body) => { received = body; return { ok: true, body: {} } }, payload)
  assert.equal(received.mode, 'free_ai')
  assert.equal(received.briefing.zipCode, '33602')
  assert.equal(received.briefing.neighborhoodCommunity, 'Downtown')
  assert.deepEqual(received.briefing.professional_identity, { enabled: false })
  assert.equal('inputImage1Path' in received, false)
})

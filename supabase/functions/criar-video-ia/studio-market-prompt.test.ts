import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildStudioMarketPrompt } from './studio-market-prompt.ts'

const edgeSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

const usBriefing = {
  objective: 'sale', objectiveLabel: 'For Sale', propertyType: 'Apartment', profile: 'High-end',
  state: 'FL', county: 'Hillsborough County', city: 'Tampa', zipCode: '33602', neighborhoodCommunity: 'Downtown',
  bedrooms: '3', bathrooms: '2', parking: '2', sqft: '1400', finalFeatures: 'waterfront view', differentials: ['balcony'], cta: 'Learn more',
}

for (const mode of ['cinematic', 'free_ai'] as const) {
  test(`${mode} US provider prompt starts in English and keeps only US facts`, () => {
    const prompt = buildStudioMarketPrompt({ language: 'en-US', mode, briefing: usBriefing, professionalIdentity: 'Jane Homes · License FL-1234 · FL' })
    assert.match(prompt, /AMERICAN ENGLISH REAL ESTATE VIDEO/)
    assert.match(prompt, /Tampa, Hillsborough County, FL, 33602/)
    assert.match(prompt, /2 bathrooms/)
    assert.match(prompt, /1400 sqft/)
    assert.match(prompt, /License FL-1234/)
    assert.doesNotMatch(prompt, /\buf\b|suites|R\$|m²|CEP|MCMV|CRECI|studio\.|[À-ÿ]/i)
  })
  test(`${mode} US provider prompt omits identity entirely when disabled`, () => {
    const prompt = buildStudioMarketPrompt({ language: 'en-US', mode, briefing: { ...usBriefing, zipCode: '', neighborhoodCommunity: '' } })
    assert.match(prompt, /Do not include professional identification/)
    assert.doesNotMatch(prompt, /Jane|License/)
    assert.doesNotMatch(prompt, /33602|Downtown/)
  })
}

test('BR keeps its existing branch untouched by the US prompt base', () => {
  assert.equal(buildStudioMarketPrompt({ language: 'pt-BR', mode: 'cinematic', briefing: { city: 'São Paulo' } }), '')
})

test('the real Edge Function replaces, rather than post-translates, the US provider prompt before Veo', () => {
  assert.match(edgeSource, /import \{ buildStudioMarketPrompt \} from '\.\/studio-market-prompt\.ts'/)
  assert.match(edgeSource, /if \(briefing\.language === 'en-US'\) \{[\s\S]*promptFinal = usProviderPrompt/)
  assert.match(edgeSource, /mode: isFreeAiRequest \? 'free_ai' : 'cinematic'/)
  assert.match(edgeSource, /professionalIdentity,/)
})

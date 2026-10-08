import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHeroNextUSSinglePiecePrompt } from './hero-next-prompt.ts'

const choices = {
  market: 'US',
  cta: 'Schedule a showing',
  highlights: ['Natural light'],
  primary_destination: { id: 'story_reels', label: 'Reels/TikTok/Stories vertical' },
  format_generation: { index: 2, total: 2, format_id: 'story_reels' },
  format_strategy: { compositionInstruction: 'Fast, high-contrast vertical composition.' },
  value_condition: { details: 'Price: $850,000 USD' },
  inline_images: [],
}

test('US provider-boundary prompt remains English after the frontend prompt is supplied', () => {
  const prompt = buildHeroNextUSSinglePiecePrompt([
    'Create one professional real estate campaign.',
    'Property facts: 3 bedrooms, 2 bathrooms, 2 parking spaces, 1,850 sqft.',
    'Price: USD $850,000.',
    'OUTPUT LANGUAGE REQUIREMENT: All generated text must be natural US English only.',
  ].join('\n'), choices, {})

  assert.match(prompt, /US ENGLISH DELIVERY RULES/)
  assert.match(prompt, /Schedule a showing/)
  assert.match(prompt, /USD, square feet, bedrooms, bathrooms, and parking spaces/)
  assert.match(prompt, /Price: USD \$850,000/)
  assert.match(prompt, /1,850 sqft/)
  assert.doesNotMatch(prompt, /Locação|Fale comigo|dormitórios|suítes|vagas|m²|R\$/i)
})

test('technical identifiers and supplied free text remain literal at the provider boundary', () => {
  const prompt = buildHeroNextUSSinglePiecePrompt('Custom agent phrase: Ocean-view collection.', {
    ...choices,
    primary_destination: { id: 'instagram_feed', label: 'Instagram/Facebook square feed' },
    format_generation: { index: 1, total: 2, format_id: 'instagram_feed' },
    cta: 'Learn more',
  }, {})
  assert.match(prompt, /Ocean-view collection/)
  assert.match(prompt, /Instagram\/Facebook square feed/)
})

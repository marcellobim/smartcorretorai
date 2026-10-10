export type StudioMarketPromptInput = {
  language: string
  mode: 'cinematic' | 'free_ai'
  briefing: {
    objective?: string
    objectiveLabel?: string
    propertyType?: string
    profile?: string
    state?: string
    county?: string
    city?: string
    zipCode?: string
    neighborhoodCommunity?: string
    bedrooms?: string
    bathrooms?: string
    parking?: string
    sqft?: string
    finalFeatures?: string
    differentials?: string[]
    cta?: string
  }
  professionalIdentity?: string
}

const compact = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ')
const facts = (values: unknown[]) => values.map(compact).filter(Boolean)

// This is the provider-facing base for the US market. It intentionally begins in
// English instead of translating a Brazilian prompt after the fact.
export function buildStudioMarketPrompt(input: StudioMarketPromptInput) {
  if (input.language !== 'en-US') return ''
  const { briefing } = input
  const location = facts([briefing.neighborhoodCommunity, briefing.city, briefing.county, briefing.state, briefing.zipCode]).join(', ')
  const propertyFacts = facts([
    briefing.bedrooms && `${briefing.bedrooms} bedrooms`,
    briefing.bathrooms && `${briefing.bathrooms} bathrooms`,
    briefing.parking && `${briefing.parking} parking spaces`,
    briefing.sqft && `${briefing.sqft} sqft`,
    ...(briefing.differentials || []),
    briefing.finalFeatures,
  ])
  const imageRule = input.mode === 'cinematic'
    ? 'Use the uploaded property image as the architectural reference. Preserve the shown architecture, layout, materials, proportions, and visible facts.'
    : 'Create the scene only from the confirmed facts below. Do not imply that an uploaded image exists.'
  const identityRule = compact(input.professionalIdentity)
    ? `Use this professional identification exactly once in the final closing or CTA visual: ${compact(input.professionalIdentity)}. Do not narrate, repeat, infer, or add professional data.`
    : 'Do not include professional identification, contact details, license data, or profile data.'

  return [
    'AMERICAN ENGLISH REAL ESTATE VIDEO — PROVIDER BRIEF',
    'Generate all controlled narration and visible text in natural American English.',
    'Use only the confirmed facts below. Do not invent amenities, condition, quality, size, exclusivity, nearby places, neighborhood reputation, lifestyle benefits, potential, or commercial claims.',
    imageRule,
    `Objective: ${compact(briefing.objectiveLabel || briefing.objective)}`,
    `Property type: ${compact(briefing.propertyType)}`,
    `Profile: ${compact(briefing.profile)}`,
    `Location: ${location}`,
    `Confirmed property facts: ${propertyFacts.join('; ')}`,
    `Final CTA: ${compact(briefing.cta)}`,
    identityRule,
    'Do not use Brazilian market terms, Brazilian currency, Brazilian units, Brazilian licensing, or untranslated internal identifiers.',
  ].filter(Boolean).join('\n')
}

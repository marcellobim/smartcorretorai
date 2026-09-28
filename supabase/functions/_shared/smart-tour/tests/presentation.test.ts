import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPropertyContext,
  buildSmartTourStructuredBriefing,
  generateSmartTourDynamicNarration,
  presentSmartTourHighlight,
  presentSmartTourPropertyType,
} from '../index.ts'
import { buildSmartTourPublicationOptions } from '../publication-options.ts'

const propertyTypes = {
  us_single_family_home: 'Single-Family Home',
  us_condo: 'Condo',
  us_townhouse: 'Townhouse',
  us_multi_family: 'Multi-Family Home',
  us_apartment: 'Apartment',
  us_studio: 'Studio',
  us_land_lot: 'Land / Lot',
  us_commercial: 'Commercial Property',
}

const highlights = {
  us_near_downtown: 'Near Downtown', us_near_schools: 'Near Schools', us_near_parks: 'Near Parks', us_near_shopping: 'Near Shopping', us_easy_highway_access: 'Easy Highway Access', us_quiet_street: 'Quiet Street',
  us_community_pool: 'Community Pool', us_fitness_center: 'Fitness Center', us_clubhouse: 'Clubhouse', us_gated_community: 'Gated Community',
  us_updated: 'Updated', us_new_construction: 'New Construction', us_move_in_ready: 'Move-In Ready', us_open_floor_plan: 'Open Floor Plan', us_home_office: 'Home Office', us_walk_in_closet: 'Walk-In Closet', us_gourmet_kitchen: 'Gourmet Kitchen', us_covered_patio: 'Covered Patio', us_fenced_yard: 'Fenced Yard', us_high_ceilings: 'High Ceilings', us_natural_light: 'Natural Light', us_fireplace: 'Fireplace',
  us_garage: 'Garage', us_covered_parking: 'Covered Parking', us_assigned_parking: 'Assigned Parking',
  us_solar_panels: 'Solar Panels', us_energy_efficient: 'Energy Efficient', us_smart_home_features: 'Smart Home Features',
  us_high_visibility: 'High Visibility', us_storefront: 'Storefront', us_ready_to_occupy: 'Ready to Occupy', us_customer_parking: 'Customer Parking', us_loading_access: 'Loading Access',
  us_corner_lot: 'Corner Lot', us_cleared_lot: 'Cleared Lot', us_utilities_available: 'Utilities Available', us_residential_zoning: 'Residential Zoning', us_paved_road: 'Paved Road',
}

const property = {
  purpose: 'sale', type: 'us_condo', state: 'FL', city: 'Miami', district: 'Brickell',
  bedrooms: '2', highlights: ['us_near_downtown', 'us_community_pool', 'us_updated'],
}

const generation = {
  mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled',
  furniture: 'original', stagingPresentation: 'final_only', language: 'en-US',
} as const

test('maps every supported US type and highlight to its provider-facing EN-US label', () => {
  for (const [technicalValue, label] of Object.entries(propertyTypes)) {
    assert.equal(presentSmartTourPropertyType(technicalValue), label)
  }
  for (const [technicalValue, label] of Object.entries(highlights)) {
    assert.equal(presentSmartTourHighlight(technicalValue), label)
  }
})

test('briefing, captions and prompt context receive labels while the original payload remains technical', () => {
  const before = structuredClone(property)
  const briefing = buildSmartTourStructuredBriefing({
    generation, property, selectedCta: 'Schedule a showing', imagePaths: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'], language: 'en-US',
  })
  const context = buildPropertyContext(property)
  const contextData = JSON.parse(context.slice(context.indexOf('\n') + 1))
  const providerText = JSON.stringify({ briefing, context })

  assert.equal(briefing.imovel.tipo, 'Condo')
  assert.deepEqual(briefing.imovel.destaques, ['Near Downtown', 'Community Pool', 'Updated'])
  assert.match(briefing.cenas.map(scene => scene.legenda).join('\n'), /Near Downtown|Community Pool/)
  assert.equal(contextData.tipologia, 'Condo')
  assert.deepEqual(contextData.diferenciais, ['Near Downtown', 'Community Pool', 'Updated'])
  assert.doesNotMatch(providerText, /us_(condo|near_downtown|community_pool|updated)/)
  assert.deepEqual(property, before)
})

test('dynamic narration sends labels, never US technical values, and does not mutate recovery data', async () => {
  const before = structuredClone(property)
  let requestBody = ''
  await generateSmartTourDynamicNarration({
    apiKey: 'test-key', property, selectedCta: 'Schedule a showing',
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'For sale condo near downtown with community pool.' } }] }), { status: 200 })
    },
  })
  const request = JSON.parse(requestBody)
  const facts = JSON.parse(request.messages[1].content)
  assert.equal(facts.tipoDoImovel, 'Condo')
  assert.deepEqual(facts.destaquesPrincipais, ['Near Downtown', 'Community Pool'])
  assert.doesNotMatch(requestBody, /us_(condo|near_downtown|community_pool)/)
  assert.deepEqual(property, before)
})

test('unknown technical US values are omitted while legacy Brazilian labels remain unchanged', () => {
  assert.equal(presentSmartTourPropertyType('us_future_type'), '')
  assert.equal(presentSmartTourHighlight('us_future_highlight'), '')
  assert.equal(presentSmartTourPropertyType('Apartamento'), 'Apartamento')
  assert.equal(presentSmartTourHighlight('Varanda gourmet'), 'Varanda gourmet')

  const briefing = buildSmartTourStructuredBriefing({
    generation, property: { ...property, type: 'us_future_type', highlights: ['us_future_highlight', 'Varanda gourmet'] },
    selectedCta: '', imagePaths: ['1.jpg'], language: 'en-US',
  })
  assert.equal(briefing.imovel.tipo, '')
  assert.deepEqual(briefing.imovel.destaques, ['Varanda gourmet'])
  assert.doesNotMatch(JSON.stringify(briefing), /us_future/)
})

test('social caption options never show technical US values', () => {
  const captions = buildSmartTourPublicationOptions({ property, language: 'pt-BR' })
  const text = captions.map(option => option.text).join('\n')
  assert.match(text, /condo/i)
  assert.match(text, /Near Downtown/)
  assert.doesNotMatch(text, /us_(condo|near_downtown|community_pool|updated)/)
})

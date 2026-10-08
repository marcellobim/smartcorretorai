import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { restoreProductDraftShape } from '../src/lib/product-draft.js'
import {
  getCountiesByState,
  getUsCitiesByCounty,
  getStatesForMarket,
  isValidCountyForState,
  isValidState,
  isValidUsZipCode,
  normalizeUsZipCode,
  US_COUNTIES,
  US_STATES,
} from '../src/config/locations/index.js'

const smartTourPage = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')

test('ships all 50 states plus DC with unique abbreviations', () => {
  assert.equal(US_STATES.length, 51)
  assert.equal(new Set(US_STATES.map(state => state.abbreviation)).size, 51)
  assert.ok(US_STATES.some(state => state.abbreviation === 'FL' && state.name === 'Florida'))
  assert.ok(US_STATES.some(state => state.abbreviation === 'DC' && state.name === 'District of Columbia'))
  assert.equal(getStatesForMarket('US').length, 51)
  assert.equal(isValidState('FL'), true)
  assert.equal(isValidState('CA'), true)
  assert.equal(isValidState('XX'), false)
})

test('keeps a complete local Census county-equivalent dataset with valid unique FIPS pairs', () => {
  assert.equal(US_COUNTIES.length, 3144)
  assert.ok(US_COUNTIES.every(county => US_STATES.some(state => state.abbreviation === county.state)))
  assert.equal(new Set(US_COUNTIES.map(county => `${county.stateFips}-${county.countyFips}`)).size, US_COUNTIES.length)
  assert.ok(US_COUNTIES.every(county => county.name && county.label && /^\d{2}$/.test(county.stateFips) && /^\d{3}$/.test(county.countyFips)))
})

test('filters counties by selected state', () => {
  const floridaCounties = getCountiesByState('FL')

  assert.ok(floridaCounties.some(county => county.value === 'Hillsborough County'))
  assert.ok(floridaCounties.some(county => county.value === 'Sarasota County'))
  assert.ok(floridaCounties.some(county => county.value === 'Manatee County'))
  assert.ok(floridaCounties.some(county => county.value === 'Pinellas County'))
  assert.equal(floridaCounties.some(county => county.value === 'Los Angeles County'), false)
  assert.equal(isValidCountyForState('FL', 'Hillsborough County'), true)
  assert.equal(isValidCountyForState('CA', 'Hillsborough County'), false)
})

test('normalizes and validates ZIP Code values without a remote lookup', () => {
  assert.equal(normalizeUsZipCode('33101'), '33101')
  assert.equal(normalizeUsZipCode('33101-1234'), '33101-1234')
  assert.equal(isValidUsZipCode('33101'), true)
  assert.equal(isValidUsZipCode('33101-1234'), true)
  assert.equal(isValidUsZipCode('3310'), false)
})

test('queries real county geometry through POST so large counties do not overflow a URL', async () => {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    if (calls.length === 1) return new Response(JSON.stringify({ features: [{ geometry: { rings: [[[0, 0], [1, 0], [0, 1], [0, 0]]] } }] }), { status: 200 })
    return new Response(JSON.stringify({ features: [{ attributes: { BASENAME: calls.length === 2 ? 'Tampa' : 'Temple Terrace' } }] }), { status: 200 })
  }
  const cities = await getUsCitiesByCounty('FL', 'Hillsborough County', { fetchImpl })
  assert.deepEqual(cities, ['Tampa', 'Temple Terrace'])
  assert.equal(calls.length, 3)
  for (const call of calls.slice(1)) {
    assert.equal(call.init.method, 'POST')
    assert.ok(call.init.body instanceof URLSearchParams)
    assert.equal(call.init.body.get('spatialRel'), 'esriSpatialRelIntersects')
  }
})

test('preserves US location fields in drafts while legacy BR drafts retain their existing shape', () => {
  const defaults = { state: '', county: '', city: '', district: '', zipCode: '', neighborhoodCommunity: '' }
  const usDraft = restoreProductDraftShape(defaults, { state: 'FL', county: 'Hillsborough County', city: 'Tampa', zipCode: '33602', neighborhoodCommunity: 'Downtown' })
  const brDraft = restoreProductDraftShape(defaults, { state: 'SP', city: 'São Paulo', district: 'Vila Mariana' })

  assert.deepEqual(usDraft, { state: 'FL', county: 'Hillsborough County', city: 'Tampa', district: '', zipCode: '33602', neighborhoodCommunity: 'Downtown' })
  assert.deepEqual(brDraft, { state: 'SP', county: '', city: 'São Paulo', district: 'Vila Mariana', zipCode: '', neighborhoodCommunity: '' })
})

test('Smart Tour keeps the BR controls and renders the US State, County, City, ZIP and community flow', () => {
  assert.match(smartTourPage, /market === 'US'/)
  assert.match(smartTourPage, /getStatesForMarket\('US'\)/)
  assert.match(smartTourPage, /getCountiesByState\(property\.state\)/)
  assert.match(smartTourPage, /county: ''/)
  assert.match(smartTourPage, /property\.zipCode/)
  assert.match(smartTourPage, /property\.neighborhoodCommunity/)
  assert.match(smartTourPage, /<SmartCarouselStateSelect value=\{property\.state\}/)
})

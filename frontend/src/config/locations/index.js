import { US_CENSUS_GAZETTEER_2025_SOURCE, US_COUNTIES, US_STATES } from './us-census-2025.js'

export { US_CENSUS_GAZETTEER_2025_SOURCE, US_COUNTIES, US_STATES }

export const BR_STATE_ABBREVIATIONS = Object.freeze([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

export const BR_STATE_OPTIONS = Object.freeze(BR_STATE_ABBREVIATIONS.map(value => Object.freeze({ value, label: value })))
export const US_STATE_OPTIONS = Object.freeze(US_STATES.map(state => Object.freeze({
  value: state.abbreviation,
  label: `${state.name} (${state.abbreviation})`,
  fips: state.fips,
})))

const COUNTY_OPTIONS_BY_STATE = Object.freeze(Object.fromEntries(US_STATES.map(({ abbreviation }) => [
  abbreviation,
  Object.freeze(US_COUNTIES
    .filter(county => county.state === abbreviation)
    .map(county => Object.freeze({ value: county.name, label: county.label, state: county.state, stateFips: county.stateFips, countyFips: county.countyFips }))),
])))

export function getStatesForMarket(market = 'BR') {
  return market === 'US' ? US_STATE_OPTIONS : BR_STATE_OPTIONS
}

export function getCountiesByState(state) {
  return COUNTY_OPTIONS_BY_STATE[String(state || '').toUpperCase()] || []
}

export function isValidState(state, market = 'US') {
  const value = String(state || '').toUpperCase()
  return getStatesForMarket(market).some(option => option.value === value)
}

export function isValidCountyForState(state, county) {
  return getCountiesByState(state).some(option => option.value === county)
}

// TIGERweb is the Census Bureau's public geography service. We first fetch the
// selected county boundary, then intersect it with incorporated places and CDPs.
// This makes the city list genuinely dependent on the County selection.
export async function getUsCitiesByCounty(state, county, { signal } = {}) {
  const countyOption = getCountiesByState(state).find(option => option.value === county)
  if (!countyOption) return []
  const countyQuery = new URLSearchParams({ where: `STATE='${countyOption.stateFips}' AND COUNTY='${countyOption.countyFips}'`, outFields: 'NAME', returnGeometry: 'true', outSR: '4326', f: 'json' })
  const countyResponse = await fetch(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?${countyQuery}`, { signal })
  const countyJson = await countyResponse.json()
  const geometry = countyJson.features?.[0]?.geometry
  if (!countyResponse.ok || !geometry) throw new Error('Census county geometry is unavailable')
  const placeQuery = new URLSearchParams({ where: '1=1', geometry: JSON.stringify(geometry), geometryType: 'esriGeometryPolygon', spatialRel: 'esriSpatialRelIntersects', inSR: '4326', outFields: 'BASENAME,NAME', returnGeometry: 'false', f: 'json' })
  const layers = [4, 5]
  const responses = await Promise.all(layers.map(layer => fetch(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/${layer}/query?${placeQuery}`, { signal })))
  const payloads = await Promise.all(responses.map(response => response.json()))
  if (responses.some(response => !response.ok)) throw new Error('Census place data is unavailable')
  return payloads.flatMap(payload => payload.features || []).map(feature => String(feature.attributes?.BASENAME || feature.attributes?.NAME || '').trim()).filter(Boolean).filter((city, index, items) => items.indexOf(city) === index).sort((a, b) => a.localeCompare(b, 'en-US'))
}

export function normalizeUsZipCode(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 9)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function isValidUsZipCode(value = '') {
  return /^\d{5}(?:-\d{4})?$/.test(String(value))
}

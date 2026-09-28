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

export function normalizeUsZipCode(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 9)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function isValidUsZipCode(value = '') {
  return /^\d{5}(?:-\d{4})?$/.test(String(value))
}

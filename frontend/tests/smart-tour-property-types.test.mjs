import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'
import {
  getSmartTourPropertyTypes,
  getSmartTourPropertyKind,
  SMART_TOUR_PROPERTY_TYPES,
  SMART_TOUR_PROPERTY_TYPES_BY_MARKET,
  SMART_TOUR_US_PROPERTY_TYPES,
} from '../src/config/smartTourForm.js'

const EXPECTED_VALUES = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Studio / Loft',
  'Terreno / Lote',
  'Comercial',
]

const EXPECTED_US_VALUES = [
  'us_single_family_home',
  'us_condo',
  'us_townhouse',
  'us_multi_family',
  'us_apartment',
  'us_studio',
  'us_land_lot',
  'us_commercial',
]

function messageFor(messages, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], messages)
}

const smartTourPage = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')

test('keeps the six legacy property type values while exposing valid label keys', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES.length, 6)
  assert.deepEqual(SMART_TOUR_PROPERTY_TYPES.map((option) => option.value), EXPECTED_VALUES)
  assert.ok(SMART_TOUR_PROPERTY_TYPES.every((option) => (
    typeof option.labelKey === 'string'
    && option.labelKey.startsWith('smartTour.propertyTypes.')
    && messageFor(ptBR, option.labelKey)
    && messageFor(enUS, option.labelKey)
  )))
})

test('uses translated labels without changing the selected internal value', () => {
  const apartment = SMART_TOUR_PROPERTY_TYPES.find((option) => option.value === 'Apartamento')

  assert.equal(apartment.value, 'Apartamento')
  assert.equal(messageFor(ptBR, apartment.labelKey), 'Apartamento')
  assert.equal(messageFor(enUS, apartment.labelKey), 'Apartment')

  // SmartTourAI stores option.value, so an English label still produces the legacy payload value.
  const selectedValue = apartment.value
  assert.equal(selectedValue, 'Apartamento')
})

test('preserves rental filtering and recognizes legacy draft/recovery property types', () => {
  assert.deepEqual(
    getSmartTourPropertyTypes('rent').map((option) => option.value),
    EXPECTED_VALUES.filter((value) => value !== 'Terreno / Lote'),
  )
  assert.deepEqual(
    getSmartTourPropertyTypes('sale').map((option) => option.value),
    EXPECTED_VALUES,
  )

  const legacyDraftType = 'Apartamento'
  const matchingOption = SMART_TOUR_PROPERTY_TYPES.find((option) => option.value === legacyDraftType)

  assert.ok(matchingOption)
  assert.equal(messageFor(enUS, matchingOption.labelKey), 'Apartment')
})

test('uses the eight independent US property types and preserves their labels', () => {
  assert.equal(SMART_TOUR_US_PROPERTY_TYPES.length, 8)
  assert.deepEqual(SMART_TOUR_US_PROPERTY_TYPES.map((option) => option.value), EXPECTED_US_VALUES)
  assert.deepEqual(getSmartTourPropertyTypes('sale', { market: 'US' }).map((option) => option.value), EXPECTED_US_VALUES)
  assert.deepEqual(
    getSmartTourPropertyTypes('rent', { market: 'US' }).map((option) => option.value),
    EXPECTED_US_VALUES.filter((value) => value !== 'us_land_lot'),
  )

  assert.deepEqual(
    SMART_TOUR_US_PROPERTY_TYPES.map((option) => messageFor(enUS, option.labelKey)),
    ['Single-Family Home', 'Condo', 'Townhouse', 'Multi-Family Home', 'Apartment', 'Studio', 'Land / Lot', 'Commercial Property'],
  )
  assert.deepEqual(
    SMART_TOUR_US_PROPERTY_TYPES.map((option) => messageFor(ptBR, option.labelKey)),
    ['Casa unifamiliar', 'Unidade condominial (Condo)', 'Casa geminada (Townhouse)', 'Imóvel multifamiliar', 'Apartamento', 'Studio', 'Terreno / Lote', 'Imóvel comercial'],
  )
})

test('falls back to the unchanged BR catalog for absent or invalid markets', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES_BY_MARKET.BR, SMART_TOUR_PROPERTY_TYPES)
  assert.equal(SMART_TOUR_PROPERTY_TYPES_BY_MARKET.US, SMART_TOUR_US_PROPERTY_TYPES)
  assert.deepEqual(getSmartTourPropertyTypes('sale').map((option) => option.value), EXPECTED_VALUES)
  assert.deepEqual(getSmartTourPropertyTypes('sale', { market: 'CA' }).map((option) => option.value), EXPECTED_VALUES)
  assert.deepEqual(getSmartTourPropertyTypes('sale', null).map((option) => option.value), EXPECTED_VALUES)
})

test('keeps BR drafts and recognizes new US draft values without conversion', () => {
  const legacyDraft = SMART_TOUR_PROPERTY_TYPES.find((option) => option.value === 'Apartamento')
  const usDraft = SMART_TOUR_US_PROPERTY_TYPES.find((option) => option.value === 'us_condo')

  assert.equal(legacyDraft?.value, 'Apartamento')
  assert.equal(usDraft?.value, 'us_condo')
})

test('Smart Tour selects the current market catalog and stores option values', () => {
  assert.match(smartTourPage, /getSmartTourPropertyTypes\(property\.purpose, \{ market \}\)/)
  assert.match(smartTourPage, /const itemValue = item\.value \?\? item\.id/)
  assert.match(smartTourPage, /select\(itemValue, label\)/)
})

test('classifies US technical values without relying on translated labels', () => {
  assert.equal(getSmartTourPropertyKind('us_single_family_home'), 'house')
  assert.equal(getSmartTourPropertyKind('us_townhouse'), 'house')
  assert.equal(getSmartTourPropertyKind('us_condo'), 'residential')
  assert.equal(getSmartTourPropertyKind('us_multi_family'), 'residential')
  assert.equal(getSmartTourPropertyKind('us_apartment'), 'residential')
  assert.equal(getSmartTourPropertyKind('us_studio'), 'residential')
  assert.equal(getSmartTourPropertyKind('us_land_lot'), 'land')
  assert.equal(getSmartTourPropertyKind('us_commercial'), 'commercial')
})

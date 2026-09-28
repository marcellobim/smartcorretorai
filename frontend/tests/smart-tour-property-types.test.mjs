import assert from 'node:assert/strict'
import test from 'node:test'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'
import {
  getSmartTourPropertyTypes,
  SMART_TOUR_PROPERTY_TYPES,
} from '../src/config/smartTourForm.js'

const EXPECTED_VALUES = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Studio / Loft',
  'Terreno / Lote',
  'Comercial',
]

function messageFor(messages, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], messages)
}

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

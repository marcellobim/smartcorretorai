import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LISTING_XRAY_FIELD_KEYS, LISTING_XRAY_FIELD_STATES, LISTING_XRAY_RESPONSE_SCHEMA,
  normalizeListingXrayObservedFields, validateListingXrayModelOutput,
} from './contract.ts'
import { makeObservedFieldRegressionFixture } from './fixtures/model-output-fixtures.ts'

test('fixture sanitizado reproduz a condição estrutural rejeitada pelo parser anterior', () => {
  const raw = makeObservedFieldRegressionFixture(); const fields = raw.listing!.observed_fields
  const keys = fields.map(field => String(field.key)); const legacyWouldReject = new Set(keys).size !== keys.length || fields.some(field => field.state === 'CONFIRMED' && !field.value)
  assert.equal(legacyWouldReject, true)
})

test('fixture do canário valida de forma neutra sem inventar campo confirmado', () => {
  const parsed = validateListingXrayModelOutput(makeObservedFieldRegressionFixture()); const fields = parsed.listing!.observed_fields
  assert.equal(fields.find(field => field.key === 'title')?.state, 'AMBIGUOUS')
  assert.equal(fields.find(field => field.key === 'parkingSpaces')?.state, 'AMBIGUOUS')
  assert.equal(fields.some(field => String(field.key) === 'brokerPhone'), false)
})

test('schema e parser compartilham enums imutáveis de key/state', () => {
  const listing = (LISTING_XRAY_RESPONSE_SCHEMA.properties.listing.anyOf[0] as { properties: Record<string, any> })
  const observed = listing.properties.observed_fields.items.properties
  assert.deepEqual(observed.key.enum, [...LISTING_XRAY_FIELD_KEYS])
  assert.deepEqual(observed.state.enum, [...LISTING_XRAY_FIELD_STATES])
  assert.deepEqual(normalizeListingXrayObservedFields([{ key: 'unknown', state: 'CONFIRMED', value: 'x', evidence: 'x' }]), [])
})

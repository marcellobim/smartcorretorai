import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { VIRTUAL_STAGING_HIGHLIGHT_GROUPS } from '../src/config/virtualStagingForm.js'
import {
  VIRTUAL_STAGING_BR_ONLY_HIGHLIGHTS,
  VIRTUAL_STAGING_HIGHLIGHT_LABELS,
  getVirtualStagingActiveHighlightValues,
  getVirtualStagingHighlightLabel,
  isVirtualStagingHighlightAvailableForMarket,
} from '../src/config/virtualStagingHighlightLabels.js'

const EXPECTED_ACTIVE_VALUE_COUNT = 147
const EXPECTED_SOURCE_VALUES_SHA256 = '0bd27b19fd1add0093cde52f62a08edcf7b1205624a8f711061675e93393f1c9'

const sourceValues = [...new Set(
  Object.values(VIRTUAL_STAGING_HIGHLIGHT_GROUPS).flatMap(groups => groups.flatMap(group => group.items)),
)]
const sourceValueSet = new Set(sourceValues)
const labelValues = Object.keys(VIRTUAL_STAGING_HIGHLIGHT_LABELS)
const brOnlyValues = new Set(VIRTUAL_STAGING_BR_ONLY_HIGHLIGHTS)
const sourceFingerprint = createHash('sha256').update(JSON.stringify(sourceValues)).digest('hex')

test('virtual staging highlight catalog keeps its approved active values', () => {
  assert.equal(sourceValues.length, EXPECTED_ACTIVE_VALUE_COUNT)
  assert.equal(sourceFingerprint, EXPECTED_SOURCE_VALUES_SHA256)
  assert.deepEqual(getVirtualStagingActiveHighlightValues(), sourceValues)
})

test('every active value has a PT-BR label and no orphan label exists', () => {
  const missingPtBR = sourceValues.filter(value => !VIRTUAL_STAGING_HIGHLIGHT_LABELS[value]?.ptBR)
  const orphans = labelValues.filter(value => !sourceValueSet.has(value))

  assert.deepEqual(missingPtBR, [])
  assert.deepEqual(orphans, [])
})

test('every active value has an explicit EN-US label or an intentional BR-only classification', () => {
  const invalidBrOnly = [...brOnlyValues].filter(value => !sourceValueSet.has(value))
  const unclassified = sourceValues.filter(value => {
    const label = VIRTUAL_STAGING_HIGHLIGHT_LABELS[value]
    return !brOnlyValues.has(value) && !label?.enUS
  })
  const invalidBrOnlyLabels = sourceValues.filter(value => (
    brOnlyValues.has(value) && VIRTUAL_STAGING_HIGHLIGHT_LABELS[value]?.brOnly !== true
  ))

  assert.deepEqual(invalidBrOnly, [])
  assert.deepEqual(unclassified, [])
  assert.deepEqual(invalidBrOnlyLabels, [])
})

test('the EN-US resolver has no fallback for the current catalog and falls back safely for unknown values', () => {
  const enUsFallbacks = sourceValues.filter(value => (
    !brOnlyValues.has(value)
    && getVirtualStagingHighlightLabel(value, { locale: 'en-US', market: 'US' }) !== VIRTUAL_STAGING_HIGHLIGHT_LABELS[value].enUS
  ))
  const futureUntranslatedValue = 'Future catalog value without translation'

  assert.deepEqual(enUsFallbacks, [])
  assert.equal(getVirtualStagingHighlightLabel(futureUntranslatedValue, { locale: 'en-US', market: 'US' }), futureUntranslatedValue)
})

test('BR-only values are unavailable in the US market', () => {
  const incorrectlyAvailable = [...brOnlyValues].filter(value => isVirtualStagingHighlightAvailableForMarket(value, 'US'))
  const incorrectlyUnavailable = sourceValues
    .filter(value => !brOnlyValues.has(value))
    .filter(value => !isVirtualStagingHighlightAvailableForMarket(value, 'US'))

  assert.deepEqual(incorrectlyAvailable, [])
  assert.deepEqual(incorrectlyUnavailable, [])
})

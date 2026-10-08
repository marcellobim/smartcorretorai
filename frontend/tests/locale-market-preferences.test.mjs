import test from 'node:test'
import assert from 'node:assert/strict'

import { getMarketConfig, normalizeMarketPreferences } from '../src/i18n/locale-config.js'

test('market has one canonical locale, currency, and unit system', () => {
  assert.deepEqual(getMarketConfig('BR'), { locale: 'pt-BR', currency: 'BRL', units: 'metric' })
  assert.deepEqual(getMarketConfig('US'), { locale: 'en-US', currency: 'USD', units: 'imperial' })
})

test('normalizes legacy locale-only preferences to their market', () => {
  assert.deepEqual(normalizeMarketPreferences({ locale: 'en-US' }), { market: 'US', locale: 'en-US' })
  assert.deepEqual(normalizeMarketPreferences({ locale: 'pt-BR' }), { market: 'BR', locale: 'pt-BR' })
})

test('market wins over a stale conflicting locale', () => {
  assert.deepEqual(normalizeMarketPreferences({ market: 'US', locale: 'pt-BR' }), { market: 'US', locale: 'en-US' })
  assert.deepEqual(normalizeMarketPreferences({ market: 'BR', locale: 'en-US' }), { market: 'BR', locale: 'pt-BR' })
})

test('manual market changes remain canonical through a subsequent preference normalization', () => {
  const selectedUS = normalizeMarketPreferences({ market: 'US' })
  const selectedBR = normalizeMarketPreferences({ market: 'BR' })

  assert.deepEqual(normalizeMarketPreferences(selectedUS), selectedUS)
  assert.deepEqual(normalizeMarketPreferences(selectedBR), selectedBR)
})

test('unrelated profile-like fields cannot overwrite a manually selected market', () => {
  const manuallySelectedUS = { ...normalizeMarketPreferences({ market: 'US' }), profile_market: 'BR', profile_locale: 'pt-BR' }
  const manuallySelectedBR = { ...normalizeMarketPreferences({ market: 'BR' }), profile_market: 'US', profile_locale: 'en-US' }

  assert.deepEqual(normalizeMarketPreferences(manuallySelectedUS), { market: 'US', locale: 'en-US' })
  assert.deepEqual(normalizeMarketPreferences(manuallySelectedBR), { market: 'BR', locale: 'pt-BR' })
})

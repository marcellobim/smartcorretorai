import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const landing = read('pages/LandingPage.jsx')
const sidebar = read('components/layout/Sidebar.jsx')
const selector = read('components/i18n/MarketSelector.jsx')
const localeProvider = read('i18n/LocaleProvider.jsx')

test('uses a discreet Language & Region selector in footer, sidebar, and mobile menu', () => {
  assert.doesNotMatch(landing, /MarketSelector compact className="hidden w-\[226px\] sm:grid"/)
  assert.match(landing, /<MarketSelector compact className="mt-6 max-w-xs"\s*\/>/)
  assert.match(landing, /<MarketSelector compact className="mt-3"\s*\/>/)
  assert.match(sidebar, /<MarketSelector compact className="mt-1\.5"\s*\/>/)
  assert.match(selector, /Language & Region/)
  assert.match(selector, /<details/)
})

test('persists manual choice and suggests only en-US on a first visit', () => {
  assert.match(localeProvider, /const stored = window\.localStorage\.getItem\(LOCALE_PREFERENCES_KEY\)/)
  assert.match(localeProvider, /String\(value\)\.toLowerCase\(\) === 'en-us'/)
  assert.match(localeProvider, /localStorage\.setItem\(LOCALE_PREFERENCES_KEY, JSON\.stringify\(\{ locale, market \}\)\)/)
  assert.match(localeProvider, /setPreferences\(\(\) => normalizeMarketPreferences\(\{ market: nextMarket \}\)\)/)
})

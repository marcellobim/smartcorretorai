import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getCountiesByState, isValidUsZipCode, normalizeUsZipCode } from '../src/config/locations/index.js'
import { buildBrokerPresentationGenerationPayload } from '../src/config/virtualStagingBroker.js'
import { buildLifeInPropertyGenerationPayload } from '../src/config/virtualStagingLife.js'
import { formatPhone } from '../src/utils/phoneFormatters.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/VirtualStaging.jsx'), 'utf8')

test('Vida no Imóvel and Apresentação pelo Corretor use the saved locale without changing their generation semantics', () => {
  assert.equal(buildLifeInPropertyGenerationPayload({ lifeScene: 'adult', captions: 'enabled', language: 'en-US' }).language, 'en-US')
  assert.equal(buildBrokerPresentationGenerationPayload({ captions: 'enabled', language: 'en-US' }).language, 'en-US')
  assert.match(page, /const \{ locale, market, t \} = useLocale\(\)/)
  assert.match(page, /const draftLocale = supportsLocaleMarket \? normalizeLocale\(restoredJourneyDraft\.locale \|\| locale\) : 'pt-BR'/)
  assert.match(page, /language: draftLocale/)
  assert.doesNotMatch(page.slice(page.indexOf('const requestBody ='), page.indexOf("supabase.functions.invoke('virtual-staging-generate'")), /market:/)
})

test('new drafts save locale and market while legacy drafts fall back to BR and pt-BR', () => {
  assert.match(page, /supportsLocaleMarket \? \{ locale: draftLocale, market: draftMarket \} : \{\}/)
  assert.match(page, /const draftMarket = supportsLocaleMarket \? normalizeMarket\(restoredJourneyDraft\.market \|\| market\) : 'BR'/)
  assert.match(page, /const normalizeLocale = value => value === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(page, /const normalizeMarket = value => value === 'US' \? 'US' : 'BR'/)
})

test('BR preserves UF, city, district and its phone mask; US uses dependent county and ZIP validation', () => {
  assert.match(page, /<SmartCarouselStateSelect/)
  assert.match(page, /<SmartCarouselCitySelect uf=\{property\.state\}/)
  assert.match(page, /placeholder=\{t\('virtualStaging\.location\.neighborhood'\)\}/)
  assert.match(page, /getCountiesByState\(property\.state\)/)
  assert.match(page, /disabled=\{!property\.state\}/)
  assert.match(page, /normalizeUsZipCode\(property\.zipCode\)/)
  assert.match(page, /isValidUsZipCode\(zipCode\)/)
  assert.ok(getCountiesByState('CA').length > 0)
  assert.equal(normalizeUsZipCode('902101234'), '90210-1234')
  assert.equal(isValidUsZipCode('90210-1234'), true)
  assert.equal(formatPhone('11987654321', 'BR'), '(11) 98765-4321')
  assert.equal(formatPhone('4155552671', 'US'), '(415) 555-2671')
  assert.match(page, /formatPhone\(rawPhone, draftMarket\)/)
})

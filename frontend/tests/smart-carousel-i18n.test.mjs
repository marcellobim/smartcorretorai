import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const page = readFileSync(path.join(root, 'src/pages/SmartCarrossel.jsx'), 'utf8')
const catalog = readFileSync(path.join(root, 'src/i18n/smart-carousel.js'), 'utf8')

test('Smart Carrossel uses the shared locale context with PT-BR fallback and EN-US copy', () => {
  assert.match(page, /useLocale\(\)/)
  assert.match(page, /getSmartCarouselCopy\(locale\)/)
  assert.match(catalog, /locale === 'en-US' \? enUS : ptBR/)
  assert.match(catalog, /Professional Property Presentation/)
  assert.match(catalog, /Apresentação Profissional/)
})

test('Smart Carrossel localizes questions, review labels, and presentation-only option labels', () => {
  assert.match(page, /const messages = copy\.questions/)
  assert.match(page, /copy\.stage\[item\]/)
  assert.match(page, /copy\.labelFor\(item\)/)
  assert.match(page, /createNewLabel=\{copy\.createNew\}/)
  assert.match(catalog, /What type of property are you presenting\?/) 
  assert.match(catalog, /Qual é a finalidade do imóvel\?/) 
})

test('Smart Carrossel keeps backend values and recovery identifiers independent from translated labels', () => {
  for (const value of ['sale', 'rent', 'Pronto para morar', 'Apartamento', 'Saiba Mais', 'activeJobId', 'clientRequestId']) {
    if (value === 'clientRequestId') continue
    assert.ok(page.includes(value) || catalog.includes(value), value)
  }
  assert.match(page, /value: item, answer: copy\.labelFor\(item\)/)
  assert.match(page, /hasRecoverableActiveJob/)
  assert.match(page, /pollRenderStatus\(receipt, activeJobId\)/)
})

test('Smart Carrossel keeps BR location and adds the shared US location contract only in the frontend draft', () => {
  assert.match(page, /<SmartCarouselCitySelect uf=\{uf\} value=\{city\}/)
  assert.match(page, /getStatesForMarket\('US'\)/)
  assert.match(page, /getCountiesByState\(uf\)/)
  assert.match(page, /isValidCountyForState\(uf, county\)/)
  assert.match(page, /normalizeUsZipCode\(zipCode\)/)
  assert.match(page, /neighborhoodCommunity/)
  assert.match(page, /county,/)
  assert.match(page, /zip_code: normalizedZipCode/)
  assert.match(page, /neighborhood_community: neighborhoodCommunity\.trim\(\)/)
})

test('Smart Carrossel formats professional phone numbers through the shared market helper', () => {
  assert.match(page, /formatPhone\(user\?\.whatsapp.*market\)/)
  assert.match(page, /formatPhone\(profilePhone, market\)/)
})

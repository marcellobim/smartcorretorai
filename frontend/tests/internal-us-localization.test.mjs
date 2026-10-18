import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const plans = read('pages/Planos.jsx')
const terms = read('pages/TermosDeUso.jsx')
const privacy = read('pages/Privacidade.jsx')
const staging = read('pages/VirtualStaging.jsx')
const textCampaign = read('pages/TextCampaign.jsx')
const enUS = read('i18n/messages/en-US.js')

test('Plans and Smart Tokens supplies the entire current-market UI from BR and US copy', () => {
  for (const usCopy of ['Plans / Smart Tokens', 'Launch offer', 'Add Smart Tokens', 'FAQ / Rules', 'Choose your plan', 'Need more capacity?', 'Questions?']) assert.ok(plans.includes(usCopy), usCopy)
  for (const brCopy of ['Planos / Smart Tokens', 'Oferta de lançamento', 'Adicionar Smart Tokens', 'FAQ / Regras', 'Escolha seu plano', 'Precisa de mais capacidade?', 'Dúvidas?']) assert.ok(plans.includes(brCopy), brCopy)
  assert.match(plans, /const RULES_US = \[/)
  assert.match(plans, /formatTokens\(item\.credits, locale\)/)
  assert.match(plans, /toast\.error\(copy\.checkoutError\)/)
  assert.match(plans, /\? copy\.currentPlan/)
  assert.match(plans, /\{copy\.launchOffer\}/)
})

test('Terms and Privacy select complete US legal documents by active market', () => {
  for (const source of [terms, privacy]) {
    assert.match(source, /const \{ market \} = useLocale\(\)/)
    assert.match(source, /const us = market === 'US'/)
    assert.match(source, /Last updated: October 2026/)
    assert.match(source, /Outubro de 2026/)
  }
  assert.match(terms, /<EnglishTerms \/>/)
  assert.match(terms, /title="10\. Contact"/)
  assert.match(privacy, /<PrivacyEnglish \/>/)
  assert.match(privacy, /title="9\. Updates"/)
})

test('Life in the Property and Agent Presentation use US bathrooms and sqft only in US UI', () => {
  assert.match(enUS, /measures: Object\.freeze\(\{ bedrooms: 'Bedrooms', suites: 'Bathrooms', parkingSpaces: 'Parking spaces'/)
  assert.match(enUS, /review: Object\.freeze\(\{[\s\S]*?suites: 'Bathrooms'/)
  assert.match(staging, /const areaUnit = draftMarket === 'US' \? 'sqft' : 'm²'/)
  assert.match(staging, /const areaUnit = market === 'US' \? 'sqft' : 'm²'/)
  assert.match(staging, /\{areaUnit\}<\/span>/)
})

test('Text Campaign keeps US property facts in English', () => {
  assert.match(textCampaign, /suites: locale === 'en-US' \? 'Bathrooms' : 'Suítes'/)
  assert.match(textCampaign, /area: locale === 'en-US' \? 'Square feet \(sqft\)' : 'Área \(m²\)'/)
})

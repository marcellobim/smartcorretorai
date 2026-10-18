import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ptBRMessages from '../src/i18n/messages/pt-BR.js'
import enUSMessages from '../src/i18n/messages/en-US.js'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const landing = read('pages/LandingPage.jsx')
const enUSLandingCatalog = JSON.stringify(enUSMessages.landing)

test('Landing sources the new visible copy from BR and US catalogs', () => {
  for (const messages of [ptBRMessages, enUSMessages]) {
    for (const key of ['hero', 'positioning', 'distribution', 'trial', 'smartSpace', 'products']) {
      assert.equal(typeof messages.landing[key], 'object', key)
    }
  }
  assert.match(landing, /t\('landing\.hero\.title'\)/)
  assert.match(landing, /t\('landing\.hero\.description'\)/)
  assert.match(landing, /t\('landing\.hero\.distribution'\)/)
  assert.match(landing, /t\('landing\.distribution\.tiktok'\)/)
})

test('US catalog is English-only for the updated Landing surfaces', () => {
  for (const copy of ['Create real estate marketing that’s ready to publish.', 'Direct publish', 'Send to TikTok', 'Create a free Real Estate Banner', 'Try Virtual Staging free']) assert.ok(enUSLandingCatalog.includes(copy), copy)
  for (const copy of ['Crie marketing imobiliário pronto para publicar.', 'Publicação direta', 'Enviar para o TikTok', 'Criar Banner grátis']) assert.doesNotMatch(enUSLandingCatalog, new RegExp(copy))
})

test('US text campaign demo retains US terminology and location', () => {
  for (const copy of ['Tampa, Florida', '990 sq ft', '#TampaRealEstate', '#FloridaRealEstate', 'Social media']) assert.ok(enUSLandingCatalog.includes(copy), copy)
  for (const copy of ['Moema', 'm²', 'Redes sociais', '#RealEstateSP']) assert.doesNotMatch(enUSLandingCatalog, new RegExp(copy))
})

test('Landing keeps Language & Region discreet in the footer and accessible on mobile', () => {
  assert.doesNotMatch(landing, /MarketSelector compact className="hidden w-\[226px\] sm:grid"/)
  assert.match(landing, /<MarketSelector compact className="mt-6 max-w-xs"\s*\/>/)
  assert.match(landing, /<MarketSelector compact className="mt-3"\s*\/>/)
  assert.match(landing, /id="landing-mobile-menu"/)
  assert.match(landing, /md:hidden/)
  assert.match(landing, /lg:grid-cols/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const landing = read('pages/LandingPage.jsx')
const ptBR = read('i18n/messages/pt-BR.js')
const enUS = read('i18n/messages/en-US.js')

test('Landing data is sourced from locale catalogs for all visible product sections', () => {
  for (const source of [ptBR, enUS]) {
    assert.match(source, /showcase: Object\.freeze/)
    assert.match(source, /heroSlides: Object\.freeze/)
    assert.match(source, /delivery: Object\.freeze/)
    assert.match(source, /textPreview: Object\.freeze/)
    assert.match(source, /tokens: Object\.freeze/)
    assert.match(source, /listingXray: Object\.freeze/)
  }
  for (const copy of ['Video creations', 'Real Estate Video', 'Photos in Motion', 'Text Campaign', 'Create at your own pace.', 'Listing X-Ray']) assert.ok(enUS.includes(copy), copy)
  for (const copy of ['Criações em vídeo', 'Vídeo Imobiliário', 'Fotos em Movimento', 'Campanha de Textos', 'Crie no seu ritmo.', 'Raio-X']) assert.ok(ptBR.includes(copy), copy)
  assert.match(landing, /const HERO_PRODUCT_SLIDES = visibleProducts\(\[/)
  assert.match(landing, /const localizedHeroProductSlides = t =>/)
  assert.match(landing, /const DELIVERY_GROUPS = visibleProducts\(\[/)
  assert.match(landing, /const localizedDeliveryGroups = t =>/)
  assert.match(landing, /const TEXT_CAMPAIGN_CHANNELS = t =>/)
})

test('US landing does not render Portuguese hard-coded UI from the active page', () => {
  for (const copy of ['Criações em vídeo', 'Fotos em Movimento', 'Campanha de Textos', 'Comece a explorar', 'Ver planos e Smart Tokens', 'Não sabe por onde começar?', 'Experimentar o Raio-X']) assert.doesNotMatch(landing, new RegExp(copy))
  assert.match(landing, /t\('landing\.showcase\.heroAccountNote'\)/)
  assert.match(landing, /t\('landing\.showcase\.tokens\.title'\)/)
  assert.match(landing, /t\('landing\.showcase\.listingXray\.title'\)/)
  assert.match(landing, /trialOfferedLabel\(t, locale\)/)
  assert.match(landing, /TRIAL_OFFERED_LABEL is intentionally localized at render time/)
})

test('Landing preserves responsive desktop and mobile controls while localizing content', () => {
  assert.match(landing, /MarketSelector compact className="hidden w-\[226px\] sm:grid"/)
  assert.match(landing, /id="landing-mobile-menu"/)
  assert.match(landing, /md:hidden/)
  assert.match(landing, /lg:grid-cols/)
  assert.match(landing, /HERO_ROTATION_INTERVAL_MS = 5200/)
  assert.match(landing, /loading="lazy"/)
})

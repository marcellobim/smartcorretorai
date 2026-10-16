import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ptBRMessages from '../src/i18n/messages/pt-BR.js'
import enUSMessages from '../src/i18n/messages/en-US.js'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const landing = read('pages/LandingPage.jsx')
const firstCreation = read('components/landing/FirstCreationEntry.jsx')
const ptBR = read('i18n/messages/pt-BR.js')
const enUS = read('i18n/messages/en-US.js')
const enUSLandingCatalog = enUS.slice(enUS.lastIndexOf('  landing: Object.freeze({'))

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

test('Landing delivery catalogs keep the same item contract in BR and US', () => {
  const deliveryGroups = ['videos', 'images', 'text']
  for (const messages of [ptBRMessages, enUSMessages]) {
    const delivery = messages.landing.showcase.delivery
    for (const group of deliveryGroups) {
      assert.equal(typeof delivery[group].items, 'object', `${group} items must exist`)
    }
    assert.deepEqual(
      Object.keys(delivery.text.items),
      ['item'],
      'the text campaign item must be available through the same items contract as the other delivery groups',
    )
  }
})

test('First creation entry follows the selected market instead of rendering Portuguese copy', () => {
  assert.match(firstCreation, /useLocale/)
  for (const key of ['title', 'cta', 'explorePrefix', 'exploreSuffix']) {
    assert.match(firstCreation, new RegExp(`landing\\.firstCreation\\.${key}`))
  }
  for (const copy of ['Crie seu primeiro anúncio imobiliário.', 'Criar agora grátis', 'Prefere conhecer a plataforma primeiro?', 'Continue abaixo.']) assert.doesNotMatch(firstCreation, new RegExp(copy))
  for (const copy of ['Create your first real estate listing.', 'Create now for free', 'Would you rather get to know the platform first?', 'Keep scrolling.']) assert.ok(enUS.includes(copy), copy)
  for (const copy of ['Crie seu primeiro anúncio imobiliário.', 'Criar agora grátis', 'Prefere conhecer a plataforma primeiro?', 'Continue abaixo.']) assert.ok(ptBR.includes(copy), copy)
})

test('US text campaign demo uses US terminology and location', () => {
  for (const copy of ['Tampa, Florida', '990 sq ft', '#TampaRealEstate', '#FloridaRealEstate', 'Social media']) assert.ok(enUSLandingCatalog.includes(copy), copy)
  for (const copy of ['Moema', 'm²', 'Redes sociais', '#RealEstateSP']) assert.doesNotMatch(enUSLandingCatalog, new RegExp(copy))
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

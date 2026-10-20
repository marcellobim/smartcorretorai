import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(frontendRoot, relativePath), 'utf8')

const dashboard = read('src/pages/Dashboard.jsx')
const product = read('src/pages/HeroNext.jsx')
const recovery = read('src/lib/hero-next-recovery.js')
const showcase = read('src/components/hero/HeroShowcase.jsx')
const landing = read('src/pages/LandingPage.jsx')
const messages = read('src/i18n/messages/pt-BR.js')
const landingHero = landing.slice(landing.indexOf('function Hero()'), landing.indexOf('function PositioningStrip()'))
const publicEntryPoints = [
  dashboard,
  product,
  showcase,
  read('src/pages/HomeFrankenstein.jsx'),
  read('src/pages/HomeOpusExperiment.jsx'),
  read('src/pages/MeusImoveis.jsx'),
  read('src/pages/NovaCampanha.jsx'),
  read('src/pages/TransformarVideo.jsx'),
  read('src/pages/Planos.jsx'),
]

test('uses the configured Snetia Space name while keeping the technical copy localized', () => {
  assert.match(read('src/pages/VirtualStaging.jsx'), /VIRTUAL_STAGING_PRODUCT_NAME/)
  assert.match(dashboard, /description: VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(messages, /smartSpace: Object\.freeze\(/)
})

test('uses the approved Banner Imobiliário communication on Dashboard', () => {
  assert.match(dashboard, /id: 'hero-ia'[\s\S]*?title: t\('dashboard\.actions\.realEstateBanner\.title'\)/)
  assert.match(dashboard, /t\('dashboard\.actions\.realEstateBanner\.description'\)/)
  assert.match(dashboard, /to: '\/hero'/)
  assert.match(dashboard, /label: t\('dashboard\.actions\.realEstateBanner\.label'\)/)
  assert.match(messages, /realEstateBanner: Object\.freeze\(\{ title: 'Banner Imobiliário', description: 'Crie uma peça visual profissional para destacar o imóvel em anúncios e redes sociais\.', label: 'Criar Banner'/)
})

test('uses the approved name and description throughout the active product', () => {
  assert.match(product, /<Header title=\{b\('productName'\)\}/)
  assert.match(messages, /productName: 'Banner Imobiliário'/)
  assert.match(recovery, /sourceProduct: 'Banner Imobiliário'/)
  assert.match(showcase, /produzidos pelo Banner Imobiliário/)
})

test('removes legacy Hero IA communication from every public entry point in scope', () => {
  for (const source of publicEntryPoints) {
    assert.doesNotMatch(source, /\bHero IA\b|Criar Hero/)
  }
})

test('landing hero uses the active localized headline and distribution copy', () => {
  for (const key of ['eyebrow', 'title', 'description', 'distribution']) {
    assert.match(landingHero, new RegExp(`t\\('landing\\.hero\\.${key}'\\)`))
  }
  assert.doesNotMatch(landingHero, /(?:200|400) Smart Tokens/i)
})

test('landing hero preserva estrutura responsiva, CTAs, trial e mídia', () => {
  assert.match(landingHero, /\[text-wrap:balance\]/)
  assert.match(landingHero, /sm:text-5xl/)
  assert.match(landingHero, /sm:flex-row/)
  assert.match(landingHero, /t\('landing\.hero\.description'\)/)
  assert.match(landingHero, /t\('landing\.hero\.distribution'\)/)
  assert.match(landingHero, /t\('landing\.trial\.banner'\)/)
  assert.match(landingHero, /t\('landing\.trial\.virtualStaging'\)/)
  assert.doesNotMatch(landingHero, /(?:200|400) Smart Tokens/i)
  assert.match(landingHero, /localizedHeroProductSlides\(t\)/)
  assert.match(landingHero, /slides\.map/)
  assert.match(landingHero, /<HeroMedia slide=\{slide\} active=\{active\} \/>/)
})

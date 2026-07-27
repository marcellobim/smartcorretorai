import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const officialDescription = 'Nossa IA transforma as fotos e informações do imóvel em banners profissionais, prontos para divulgar seus imóveis com mais impacto.'

const dashboard = read('src/pages/Dashboard.jsx')
const product = read('src/pages/HeroNext.jsx')
const showcase = read('src/components/hero/HeroShowcase.jsx')
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

test('uses the approved Banner Imobiliário communication on Dashboard', () => {
  assert.match(dashboard, /id: 'hero-ia'[\s\S]*?title: 'Banner Imobiliário'/)
  assert.ok(dashboard.includes(officialDescription))
  assert.match(dashboard, /to: '\/hero'/)
  assert.match(dashboard, /label: 'Criar Banner'/)
})

test('uses the approved name and description throughout the active product', () => {
  assert.match(product, /<Header title="Banner Imobiliário"/)
  assert.ok(product.includes(officialDescription))
  assert.match(product, /sourceProduct: 'Banner Imobiliário'/)
  assert.match(showcase, /produzidos pelo Banner Imobiliário/)
})

test('removes legacy Hero IA communication from every public entry point in scope', () => {
  for (const source of publicEntryPoints) {
    assert.doesNotMatch(source, /\bHero IA\b|Criar Hero/)
  }
})

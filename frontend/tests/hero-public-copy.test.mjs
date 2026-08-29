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

test('uses the approved Smart Space descriptions on the hero and Home card', () => {
  assert.ok(read('src/pages/VirtualStaging.jsx').includes('Transforme ambientes, mostre novas possibilidades e apresente seus imóveis de forma mais envolvente com inteligência artificial.'))
  assert.ok(dashboard.includes('Transforme ambientes e mostre novas possibilidades para cada espaço.'))
})

test('uses the approved Banner Imobiliário communication on Dashboard', () => {
  assert.match(dashboard, /id: 'hero-ia'[\s\S]*?title: 'Banner Imobiliário'/)
  assert.ok(dashboard.includes('Crie uma peça visual profissional para destacar o imóvel em anúncios e redes sociais.'))
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

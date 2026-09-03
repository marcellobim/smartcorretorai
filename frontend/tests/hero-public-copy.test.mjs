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
const recovery = read('src/lib/hero-next-recovery.js')
const showcase = read('src/components/hero/HeroShowcase.jsx')
const landing = read('src/pages/LandingPage.jsx')
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
  assert.match(recovery, /sourceProduct: 'Banner Imobiliário'/)
  assert.match(showcase, /produzidos pelo Banner Imobiliário/)
})

test('removes legacy Hero IA communication from every public entry point in scope', () => {
  for (const source of publicEntryPoints) {
    assert.doesNotMatch(source, /\bHero IA\b|Criar Hero/)
  }
})

test('landing hero comunica publicação direta somente no Instagram e Facebook', () => {
  assert.ok(landingHero.includes('Crie vídeos, imagens e campanhas para vender, alugar e captar imóveis ou profissionais.'))
  assert.ok(landingHero.includes('publique diretamente'))
  assert.ok(landingHero.includes('no Instagram e Facebook, em poucos passos.'))
  assert.ok(landingHero.includes('Crie, revise e publique sem sair do SmartCorretorAI.'))
  assert.doesNotMatch(landingHero, /publicação automática|agendamento|TikTok|LinkedIn|YouTube/i)
})

test('landing hero preserva estrutura responsiva, CTAs, trial e mídia', () => {
  assert.match(landingHero, /\[text-wrap:balance\]/)
  assert.match(landingHero, /sm:text-5xl/)
  assert.match(landingHero, /sm:flex-row/)
  assert.match(landingHero, /bg-gradient-to-r from-violet-400 to-fuchsia-400[\s\S]*?publique diretamente/)
  assert.ok(landingHero.includes('Experimentar grátis'))
  assert.ok(landingHero.includes('Ver tudo o que posso criar'))
  assert.ok(landingHero.includes('Comece grátis com 200 Smart Tokens após confirmar seu e-mail. Sem cartão.'))
  assert.match(landingHero, /HERO_PRODUCT_SLIDES\.map/)
  assert.match(landingHero, /<HeroMedia slide=\{slide\} active=\{active\} \/>/)
})

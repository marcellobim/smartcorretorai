import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'

const page = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')

test('Real Estate Video opens directly into its concise guided workflow', () => {
  assert.match(page, /<ProductHero/)
  assert.doesNotMatch(page.slice(page.indexOf('return <>'), page.indexOf('function SmartTourGuide')), /<SmartTourShowcase \/>/)
  assert.doesNotMatch(page.slice(page.indexOf('return <>'), page.indexOf('function SmartTourGuide')), /<SmartTourGuide \/>/)
  assert.match(page, /Choose your video style/)
  assert.match(page, /Escolha o estilo do vídeo/)
  assert.match(page, /headline=\{t\('smartTour\.headerSubtitle'\)\}/)
  const creationView = page.slice(page.indexOf('const measureFields'), page.indexOf('function SmartTourShowcase'))
  assert.doesNotMatch(creationView, /<Header title=\{SMART_TOUR_PRODUCT_NAME\} subtitle=/)
})

test('Real Estate Video keeps the approved concise BR and US copy', () => {
  assert.equal(ptBR.smartTour.productName, 'Vídeo Imobiliário')
  assert.equal(ptBR.smartTour.headerSubtitle, 'Transforme fotos do imóvel em um vídeo profissional.')
  assert.equal(ptBR.smartTour.heroDescription, 'Crie um vídeo pronto para divulgar em um fluxo guiado e simples.')
  assert.equal(enUS.smartTour.productName, 'Real Estate Video')
  assert.equal(enUS.smartTour.headerSubtitle, 'Turn property photos into professional video marketing.')
  assert.equal(enUS.smartTour.heroDescription, 'Create a ready-to-share property video in a guided workflow.')
})

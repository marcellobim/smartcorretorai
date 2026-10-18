import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ptBR from '../src/i18n/messages/pt-BR.js'
import enUS from '../src/i18n/messages/en-US.js'

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const studio = read('pages/StudioHero.jsx')
const banner = read('pages/HeroNext.jsx')
const carousel = read('pages/SmartCarrossel.jsx')

test('Banner uses a concise localized ProductHero before its main question', () => {
  assert.match(banner, /const bannerIntro = isUSMarket/)
  assert.match(banner, /Turn property photos and details into ready-to-share marketing visuals\./)
  assert.match(banner, /Transforme fotos e informações do imóvel em peças prontas para divulgação\./)
  assert.match(banner, /<ProductHero/)
})

test('AI Studio retains its three operational modes with concise localized copy', () => {
  assert.equal(ptBR.studio.landing.title, 'AI Studio')
  assert.equal(ptBR.studio.landing.description, 'Crie comerciais imobiliários, vídeos criativos e carrosséis de anúncios em minutos com IA.')
  assert.equal(enUS.studio.landing.title, 'AI Studio')
  assert.equal(enUS.studio.landing.description, 'Create real estate commercials, creative videos, and ad carousels in minutes with AI.')
  for (const key of ['studio.mode.commercial', 'studio.mode.creative', 'studio.mode.carousel']) assert.match(studio, new RegExp(key.replaceAll('.', '\\.')))
})

test('AI Studio uses one localized title and no longer renders a separate top demonstration', () => {
  assert.match(studio, /productName=\{t\('studio\.landing\.title'\)\}/)
  assert.match(studio, /description=\{t\('studio\.landing\.description'\)\}/)
  assert.doesNotMatch(studio, /Studio IA/)
  assert.doesNotMatch(studio, /StudioHeroRepresentativePhone|STUDIO_HERO_REPRESENTATIVE_VIDEO/)
  assert.match(studio, /VISIBLE_STUDIO_MODE_EXAMPLES\.map/)
  assert.match(studio, /VISIBLE_STUDIO_CREATION_MODES\.map/)
})

test('Studio and Ad Carousel keep shared design-system components and routes', () => {
  for (const component of ['ProductHero', 'ProductButton', 'ProductCard', 'ProductSectionHeading']) assert.match(studio, new RegExp(`<${component}`))
  assert.match(studio, /VISIBLE_STUDIO_CREATION_MODES/)
  assert.match(carousel, /<ProductHero/)
  assert.match(carousel, /<GuidedConversation/)
})

test('AI Studio continues without the removed examples gallery', () => {
  assert.doesNotMatch(studio, /StudioGalleryInvitation|StudioPossibilitiesShowcase|STUDIO_POSSIBILITY_EXAMPLES|studio-galeria/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ptBRMessages from '../src/i18n/messages/pt-BR.js'
import enUSMessages from '../src/i18n/messages/en-US.js'

const landing = readFileSync(new URL('../src/pages/LandingPage.jsx', import.meta.url), 'utf8')

test('uses the final Landing sequence without a generic first-creation section', () => {
  const sequence = ['<Hero />', '<VirtualStagingSpotlight />', '<RealEstateBannerSpotlight />', '<PositioningStrip />', '<BenefitsSection />', '<DeliveryShowcase />', '<TextCampaignSection />', '<HowItWorks />', '<DistributionSection />', '<TokensSection />', '<FaqSection />']
  let previous = -1
  for (const item of sequence) {
    const index = landing.lastIndexOf(item)
    assert.ok(index > previous, `${item} must follow the final Landing sequence`)
    previous = index
  }
  assert.doesNotMatch(landing, /FirstCreationEntry/)
})

test('keeps Snetia Space then Real Estate Banner as the first visual product blocks', () => {
  assert.match(landing, /function VirtualStagingSpotlight/)
  assert.match(landing, /function RealEstateBannerSpotlight/)
  assert.match(landing, /ctaTo="\/criar-anuncio"/)
  assert.match(landing, /VIRTUAL_STAGING_PHONE_SEQUENCES\(t\)\.map/)
})

test('uses only the approved Banner and Virtual Staging trial CTAs in the Hero', () => {
  const hero = landing.slice(landing.indexOf('function Hero()'), landing.indexOf('function PositioningStrip'))
  assert.match(hero, /to="\/criar-anuncio"/)
  assert.match(hero, /to="\/virtual-staging"/)
  assert.match(hero, /landing\.trial\.banner/)
  assert.match(hero, /landing\.trial\.virtualStaging/)
  assert.doesNotMatch(hero, /href="#produtos"/)
})

test('contains the approved final Hero and distribution copy in both markets', () => {
  const expected = [
    [ptBRMessages, 'Crie e publique diretamente no Instagram e Facebook. Envie seu conteúdo para o TikTok em poucos passos.'],
    [enUSMessages, 'Create and publish directly to Instagram and Facebook. Send your content to TikTok in just a few steps.'],
  ]
  for (const [messages, value] of expected) assert.ok(JSON.stringify(messages.landing).includes(value))
  assert.equal(enUSMessages.landing.distribution.instagram, 'Direct publish')
  assert.equal(enUSMessages.landing.distribution.facebook, 'Direct publish')
  assert.equal(enUSMessages.landing.distribution.tiktok, 'Send to TikTok')
})

test('keeps recruiting out of Landing highlights and avoids new media assets', () => {
  const realUses = landing.slice(landing.indexOf('const REAL_USES'), landing.indexOf('const IMAGE_SHOWCASE_EXAMPLES'))
  assert.doesNotMatch(realUses, /professionalRecruiting/)
  assert.match(landing, /IMAGE_SHOWCASE_EXAMPLES = \(market = 'BR'\)/)
})

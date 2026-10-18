import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ptBRMessages from '../src/i18n/messages/pt-BR.js'
import enUSMessages from '../src/i18n/messages/en-US.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const landing = readFileSync(path.join(frontendRoot, 'src/pages/LandingPage.jsx'), 'utf8')

test('uses the approved compact Landing sequence without duplicating the first-creation entry', () => {
  const sequence = [
    '<Hero />',
    '<VirtualStagingSpotlight />',
    '<DeliveryShowcase />',
    '<PositioningStrip />',
    '<TextCampaignSection />',
    '<HowItWorks />',
    '<DistributionSection />',
    '<TokensSection />',
    '<FaqSection />',
  ]
  let previous = -1
  for (const item of sequence) {
    const index = landing.lastIndexOf(item)
    assert.ok(index > previous, `${item} must follow the approved Landing sequence`)
    previous = index
  }
  assert.doesNotMatch(landing, /FirstCreationEntry/)
  assert.match(landing, /groups\.filter\(group => group\.id !== 'textos-campanhas'\)/)
})

test('places the existing Snetia Space before-and-after spotlight directly after the Hero', () => {
  assert.match(landing, /function VirtualStagingSpotlight/)
  assert.match(landing, /VIRTUAL_STAGING_PHONE_SEQUENCES\(t\)\.map/)
  assert.match(landing, /VIRTUAL_STAGING_PRODUCT_DESCRIPTOR/)
  assert.match(landing, /to="\/virtual-staging"/)
  assert.equal((landing.match(/before: '\/virtual-staging\//g) || []).length, 7)
  assert.equal((landing.match(/after: '\/virtual-staging\//g) || []).length, 7)
})

test('uses the finalized hero, virtual staging, positioning, distribution, and future-trial copy in both markets', () => {
  const expected = {
    BR: {
      hero: ['Crie marketing imobiliário pronto para publicar.', 'Vídeos, virtual staging, banners, carrosséis e textos em um único fluxo simples.', 'Publique no Instagram e Facebook. Envie para o TikTok.'],
      staging: ['Snetia Space', 'Virtual Staging', 'Transforme ambientes vazios ou desatualizados com virtual staging por IA em poucos cliques.', 'Testar Virtual Staging grátis'],
      positioning: ['Use o mesmo imóvel. Crie novas formas de divulgar.', 'Transforme fotos e informações em vídeos, banners, carrosséis e textos.', 'Um imóvel. Várias formas de divulgar.'],
      distribution: ['Publicação direta', 'Enviar para o TikTok'],
      trial: ['Criar Banner grátis', 'Testar Virtual Staging grátis'],
    },
    US: {
      hero: ['Create real estate marketing that’s ready to publish.', 'Videos, staging, banners, carousels and copy — all from one simple workflow.', 'Publish to Instagram and Facebook. Send to TikTok.'],
      staging: ['Snetia Space', 'Virtual Staging', 'Transform empty or outdated rooms with AI-powered virtual staging in just a few clicks.', 'Try Virtual Staging free'],
      positioning: ['Use the same property. Create more ways to market it.', 'Turn your photos and property details into videos, banners, carousels and copy.', 'One property. Multiple ways to promote it.'],
      distribution: ['Direct publish', 'Send to TikTok'],
      trial: ['Create a free Real Estate Banner', 'Try Virtual Staging free'],
    },
  }

  for (const [market, messages] of [['BR', ptBRMessages], ['US', enUSMessages]]) {
    for (const value of Object.values(expected[market]).flat()) assert.ok(JSON.stringify(messages.landing).includes(value), `${market}: ${value}`)
  }
})

test('keeps recruiting out of the Landing highlights and does not offer Real Estate Video as the free-trial entry', () => {
  const realUses = landing.slice(landing.indexOf('const REAL_USES'), landing.indexOf('const IMAGE_SHOWCASE_EXAMPLES'))
  const delivery = landing.slice(landing.indexOf('function DeliveryShowcase'), landing.indexOf('function VirtualStagingPhone'))
  assert.doesNotMatch(realUses, /professionalRecruiting/)
  assert.doesNotMatch(delivery, /uses\.professionals/)
  assert.match(landing, /landing\.trial\.exploreProducts/)
  assert.match(landing, /landing\.trial\.banner/)
  assert.match(landing, /landing\.trial\.virtualStaging/)
})

test('preserves responsive controls, existing demos, and market-aware content without changing media assets', () => {
  for (const source of [ptBRMessages, enUSMessages]) {
    assert.equal(typeof source.landing.showcase.delivery.videos.items, 'object')
    assert.equal(typeof source.landing.showcase.delivery.images.items, 'object')
    assert.equal(typeof source.landing.showcase.delivery.text.items, 'object')
  }
  assert.match(landing, /id="landing-mobile-menu"/)
  assert.match(landing, /md:hidden/)
  assert.match(landing, /lg:grid-cols/)
  assert.match(landing, /HERO_ROTATION_INTERVAL_MS = 5200/)
  assert.match(landing, /IMAGE_SHOWCASE_EXAMPLES = \(market = 'BR'\)/)
  assert.match(landing, /VIRTUAL_STAGING_PHONE_SEQUENCES/)
})

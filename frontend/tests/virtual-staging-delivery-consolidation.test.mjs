import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildVirtualStagingCampaignPackage } from '../src/components/campaign/buildVirtualStagingCampaignPackage.js'

const page = readFileSync(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')
const pt = readFileSync(new URL('../src/i18n/messages/pt-BR.js', import.meta.url), 'utf8')
const en = readFileSync(new URL('../src/i18n/messages/en-US.js', import.meta.url), 'utf8')

const property = {
  purpose: 'sale', stage: 'ready', type: 'Apartamento', city: 'Tampa', state: 'Florida',
  bedrooms: '3', suites: '2', parkingSpaces: '2', highlights: ['gated_community'],
}

test('Virtual Staging resolve hashtags úteis por mercado sem herdar branding legado', () => {
  const us = buildVirtualStagingCampaignPackage({ property, language: 'en-US', journeyId: 'furnish-renovate' })
  const br = buildVirtualStagingCampaignPackage({ property, language: 'pt-BR', journeyId: 'furnish-renovate' })
  const usTags = us.aiCampaigns[0].hashtags
  const brTags = br.aiCampaigns[0].hashtags
  assert.ok(usTags.includes('#SNETIA'))
  assert.ok(usTags.includes('#VirtualStaging'))
  assert.ok(usTags.includes('#RealEstate'))
  assert.equal(usTags.some(tag => /SmartCorretorAI|Apartamento|Dormitorios/i.test(tag)), false)
  assert.ok(brTags.includes('#SNETIA'))
  assert.ok(brTags.includes('#VirtualStaging'))
  assert.equal(brTags.some(tag => /SmartCorretorAI/i.test(tag)), false)
})

test('status e entrega usam o nome específico de cada módulo em BR e US', () => {
  for (const catalog of [pt, en]) {
    assert.match(catalog, /Creating your Virtual Staging|Criando seu Virtual Staging/)
    assert.match(catalog, /Creating your Life in the Property|Criando seu Vida no Imóvel/)
    assert.match(catalog, /Creating your Agent Presentation|Criando sua Apresentação pelo Corretor/)
    assert.match(catalog, /other SNETIA products|outros produtos da SNETIA/)
  }
  assert.match(page, /smartSpaceModuleCopy\(t, journey\.id, key\)/)
})

test('Social prepara overlays e Portal mantém uma entrega limpa', () => {
  assert.match(page, /const videoMarketing = \{[\s\S]*caption:[\s\S]*cta:[\s\S]*professionalIdentity:/)
  assert.match(page, /delivery_metadata: videoMarketing/)
  assert.match(page, /const isSocial = socialOptions\?\.destination === 'social'/)
  assert.match(page, /supportedNetworks=\{\['tiktok'\]\}/)
})

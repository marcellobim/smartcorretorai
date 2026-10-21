import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildVirtualStagingCampaignPackage, buildVirtualStagingConsolidatedNarration } from '../src/components/campaign/buildVirtualStagingCampaignPackage.js'

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

test('entrega Social preserva a legenda literal e injeta hashtags contextuais no pacote compartilhado', () => {
  const usPackage = buildVirtualStagingCampaignPackage({ property, language: 'en-US', journeyId: 'furnish-renovate' })
  const brPackage = buildVirtualStagingCampaignPackage({ property: { ...property, type: 'Apartamento', city: 'São Paulo', state: 'SP' }, language: 'pt-BR', journeyId: 'furnish-renovate' })
  for (const campaign of [usPackage, brPackage]) {
    const hashtags = campaign.aiCampaigns[0].hashtags.join(' ')
    assert.match(hashtags, /#SNETIA/)
    assert.match(hashtags, /#VirtualStaging/)
    assert.notEqual(hashtags, '#SNETIA')
    assert.doesNotMatch(hashtags, /SmartCorretorAI/)
  }
  assert.match(page, /virtual_staging_hashtags/)
  assert.match(page, /social_caption: \{ label: 'Instagram \/ Facebook', text: caption \}/)
  assert.match(page, /hasSocialCaptionPropertyData\(property\)/)
  assert.match(page, /campaignHashtags=\{furnishDeliveryMetadata\.hashtags\}/)
  assert.match(page, /hashtags: campaignHashtags/)
  assert.match(page, /setFurnishDeliveryMetadata\(data\.request\?\.delivery_metadata/)
})

test('narração consolidada usa somente contexto estruturado e respeita BR/US', () => {
  const us = buildVirtualStagingConsolidatedNarration({ property, language: 'en-US' })
  const br = buildVirtualStagingConsolidatedNarration({ property: { ...property, city: 'São Paulo', state: 'SP' }, language: 'pt-BR' })
  assert.equal(us, 'See how Virtual Staging transforms this apartment for sale in Tampa, Florida and reveals its potential.')
  assert.equal(br, 'Veja como o Virtual Staging transforma este apartamento à venda em São Paulo, SP e revela seu potencial.')
  assert.doesNotMatch(us, /SNETIA|Schedule|contact/i)
  assert.doesNotMatch(br, /Agende|contato/i)
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
  assert.match(page, /const videoMarketing = \{[\s\S]*locale: draftLocale,[\s\S]*caption:[\s\S]*cta:[\s\S]*professionalIdentity:[\s\S]*phone: socialOptions\.phone && includePhone \? phone : '',[\s\S]*hashtags: campaignHashtags,[\s\S]*narration: buildVirtualStagingConsolidatedNarration/)
  assert.match(page, /delivery_metadata: videoMarketing/)
  assert.match(page, /const isSocial = socialOptions\?\.destination === 'social'/)
  assert.match(page, /supportedNetworks=\{\['tiktok'\]\}/)
})

test('entrega nomeia o vídeo consolidado e mantém download e compartilhamento existentes', () => {
  assert.match(page, /Complete Transformation Video/)
  assert.match(page, /Vídeo completo da transformação/)
  assert.match(page, /Download campaign video/)
  assert.match(page, /<SharePublishActions media=\{\[\{ url: consolidatedVideo\.signedUrl/)
})

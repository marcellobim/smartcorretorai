import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildGoogleAdsDelivery, validateGoogleAdsDelivery } from '../../supabase/functions/_shared/google-ads.ts'
import { buildPublicationGoogleAds, buildPublicationPackage } from '../../core/copy-engine/index.ts'
import { buildCampaignPackage } from '../src/components/campaign/buildCampaignPackage.js'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'
import { buildVirtualStagingCampaignPackage } from '../src/components/campaign/buildVirtualStagingCampaignPackage.js'

const root = new URL('../../', import.meta.url)
const source = async path => readFile(new URL(path, root), 'utf8')
const property = {
  purpose: 'sale', type: 'Apartamento', district: 'Lapa', city: 'São Paulo', state: 'SP',
  bedrooms: '3', suites: '2', parkingSpaces: '2', area: '110', price: '',
  description: 'Apartamento pronto para morar.', highlights: ['churrasqueira', 'varanda'],
}

const assertContract = (googleAds, cta = 'Agende sua visita') => {
  assert.deepEqual(validateGoogleAdsDelivery(googleAds, { expectedCta: cta }), googleAds)
  assert.ok(googleAds.headlines.length >= 2 && googleAds.headlines.length <= 6)
  assert.ok(googleAds.headlines.every(item => item.length <= 30))
  assert.ok(googleAds.long_headline.length <= 90)
  assert.ok(googleAds.descriptions.length >= 2 && googleAds.descriptions.length <= 4)
  assert.ok(googleAds.descriptions.every(item => item.length <= 90))
  assert.ok(googleAds.suggested_keywords.length >= 3 && googleAds.suggested_keywords.length <= 8)
  assert.ok(googleAds.suggested_keywords.every(item => item.length <= 80))
  assert.ok(googleAds.suggested_keywords.some(item => /apartamento.*(venda|comprar).*(lapa)/i.test(item)))
  assert.ok(googleAds.suggested_keywords.some(item => /apartamento.*(3 dormitórios|2 suítes|churrasqueira).*lapa/i.test(item)))
}

test('canonical Google Ads delivery preserves CTA, limits, facts and real-estate intent', () => {
  const googleAds = buildGoogleAdsDelivery({ ...property, propertyType: property.type, cta: 'Agende sua visita' })
  assertContract(googleAds)
  assert.equal(googleAds.cta, 'Agende sua visita')
  assert.doesNotMatch(JSON.stringify(googleAds), /cpc|volume de pesquisa|concorrência|ranking|previsão de tráfego/i)
})

test('CampaignPackage appends Google Ads after existing text modules and accepts legacy results', () => {
  const googleAds = buildGoogleAdsDelivery({ ...property, propertyType: property.type, cta: 'Agende sua visita' })
  const base = {
    mediaType: 'video', purpose: property.purpose, propertyType: property.type, district: property.district,
    city: property.city, state: property.state, bedrooms: property.bedrooms, suites: property.suites,
    highlights: property.highlights, cta: 'Agende sua visita',
    existingTexts: [{ id: 'social', label: 'Instagram', text: 'Texto atual preservado.' }],
  }
  const current = buildCampaignPackage({ ...base, googleAds })
  assert.equal(current.modules.at(-1).title, 'Google Ads')
  assert.deepEqual(current.modules.at(-1).fields.map(field => field.label), ['Títulos', 'Título longo', 'Descrições', 'CTA', 'Palavras-chave sugeridas'])
  assert.equal(current.modules[0].fields[0].text, 'Texto atual preservado.')
  const legacy = buildCampaignPackage(base)
  assert.equal(legacy.modules.some(module => module.id === 'google-ads'), false)
})

test('Vídeo Imobiliário and Short Videos receive the additional block from their shared package builder', () => {
  const built = buildSmartTourCampaignPackage({ property, language: 'pt-BR', cta: 'Agende sua visita', phone: '' })
  assert.equal(built.aiCampaigns.length, 3)
  assertContract(built.googleAds)
  assert.equal(buildCampaignPackage(built).modules.at(-1).title, 'Google Ads')
})

test('Vida no Imóvel and Apresentação pelo Corretor receive the block without changing their shared media package', () => {
  const built = buildVirtualStagingCampaignPackage({ property, language: 'pt-BR', cta: 'Agende sua visita', phone: '' })
  assert.equal(built.mediaType, 'video')
  assert.equal(built.aiCampaigns.length, 3)
  assertContract(built.googleAds)
  assert.equal(buildCampaignPackage(built).modules.at(-1).title, 'Google Ads')
})

test('Banner Imobiliário and both eligible Studio modes use the shared copy-engine contract', async () => {
  const input = {
    objective: 'sale', propertyType: property.type, district: property.district, city: property.city,
    bedrooms: property.bedrooms, suites: property.suites, features: property.highlights, cta: 'Agende sua visita',
  }
  assert.equal(buildPublicationPackage(input).length, 8)
  assertContract(buildPublicationGoogleAds(input))
  const hero = await source('frontend/src/pages/HeroNext.jsx')
  const studio = await source('frontend/src/pages/StudioHero.jsx')
  assert.match(hero, /googleAds: buildPublicationGoogleAds\(buildHeroNextCopyInput/)
  assert.equal((studio.match(/googleAds,/g) || []).length, 2)
})

test('Banners Rápidos and Smart Carrossel consume Google Ads from their existing provider response', async () => {
  const quickPage = await source('frontend/src/pages/NovaCampanha.jsx')
  const quickBackend = await source('supabase/functions/gerar-campanha/index.ts')
  const carouselPage = await source('frontend/src/pages/SmartCarrossel.jsx')
  const carouselBackend = await source('supabase/functions/smart-carousel-creatomate/index.ts')
  assert.match(quickPage, /googleAds: tg\.google_ads/)
  assert.match(quickPage, /google_ads: \['GOOGLE ADS', null\]/)
  assert.match(quickPage, /formatGoogleAdsDelivery\(dados\)/)
  assert.match(quickBackend, /validateGoogleAdsDelivery\(textos_gerados\.google_ads/)
  assert.equal((quickBackend.match(/api\.openai\.com\/v1\/chat\/completions/g) || []).length, 1)
  assert.match(carouselPage, /googleAds: campaignPackage\?\.google_ads/)
  assert.match(carouselBackend, /google_ads: presentationPlan\.googleAds/)
  assert.equal((carouselBackend.match(/api\.openai\.com\/v1\/chat\/completions/g) || []).length, 2)
})

test('Virtual Staging de imagens remains outside Google Ads and media engines remain untouched', async () => {
  const virtualStaging = await source('frontend/src/pages/VirtualStaging.jsx')
  const delivery = virtualStaging.slice(virtualStaging.indexOf('function FurnishRenovateDelivery'), virtualStaging.indexOf('export default function VirtualStaging'))
  const imageBackend = await source('supabase/functions/virtual-staging-image-test/index.ts')
  assert.doesNotMatch(delivery, /Google Ads|googleAds|google_ads/)
  assert.doesNotMatch(imageBackend, /Google Ads|googleAds|google_ads/)
  assert.match(imageBackend, /OPENAI_API_KEY/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'

const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const page = read('pages/SmartTourAI.jsx')
const packageView = read('components/campaign/CampaignPackage.jsx')
const textCampaign = read('components/text-campaign/TextCampaignResult.jsx')
const enUS = read('i18n/messages/en-US.js')
const ptBR = read('i18n/messages/pt-BR.js')
const property = {
  purpose: 'sale',
  type: 'Apartamento',
  district: 'Downtown',
  city: 'Tampa',
  state: 'FL',
  bedrooms: 2,
  suites: 1,
  parkingSpaces: 1,
  area: 70,
  highlights: ['Balcony'],
  description: 'Historic description in Portuguese stays historic.',
  price: '$750,000',
}

test('Real Estate Video passes a current-locale delivery contract to the shared delivery UI', () => {
  for (const section of ['download', 'preview', 'media', 'result', 'actions', 'campaign', 'social', 'accessibility', 'delivery']) {
    assert.match(page, new RegExp(`deliveryUiLabels = \\{[\\s\\S]*?${section}:`))
  }
  assert.match(page, /uiLabels=\{deliveryUiLabels\}/)
  assert.match(enUS, /packageTitle: 'Campaign Package'/)
  assert.match(enUS, /ready: 'Your campaign is ready\.'/)
  assert.match(enUS, /generatedMedia: 'Generated media'/)
  assert.match(enUS, /presentation: 'Your presentation'/)
  assert.match(ptBR, /packageTitle: 'Pacote da Campanha'/)
  assert.match(ptBR, /ready: 'Sua campanha está pronta\.'/)
})

test('shared delivery localizes system labels without rewriting saved campaign text', () => {
  assert.match(packageView, /const \{ t \} = useLocale\(\)/)
  assert.match(packageView, /mergeCampaignPackageLabels\(campaignPackageLabels\(t\), uiLabels\)/)
  assert.match(packageView, /campaignModuleLabel\(module, labels\)/)
  assert.match(packageView, /campaignFieldLabel\(module, field, fieldIndex, labels\)/)
  assert.match(packageView, /\{field\.text\}/)
  assert.match(packageView, /Array\.isArray\(data\?\.strategy\) && data\.strategy\.length > 0/)
  assert.match(packageView, /labels\.delivery\.strategy/)
  assert.match(page, /latest\.publicationOptions\.map\(\(option, index\) => \(\{/)
  assert.match(page, /instagram: option\.text/)
})

test('new Real Estate Video campaign copy follows its requested locale', () => {
  const us = buildSmartTourCampaignPackage({ property, language: 'en-US', cta: 'Agende sua visita', phone: '' })
  const br = buildSmartTourCampaignPackage({ property, language: 'pt-BR', cta: 'Agende sua visita', phone: '' })

  assert.match(us.aiCampaigns[0].instagram, /Discover apartment for sale in Downtown, Tampa, FL/)
  assert.match(us.aiCampaigns[0].instagram, /Schedule your visit/)
  assert.doesNotMatch(us.aiCampaigns[0].instagram, /Conheça|Agende sua visita/)
  assert.match(br.aiCampaigns[0].instagram, /Conheça apartamento à venda em Downtown, Tampa, FL/)
  assert.match(br.aiCampaigns[0].instagram, /Agende sua visita/)
  assert.match(page, /language: market === 'US' \? 'en-US' : 'pt-BR'/)
  assert.match(page, /language:apiGeneration\.language/)
})

test('Text Campaign remains isolated and keeps historical campaign bodies intact', () => {
  assert.match(textCampaign, /useLocale\(\)/)
  assert.match(textCampaign, /formatTextCampaignPiece\(editableCampaign, id, locale\)/)
  assert.doesNotMatch(textCampaign, /CampaignPackage/)
})

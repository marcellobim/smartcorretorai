import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficialHashtags } from '../../supabase/functions/_shared/official-hashtags.ts'
import { buildCampaignPackage } from '../src/components/campaign/buildCampaignPackage.js'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'

const assertOfficialSet = (hashtags) => {
  assert.ok(hashtags.length >= 12 && hashtags.length <= 15)
  assert.equal(new Set(hashtags.map((tag) => tag.toLocaleLowerCase('pt-BR'))).size, hashtags.length)
  assert.ok(hashtags.includes('#SmartCorretorAI'))
}

test('sale hashtags use structured context and never contradict the purpose', () => {
  const hashtags = buildOfficialHashtags({
    purpose: 'sale',
    propertyType: 'Apartamento',
    city: 'São Paulo',
    district: 'Moema',
    state: 'SP',
    bedrooms: '3',
    highlights: ['Varanda Gourmet', 'Vista Livre'],
    cta: 'Agende sua visita',
  }, ['#Aluguel', '#Locacao', '#ApartamentoAVenda'])
  assertOfficialSet(hashtags)
  assert.ok(hashtags.includes('#ApartamentoAVenda'))
  assert.ok(hashtags.includes('#SaoPaulo'))
  assert.ok(hashtags.includes('#Moema'))
  assert.ok(hashtags.includes('#VarandaGourmet'))
  assert.ok(hashtags.includes('#AgendeSuaVisita'))
  assert.equal(hashtags.some((tag) => /aluguel|locacao|paraalugar/i.test(tag)), false)
})

test('rental hashtags never contain sale or purchase intent', () => {
  const hashtags = buildOfficialHashtags({
    purpose: 'rent',
    propertyType: 'Casa',
    city: 'Curitiba',
    district: 'Batel',
    highlights: ['Piscina'],
    cta: 'Entre em contato agora',
  }, ['#CasaAVenda', '#Venda', '#ComprarImovel'])
  assertOfficialSet(hashtags)
  assert.ok(hashtags.includes('#CasaParaAlugar'))
  assert.ok(hashtags.includes('#Locacao'))
  assert.ok(hashtags.includes('#Aluguel'))
  assert.equal(hashtags.some((tag) => /avenda|venda|comprar|compra/i.test(tag)), false)
})

test('sparse property context still produces the official range', () => {
  const hashtags = buildOfficialHashtags({ purpose: 'sale', propertyType: 'Imóvel' })
  assertOfficialSet(hashtags)
})

test('Smart Tour and the shared Campaign Central consume the same official engine', () => {
  const smartTour = buildSmartTourCampaignPackage({
    property: { purpose:'rent', type:'Apartamento', city:'Recife', district:'Boa Viagem', state:'PE', highlights:['Vista para o mar'] },
    language: 'pt-BR',
    cta: 'Agende sua visita',
    phone: '',
  })
  for (const campaign of smartTour.aiCampaigns) assertOfficialSet(campaign.hashtags)

  const central = buildCampaignPackage(smartTour)
  const hashtagModule = central.modules.find((module) => module.id === 'hashtags')
  const hashtags = hashtagModule.text.split(/\s+/)
  assertOfficialSet(hashtags)
  assert.equal(hashtags.some((tag) => /avenda|venda|comprar|compra/i.test(tag)), false)
})

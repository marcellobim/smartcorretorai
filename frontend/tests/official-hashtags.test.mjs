import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficialHashtags } from '../../supabase/functions/_shared/official-hashtags.ts'
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

test('apartment without district remains relevant and within the official range', () => {
  const hashtags = buildOfficialHashtags({ purpose:'sale', propertyType:'Apartamento', city:'Salvador', state:'BA' })
  assertOfficialSet(hashtags)
  assert.ok(hashtags.includes('#ApartamentoAVenda'))
  assert.ok(hashtags.includes('#Salvador'))
})

test('highlight accents are removed without producing duplicates', () => {
  const hashtags = buildOfficialHashtags({ purpose:'sale', propertyType:'Apartamento', highlights:['Área de Lazer', 'Area de Lazer', 'Piscina'] })
  assertOfficialSet(hashtags)
  assert.equal(hashtags.filter((tag) => tag === '#AreaDeLazer').length, 1)
  assert.ok(hashtags.includes('#Piscina'))
})

test('Smart Tour consumes the official engine without changing Campaign Central', () => {
  const smartTour = buildSmartTourCampaignPackage({
    property: { purpose:'rent', type:'Apartamento', city:'Recife', district:'Boa Viagem', state:'PE', highlights:['Vista para o mar'] },
    language: 'pt-BR',
    cta: 'Agende sua visita',
    phone: '',
  })
  for (const campaign of smartTour.aiCampaigns) {
    assertOfficialSet(campaign.hashtags)
    assert.equal(campaign.hashtags.some((tag) => /avenda|venda|comprar|compra/i.test(tag)), false)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficialHashtagGroups, buildOfficialHashtags, normalizeOfficialHashtags } from '../../supabase/functions/_shared/official-hashtags.ts'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'

const assertOfficialSet = (hashtags) => {
  assert.ok(hashtags.length >= 12 && hashtags.length <= 15)
  assert.equal(new Set(hashtags.map((tag) => tag.toLocaleLowerCase('pt-BR'))).size, hashtags.length)
  assert.ok(hashtags.includes('#SmartCorretorAI'))
  const brandIndex = hashtags.indexOf('#SmartCorretorAI')
  assert.ok(brandIndex > 0 && brandIndex < hashtags.length - 1)
}

const assertGroupLimits = (groups) => {
  assert.ok(groups.location.length <= 3)
  assert.ok(groups.purpose.length <= 2)
  assert.ok(groups.market.length <= 3)
  assert.ok(groups.characteristics.length <= 4)
  assert.ok(groups.commercialAppeal.length <= 2)
  assert.deepEqual(groups.brand, ['#SmartCorretorAI'])
}

test('sale hashtags use structured context and never contradict the purpose', () => {
  const hashtags = buildOfficialHashtags({
    purpose: 'sale',
    propertyType: 'Apartamento',
    city: 'São Paulo',
    district: 'Moema',
    state: 'SP',
    propertyStage: 'Pronto para morar',
    bedrooms: '3',
    suites: '2',
    highlights: ['Varanda Gourmet', 'Vista Livre'],
    cta: 'Agende sua visita',
  })
  const groups = buildOfficialHashtagGroups({ purpose:'sale', propertyType:'Apartamento', city:'São Paulo', district:'Moema', state:'SP', propertyStage:'Pronto para morar', bedrooms:'3', suites:'2', highlights:['Varanda Gourmet','Vista Livre'], cta:'Agende sua visita' })
  assertOfficialSet(hashtags)
  assertGroupLimits(groups)
  assert.ok(hashtags.includes('#ApartamentoAVenda'))
  assert.ok(hashtags.includes('#SaoPaulo'))
  assert.ok(hashtags.includes('#Moema'))
  assert.ok(hashtags.includes('#VarandaGourmet'))
  assert.ok(hashtags.includes('#AgendeSuaVisita'))
  assert.equal(hashtags.some((tag) => /aluguel|locacao|paraalugar/i.test(tag)), false)
  assert.equal(hashtags.some((tag) => /imovelavenda|vendadeimoveis/i.test(tag)), false)
})

test('normalizes OpenAI output, removes duplicates and limits excessive generic tags', () => {
  const hashtags = normalizeOfficialHashtags([
    '#Imoveis', '#CorretorDeImoveis', '#MercadoImobiliario', '#StudioNoKlabin',
    '#StudioNoKlabin', '#ApartamentoParaAlugar', '#MorarNoKlabin', '#VidaEmSaoPaulo',
    '#KlabinSP', '#SeuNovoEndereco', '#LocacaoSP', '#SmartCorretorAI', '#VistaLivre',
  ], { purpose:'rent', propertyType:'Studio', city:'SÃ£o Paulo', district:'Klabin', state:'SP', highlights:['Vista livre'] })
  assertOfficialSet(hashtags)
  assert.equal(hashtags.filter(tag => ['#Imoveis','#CorretorDeImoveis','#MercadoImobiliario'].includes(tag)).length, 1)
  assert.equal(hashtags.filter(tag => tag === '#StudioNoKlabin').length, 1)
})

test('rental hashtags never contain sale or purchase intent', () => {
  const hashtags = buildOfficialHashtags({
    purpose: 'rent',
    propertyType: 'Casa',
    propertyStage: 'Disponível imediatamente',
    city: 'Curitiba',
    district: 'Batel',
    state: 'PR',
    bedrooms: '3',
    parkingSpaces: '2',
    highlights: ['Piscina'],
    cta: 'Entre em contato agora',
  })
  assertOfficialSet(hashtags)
  assert.ok(hashtags.includes('#CasaParaAlugar'))
  assert.equal(hashtags.some((tag) => /locacao$|aluguel$/i.test(tag)), false)
  assert.equal(hashtags.some((tag) => /avenda|venda|comprar|compra/i.test(tag)), false)
})

test('minimum structured Smart Tour context still produces the official range', () => {
  const hashtags = buildOfficialHashtags({ purpose:'sale', propertyType:'Apartamento', propertyStage:'Pronto', city:'Salvador', state:'BA' })
  assertOfficialSet(hashtags)
})

test('apartment without district remains relevant and within the official range', () => {
  const hashtags = buildOfficialHashtags({ purpose:'sale', propertyType:'Apartamento', propertyStage:'Pronto', city:'Salvador', state:'BA' })
  assertOfficialSet(hashtags)
  assert.ok(hashtags.includes('#ApartamentoAVenda'))
  assert.ok(hashtags.includes('#Salvador'))
})

test('highlight accents are removed without producing duplicates', () => {
  const hashtags = buildOfficialHashtags({ purpose:'sale', propertyType:'Apartamento', propertyStage:'Pronto', city:'São Paulo', state:'SP', highlights:['Área de Lazer', 'Area de Lazer', 'Piscina'] })
  assertOfficialSet(hashtags)
  assert.equal(hashtags.filter((tag) => tag === '#AreaDeLazer').length, 1)
  assert.ok(hashtags.includes('#Piscina'))
})

test('Smart Tour consumes the official engine without changing Campaign Central', () => {
  const smartTour = buildSmartTourCampaignPackage({
    property: { purpose:'rent', stage:'Disponível imediatamente', type:'Apartamento', city:'Recife', district:'Boa Viagem', state:'PE', bedrooms:'2', suites:'1', highlights:['Vista para o mar'] },
    language: 'pt-BR',
    cta: 'Agende sua visita',
    phone: '',
  })
  for (const campaign of smartTour.aiCampaigns) {
    assertOfficialSet(campaign.hashtags)
    assert.equal(campaign.hashtags.some((tag) => /avenda|venda|comprar|compra/i.test(tag)), false)
  }
})

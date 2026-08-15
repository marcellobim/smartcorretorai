import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoogleAdsDelivery, validateGoogleAdsDelivery } from '../google-ads.ts'

test('google ads canonical contract preserves CTA and real-estate intent without invented metrics', () => {
  const result = buildGoogleAdsDelivery({
    purpose: 'sale', propertyType: 'Apartamento', district: 'Lapa', city: 'São Paulo',
    bedrooms: '3', suites: '2', highlights: ['churrasqueira'], cta: 'Agende sua visita',
  })
  assert.deepEqual(validateGoogleAdsDelivery(result, { expectedCta: 'Agende sua visita' }), result)
  assert.ok(result.suggested_keywords.some(keyword => /apartamento.*(venda|comprar).*lapa/i.test(keyword)))
  assert.ok(result.suggested_keywords.some(keyword => /apartamento.*(3 dormitórios|2 suítes|churrasqueira).*lapa/i.test(keyword)))
  assert.doesNotMatch(JSON.stringify(result), /cpc|volume de pesquisa|concorrência|ranking|previsão de tráfego/i)
})

test('google ads canonical contract rejects overflow, duplicates, metrics and a different CTA', () => {
  const valid = buildGoogleAdsDelivery({ purpose: 'sale', propertyType: 'Casa', city: 'Curitiba', bedrooms: '3', cta: 'Saiba mais' })
  assert.throws(() => validateGoogleAdsDelivery({ ...valid, headlines: ['x'.repeat(31), 'Casa em Curitiba'] }), /invalid_google_ads_headlines_1/)
  assert.throws(() => validateGoogleAdsDelivery({ ...valid, suggested_keywords: ['casa à venda curitiba', 'casa à venda curitiba', 'comprar casa curitiba'] }), /invalid_google_ads_keywords_duplicate/)
  assert.throws(() => validateGoogleAdsDelivery({ ...valid, suggested_keywords: ['casa à venda curitiba', 'CPC casa curitiba', 'comprar casa curitiba'] }), /invalid_google_ads_keyword_metrics/)
  assert.throws(() => validateGoogleAdsDelivery(valid, { expectedCta: 'Agende sua visita' }), /invalid_google_ads_cta_context/)
})

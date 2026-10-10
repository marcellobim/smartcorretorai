import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSmartCarouselCaptions, formatSmartCarouselPhone, normalizeSmartCarouselLocale, presentationCta, presentationHighlights, presentationLabel, smartCarouselCtaFile } from './localization.ts'

test('PT-BR/BR is the safe locale fallback and preserves legacy presentation values', () => {
  assert.deepEqual(normalizeSmartCarouselLocale({}), { language: 'pt-BR', market: 'BR' })
  assert.equal(presentationLabel('Pronto para morar', 'pt-BR'), 'Pronto para morar')
  assert.deepEqual(buildSmartCarouselCaptions({ district: 'Centro', city: 'São Paulo', uf: 'SP', bedrooms: '2', area: '80' }, { language: 'pt-BR', market: 'BR' }), ['Centro · São Paulo · SP', '2 dormitórios', '80 m²'])
})

test('EN-US/US localizes deterministic captions without leaking legacy values', () => {
  const locale = normalizeSmartCarouselLocale({ language: 'en-US', market: 'US' })
  assert.deepEqual(locale, { language: 'en-US', market: 'US' })
  assert.equal(presentationLabel('Pronto para morar', locale.language), 'Move-in ready')
  assert.equal(presentationCta('Agende sua visita', locale.language), 'Schedule a tour')
  assert.deepEqual(presentationHighlights(['Piscina', 'Varanda gourmet'], locale.language), ['Pool', 'Outdoor entertaining balcony'])
  assert.deepEqual(buildSmartCarouselCaptions({ property_stage: 'Pronto para morar', city: 'Austin', county: 'Travis County', state: 'TX', zip_code: '78701', neighborhood_community: 'Downtown', bedrooms: '2', bathrooms: '1', parking_spaces: '1', area: '1200' }, locale), ['Downtown · Austin, Travis County, TX, 78701', 'Move-in ready', '2 bedrooms · 1 bathroom · 1 parking space', '1200 sq ft'])
})

test('phone presentation follows market without changing stored values', () => {
  assert.equal(formatSmartCarouselPhone('5511999999999', 'BR'), '(11) 99999-9999')
  assert.equal(formatSmartCarouselPhone('15125551212', 'US'), '(512) 555-1212')
})

test('CTA file mapping preserves legacy values and selects only the matching language asset', () => {
  const expected = [
    ['Saiba Mais', 'cta-saiba-mais.png', 'cta-learn-more.png'],
    ['Agende sua visita', 'cta-agende-sua-visita.png', 'cta-schedule-your-visit.png'],
    ['Entre em contato agora', 'cta-entre-em-contato-agora.png', 'cta-contact-us-now.png'],
    ['Aguardo seu contato', 'cta-aguardo-seu-contato.png', 'cta-get-in-touch.png'],
  ]
  for (const [value, pt, en] of expected) {
    assert.equal(smartCarouselCtaFile(value, 'pt-BR'), pt)
    assert.equal(smartCarouselCtaFile(value, 'en-US'), en)
  }
  assert.equal(smartCarouselCtaFile('Saiba Mais', normalizeSmartCarouselLocale({}).language), 'cta-saiba-mais.png')
  assert.equal(smartCarouselCtaFile('invalid', 'en-US'), '')
})

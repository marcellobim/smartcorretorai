import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSmartCarouselCreateBody } from '../src/lib/smart-carousel-request.js'

const uploaded = { imagePaths: ['safe/photo.jpg'], ctaPath: 'safe/cta.png' }
const common = { purpose: 'sale', property_stage: 'Pronto para morar', property_type: 'Apartamento', bedrooms: '3', parking_spaces: '2', area: '1200', highlights: ['Piscina'] }

test('US handler payload carries only US facts and optional location values when supplied', () => {
  const body = buildSmartCarouselCreateBody({ jobId: 'job', uploaded, cta: 'Saiba Mais', sharePhone: 'yes', professionalIdentity: { enabled: true, name_source: 'display' }, locale: 'en-US', market: 'US', answers: { ...common, bathrooms: '2', state: 'FL', county: 'Hillsborough County', city: 'Tampa', zip_code: '33602', neighborhood_community: 'Downtown', suites: '9', uf: 'SP', district: 'Centro' } })
  assert.deepEqual(body.professional_identity, { enabled: true, name_source: 'display' })
  assert.equal(body.share_phone, true)
  assert.equal(body.answers.state, 'FL')
  assert.equal(body.answers.bathrooms, '2')
  for (const forbidden of ['uf', 'suites', 'district']) assert.equal(forbidden in body.answers, false)
})

test('empty US ZIP and community never become placeholders and disabled identity sends no profile data', () => {
  const body = buildSmartCarouselCreateBody({ jobId: 'job', uploaded, cta: 'Saiba Mais', sharePhone: 'no', professionalIdentity: { enabled: false }, locale: 'en-US', market: 'US', answers: { ...common, bathrooms: '2', state: 'FL', county: 'Orange County', city: 'Orlando', zip_code: '', neighborhood_community: '' } })
  assert.deepEqual(body.professional_identity, { enabled: false })
  assert.equal(body.share_phone, false)
  assert.equal('zip_code' in body.answers, false)
  assert.equal('neighborhood_community' in body.answers, false)
})

test('BR handler payload keeps suites and UF without US fields', () => {
  const body = buildSmartCarouselCreateBody({ jobId: 'job', uploaded, cta: 'Saiba Mais', sharePhone: 'no', professionalIdentity: { enabled: false }, locale: 'pt-BR', market: 'BR', answers: { ...common, suites: '1', uf: 'SP', city: 'São Paulo', district: 'Centro', bathrooms: '2', state: 'FL', county: 'Hillsborough County' } })
  assert.equal(body.answers.suites, '1')
  assert.equal(body.answers.uf, 'SP')
  for (const forbidden of ['state', 'county', 'bathrooms']) assert.equal(forbidden in body.answers, false)
})

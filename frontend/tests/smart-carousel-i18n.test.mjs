import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { getSmartCarouselCopy } from '../src/i18n/smart-carousel.js'

const root = path.resolve(import.meta.dirname, '..')
const page = readFileSync(path.join(root, 'src/pages/SmartCarrossel.jsx'), 'utf8')
const catalog = readFileSync(path.join(root, 'src/i18n/smart-carousel.js'), 'utf8')

test('Smart Carrossel uses the shared locale context with PT-BR fallback and EN-US copy', () => {
  assert.match(page, /useLocale\(\)/)
  assert.match(page, /getSmartCarouselCopy\(locale\)/)
  assert.match(catalog, /locale === 'en-US' \? enUS : ptBR/)
  assert.match(catalog, /Professional Property Presentation/)
  assert.match(catalog, /Apresentação Profissional/)
})

test('Smart Carrossel localizes questions, review labels, and presentation-only option labels', () => {
  assert.match(page, /const messages = copy\.questions/)
  assert.match(page, /copy\.stage\[item\]/)
  assert.match(page, /copy\.labelFor\(item\)/)
  assert.match(page, /createNewLabel=\{copy\.createNew\}/)
  assert.match(catalog, /What type of property are you presenting\?/) 
  assert.match(catalog, /Qual é a finalidade do imóvel\?/) 
})

test('Smart Carrossel keeps backend values and recovery identifiers independent from translated labels', () => {
  for (const value of ['sale', 'rent', 'Pronto para morar', 'Apartamento', 'Saiba Mais', 'activeJobId', 'clientRequestId']) {
    if (value === 'clientRequestId') continue
    assert.ok(page.includes(value) || catalog.includes(value), value)
  }
  assert.match(page, /value: item, answer: copy\.labelFor\(item\)/)
  assert.match(page, /hasRecoverableActiveJob/)
  assert.match(page, /pollRenderStatus\(receipt, activeJobId\)/)
})

test('Smart Carrossel keeps BR location and adds the shared US location contract only in the frontend draft', () => {
  assert.match(page, /<StudioUsLocation value=\{\{ state: uf, county, city, zipCode, neighborhoodCommunity \}\}/)
  assert.match(page, /isValidCountyForState\(uf, county\)/)
  assert.match(page, /normalizeUsZipCode\(zipCode\)/)
  assert.match(page, /neighborhoodCommunity/)
  assert.match(page, /county,/)
  assert.match(page, /zip_code: normalizedZipCode/)
  assert.match(page, /neighborhood_community: neighborhoodCommunity\.trim\(\)/)
})

test('Smart Carrossel keeps Phone and professional identity as distinct conversation steps', () => {
  assert.match(page, /step === 14[\s\S]*?nextStep: 15/)
  assert.match(page, /step === 15[\s\S]*?<ProfessionalIdentityQuestion/)
  assert.match(page, /nextStep: 16/)
  assert.match(page, /totalQuestions=\{15\}/)
  assert.match(catalog, /Would you like to include your professional information\?/)
})

test('Smart Carrossel formats professional phone numbers through the shared market helper', () => {
  assert.match(page, /formatPhone\(user\?\.whatsapp.*market\)/)
  assert.match(page, /formatPhone\(profilePhone, market\)/)
})

test('Smart Carrossel uploads a language-specific CTA asset while preserving internal CTA values', () => {
  for (const asset of ['cta-saiba-mais.png', 'cta-agende-sua-visita.png', 'cta-entre-em-contato-agora.png', 'cta-aguardo-seu-contato.png', 'cta-learn-more.png', 'cta-schedule-your-visit.png', 'cta-contact-us-now.png', 'cta-get-in-touch.png']) assert.ok(page.includes(asset), asset)
  assert.match(page, /SMART_CAROUSEL_CTA_ASSETS\[language === 'en-US' \? 'en-US' : 'pt-BR'\]\[cta\]/)
  assert.match(page, /uploadSmartCarouselFilesWithTimeout\(\{ photos, userId: user\.id, jobId, cta, language: locale \}\)/)
})

test('Smart Carrossel renders persisted social content without using the current UI locale', () => {
  assert.match(page, /cta: campaignPackage\?\.google_ads\?\.cta \|\| cta/)
  assert.match(page, /language: campaignPackage\?\.language \|\| 'pt-BR'/)
  assert.match(page, /aiCampaigns: campaignPackage\?\.campaigns \|\| \[\]/)
})

test('Smart Carrossel localizes price, area, phone, generation status, errors, and review metadata', () => {
  const pt = getSmartCarouselCopy('pt-BR')
  const en = getSmartCarouselCopy('en-US')
  assert.equal(pt.priceFixed, 'Preço fixo')
  assert.equal(en.priceFixed, 'Fixed price')
  assert.equal(pt.areaUnit, 'm²')
  assert.equal(en.areaUnit, 'sq ft')
  assert.equal(pt.phone.yes, 'Sim')
  assert.equal(en.phone.yes, 'Yes')
  assert.equal(pt.status.uploading, 'Enviando fotos...')
  assert.equal(en.status.uploading, 'Uploading photos...')
  assert.equal(en.errors.creation, 'Unable to create your presentation. Please try again.')
  assert.equal(en.text(en.upload.limitExceededMany, { max: 20, count: 2 }), 'The limit is 20 images. 2 extra images were not added.')
  assert.equal(en.text(en.reviewMeta.quantity, { count: 5 }), '5 images selected · fixed price')
  assert.match(page, /\{copy\.priceFixed\}/)
  assert.match(page, /\{copy\.areaUnit\}/)
  assert.match(page, /copy\.phone\.yes/)
  assert.match(page, /copy\.status\.uploading/)
  assert.match(page, /localizeSmartCarouselError\(copy, message\)/)
})

test('Smart Carrossel keeps highlight values stable while displaying EN-US labels', () => {
  const en = getSmartCarouselCopy('en-US')
  assert.equal(en.labelFor('Piscina'), 'Pool')
  assert.equal(en.labelFor('Varanda gourmet'), 'Outdoor entertaining balcony')
  assert.equal(en.labelFor('Usa FGTS'), 'Eligible financing terms')
  assert.match(page, /\{copy\.labelFor\(group\.title\)\}/)
  assert.match(page, /\{copy\.labelFor\(item\)\}/)
  assert.match(page, /value: highlights/)
})

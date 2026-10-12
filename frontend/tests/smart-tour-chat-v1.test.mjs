import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { formatSmartTourCurrency, formatSmartTourLocation, getSmartTourHighlights, getSmartTourMeasureFields, getSmartTourPropertyTypes, getSmartTourStageOptions, normalizeSmartTourDistrict, SMART_TOUR_PROPERTY_TYPES, SMART_TOUR_RENTAL_STAGES } from '../src/config/smartTourForm.js'
import { getSmartTourNextQuestion, getSmartTourReviewEditNext } from '../src/config/smartTourConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')
// smartTour.js intentionally uses Vite's extensionless runtime imports. Load it
// through Vite SSR so this test verifies production resolution without changing
// a production import solely for Node's resolver.
const vite = await createServer({ root: frontendRoot, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const { SMART_TOUR_MAX_IMAGES } = await vite.ssrLoadModule('/src/config/smartTour.js')
test.after(() => vite.close())

test('communicates and enforces the 1 to 5 photo contract', () => {
  assert.equal(SMART_TOUR_MAX_IMAGES, 5)
  assert.match(page, /smartTour\.questions\.images/)
  assert.match(page, /smartTour\.upload\.selectPhotos/)
  assert.match(page, /smartTour\.upload\.photosLimit/)
  assert.match(page, /smartTour\.upload\.photos/)
  assert.match(page, /current\.length \+ uniqueInSystemOrder\.length > SMART_TOUR_MAX_IMAGES/)
  assert.match(page, /smartTour\.uploadValidation\.maxImages/)
})

test('preserves the native file selection order through thumbnails and generation', () => {
  assert.match(page, /const selectedInSystemOrder = Array\.from\(files\)/)
  assert.match(page, /uniqueInSystemOrder = selectedInSystemOrder\.filter/)
  assert.match(page, /return \[\.\.\.current, \.\.\.uniqueInSystemOrder\.map/)
  assert.match(page, /const orderedImages = images\.slice\(\)/)
  assert.match(page, /const file = orderedImages\[imageIndex\]\.file/)
  assert.match(page, /imagePaths\[imageIndex\] = path/)
  assert.match(page, /imageOrder: imagePaths/)
})

test('uses the approved real-estate formatters', () => {
  assert.equal(normalizeSmartTourDistrict('  centro   '), 'Centro')
  assert.equal(normalizeSmartTourDistrict('antônio   olinto'), 'Antônio Olinto')
  assert.equal(formatSmartTourLocation({ district: ' centro ', city: 'Antônio Olinto', state: 'PR' }), 'Centro, Antônio Olinto - PR')
  assert.equal(formatSmartTourCurrency('3000'), 'R$ 3.000')
  assert.match(page, /formatPhone\(rawPhone, professionalMarket\)/)
  assert.doesNotMatch(page, /type="tel"/)
})

test('asks only compatible measures for each property type', () => {
  assert.deepEqual(getSmartTourMeasureFields('Apartamento'), ['bedrooms', 'suites', 'parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Casa'), ['bedrooms', 'suites', 'parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Comercial'), ['parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Terreno / Lote'), ['area'])
})

test('uses the approved rental states and removes land only from rental', () => {
  const saleStages = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
  assert.deepEqual(SMART_TOUR_RENTAL_STAGES, ['Pronto para morar', 'Disponível já', 'Vago'])
  assert.deepEqual(getSmartTourStageOptions('rent', saleStages), SMART_TOUR_RENTAL_STAGES)
  assert.deepEqual(getSmartTourStageOptions('sale', saleStages), saleStages)
  assert.equal(getSmartTourPropertyTypes('rent').some((type) => type.value === 'Terreno / Lote'), false)
  assert.equal(getSmartTourPropertyTypes('sale').some((type) => type.value === 'Terreno / Lote'), true)
  assert.match(page, /getSmartTourStageOptions\(property\.purpose, STAGES\)/)
  assert.match(page, /getSmartTourPropertyTypes\(property\.purpose, \{ market \}\)/)
})

test('removes Sobrado as a primary type and keeps it as a house highlight', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES.some((type) => type.value === 'Sobrado'), false)
  assert.equal(getSmartTourHighlights('Casa').includes('Sobrado'), true)
})

test('provides type-specific highlights with a maximum of ten choices', () => {
  assert.notDeepEqual(getSmartTourHighlights('Apartamento'), getSmartTourHighlights('Casa'))
  assert.notDeepEqual(getSmartTourHighlights('Comercial'), getSmartTourHighlights('Terreno / Lote'))
  assert.match(page, /property\.highlights\.length < 10/)
  assert.match(page, /smartTour\.highlightSelection\.instruction/)
})

test('removes commercial description and language questions from Brazil flow', () => {
  assert.doesNotMatch(page, /Qual será o idioma da apresentação/)
  assert.doesNotMatch(page, /Deseja acrescentar uma descrição comercial/)
  assert.doesNotMatch(page, /id === 'description'/)
  assert.doesNotMatch(page, /id === 'language'/)
  assert.match(page, /language: 'pt-BR'/)
})

test('uses the four independent production choices instead of presentation modes', () => {
  assert.equal(getSmartTourNextQuestion({ questionId: 'highlights' }), 'presenter')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter' }), 'presenter_speech_mode')
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'automatic' }), 'narration')
  assert.equal(getSmartTourNextQuestion({ questionId: 'narration' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions' }), 'professional_identity')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'yes' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'no' }), 'review')
  assert.doesNotMatch(page, /SMART_TOUR_MODES|free_ai_format|id === 'mode'/)
})

test('supports targeted review edits and returns automatically to review', () => {
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'purpose', questionId: 'purpose' }), 'stage')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'purpose', questionId: 'stage' }), 'review')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'type', questionId: 'type' }), 'facts')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'type', questionId: 'facts' }), 'highlights')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'type', questionId: 'highlights' }), 'review')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'cta_enabled', questionId: 'cta_enabled', answerId: 'yes' }), 'cta')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'cta_enabled', questionId: 'phone' }), 'review')
  assert.equal(getSmartTourReviewEditNext({ originQuestionId: 'cta', questionId: 'cta' }), 'review')
  assert.match(page, /onClick=\{\(\) => onReviewEdit\(item\.id\)\}/)
})

test('uses the approved final video review structure', () => {
  for (const key of ['smartTour.review.title', 'smartTour.review.confirm', 'smartTour.review.confirmCreate', 'smartTour.review.redo']) assert.ok(page.includes(key))
  assert.doesNotMatch(page, /Alterar opções/)
  assert.match(page, /onClick=\{resetCreation\}/)
  for (const key of ['smartTour.review.presenter', 'smartTour.review.narration', 'smartTour.guide.texts', 'smartTour.review.phone']) assert.ok(page.includes(key))
  assert.match(page, /ctaEnabled === true \? \[\{ label: t\('smartTour\.review\.phone'\)/)
})

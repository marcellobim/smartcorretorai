import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SMART_TOUR_MAX_IMAGES } from '../src/config/smartTour.js'
import { formatSmartTourCurrency, formatSmartTourLocation, getSmartTourHighlights, getSmartTourMeasureFields, normalizeSmartTourDistrict, SMART_TOUR_PROPERTY_TYPES } from '../src/config/smartTourForm.js'
import { getSmartTourNextQuestion, getSmartTourReviewEditNext } from '../src/config/smartTourConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')

test('communicates and enforces the 1 to 5 photo contract', () => {
  assert.equal(SMART_TOUR_MAX_IMAGES, 5)
  assert.match(page, /Envie até 5 fotos na ordem em que deseja apresentá-las/)
  assert.match(page, /Selecione de 1 a \{SMART_TOUR_MAX_IMAGES\} fotos/)
  assert.match(page, /\{images\.length\} de \{SMART_TOUR_MAX_IMAGES\} imagens/)
  assert.match(page, /current\.length \+ uniqueInSystemOrder\.length > SMART_TOUR_MAX_IMAGES/)
  assert.match(page, /Você pode enviar no máximo \$\{SMART_TOUR_MAX_IMAGES\} imagens/)
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
  assert.match(page, /formatBrazilianPhone/)
  assert.doesNotMatch(page, /type="tel"/)
})

test('asks only compatible measures for each property type', () => {
  assert.deepEqual(getSmartTourMeasureFields('Apartamento'), ['bedrooms', 'suites', 'parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Casa'), ['bedrooms', 'suites', 'parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Comercial'), ['parkingSpaces', 'area'])
  assert.deepEqual(getSmartTourMeasureFields('Terreno / Lote'), ['area'])
})

test('removes Sobrado as a primary type and keeps it as a house highlight', () => {
  assert.equal(SMART_TOUR_PROPERTY_TYPES.includes('Sobrado'), false)
  assert.equal(getSmartTourHighlights('Casa').includes('Sobrado'), true)
})

test('provides type-specific highlights with a maximum of ten choices', () => {
  assert.notDeepEqual(getSmartTourHighlights('Apartamento'), getSmartTourHighlights('Casa'))
  assert.notDeepEqual(getSmartTourHighlights('Comercial'), getSmartTourHighlights('Terreno / Lote'))
  assert.match(page, /property\.highlights\.length < 10/)
  assert.match(page, /Selecione até 10 características/)
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
  assert.equal(getSmartTourNextQuestion({ questionId: 'presenter' }), 'narration')
  assert.equal(getSmartTourNextQuestion({ questionId: 'narration' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'captions' }), 'cta_enabled')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'yes' }), 'cta')
  assert.equal(getSmartTourNextQuestion({ questionId: 'cta_enabled', answerId: 'no' }), 'review')
  assert.doesNotMatch(page, /SMART_TOUR_MODES|free_ai_format|id === 'mode'/)
  assert.doesNotMatch(page, /prompt livre|briefing/i)
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
  assert.match(page, />Editar</)
})

test('uses the approved final video review structure', () => {
  for (const text of ['Revise suas escolhas', 'Confirma suas escolhas?', 'Confirmar e criar vídeo', 'Alterar opções', 'Refazer criação']) assert.ok(page.includes(text))
  for (const label of ['Apresentador', 'Narração', 'Textos', 'CTA', 'Telefone']) assert.ok(page.includes(label))
  assert.match(page, /\.\.\.\(ctaEnabled === true \? \[\{ label: 'Telefone'/)
})

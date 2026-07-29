import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../src/config/virtualStagingConversation.js'
import {
  buildFurnishRenovatePayload,
  buildFurnishRenovateReviewItems,
  canAddFurnishRenovateImages,
  FURNISH_RENOVATE_COPY,
  FURNISH_RENOVATE_HIGHLIGHT_GROUPS,
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_MAX_HIGHLIGHTS,
  FURNISH_RENOVATE_MAX_IMAGES,
  FURNISH_RENOVATE_PROPERTY_TYPES,
  FURNISH_RENOVATE_QUESTIONS,
} from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

const property = {
  purpose: 'sale', type: 'Apartamento', bedrooms: '2', suites: '1', parkingSpaces: '1', area: '85', state: 'SP', city: 'São Paulo', neighborhood: 'Limão',
  highlights: ['Varanda gourmet', 'Lazer completo', 'Vista livre', 'Piscina'], stage: 'Pronto para morar', district: 'Antigo',
}
const imagePaths = ['user/virtual-staging/request/01.jpg', 'user/virtual-staging/request/02.jpg']

test('keeps Reimagine AI as the first existing module with the technical id unchanged', () => {
  assert.equal(FURNISH_RENOVATE_JOURNEY_ID, 'furnish-renovate')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.title, 'Reimagine AI')
  assert.match(page, /<Header title=\{VIRTUAL_STAGING_PRODUCT_NAME\}/)
  assert.match(read('frontend/src/config/virtualStaging.js'), /VIRTUAL_STAGING_PRODUCT_NAME = 'Virtual Space'/)
  assert.match(read('frontend/src/App.jsx'), /path="\/virtual-staging"/)
})

test('uses one direct conversational flow with property location and area, without style, transformation mode or narrated CTA', () => {
  const expected = ['images', 'purpose', 'type', 'bedrooms', 'suites', 'parkingSpaces', 'area', 'state', 'city', 'neighborhood', 'highlights', 'review']
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.map(([id]) => id), expected)
  const sequence = ['images']
  while (sequence.at(-1) !== 'review') sequence.push(getVirtualStagingNextQuestion({ questionId: sequence.at(-1), journeyId: FURNISH_RENOVATE_JOURNEY_ID }))
  assert.deepEqual(sequence, expected)
  for (const removed of ['style_gallery', 'video_mode', 'stage', 'facts', 'location', 'narrated_cta']) assert.equal(sequence.includes(removed), false)
  assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: 'city', questionId: 'city', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
})

test('accepts one to five ordered photographs and rejects a sixth in the frontend contract', () => {
  assert.equal(FURNISH_RENOVATE_MAX_IMAGES, 5)
  assert.equal(canAddFurnishRenovateImages(0, 1), true)
  assert.equal(canAddFurnishRenovateImages(4, 1), true)
  assert.equal(canAddFurnishRenovateImages(5, 1), false)
  assert.equal(FURNISH_RENOVATE_COPY.uploadQuestion, 'Envie de 1 a 5 fotos dos ambientes que deseja reimaginar.')
  assert.match(FURNISH_RENOVATE_COPY.uploadHint, /ordem escolhida/)
  assert.match(page, /Selecione de 1 a 5 fotos\./)
})

test('offers only the seven approved residential property types', () => {
  assert.deepEqual(FURNISH_RENOVATE_PROPERTY_TYPES, ['Apartamento', 'Casa', 'Sobrado', 'Studio', 'Loft', 'Cobertura', 'Kitnet'])
  for (const forbidden of ['Comercial', 'Terreno', 'Lote', 'Galpão', 'Escritório']) assert.equal(FURNISH_RENOVATE_PROPERTY_TYPES.includes(forbidden), false)
  assert.match(page, /choices\(FURNISH_RENOVATE_PROPERTY_TYPES/)
})

test('limits residential highlights to three and sends only selected values', () => {
  assert.equal(FURNISH_RENOVATE_MAX_HIGHLIGHTS, 3)
  assert.equal(FURNISH_RENOVATE_HIGHLIGHT_GROUPS.every(group => !/comercial|terreno|rural|industrial/i.test(`${group.title} ${group.items.join(' ')}`)), true)
  assert.match(page, /property\.highlights\.length < FURNISH_RENOVATE_MAX_HIGHLIGHTS/)
})

test('builds the new minimal payload without legacy Module 1 fields', () => {
  const payload = buildFurnishRenovatePayload({ imagePaths, property })
  assert.deepEqual(payload, {
    module: 'furnish-renovate',
    property_images: { image_paths: imagePaths, image_order: imagePaths },
    property: {
      purpose: 'sale', type: 'Apartamento', city: 'São Paulo', bedrooms: '2', suites: '1', parkingSpaces: '1',
      area: '85', state: 'SP', neighborhood: 'Limão',
      highlights: ['Varanda gourmet', 'Lazer completo', 'Vista livre'],
    },
    language: 'pt-BR',
  })
  for (const removed of ['transformationStyle', 'videoMode', 'narratedCta', 'narrationEnabled', 'selectedCta', 'includeProfessionalPhone']) assert.equal(removed in payload, false)
  for (const removed of ['stage', 'district']) assert.equal(removed in payload.property, false)
})

test('shows only the approved fields in the Reimagine AI review', () => {
  const review = buildFurnishRenovateReviewItems({ imagesCount: 2, property })
  assert.deepEqual(review.map(item => item.id), ['images', 'purpose', 'type', 'bedrooms', 'suites', 'parkingSpaces', 'area', 'state', 'city', 'neighborhood', 'highlights'])
  assert.equal(review.find(item => item.id === 'images')?.label, '2 fotografias')
  assert.equal(review.find(item => item.id === 'area')?.label, '85 m²')
})

test('reuses the shared State and IBGE city selectors while keeping only neighborhood editable', () => {
  assert.match(page, /if \(id === 'state'\)[\s\S]*SmartCarouselStateSelect/)
  assert.match(page, /if \(id === 'city'\)[\s\S]*SmartCarouselCitySelect uf=\{property\.state\}/)
  assert.match(page, /if \(id === 'neighborhood'\)[\s\S]*aria-label="Bairro"/)
  assert.doesNotMatch(page, /if \(id === 'city'\) return <>\s*<input/)
  const locationSource = read('frontend/src/components/location/SmartCarouselCitySelect.jsx')
  assert.match(locationSource, /SMART_CAROUSEL_STATE_OPTIONS/)
  assert.match(locationSource, /servicodados\.ibge\.gov\.br/)
})

test('collects a positive numeric area in square metres', () => {
  assert.match(page, /if \(id === 'area'\)/)
  assert.match(page, /aria-label="Área do imóvel"/)
  assert.match(page, /Number\(property\.area\) <= 0/)
  assert.match(page, />m²</)
})

test('replaces the style gallery with the internal Reimagine AI explanation only', () => {
  assert.match(page, /function FurnishReimagineHero/)
  assert.match(page, /title="Dê uma nova vida"/)
  assert.match(page, /highlight="às fotos do seu imóvel\."/)
  assert.match(page, /decorar ambientes vazios, renovar ambientes já mobiliados/)
  assert.match(page, /reinterpretar parcialmente a composição/)
  assert.doesNotMatch(page, /function FurnishStyleGallery|Galeria de estilos|Selecionar estilo/)
})

test('shows the internal Before and After phones before the guided conversation', () => {
  assert.match(page, /function FurnishReimagineComparison/)
  assert.match(page, /Fotografias originais[\s\S]*Antes/)
  assert.match(page, /Apresentação criada pela IA[\s\S]*Depois/)
  assert.match(page, /O Reimagine AI cria uma nova apresentação visual a partir das fotografias do imóvel/)
  assert.match(page, /visual=\{<FurnishReimagineComparison \/>\}/)
  assert.ok(page.indexOf('<FurnishReimagineHero />') < page.indexOf('<GuidedConversation'))
})

test('keeps Modules 2 and 3 and Smart Tour isolated from the Reimagine AI contract', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'life-in-property' }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'broker-presentation' }), 'captions')
  assert.doesNotMatch(read('frontend/src/pages/SmartTourAI.jsx'), /FURNISH_RENOVATE|furnish-renovate|FurnishReimagineHero/)
  assert.doesNotMatch(read('supabase/functions/_shared/smart-tour/validation.ts'), /FURNISH_RENOVATE|furnish-renovate/)
})

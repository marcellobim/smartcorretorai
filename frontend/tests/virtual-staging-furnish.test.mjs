import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getSmartTourNextQuestion } from '../src/config/smartTourConversation.js'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../src/config/virtualStagingConversation.js'
import {
  buildFurnishRenovatePayload,
  buildFurnishRenovateReviewItems,
  canAddFurnishRenovateImages,
  FURNISH_COMPLETE_VIDEO_MODE,
  FURNISH_RENOVATE_COPY,
  FURNISH_RENOVATE_HIGHLIGHT_GROUPS,
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_MAX_IMAGES,
  FURNISH_RENOVATE_NARRATED_CTAS,
  FURNISH_RENOVATE_QUESTIONS,
  FURNISH_RENOVATE_STYLES,
  FURNISH_RENOVATE_VIDEO_MODES,
  FURNISH_VISUAL_ONLY_VIDEO_MODE,
} from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

const property = {
  purpose: 'sale', stage: 'Pronto para morar', type: 'Apartamento', bedrooms: '3', suites: '1', parkingSpaces: '2',
  area: '120', state: 'SP', city: 'São Paulo', district: 'Moema', price: 'R$ 2.000.000', condominium: 'R$ 1.500', iptu: 'R$ 500',
  highlights: ['Lazer completo', 'Bairro valorizado', 'Varanda gourmet', 'Piscina'], description: 'Não enviar',
}
const imagePaths = ['user/virtual-staging/request/01.jpg', 'user/virtual-staging/request/02.jpg']

test('Module 1 uses the definitive conversational sequence for both video modes', () => {
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.map(([id]) => id), ['images', 'style_gallery', 'video_mode', 'purpose', 'stage', 'type', 'facts', 'location', 'highlights', 'narrated_cta', 'review'])
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'style_gallery')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'style_gallery', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'video_mode')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'video_mode', answerId: FURNISH_VISUAL_ONLY_VIDEO_MODE, journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'video_mode', answerId: FURNISH_COMPLETE_VIDEO_MODE, journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'purpose')
  assert.deepEqual(
    ['purpose', 'stage', 'type', 'facts', 'location', 'highlights', 'narrated_cta'].map(questionId => getVirtualStagingNextQuestion({ questionId, journeyId: FURNISH_RENOVATE_JOURNEY_ID })),
    ['stage', 'type', 'facts', 'location', 'highlights', 'narrated_cta', 'review'],
  )
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'location', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'highlights')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'narrated_cta')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'narrated_cta', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
})

test('changing visual-only to complete from review resumes every commercial question', () => {
  assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: 'video_mode', questionId: 'video_mode', answerId: FURNISH_COMPLETE_VIDEO_MODE, journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'purpose')
  assert.deepEqual(
    ['purpose', 'stage', 'type', 'facts', 'location', 'highlights', 'narrated_cta'].map(questionId => getVirtualStagingReviewEditNext({ originQuestionId: 'video_mode', questionId, journeyId: FURNISH_RENOVATE_JOURNEY_ID })),
    ['stage', 'type', 'facts', 'location', 'highlights', 'narrated_cta', 'review'],
  )
})

test('upload accepts one to four images, rejects the fifth and uses transformation language', () => {
  assert.equal(FURNISH_RENOVATE_MAX_IMAGES, 4)
  assert.equal(canAddFurnishRenovateImages(0, 1), true)
  assert.equal(canAddFurnishRenovateImages(0, 4), true)
  assert.equal(canAddFurnishRenovateImages(4, 1), false)
  assert.equal(canAddFurnishRenovateImages(0, 5), false)
  assert.equal(FURNISH_RENOVATE_COPY.uploadQuestion, 'Envie de 1 a 4 fotos dos ambientes que deseja transformar.')
  assert.match(FURNISH_RENOVATE_COPY.uploadHint, /ordem em que deseja transformar os ambientes/)
  assert.doesNotMatch(FURNISH_RENOVATE_COPY.uploadQuestion + FURNISH_RENOVATE_COPY.uploadHint, /apresentá-las/)
  assert.match(page, /Selecione de 1 a 4 imagens\./)
  assert.match(page, /canAddFurnishRenovateImages\(current\.length, uniqueInSystemOrder\.length\)/)
})

test('style configuration is extensible and never invents demo assets', () => {
  assert.equal(FURNISH_RENOVATE_STYLES.length >= 3, true)
  for (const style of FURNISH_RENOVATE_STYLES) {
    assert.ok(style.id)
    assert.ok(style.name)
    assert.ok(style.description)
    assert.equal(style.demoVideo, '')
    assert.equal(style.assetStatus, 'pending')
  }
  assert.match(page, /Galeria de estilos de transformação/)
  assert.match(page, /onClick=\{\(\) => onSelect\(style\)\}/)
  assert.match(page, /Estilo selecionado: \$\{answer\}\./)
})

test('style modal is audio-enabled, protected from download and returns to the conversation', () => {
  const modal = page.slice(page.indexOf('function FurnishStyleGallery'), page.indexOf('function VirtualStagingModules'))
  assert.match(modal, /role="dialog"/)
  assert.match(modal, /autoPlay playsInline controls preload="metadata"/)
  assert.match(modal, /controlsList="nodownload noremoteplayback"/)
  assert.match(modal, /disablePictureInPicture disableRemotePlayback/)
  assert.match(modal, /onContextMenu=\{event => event\.preventDefault\(\)\}/)
  assert.match(modal, /event\.key === 'Escape'/)
  assert.match(modal, /setActiveStyle\(null\)/)
  assert.doesNotMatch(modal.match(/<video[\s\S]*?\/>/)?.[0] || '', /\bmuted\b/)
})

test('Module 1 hero is automatic, responsive and not an interaction surface', () => {
  const hero = page.slice(page.indexOf('function FurnishStyleHero'), page.indexOf('function FurnishStyleGallery'))
  assert.match(hero, /window\.setInterval/)
  assert.match(hero, /Carrossel demonstrativo de estilos do Ambiente Renovado/)
  assert.match(hero, /sm:grid-cols/)
  assert.match(hero, /a seleção acontece dentro da conversa/)
  assert.doesNotMatch(hero, /<button|onClick|role="dialog"/)
})

test('one video-mode choice deterministically controls narration and removes separate output questions', () => {
  assert.deepEqual(FURNISH_RENOVATE_VIDEO_MODES.map(mode => [mode.id, mode.narrationEnabled]), [
    [FURNISH_COMPLETE_VIDEO_MODE, true],
    [FURNISH_VISUAL_ONLY_VIDEO_MODE, false],
  ])
  assert.match(FURNISH_RENOVATE_VIDEO_MODES[0].description, /Sem legendas, textos na tela, telefone ou CTA visual/)
  assert.match(FURNISH_RENOVATE_VIDEO_MODES[1].description, /Sem narração, convite final, textos, telefone ou CTA visual/)
  assert.equal(FURNISH_RENOVATE_QUESTIONS.some(([id]) => ['presenter', 'narration', 'captions', 'cta_enabled', 'cta', 'phone', 'commercial'].includes(id)), false)
})

test('visual-only payload contains no commercial or output semantics', () => {
  const payload = buildFurnishRenovatePayload({ imagePaths, transformationStyle: FURNISH_RENOVATE_STYLES[0].id, videoMode: FURNISH_VISUAL_ONLY_VIDEO_MODE, property })
  assert.deepEqual(payload, {
    module: 'furnish-renovate',
    property_images: { image_paths: imagePaths, image_order: imagePaths },
    transformationStyle: FURNISH_RENOVATE_STYLES[0].id,
    videoMode: 'visual-only',
    language: 'pt-BR',
  })
  for (const forbidden of ['property', 'area', 'narratedCta', 'narrationEnabled', 'generation', 'purpose', 'stage', 'presenterGender', 'presenter_reference', 'texts', 'captions', 'cta', 'phone']) assert.equal(forbidden in payload, false, forbidden)
})

test('complete payload sends area and literal narrated CTA without visual output semantics', () => {
  const payload = buildFurnishRenovatePayload({ imagePaths, transformationStyle: FURNISH_RENOVATE_STYLES[0].id, videoMode: FURNISH_COMPLETE_VIDEO_MODE, property, narratedCta: 'Saiba mais' })
  assert.equal(payload.narrationEnabled, true)
  assert.deepEqual(payload.property, {
    purpose: 'sale', stage: 'Pronto para morar', type: 'Apartamento', bedrooms: '3', suites: '1', parkingSpaces: '2', area: '120',
    district: 'Moema', city: 'São Paulo', highlights: ['Lazer completo', 'Bairro valorizado', 'Varanda gourmet'],
  })
  assert.equal(payload.narratedCta, 'Saiba mais')
  for (const forbidden of ['generation', 'presenterGender', 'presenter_reference', 'texts', 'captions', 'cta', 'selectedCta', 'phone', 'price', 'condominium', 'iptu', 'description']) assert.equal(forbidden in payload, false, forbidden)
})

test('controlled highlights, conditional review and final action match Module 1', () => {
  assert.deepEqual(FURNISH_RENOVATE_HIGHLIGHT_GROUPS.map(group => group.title), ['Lazer', 'Região e localização', 'Diferencial principal'])
  assert.match(page, /Selecione até 3 opções para uma narração curta e natural\./)
  assert.match(page, /videoMode === FURNISH_COMPLETE_VIDEO_MODE/)
  assert.equal(FURNISH_RENOVATE_COPY.reviewNotice, 'A IA transformará os ambientes preservando a estrutura original das fotografias.')
  assert.match(page, /Transformar Ambientes/)
  const furnishReview = page.slice(page.indexOf('const projectItems'), page.indexOf('const finalChoiceItems'))
  assert.doesNotMatch(furnishReview, /Apresentador|Telefone|CTA visual|Textos/)
})

test('review is minimal for visual-only and granular for complete transformation', () => {
  const cleanReview = buildFurnishRenovateReviewItems({ imagesCount: 2, transformationStyle: FURNISH_RENOVATE_STYLES[0].id, videoMode: FURNISH_VISUAL_ONLY_VIDEO_MODE, property, narratedCta: 'Saiba mais' })
  assert.deepEqual(cleanReview.map(item => item.id), ['images', 'style_gallery', 'video_mode'])

  const completeReview = buildFurnishRenovateReviewItems({ imagesCount: 2, transformationStyle: FURNISH_RENOVATE_STYLES[0].id, videoMode: FURNISH_COMPLETE_VIDEO_MODE, property, narratedCta: 'Saiba mais' })
  assert.deepEqual(completeReview.map(item => item.id), ['images', 'style_gallery', 'video_mode', 'purpose', 'stage', 'type', 'bedrooms', 'suites', 'parkingSpaces', 'area', 'district', 'city', 'highlights', 'narrated_cta'])
  assert.deepEqual(completeReview.slice(6, 12).map(item => item.displayLabel), ['Dormitórios', 'Suítes', 'Vagas', 'Área', 'Bairro', 'Cidade'])
  assert.equal(completeReview.find(item => item.id === 'area').label, '120 m²')
  assert.equal(completeReview.find(item => item.id === 'narrated_cta').label, 'Saiba mais')
})

test('narrated CTA is controlled, literal and editable without visual CTA semantics', () => {
  assert.deepEqual(FURNISH_RENOVATE_NARRATED_CTAS, ['Saiba mais', 'Agende sua visita', 'Entre em contato', 'Conheça este imóvel', 'Solicite mais informações'])
  assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: 'narrated_cta', questionId: 'narrated_cta', answerId: 'Saiba mais', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: 'facts', questionId: 'facts', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.match(page, /O convite será narrado literalmente no encerramento/)
  const narratedCtaQuestion = page.slice(page.indexOf("if (id === 'narrated_cta') return explainedChoices"), page.indexOf("if (id === 'life_scene')"))
  assert.doesNotMatch(narratedCtaQuestion, /WhatsApp|logotipo|selectedCta/)
  assert.match(page, /!isFurnishRenovate && Number\(property\.area\) <= 0/)
})

test('Modules 2 and 3, Smart Tour and shared campaign integrations stay isolated', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'life-in-property' }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'broker-presentation' }), 'captions')
  assert.equal(getSmartTourNextQuestion({ questionId: 'highlights' }), 'presenter')
  assert.equal(getVirtualStagingJourney(FURNISH_RENOVATE_JOURNEY_ID)?.id, 'furnish-renovate')
  assert.match(page, /<GuidedConversation/)
  assert.match(page, /buildVirtualStagingCampaignPackage/)
  assert.doesNotMatch(read('frontend/src/pages/SmartTourAI.jsx'), /FURNISH_RENOVATE|furnish-renovate/)
  assert.doesNotMatch(read('supabase/functions/_shared/smart-tour/validation.ts'), /FURNISH_RENOVATE|furnish-renovate/)
})

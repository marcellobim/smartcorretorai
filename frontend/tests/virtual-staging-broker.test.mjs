import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion } from '../src/config/virtualStagingConversation.js'
import {
  BROKER_CUSTOM_SPEECH_MAX_WORDS,
  BROKER_PRESENTATION_JOURNEY_ID,
  BROKER_REFERENCE_OPTIONS,
  buildBrokerPresentationFilePayload,
  buildBrokerPresentationGenerationPayload,
  validatePresenterReferenceSelection,
} from '../src/config/virtualStagingBroker.js'
import { LIFE_IN_PROPERTY_JOURNEY_ID } from '../src/config/virtualStagingLife.js'
import { getVirtualStagingJourney } from '../src/config/virtualStagingJourneys.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

test('Apresentacao pelo Corretor starts with the own-image decision and never enters life_scene', () => {
  assert.deepEqual(BROKER_REFERENCE_OPTIONS, [{ id: 'yes', label: 'Sim' }, { id: 'no', label: 'Não' }])
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_reference', answerId: 'yes', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'presenter_photo')

  const sequence = ['presenter_reference', 'presenter_photo']
  while (sequence.at(-1) !== 'review') {
    sequence.push(getVirtualStagingNextQuestion({ questionId: sequence.at(-1), journeyId: BROKER_PRESENTATION_JOURNEY_ID }))
  }
  assert.deepEqual(sequence, [
    'presenter_reference',
    'presenter_photo',
    'images',
    'purpose',
    'stage',
    'type',
    'facts',
    'location',
    'commercial',
    'presenter_speech_mode',
    'highlights',
    'captions',
    'cta_enabled',
    'phone',
    'professional_identity',
    'review',
  ])
  assert.equal(sequence.includes('life_scene'), false)
  assert.equal(sequence.includes('presenter_speech_mode'), true)
  assert.equal(sequence.includes('narration'), false)
  assert.equal(sequence.includes('cta_enabled'), true)
})

test('declining an own image stops the journey and points to Video Imobiliario', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_reference', answerId: 'no', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'presenter_reference_required')
  assert.match(page, /virtualStaging\.lifeBroker\.presenterRequiredNotice/)
  assert.match(page, /virtualStaging\.lifeBroker\.goToVideo/)
  assert.match(page, /navigate\('\/smart-tour-ai'\)/)
  assert.doesNotMatch(page, /presenter_reference_required[\s\S]{0,300}nextQuestionId/)
})

test('presenter upload accepts exactly one valid temporary image', () => {
  const jpeg = { type: 'image/jpeg', size: 1024, name: 'corretor.jpg' }
  const png = { type: 'image/png', size: 2048, name: 'corretor.png' }
  assert.deepEqual(validatePresenterReferenceSelection([jpeg]), { file: jpeg, error: '' })
  assert.equal(validatePresenterReferenceSelection([]).file, null)
  assert.equal(validatePresenterReferenceSelection([jpeg, png]).file, null)
  assert.equal(validatePresenterReferenceSelection([{ ...jpeg, type: 'image/webp' }]).file, null)
  assert.equal(validatePresenterReferenceSelection([{ ...jpeg, size: 16 * 1024 * 1024 }]).file, null)

  assert.match(page, /ref=\{presenterInputRef\} type="file" accept="image\/jpeg,image\/png" aria-label=\{t\('virtualStaging\.presenter\.select'\)\} hidden/)
  assert.doesNotMatch(page, /ref=\{presenterInputRef\} type="file"[^>]*multiple/)
  assert.match(page, /URL\.createObjectURL\(file\)/)
  assert.match(page, /URL\.revokeObjectURL\(presenterReferenceRef\.current\.preview\)/)
})

test('presenter preview is removable and replaceable and remains separate from property images', () => {
  assert.match(page, /virtualStaging\.presenter\.photo/)
  assert.match(page, /virtualStaging\.presenter\.replace/)
  assert.match(page, /virtualStaging\.presenter\.remove/)
  assert.match(page, /copy\('selectPhotos'\)/)
  assert.match(page, /presenterReference[\s\S]*images/)
})

test('uses the approved Module 3 demo with audio-enabled protected modal', () => {
  const journey = getVirtualStagingJourney(BROKER_PRESENTATION_JOURNEY_ID)
  assert.equal(journey?.demoVideo, '/demos-videos/apresentacao-pelo-proprio-corretor.mp4')
  assert.equal(journey?.demoAssetStatus, 'official')
  assert.match(page, /const hasOfficialDemo = journey\.demoAssetStatus === 'official'/)
  assert.match(page, /virtualStaging\.demo\.view/)
  assert.match(page, /activeDemo\.demoVideo/)
  assert.match(page, /autoPlay playsInline controls preload="metadata"/)
  assert.match(page, /controlsList="nodownload noremoteplayback"/)
  assert.match(page, /disablePictureInPicture/)
  assert.match(page, /onContextMenu=\{event => event\.preventDefault\(\)\}/)
  const modalVideo = page.match(/<video key=\{activeDemo\.id\}[\s\S]*?\/>/)?.[0] || ''
  assert.doesNotMatch(modalVideo, /\bmuted\b/)
})

test('identity notice and temporary-use communication are shown literally', () => {
  assert.match(page, /virtualStaging\.presenter\.notice/)
  assert.match(page, /virtualStaging\.presenter\.similarity/)
})

test('broker journey keeps phone independent, CTA optional, rental states and final summary', () => {
  assert.match(page, /property\.purpose === 'rent' \? LIFE_RENTAL_STAGE_OPTIONS : STAGES/)
  for (const stage of ['Pronto para morar', 'Disponível já', 'Vago']) assert.match(read('frontend/src/config/virtualStagingLife.js'), new RegExp(stage))
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'captions', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'cta_enabled')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'cta_enabled', answerId: 'yes', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'cta')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'cta_enabled', answerId: 'no', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'phone')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'cta', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'phone')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'phone', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'professional_identity')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'professional_identity', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'review')
  assert.match(page, /virtualStaging\.lifeBroker\.presentation/)
  assert.match(page, /virtualStaging\.lifeBroker\.ownImage/)
  assert.match(page, /virtualStaging\.presenter\.photo/)
  assert.match(page, /virtualStaging\.lifeBroker\.temporaryImage/)
  assert.match(page, /virtualStaging\.history\.phoneProfessional/)
  assert.match(page, /virtualStaging\.history\.phoneNone/)
})

test('broker generation sends one separate presenter reference without mixing property images', () => {
  const propertyImagePaths = ['user/virtual-staging/request/01.jpg', 'user/virtual-staging/request/02.jpg']
  const presenterReferencePath = 'user/virtual-staging/request/presenter-reference.jpg'
  assert.deepEqual(buildBrokerPresentationFilePayload({ presenterReferencePath, propertyImagePaths }), {
    module: 'broker-presentation',
    presenter_reference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: presenterReferencePath },
    property_images: { image_paths: propertyImagePaths, image_order: propertyImagePaths },
  })
  assert.deepEqual(buildBrokerPresentationGenerationPayload({ captions: 'disabled' }), {
    mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'disabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR', presenterSpeechMode: 'generated', presenterCustomSpeech: '',
  })
  assert.match(page, /presenter-reference\.\$\{presenterFile\.type === 'image\/png' \? 'png' : 'jpg'\}/)
  assert.match(page, /buildBrokerPresentationFilePayload\(\{ presenterReferencePath, propertyImagePaths: imagePaths \}\)/)
  assert.match(page, /if \(isBrokerPresentation && !presenterReference\?\.file\)/)
  assert.doesNotMatch(page, /Geração disponível na próxima etapa|Nenhuma imagem será enviada nesta homologação de UX/)
  assert.doesNotMatch(page, /disabled=\{isBrokerPresentation \|\|/)

  const virtualGenerator = read('supabase/functions/virtual-staging-generate/index.ts')
  assert.match(virtualGenerator, /presenterReferencePath/)
  assert.match(virtualGenerator, /images:\[\.\.\.presenterImages,\.\.\.images\]/)
  assert.doesNotMatch(read('supabase/functions/smart-tour-generate/index.ts'), /presenter_reference|presenterReferencePath|broker-presentation/)
})

test('custom presenter speech skips highlights only and remains literal in the generation contract', () => {
  assert.equal(BROKER_CUSTOM_SPEECH_MAX_WORDS, 25)
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'custom', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'presenter_custom_speech')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_custom_speech', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'captions')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_speech_mode', answerId: 'generated', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'highlights')
  assert.match(page, /if \(id === 'presenter_custom_speech'\)/)
  assert.match(page, /virtualStaging\.speech\.limit/)
  assert.match(page, /buildBrokerPresentationGenerationPayload\(\{ captions: generation\.captions, presenterSpeechMode, presenterCustomSpeech, language: draftLocale \}\)/)
})

test('Modules 1 and 2 retain their approved branching', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'furnish-renovate' }), 'review')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: LIFE_IN_PROPERTY_JOURNEY_ID }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'life_scene', journeyId: LIFE_IN_PROPERTY_JOURNEY_ID }), 'captions')
})

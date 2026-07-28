import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion } from '../src/config/virtualStagingConversation.js'
import {
  BROKER_PRESENTATION_JOURNEY_ID,
  BROKER_REFERENCE_OPTIONS,
  buildBrokerPresentationFilePayload,
  buildBrokerPresentationGenerationPayload,
  validatePresenterReferenceSelection,
} from '../src/config/virtualStagingBroker.js'
import { LIFE_IN_PROPERTY_JOURNEY_ID } from '../src/config/virtualStagingLife.js'

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
    'highlights',
    'captions',
    'cta',
    'phone',
    'review',
  ])
  assert.equal(sequence.includes('life_scene'), false)
  assert.equal(sequence.includes('presenter'), false)
  assert.equal(sequence.includes('narration'), false)
  assert.equal(sequence.includes('cta_enabled'), false)
})

test('declining an own image stops the journey and points to Video Imobiliario', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'presenter_reference', answerId: 'no', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'presenter_reference_required')
  assert.match(page, /Este módulo utiliza uma foto sua como referência para criar o apresentador\. Sem uma foto de referência, utilize o Vídeo Imobiliário para criar sua apresentação\./)
  assert.match(page, />Ir para Vídeo Imobiliário</)
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

  assert.match(page, /ref=\{presenterInputRef\} type="file" accept="image\/jpeg,image\/png" hidden/)
  assert.doesNotMatch(page, /ref=\{presenterInputRef\} type="file"[^>]*multiple/)
  assert.match(page, /URL\.createObjectURL\(file\)/)
  assert.match(page, /URL\.revokeObjectURL\(presenterReferenceRef\.current\.preview\)/)
})

test('presenter preview is removable and replaceable and remains separate from property images', () => {
  assert.match(page, /Foto do apresentador/)
  assert.match(page, /Preview da foto do apresentador/)
  assert.match(page, />Substituir foto</)
  assert.match(page, />Remover foto</)
  assert.match(page, /Imagens do imóvel/)
  assert.match(page, /Selecionar fotos do imóvel/)
  assert.match(page, /presenterReference[\s\S]*images/)
})

test('identity notice and temporary-use communication are shown literally', () => {
  assert.match(page, /Ela será utilizada somente nesta criação como referência para o apresentador\./)
  assert.match(page, /A IA utilizará sua foto como referência de identidade\. O apresentador será semelhante a você, mas pequenas diferenças de aparência podem ocorrer durante a geração\./)
})

test('broker journey keeps optional phone, mandatory CTA, rental states and final summary', () => {
  assert.match(page, /\[LIFE_IN_PROPERTY_JOURNEY_ID, BROKER_PRESENTATION_JOURNEY_ID\]\.includes\(journeyId\)/)
  for (const stage of ['Pronto para morar', 'Disponível já', 'Vago']) assert.match(read('frontend/src/config/virtualStagingLife.js'), new RegExp(stage))
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'captions', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'cta')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'cta', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'phone')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'phone', journeyId: BROKER_PRESENTATION_JOURNEY_ID }), 'review')
  assert.match(page, /Apresentação pelo Corretor: Imagem própria enviada/)
  assert.match(page, /Foto do apresentador: 1 imagem temporária/)
  assert.match(page, /\{ label: 'Apresentação pelo Corretor', value: 'Imagem própria enviada' \}/)
  assert.match(page, /\{ label: 'Foto do apresentador', value: '1 imagem temporária' \}/)
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
    mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'disabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR',
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

test('Modules 1 and 2 retain their approved branching', () => {
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: 'furnish-renovate' }), 'presenter')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'highlights', journeyId: LIFE_IN_PROPERTY_JOURNEY_ID }), 'life_scene')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'life_scene', journeyId: LIFE_IN_PROPERTY_JOURNEY_ID }), 'captions')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildSmartTourStructuredBriefing as buildVirtualStagingBriefing,
  validateSmartTourRequest as validateVirtualStagingRequest,
} from '../../supabase/functions/_shared/virtual-staging/index.ts'
import {
  buildSmartTourStructuredBriefing as buildOriginalSmartTourBriefing,
  validateSmartTourRequest as validateOriginalSmartTourRequest,
} from '../../supabase/functions/_shared/smart-tour/index.ts'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')

const propertyImagePaths = [
  'user/virtual-staging/00000000-0000-4000-8000-000000000003/01.jpg',
  'user/virtual-staging/00000000-0000-4000-8000-000000000003/02.png',
]
const presenterReferencePath = 'user/virtual-staging/00000000-0000-4000-8000-000000000003/presenter-reference.jpg'
const baseRequest = {
  clientRequestId: '00000000-0000-4000-8000-000000000003',
  imagePaths: propertyImagePaths,
  imageOrder: [...propertyImagePaths],
  property: { purpose: 'sale', stage: 'Pronto para morar', type: 'Apartamento', state: 'SP', city: 'São Paulo', district: 'Moema', highlights: ['Varanda gourmet'] },
  generation: { mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' },
  selectedCta: 'Agende sua visita',
  includeProfessionalPhone: false,
  language: 'pt-BR',
}
const brokerRequest = {
  ...baseRequest,
  module: 'broker-presentation',
  presenter_reference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: presenterReferencePath },
  property_images: { image_paths: [...propertyImagePaths], image_order: [...propertyImagePaths] },
}

test('backend requires exactly one valid presenter_reference for broker-presentation', () => {
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, presenter_reference: undefined }), /invalid_presenter_reference/)
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, presenter_reference: [] }), /invalid_presenter_reference/)
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, presenter_reference: [brokerRequest.presenter_reference, brokerRequest.presenter_reference] }), /invalid_presenter_reference/)
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, presenter_reference: { ...brokerRequest.presenter_reference, image_path: 'reference.webp' } }), /invalid_presenter_reference/)
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, presenter_reference: { ...brokerRequest.presenter_reference, image_path: propertyImagePaths[0] } }), /invalid_property_images/)
})

test('backend preserves presenter_reference and property_images as distinct categories', () => {
  const validated = validateVirtualStagingRequest(brokerRequest)
  assert.deepEqual(validated.presenter_reference, brokerRequest.presenter_reference)
  assert.deepEqual(validated.property_images, brokerRequest.property_images)
  assert.deepEqual(validated.imagePaths, propertyImagePaths)
  assert.equal(validated.imagePaths.includes(validated.presenter_reference.image_path), false)
})

test('structured briefing receives identity reference without adding it to property scenes', () => {
  const validated = validateVirtualStagingRequest(brokerRequest)
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })
  assert.equal(briefing.apresentador.tipo, 'referencia_do_usuario')
  assert.deepEqual(briefing.referenciaApresentador, { ...brokerRequest.presenter_reference, posicaoNaEntrada: 1, usoExclusivo: 'referencia_de_identidade' })
  assert.deepEqual(briefing.sequenciaDasImagens, propertyImagePaths)
  assert.deepEqual(briefing.cenas.map(scene => scene.imagem), propertyImagePaths)
  assert.equal(briefing.configuracoes.quantidadeImagens, propertyImagePaths.length)
  const rules = briefing.regrasObrigatorias.map(rule => `${rule.codigo}: ${rule.valor}`).join('\n')
  for (const expected of [
    'IMAGE 1 — PRESENTER IDENTITY',
    'single source of truth',
    'identity reference, never as a style reference',
    'IMAGES 2 TO 3 — PROPERTY',
    'two immutable visual references',
    'immediately recognizable as the same individual',
    'Identity preservation always takes precedence over aesthetic enhancement',
    'preserve the presenter.s identity instead of generating a different-looking individual',
    'formato do rosto, olhos, nariz, boca, sorriso, cabelo',
    'Não copiar fundo, roupa ou pose',
    'traje formal padrão do mercado imobiliário',
    'imóvel como protagonista',
    'Pequenas diferenças naturais podem ocorrer',
    'Não prometer fidelidade absoluta',
  ]) assert.match(rules, new RegExp(expected, 'i'))
  for (const forbidden of ['100% identical', 'exact clone', 'pixel perfect']) assert.doesNotMatch(rules, new RegExp(forbidden, 'i'))
})

test('generator loads reference separately and sends property images only to scenes and job columns', () => {
  const generator = read('supabase/functions/virtual-staging-generate/index.ts')
  assert.match(generator, /const requestedPaths = presenterReferencePath \? \[presenterReferencePath, \.\.\.input\.imagePaths\]/)
  assert.match(generator, /prepareGeminiImages\(supabase,'studio-videos',\[presenterReferencePath\]\)/)
  assert.match(generator, /images:\[\.\.\.presenterImages,\.\.\.images\]/)
  assert.match(generator, /input_image_1_path:input\.imagePaths\[0\]/)
  assert.doesNotMatch(generator, /input_image_1_path:presenterReferencePath/)
})

test('Module 2 and original smart-tour contracts remain unchanged', () => {
  const lifeRequest = {
    ...baseRequest,
    generation: { ...baseRequest.generation, mode: 'narrated_tour', life_scene: 'adult_dog' },
  }
  assert.equal(validateVirtualStagingRequest(lifeRequest).generation.life_scene, 'adult_dog')

  const originalValidated = validateOriginalSmartTourRequest(baseRequest)
  const virtualValidated = validateVirtualStagingRequest(baseRequest)
  assert.deepEqual(virtualValidated, originalValidated)
  const input = { generation: originalValidated.generation, property: originalValidated.property, selectedCta: originalValidated.selectedCta, imagePaths: originalValidated.imagePaths, language: originalValidated.language }
  assert.deepEqual(buildVirtualStagingBriefing(input), buildOriginalSmartTourBriefing(input))
  assert.doesNotMatch(read('supabase/functions/smart-tour-generate/index.ts'), /presenter_reference|property_images|broker-presentation/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildSmartTourStructuredBriefing as buildVirtualStagingBriefing,
  buildSmartTourCaptionRenderScript,
  parseSmartTourStructuredBriefing,
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

test('status validator accepts five captions only for life or presenter-reference briefings', () => {
  const brokerValidated = validateVirtualStagingRequest(brokerRequest)
  const brokerBriefing = buildVirtualStagingBriefing({
    generation: brokerValidated.generation,
    property: brokerValidated.property,
    selectedCta: brokerValidated.selectedCta,
    imagePaths: brokerValidated.imagePaths,
    language: brokerValidated.language,
    presenterReference: brokerValidated.presenter_reference,
  })
  assert.equal(brokerBriefing.timeline.legendas.length, 5)
  assert.doesNotThrow(() => parseSmartTourStructuredBriefing(JSON.stringify(brokerBriefing)))

  const standardValidated = validateVirtualStagingRequest(baseRequest)
  const standardBriefing = buildVirtualStagingBriefing({
    generation: standardValidated.generation,
    property: standardValidated.property,
    selectedCta: standardValidated.selectedCta,
    imagePaths: standardValidated.imagePaths,
    language: standardValidated.language,
  })
  assert.equal(standardBriefing.timeline.legendas.length, 4)
  assert.doesNotThrow(() => parseSmartTourStructuredBriefing(JSON.stringify(standardBriefing)))
})

test('custom broker speech uses literal deterministic audio and captions without property additions', () => {
  const speech = 'Conheça este imóvel incrível perto de tudo'
  const validated = validateVirtualStagingRequest({
    ...brokerRequest,
    generation: { ...brokerRequest.generation, presenterSpeechMode: 'custom', presenterCustomSpeech: speech, captions: 'enabled' },
    selectedCta: '',
    includeProfessionalPhone: true,
  })
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    phone: '11999999999',
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })
  assert.equal(briefing.timeline.narracao.map(block => block.texto).filter(Boolean).join(' '), speech)
  assert.equal(briefing.timeline.legendas.map(block => block.texto).filter(Boolean).join(' '), speech)
  assert.equal(briefing.timeline.narracao.some(block => /Moema|Apartamento|venda/i.test(block.texto)), false)
  assert.equal(briefing.timeline.cta.texto, '')
  assert.equal(briefing.timeline.cta.telefone, '11999999999')
  const render = buildSmartTourCaptionRenderScript('https://example.com/video.mp4', briefing)
  assert.equal(render.elements[0].volume, '0%')
  const audio = render.elements.find(element => element.name === 'Broker-Custom-Literal-Speech')
  assert.deepEqual(audio && { source: audio.source, duration: audio.duration, provider: audio.provider }, { source: speech, duration: 10, provider: 'openai model=tts-1 voice=nova' })
})

test('custom broker speech can disable captions without disabling literal audio', () => {
  const speech = 'Conheça este imóvel incrível perto de tudo'
  const validated = validateVirtualStagingRequest({ ...brokerRequest, generation: { ...brokerRequest.generation, presenterSpeechMode: 'custom', presenterCustomSpeech: speech, captions: 'disabled' } })
  const briefing = buildVirtualStagingBriefing({ generation: validated.generation, property: validated.property, selectedCta: '', imagePaths: validated.imagePaths, language: validated.language, presenterReference: validated.presenter_reference })
  assert.equal(briefing.timeline.legendas.every(block => block.texto === ''), true)
  const render = buildSmartTourCaptionRenderScript('https://example.com/video.mp4', briefing)
  assert.equal(render.elements.some(element => element.name === 'Broker-Custom-Literal-Speech'), true)
})

test('twenty-five custom words use the complete ten-second literal audio window', () => {
  const speech = Array.from({ length: 25 }, (_, index) => `palavra${index + 1}`).join(' ')
  const validated = validateVirtualStagingRequest({ ...brokerRequest, generation: { ...brokerRequest.generation, presenterSpeechMode: 'custom', presenterCustomSpeech: speech } })
  const briefing = buildVirtualStagingBriefing({ generation: validated.generation, property: validated.property, selectedCta: '', imagePaths: validated.imagePaths, language: validated.language, presenterReference: validated.presenter_reference })
  const render = buildSmartTourCaptionRenderScript('https://example.com/video.mp4', briefing)
  const audio = render.elements.find(element => element.name === 'Broker-Custom-Literal-Speech')
  assert.equal(briefing.timeline.narracao.map(block => block.texto).filter(Boolean).join(' '), speech)
  assert.equal(audio?.duration, 10)
  assert.equal(audio?.source, speech)
  assert.throws(() => validateVirtualStagingRequest({ ...brokerRequest, generation: { ...brokerRequest.generation, presenterSpeechMode: 'custom', presenterCustomSpeech: `${speech} excedente` } }), /invalid_presenter_custom_speech/)
})

test('custom broker composition is recoverable from the stored briefing without a new visual provider call', () => {
  const generator = read('supabase/functions/virtual-staging-generate/index.ts')
  const status = read('supabase/functions/virtual-staging-status/index.ts')
  assert.match(generator, /requiresCaptionRender:hasDeterministicSmartTourText\(briefing\)/)
  assert.match(status, /parseSmartTourStructuredBriefing\(job\.prompt_final\)/)
  assert.match(status, /startSmartTourCaptionRender\(creatomateKey, rawUrl\.signedUrl, briefing\)/)
  assert.match(status, /checkSmartTourCaptionRender\(creatomateKey, captionRenderId\)/)
})

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
  assert.match(rules, /virtual_space_composicao_vertical_segura/i)
  assert.match(rules, /composição vertical 9:16/i)
  assert.match(rules, /pessoa principal dentro da área segura vertical/i)
  for (const forbidden of ['100% identical', 'exact clone', 'pixel perfect']) assert.doesNotMatch(rules, new RegExp(forbidden, 'i'))
})

test('broker presentation reuses the complete rental commercial sequence from Module 2', () => {
  const validated = validateVirtualStagingRequest({
    ...brokerRequest,
    property: {
      ...brokerRequest.property,
      purpose: 'rental',
      stage: 'Disponível já',
      bedrooms: '2',
      suites: '1',
      parkingSpaces: '1',
      price: 'R$ 4.500',
      highlights: ['Varanda gourmet', 'Vista livre'],
    },
  })
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })

  assert.equal(briefing.imovel.finalidade, 'Locação')
  assert.match(briefing.timeline.narracao[0].texto, /apartamento.*para locação.*Moema.*São Paulo/i)
  assert.match(briefing.timeline.narracao[1].texto, /2 dormitórios.*1 suíte.*1 vaga de garagem/i)
  assert.match(briefing.timeline.narracao[2].texto, /disponível já/i)
  assert.equal(briefing.timeline.narracao[4].texto, 'Agende sua visita.')
  assert.deepEqual(briefing.timeline.legendas.map(block => block.texto), [
    'PARA LOCAÇÃO',
    'Disponível já',
    'Moema, São Paulo',
    'Varanda gourmet',
    'R$ 4.500',
  ])
  assert.equal(briefing.cenas[0].legenda, 'PARA LOCAÇÃO')
  assert.equal(briefing.cta.titulo, brokerRequest.selectedCta)
  assert.equal(briefing.timeline.cta.titulo, brokerRequest.selectedCta)
  assert.equal(briefing.timeline.cta.bloco, 6)
})

test('broker presentation reuses the sale sequence without weakening presenter identity rules', () => {
  const validated = validateVirtualStagingRequest({
    ...brokerRequest,
    property: {
      ...brokerRequest.property,
      price: 'R$ 850.000',
      highlights: ['Varanda gourmet', 'Vista livre'],
    },
  })
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })

  assert.match(briefing.timeline.narracao[0].texto, /apartamento.*à venda.*Moema.*São Paulo/i)
  assert.deepEqual(briefing.timeline.legendas.map(block => block.texto), [
    'À VENDA',
    'Pronto para morar',
    'Moema, São Paulo',
    'Varanda gourmet',
    'R$ 850.000',
  ])
  const rules = briefing.regrasObrigatorias.map(rule => `${rule.codigo}: ${rule.valor}`).join('\n')
  for (const identityRule of [
    'IMAGE 1 — PRESENTER IDENTITY',
    'single source of truth',
    'identity reference, never as a style reference',
    'two immutable visual references',
    'Identity preservation always takes precedence over aesthetic enhancement',
    'Não copiar fundo, roupa ou pose',
    'traje formal padrão do mercado imobiliário',
  ]) assert.match(rules, new RegExp(identityRule, 'i'))
  assert.match(rules, /finalidade_narracao_apresentacao_corretor: .*Não omitir nem inferir a finalidade/i)
  assert.match(rules, /finalidade_legenda_apresentacao_corretor: .*Não omitir, inferir nem substituir/i)
  assert.match(rules, /sequencia_comercial_apresentacao_corretor/)
  assert.match(rules, /sequencia_narracao_apresentacao_corretor/)
})

test('broker presentation does not create narration or captions when each option is disabled', () => {
  const validated = validateVirtualStagingRequest({
    ...brokerRequest,
    generation: { ...brokerRequest.generation, narration: 'disabled', captions: 'disabled' },
  })
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })

  assert.ok(briefing.timeline.narracao.every(block => block.texto === ''))
  assert.ok(briefing.timeline.legendas.every(block => block.texto === ''))
  assert.ok(briefing.cenas.slice(0, -1).every(scene => scene.narracao === '' && scene.legenda === ''))
  assert.equal(briefing.timeline.cta.titulo, brokerRequest.selectedCta)
})

test('generator loads reference separately and sends property images only to scenes and job columns', () => {
  const generator = read('supabase/functions/virtual-staging-generate/index.ts')
  assert.match(generator, /const requestedPaths = presenterReferencePath \? \[presenterReferencePath, \.\.\.input\.imagePaths\]/)
  assert.match(generator, /prepareGeminiImages\(supabase,'studio-videos',\[presenterReferencePath\]\)/)
  assert.match(generator, /images:\[\.\.\.presenterImages,\.\.\.images\]/)
  assert.match(generator, /input_image_1_path:input\.imagePaths\[0\]/)
  assert.doesNotMatch(generator, /input_image_1_path:presenterReferencePath/)
})

test('Module 2 and original smart-tour contracts remain unchanged outside text composition', () => {
  const lifeRequest = {
    ...baseRequest,
    generation: { ...baseRequest.generation, mode: 'narrated_tour', life_scene: 'adult_dog' },
  }
  assert.equal(validateVirtualStagingRequest(lifeRequest).generation.life_scene, 'adult_dog')

  const originalValidated = validateOriginalSmartTourRequest(baseRequest)
  const virtualValidated = validateVirtualStagingRequest(baseRequest)
  assert.deepEqual(virtualValidated, originalValidated)
  const input = { generation: originalValidated.generation, property: originalValidated.property, selectedCta: originalValidated.selectedCta, imagePaths: originalValidated.imagePaths, language: originalValidated.language }
  const { regrasObrigatorias: virtualRules, ...virtualContract } = buildVirtualStagingBriefing(input)
  const { regrasObrigatorias: originalRules, ...originalContract } = buildOriginalSmartTourBriefing(input)
  assert.deepEqual(virtualContract, originalContract)
  assert.ok(originalRules.length > 0)
  assert.match(virtualRules.map(rule => `${rule.codigo}: ${rule.valor}`).join('\n'), /legendas_aplicadas_por_compositor_deterministico/)
  assert.doesNotMatch(read('supabase/functions/smart-tour-generate/index.ts'), /presenter_reference|property_images|broker-presentation/)
})

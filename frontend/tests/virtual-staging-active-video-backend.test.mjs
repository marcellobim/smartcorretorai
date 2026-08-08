import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildSmartTourCaptionRenderScript,
  buildSmartTourStructuredBriefing,
  parseSmartTourStructuredBriefing,
  validateSmartTourRequest,
} from '../../supabase/functions/_shared/virtual-staging/index.ts'
import { buildGeminiOmniRequestBody } from '../../supabase/functions/_shared/geminiOmniClient.ts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const generateSource = read('supabase/functions/virtual-staging-generate/index.ts')
const statusSource = read('supabase/functions/virtual-staging-status/index.ts')
const alternateProviderName = String.fromCharCode(86, 101, 111)
const alternateProviderPattern = new RegExp(`start${alternateProviderName}Video|${alternateProviderName}Client|${alternateProviderName}_`, 'i')

const imagePaths = [
  'user/virtual-staging/00000000-0000-4000-8000-000000000010/01.jpg',
  'user/virtual-staging/00000000-0000-4000-8000-000000000010/02.png',
]
const property = {
  purpose: 'sale',
  stage: 'Pronto para morar',
  type: 'Apartamento',
  bedrooms: '3',
  suites: '1',
  parkingSpaces: '2',
  state: 'SP',
  city: 'São Paulo',
  district: 'Moema',
  price: 'R$ 950.000',
  highlights: ['Varanda gourmet', 'Vista livre'],
}
const generation = {
  mode: 'narrated_tour',
  narration: 'enabled',
  captions: 'enabled',
  furniture: 'original',
  stagingPresentation: 'final_only',
  language: 'pt-BR',
}
const baseRequest = {
  clientRequestId: '00000000-0000-4000-8000-000000000010',
  imagePaths,
  imageOrder: [...imagePaths],
  property,
  generation,
  selectedCta: 'Agende sua visita',
  includeProfessionalPhone: false,
  language: 'pt-BR',
}

function briefingFor(request) {
  const validated = validateSmartTourRequest(request)
  return buildSmartTourStructuredBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
    presenterReference: validated.presenter_reference,
  })
}

test('Vida no Imóvel e Apresentação pelo Corretor permanecem no provider Gemini', () => {
  assert.match(generateSource, /from '\.\.\/_shared\/geminiOmniClient\.ts'/)
  assert.match(generateSource, /mode:'virtual_staging_gemini_omni'/)
  assert.match(generateSource, /model:SMART_TOUR_GEMINI_OMNI_MODEL/)
  assert.match(generateSource, /const activeVerticalVideo = Boolean\(input\.generation\.life_scene\) \|\| input\.module === 'broker-presentation'/)
  assert.match(generateSource, /startGeminiOmniVideo\(\{prompt,images:\[\.\.\.presenterImages,\.\.\.images\],\.\.\.\(activeVerticalVideo \? \{aspectRatio:'9:16' as const\} : \{\}\)\}\)/)
  assert.doesNotMatch(generateSource, alternateProviderPattern)
})

test('payload Gemini mantém saída física vertical 9:16', () => {
  const body = buildGeminiOmniRequestBody('briefing controlado', [{
    type: 'input_image',
    data: 'base64-controlado',
    mime_type: 'image/jpeg',
  }], '9:16')
  assert.equal(body.response_format.type, 'video')
  assert.equal(body.response_format.aspect_ratio, '9:16')
})

test('Vida no Imóvel usa cinco blocos e composição determinística vertical', () => {
  const briefing = briefingFor({
    ...baseRequest,
    generation: { ...generation, life_scene: 'adult_dog' },
  })
  assert.equal(briefing.timeline.legendas.length, 5)
  assert.doesNotThrow(() => parseSmartTourStructuredBriefing(JSON.stringify(briefing)))
  const render = buildSmartTourCaptionRenderScript('https://example.test/life.mp4', briefing)
  assert.equal(render.width, 720)
  assert.equal(render.height, 1280)
})

test('Apresentação pelo Corretor usa referência separada e cinco blocos', () => {
  const presenterPath = 'user/virtual-staging/00000000-0000-4000-8000-000000000010/presenter-reference.jpg'
  const briefing = briefingFor({
    ...baseRequest,
    generation: { ...generation, mode: 'guided_tour' },
    module: 'broker-presentation',
    presenter_reference: {
      enabled: true,
      source: 'temporary_upload',
      purpose: 'identity_reference',
      image_path: presenterPath,
    },
    property_images: { image_paths: [...imagePaths], image_order: [...imagePaths] },
  })
  assert.equal(briefing.timeline.legendas.length, 5)
  assert.deepEqual(briefing.sequenciaDasImagens, imagePaths)
  assert.equal(briefing.sequenciaDasImagens.includes(presenterPath), false)
  assert.doesNotThrow(() => parseSmartTourStructuredBriefing(JSON.stringify(briefing)))
})

test('briefing comum preserva quatro blocos', () => {
  const briefing = briefingFor({
    ...baseRequest,
    generation: { ...generation, mode: 'guided_tour', life_scene: undefined },
  })
  assert.equal(briefing.timeline.legendas.length, 4)
  assert.doesNotThrow(() => parseSmartTourStructuredBriefing(JSON.stringify(briefing)))
})

test('status mantém o compositor determinístico como camada controlada', () => {
  assert.match(statusSource, /startSmartTourCaptionRender/)
  assert.match(statusSource, /parseSmartTourStructuredBriefing/)
  assert.doesNotMatch(statusSource, alternateProviderPattern)
})

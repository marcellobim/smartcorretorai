import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartTourStructuredBriefing as buildVirtualStagingBriefing,
  buildSmartTourVideoPrompt,
  validateSmartTourRequest as validateVirtualStagingRequest,
} from '../../supabase/functions/_shared/virtual-staging/index.ts'
import {
  buildSmartTourStructuredBriefing as buildOriginalSmartTourBriefing,
  validateSmartTourRequest as validateOriginalSmartTourRequest,
} from '../../supabase/functions/_shared/smart-tour/index.ts'

const LIFE_SCENES = [
  'young',
  'young_dog',
  'young_cat',
  'adult',
  'adult_dog',
  'adult_cat',
  'senior',
  'senior_dog',
  'senior_cat',
]

const imagePaths = ['user/virtual-staging/request/01.jpg', 'user/virtual-staging/request/02.jpg']
const property = {
  purpose: 'sale',
  stage: 'Pronto para morar',
  type: 'Apartamento',
  bedrooms: '3',
  suites: '1',
  parkingSpaces: '2',
  area: '120',
  state: 'SP',
  city: 'São Paulo',
  district: 'Moema',
  highlights: ['Varanda gourmet'],
}
const generation = {
  mode: 'narrated_tour',
  narration: 'enabled',
  captions: 'enabled',
  furniture: 'original',
  stagingPresentation: 'final_only',
  language: 'pt-BR',
}
const request = (lifeScene) => ({
  clientRequestId: '00000000-0000-4000-8000-000000000001',
  imagePaths,
  imageOrder: [...imagePaths],
  property,
  generation: lifeScene === undefined ? generation : { ...generation, life_scene: lifeScene },
  selectedCta: 'Agende sua visita',
  includeProfessionalPhone: false,
  language: 'pt-BR',
})

test('backend accepts exactly the nine approved life_scene values and preserves them internally', () => {
  for (const lifeScene of LIFE_SCENES) {
    const validated = validateVirtualStagingRequest(request(lifeScene))
    assert.equal(validated.generation.life_scene, lifeScene)
  }
})

test('backend rejects missing-domain and malformed life_scene values before generation', () => {
  for (const invalid of ['', 'none', 'young_with_dog', 'adult ', null, 1, true]) {
    assert.throws(() => validateVirtualStagingRequest(request(invalid)), /invalid_life_scene/)
  }
})

test('structured generation payload includes the selected life profile and mandatory preservation rules', () => {
  const validated = validateVirtualStagingRequest(request('adult_dog'))
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
  })
  const prompt = buildSmartTourVideoPrompt(briefing)

  assert.deepEqual(briefing.vidaNoImovel, { life_scene: 'adult_dog', descricao: 'adultos com cachorro' })
  assert.match(prompt, /"life_scene":"adult_dog"/)
  assert.deepEqual(briefing.sequenciaDasImagens, imagePaths)
  assert.equal(briefing.configuracoes.duracaoSegundos, 10)
  assert.equal(briefing.configuracoes.narracaoAtiva, true)
  assert.equal(briefing.cta.titulo, 'Agende sua visita')
  assert.match(prompt, /Incluir naturalmente adultos com cachorro durante o vídeo/)
  assert.match(prompt, /O imóvel deve permanecer como protagonista em todas as cenas/)
  assert.match(prompt, /não autoriza modificar a arquitetura original, acabamentos, materiais/)
  assert.match(prompt, /Não reconstruir ambientes/)
  assert.match(prompt, /respeitar integralmente a ordem original das imagens/)
})

test('Vida no Imovel makes sale purpose mandatory in narration and the first active caption', () => {
  const validated = validateVirtualStagingRequest(request('adult'))
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
  })

  assert.match(briefing.timeline.narracao[0].texto, /à venda/i)
  assert.equal(briefing.timeline.legendas[0].texto, 'À VENDA')
  assert.match(briefing.timeline.legendas[1].texto, /^Pronto para morar/)
  assert.doesNotMatch(briefing.timeline.legendas[0].texto, /Pronto para morar/)
})

test('Vida no Imovel makes rent and rental purpose mandatory as para locacao', () => {
  for (const purpose of ['rent', 'rental']) {
    const validated = validateVirtualStagingRequest({
      ...request('senior_cat'),
      property: { ...property, purpose },
    })
    const briefing = buildVirtualStagingBriefing({
      generation: validated.generation,
      property: validated.property,
      selectedCta: validated.selectedCta,
      imagePaths: validated.imagePaths,
      language: validated.language,
    })

    assert.match(briefing.timeline.narracao[0].texto, /para locação/i)
    assert.equal(briefing.timeline.legendas[0].texto, 'PARA LOCAÇÃO')
    assert.match(briefing.timeline.legendas[1].texto, /^Pronto para morar/)
  }
})

test('requests without life_scene remain byte-compatible with the original Video Imobiliario engine', () => {
  const virtualInput = validateVirtualStagingRequest(request(undefined))
  const originalInput = validateOriginalSmartTourRequest(request(undefined))
  assert.deepEqual(virtualInput, originalInput)

  const briefingInput = {
    generation: virtualInput.generation,
    property: virtualInput.property,
    selectedCta: virtualInput.selectedCta,
    imagePaths: virtualInput.imagePaths,
    language: virtualInput.language,
  }
  const virtualBriefing = buildVirtualStagingBriefing(briefingInput)
  const originalBriefing = buildOriginalSmartTourBriefing(briefingInput)
  assert.deepEqual(virtualBriefing, originalBriefing)
  assert.equal(JSON.stringify(virtualBriefing), JSON.stringify(originalBriefing))
})

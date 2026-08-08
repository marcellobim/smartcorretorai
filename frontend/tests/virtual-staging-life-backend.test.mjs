import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSmartTourCaptionRenderScript,
  buildSmartTourStructuredBriefing as buildVirtualStagingBriefing,
  buildSmartTourVideoPrompt,
  parseSmartTourStructuredBriefing,
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
  price: 'R$ 950.000',
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
  assert.throws(() => validateVirtualStagingRequest(request(undefined)), /invalid_life_scene/)
})

test('frontend commercial fields survive validation unchanged for Vida no Imovel', () => {
  const validated = validateVirtualStagingRequest(request('young'))
  assert.equal(validated.property.district, 'Moema')
  assert.equal(validated.property.city, 'São Paulo')
  assert.equal(validated.property.stage, 'Pronto para morar')
  assert.equal(validated.property.price, 'R$ 950.000')
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

test('Vida no Imovel makes type, sale purpose, district and city mandatory in the narration opening', () => {
  const validated = validateVirtualStagingRequest(request('adult'))
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
  })

  assert.equal(briefing.timeline.narracao[0].texto, 'Conheça este excelente apartamento à venda no bairro Moema, em São Paulo.')
  assert.match(briefing.timeline.narracao[0].texto, /apartamento.*à venda.*Moema.*São Paulo/i)
  assert.equal(briefing.timeline.narracao[1].texto, 'O imóvel possui 3 dormitórios, 1 suíte e 2 vagas de garagem.')
  assert.equal(briefing.timeline.narracao[2].texto, 'O imóvel está pronto para morar.')
  assert.equal(briefing.timeline.narracao[4].texto, 'Agende sua visita.')
  assert.equal(briefing.imovel.localizacao.bairro, 'Moema')
  assert.equal(briefing.imovel.localizacao.cidade, 'São Paulo')
  assert.equal(briefing.timeline.legendas[0].texto, 'À VENDA')
  assert.equal(briefing.timeline.legendas[1].texto, 'Pronto para morar')
  assert.equal(briefing.timeline.legendas[2].texto, 'Moema, São Paulo')
  assert.equal(briefing.timeline.legendas[3].texto, 'Varanda gourmet')
  assert.equal(briefing.timeline.legendas[4].texto, 'R$ 950.000')
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

    assert.equal(briefing.timeline.narracao[0].texto, 'Conheça este excelente apartamento para locação no bairro Moema, em São Paulo.')
    assert.match(briefing.timeline.narracao[0].texto, /apartamento.*para locação.*Moema.*São Paulo/i)
    assert.equal(briefing.timeline.legendas[0].texto, 'PARA LOCAÇÃO')
    assert.equal(briefing.timeline.legendas[1].texto, 'Pronto para morar')
    assert.equal(briefing.timeline.legendas[2].texto, 'Moema, São Paulo')
  }
})

test('Vida no Imovel sends each approved rental state to the second caption', () => {
  for (const stage of ['Pronto para morar', 'Disponível já', 'Vago']) {
    const validated = validateVirtualStagingRequest({
      ...request('young_dog'),
      property: { ...property, purpose: 'rent', stage },
    })
    const briefing = buildVirtualStagingBriefing({
      generation: validated.generation,
      property: validated.property,
      selectedCta: validated.selectedCta,
      imagePaths: validated.imagePaths,
      language: validated.language,
    })

    assert.equal(briefing.timeline.legendas[0].texto, 'PARA LOCAÇÃO')
    assert.equal(briefing.timeline.legendas[1].texto, stage)
    assert.match(briefing.timeline.narracao[2].texto, new RegExp(stage, 'i'))
  }
})

test('Vida no Imovel uses the second highlight when price was not informed', () => {
  const input = request('adult_cat')
  input.property = { ...property, price: '', highlights: ['Varanda gourmet', 'Vista livre'] }
  const validated = validateVirtualStagingRequest(input)
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
  })
  assert.equal(briefing.timeline.legendas[3].texto, 'Varanda gourmet')
  assert.equal(briefing.timeline.legendas[4].texto, 'Vista livre')
})

test('five commercial captions finish before the unchanged final CTA block', () => {
  const validated = validateVirtualStagingRequest(request('senior'))
  const briefing = buildVirtualStagingBriefing({
    generation: validated.generation,
    property: validated.property,
    selectedCta: validated.selectedCta,
    imagePaths: validated.imagePaths,
    language: validated.language,
  })
  const parsed = parseSmartTourStructuredBriefing(JSON.stringify(briefing))
  const script = buildSmartTourCaptionRenderScript('https://example.com/video.mp4', parsed)
  const textElements = script.elements.filter(element => element.type === 'text')

  assert.equal(briefing.timeline.legendas.length, 5)
  assert.equal(briefing.timeline.legendas.at(-1).fimSegundos, 8)
  assert.deepEqual([briefing.timeline.cta.inicioSegundos, briefing.timeline.cta.fimSegundos], [8, 10])
  assert.equal(briefing.timeline.cta.texto, 'Agende sua visita')
  assert.deepEqual(textElements.map(element => element.text), [
    'À VENDA',
    'Pronto para morar',
    'Moema, São Paulo',
    'Varanda gourmet',
    'R$ 950.000',
    'Agende sua visita',
  ])
})

test('non-life guided requests preserve the original contract except for deterministic text composition', () => {
  const nonLifeRequest = {
    ...request('adult'),
    generation: { ...generation, mode: 'guided_tour', presenterGender: 'female' },
  }
  const virtualInput = validateVirtualStagingRequest(nonLifeRequest)
  const originalInput = validateOriginalSmartTourRequest(nonLifeRequest)
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
  const { regrasObrigatorias: virtualRules, ...virtualContract } = virtualBriefing
  const { regrasObrigatorias: originalRules, ...originalContract } = originalBriefing
  assert.deepEqual(virtualContract, originalContract)
  assert.ok(originalRules.length > 0)
  assert.match(virtualRules.map(rule => `${rule.codigo}: ${rule.valor}`).join('\n'), /legendas_aplicadas_por_compositor_deterministico/)
})

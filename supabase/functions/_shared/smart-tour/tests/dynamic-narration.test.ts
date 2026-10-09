import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applySmartTourDynamicNarration,
  buildShortVideosStructuredBriefing,
  buildSmartTourStructuredBriefing,
  generateSmartTourDynamicNarration,
  SMART_TOUR_NARRATION_MAX_WORDS,
} from '../index.ts'

const property = {
  purpose: 'rent',
  type: 'Apartamento',
  stage: 'Pronto para morar',
  state: 'SP',
  city: 'São Paulo',
  district: 'Klabin',
  bedrooms: '2',
  suites: '1',
  parkingSpaces: '1',
  area: '72 m²',
  price: 'R$ 4.500',
  condominium: 'não deve ser enviado',
  iptu: 'não deve ser enviado',
  description: 'não deve ser enviada',
  highlights: ['Varanda', 'Próximo ao metrô'],
}

const generation = {
  mode: 'guided_tour', presenterGender: 'none', narration: 'enabled', captions: 'enabled',
  furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR',
} as const

test('uses the existing OpenAI chat transport and sends only the approved property fields', async () => {
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  const narration = 'No Klabin, este apartamento para alugar reúne dois dormitórios, varanda e acesso fácil ao metrô.'
  const result = await generateSmartTourDynamicNarration({
    apiKey: 'test-key',
    property,
    selectedCta: 'Agende sua visita',
    fetchImpl: async (url, init) => {
      requestUrl = String(url)
      requestInit = init
      return new Response(JSON.stringify({ choices: [{ message: { content: narration } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.equal(result, narration)
  assert.equal(requestUrl, 'https://api.openai.com/v1/chat/completions')
  assert.equal(requestInit?.method, 'POST')
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer test-key')
  const body = JSON.parse(String(requestInit?.body))
  assert.equal(body.model, 'gpt-4.1')
  assert.equal(body.messages.length, 2)
  assert.match(body.messages[0].content, /português brasileiro/)
  assert.match(body.messages[0].content, /à venda/)
  assert.match(body.messages[0].content, /para alugar/)
  const facts = JSON.parse(body.messages[1].content)
  assert.deepEqual(Object.keys(facts), [
    'finalidade', 'tipoDoImovel', 'estadoAtual', 'cidade', 'bairro', 'caracteristicasPrincipais',
    'destaquesPrincipais',
  ])
  assert.equal(facts.finalidade, 'Para alugar')
  assert.deepEqual(facts.caracteristicasPrincipais, ['2 dormitórios', '1 suítes'])
  assert.deepEqual(facts.destaquesPrincipais, ['Varanda', 'Próximo ao metrô'])
  assert.equal(body.temperature, 0.9)
  assert.equal(body.max_tokens, 80)
  assert.match(body.messages[0].content, new RegExp(`entre 12 e ${SMART_TOUR_NARRATION_MAX_WORDS} palavras`))
  assert.doesNotMatch(body.messages[1].content, /condomínio|IPTU|não deve ser enviada|CRECI|license|display_name/i)
})

test('rejects a narration that would exceed the natural ten-second speaking budget', async () => {
  const tooLong = ['Para alugar', ...Array.from({ length: SMART_TOUR_NARRATION_MAX_WORDS - 1 }, (_, index) => `palavra${index}`)].join(' ')
  const result = await generateSmartTourDynamicNarration({
    apiKey: 'test-key',
    property,
    selectedCta: 'Agende sua visita',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: tooLong } }] }), { status: 200 }),
  })
  assert.equal(result, null)
})

test('returns fallback signal for missing key, provider failure or invalid content', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Texto sem a finalidade e sem a chamada.' } }] }), { status: 200 })
  }
  assert.equal(await generateSmartTourDynamicNarration({ apiKey: '', property, selectedCta: 'Agende sua visita', fetchImpl }), null)
  assert.equal(calls, 0)
  assert.equal(await generateSmartTourDynamicNarration({ apiKey: 'test-key', property, selectedCta: 'Agende sua visita', fetchImpl }), null)
  assert.equal(calls, 1)
  assert.equal(await generateSmartTourDynamicNarration({
    apiKey: 'test-key', property, selectedCta: 'Agende sua visita', fetchImpl: async () => { throw new Error('timeout') },
  }), null)
})

test('US narration is deterministic, factual and does not make an extra provider call', async () => {
  let calls = 0
  const result = await generateSmartTourDynamicNarration({
    apiKey: 'test-key', language: 'en-US', selectedCta: 'Schedule a visit',
    property: { purpose: 'sale', type: 'us_single_family_home', city: 'Tampa', bedrooms: '3', bathrooms: '2', parkingSpaces: '2', suites: '9', area: '1850', highlights: ['us_pool'] },
    fetchImpl: async () => { calls += 1; throw new Error('US narration must not call the provider') },
  })
  assert.equal(calls, 0)
  assert.equal(result, 'For sale Single-Family Home in Tampa. 3 bedrooms, 2 bathrooms.')
  assert.doesNotMatch(result || '', /suite|m²|R\$|IPTU|Condomínio|Schedule a visit/i)
})

test('inserts the literal dynamic narration in both briefings without changing disabled narration', () => {
  const narration = 'Uma opção prática no Klabin: apartamento para alugar com varanda e fácil acesso ao metrô. Agende sua visita.'
  const images = buildSmartTourStructuredBriefing({
    generation, property, selectedCta: 'Agende sua visita', imagePaths: ['1.jpg', '2.jpg'], language: 'pt-BR',
  })
  const short = buildShortVideosStructuredBriefing({
    generation, property, selectedCta: 'Agende sua visita', videoPath: 'input.mp4', language: 'pt-BR',
  })
  for (const briefing of [images, short]) {
    const updated = applySmartTourDynamicNarration(briefing, narration)
    assert.equal(updated.timeline.narracao[0].texto, narration)
    assert.equal(JSON.stringify(updated).includes(narration), true)
    assert.deepEqual([updated.timeline.narracao[0].inicioSegundos, updated.timeline.narracao[0].fimSegundos], [0, 10])
    assert.ok(updated.timeline.narracao.filter(block => block.texto).every(block => block.frase_id === 'OPENAI_DYNAMIC'))
    assert.deepEqual(updated.timeline.legendas, briefing.timeline.legendas)
    assert.deepEqual(updated.timeline.cta, briefing.timeline.cta)
    assert.equal(updated.tarefa, briefing.tarefa)
  }

  const disabled = buildSmartTourStructuredBriefing({
    generation: { ...generation, narration: 'disabled' }, property, selectedCta: 'Agende sua visita', imagePaths: ['1.jpg'], language: 'pt-BR',
  })
  assert.equal(applySmartTourDynamicNarration(disabled, narration), disabled)
})

test('generation invokes dynamic narration only when enabled and persists the final prompt before Gemini', () => {
  const generator = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  const guardedCalls = generator.match(/input\.generation\.narration === 'enabled'[\s\S]{0,180}generateSmartTourDynamicNarration/g) || []
  assert.equal(guardedCalls.length, 2)
  assert.match(generator, /update\(\{prompt_final:prompt,marketing_hashtags:hashtags,error_message:'stage:openai_ready'\}\)/)
  assert.match(generator, /geminiPrompt:buildShortVideosCleanGeminiPrompt\(briefing\)/)
  assert.ok(generator.indexOf("update({prompt_final:prompt,marketing_hashtags:hashtags,error_message:'stage:openai_ready'})") < generator.indexOf('startGeminiOmniShortVideo({prompt:geminiPrompt,video:prepared.video})'))
  assert.ok(generator.lastIndexOf('update({prompt_final:prompt,marketing_hashtags:hashtags})') < generator.indexOf('generateGeminiOmniVideoInline({'))
})

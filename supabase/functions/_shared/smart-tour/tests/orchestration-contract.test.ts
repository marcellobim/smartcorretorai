import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSmartTourOrchestrationInput,
  buildSmartTourPrompt,
  buildSmartTourVideoPrompt,
  validateSmartTourOrchestration,
} from '../index.ts'
import {
  SMART_TOUR_ORCHESTRATOR_MODEL,
  SMART_TOUR_ORCHESTRATOR_TEMPERATURE,
  buildSmartTourOrchestrationRequest,
  readSmartTourOrchestrationResponse,
} from '../../geminiSmartTourOrchestrator.ts'
import { buildGeminiOmniRequestBody } from '../../geminiOmniClient.ts'

const property = {
  purpose: 'sale',
  type: 'Apartamento',
  city: 'São Paulo',
  district: 'Moema',
  bedrooms: '2',
  suites: '1',
  parkingSpaces: '1',
  area: '85',
  stage: 'Pronto para morar',
  price: 'R$ 850.000',
  highlights: ['Vista livre', 'Varanda gourmet', 'Próximo ao metrô'],
}
const generation = { mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' } as const
const imagePaths = Array.from({ length: 5 }, (_, index) => `user/smart-tour/request/${index + 1}.jpg`)
const briefing = buildSmartTourPrompt({ generation, property, selectedCta: 'Agende sua visita', phone: '(11) 98765-4321' })
const phaseOne = buildSmartTourOrchestrationInput({ generation, property, selectedCta: 'Agende sua visita', phone: '(11) 98765-4321', imagePaths, language: 'pt-BR', briefing })
const returnedJson = {
  configuracoes: {
    modo: 'guided_tour', apresentador: 'corretora', narracaoAtiva: true, legendasAtivas: true,
    ctaAtivo: true, idioma: 'pt-BR', duracao: '10s', quantidadeImagens: 5,
  },
  cenas: imagePaths.map((imagem, index) => ({ numero: index + 1, imagem })),
  legendas: [
    { cena: 1, texto: 'Pronto para morar' },
    { cena: 2, texto: 'Vista livre' },
    { cena: 3, texto: 'Próximo ao metrô' },
    { cena: 4, texto: 'Varanda gourmet' },
    { cena: 5, texto: 'R$ 850.000' },
  ],
  narracao: 'Conheça este excelente apartamento à venda em Moema, São Paulo. São 2 dormitórios, 1 suíte e 1 vaga de garagem. Agende sua visita.',
  cta: 'Agende sua visita',
  telefone: '(11) 98765-4321',
} as const

test('phase 1 payload contains property, broker, chat, five images and language without requesting video', () => {
  const images = imagePaths.map((_, index) => ({ type: 'image' as const, data: `image-${index + 1}`, mime_type: 'image/jpeg' as const }))
  const payload = buildSmartTourOrchestrationRequest(phaseOne.prompt, images)
  assert.equal(SMART_TOUR_ORCHESTRATOR_MODEL, 'gemini-3.5-flash')
  assert.equal(SMART_TOUR_ORCHESTRATOR_TEMPERATURE, 0.0)
  assert.equal(payload.model, 'gemini-3.5-flash')
  assert.deepEqual(payload.generation_config, { temperature: 0.0 })
  assert.deepEqual(payload.response_format.type, 'text')
  assert.equal(payload.response_format.mime_type, 'application/json')
  assert.equal(payload.response_format.schema.type, 'object')
  assert.equal(payload.store, false)
  assert.deepEqual(payload.input.slice(0, 5), images)
  assert.deepEqual(payload.input.at(-1), { type: 'text', text: phaseOne.prompt })
  assert.equal(JSON.stringify(payload).includes('"type":"video"'), false)
  assert.deepEqual(phaseOne.source.dadosDoImovel, property)
  assert.deepEqual(phaseOne.source.dadosDoCorretor, { telefone: '(11) 98765-4321' })
  assert.equal(phaseOne.source.opcoesDoChat.presenterGender, 'female')
  assert.deepEqual(phaseOne.source.imagens, imagePaths)
  assert.equal(phaseOne.source.idioma, 'pt-BR')
})

test('phase 1 accepts only the structured JSON with exact deterministic literals', () => {
  const response = {
    id: 'v1_orchestration', status: 'completed', object: 'interaction',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(returnedJson) }] }],
  }
  assert.deepEqual(readSmartTourOrchestrationResponse(response, phaseOne.expectation), returnedJson)
  assert.deepEqual(validateSmartTourOrchestration(returnedJson, phaseOne.expectation), returnedJson)
  assert.throws(() => validateSmartTourOrchestration({ ...returnedJson, cta: 'Agende agora' }, phaseOne.expectation), /literal_mismatch/)
  assert.throws(() => validateSmartTourOrchestration({ ...returnedJson, telefone: '11 98765-4321' }, phaseOne.expectation), /literal_mismatch/)
  assert.throws(() => validateSmartTourOrchestration({ ...returnedJson, legendas: [{ cena: 1, texto: 'Imperdível' }] }, phaseOne.expectation), /caption_mismatch/)
})

test('phase 2 payload uses the exact phase 1 JSON as its only factual source and keeps Gemini Omni video', () => {
  const plan = validateSmartTourOrchestration(returnedJson, phaseOne.expectation)
  const prompt = buildSmartTourVideoPrompt(plan)
  const exactJson = JSON.stringify(plan)
  assert.ok(prompt.includes(`JSON DA FASE 1 — NÃO ALTERAR NENHUM CARACTERE\n${exactJson}`))
  assert.match(prompt, /fonte única de todas as informações factuais e de todos os textos/)
  assert.match(prompt, /Não reescreva textos, não reinterprete dados do imóvel e não crie informações/)
  assert.doesNotMatch(prompt, /"dadosDoImovel"|"opcoesDoChat"|"valoresDeterministicos"/)

  const images = imagePaths.map((_, index) => ({ type: 'image', data: `image-${index + 1}`, mime_type: 'image/jpeg' }))
  const payload = buildGeminiOmniRequestBody(prompt, images)
  assert.equal(payload.model, 'gemini-omni-flash-preview')
  assert.deepEqual(payload.response_format, { type: 'video', duration: '10s', delivery: 'uri' })
  assert.deepEqual(payload.input.slice(0, 5), images)
  assert.deepEqual(payload.input.at(-1), { type: 'text', text: prompt })
})

test('generation function performs orchestration before the existing video interaction without changing the request contract', () => {
  const source = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  const orchestrationIndex = source.indexOf('await orchestrateSmartTour(')
  const videoIndex = source.indexOf('await startGeminiOmniVideo(')
  assert.ok(orchestrationIndex > 0 && videoIndex > orchestrationIndex)
  assert.match(source, /prepareGeminiImages\(supabase,'studio-videos',input\.imagePaths\)/)
  assert.match(source, /buildSmartTourOrchestrationInput\(\{generation:input\.generation,property:input\.property,selectedCta:input\.selectedCta,phone,imagePaths:input\.imagePaths,language:input\.language,briefing\}\)/)
  assert.match(source, /startGeminiOmniVideo\(\{prompt,images\}\)/)
  assert.equal((source.match(/prepareGeminiImages/g) || []).length, 2)
})

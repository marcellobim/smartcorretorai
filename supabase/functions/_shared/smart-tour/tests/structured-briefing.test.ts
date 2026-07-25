import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGeminiOmniRequestBody } from '../../geminiOmniClient.ts'
import { buildSmartTourStructuredBriefing, buildSmartTourVideoPrompt, SMART_TOUR_GEMINI_MISSION, SMART_TOUR_PHRASE_LIBRARY } from '../index.ts'

const property = {
  purpose: 'sale',
  type: 'Apartamento',
  state: 'SP',
  city: 'São Paulo',
  district: 'Moema',
  bedrooms: '4',
  suites: '2',
  parkingSpaces: '3',
  area: '198',
  stage: 'Pronto para morar',
  price: 'R$ 2.850.000',
  condominium: 'R$ 1.200',
  iptu: 'R$ 650',
  highlights: ['Vista livre', 'Varanda gourmet', 'Próximo ao metrô'],
  description: 'Apartamento amplo com excelente distribuição.',
}
const generation = { mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' } as const
const imagePaths = Array.from({ length: 5 }, (_, index) => `user/smart-tour/request/${index + 1}.jpg`)
const build = (overrides = {}) => buildSmartTourStructuredBriefing({
  generation,
  property,
  selectedCta: 'Agende sua visita',
  phone: '(11) 98765-4321',
  imagePaths,
  language: 'pt-BR',
  ...overrides,
})

test('SmartCorretorAI builds the complete structured JSON without asking Gemini to organize data', () => {
  const briefing = build()
  assert.equal(briefing.versao, 'smart-tour-structured-briefing-v1')
  assert.equal(briefing.tarefa, SMART_TOUR_GEMINI_MISSION)
  assert.match(briefing.tarefa, /^MISSÃO PRINCIPAL\nVocê é um cinegrafista profissional especializado em imóveis\./)
  assert.match(briefing.tarefa, /Sua criatividade deve ser utilizada para filmar\.\n\nNunca para redesenhar\./)
  assert.deepEqual(briefing.configuracoes, {
    modo: 'guided_tour', idioma: 'pt-BR', formato: '9:16', duracaoSegundos: 10,
    quantidadeImagens: 5, narracaoAtiva: true, legendasAtivas: true, ctaAtivo: true,
  })
  assert.deepEqual(briefing.imovel, {
    finalidade: 'Venda', tipo: 'Apartamento', estadoDoImovel: 'Pronto para morar',
    localizacao: { estado: 'SP', cidade: 'São Paulo', bairro: 'Moema' },
    dormitorios: '4', suites: '2', banheiros: null, vagas: '3', area: '198',
    preco: 'R$ 2.850.000', condominio: 'R$ 1.200', iptu: 'R$ 650',
    destaques: ['Vista livre', 'Varanda gourmet', 'Próximo ao metrô'],
    descricao: 'Apartamento amplo com excelente distribuição.',
  })
  assert.deepEqual(briefing.apresentador, { tipo: 'corretora', unicoHumanoAutorizado: true })
  assert.equal('staging' in briefing, false)
  assert.deepEqual(briefing.musica, { configurada: false, instrucao: 'preservar_comportamento_atual' })
  assert.deepEqual(briefing.sequenciaDasImagens, imagePaths)
  assert.deepEqual(briefing.movimentosDesejados, ['movimento_linear_baixa_amplitude', 'pan_suave', 'push_in_minimo', 'pull_back_minimo'])
  assert.equal(briefing.regrasPreservacao.cenarioProtegido, true)
  assert.equal(briefing.regrasPreservacao.umaImagemPorCena, true)
  assert.equal(briefing.regrasPreservacao.respeitarOrdemDasImagens, true)
})

test('every scene has a semantic type and a phrase selected from the contextual library', () => {
  const briefing = build()
  assert.deepEqual(briefing.cenas.map(scene => scene.tipo), ['abertura', 'caracteristicas', 'diferencial', 'localizacao', 'encerramento'])
  for (const scene of briefing.cenas) {
    assert.ok(scene.frase_id)
    const phrase = SMART_TOUR_PHRASE_LIBRARY.find(candidate => candidate.id === scene.frase_id)
    assert.ok(phrase)
    assert.equal(phrase?.tipo, scene.tipo)
    assert.equal(phrase?.idioma, 'pt-BR')
    assert.equal(phrase?.texto, scene.narracao)
  }
})

test('captions follow the five-scene commercial structure and reserve the last scene for exact CTA', () => {
  const briefing = build()
  assert.deepEqual(briefing.legendas, { ativas: true })
  assert.deepEqual(briefing.cenas.map(scene => scene.legenda), [
    'Moema • São Paulo',
    'Pronto para morar\n4 Dormitórios • 2 Suítes • 3 Vagas',
    'Condomínio R$ 1.200',
    'Vista livre • Varanda gourmet',
    'Agende sua visita\n(11) 98765-4321',
  ])
  assert.deepEqual(briefing.cenas.map(scene => scene.imagem), imagePaths)
  assert.equal(briefing.cenas.at(-1)?.tipo, 'encerramento')
  assert.equal(briefing.cenas.at(-1)?.legenda, `${briefing.cta.titulo}\n${briefing.cta.telefone}`)
  assert.doesNotMatch(briefing.cenas.at(-1)?.legenda || '', /R\$ 2\.850\.000/)
  assert.ok(briefing.cenas.every(scene => !scene.legenda.includes('R$ 2.850.000')))
  assert.deepEqual(briefing.cenas.map(scene => Boolean(scene.legenda)), [true, true, true, true, true])
})

test('CTA title and phone preserve every supplied character in the final scene', () => {
  const briefing = build({ selectedCta: 'Fale comigo — agora!', phone: '+55 (11) 98765-4321' })
  assert.deepEqual(briefing.cta, { titulo: 'Fale comigo — agora!', telefone: '+55 (11) 98765-4321' })
  assert.deepEqual(Object.keys(briefing.cta), ['titulo', 'telefone'])
  assert.equal(briefing.cenas.at(-1)?.legenda, 'Fale comigo — agora!\n+55 (11) 98765-4321')
})

test('narration has scenes as its single source of truth and leaves 0.8 second for the final phone', () => {
  const briefing = build()
  assert.equal('narracao' in briefing, false)
  for (const scene of briefing.cenas) {
    assert.notEqual(scene.narracao, scene.legenda)
    assert.ok(scene.narracao.split(/\s+/).length <= (scene.tipo === 'encerramento' ? 3 : 6), scene.narracao)
  }
  assert.deepEqual(briefing.cenas.slice(0, -1).map(scene => scene.duracaoNarracaoSegundos), [1.8, 1.8, 1.8, 1.8])
  assert.deepEqual(briefing.cenas.slice(0, -1).map(scene => scene.tempoTelefoneVisivelAposNarracaoSegundos), [0, 0, 0, 0])
  assert.equal(briefing.cenas.at(-1)?.duracaoNarracaoSegundos, 1.2)
  assert.equal(briefing.cenas.at(-1)?.tempoTelefoneVisivelAposNarracaoSegundos, 0.8)
  assert.deepEqual(briefing.cenas.map(scene => scene.narracao), [
    'Conheça este excelente apartamento à venda.',
    'Espaços bem distribuídos para sua rotina.',
    'Qualidade percebida em cada escolha.',
    'Mobilidade que facilita o cotidiano.',
    'Entre em contato.',
  ])
  assert.match(JSON.stringify(briefing.regrasObrigatorias), /aproximadamente 0,8 segundo/)
})

test('restored commercial phrases remain concise and remove repeated proximity wording', () => {
  for (const phrase of SMART_TOUR_PHRASE_LIBRARY) {
    const words = phrase.texto.trim().split(/\s+/).length
    const maximumWords = phrase.tipo === 'encerramento' ? 3 : 6
    assert.ok(words <= maximumWords, `${phrase.id}: ${phrase.texto}`)
  }
  const portugueseNarration = SMART_TOUR_PHRASE_LIBRARY
    .filter(phrase => phrase.idioma === 'pt-BR')
    .map(phrase => phrase.texto)
    .join(' ')
  assert.doesNotMatch(portugueseNarration, /perto de você|conhe(?:ça|cer) de perto/i)

  const selectedWords = build().cenas
    .flatMap(scene => scene.narracao.toLocaleLowerCase('pt-BR').match(/[\p{L}]+/gu) || [])
    .filter(word => !new Set(['a', 'à', 'ao', 'cada', 'e', 'em', 'este', 'o', 'para', 'sua']).has(word))
  assert.equal(new Set(selectedWords).size, selectedWords.length)
})

test('phrase selection is deterministic and constrained by type, purpose, property type and language', () => {
  const first = build()
  const repeated = build()
  assert.deepEqual(first.cenas.map(scene => [scene.frase_id, scene.narracao]), repeated.cenas.map(scene => [scene.frase_id, scene.narracao]))
  assert.equal(first.cenas[0].frase_id, 'OPENING_03')
  const english = build({ language: 'en-US', generation: { ...generation, language: 'en-US' } })
  assert.equal(english.cenas[0].frase_id, 'OPENING_EN_01')
  assert.equal(english.cenas.at(-1)?.frase_id, 'CLOSING_EN_01')
})

test('single-source JSON rule replaces texto_literal and forbids invention or rewriting', () => {
  const briefing = build()
  const rule = briefing.regrasObrigatorias.find(item => item.codigo === 'usar_json_como_fonte_unica')
  assert.deepEqual(rule, {
    codigo: 'usar_json_como_fonte_unica',
    valor: 'Utilizar exclusivamente as informações existentes neste JSON. Não inventar. Não completar. Não alterar. Não corrigir. Não substituir. Todas as informações utilizadas na geração deverão ser obtidas exclusivamente deste JSON.',
  })
  assert.equal(briefing.regrasObrigatorias.some(item => item.codigo === 'texto_literal'), false)
  assert.equal(briefing.regrasObrigatorias.some(item => item.codigo === 'fonte_unica'), false)
})

test('CTA remains the final caption even when commercial captions are disabled', () => {
  const briefing = build({ generation: { ...generation, captions: 'disabled' } })
  assert.deepEqual(briefing.legendas, { ativas: true })
  assert.ok(briefing.cenas.slice(0, -1).every(scene => scene.legenda === ''))
  assert.equal(briefing.cenas.at(-1)?.legenda, 'Agende sua visita\n(11) 98765-4321')
})

test('disabled modules remain empty without changing duration or images', () => {
  const disabled = build({
    generation: { ...generation, presenterGender: 'none', narration: 'disabled', captions: 'disabled' },
    selectedCta: '',
    phone: '(11) 98765-4321',
  })
  assert.deepEqual(disabled.apresentador, { tipo: 'nenhum', unicoHumanoAutorizado: false })
  assert.equal('narracao' in disabled, false)
  assert.deepEqual(disabled.legendas, { ativas: false })
  assert.equal('staging' in disabled, false)
  assert.deepEqual(disabled.cta, { titulo: '', telefone: '' })
  assert.equal(disabled.configuracoes.duracaoSegundos, 10)
  assert.equal(disabled.configuracoes.quantidadeImagens, 5)
  assert.deepEqual(disabled.cenas.map(scene => scene.imagem), imagePaths)
  assert.ok(disabled.cenas.every(scene => scene.frase_id === '' && scene.narracao === '' && scene.legenda === '' && scene.duracaoNarracaoSegundos === 0))
})

test('Gemini Omni receives the exact JSON as the only briefing text and remains the video generator', () => {
  const briefing = build()
  const prompt = buildSmartTourVideoPrompt(briefing)
  assert.equal(prompt, JSON.stringify(briefing))
  assert.ok(prompt.startsWith('{') && prompt.endsWith('}'))
  assert.doesNotMatch(prompt, /BRIEFING BASE COMPILADO|FASE 1|FASE 2/)
  const images = imagePaths.map((_, index) => ({ type: 'image', data: `image-${index + 1}`, mime_type: 'image/jpeg' }))
  const payload = buildGeminiOmniRequestBody(prompt, images)
  assert.equal(payload.model, 'gemini-omni-flash-preview')
  assert.deepEqual(payload.response_format, { type: 'video', duration: '10s', delivery: 'uri' })
  assert.deepEqual(payload.input.slice(0, 5), images)
  assert.deepEqual(payload.input.at(-1), { type: 'text', text: JSON.stringify(briefing) })
})

test('active generation builds JSON locally and makes only the existing Gemini Omni video call', () => {
  const source = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  assert.match(source, /buildSmartTourStructuredBriefing\(\{generation:input\.generation,property:input\.property,selectedCta:input\.selectedCta,phone,imagePaths:input\.imagePaths,language:input\.language\}\)/)
  assert.match(source, /startGeminiOmniVideo\(\{prompt,images\}\)/)
  assert.doesNotMatch(source, /orchestrateSmartTour|geminiSmartTourOrchestrator|buildSmartTourPrompt/)
  assert.equal((source.match(/startGeminiOmniVideo/g) || []).length, 2)
})

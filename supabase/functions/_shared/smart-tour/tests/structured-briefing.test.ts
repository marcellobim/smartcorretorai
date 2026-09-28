import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGeminiOmniInlineRequestBody } from '../../geminiOmniClient.ts'
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
  highlights: ['Próximo ao metrô', 'Lazer completo', 'Varanda gourmet'],
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
    destaques: ['Próximo ao metrô', 'Lazer completo', 'Varanda gourmet'],
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
    assert.equal(scene.narracao, phrase?.texto)
  }
})

test('captions follow the five-scene commercial structure and reserve the last scene for exact CTA', () => {
  const briefing = build()
  assert.deepEqual(briefing.legendas, { ativas: true })
  assert.deepEqual(briefing.cenas.map(scene => scene.legenda), [
    'À venda\nMoema • São Paulo',
    'Pronto para morar\n4 Dormitórios • 2 Suítes • 3 Vagas',
    'Próximo ao metrô',
    'Lazer completo • Varanda gourmet',
    'Agende sua visita\n(11) 98765-4321',
  ])
  assert.deepEqual(briefing.cenas.map(scene => scene.imagem), imagePaths)
  assert.equal(briefing.cenas.at(-1)?.tipo, 'encerramento')
  assert.equal(briefing.cenas.at(-1)?.legenda, `${briefing.cta.titulo}\n${briefing.cta.telefone}`)
  assert.doesNotMatch(briefing.cenas.at(-1)?.legenda || '', /R\$ 2\.850\.000/)
  assert.ok(briefing.cenas.every(scene => !scene.legenda.includes('R$ 2.850.000')))
  assert.ok(briefing.cenas.every(scene => !scene.legenda.includes('R$ 1.200')))
  assert.ok(briefing.cenas.every(scene => !scene.legenda.includes('R$ 650')))
  assert.deepEqual(briefing.cenas.map(scene => Boolean(scene.legenda)), [true, true, true, true, true])
})

test('sale and rental purpose are mandatory in the first caption and active narration', () => {
  const sale = build()
  const rental = build({ property: { ...property, purpose: 'rent', stage: 'Disponível já' } })
  assert.equal(sale.timeline.legendas[0].texto, 'À venda\nMoema • São Paulo')
  assert.match(sale.timeline.narracao[0].texto, /à venda/i)
  assert.equal(rental.timeline.legendas[0].texto, 'Para alugar\nMoema • São Paulo')
  assert.match(rental.timeline.narracao[0].texto, /para alugar/i)
  assert.doesNotMatch(rental.timeline.narracao[0].texto, /para locação/i)
})

test('text, narration and CTA use five fixed temporal blocks independently from 1 to 5 images', () => {
  for (const imageCount of [1, 2, 3, 4, 5]) {
    const paths = imagePaths.slice(0, imageCount)
    const briefing = build({ imagePaths: paths })
    assert.equal(briefing.configuracoes.quantidadeImagens, imageCount)
    assert.equal(briefing.cenas.length, imageCount)
    assert.deepEqual(briefing.sequenciaDasImagens, paths)
    assert.deepEqual(briefing.cenas.map(scene => scene.imagem), paths)
    assert.deepEqual(briefing.movimentosDesejados, ['movimento_linear_baixa_amplitude', 'pan_suave', 'push_in_minimo', 'pull_back_minimo'])
    assert.deepEqual(briefing.cenas.map(scene => scene.movimento), ['movimento_linear_baixa_amplitude', 'pan_suave', 'push_in_minimo', 'pull_back_minimo', 'movimento_linear_baixa_amplitude'].slice(0, imageCount))
    assert.equal(briefing.timeline.duracaoTotalSegundos, 10)
    assert.equal(briefing.timeline.legendas.length, 4)
    assert.equal(briefing.timeline.narracao.length, 5)
    assert.deepEqual(briefing.timeline.legendas.map(block => [block.inicioSegundos, block.fimSegundos]), [[0, 2], [2, 4], [4, 6], [6, 8]])
    assert.deepEqual(briefing.timeline.narracao.map(block => [block.inicioSegundos, block.fimSegundos]), [[0, 2], [2, 4], [4, 6], [6, 8], [8, 10]])
    assert.deepEqual([briefing.timeline.cta.inicioSegundos, briefing.timeline.cta.fimSegundos], [8, 10])
    assert.equal(briefing.timeline.cta.texto, 'Agende sua visita\n(11) 98765-4321')
    assert.deepEqual(
      [...briefing.timeline.legendas.map(block => block.texto), briefing.timeline.cta.texto],
      ['À venda\nMoema • São Paulo', 'Pronto para morar\n4 Dormitórios • 2 Suítes • 3 Vagas', 'Próximo ao metrô', 'Lazer completo • Varanda gourmet', 'Agende sua visita\n(11) 98765-4321'],
    )
    assert.ok(briefing.timeline.narracao.every(block => Boolean(block.texto)))
    assert.equal(briefing.apresentador.tipo, 'corretora')
    assert.ok(briefing.regrasObrigatorias.some(item => item.codigo === 'apresentador_obrigatorio'))
  }
})

test('automatic captions never use monetary values, fees, taxes or property codes', () => {
  const briefing = build({
    property: {
      ...property,
      price: 'R$ 9.999.999',
      condominium: 'R$ 8.888',
      iptu: 'R$ 7.777',
      description: 'Código do imóvel SC-12345. Taxa extra R$ 6.666.',
      highlights: ['Bairro valorizado', 'Piscina', 'Academia', 'Alto padrão'],
    },
  })
  const captions = briefing.cenas.map(scene => scene.legenda).join('\n')
  assert.doesNotMatch(captions, /9\.999\.999|8\.888|7\.777|6\.666|SC-12345|Taxa extra/)
  assert.equal(briefing.cenas[2].legenda, 'Bairro valorizado')
  assert.equal(briefing.cenas[3].legenda, 'Piscina • Alto padrão')
  assert.match(JSON.stringify(briefing.regrasObrigatorias), /Condomínio somente pode aparecer como benefício selecionado/)
  assert.equal(briefing.regrasObrigatorias.some(item => item.codigo === 'preco_intermediario'), false)
})

test('an active presenter is mandatory, unique, natural and the only person exception', () => {
  const female = build()
  const femaleRules = JSON.stringify(female.regrasObrigatorias)
  assert.deepEqual(female.apresentador, { tipo: 'corretora', unicoHumanoAutorizado: true })
  assert.match(femaleRules, /exibir obrigatoriamente exatamente uma pessoa: uma corretora/)
  assert.match(femaleRules, /única exceção autorizada à regra de não inventar pessoas/)
  assert.match(femaleRules, /Não criar, exibir ou sugerir nenhuma pessoa adicional/)
  assert.match(femaleRules, /aparecer naturalmente durante a apresentação/)
  assert.match(femaleRules, /O imóvel deve ser preservado integralmente/)
  assert.match(female.regrasPreservacao.transformacoesPermitidas.join(' '), /única corretora autorizada/)

  const male = build({ generation: { ...generation, presenterGender: 'male' } })
  const maleRules = JSON.stringify(male.regrasObrigatorias)
  assert.deepEqual(male.apresentador, { tipo: 'corretor', unicoHumanoAutorizado: true })
  assert.match(maleRules, /exibir obrigatoriamente exatamente uma pessoa: um corretor/)
  assert.match(maleRules, /O corretor é a única exceção autorizada/)
})

test('CTA title and phone preserve every supplied character in the final scene', () => {
  const briefing = build({ selectedCta: 'Fale comigo — agora!', phone: '+55 (11) 98765-4321' })
  assert.deepEqual(briefing.cta, { titulo: 'Fale comigo — agora!', telefone: '+55 (11) 98765-4321' })
  assert.deepEqual(Object.keys(briefing.cta), ['titulo', 'telefone'])
  assert.equal(briefing.cenas.at(-1)?.legenda, 'Fale comigo — agora!\n+55 (11) 98765-4321')
})

test('timeline narration is the effective temporal source and keeps legacy scene fields compatible', () => {
  const briefing = build()
  assert.equal('narracao' in briefing, false)
  assert.deepEqual(briefing.timeline.narracao.map(block => [block.inicioSegundos, block.fimSegundos]), [[0, 2], [2, 4], [4, 6], [6, 8], [8, 10]])
  assert.deepEqual(briefing.timeline.narracao.map(block => block.texto), [
    'Conheça este excelente apartamento à venda.',
    'Espaços bem distribuídos para sua rotina.',
    'Mobilidade que facilita o cotidiano.',
    'Qualidade percebida em cada escolha.',
    'Entre em contato.',
  ])
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

test('disabling captions removes every information caption while preserving an enabled CTA', () => {
  const briefing = build({ generation: { ...generation, captions: 'disabled' } })
  assert.deepEqual(briefing.legendas, { ativas: true })
  assert.ok(briefing.cenas.slice(0, -1).every(scene => scene.legenda === ''))
  assert.ok(briefing.timeline.legendas.every(block => block.texto === ''))
  assert.equal(briefing.cenas.at(-1)?.legenda, 'Agende sua visita\n(11) 98765-4321')
})

test('disabled captions and CTA produce no visual text without changing duration or images', () => {
  const disabled = build({
    generation: { ...generation, presenterGender: 'none', narration: 'disabled', captions: 'disabled' },
    selectedCta: '',
    phone: '(11) 98765-4321',
  })
  assert.deepEqual(disabled.apresentador, { tipo: 'nenhum', unicoHumanoAutorizado: false })
  assert.equal(disabled.regrasObrigatorias.some(item => item.codigo.startsWith('apresentador_')), false)
  assert.match(String(disabled.regrasObrigatorias.find(item => item.codigo === 'sem_invencao')?.valor), /não inventar dados, contatos, ambientes, pessoas ou elementos/)
  assert.equal('narracao' in disabled, false)
  assert.deepEqual(disabled.legendas, { ativas: false })
  assert.equal('staging' in disabled, false)
  assert.deepEqual(disabled.cta, { titulo: '', telefone: '' })
  assert.equal(disabled.configuracoes.duracaoSegundos, 10)
  assert.equal(disabled.configuracoes.quantidadeImagens, 5)
  assert.deepEqual(disabled.cenas.map(scene => scene.imagem), imagePaths)
  assert.ok(disabled.cenas.every(scene => scene.frase_id === '' && scene.narracao === '' && scene.duracaoNarracaoSegundos === 0))
  assert.ok(disabled.cenas.every(scene => scene.legenda === ''))
  assert.ok(disabled.timeline.legendas.every(block => block.texto === ''))
  assert.ok(disabled.timeline.narracao.every(block => block.texto === ''))
  assert.equal(disabled.timeline.cta.texto, '')
})

test('Gemini Omni receives the exact JSON as the only briefing text and remains the video generator', () => {
  const briefing = build()
  const prompt = buildSmartTourVideoPrompt(briefing)
  assert.equal(prompt, JSON.stringify(briefing))
  assert.ok(prompt.startsWith('{') && prompt.endsWith('}'))
  assert.doesNotMatch(prompt, /BRIEFING BASE COMPILADO|FASE 1|FASE 2/)
  const images = imagePaths.map((_, index) => ({ type: 'image', data: `image-${index + 1}`, mime_type: 'image/jpeg' }))
  const payload = buildGeminiOmniInlineRequestBody(prompt, images)
  assert.equal(payload.model, 'gemini-omni-flash-preview')
  assert.deepEqual(payload.response_format, { type: 'video', duration: '10s' })
  assert.deepEqual(payload.response_modalities, ['video'])
  assert.deepEqual(payload.input.slice(0, 5), images)
  assert.deepEqual(payload.input.at(-1), { type: 'text', text: JSON.stringify(briefing) })
})

test('active generation builds JSON locally, generates Gemini video, then composes selected text deterministically', () => {
  const source = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  assert.match(source, /buildSmartTourStructuredBriefing\(\{generation:input\.generation,property:input\.property,selectedCta:input\.selectedCta,phone,imagePaths:input\.imagePaths,language:input\.language\}\)/)
  assert.match(source, /generateGeminiOmniVideoInline\(\{[\s\S]{0,100}prompt,[\s\S]{0,100}images,[\s\S]{0,160}timeoutMs:/)
  assert.match(source, /hasDeterministicSmartTourText\(briefing\)/)
  assert.match(source, /startSmartTourCaptionRender\(creatomateKey, rawUrl\.signedUrl, briefing\)/)
  assert.match(source, /encodeSmartTourCaptionRenderId\(startedRender\.renderId\)/)
  assert.doesNotMatch(source, /credentialProfile|video-imobiliario|GEMINI_API_KEY_2/)
  assert.match(source, /startGeminiOmniShortVideo\(\{prompt:geminiPrompt,video:prepared\.video\}\)/)
  assert.doesNotMatch(source, /startGeminiOmniShortVideo\([^\n]*video-imobiliario/)
  assert.doesNotMatch(source, /orchestrateSmartTour|geminiSmartTourOrchestrator|buildSmartTourPrompt/)
  assert.equal((source.match(/generateGeminiOmniVideoInline/g) || []).length, 2)
})

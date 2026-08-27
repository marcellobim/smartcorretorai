import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildGeminiOmniShortVideoRequestBody,
  GEMINI_VIDEO_DEFAULT_MAX_BYTES,
  GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES,
  SMART_TOUR_GEMINI_OMNI_DURATION,
  resolveGeminiVideoMaxBytes,
  validateGeminiVideoSize,
} from '../../geminiOmniClient.ts'
import {
  applySmartTourDynamicNarration,
  buildShortVideosCleanGeminiPrompt,
  buildShortVideosStructuredBriefing,
  buildSmartTourStructuredBriefing,
  SHORT_VIDEOS_MISSION_OPENING,
  SHORT_VIDEOS_GEMINI_MISSION,
  SHORT_VIDEOS_NATURAL_ENDING_RULE,
  SMART_TOUR_GEMINI_MISSION,
  validateShortVideosRequest,
} from '../index.ts'

const generation = {
  mode: 'guided_tour', presenterGender: 'female', narration: 'enabled', captions: 'enabled',
  furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR',
} as const

const rawRequest = {
  inputFlow: 'short-videos',
  clientRequestId: '123e4567-e89b-12d3-a456-426614174000',
  videoPath: 'user/short-videos/123e4567-e89b-12d3-a456-426614174000/input.mp4',
  videoMetadata: { durationSeconds: 42.5, mimeType: 'video/mp4' },
  property: {
    purpose: 'sale', type: 'Apartamento', stage: 'Pronto para morar', state: 'SP', city: 'São Paulo', district: 'Moema',
    bedrooms: '3', suites: '1', parkingSpaces: '2', area: '120', highlights: ['Varanda gourmet'],
  },
  generation,
  selectedCta: 'Agende sua visita',
  includeProfessionalPhone: true,
  language: 'pt-BR',
}

const validationSource = readFileSync(new URL('../validation.ts', import.meta.url), 'utf8')
const generateSource = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')

test('validates one MP4 and preserves the five-minute product contract', () => {
  const input = validateShortVideosRequest(rawRequest)
  assert.equal(input.inputFlow, 'short-videos')
  assert.equal(input.videoMetadata.durationSeconds, 42.5)
  assert.equal(input.videoMetadata.mimeType, 'video/mp4')
  assert.equal(input.generation.presenterGender, 'none')
  assert.throws(() => validateShortVideosRequest({ ...rawRequest, videoMetadata: { durationSeconds: 300.01, mimeType: 'video/mp4' } }), /invalid_video_duration/)
  assert.throws(() => validateShortVideosRequest({ ...rawRequest, videoMetadata: { durationSeconds: 10, mimeType: 'video\/quicktime' } }), /invalid_video_type/)
})

test('accepts 30-second and 60-second inputs and keeps long input metadata in the Gemini path', () => {
  for (const durationSeconds of [30, 60, 161.1741]) {
    const input = validateShortVideosRequest({ ...rawRequest, videoMetadata: { durationSeconds, mimeType: 'video/mp4' } })
    assert.equal(input.videoMetadata.durationSeconds, durationSeconds)
  }

  assert.doesNotMatch(validationSource, /durationSeconds\s*>\s*10\b/)
  assert.match(generateSource, /sourceDurationSeconds:input\.videoMetadata\.durationSeconds/)
  assert.match(generateSource, /prepareGeminiVideo\([^;]+?'short-videos'/s)
  assert.match(generateSource, /startGeminiOmniShortVideo\(\{prompt:geminiPrompt,video:prepared\.video\}\)/)
})

test('allows 250 MiB only through the internal Short Videos Gemini size profile', () => {
  const mebibyte = 1024 * 1024
  assert.equal(GEMINI_VIDEO_DEFAULT_MAX_BYTES, 50 * mebibyte)
  assert.equal(GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES, 250 * mebibyte)
  assert.equal(resolveGeminiVideoMaxBytes(), 50 * mebibyte)
  assert.equal(resolveGeminiVideoMaxBytes('short-videos'), 250 * mebibyte)
  assert.doesNotThrow(() => validateGeminiVideoSize(50 * mebibyte))
  assert.throws(() => validateGeminiVideoSize(50 * mebibyte + 1), /gemini_omni_video_too_large/)
  assert.doesNotThrow(() => validateGeminiVideoSize(249 * mebibyte, 'short-videos'))
  assert.doesNotThrow(() => validateGeminiVideoSize(250 * mebibyte, 'short-videos'))
  assert.throws(() => validateGeminiVideoSize(250 * mebibyte + 1, 'short-videos'), /gemini_omni_video_too_large/)
  assert.throws(() => resolveGeminiVideoMaxBytes('untrusted' as never), /gemini_omni_video_size_profile_invalid/)
})

test('builds the exclusive Short Videos mission without image-specific fields', () => {
  const input = validateShortVideosRequest(rawRequest)
  const briefing = buildShortVideosStructuredBriefing({
    generation: input.generation,
    property: input.property,
    selectedCta: input.selectedCta,
    phone: '(11) 99999-9999',
    videoPath: input.videoPath,
    language: input.language,
  })
  const base = buildSmartTourStructuredBriefing({
    generation: input.generation,
    property: input.property,
    selectedCta: input.selectedCta,
    phone: '(11) 99999-9999',
    imagePaths: [input.videoPath],
    language: input.language,
    includePurposePresentation: true,
  })
  assert.equal(briefing.tarefa, SHORT_VIDEOS_GEMINI_MISSION)
  assert.equal(SHORT_VIDEOS_NATURAL_ENDING_RULE, 'O vídeo deve terminar de forma natural. Não encerrar durante uma fala, expressão facial, movimento brusco ou quadro desfavorável. Finalizar em uma imagem estável e agradável, mantendo o último quadro adequado por um breve momento antes do término.')
  assert.ok(briefing.tarefa.endsWith(SHORT_VIDEOS_NATURAL_ENDING_RULE))
  assert.equal(SHORT_VIDEOS_MISSION_OPENING, 'Você é um editor de vídeo automatizado de alta performance para o mercado imobiliário. Analise o vídeo de entrada fornecido. Identifique e selecione de forma inteligente os momentos visualmente mais impactantes e luxuosos do imóvel para criar um Short vertical.')
  assert.ok(briefing.tarefa.startsWith(`${SHORT_VIDEOS_MISSION_OPENING}\n\nREGRA DE OURO`))
  for (const reusedRule of [
    'Toda arquitetura é definitiva.',
    'Todo mobiliário é definitivo.',
    'Toda decoração é definitiva.',
    'Todos os acabamentos são definitivos.',
    'É EXPRESSAMENTE PROIBIDO',
    '- reconstruir ambientes;',
    '- trocar móveis;',
    '- alterar materiais;',
    'Nunca para redesenhar.',
  ]) assert.ok(briefing.tarefa.includes(reusedRule), reusedRule)
  assert.ok(briefing.tarefa.includes('- movimento cinematográfico da câmera;'))
  assert.ok(briefing.tarefa.includes('- movimentos naturais da apresentadora;'))
  assert.ok(briefing.tarefa.includes('Sua criatividade deve ser utilizada para filmar.'))
  const { quantidadeImagens: _quantidadeImagens, ...baseConfigurations } = base.configuracoes
  assert.deepEqual(briefing.configuracoes, { ...baseConfigurations, quantidadeVideos: 1 })
  assert.equal('quantidadeImagens' in briefing.configuracoes, false)
  assert.deepEqual(briefing.sequenciaDosVideos, [input.videoPath])
  assert.equal('sequenciaDasImagens' in briefing, false)
  assert.deepEqual(briefing.cenas, base.cenas.map(({ imagem, ...scene }) => ({ ...scene, video: imagem })))
  assert.equal(briefing.cenas.some(scene => 'imagem' in scene), false)
  assert.deepEqual(briefing.imovel, base.imovel)
  assert.deepEqual(briefing.apresentador, base.apresentador)
  assert.deepEqual(briefing.musica, base.musica)
  assert.deepEqual(briefing.movimentosDesejados, base.movimentosDesejados)
  assert.deepEqual(briefing.timeline, base.timeline)
  assert.deepEqual(briefing.legendas, base.legendas)
  assert.deepEqual(briefing.cta, base.cta)
  assert.deepEqual(briefing.regrasObrigatorias, base.regrasObrigatorias.map(rule => ({
    ...rule,
    valor: typeof rule.valor === 'string' ? rule.valor.replace('trocas de imagem', 'trocas de trecho do vídeo original') : rule.valor,
  })))
  const { umaImagemPorCena: _umaImagemPorCena, respeitarOrdemDasImagens: _respeitarOrdemDasImagens, ...basePreservation } = base.regrasPreservacao
  assert.deepEqual(briefing.regrasPreservacao, { ...basePreservation, usarSomenteVideoOriginal: true, respeitarOrdemDoVideoOriginal: true })
  assert.equal(briefing.configuracoes.narracaoAtiva, true)
  assert.equal(briefing.configuracoes.legendasAtivas, true)
  assert.equal(briefing.cta.telefone, '(11) 99999-9999')
  const prompt = JSON.stringify(briefing)
  for (const prohibited of ['quantidadeImagens', 'sequenciaDasImagens', 'umaImagemPorCena', 'respeitarOrdemDasImagens', 'fotografia', 'imagePaths']) {
    assert.equal(prompt.includes(prohibited), false, prohibited)
  }
  assert.ok(prompt.includes('imagem estável e agradável'))
  assert.equal(prompt.includes(input.videoPath), true)
  assert.equal(briefing.configuracoes.idioma, 'pt-BR')
  assert.match(briefing.timeline.legendas[0].texto, /^À venda(?:\n|$)/)
  assert.match(briefing.timeline.narracao[0].texto, /à venda/i)
  const cleanPrompt = JSON.parse(buildShortVideosCleanGeminiPrompt(briefing))
  assert.equal(cleanPrompt.versao, 'short-videos-clean-gemini-prompt-v1')
  assert.equal('cta' in cleanPrompt, false)
  assert.equal('imovel' in cleanPrompt, false)
  assert.match(cleanPrompt.regrasObrigatorias.join('\n'), /Não gerar, desenhar, inventar ou sobrepor qualquer texto/)
})

test('Short Videos makes rental purpose mandatory in the first caption and active narration', () => {
  const input = validateShortVideosRequest({
    ...rawRequest,
    property: { ...rawRequest.property, purpose: 'rent' },
  })
  const briefing = buildShortVideosStructuredBriefing({
    generation: input.generation,
    property: input.property,
    selectedCta: input.selectedCta,
    phone: '(11) 99999-9999',
    videoPath: input.videoPath,
    language: input.language,
  })

  assert.match(briefing.timeline.legendas[0].texto, /^Para alugar(?:\n|$)/)
  assert.match(briefing.timeline.narracao[0].texto, /para alugar/i)
})

test('Short Videos sends the literal dynamic narration in the briefing while preserving editing rules', () => {
  const input = validateShortVideosRequest(rawRequest)
  const original = buildShortVideosStructuredBriefing({
    generation: input.generation,
    property: input.property,
    selectedCta: input.selectedCta,
    videoPath: input.videoPath,
    language: input.language,
  })
  const narration = 'Uma oportunidade especial em Moema: apartamento à venda com varanda gourmet. Agende sua visita.'
  const briefing = applySmartTourDynamicNarration(original, narration)

  assert.equal(briefing.timeline.narracao[0].texto, narration)
  assert.equal(JSON.stringify(briefing).includes(narration), true)
  assert.equal(briefing.tarefa, original.tarefa)
  assert.deepEqual(briefing.regrasPreservacao, original.regrasPreservacao)
  assert.deepEqual(briefing.timeline.legendas, original.timeline.legendas)
  assert.deepEqual(briefing.timeline.cta, original.timeline.cta)
})

test('keeps the proven images briefing structurally unchanged', () => {
  const imagePaths = ['user/smart-tour/request/01.jpg', 'user/smart-tour/request/02.jpg']
  const briefing = buildSmartTourStructuredBriefing({
    generation,
    property: rawRequest.property,
    selectedCta: rawRequest.selectedCta,
    phone: '(11) 99999-9999',
    imagePaths,
    language: 'pt-BR',
  })
  assert.equal(briefing.versao, 'smart-tour-structured-briefing-v1')
  assert.equal(briefing.tarefa, SMART_TOUR_GEMINI_MISSION)
  assert.equal(briefing.configuracoes.quantidadeImagens, 2)
  assert.deepEqual(briefing.sequenciaDasImagens, imagePaths)
  assert.deepEqual(briefing.cenas.map(scene => scene.imagem), imagePaths)
  assert.equal(briefing.regrasPreservacao.umaImagemPorCena, true)
  assert.equal(briefing.regrasPreservacao.respeitarOrdemDasImagens, true)
})

test('sends the uploaded Files API URI as a document, fixes output at ten seconds, and lets Gemini infer the task', () => {
  const video = { type: 'document', uri: 'https://generativelanguage.googleapis.com/v1beta/files/example' } as const
  const body = buildGeminiOmniShortVideoRequestBody('{"versao":"short-videos-structured-briefing-v1"}', video)
  assert.equal(body.model, 'gemini-omni-flash-preview')
  assert.deepEqual(body.input, [video, { type: 'text', text: '{"versao":"short-videos-structured-briefing-v1"}' }])
  assert.equal(body.input.some(part => part.type === 'video' && 'uri' in part), false)
  assert.equal(SMART_TOUR_GEMINI_OMNI_DURATION, '10s')
  assert.deepEqual(body.response_format, { type: 'video', duration: '10s', delivery: 'uri' })
  assert.equal('aspect_ratio' in body.response_format, false)
  assert.deepEqual(body.generation_config, { thinking_level: 'high' })
  assert.equal('video_config' in body.generation_config, false)
  assert.equal(JSON.stringify(body).includes('"task":"edit"'), false)
  assert.deepEqual(Object.keys(body).sort(), ['background', 'generation_config', 'input', 'model', 'response_format', 'store'])
  assert.equal(body.background, true)
  assert.equal(body.store, true)
})

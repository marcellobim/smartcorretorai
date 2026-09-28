import type { PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { normalizeGeneration } from './validation.ts'
import { GEMINI_VIDEO_TEXT_RULES } from '../gemini-video-text-rules.ts'

export const SMART_TOUR_GEMINI_MISSION = `MISSÃO PRINCIPAL
Você é um cinegrafista profissional especializado em imóveis.

Você NÃO é um arquiteto.

Você NÃO é um designer de interiores.

Você NÃO é um decorador.

Você NÃO está criando um imóvel.

Você NÃO está redesenhando um imóvel.

Você NÃO está reinterpretando um imóvel.

Você está filmando um imóvel real que já existe.

REGRA DE OURO
Considere todas as fotografias recebidas como a representação definitiva do imóvel.

Toda arquitetura é definitiva.

Todo mobiliário é definitivo.

Toda decoração é definitiva.

Todos os objetos são definitivos.

Todos os acabamentos são definitivos.

Todas as cores são definitivas.

Toda iluminação existente é definitiva.

Todas as proporções são definitivas.

Toda perspectiva é definitiva.

Você não possui autorização para modificar nenhum desses elementos.

UTILIZE SUA CRIATIVIDADE APENAS PARA
- movimento cinematográfico da câmera;

- continuidade entre as cenas;

- movimentos naturais da apresentadora;

- enquadramentos;

- ritmo da filmagem;

- transições suaves.

É EXPRESSAMENTE PROIBIDO
- reconstruir ambientes;

- trocar móveis;

- trocar armários;

- alterar cozinhas;

- alterar banheiros;

- alterar portas;

- alterar janelas;

- alterar pisos;

- alterar tetos;

- alterar paredes;

- alterar decoração;

- alterar objetos;

- alterar iluminação arquitetônica;

- alterar materiais;

- alterar geometria;

- alterar proporções.

PRINCÍPIO
Sua criatividade deve ser utilizada para filmar.

Nunca para redesenhar.

O imóvel já está pronto.

Seu trabalho é somente registrar esse imóvel como um cinegrafista profissional faria.`

type Presenter = 'corretora' | 'corretor' | 'nenhum'
export type SmartTourSceneType = 'abertura' | 'caracteristicas' | 'diferencial' | 'localizacao' | 'encerramento'
export type SmartTourTimelineBlock = {
  bloco: number
  inicioSegundos: number
  fimSegundos: number
  texto: string
  frase_id?: string
}

type PhraseDefinition = {
  id: string
  tipo: SmartTourSceneType
  idioma: SupportedLanguage
  finalidades: readonly string[]
  tiposImovel: readonly string[]
  texto: string
}

export type SmartTourStructuredBriefing = {
  versao: 'smart-tour-structured-briefing-v1'
  tarefa: typeof SMART_TOUR_GEMINI_MISSION
  configuracoes: {
    modo: SmartTourGenerationConfig['mode']
    idioma: SupportedLanguage
    formato: '9:16'
    duracaoSegundos: 10
    quantidadeImagens: number
    narracaoAtiva: boolean
    legendasAtivas: boolean
    ctaAtivo: boolean
    identificacaoProfissionalAtiva: boolean
  }
  imovel: {
    finalidade: string
    tipo: string
    estadoDoImovel: string
    localizacao: { estado: string; cidade: string; bairro: string }
    dormitorios: string
    suites: string
    banheiros: null
    vagas: string
    area: string
    preco: string
    condominio: string
    iptu: string
    destaques: string[]
    descricao: string
  }
  apresentador: { tipo: Presenter; unicoHumanoAutorizado: boolean }
  musica: { configurada: false; instrucao: 'preservar_comportamento_atual' }
  sequenciaDasImagens: string[]
  movimentosDesejados: Array<'pan_suave' | 'push_in_minimo' | 'pull_back_minimo' | 'movimento_linear_baixa_amplitude'>
  cenas: Array<{
    numero: number
    tipo: SmartTourSceneType
    frase_id: string
    imagem: string
    movimento: 'pan_suave' | 'push_in_minimo' | 'pull_back_minimo' | 'movimento_linear_baixa_amplitude'
    legenda: string
    narracao: string
    duracaoNarracaoSegundos: 1.8 | 1.2 | 0
    tempoTelefoneVisivelAposNarracaoSegundos: 0.8 | 0
  }>
  timeline: {
    duracaoTotalSegundos: 10
    legendas: SmartTourTimelineBlock[]
    narracao: SmartTourTimelineBlock[]
    cta: SmartTourTimelineBlock & { titulo: string; telefone: string }
    identificacaoProfissional: SmartTourTimelineBlock
  }
  legendas: { ativas: boolean }
  cta: { titulo: string; telefone: string }
  identificacaoProfissional: { texto: string }
  regrasPreservacao: {
    cenarioProtegido: true
    umaImagemPorCena: true
    respeitarOrdemDasImagens: true
    elementosImutaveis: string[]
    transformacoesPermitidas: string[]
  }
  regrasObrigatorias: Array<{ codigo: string; valor: string | boolean | number }>
}

export const SHORT_VIDEOS_MISSION_OPENING = 'Você é um editor de vídeo automatizado de alta performance para o mercado imobiliário. Analise o vídeo de entrada fornecido. Identifique e selecione de forma inteligente os momentos visualmente mais impactantes e luxuosos do imóvel para criar um Short vertical.'

const SHORT_VIDEOS_COMPATIBLE_BASE_RULES = SMART_TOUR_GEMINI_MISSION
  .slice(SMART_TOUR_GEMINI_MISSION.indexOf('REGRA DE OURO'))
  .replace('Considere todas as fotografias recebidas como a representação definitiva do imóvel.', 'Considere o vídeo original recebido como a representação definitiva do imóvel.')

export const SHORT_VIDEOS_NATURAL_ENDING_RULE = 'O vídeo deve terminar de forma natural. Não encerrar durante uma fala, expressão facial, movimento brusco ou quadro desfavorável. Finalizar em uma imagem estável e agradável, mantendo o último quadro adequado por um breve momento antes do término.'

export const SHORT_VIDEOS_GEMINI_MISSION = `${SHORT_VIDEOS_MISSION_OPENING}\n\n${SHORT_VIDEOS_COMPATIBLE_BASE_RULES}\n\n${SHORT_VIDEOS_NATURAL_ENDING_RULE}`

export type ShortVideosStructuredBriefing = Omit<SmartTourStructuredBriefing,
  'versao' | 'tarefa' | 'configuracoes' | 'sequenciaDasImagens' | 'cenas' | 'regrasPreservacao'
> & {
  versao: 'short-videos-structured-briefing-v1'
  tarefa: typeof SHORT_VIDEOS_GEMINI_MISSION
  configuracoes: Omit<SmartTourStructuredBriefing['configuracoes'], 'quantidadeImagens'> & {
    quantidadeVideos: 1
  }
  sequenciaDosVideos: string[]
  cenas: Array<Omit<SmartTourStructuredBriefing['cenas'][number], 'imagem'> & { video: string }>
  regrasPreservacao: Omit<SmartTourStructuredBriefing['regrasPreservacao'], 'umaImagemPorCena' | 'respeitarOrdemDasImagens'> & {
    usarSomenteVideoOriginal: true
    respeitarOrdemDoVideoOriginal: true
  }
}

const ANY = '*'

export const SMART_TOUR_PHRASE_LIBRARY: readonly PhraseDefinition[] = [
  { id: 'OPENING_01', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Conheça uma oportunidade para viver melhor.' },
  { id: 'OPENING_02', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Seu próximo lar pode estar aqui.' },
  { id: 'OPENING_03', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: ['Apartamento'], texto: 'Conheça este excelente apartamento à venda.' },
  { id: 'OPENING_04', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: ['Casa'], texto: 'Conheça esta excelente casa à venda.' },
  { id: 'OPENING_05', tipo: 'abertura', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Descubra uma nova forma de viver.' },
  { id: 'FEATURES_01', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Ambientes amplos e confortáveis para todos.' },
  { id: 'FEATURES_02', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: ['Apartamento'], texto: 'Espaços bem distribuídos para sua rotina.' },
  { id: 'FEATURES_03', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: ['Casa'], texto: 'Conforto presente em cada ambiente.' },
  { id: 'HIGHLIGHT_01', tipo: 'diferencial', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Detalhes que tornam a experiência especial.' },
  { id: 'HIGHLIGHT_02', tipo: 'diferencial', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Qualidade percebida em cada escolha.' },
  { id: 'HIGHLIGHT_03', tipo: 'diferencial', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Praticidade para aproveitar todos os momentos.' },
  { id: 'LOCATION_01', tipo: 'localizacao', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Mobilidade e conveniência ao seu alcance.' },
  { id: 'LOCATION_02', tipo: 'localizacao', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Mobilidade que facilita o cotidiano.' },
  { id: 'LOCATION_03', tipo: 'localizacao', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Tudo o que importa por perto.' },
  { id: 'CLOSING_01', tipo: 'encerramento', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Entre em contato.' },
  { id: 'OPENING_EN_01', tipo: 'abertura', idioma: 'en-US', finalidades: [ANY], tiposImovel: [ANY], texto: 'Discover your next home.' },
  { id: 'FEATURES_EN_01', tipo: 'caracteristicas', idioma: 'en-US', finalidades: [ANY], tiposImovel: [ANY], texto: 'Spaces designed for you.' },
  { id: 'HIGHLIGHT_EN_01', tipo: 'diferencial', idioma: 'en-US', finalidades: [ANY], tiposImovel: [ANY], texto: 'Quality in every detail.' },
  { id: 'LOCATION_EN_01', tipo: 'localizacao', idioma: 'en-US', finalidades: [ANY], tiposImovel: [ANY], texto: 'A location for living well.' },
  { id: 'CLOSING_EN_01', tipo: 'encerramento', idioma: 'en-US', finalidades: [ANY], tiposImovel: [ANY], texto: 'See it closely.' },
  { id: 'OPENING_ES_01', tipo: 'abertura', idioma: 'es', finalidades: [ANY], tiposImovel: [ANY], texto: 'Descubre tu próximo hogar.' },
  { id: 'FEATURES_ES_01', tipo: 'caracteristicas', idioma: 'es', finalidades: [ANY], tiposImovel: [ANY], texto: 'Espacios pensados para ti.' },
  { id: 'HIGHLIGHT_ES_01', tipo: 'diferencial', idioma: 'es', finalidades: [ANY], tiposImovel: [ANY], texto: 'Calidad en cada detalle.' },
  { id: 'LOCATION_ES_01', tipo: 'localizacao', idioma: 'es', finalidades: [ANY], tiposImovel: [ANY], texto: 'Ubicación para vivir mejor.' },
  { id: 'CLOSING_ES_01', tipo: 'encerramento', idioma: 'es', finalidades: [ANY], tiposImovel: [ANY], texto: 'Conócelo de cerca.' },
] as const

const MOVEMENTS: SmartTourStructuredBriefing['cenas'][number]['movimento'][] = [
  'movimento_linear_baixa_amplitude',
  'pan_suave',
  'push_in_minimo',
  'pull_back_minimo',
]

const TEXT_TIMELINE = [
  { bloco: 1, inicioSegundos: 0, fimSegundos: 2, tipo: 'abertura' },
  { bloco: 2, inicioSegundos: 2, fimSegundos: 4, tipo: 'caracteristicas' },
  { bloco: 3, inicioSegundos: 4, fimSegundos: 6, tipo: 'localizacao' },
  { bloco: 4, inicioSegundos: 6, fimSegundos: 8, tipo: 'diferencial' },
  { bloco: 5, inicioSegundos: 8, fimSegundos: 10, tipo: 'encerramento' },
] as const

const LOCATION_HIGHLIGHTS = new Set([
  'Próximo ao metrô', 'Próximo ao comércio', 'Próximo a escolas', 'Próximo a universidades',
  'Próximo a hospitais', 'Próximo a parques', 'Próximo ao shopping', 'Próximo à praia',
  'Próximo ao aeroporto', 'Próximo ao centro', 'Fácil acesso', 'Próximo a rodovias',
  'Rua tranquila', 'Bairro valorizado', 'Região nobre', 'Vista livre', 'Frente para praça',
])

const CONDOMINIUM_BENEFITS = new Set([
  'Lazer completo', 'Piscina', 'Piscina aquecida', 'Academia', 'Churrasqueira',
  'Espaço gourmet', 'Salão de festas', 'Salão de jogos', 'Playground', 'Brinquedoteca',
  'Coworking', 'Pet Place', 'Quadra esportiva', 'Quadra de tênis', 'Sauna', 'Spa',
  'Cinema', 'Mini mercado', 'Bicicletário', 'Lavanderia coletiva', 'Portaria 24h',
  'Portaria 24 horas', 'Condomínio clube', 'Piscina e academia',
  'Segurança 24h', 'Monitoramento', 'Elevador', 'Gerador', 'Energia solar',
])

const literal = (value: unknown) => removeNonOfficialPhoneNumbers(value)
const unique = <T extends string>(values: T[]) => [...new Set(values.filter(Boolean))]
const labelQuantity = (value: unknown, singular: string, plural: string) => {
  const cleaned = literal(value)
  if (!cleaned || Number(cleaned) === 0) return ''
  return `${cleaned} ${cleaned === '1' ? singular : plural}`
}
const normalizeMatch = (value: string) => value.trim().toLocaleLowerCase('pt-BR')
const normalizedHighlightSet = (values: Set<string>) => new Set([...values].map(normalizeMatch))
const NORMALIZED_LOCATION_HIGHLIGHTS = normalizedHighlightSet(LOCATION_HIGHLIGHTS)
const NORMALIZED_CONDOMINIUM_BENEFITS = normalizedHighlightSet(CONDOMINIUM_BENEFITS)
const matches = (criteria: readonly string[], value: string) => criteria.includes(ANY) || criteria.some(item => normalizeMatch(item) === normalizeMatch(value))
const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

const presenter = (config: SmartTourGenerationConfig): Presenter => {
  if (config.presenterGender === 'female') return 'corretora'
  if (config.presenterGender === 'male') return 'corretor'
  return 'nenhum'
}

const purpose = (value: unknown) => {
  const cleaned = literal(value)
  if (cleaned.toLocaleLowerCase('pt-BR') === 'sale') return 'Venda'
  if (cleaned.toLocaleLowerCase('pt-BR') === 'rent') return 'Locação'
  return cleaned
}

const sceneTypes = (count: number): SmartTourSceneType[] => {
  if (count <= 0) return []
  if (count === 1) return ['encerramento']
  if (count === 2) return ['abertura', 'encerramento']
  if (count === 3) return ['abertura', 'caracteristicas', 'encerramento']
  if (count === 4) return ['abertura', 'caracteristicas', 'localizacao', 'encerramento']
  return ['abertura', 'caracteristicas', 'diferencial', 'localizacao', ...Array.from({ length: count - 5 }, () => 'diferencial' as const), 'encerramento']
}

const selectPhrase = (input: {
  tipo: SmartTourSceneType
  finalidade: string
  tipoImovel: string
  idioma: SupportedLanguage
  signature: string
}) => {
  const eligible = SMART_TOUR_PHRASE_LIBRARY.filter(phrase =>
    phrase.tipo === input.tipo &&
    phrase.idioma === input.idioma &&
    matches(phrase.finalidades, input.finalidade) &&
    matches(phrase.tiposImovel, input.tipoImovel)
  )
  if (!eligible.length) return { id: '', texto: '' }
  const score = (phrase: PhraseDefinition) =>
    (phrase.finalidades.includes(ANY) ? 0 : 2) + (phrase.tiposImovel.includes(ANY) ? 0 : 1)
  const highestScore = Math.max(...eligible.map(score))
  const contextual = eligible.filter(phrase => score(phrase) === highestScore)
  const selected = contextual[stableHash(`${input.signature}:${input.tipo}`) % contextual.length]
  return { id: selected.id, texto: selected.texto }
}

const technicalCaption = (property: PropertyContext) => unique([
  labelQuantity(property.bedrooms, 'Dormitório', 'Dormitórios'),
  labelQuantity(property.suites, 'Suíte', 'Suítes'),
  labelQuantity(property.parkingSpaces, 'Vaga', 'Vagas'),
]).join(' • ')

const commercialHighlights = (property: PropertyContext) => {
  const highlights = unique((property.highlights || []).map(literal))
  const location = highlights.filter(item => NORMALIZED_LOCATION_HIGHLIGHTS.has(normalizeMatch(item)))
  const condominium = highlights.filter(item => NORMALIZED_CONDOMINIUM_BENEFITS.has(normalizeMatch(item)))
  const differentials = highlights.filter(item => !location.includes(item) && !condominium.includes(item))
  return { location, condominium, differentials }
}

const purposePresentation = (value: unknown) => {
  const normalized = literal(value).toLocaleLowerCase('pt-BR')
  if (normalized === 'sale') return 'À venda'
  if (normalized === 'rent') return 'Para alugar'
  return ''
}

const narrationWithPurpose = (text: string, displayedPurpose: string) => {
  if (!text || !displayedPurpose) return text
  const normalized = text.toLocaleLowerCase('pt-BR')
  if (displayedPurpose === 'À venda' && normalized.includes('à venda')) return text
  if (displayedPurpose === 'Para alugar') {
    if (normalized.includes('para alugar')) return text
    if (normalized.includes('para locação')) return text.replace(/para locação/giu, 'para alugar')
  }
  return `${displayedPurpose}. ${text}`
}

const commercialCaption = (blockNumber: number, property: PropertyContext, includePurposePresentation = true) => {
  if (blockNumber === 1) {
    const location = unique([literal(property.district), literal(property.city)]).join(' • ')
    const displayedPurpose = includePurposePresentation ? purposePresentation(property.purpose) : ''
    return [displayedPurpose, location].filter(Boolean).join('\n')
  }
  if (blockNumber === 2) return unique([literal(property.stage), technicalCaption(property)]).join('\n')
  if (blockNumber === 3) {
    const highlights = commercialHighlights(property)
    return highlights.location[0] || highlights.differentials[0] || highlights.condominium[0] || ''
  }
  if (blockNumber === 4) {
    const highlights = commercialHighlights(property)
    const selected = unique([
      highlights.condominium[0] || '',
      highlights.differentials[0] || highlights.location[1] || '',
    ])
    return selected.slice(0, 2).join(' • ')
  }
  return ''
}

export function buildShortVideosStructuredBriefing(input: {
  generation: SmartTourGenerationConfig
  property: PropertyContext
  selectedCta: string
  phone?: string
  professionalIdentity?: string
  videoPath: string
  language: SupportedLanguage
}): ShortVideosStructuredBriefing {
  const base = buildSmartTourStructuredBriefing({
    generation: input.generation,
    property: input.property,
    selectedCta: input.selectedCta,
    phone: input.phone,
    professionalIdentity: input.professionalIdentity,
    imagePaths: [input.videoPath],
    language: input.language,
    includePurposePresentation: true,
  })
  const { quantidadeImagens: _quantidadeImagens, ...configuracoes } = base.configuracoes
  const { umaImagemPorCena: _umaImagemPorCena, respeitarOrdemDasImagens: _respeitarOrdemDasImagens, ...regrasPreservacao } = base.regrasPreservacao
  const cenas = base.cenas.map(({ imagem, ...cena }) => ({ ...cena, video: imagem }))
  const regrasObrigatorias = base.regrasObrigatorias.map(regra => ({
    ...regra,
    valor: typeof regra.valor === 'string' ? regra.valor.replace('trocas de imagem', 'trocas de trecho do vídeo original') : regra.valor,
  }))
  const {
    versao: _versao,
    tarefa: _tarefa,
    configuracoes: _configuracoes,
    sequenciaDasImagens: _sequenciaDasImagens,
    cenas: _cenas,
    regrasPreservacao: _regrasPreservacao,
    ...estruturaComprovada
  } = base
  return {
    ...estruturaComprovada,
    versao: 'short-videos-structured-briefing-v1',
    tarefa: SHORT_VIDEOS_GEMINI_MISSION,
    configuracoes: { ...configuracoes, quantidadeVideos: 1 },
    sequenciaDosVideos: [input.videoPath],
    cenas,
    regrasPreservacao: { ...regrasPreservacao, usarSomenteVideoOriginal: true, respeitarOrdemDoVideoOriginal: true },
    regrasObrigatorias,
  }
}

export function isShortVideosStructuredBriefing(value: unknown): value is ShortVideosStructuredBriefing {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { versao?: unknown }).versao === 'short-videos-structured-briefing-v1')
  } catch {
    return false
  }
}

export function applySmartTourDynamicNarration<
  T extends SmartTourStructuredBriefing | ShortVideosStructuredBriefing,
>(briefing: T, narration: string): T {
  const text = String(narration || '').trim()
  if (!text || !briefing.configuracoes.narracaoAtiva) return briefing
  const narrationBlocks = briefing.timeline.narracao.map((block, index) => ({
    ...block,
    ...(index === 0 ? { inicioSegundos: 0, fimSegundos: briefing.timeline.duracaoTotalSegundos } : {}),
    texto: index === 0 ? text : '',
    frase_id: index === 0 ? 'OPENAI_DYNAMIC' : '',
  }))
  const scenes = briefing.cenas.map((scene, index) => ({
    ...scene,
    narracao: narrationBlocks[index]?.texto || '',
    frase_id: narrationBlocks[index]?.texto ? 'OPENAI_DYNAMIC' : scene.frase_id,
  }))
  return {
    ...briefing,
    cenas: scenes,
    timeline: { ...briefing.timeline, narracao: narrationBlocks },
  }
}

export function applySmartTourCustomPresenterSpeech(
  briefing: SmartTourStructuredBriefing,
  speech: unknown,
): SmartTourStructuredBriefing {
  const text = String(speech ?? '')
  if (!text.trim() || !briefing.configuracoes.narracaoAtiva) return briefing
  const narrationBlocks = briefing.timeline.narracao.map((block, index) => ({
    ...block,
    ...(index === 0 ? { inicioSegundos: 0, fimSegundos: briefing.timeline.duracaoTotalSegundos } : {}),
    texto: index === 0 ? text : '',
    frase_id: index === 0 ? 'CUSTOM_PRESENTER_SPEECH' : '',
  }))
  const scenes = briefing.cenas.map((scene, index) => ({
    ...scene,
    narracao: narrationBlocks[index]?.texto || '',
    frase_id: narrationBlocks[index]?.texto ? 'CUSTOM_PRESENTER_SPEECH' : scene.frase_id,
  }))
  return {
    ...briefing,
    cenas: scenes,
    timeline: { ...briefing.timeline, narracao: narrationBlocks },
    regrasObrigatorias: [
      ...briefing.regrasObrigatorias,
      { codigo: 'fala_personalizada', valor: 'A narração deve usar exatamente o texto literal de timeline.narracao, sem reescrever, resumir, corrigir, completar ou adicionar palavras.' },
    ],
  }
}

export function buildSmartTourStructuredBriefing(input: {
  generation: SmartTourGenerationConfig
  property: PropertyContext
  selectedCta: string
  phone?: string
  professionalIdentity?: string
  imagePaths: string[]
  language: SupportedLanguage
  includePurposePresentation?: boolean
}): SmartTourStructuredBriefing {
  const config = normalizeGeneration(input.generation)
  const finalidade = purpose(input.property.purpose)
  const tipoImovel = literal(input.property.type)
  const ctaTitle = literal(input.selectedCta)
  const phone = ctaTitle ? input.phone || '' : ''
  const professionalIdentity = String(input.professionalIdentity ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 160)
  const includePurposePresentation = input.includePurposePresentation !== false
  const displayedPurpose = input.language === 'pt-BR' && includePurposePresentation
    ? purposePresentation(input.property.purpose)
    : ''
  const signature = JSON.stringify({ property: input.property, generation: config, ctaTitle, phone, images: input.imagePaths })
  const narrationTimeline = TEXT_TIMELINE.map(block => {
    const phrase = config.narration === 'enabled'
      ? selectPhrase({ tipo: block.tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:timeline:${block.bloco}` })
      : { id: '', texto: '' }
    const texto = block.bloco === 1
      ? narrationWithPurpose(phrase.texto, displayedPurpose)
      : phrase.texto
    return { ...block, texto, frase_id: phrase.id }
  })
  const captionTimeline = TEXT_TIMELINE.slice(0, 4).map(block => ({
    bloco: block.bloco,
    inicioSegundos: block.inicioSegundos,
    fimSegundos: block.fimSegundos,
    texto: config.captions === 'enabled'
      ? commercialCaption(block.bloco, input.property, includePurposePresentation)
      : '',
  }))
  const ctaTimeline = {
    bloco: 5,
    inicioSegundos: 8,
    fimSegundos: 10,
    texto: ctaTitle ? [ctaTitle, phone].filter(Boolean).join('\n') : '',
    titulo: ctaTitle,
    telefone: phone,
  }
  const professionalIdentityTimeline = {
    bloco: 6,
    inicioSegundos: ctaTitle ? 6 : 8,
    fimSegundos: ctaTitle ? 8 : 10,
    texto: professionalIdentity,
  }
  const types = sceneTypes(input.imagePaths.length)
  const scenes = input.imagePaths.map((image, index) => {
    const sceneNumber = index + 1
    const tipo = types[index]
    const isLast = tipo === 'encerramento'
    const phrase = config.narration === 'enabled'
      ? selectPhrase({ tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:${sceneNumber}` })
      : { id: '', texto: '' }
    const narration = sceneNumber === 1
      ? narrationWithPurpose(phrase.texto, displayedPurpose)
      : phrase.texto
    const legenda = isLast
      ? (ctaTitle ? [ctaTitle, phone].filter(Boolean).join('\n') : '')
      : (config.captions === 'enabled' ? commercialCaption(sceneNumber, input.property, includePurposePresentation) : '')
    return {
      numero: sceneNumber,
      tipo,
      frase_id: phrase.id,
      imagem: image,
      movimento: MOVEMENTS[index % MOVEMENTS.length],
      legenda,
      narracao: narration,
      duracaoNarracaoSegundos: config.narration === 'enabled' ? (isLast ? 1.2 : 1.8) : 0,
      tempoTelefoneVisivelAposNarracaoSegundos: isLast && Boolean(phone) ? 0.8 : 0,
    } as SmartTourStructuredBriefing['cenas'][number]
  })
  const presenterType = presenter(config)
  const hasPresenter = presenterType !== 'nenhum'
  const presenterLabel = presenterType === 'corretor' ? 'um corretor' : 'uma corretora'
  const presenterReference = presenterType === 'corretor' ? 'O corretor' : 'A corretora'
  const presenterRules = hasPresenter ? [
    { codigo: 'apresentador_obrigatorio', valor: `Criar e exibir obrigatoriamente exatamente uma pessoa: ${presenterLabel}. Essa pessoa deve aparecer naturalmente durante a apresentação.` },
    { codigo: 'apresentador_excecao_unica', valor: `${presenterReference} é a única exceção autorizada à regra de não inventar pessoas. Não criar, exibir ou sugerir nenhuma pessoa adicional.` },
    { codigo: 'apresentador_preserva_imovel', valor: `A presença e os movimentos naturais de ${presenterLabel} não podem alterar, reconstruir, ocultar ou substituir qualquer parte do imóvel. O imóvel deve ser preservado integralmente.` },
  ] : []
  return {
    versao: 'smart-tour-structured-briefing-v1',
    tarefa: SMART_TOUR_GEMINI_MISSION,
    configuracoes: {
      modo: config.mode,
      idioma: input.language,
      formato: '9:16',
      duracaoSegundos: 10,
      quantidadeImagens: input.imagePaths.length,
      narracaoAtiva: config.narration === 'enabled',
      legendasAtivas: config.captions === 'enabled',
      ctaAtivo: Boolean(ctaTitle),
      identificacaoProfissionalAtiva: Boolean(professionalIdentity),
    },
    imovel: {
      finalidade,
      tipo: tipoImovel,
      estadoDoImovel: literal(input.property.stage),
      localizacao: { estado: literal(input.property.state), cidade: literal(input.property.city), bairro: literal(input.property.district) },
      dormitorios: literal(input.property.bedrooms),
      suites: literal(input.property.suites),
      banheiros: null,
      vagas: literal(input.property.parkingSpaces),
      area: literal(input.property.area),
      preco: literal(input.property.price),
      condominio: literal(input.property.condominium),
      iptu: literal(input.property.iptu),
      destaques: unique((input.property.highlights || []).map(literal)).slice(0, 10),
      descricao: literal(input.property.description),
    },
    apresentador: { tipo: presenterType, unicoHumanoAutorizado: hasPresenter },
    musica: { configurada: false, instrucao: 'preservar_comportamento_atual' },
    sequenciaDasImagens: [...input.imagePaths],
    movimentosDesejados: [...MOVEMENTS],
    cenas: scenes,
    timeline: {
      duracaoTotalSegundos: 10,
      legendas: captionTimeline,
      narracao: narrationTimeline.map(({ tipo: _tipo, ...block }) => block),
      cta: ctaTimeline,
      identificacaoProfissional: professionalIdentityTimeline,
    },
    legendas: {
      ativas: config.captions === 'enabled' || Boolean(ctaTitle),
    },
    cta: { titulo: ctaTitle, telefone: phone },
    identificacaoProfissional: { texto: professionalIdentity },
    regrasPreservacao: {
      cenarioProtegido: true,
      umaImagemPorCena: true,
      respeitarOrdemDasImagens: true,
      elementosImutaveis: ['arquitetura', 'paredes', 'pisos', 'tetos', 'portas', 'janelas', 'móveis existentes', 'decoração', 'objetos', 'acabamentos', 'cores', 'proporções', 'perspectiva', 'enquadramento'],
      transformacoesPermitidas: [
        'movimento linear de baixa amplitude', 'pan suave', 'push-in mínimo', 'pull-back mínimo',
        'variações naturais sutis de luminosidade',
        ...(hasPresenter ? [`movimentos naturais e discretos da única ${presenterType} autorizada`] : []),
      ],
    },
    regrasObrigatorias: [
      { codigo: 'usar_json_como_fonte_unica', valor: 'Utilizar exclusivamente as informações existentes neste JSON. Não inventar. Não completar. Não alterar. Não corrigir. Não substituir. Todas as informações utilizadas na geração deverão ser obtidas exclusivamente deste JSON.' },
      ...GEMINI_VIDEO_TEXT_RULES,
      { codigo: 'sem_invencao', valor: hasPresenter ? `não inventar dados, contatos, ambientes, pessoas adicionais ou elementos; a única pessoa autorizada e obrigatória é a ${presenterType} definida em apresentador.tipo` : 'não inventar dados, contatos, ambientes, pessoas ou elementos' },
      ...presenterRules,
      { codigo: 'idioma', valor: input.language },
      { codigo: 'formato_vertical', valor: '9:16' },
      { codigo: 'duracao_total_segundos', valor: 10 },
      { codigo: 'legendas_obrigatorias_quando_ativas', valor: config.captions === 'enabled' },
      { codigo: 'timeline_temporal_fonte_efetiva', valor: 'Renderizar no próprio vídeo final exclusivamente timeline.legendas, timeline.narracao, timeline.cta e timeline.identificacaoProfissional como fonte efetiva dos textos, da narração e de seus tempos. As trocas de texto são independentes das trocas de imagem. Os campos textuais de cenas existem somente para compatibilidade temporária e não controlam a timeline.' },
      { codigo: 'identificacao_profissional_visual_deterministica', valor: professionalIdentity ? 'timeline.identificacaoProfissional é uma sobreposição visual discreta do compositor determinístico. Nunca narrar, reescrever, completar ou incluir esse texto em legendas sociais.' : false },
      { codigo: 'legendas_sem_valores_comerciais_automaticos', valor: 'Nunca usar automaticamente em legendas: valor do condomínio, IPTU, preço, taxas ou código do imóvel. Condomínio somente pode aparecer como benefício selecionado, como lazer completo, piscina, academia, portaria 24 horas ou condomínio clube; nunca como valor monetário.' },
      { codigo: 'narracao_complementar', valor: 'a narração não pode repetir exatamente a legenda' },
      { codigo: 'cta_deterministico', valor: 'reservar a última cena para a legenda formada somente por cta.titulo e cta.telefone, sem alterar caracteres' },
      { codigo: 'ultima_narracao_curta', valor: 'limitar a narração final a 1,2 segundo e manter somente o telefone visível por aproximadamente 0,8 segundo após a fala' },
    ],
  }
}

import type { PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { normalizeGeneration } from './validation.ts'

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
  legendas: { ativas: boolean }
  cta: { titulo: string; telefone: string }
  regrasPreservacao: {
    cenarioProtegido: true
    umaImagemPorCena: true
    respeitarOrdemDasImagens: true
    elementosImutaveis: string[]
    transformacoesPermitidas: string[]
  }
  regrasObrigatorias: Array<{ codigo: string; valor: string | boolean | number }>
}

const ANY = '*'

export const SMART_TOUR_PHRASE_LIBRARY: readonly PhraseDefinition[] = [
  { id: 'OPENING_01', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Excelente imóvel à venda.' },
  { id: 'OPENING_02', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Excelente imóvel para locação.' },
  { id: 'OPENING_03', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: ['Apartamento'], texto: 'Excelente apartamento à venda.' },
  { id: 'OPENING_04', tipo: 'abertura', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: ['Casa'], texto: 'Excelente casa à venda.' },
  { id: 'OPENING_05', tipo: 'abertura', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Um imóvel para você.' },
  { id: 'FEATURES_01', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Espaços pensados para você.' },
  { id: 'FEATURES_02', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: ['Apartamento'], texto: 'Ambientes para viver bem.' },
  { id: 'FEATURES_03', tipo: 'caracteristicas', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: ['Casa'], texto: 'Conforto em cada ambiente.' },
  { id: 'HIGHLIGHT_01', tipo: 'diferencial', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Qualidade em cada detalhe.' },
  { id: 'HIGHLIGHT_02', tipo: 'diferencial', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Detalhes que fazem diferença.' },
  { id: 'HIGHLIGHT_03', tipo: 'diferencial', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Praticidade para sua rotina.' },
  { id: 'LOCATION_01', tipo: 'localizacao', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Localização para viver melhor.' },
  { id: 'LOCATION_02', tipo: 'localizacao', idioma: 'pt-BR', finalidades: ['Venda'], tiposImovel: [ANY], texto: 'Tudo perto de você.' },
  { id: 'LOCATION_03', tipo: 'localizacao', idioma: 'pt-BR', finalidades: ['Locação'], tiposImovel: [ANY], texto: 'Mobilidade para sua rotina.' },
  { id: 'CLOSING_01', tipo: 'encerramento', idioma: 'pt-BR', finalidades: [ANY], tiposImovel: [ANY], texto: 'Conheça de perto.' },
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

const literal = (value: unknown) => removeNonOfficialPhoneNumbers(value)
const unique = <T extends string>(values: T[]) => [...new Set(values.filter(Boolean))]
const labelQuantity = (value: unknown, singular: string, plural: string) => {
  const cleaned = literal(value)
  if (!cleaned || Number(cleaned) === 0) return ''
  return `${cleaned} ${cleaned === '1' ? singular : plural}`
}
const normalizeMatch = (value: string) => value.trim().toLocaleLowerCase('pt-BR')
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

const measuresCaption = (property: PropertyContext) => unique([
  literal(property.area) ? `${literal(property.area)} m²` : '',
  labelQuantity(property.bedrooms, 'Dormitório', 'Dormitórios'),
  labelQuantity(property.suites, 'Suíte', 'Suítes'),
]).join(' • ')

const intermediateCaption = (tipo: SmartTourSceneType, property: PropertyContext, includePrice: boolean) => {
  if (tipo === 'abertura') return unique([literal(property.type), purpose(property.purpose)]).join(' • ')
  if (tipo === 'caracteristicas') return unique([
    measuresCaption(property),
    includePrice ? literal(property.price) : '',
  ]).join('\n')
  if (tipo === 'diferencial') return literal(property.highlights?.[0]) || literal(property.stage)
  if (tipo === 'localizacao') return unique([literal(property.district), literal(property.city)]).join(' • ')
  return ''
}

export function buildSmartTourStructuredBriefing(input: {
  generation: SmartTourGenerationConfig
  property: PropertyContext
  selectedCta: string
  phone?: string
  imagePaths: string[]
  language: SupportedLanguage
}): SmartTourStructuredBriefing {
  const config = normalizeGeneration(input.generation)
  const finalidade = purpose(input.property.purpose)
  const tipoImovel = literal(input.property.type)
  const ctaTitle = literal(input.selectedCta)
  const phone = ctaTitle ? input.phone || '' : ''
  const signature = JSON.stringify({ property: input.property, generation: config, ctaTitle, phone, images: input.imagePaths })
  const types = sceneTypes(input.imagePaths.length)
  const priceSceneIndex = types.findIndex(type => type === 'caracteristicas')
  const fallbackPriceSceneIndex = types.findIndex(type => type !== 'encerramento')
  const scenes = input.imagePaths.map((image, index) => {
    const sceneNumber = index + 1
    const tipo = types[index]
    const isLast = tipo === 'encerramento'
    const phrase = config.narration === 'enabled'
      ? selectPhrase({ tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:${sceneNumber}` })
      : { id: '', texto: '' }
    const shouldIncludePrice = index === (priceSceneIndex >= 0 ? priceSceneIndex : fallbackPriceSceneIndex)
    const legenda = isLast
      ? (ctaTitle ? [ctaTitle, phone].filter(Boolean).join('\n') : '')
      : (config.captions === 'enabled' ? intermediateCaption(tipo, input.property, shouldIncludePrice) : '')
    return {
      numero: sceneNumber,
      tipo,
      frase_id: phrase.id,
      imagem: image,
      movimento: MOVEMENTS[index % MOVEMENTS.length],
      legenda,
      narracao: phrase.texto,
      duracaoNarracaoSegundos: config.narration === 'enabled' ? (isLast ? 1.2 : 1.8) : 0,
      tempoTelefoneVisivelAposNarracaoSegundos: isLast && Boolean(phone) ? 0.8 : 0,
    } as SmartTourStructuredBriefing['cenas'][number]
  })
  const presenterType = presenter(config)
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
    apresentador: { tipo: presenterType, unicoHumanoAutorizado: presenterType !== 'nenhum' },
    musica: { configurada: false, instrucao: 'preservar_comportamento_atual' },
    sequenciaDasImagens: [...input.imagePaths],
    movimentosDesejados: [...MOVEMENTS],
    cenas: scenes,
    legendas: {
      ativas: config.captions === 'enabled' || Boolean(ctaTitle),
    },
    cta: { titulo: ctaTitle, telefone: phone },
    regrasPreservacao: {
      cenarioProtegido: true,
      umaImagemPorCena: true,
      respeitarOrdemDasImagens: true,
      elementosImutaveis: ['arquitetura', 'paredes', 'pisos', 'tetos', 'portas', 'janelas', 'móveis existentes', 'decoração', 'objetos', 'acabamentos', 'cores', 'proporções', 'perspectiva', 'enquadramento'],
      transformacoesPermitidas: ['movimento linear de baixa amplitude', 'pan suave', 'push-in mínimo', 'pull-back mínimo', 'variações naturais sutis de luminosidade'],
    },
    regrasObrigatorias: [
      { codigo: 'usar_json_como_fonte_unica', valor: 'Utilizar exclusivamente as informações existentes neste JSON. Não inventar. Não completar. Não alterar. Não corrigir. Não substituir. Todas as informações utilizadas na geração deverão ser obtidas exclusivamente deste JSON.' },
      { codigo: 'sem_invencao', valor: 'não inventar dados, contatos, ambientes, pessoas ou elementos' },
      { codigo: 'idioma', valor: input.language },
      { codigo: 'formato_vertical', valor: '9:16' },
      { codigo: 'duracao_total_segundos', valor: 10 },
      { codigo: 'legendas_obrigatorias_quando_ativas', valor: config.captions === 'enabled' },
      { codigo: 'narracao_complementar', valor: 'a narração não pode repetir exatamente a legenda' },
      { codigo: 'cta_deterministico', valor: 'reservar a última cena para a legenda formada somente por cta.titulo e cta.telefone, sem alterar caracteres' },
      { codigo: 'preco_intermediario', valor: 'quando informado e as legendas estiverem ativas, exibir imovel.preco somente em cena intermediária, nunca na cena final' },
      { codigo: 'ultima_narracao_curta', valor: 'limitar a narração final a 1,2 segundo e manter somente o telefone visível por aproximadamente 0,8 segundo após a fala' },
    ],
  }
}

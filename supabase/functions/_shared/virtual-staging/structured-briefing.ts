import type { LifeScene, PresenterReference, PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { normalizeGeneration } from './validation.ts'
import { composePtBrPropertySpeechFacts } from '../pt-br-speech.ts'
import { presentCta, presentHighlight, presentHighlights, presentLifeProfile, presentMetricLabel, presentPropertyType, presentPurpose, presentStage } from './presentation.ts'

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

type Presenter = 'corretora' | 'corretor' | 'referencia_do_usuario' | 'nenhum'
const LIFE_SCENE_LABELS: Record<LifeScene, string> = {
  young: 'jovens',
  young_dog: 'jovens com cachorro',
  young_cat: 'jovens com gato',
  adult: 'adultos',
  adult_dog: 'adultos com cachorro',
  adult_cat: 'adultos com gato',
  senior: 'idosos',
  senior_dog: 'idosos com cachorro',
  senior_cat: 'idosos com gato',
}
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
  referenciaApresentador?: PresenterReference & { posicaoNaEntrada: 1; usoExclusivo: 'referencia_de_identidade' }
  vidaNoImovel?: { life_scene: LifeScene; descricao: string }
  apresentacao?: {
    finalidade: string
    tipo: string
    estadoDoImovel: string
    metricas: { dormitorios: string; suites: string; vagas: string; area: string }
    diferenciais: string[]
    cta: string
    perfilVida?: string
  }
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
  }
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

const LIFE_PROVIDER_VISUAL_RULES = new Set([
  'legendas_obrigatorias_quando_ativas',
  'timeline_temporal_fonte_efetiva',
  'sequencia_comercial_vida_no_imovel',
  'cta_deterministico',
  'ultima_narracao_curta',
])

export function buildVirtualSpaceProviderBriefing(briefing: SmartTourStructuredBriefing) {
  if (!briefing.vidaNoImovel) return briefing
  return {
    ...briefing,
    configuracoes: { ...briefing.configuracoes, legendasAtivas: false, ctaAtivo: false },
    cenas: briefing.cenas.map(scene => ({ ...scene, legenda: '' })),
    timeline: {
      ...briefing.timeline,
      legendas: briefing.timeline.legendas.map(block => ({ ...block, texto: '' })),
      cta: { ...briefing.timeline.cta, texto: '', titulo: '', telefone: '' },
    },
    legendas: { ativas: false },
    cta: { titulo: '', telefone: '' },
    regrasObrigatorias: [
      ...briefing.regrasObrigatorias.filter(rule => !LIFE_PROVIDER_VISUAL_RULES.has(rule.codigo)),
      {
        codigo: 'vida_no_imovel_sem_texto_nativo',
        valor: 'Não produzir, desenhar, gerar ou animar letras, palavras, legendas, subtítulos, preços, placas, logotipos, localização, destaque, CTA, telefone, selo, tipografia ou qualquer outro texto visual no vídeo-base. Preserve integralmente pessoas, imóvel, movimentos, áudio, duração e sincronização da narração. Toda apresentação visual de texto será aplicada uma única vez pelo compositor determinístico após a geração.',
      },
    ],
  } satisfies SmartTourStructuredBriefing
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

const LIFE_SCENE_CAPTION_TIMELINE = [
  { bloco: 1, inicioSegundos: 0, fimSegundos: 1.6 },
  { bloco: 2, inicioSegundos: 1.6, fimSegundos: 3.2 },
  { bloco: 3, inicioSegundos: 3.2, fimSegundos: 4.8 },
  { bloco: 4, inicioSegundos: 4.8, fimSegundos: 6.4 },
  { bloco: 5, inicioSegundos: 6.4, fimSegundos: 8 },
] as const

const LIFE_SCENE_NARRATION_TIMELINE = [
  { bloco: 1, inicioSegundos: 0.3, fimSegundos: 3.1, tipo: 'abertura' },
  { bloco: 2, inicioSegundos: 3.1, fimSegundos: 6.7, tipo: 'caracteristicas' },
  { bloco: 3, inicioSegundos: 6.7, fimSegundos: 8.1, tipo: 'localizacao' },
  { bloco: 4, inicioSegundos: 8.1, fimSegundos: 8.4, tipo: 'diferencial' },
  { bloco: 5, inicioSegundos: 8.4, fimSegundos: 9.6, tipo: 'encerramento' },
] as const

function splitLiteralSpeechIntoTimeline(text: string, blockCount: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return Array.from({ length: blockCount }, (_, index) => {
    const start = Math.floor(index * words.length / blockCount)
    const end = Math.floor((index + 1) * words.length / blockCount)
    return words.slice(start, end).join(' ')
  })
}

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
  const normalized = cleaned.toLocaleLowerCase('pt-BR')
  if (normalized === 'sale') return 'Venda'
  if (normalized === 'rent' || normalized === 'rental') return 'Locação'
  return cleaned
}

const LIFE_SCENE_PROPERTY_OPENINGS: Record<string, string> = {
  apartamento: 'este excelente apartamento',
  casa: 'esta excelente casa',
  cobertura: 'esta excelente cobertura',
  'studio / loft': 'este excelente studio',
  'terreno / lote': 'este excelente terreno',
  comercial: 'este excelente imóvel comercial',
}

const LIFE_SCENE_CONCISE_PROPERTY_NAMES: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  cobertura: 'Cobertura',
  'studio / loft': 'Studio',
  'terreno / lote': 'Terreno',
  comercial: 'Imóvel comercial',
}

const narrationWordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length

const firstNarrationWithinLimit = (candidates: string[], maximumWords: number) =>
  candidates.find(candidate => candidate && narrationWordCount(candidate) <= maximumWords) || ''

const lifeScenePurpose = (value: unknown) => {
  const normalized = normalizeMatch(literal(value)).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (['sale', 'venda'].includes(normalized)) return { narration: 'à venda', caption: 'À VENDA' }
  if (['rent', 'rental', 'locacao'].includes(normalized)) return { narration: 'para locação', caption: 'PARA LOCAÇÃO' }
  return null
}

const lifeSceneOpeningNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language !== 'pt-BR') return ''
  const purposeLabel = lifeScenePurpose(property.purpose)
  if (!purposeLabel) return ''
  const propertyType = normalizeMatch(literal(property.type))
  const subject = LIFE_SCENE_PROPERTY_OPENINGS[propertyType] || 'este excelente imóvel'
  const district = literal(property.district)
  const city = literal(property.city)
  const location = district && city
    ? ` no bairro ${district}, em ${city}`
    : district
      ? ` no bairro ${district}`
      : city
        ? ` em ${city}`
        : ''
  return `Conheça ${subject} ${purposeLabel.narration}${location}.`
}

const lifeSceneFactsNarration = (property: PropertyContext) => {
  const facts = composePtBrPropertySpeechFacts({
    bedrooms: property.bedrooms,
    suites: property.suites,
    parkingSpaces: property.parkingSpaces,
    variant: 'concise',
  })
  return facts ? `O imóvel possui ${facts}.` : ''
}

const lifeSceneStageNarration = (property: PropertyContext) => {
  const stage = literal(property.stage)
  if (!stage) return ''
  return `O imóvel está ${stage.charAt(0).toLocaleLowerCase('pt-BR')}${stage.slice(1)}.`
}

const brokerGeneratedOpeningNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language !== 'en-US') return lifeSceneOpeningNarration(property, language)
  const purposeLabel = presentPurpose(purpose(property.purpose), language).toLocaleLowerCase('en-US')
  if (!purposeLabel) return ''
  const propertyType = presentPropertyType(property.type, language)
  const district = literal(property.district)
  const city = literal(property.city)
  return firstNarrationWithinLimit([
    district && city ? `${propertyType} ${purposeLabel} in ${district}, ${city}.` : '',
    district ? `${propertyType} ${purposeLabel} in ${district}.` : '',
    city ? `${propertyType} ${purposeLabel} in ${city}.` : '',
    `${propertyType} ${purposeLabel}.`,
  ], 8)
}

const brokerGeneratedFactsNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language !== 'en-US') return lifeSceneFactsNarration(property)
  const facts = [
    captionMetric(property.bedrooms, 'bedrooms', language),
    captionMetric(property.suites, 'suites', language),
    captionMetric(property.parkingSpaces, 'parkingSpaces', language),
  ].filter(Boolean)
  for (let count = facts.length; count > 0; count -= 1) {
    const selected = facts.slice(0, count)
    const candidate = `${selected.length <= 1 ? selected[0] : `${selected.slice(0, -1).join(', ')} and ${selected.at(-1)}`}.`
    if (narrationWordCount(candidate) <= 8) return candidate
  }
  return ''
}

const brokerGeneratedStageNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language !== 'en-US') return lifeSceneStageNarration(property)
  const stage = presentStage(property.stage, language)
  return firstNarrationWithinLimit([stage ? `${stage}.` : ''], 4)
}

const brokerGeneratedHighlightNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language !== 'en-US') return ''
  const highlight = presentHighlight(property.highlights?.[0], language)
  return firstNarrationWithinLimit([highlight ? `${highlight}.` : ''], 5)
}

const brokerGeneratedLegacyNarration = (blockNumber: number, property: PropertyContext, language: SupportedLanguage) => {
  if (blockNumber === 1) return { id: 'LIFE_COMMERCIAL_OPENING', texto: lifeSceneOpeningNarration(property, language) }
  if (blockNumber === 2) return { id: 'LIFE_PROPERTY_FACTS', texto: lifeSceneFactsNarration(property) }
  if (blockNumber === 3) return { id: 'LIFE_PROPERTY_STAGE', texto: lifeSceneStageNarration(property) }
  if (blockNumber === 5) return { id: 'LIFE_FINAL_INVITATION', texto: language === 'pt-BR' ? 'Agende sua visita.' : '' }
  return { id: '', texto: '' }
}

const brokerGeneratedNarration = (blockNumber: number, property: PropertyContext, language: SupportedLanguage, selectedCta: string) => {
  if (language !== 'en-US') return brokerGeneratedLegacyNarration(blockNumber, property, language)
  if (blockNumber === 1) return { id: 'BROKER_GENERATED_OPENING', texto: brokerGeneratedOpeningNarration(property, language) }
  if (blockNumber === 2) return { id: 'BROKER_GENERATED_FACTS', texto: brokerGeneratedFactsNarration(property, language) }
  if (blockNumber === 3) return { id: 'BROKER_GENERATED_STAGE', texto: brokerGeneratedStageNarration(property, language) }
  if (blockNumber === 4) return { id: 'BROKER_GENERATED_HIGHLIGHT', texto: brokerGeneratedHighlightNarration(property, language) }
  if (blockNumber === 5) return { id: 'BROKER_GENERATED_CTA', texto: selectedCta ? `${presentCta(selectedCta, language)}.` : '' }
  return { id: '', texto: '' }
}

const lifeInPropertyOpeningNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language === 'en-US') {
    const purposeLabel = presentPurpose(purpose(property.purpose), language).toLocaleLowerCase('en-US')
    if (!purposeLabel) return ''
    const propertyType = presentPropertyType(property.type, language)
    const district = literal(property.district)
    const city = literal(property.city)
    return firstNarrationWithinLimit([
      district && city ? `${propertyType} ${purposeLabel} in ${district}, ${city}.` : '',
      district ? `${propertyType} ${purposeLabel} in ${district}.` : '',
      city ? `${propertyType} ${purposeLabel} in ${city}.` : '',
      `${propertyType} ${purposeLabel}.`,
    ], 7)
  }
  if (language !== 'pt-BR') return ''
  const purposeLabel = lifeScenePurpose(property.purpose)
  if (!purposeLabel) return ''
  const propertyType = normalizeMatch(literal(property.type))
  const subject = LIFE_SCENE_CONCISE_PROPERTY_NAMES[propertyType] || 'Imóvel'
  const district = literal(property.district)
  const city = literal(property.city)
  return firstNarrationWithinLimit([
    district && city ? `${subject} ${purposeLabel.narration} em ${district}, ${city}.` : '',
    district ? `${subject} ${purposeLabel.narration} em ${district}.` : '',
    city ? `${subject} ${purposeLabel.narration} em ${city}.` : '',
    `${subject} ${purposeLabel.narration}.`,
  ], 7)
}

const joinNarrationFacts = (facts: string[]) => {
  if (facts.length <= 1) return facts[0] || ''
  return `${facts.slice(0, -1).join(', ')} e ${facts.at(-1)}`
}

const lifeInPropertyFeatureNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language === 'en-US') {
    const facts = [
      captionMetric(property.bedrooms, 'bedrooms', language),
      captionMetric(property.suites, 'suites', language),
      captionMetric(property.parkingSpaces, 'parkingSpaces', language),
    ].filter(Boolean)
    for (let count = facts.length; count > 0; count -= 1) {
      const selected = facts.slice(0, count)
      const candidate = `${selected.length <= 1 ? selected[0] : `${selected.slice(0, -1).join(', ')} and ${selected.at(-1)}`}.`
      if (narrationWordCount(candidate) <= 8) return candidate
    }
    const highlight = presentHighlight(property.highlights?.[0], language)
    return firstNarrationWithinLimit([highlight ? `${highlight}.` : ''], 8)
  }
  const factsText = composePtBrPropertySpeechFacts({
    bedrooms: property.bedrooms,
    suites: property.suites,
    parkingSpaces: property.parkingSpaces,
    variant: 'concise',
  })
  const facts = factsText ? factsText.split(/, | e /).filter(Boolean) : []
  for (let count = facts.length; count > 0; count -= 1) {
    const candidate = `${joinNarrationFacts(facts.slice(0, count))}.`
    if (narrationWordCount(candidate) <= 8) return candidate
  }
  const highlight = literal(property.highlights?.[0])
  return firstNarrationWithinLimit([highlight ? `${highlight}.` : ''], 8)
}

const lifeInPropertyStageNarration = (property: PropertyContext, language: SupportedLanguage) => {
  if (language === 'en-US') return firstNarrationWithinLimit([presentStage(property.stage, language) ? `${presentStage(property.stage, language)}.` : ''], 4)
  const stage = literal(property.stage)
  return firstNarrationWithinLimit([stage ? `${stage}.` : ''], 4)
}

const lifeInPropertyNarration = (blockNumber: number, property: PropertyContext, language: SupportedLanguage, selectedCta: string) => {
  if (blockNumber === 1) return { id: 'LIFE_CONCISE_OPENING', texto: lifeInPropertyOpeningNarration(property, language) }
  if (blockNumber === 2) return { id: 'LIFE_CONCISE_FEATURE', texto: lifeInPropertyFeatureNarration(property, language) }
  if (blockNumber === 3) return { id: 'LIFE_CONCISE_STAGE', texto: lifeInPropertyStageNarration(property, language) }
  if (blockNumber === 5) {
    const cta = presentCta(selectedCta, language)
    return { id: 'LIFE_CONCISE_INVITATION', texto: language === 'en-US' && cta ? `${cta}.` : language === 'pt-BR' ? 'Agende sua visita.' : '' }
  }
  return { id: '', texto: '' }
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

const captionMetric = (value: unknown, metric: 'bedrooms' | 'suites' | 'parkingSpaces', language: SupportedLanguage) => {
  const cleaned = literal(value)
  if (!cleaned || Number(cleaned) === 0) return ''
  if (language !== 'en-US') return labelQuantity(cleaned, metric === 'bedrooms' ? 'Dormitório' : metric === 'suites' ? 'Suíte' : 'Vaga', metric === 'bedrooms' ? 'Dormitórios' : metric === 'suites' ? 'Suítes' : 'Vagas')
  const label = presentMetricLabel(metric, language)
  return `${cleaned} ${cleaned === '1' ? label.replace(/s$/, '') : label}`
}

const technicalCaption = (property: PropertyContext, language: SupportedLanguage) => unique([
  captionMetric(property.bedrooms, 'bedrooms', language),
  captionMetric(property.suites, 'suites', language),
  captionMetric(property.parkingSpaces, 'parkingSpaces', language),
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

const commercialCaption = (blockNumber: number, property: PropertyContext, includePurposePresentation = true, language: SupportedLanguage = 'pt-BR') => {
  if (blockNumber === 1) {
    const location = unique([literal(property.district), literal(property.city)]).join(' • ')
    const displayedPurpose = includePurposePresentation
      ? (language === 'en-US' ? presentPurpose(purpose(property.purpose), language) : purposePresentation(property.purpose))
      : ''
    return [displayedPurpose, location].filter(Boolean).join('\n')
  }
  if (blockNumber === 2) return unique([language === 'en-US' ? presentStage(property.stage, language) : literal(property.stage), technicalCaption(property, language)]).join('\n')
  if (blockNumber === 3) {
    const highlights = commercialHighlights(property)
    const selected = highlights.location[0] || highlights.differentials[0] || highlights.condominium[0] || ''
    return language === 'en-US' ? presentHighlight(selected, language) : selected
  }
  if (blockNumber === 4) {
    const highlights = commercialHighlights(property)
    const selected = unique([
      highlights.condominium[0] || '',
      highlights.differentials[0] || highlights.location[1] || '',
    ])
    return selected.slice(0, 2).map(item => language === 'en-US' ? presentHighlight(item, language) : item).join(' • ')
  }
  return ''
}

const lifeSceneCommercialCaption = (blockNumber: number, property: PropertyContext, language: SupportedLanguage) => {
  const highlights = unique((property.highlights || []).map(literal))
  if (blockNumber === 1) return language === 'en-US' ? presentPurpose(purpose(property.purpose), language) : lifeScenePurpose(property.purpose)?.caption || ''
  if (blockNumber === 2) return language === 'en-US' ? presentStage(property.stage, language) : literal(property.stage)
  if (blockNumber === 3) return unique([literal(property.district), literal(property.city)]).join(', ')
  if (blockNumber === 4) return language === 'en-US' ? presentHighlight(highlights[0], language) : highlights[0] || ''
  if (blockNumber === 5) return literal(property.price) || (language === 'en-US' ? presentHighlight(highlights[1], language) : highlights[1]) || ''
  return ''
}

export function buildSmartTourStructuredBriefing(input: {
  generation: SmartTourGenerationConfig
  property: PropertyContext
  selectedCta: string
  phone?: string
  imagePaths: string[]
  language: SupportedLanguage
  presenterReference?: PresenterReference
}): SmartTourStructuredBriefing {
  const config = normalizeGeneration(input.generation)
  const language = input.language || 'pt-BR'
  const finalidade = purpose(input.property.purpose)
  const tipoImovel = literal(input.property.type)
  const ctaTitle = literal(input.selectedCta)
  const phone = input.phone || ''
  const lifeScene = config.life_scene
  const requiresCommercialPurpose = Boolean(lifeScene || input.presenterReference)
  const purposeOpening = input.presenterReference && config.presenterSpeechMode === 'generated'
    ? brokerGeneratedOpeningNarration(input.property, language)
    : requiresCommercialPurpose ? lifeSceneOpeningNarration(input.property, language) : ''
  const purposeCaption = requiresCommercialPurpose ? lifeScenePurpose(input.property.purpose)?.caption || '' : ''
  const displayedPurpose = !requiresCommercialPurpose && input.language === 'pt-BR'
    ? purposePresentation(input.property.purpose)
    : ''
  const signature = JSON.stringify({ property: input.property, generation: config, ctaTitle, phone, images: input.imagePaths, presenterReference: input.presenterReference })
  const narrationBlocks = lifeScene ? LIFE_SCENE_NARRATION_TIMELINE : TEXT_TIMELINE
  const customSpeechTimeline = config.presenterSpeechMode === 'custom'
    ? splitLiteralSpeechIntoTimeline(config.presenterCustomSpeech || '', narrationBlocks.length)
    : []
  const narrationTimeline = narrationBlocks.map(block => {
    const phrase = config.presenterSpeechMode === 'custom'
      ? { id: 'PRESENTER_CUSTOM_SPEECH', texto: customSpeechTimeline[block.bloco - 1] || '' }
      : config.narration === 'enabled'
      ? (lifeScene
          ? lifeInPropertyNarration(block.bloco, input.property, input.language, input.selectedCta)
          : input.presenterReference
            ? brokerGeneratedNarration(block.bloco, input.property, language, input.selectedCta)
          : selectPhrase({ tipo: block.tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:timeline:${block.bloco}` }))
      : { id: '', texto: '' }
    const texto = !requiresCommercialPurpose && block.bloco === 1
      ? narrationWithPurpose(phrase.texto, displayedPurpose)
      : phrase.texto
    return { ...block, texto, frase_id: phrase.id }
  })
  const captionBlocks = requiresCommercialPurpose ? LIFE_SCENE_CAPTION_TIMELINE : TEXT_TIMELINE.slice(0, 4)
  const customCaptionTimeline = config.presenterSpeechMode === 'custom'
    ? splitLiteralSpeechIntoTimeline(config.presenterCustomSpeech || '', captionBlocks.length)
    : []
  const captionTimeline = captionBlocks.map(block => ({
    bloco: block.bloco,
    inicioSegundos: block.inicioSegundos,
    fimSegundos: block.fimSegundos,
    texto: config.presenterSpeechMode === 'custom'
      ? (config.captions === 'enabled' ? customCaptionTimeline[block.bloco - 1] || '' : '')
      : requiresCommercialPurpose
      ? (config.captions === 'enabled' ? lifeSceneCommercialCaption(block.bloco, input.property, input.language) : '')
      : (block.bloco === 1 && displayedPurpose
          ? (config.captions === 'enabled' ? commercialCaption(block.bloco, input.property, true, input.language) : displayedPurpose)
          : (config.captions === 'enabled' ? commercialCaption(block.bloco, input.property, true, input.language) : '')),
  }))
  const ctaTimeline = {
    bloco: requiresCommercialPurpose ? 6 : 5,
    inicioSegundos: 8,
    fimSegundos: 10,
    texto: ctaTitle ? [config.presenterSpeechMode === 'custom' ? ctaTitle : presentCta(ctaTitle, input.language), phone].filter(Boolean).join('\n') : '',
    titulo: ctaTitle,
    telefone: phone,
  }
  const types = sceneTypes(input.imagePaths.length)
  const scenes = input.imagePaths.map((image, index) => {
    const sceneNumber = index + 1
    const tipo = types[index]
    const isLast = tipo === 'encerramento'
    const phrase = config.presenterSpeechMode === 'custom'
      ? { id: 'PRESENTER_CUSTOM_SPEECH', texto: customSpeechTimeline[Math.min(index, customSpeechTimeline.length - 1)] || '' }
      : lifeScene
      ? { id: '', texto: '' }
      : config.narration === 'enabled'
      ? (tipo === 'abertura' && purposeOpening
          ? { id: 'BROKER_COMMERCIAL_OPENING', texto: purposeOpening }
          : selectPhrase({ tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:${sceneNumber}` }))
      : { id: '', texto: '' }
    const narration = config.presenterSpeechMode === 'custom'
      ? phrase.texto
      : !requiresCommercialPurpose && sceneNumber === 1
      ? narrationWithPurpose(phrase.texto, displayedPurpose)
      : phrase.texto
    const legenda = isLast
      ? (ctaTitle ? [config.presenterSpeechMode === 'custom' ? ctaTitle : presentCta(ctaTitle, input.language), phone].filter(Boolean).join('\n') : '')
      : (requiresCommercialPurpose
          ? (config.captions === 'enabled'
              ? (sceneNumber === 1 && purposeCaption ? (input.language === 'en-US' ? presentPurpose(purpose(input.property.purpose), input.language) : purposeCaption) : commercialCaption(sceneNumber, input.property, false, input.language))
              : '')
          : (sceneNumber === 1 && displayedPurpose
              ? (config.captions === 'enabled' ? commercialCaption(sceneNumber, input.property, true, input.language) : displayedPurpose)
              : (config.captions === 'enabled' ? commercialCaption(sceneNumber, input.property, true, input.language) : '')))
    return {
      numero: sceneNumber,
      tipo,
      frase_id: phrase.id,
      imagem: image,
      movimento: MOVEMENTS[index % MOVEMENTS.length],
      legenda,
      narracao: narration,
      duracaoNarracaoSegundos: config.presenterSpeechMode === 'custom' ? 0 : lifeScene ? 0 : config.narration === 'enabled' ? (isLast ? 1.2 : 1.8) : 0,
      tempoTelefoneVisivelAposNarracaoSegundos: isLast && Boolean(phone) ? 0.8 : 0,
    } as SmartTourStructuredBriefing['cenas'][number]
  })
  const presenterType = input.presenterReference ? 'referencia_do_usuario' : presenter(config)
  const hasPresenter = presenterType !== 'nenhum'
  const lifeSceneLabel = lifeScene ? LIFE_SCENE_LABELS[lifeScene] : ''
  const presentedLifeSceneLabel = lifeScene ? presentLifeProfile(lifeScene, input.language) : ''
  const hasLifeScene = Boolean(lifeScene)
  const brokerGeneratedEnUs = Boolean(input.presenterReference) && config.presenterSpeechMode === 'generated' && language === 'en-US'
  const presenterLabel = presenterType === 'corretor' ? 'um corretor' : 'uma corretora'
  const presenterReferenceLabel = presenterType === 'corretor' ? 'O corretor' : 'A corretora'
  const presenterRules = hasPresenter && !input.presenterReference ? [
    { codigo: 'apresentador_obrigatorio', valor: `Criar e exibir obrigatoriamente exatamente uma pessoa: ${presenterLabel}. Essa pessoa deve aparecer naturalmente durante a apresentação.` },
    { codigo: 'apresentador_excecao_unica', valor: `${presenterReferenceLabel} é a única exceção autorizada à regra de não inventar pessoas. Não criar, exibir ou sugerir nenhuma pessoa adicional.` },
    { codigo: 'apresentador_preserva_imovel', valor: `A presença e os movimentos naturais de ${presenterLabel} não podem alterar, reconstruir, ocultar ou substituir qualquer parte do imóvel. O imóvel deve ser preservado integralmente.` },
  ] : []
  const presenterReferenceRules = input.presenterReference ? [
    { codigo: 'referencia_identidade_fonte_unica', valor: "IMAGE 1 — PRESENTER IDENTITY. The uploaded presenter reference photo is the single source of truth for the presenter's identity." },
    { codigo: 'referencia_identidade_nao_estilo', valor: 'Treat the uploaded presenter photo as an identity reference, never as a style reference. Do not use it as a scene or property photograph.' },
    { codigo: 'referencia_imovel_hierarquia', valor: `IMAGES 2 TO ${input.imagePaths.length + 1} — PROPERTY. These are the property photographs in the exact order defined in sequenciaDasImagens.` },
    { codigo: 'referencias_visuais_imutaveis', valor: 'The presenter identity and the property photographs are the two immutable visual references of this video.' },
    { codigo: 'referencia_identidade_preservacao', valor: 'Preservar com a maior fidelidade possível o formato do rosto, olhos, nariz, boca, sorriso, cabelo e demais características reconhecíveis da pessoa.' },
    { codigo: 'referencia_identidade_reconhecivel', valor: 'The presenter must remain immediately recognizable as the same individual throughout the entire video.' },
    { codigo: 'referencia_identidade_prioridade', valor: "Identity preservation always takes precedence over aesthetic enhancement. If a conflict exists, preserve the presenter's identity instead of generating a different-looking individual." },
    { codigo: 'referencia_identidade_nao_copiar', valor: 'Não copiar fundo, roupa ou pose da fotografia de referência.' },
    { codigo: 'referencia_identidade_traje', valor: 'Vestir o apresentador com traje formal padrão do mercado imobiliário.' },
    { codigo: 'referencia_identidade_cenas', valor: 'Inserir naturalmente o apresentador nas cenas, sempre mantendo o imóvel como protagonista e preservando integralmente sua arquitetura e seus acabamentos.' },
    { codigo: 'referencia_identidade_limite', valor: 'A IA utilizará a fotografia como referência de identidade. Pequenas diferenças naturais podem ocorrer durante a geração. Não prometer fidelidade absoluta.' },
  ] : []
  const lifeSceneRules = hasLifeScene ? [
    { codigo: 'vida_no_imovel_perfil_obrigatorio', valor: `Incluir naturalmente ${presentedLifeSceneLabel} durante o vídeo, sem incluir pessoas ou animais de outro perfil.` },
    { codigo: 'vida_no_imovel_imovel_protagonista', valor: 'Utilizar as pessoas e, quando aplicável, o animal escolhido apenas para valorizar os ambientes. O imóvel deve permanecer como protagonista em todas as cenas.' },
    { codigo: 'vida_no_imovel_preservacao_total', valor: 'A inclusão do perfil escolhido não autoriza modificar a arquitetura original, acabamentos, materiais, móveis existentes, decoração, objetos, cores, iluminação arquitetônica, geometria, proporções, perspectiva ou enquadramento. Não reconstruir ambientes.' },
    { codigo: 'vida_no_imovel_ordem_das_imagens', valor: 'Manter todas as regras existentes desta apresentação e respeitar integralmente a ordem original das imagens.' },
    ...(config.narration === 'enabled' ? [{
      codigo: 'vida_no_imovel_narracao_natural',
      valor: input.language === 'en-US'
        ? 'Speak the literal timeline.narracao text as one concise, natural American English real-estate presentation. Use a calm pace, professional delivery and brief natural pauses between blocks, respecting punctuation and the supplied timing. Do not read words or blocks as isolated labels. Do not use robotic, GPS-like or exaggerated advertising delivery. Do not speed up, artificially extend or change any word.'
        : 'Narre o texto literal de timeline.narracao como uma única apresentação humana, natural e conversacional em Português do Brasil. Use ritmo calmo, entonação profissional imobiliária e pequenas pausas naturais entre os blocos, respeitando a pontuação e os tempos informados. Não leia palavras ou blocos como rótulos isolados. Não use dicção mecânica, tom de robô, GPS ou publicidade exagerada. Não acelere, não prolongue artificialmente e não altere nenhuma palavra.',
    }] : []),
  ] : []
  return {
    versao: 'smart-tour-structured-briefing-v1',
    tarefa: SMART_TOUR_GEMINI_MISSION,
    configuracoes: {
      modo: config.mode,
      idioma: language,
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
    apresentador: { tipo: presenterType, unicoHumanoAutorizado: hasPresenter },
    ...(input.presenterReference ? { referenciaApresentador: { ...input.presenterReference, posicaoNaEntrada: 1 as const, usoExclusivo: 'referencia_de_identidade' as const } } : {}),
    ...(lifeScene ? { vidaNoImovel: { life_scene: lifeScene, descricao: presentLifeProfile(lifeScene, input.language) } } : {}),
    ...(hasLifeScene || Boolean(input.presenterReference) ? { apresentacao: {
      finalidade: presentPurpose(finalidade, input.language),
      tipo: presentPropertyType(tipoImovel, input.language),
      estadoDoImovel: presentStage(input.property.stage, input.language),
      metricas: { dormitorios: presentMetricLabel('bedrooms', input.language), suites: presentMetricLabel('suites', input.language), vagas: presentMetricLabel('parkingSpaces', input.language), area: presentMetricLabel('area', input.language) },
      diferenciais: presentHighlights(input.property.highlights, input.language),
      cta: presentCta(ctaTitle, input.language),
      ...(lifeScene ? { perfilVida: presentLifeProfile(lifeScene, input.language) } : {}),
    } } : {}),
    musica: { configurada: false, instrucao: 'preservar_comportamento_atual' },
    sequenciaDasImagens: [...input.imagePaths],
    movimentosDesejados: [...MOVEMENTS],
    cenas: scenes,
    timeline: {
      duracaoTotalSegundos: 10,
      legendas: captionTimeline,
      narracao: narrationTimeline.map(({ tipo: _tipo, ...block }) => block),
      cta: ctaTimeline,
    },
    legendas: {
      ativas: config.captions === 'enabled' || Boolean(ctaTitle) || Boolean(displayedPurpose),
    },
    cta: { titulo: ctaTitle, telefone: phone },
    regrasPreservacao: {
      cenarioProtegido: true,
      umaImagemPorCena: true,
      respeitarOrdemDasImagens: true,
      elementosImutaveis: ['arquitetura', 'paredes', 'pisos', 'tetos', 'portas', 'janelas', 'móveis existentes', 'decoração', 'objetos', 'acabamentos', 'cores', 'proporções', 'perspectiva', 'enquadramento'],
      transformacoesPermitidas: [
        'movimento linear de baixa amplitude', 'pan suave', 'push-in mínimo', 'pull-back mínimo',
        'variações naturais sutis de luminosidade',
        ...(hasPresenter ? [input.presenterReference ? 'movimentos naturais e discretos do único apresentador autorizado' : `movimentos naturais e discretos da única ${presenterType} autorizada`] : []),
        ...(hasLifeScene ? [`presença e movimentos naturais somente de ${lifeSceneLabel}, subordinados à preservação integral do imóvel`] : []),
      ],
    },
    regrasObrigatorias: [
      { codigo: 'usar_json_como_fonte_unica', valor: 'Utilizar exclusivamente as informações existentes neste JSON. Não inventar. Não completar. Não alterar. Não corrigir. Não substituir. Todas as informações utilizadas na geração deverão ser obtidas exclusivamente deste JSON.' },
      { codigo: 'sem_invencao', valor: input.presenterReference ? 'não inventar dados, contatos, ambientes, pessoas adicionais ou elementos; a única pessoa autorizada e obrigatória é o apresentador cuja identidade vem da fotografia de referência' : hasPresenter ? `não inventar dados, contatos, ambientes, pessoas adicionais ou elementos; a única pessoa autorizada e obrigatória é a ${presenterType} definida em apresentador.tipo` : hasLifeScene ? `não inventar dados, contatos, ambientes, pessoas, animais ou elementos além do perfil ${lifeSceneLabel} definido em vidaNoImovel` : 'não inventar dados, contatos, ambientes, pessoas ou elementos' },
      ...presenterRules,
      ...presenterReferenceRules,
      ...lifeSceneRules,
      ...((hasLifeScene || Boolean(input.presenterReference)) ? [{ codigo: 'virtual_space_composicao_vertical_segura', valor: 'Criar a apresentação em composição vertical 9:16, preenchendo visualmente toda a tela sem faixas pretas e sem deformação. Manter o imóvel e, quando aplicável, a pessoa principal dentro da área segura vertical, evitando cortes inadequados.' }] : []),
      ...(input.presenterReference && config.narration === 'enabled' && config.presenterSpeechMode !== 'custom' ? [{ codigo: 'finalidade_narracao_apresentacao_corretor', valor: brokerGeneratedEnUs
        ? 'The opening of timeline.narracao must state the supplied purpose: For Sale for sale or For Rent for rent/rental. Do not omit or infer the purpose. Speak the literal timeline.narracao in concise, natural American English, with professional delivery compatible with a 10-second video. Do not translate, expand, or alter its words.'
        : 'A abertura de timeline.narracao deve declarar obrigatoriamente a finalidade recebida: à venda para sale ou para locação para rent/rental. Não omitir nem inferir a finalidade.' }] : []),
      ...(input.presenterReference && config.captions === 'enabled' ? [{ codigo: 'finalidade_legenda_apresentacao_corretor', valor: brokerGeneratedEnUs
        ? 'The first timeline.legendas caption must be For Sale for sale or For Rent for rent/rental. Do not omit, infer, or replace it with the location, property type, or stage.'
        : 'A primeira legenda de timeline.legendas deve ser obrigatoriamente À VENDA para sale ou PARA LOCAÇÃO para rent/rental. Não omitir, inferir nem substituir pela localização, pelo tipo ou pelo estado do imóvel.' }] : []),
      { codigo: 'idioma', valor: language },
      { codigo: 'formato_vertical', valor: '9:16' },
      { codigo: 'duracao_total_segundos', valor: 10 },
      { codigo: 'legendas_obrigatorias_quando_ativas', valor: config.captions === 'enabled' },
      { codigo: 'legendas_aplicadas_por_compositor_deterministico', valor: 'Não desenhar legendas, CTA, telefone ou qualquer outro texto no vídeo gerado pelo Gemini. Os textos e tempos de timeline.legendas e timeline.cta serão aplicados literalmente pelo compositor determinístico após a geração.' },
      { codigo: 'timeline_temporal_fonte_efetiva', valor: 'Usar exclusivamente timeline.legendas, timeline.narracao e timeline.cta como fonte efetiva dos textos e de seus tempos. As trocas de texto são independentes das trocas de imagem. Os campos textuais de cenas existem somente para compatibilidade temporária e não controlam a timeline.' },
      ...(config.presenterSpeechMode === 'custom' ? [{ codigo: 'fala_propria_literal', valor: 'Quando presenterSpeechMode for custom, narrar literalmente timeline.narracao[0].texto, sem resumir, corrigir, traduzir, complementar ou substituir palavras.' }] : []),
      { codigo: lifeScene ? 'sequencia_comercial_vida_no_imovel' : input.presenterReference ? 'sequencia_comercial_apresentacao_corretor' : 'legendas_sem_valores_comerciais_automaticos', valor: requiresCommercialPurpose
        ? brokerGeneratedEnUs
          ? 'Apply timeline.legendas literally in this order: purpose; property stage; district and city; first highlight; price when supplied or second highlight. Do not omit, reorder, complete, or invent values.'
          : 'Aplicar literalmente a sequência de timeline.legendas: finalidade; estado do imóvel; bairro e cidade; primeiro destaque; preço quando informado ou segundo destaque. Não omitir, reordenar, completar ou inventar valores.'
        : 'Nunca usar automaticamente em legendas: valor do condomínio, IPTU, preço, taxas ou código do imóvel. Condomínio somente pode aparecer como benefício selecionado, como lazer completo, piscina, academia, portaria 24 horas ou condomínio clube; nunca como valor monetário.' },
      ...(requiresCommercialPurpose && config.presenterSpeechMode !== 'custom' ? [{ codigo: lifeScene ? 'sequencia_narracao_vida_no_imovel' : 'sequencia_narracao_apresentacao_corretor', valor: brokerGeneratedEnUs
        ? 'Keep timeline.narracao concise and literal: property type, purpose, district and city in the opening; then selected property facts, stage, and one selected highlight. Include a localized CTA only when one was supplied. Use only received values.'
        : 'A abertura de timeline.narracao deve manter nesta ordem: tipo do imóvel, finalidade, bairro e cidade. Depois, manter dormitórios, suítes, vagas, estado do imóvel e convite final, usando somente os valores recebidos.' }] : []),
      ...(config.presenterSpeechMode !== 'custom' ? [{ codigo: 'narracao_complementar', valor: brokerGeneratedEnUs ? 'The narration must not repeat a caption word for word.' : 'a narração não pode repetir exatamente a legenda' }] : []),
      { codigo: 'cta_deterministico', valor: 'reservar a última cena para a legenda formada somente por cta.titulo e cta.telefone, sem alterar caracteres' },
      { codigo: 'ultima_narracao_curta', valor: 'limitar a narração final a 1,2 segundo e manter somente o telefone visível por aproximadamente 0,8 segundo após a fala' },
    ],
  }
}

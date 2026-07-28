import type { LifeScene, PresenterReference, PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
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

const LIFE_SCENE_PROPERTY_OPENINGS: Record<string, string> = {
  apartamento: 'este excelente apartamento',
  casa: 'esta excelente casa',
  cobertura: 'esta excelente cobertura',
  'studio / loft': 'este excelente studio',
  'terreno / lote': 'este excelente terreno',
  comercial: 'este excelente imóvel comercial',
}

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
  const facts = unique([
    labelQuantity(property.bedrooms, 'dormitório', 'dormitórios'),
    labelQuantity(property.suites, 'suíte', 'suítes'),
    labelQuantity(property.parkingSpaces, 'vaga de garagem', 'vagas de garagem'),
  ])
  if (!facts.length) return ''
  const list = facts.length === 1 ? facts[0] : `${facts.slice(0, -1).join(', ')} e ${facts.at(-1)}`
  return `O imóvel possui ${list}.`
}

const lifeSceneStageNarration = (property: PropertyContext) => {
  const stage = literal(property.stage)
  if (!stage) return ''
  return `O imóvel está ${stage.charAt(0).toLocaleLowerCase('pt-BR')}${stage.slice(1)}.`
}

const lifeSceneNarration = (blockNumber: number, property: PropertyContext, language: SupportedLanguage) => {
  if (blockNumber === 1) return { id: 'LIFE_COMMERCIAL_OPENING', texto: lifeSceneOpeningNarration(property, language) }
  if (blockNumber === 2) return { id: 'LIFE_PROPERTY_FACTS', texto: lifeSceneFactsNarration(property) }
  if (blockNumber === 3) return { id: 'LIFE_PROPERTY_STAGE', texto: lifeSceneStageNarration(property) }
  if (blockNumber === 5) return { id: 'LIFE_FINAL_INVITATION', texto: language === 'pt-BR' ? 'Agende sua visita.' : '' }
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

const commercialCaption = (blockNumber: number, property: PropertyContext) => {
  if (blockNumber === 1) return unique([literal(property.district), literal(property.city)]).join(' • ')
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

const lifeSceneCommercialCaption = (blockNumber: number, property: PropertyContext) => {
  const highlights = unique((property.highlights || []).map(literal))
  if (blockNumber === 1) return lifeScenePurpose(property.purpose)?.caption || ''
  if (blockNumber === 2) return literal(property.stage)
  if (blockNumber === 3) return unique([literal(property.district), literal(property.city)]).join(', ')
  if (blockNumber === 4) return highlights[0] || ''
  if (blockNumber === 5) return literal(property.price) || highlights[1] || ''
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
  const finalidade = purpose(input.property.purpose)
  const tipoImovel = literal(input.property.type)
  const ctaTitle = literal(input.selectedCta)
  const phone = ctaTitle ? input.phone || '' : ''
  const lifeScene = config.life_scene
  const purposeOpening = lifeScene ? lifeSceneOpeningNarration(input.property, input.language) : ''
  const purposeCaption = lifeScene ? lifeScenePurpose(input.property.purpose)?.caption || '' : ''
  const signature = JSON.stringify({ property: input.property, generation: config, ctaTitle, phone, images: input.imagePaths, presenterReference: input.presenterReference })
  const narrationTimeline = TEXT_TIMELINE.map(block => {
    const phrase = config.narration === 'enabled'
      ? (lifeScene
          ? lifeSceneNarration(block.bloco, input.property, input.language)
          : selectPhrase({ tipo: block.tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:timeline:${block.bloco}` }))
      : { id: '', texto: '' }
    return { ...block, texto: phrase.texto, frase_id: phrase.id }
  })
  const captionBlocks = lifeScene ? LIFE_SCENE_CAPTION_TIMELINE : TEXT_TIMELINE.slice(0, 4)
  const captionTimeline = captionBlocks.map(block => ({
    bloco: block.bloco,
    inicioSegundos: block.inicioSegundos,
    fimSegundos: block.fimSegundos,
    texto: config.captions === 'enabled'
      ? (lifeScene ? lifeSceneCommercialCaption(block.bloco, input.property) : commercialCaption(block.bloco, input.property))
      : '',
  }))
  const ctaTimeline = {
    bloco: lifeScene ? 6 : 5,
    inicioSegundos: 8,
    fimSegundos: 10,
    texto: ctaTitle ? [ctaTitle, phone].filter(Boolean).join('\n') : '',
    titulo: ctaTitle,
    telefone: phone,
  }
  const types = sceneTypes(input.imagePaths.length)
  const scenes = input.imagePaths.map((image, index) => {
    const sceneNumber = index + 1
    const tipo = types[index]
    const isLast = tipo === 'encerramento'
    const phrase = config.narration === 'enabled'
      ? (tipo === 'abertura' && purposeOpening
          ? { id: 'LIFE_PURPOSE_OPENING', texto: purposeOpening }
          : selectPhrase({ tipo, finalidade, tipoImovel, idioma: input.language, signature: `${signature}:${sceneNumber}` }))
      : { id: '', texto: '' }
    const legenda = isLast
      ? (ctaTitle ? [ctaTitle, phone].filter(Boolean).join('\n') : '')
      : (config.captions === 'enabled'
          ? (sceneNumber === 1 && purposeCaption ? purposeCaption : commercialCaption(sceneNumber, input.property))
          : '')
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
  const presenterType = input.presenterReference ? 'referencia_do_usuario' : presenter(config)
  const hasPresenter = presenterType !== 'nenhum'
  const lifeSceneLabel = lifeScene ? LIFE_SCENE_LABELS[lifeScene] : ''
  const hasLifeScene = Boolean(lifeScene)
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
    { codigo: 'vida_no_imovel_perfil_obrigatorio', valor: `Incluir naturalmente ${lifeSceneLabel} durante o vídeo, sem incluir pessoas ou animais de outro perfil.` },
    { codigo: 'vida_no_imovel_imovel_protagonista', valor: 'Utilizar as pessoas e, quando aplicável, o animal escolhido apenas para valorizar os ambientes. O imóvel deve permanecer como protagonista em todas as cenas.' },
    { codigo: 'vida_no_imovel_preservacao_total', valor: 'A inclusão do perfil escolhido não autoriza modificar a arquitetura original, acabamentos, materiais, móveis existentes, decoração, objetos, cores, iluminação arquitetônica, geometria, proporções, perspectiva ou enquadramento. Não reconstruir ambientes.' },
    { codigo: 'vida_no_imovel_ordem_das_imagens', valor: 'Manter todas as regras existentes desta apresentação e respeitar integralmente a ordem original das imagens.' },
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
    ...(lifeScene ? { vidaNoImovel: { life_scene: lifeScene, descricao: lifeSceneLabel } } : {}),
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
      ativas: config.captions === 'enabled' || Boolean(ctaTitle),
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
      { codigo: 'idioma', valor: input.language },
      { codigo: 'formato_vertical', valor: '9:16' },
      { codigo: 'duracao_total_segundos', valor: 10 },
      { codigo: 'legendas_obrigatorias_quando_ativas', valor: config.captions === 'enabled' },
      { codigo: 'legendas_aplicadas_por_compositor_deterministico', valor: 'Não desenhar legendas, CTA, telefone ou qualquer outro texto no vídeo gerado pelo Gemini. Os textos e tempos de timeline.legendas e timeline.cta serão aplicados literalmente pelo compositor determinístico após a geração.' },
      { codigo: 'timeline_temporal_fonte_efetiva', valor: 'Usar exclusivamente timeline.legendas, timeline.narracao e timeline.cta como fonte efetiva dos textos e de seus tempos. As trocas de texto são independentes das trocas de imagem. Os campos textuais de cenas existem somente para compatibilidade temporária e não controlam a timeline.' },
      { codigo: lifeScene ? 'sequencia_comercial_vida_no_imovel' : 'legendas_sem_valores_comerciais_automaticos', valor: lifeScene
        ? 'Aplicar literalmente a sequência de timeline.legendas: finalidade; estado do imóvel; bairro e cidade; primeiro destaque; preço quando informado ou segundo destaque. Não omitir, reordenar, completar ou inventar valores.'
        : 'Nunca usar automaticamente em legendas: valor do condomínio, IPTU, preço, taxas ou código do imóvel. Condomínio somente pode aparecer como benefício selecionado, como lazer completo, piscina, academia, portaria 24 horas ou condomínio clube; nunca como valor monetário.' },
      ...(lifeScene ? [{ codigo: 'sequencia_narracao_vida_no_imovel', valor: 'A abertura de timeline.narracao deve manter nesta ordem: tipo do imóvel, finalidade, bairro e cidade. Depois, manter dormitórios, suítes, vagas, estado do imóvel e convite final, usando somente os valores recebidos.' }] : []),
      { codigo: 'narracao_complementar', valor: 'a narração não pode repetir exatamente a legenda' },
      { codigo: 'cta_deterministico', valor: 'reservar a última cena para a legenda formada somente por cta.titulo e cta.telefone, sem alterar caracteres' },
      { codigo: 'ultima_narracao_curta', valor: 'limitar a narração final a 1,2 segundo e manter somente o telefone visível por aproximadamente 0,8 segundo após a fala' },
    ],
  }
}

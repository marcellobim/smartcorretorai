import type { PropertyContext, SmartTourGenerationConfig, SupportedLanguage } from './types.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
import { normalizeGeneration } from './validation.ts'

type CaptionCandidate = { tipo: 'medidas' | 'estado' | 'destaque' | 'localizacao' | 'preco'; texto: string }
type Presenter = 'corretora' | 'corretor' | 'nenhum'

export type SmartTourStructuredBriefing = {
  versao: 'smart-tour-structured-briefing-v1'
  tarefa: 'gerar_video_smart_tour'
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
  staging: { modo: 'original'; apresentacao: 'final_only' }
  musica: { configurada: false; instrucao: 'preservar_comportamento_atual' }
  sequenciaDasImagens: string[]
  movimentosDesejados: Array<'pan_suave' | 'push_in_minimo' | 'pull_back_minimo' | 'movimento_linear_baixa_amplitude'>
  cenas: Array<{
    numero: number
    imagem: string
    movimento: 'pan_suave' | 'push_in_minimo' | 'pull_back_minimo' | 'movimento_linear_baixa_amplitude'
    legenda: string
    narracao: string
    duracaoNarracaoSegundos: 1.8 | 1.2 | 0
  }>
  narracao: { ativa: boolean; tempoAproximadoPorCenaSegundos: 1.8; cenas: Array<{ cena: number; texto: string; duracaoAproximadaSegundos: 1.8 | 1.2 }> }
  legendas: { ativas: boolean; cenas: Array<{ cena: number; texto: string }> }
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

export const SMART_TOUR_NARRATION_LIBRARY = {
  aberturaVenda: [
    'Um imóvel pensado para viver bem.',
    'Conforto e qualidade em cada ambiente.',
    'Uma oportunidade para viver melhor.',
  ],
  aberturaLocacao: [
    'Seu próximo lar pode estar aqui.',
    'Praticidade para uma nova fase.',
    'Um novo endereço para viver bem.',
  ],
  aberturaGeral: [
    'Conheça espaços feitos para você.',
    'Descubra uma nova forma de viver.',
    'Ambientes que convidam a ficar.',
  ],
  medidas: [
    'Ambientes amplos e confortáveis para todos.',
    'Espaço bem distribuído para sua rotina.',
    'Conforto presente em cada ambiente.',
  ],
  localizacao: [
    'Mobilidade e conveniência ao seu alcance.',
    'Uma localização que facilita sua rotina.',
    'Tudo o que importa por perto.',
  ],
  destaque: [
    'Detalhes que tornam a experiência especial.',
    'Qualidade percebida em cada escolha.',
    'Um ambiente pensado para bons momentos.',
  ],
  estado: [
    'Pronto para receber sua próxima história.',
    'Cuidado e qualidade em cada detalhe.',
    'Uma escolha segura para seu momento.',
  ],
  preco: [
    'Uma oportunidade alinhada aos seus planos.',
    'Valor e qualidade no mesmo endereço.',
    'Uma escolha que merece sua atenção.',
  ],
  encerramento: [
    'Conheça de perto.',
    'Descubra seu próximo endereço.',
    'Venha conhecer.',
  ],
} as const

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
const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}
const choose = (options: readonly string[], seed: string, used: Set<string>) => {
  const start = stableHash(seed) % options.length
  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(start + offset) % options.length]
    if (!used.has(option)) return option
  }
  return options[start]
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

const captionCandidates = (property: PropertyContext): CaptionCandidate[] => {
  const measures = unique([
    literal(property.area) ? `${literal(property.area)} m²` : '',
    labelQuantity(property.bedrooms, 'Dormitório', 'Dormitórios'),
    labelQuantity(property.suites, 'Suíte', 'Suítes'),
  ]).join(' • ')
  const location = unique([literal(property.district), literal(property.city)]).join(' • ')
  const highlights = (property.highlights || []).map(value => ({ tipo: 'destaque' as const, texto: literal(value) })).filter(item => item.texto)
  const candidates: CaptionCandidate[] = [
    ...(measures ? [{ tipo: 'medidas' as const, texto: measures }] : []),
    ...(literal(property.stage) ? [{ tipo: 'estado' as const, texto: literal(property.stage) }] : []),
    ...highlights.slice(0, 1),
    ...(location ? [{ tipo: 'localizacao' as const, texto: location }] : []),
    ...(literal(property.price) ? [{ tipo: 'preco' as const, texto: literal(property.price) }] : []),
    ...highlights.slice(1),
  ]
  const seen = new Set<string>()
  return candidates.filter(candidate => !seen.has(candidate.texto) && Boolean(seen.add(candidate.texto)))
}

const narrationOptions = (kind: CaptionCandidate['tipo'] | 'abertura' | 'encerramento', purposeValue: string) => {
  if (kind === 'encerramento') return SMART_TOUR_NARRATION_LIBRARY.encerramento
  if (kind === 'abertura') {
    if (purposeValue === 'Venda') return SMART_TOUR_NARRATION_LIBRARY.aberturaVenda
    if (purposeValue === 'Locação') return SMART_TOUR_NARRATION_LIBRARY.aberturaLocacao
    return SMART_TOUR_NARRATION_LIBRARY.aberturaGeral
  }
  return SMART_TOUR_NARRATION_LIBRARY[kind]
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
  const ctaTitle = literal(input.selectedCta)
  const phone = ctaTitle ? input.phone || '' : ''
  const candidates = captionCandidates(input.property)
  const selectedCaptions = config.captions === 'enabled' ? candidates.slice(0, Math.min(5, input.imagePaths.length)) : []
  const signature = JSON.stringify({ property: input.property, generation: config, ctaTitle, phone, images: input.imagePaths })
  const usedNarrations = new Set<string>()
  const scenes = input.imagePaths.map((image, index) => {
    const sceneNumber = index + 1
    const caption = selectedCaptions[index]
    const isLast = index === input.imagePaths.length - 1
    let narration = ''
    if (config.narration === 'enabled') {
      const kind = isLast ? 'encerramento' : index === 0 ? 'abertura' : caption?.tipo || 'destaque'
      narration = choose(narrationOptions(kind, finalidade), `${signature}:${sceneNumber}:${kind}`, usedNarrations)
      if (narration === caption?.texto) narration = choose(SMART_TOUR_NARRATION_LIBRARY.destaque, `${signature}:${sceneNumber}:fallback`, usedNarrations)
      usedNarrations.add(narration)
    }
    return {
      numero: sceneNumber,
      imagem: image,
      movimento: MOVEMENTS[index % MOVEMENTS.length],
      legenda: caption?.texto || '',
      narracao: narration,
      duracaoNarracaoSegundos: config.narration === 'enabled' ? (isLast ? 1.2 : 1.8) : 0,
    } as SmartTourStructuredBriefing['cenas'][number]
  })
  const presenterType = presenter(config)
  return {
    versao: 'smart-tour-structured-briefing-v1',
    tarefa: 'gerar_video_smart_tour',
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
      tipo: literal(input.property.type),
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
    staging: { modo: 'original', apresentacao: 'final_only' },
    musica: { configurada: false, instrucao: 'preservar_comportamento_atual' },
    sequenciaDasImagens: [...input.imagePaths],
    movimentosDesejados: [...MOVEMENTS],
    cenas: scenes,
    narracao: {
      ativa: config.narration === 'enabled',
      tempoAproximadoPorCenaSegundos: 1.8,
      cenas: scenes.filter(scene => scene.narracao).map(scene => ({ cena: scene.numero, texto: scene.narracao, duracaoAproximadaSegundos: scene.duracaoNarracaoSegundos as 1.8 | 1.2 })),
    },
    legendas: {
      ativas: config.captions === 'enabled',
      cenas: scenes.filter(scene => scene.legenda).map(scene => ({ cena: scene.numero, texto: scene.legenda })),
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
      { codigo: 'fonte_unica', valor: 'usar somente este JSON para informações e textos' },
      { codigo: 'texto_literal', valor: 'não reescrever, corrigir, completar ou traduzir textos' },
      { codigo: 'sem_invencao', valor: 'não inventar dados, contatos, ambientes, pessoas ou elementos' },
      { codigo: 'idioma', valor: input.language },
      { codigo: 'formato_vertical', valor: '9:16' },
      { codigo: 'duracao_total_segundos', valor: 10 },
      { codigo: 'legendas_obrigatorias_quando_ativas', valor: config.captions === 'enabled' },
      { codigo: 'narracao_complementar', valor: 'a narração não pode repetir exatamente a legenda' },
      { codigo: 'cta_deterministico', valor: 'usar somente cta.titulo e cta.telefone na última cena' },
      { codigo: 'ultima_narracao_curta', valor: 'encerrar a fala antes do fim e manter o telefone visível' },
    ],
  }
}

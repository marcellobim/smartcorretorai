import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  Image,
  MessageSquareText,
  Send,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { supabase } from '../lib/supabase'

const GOALS = [
  { id: 'sale', label: 'Venda de imóvel' },
  { id: 'rent', label: 'Locação' },
]

const PROPERTY_TYPE_OPTIONS = [
  'Apartamento',
  'Studio',
  'Casa',
  'Sobrado',
  'Cobertura',
  'Garden',
  'Kitnet',
  'Terreno/Lote',
  'Sala comercial',
  'Loja',
  'Galpão',
  'Comercial',
]

const COMMERCIAL_PROFILE_OPTIONS = [
  'Minha Casa Minha Vida',
  'Econômico',
  'Médio padrão',
  'Alto padrão',
  'Luxo',
  'Investimento',
  'Comercial',
]

const PROPERTY_STAGE_OPTIONS = [
  'Pré-lançamento',
  'Lançamento',
  'Em obras',
  'Pronto para morar',
  'Novo',
  'Usado',
  'Reformado',
]

const BEDROOM_OPTIONS = ['0', '1', '2', '3', '4', '5+', 'Não informar']
const SUITE_OPTIONS = ['0', '1', '2', '3', '4+', 'Não informar']
const PARKING_OPTIONS = ['0', '1', '2', '3+', 'Não informar']

const CTA_OPTIONS = [
  'Fale comigo',
  'Saiba mais',
  'Agende sua visita',
  'Conheça as condições',
  'Faça sua simulação',
  'Quero informações',
  'Chamar no WhatsApp',
]

const SALE_CONDITION_OPTIONS = [
  'Entrada facilitada',
  'Usa FGTS',
  'Subsídio do governo',
  'Aceita financiamento',
  'Condições especiais',
  'Parcelamento durante a obra',
  'Últimas unidades',
  'Unidades limitadas',
]

const RENT_GUARANTEE_OPTIONS = [
  { id: 'seguro_fianca', label: 'Seguro-fiança' },
  { id: 'fiador', label: 'Fiador' },
  { id: 'caucao', label: 'Caução' },
  { id: 'titulo_capitalizacao', label: 'Título de capitalização' },
  { id: 'a_combinar', label: 'A combinar' },
  { id: 'nao_informar', label: 'Não informar garantia' },
]

const getRentalGuaranteeLabel = (id) => (
  RENT_GUARANTEE_OPTIONS.find((item) => item.id === id)?.label || ''
)

// Futuro: Captação de imóveis e Recrutamento/Captação de corretores devem virar chats separados.
// Não misturar esses objetivos com o fluxo de Venda/Locação do Hero IA Next.
const FUTURE_CHAT_OBJECTIVES = ['captacao_imoveis', 'captacao_corretores']

const DIFFERENTIAL_GROUPS = [
  {
    title: 'Localização',
    options: [
      'Próximo ao metrô',
      'Próximo à CPTM/trem',
      'Próximo ao shopping',
      'Comércio próximo',
      'Parque próximo',
      'Escolas próximas',
      'Hospital próximo',
      'Universidade próxima',
      'Fácil acesso às principais vias',
      'Bairro valorizado',
      'Região em crescimento',
      'Gastronomia',
      'Mobilidade',
    ],
  },
  {
    title: 'Condomínio e lazer',
    options: [
      'Lazer completo',
      'Piscina',
      'Academia',
      'Salão de festas',
      'Espaço gourmet',
      'Churrasqueira',
      'Playground',
      'Brinquedoteca',
      'Pet place',
      'Coworking',
      'Quadra',
      'Rooftop',
      'Lounge',
      'Mini mercado',
      'Lavanderia',
      'Bicicletário',
      'Áreas verdes',
      'Spa ou sauna',
      'Espaço delivery',
    ],
  },
  {
    title: 'Características do imóvel',
    options: [
      'Varanda',
      'Varanda gourmet',
      'Planta inteligente',
      'Ambientes integrados',
      'Cozinha americana',
      'Suíte',
      'Closet',
      'Acabamento premium',
      'Iluminação natural',
      'Vista livre',
      'Vista panorâmica',
      'Mobiliado',
      'Reformado',
    ],
  },
  {
    title: 'Condições comerciais',
    options: [
      'Aceita financiamento',
      'Usa FGTS',
      'Subsídio do governo',
      'Entrada facilitada',
      'Condições especiais',
      'Documentação em ordem',
      'Últimas unidades',
      'Unidades limitadas',
      'Alto potencial de valorização',
    ],
  },
]

const RENT_DIFFERENTIAL_GROUPS = [
  DIFFERENTIAL_GROUPS[0],
  DIFFERENTIAL_GROUPS[1],
  DIFFERENTIAL_GROUPS[2],
  {
    title: 'Facilidades para locação',
    options: [
      'Mobiliado',
      'Aceita pet',
      'Pronto para entrar',
      'Condomínio seguro',
      'Boa iluminação',
      'Disponibilidade imediata',
      'Fácil visita',
      'Contrato facilitado',
    ],
  },
]

const SALE_CHAT_FLOW = [
  {
    id: 'propertyType',
    question: 'Que tipo de imóvel vamos divulgar?',
    type: 'chips',
    options: PROPERTY_TYPE_OPTIONS,
  },
  {
    id: 'profile',
    question: 'Qual é o perfil comercial desse imóvel?',
    type: 'chips',
    options: COMMERCIAL_PROFILE_OPTIONS,
  },
  {
    id: 'stage',
    question: 'Em que estágio ele está?',
    type: 'chips',
    options: PROPERTY_STAGE_OPTIONS,
  },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'E o bairro?', type: 'text', placeholder: 'Ex: Vila Mariana' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  {
    id: 'differentials',
    question: 'Quais diferenciais merecem destaque?',
    type: 'multiGrouped',
    groups: DIFFERENTIAL_GROUPS,
  },
  {
    id: 'cta',
    question: 'Qual chamada deve conduzir a campanha?',
    type: 'chips',
    options: CTA_OPTIONS,
  },
]

const RENT_CHAT_FLOW = [
  {
    id: 'propertyType',
    question: 'Que tipo de imóvel será anunciado para locação?',
    type: 'chips',
    options: PROPERTY_TYPE_OPTIONS,
  },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'E o bairro?', type: 'text', placeholder: 'Ex: Pinheiros' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  { id: 'area', question: 'Deseja informar a área?', type: 'text', placeholder: 'Ex: 72 m²', optionalLabel: 'Não informar área' },
  {
    id: 'differentials',
    question: 'Quais diferenciais devem aparecer na campanha?',
    type: 'multiGrouped',
    groups: RENT_DIFFERENTIAL_GROUPS,
  },
  {
    id: 'cta',
    question: 'Qual chamada deve conduzir a campanha?',
    type: 'chips',
    options: CTA_OPTIONS,
  },
]

const TEXT_BLOCKS = [
  ['instagram', 'Texto Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['cta', 'CTA'],
  ['portal', 'Descrição Portal'],
  ['hashtags', 'Hashtags'],
]

const PROCESSING_STEPS = [
  'Analisando briefing...',
  'Gerando visual...',
  'Finalizando entrega...',
  'Preparando sua campanha...',
]

const DESTINATIONS = [
  { id: 'instagram_feed', label: 'Feed Instagram', format_group: 'square_feed' },
  { id: 'story_reels', label: 'Story/Reels', format_group: 'vertical' },
  { id: 'whatsapp', label: 'WhatsApp', format_group: 'square_feed' },
  { id: 'facebook', label: 'Facebook', format_group: 'landscape' },
  { id: 'google_ads', label: 'Google Ads', format_group: 'landscape' },
  { id: 'landing_page', label: 'Landing Page', format_group: 'landscape' },
  { id: 'portal_imobiliario', label: 'Portal Imobiliário', format_group: 'landscape' },
]

const normalizeList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeComparable = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s/-]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const LOCATION_CORRECTIONS = {
  'sao paulo': 'São Paulo',
  'vila das merces': 'Vila das Mercês',
  moema: 'Moema',
  pirituba: 'Pirituba',
  lapa: 'Lapa',
  'vila mariana': 'Vila Mariana',
  perdizes: 'Perdizes',
  tatuape: 'Tatuapé',
  ipiranga: 'Ipiranga',
  paraiso: 'Paraíso',
}

const SMALL_LOCATION_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

const capitalizeLocation = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .split(' ')
  .map((word, index) => {
    if (index > 0 && SMALL_LOCATION_WORDS.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
  .join(' ')

const normalizeLocation = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const key = normalizeComparable(text)
  return LOCATION_CORRECTIONS[key] || capitalizeLocation(text)
}

const TERM_CORRECTIONS = {
  cowork: 'Coworking',
  coworking: 'Coworking',
  'perto do metro': 'Próximo ao metrô',
  'proximo ao metro': 'Próximo ao metrô',
  'próximo ao metrô': 'Próximo ao metrô',
  'sao paulo': 'São Paulo',
  'vila das merces': 'Vila das Mercês',
  mcmv: 'Minha Casa Minha Vida',
}

const normalizeTerm = (value) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const key = normalizeComparable(text)
  return TERM_CORRECTIONS[key] || text.replace(/\bdorms?\b/gi, 'dormitórios')
}

const normalizeValueText = (value) => {
  const text = normalizeTerm(value)
  if (!text || normalizeComparable(text) === 'nao informar') return ''
  return text
}

const normalizeAnswerValue = (questionId, value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeTerm).filter(Boolean)
  }

  if (questionId === 'city' || questionId === 'neighborhood') {
    return normalizeLocation(value)
  }

  if (['area', 'rentPrice', 'condoFee', 'iptu'].includes(questionId)) {
    return normalizeValueText(value) || 'Não informar'
  }

  return normalizeTerm(value)
}

const formatCountLabel = (value, singular, plural) => {
  const text = String(value || '').trim()
  if (!text || text === 'Não informar') return ''
  if (text === '0') return ''
  if (text.endsWith('+')) return `${text.replace('+', ' ou mais')} ${plural}`
  return `${text} ${text === '1' ? singular : plural}`
}

const formatAnswer = (answer) => {
  if (Array.isArray(answer)) return answer.join(', ')
  return String(answer || '').trim()
}

const buildValueCondition = (goal, saleValues, rentValues) => {
  if (goal === 'rent') {
    const guaranteeLabel = rentValues.guarantee && rentValues.guarantee !== 'nao_informar'
      ? getRentalGuaranteeLabel(rentValues.guarantee)
      : ''
    const details = [
      rentValues.rentMode === 'show' && normalizeValueText(rentValues.rentPrice) ? `Aluguel: ${normalizeValueText(rentValues.rentPrice)}` : '',
      rentValues.condoMode === 'show' && normalizeValueText(rentValues.condoFee) ? `Condomínio: ${normalizeValueText(rentValues.condoFee)}` : '',
      rentValues.iptuMode === 'show' && normalizeValueText(rentValues.iptu) ? `IPTU: ${normalizeValueText(rentValues.iptu)}` : '',
      guaranteeLabel ? `Garantia: ${guaranteeLabel}` : '',
    ].filter(Boolean)

    return {
      mode: details.length ? 'rental_values' : 'no_values',
      label: details.length ? 'Valores de locação informados' : 'Não mostrar valores',
      details: details.join(' | '),
      promptLines: details.length
        ? [
          `Valores e condições de locação: ${details.join(', ')}.`,
          'Use apenas esses valores e condições. Não inventar aluguel, condomínio, IPTU ou garantia não informados.',
        ]
        : ['Não mostrar valores na campanha. Não inventar aluguel, condomínio, IPTU ou garantia.'],
    }
  }

  if (saleValues.mode === 'price') {
    const conditions = normalizeList(saleValues.conditions).map(normalizeTerm)
    return {
      mode: 'price',
      label: 'Valor do imóvel informado',
      details: [
        normalizeValueText(saleValues.price) ? `Valor: ${normalizeValueText(saleValues.price)}` : '',
        conditions.length ? `Condições: ${conditions.join(', ')}` : '',
      ].filter(Boolean).join(' | '),
      promptLines: [
        `Valor informado: ${normalizeValueText(saleValues.price)}.`,
        conditions.length ? `Condições comerciais informadas: ${conditions.join(', ')}.` : '',
        'Pode mostrar o valor informado na campanha. Não inventar outras condições comerciais.',
      ],
    }
  }

  if (saleValues.mode === 'conditions') {
    const conditions = normalizeList(saleValues.conditions).map(normalizeTerm)
    return {
      mode: 'conditions',
      label: 'Apenas condições comerciais',
      details: conditions.join(', '),
      promptLines: [
        `Condições comerciais informadas: ${conditions.join(', ')}.`,
        'Não mostrar preço e não inventar valor do imóvel.',
      ],
    }
  }

  return {
    mode: 'hidden',
    label: 'Não mostrar valores',
    details: '',
    promptLines: ['Não mostrar valores na campanha. Não inventar preço ou condições comerciais.'],
  }
}

const buildHumanPrompt = (goal, answers, destinations, valueCondition) => {
  const isRent = goal === 'rent'
  const selectedDestinations = Array.isArray(destinations) ? destinations : []
  const primaryDestination = selectedDestinations[0] || null
  const futureDestinations = selectedDestinations.slice(1)
  const location = [answers.neighborhood, answers.city].filter(Boolean).join(', ')
  const featureDetails = [
    formatCountLabel(answers.bedrooms, 'dormitório', 'dormitórios'),
    formatCountLabel(answers.suites, 'suíte', 'suítes'),
    formatCountLabel(answers.parking, 'vaga', 'vagas'),
    answers.area && answers.area !== 'Não informar' ? `${answers.area} de área` : '',
  ].filter(Boolean).join(', ')
  const differentials = normalizeList(answers.differentials)
  const profile = isRent ? 'Locação' : answers.profile || 'não informado'
  const lines = [
    `Crie uma campanha imobiliária profissional, moderna e de alto impacto visual para ${primaryDestination?.label || 'o destino escolhido'}.`,
    '',
    `Objetivo: ${isRent ? 'locação de imóvel' : 'venda de imóvel'}.`,
    `Família da campanha: ${profile}.`,
    `Formato principal da peça: ${primaryDestination?.label || 'não definido'}.`,
    futureDestinations.length ? `Formatos desejados para adaptação futura: ${futureDestinations.map((item) => item.label).join(', ')}.` : '',
    '',
    `${answers.propertyType || 'Imóvel'}${!isRent && answers.profile ? ` ${answers.profile}` : ''}${!isRent && answers.stage ? ` em ${answers.stage.toLowerCase()}` : ''}${location ? ` em ${location}` : ''}.`,
    featureDetails ? `O imóvel possui ${featureDetails}.` : '',
    ...(valueCondition?.promptLines || []),
    differentials.length ? `Diferenciais reais:\n${differentials.join(', ')}.` : '',
    '',
    'Promessa principal:',
    isRent ? 'facilitar a decisão de visita e contato para locação.' : 'destacar a oportunidade real deste imóvel com clareza e força comercial.',
    '',
    'Direção visual:',
    'usar estética adequada ao perfil comercial informado, com leitura rápida, dados reais e composição de campanha imobiliária profissional.',
    '',
    `CTA: ${answers.cta || 'Fale comigo'}.`,
    'Use exatamente este CTA. Não substitua por outro.',
    '',
    `Crie UMA única peça publicitária final para ${primaryDestination?.label || 'o destino escolhido'}.`,
    'Não criar mosaico.',
    'Não criar múltiplos formatos dentro da mesma imagem.',
    'Não repetir a mesma arte em formatos diferentes dentro da imagem.',
    'A saída deve ser uma única arte final pronta para publicação.',
    'Use headline forte, CTA destacado e dados reais informados na conversa.',
    'Não invente imóvel, fachada, planta, lazer, metrô, preço, telefone, e-mail, vista, condições comerciais ou dados não fornecidos.',
    'Evite texto pequeno, torto, ilegível, cortado ou com aparência de arte automática antiga.',
  ]

  return lines.filter(Boolean).join('\n')
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Não foi possível ler uma das imagens.'))
  reader.readAsDataURL(file)
})

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms)
})

function TextBlock({ title, content }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-black text-gray-950">{title}</p>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-gray-600">
        {content || 'Texto não retornado.'}
      </p>
    </div>
  )
}

function AssistantBubble({ children }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-950 text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-2xl rounded-3xl rounded-tl-md bg-white px-5 py-4 shadow-sm ring-1 ring-gray-200">
        <p className="text-sm font-bold leading-relaxed text-gray-800">{children}</p>
      </div>
    </div>
  )
}

function UserBubble({ children }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl rounded-3xl rounded-tr-md bg-gray-950 px-5 py-4 text-white shadow-sm">
        <p className="text-sm font-bold leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

export default function HeroNext() {
  const [phase, setPhase] = useState('intro')
  const [goal, setGoal] = useState('')
  const [answers, setAnswers] = useState({})
  const [chatIndex, setChatIndex] = useState(0)
  const [textDraft, setTextDraft] = useState('')
  const [multiDraft, setMultiDraft] = useState([])
  const [customDifferential, setCustomDifferential] = useState('')
  const [saleValueMode, setSaleValueMode] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleConditions, setSaleConditions] = useState([])
  const [rentMode, setRentMode] = useState('')
  const [rentPrice, setRentPrice] = useState('')
  const [condoMode, setCondoMode] = useState('')
  const [condoFee, setCondoFee] = useState('')
  const [iptuMode, setIptuMode] = useState('')
  const [iptuValue, setIptuValue] = useState('')
  const [rentGuarantee, setRentGuarantee] = useState('')
  const [promptTouched, setPromptTouched] = useState(false)
  const [humanPrompt, setHumanPrompt] = useState('')
  const [destinationIds, setDestinationIds] = useState([])
  const [imageChoice, setImageChoice] = useState('')
  const [uploadedImages, setUploadedImages] = useState([])
  const [generationLoading, setGenerationLoading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationResult, setGenerationResult] = useState(null)
  const [processingMessage, setProcessingMessage] = useState(PROCESSING_STEPS[0])

  const chatFlow = goal === 'rent' ? RENT_CHAT_FLOW : SALE_CHAT_FLOW
  const currentQuestion = chatFlow[chatIndex]
  const selectedDestinations = destinationIds
    .map((id) => DESTINATIONS.find((item) => item.id === id))
    .filter(Boolean)
  const selectedDestination = selectedDestinations[0] || null
  const compatibleDestinations = selectedDestinations.slice(1)
  const valueCondition = useMemo(() => buildValueCondition(goal, {
    mode: saleValueMode,
    price: salePrice,
    conditions: saleConditions,
  }, {
    rentMode,
    rentPrice,
    condoMode,
    condoFee,
    iptuMode,
    iptu: iptuValue,
    guarantee: rentGuarantee,
  }), [goal, saleValueMode, salePrice, saleConditions, rentMode, rentPrice, condoMode, condoFee, iptuMode, iptuValue, rentGuarantee])
  const saleValueReady = goal !== 'sale'
    || saleValueMode === 'hidden'
    || (saleValueMode === 'price' && Boolean(normalizeValueText(salePrice)))
    || (saleValueMode === 'conditions' && saleConditions.length > 0)
  const rentValueReady = goal !== 'rent' || (
    ['show', 'hide'].includes(rentMode)
    && ['show', 'hide', 'na'].includes(condoMode)
    && ['show', 'hide', 'na'].includes(iptuMode)
    && Boolean(rentGuarantee)
    && (rentMode !== 'show' || Boolean(normalizeValueText(rentPrice)))
    && (condoMode !== 'show' || Boolean(normalizeValueText(condoFee)))
    && (iptuMode !== 'show' || Boolean(normalizeValueText(iptuValue)))
  )
  const suggestedPrompt = useMemo(() => buildHumanPrompt(goal, answers, selectedDestinations, valueCondition), [goal, answers, selectedDestinations, valueCondition])
  const effectivePrompt = promptTouched ? humanPrompt : suggestedPrompt
  const canGenerate = Boolean(
    effectivePrompt.trim()
    && selectedDestination
    && imageChoice
    && (!imageChoice.startsWith('yes') || uploadedImages.length > 0)
    && !generationLoading,
  )

  const resetForGoal = (nextGoal) => {
    setGoal(nextGoal)
    setAnswers({})
    setChatIndex(0)
    setTextDraft('')
    setMultiDraft([])
    setCustomDifferential('')
    setSaleValueMode('')
    setSalePrice('')
    setSaleConditions([])
    setRentMode('')
    setRentPrice('')
    setCondoMode('')
    setCondoFee('')
    setIptuMode('')
    setIptuValue('')
    setRentGuarantee('')
    setPromptTouched(false)
    setHumanPrompt('')
    setDestinationIds([])
    setImageChoice('')
    setUploadedImages([])
    setGenerationResult(null)
    setGenerationError('')
    setPhase('chat')
  }

  const commitAnswer = (questionId, value) => {
    const normalizedValue = normalizeAnswerValue(questionId, value)
    if (!normalizedValue || (Array.isArray(normalizedValue) && normalizedValue.length === 0)) return

    const updatedAnswers = { ...answers, [questionId]: normalizedValue }
    const nextMissingIndex = chatFlow.findIndex((question, index) => (
      index > chatIndex && !updatedAnswers[question.id]
    ))

    setAnswers(updatedAnswers)
    setTextDraft('')
    setMultiDraft([])
    setCustomDifferential('')
    setGenerationResult(null)
    setGenerationError('')
    setPromptTouched(false)
    setHumanPrompt('')

    if (nextMissingIndex === -1) {
      setPhase('values')
    } else {
      setChatIndex(nextMissingIndex)
    }
  }

  const goToQuestion = (index) => {
    const safeIndex = Math.max(0, Math.min(index, chatFlow.length - 1))
    const question = chatFlow[safeIndex]
    const currentValue = answers[question.id]

    setChatIndex(safeIndex)
    setPhase('chat')
    setTextDraft(typeof currentValue === 'string' ? currentValue : '')
    setMultiDraft(Array.isArray(currentValue) ? currentValue : [])
    setCustomDifferential('')
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationResult(null)
    setGenerationError('')
  }

  const goBackInChat = () => {
    if (chatIndex > 0) {
      goToQuestion(chatIndex - 1)
      return
    }
    setPhase('goal')
  }

  const toggleDestination = (id) => {
    setDestinationIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ))
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const toggleSaleCondition = (condition) => {
    setSaleConditions((current) => (
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition]
    ))
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
  }

  const goToDestinationStep = () => {
    if (goal === 'sale' && !saleValueReady) return
    if (goal === 'rent' && !rentValueReady) return
    setPromptTouched(false)
    setHumanPrompt('')
    setGenerationError('')
    setPhase('destination')
  }

  const handlePromptChange = (value) => {
    setPromptTouched(true)
    setHumanPrompt(value)
    setGenerationResult(null)
    setGenerationError('')
  }

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/')).slice(0, 8)
    if (imageFiles.length === 0) return

    try {
      const parsed = await Promise.all(imageFiles.map(async (file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        contentType: file.type || 'image/jpeg',
        data: await fileToDataUrl(file),
      })))
      setUploadedImages(parsed)
      setGenerationError('')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Não foi possível carregar as imagens.')
    }
  }

  const pollGeneration = async (generationId) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      setProcessingMessage(PROCESSING_STEPS[attempt % PROCESSING_STEPS.length])
      await wait(4000)

      const { data, error } = await supabase.functions.invoke('gerar-hero-ia', {
        body: {
          action: 'status',
          generation_id: generationId,
        },
      })

      if (error) throw new Error(error.message || 'Não foi possível consultar a campanha.')
      if (!data?.success && data?.status !== 'failed') throw new Error(data?.message || data?.error || 'Não foi possível consultar a campanha.')

      if (data.status === 'completed') {
        setGenerationResult({
          ...data,
          imageUrl: data.image_url || '',
          texts: data.texts || {},
        })
        setPhase('result')
        return
      }

      if (data.status === 'failed' || data.success === false) {
        throw new Error(data.message || data.error || 'Não foi possível concluir a campanha.')
      }
    }

    throw new Error('A campanha ainda está em criação. Tente consultar novamente em alguns instantes.')
  }

  const handleGenerate = async () => {
    if (!canGenerate) return

    setGenerationLoading(true)
    setGenerationError('')
    setGenerationResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('gerar-hero-ia', {
        body: {
          human_prompt: effectivePrompt.trim(),
          image_mode: uploadedImages.length > 0 ? 'reference_photos' : 'new_image',
          image_mode_label: uploadedImages.length > 0 ? 'Imagens reais anexadas' : 'Campanha sem imagens anexadas',
          inline_images: uploadedImages.map((item) => ({
            name: item.name,
            content_type: item.contentType,
            data: item.data,
          })),
          hero_next_experimental: true,
          campaign_objective: goal === 'rent' ? 'locacao' : 'venda',
          property_type: answers.propertyType || '',
          property_profile: answers.profile || (goal === 'rent' ? 'Locação' : ''),
          property_stage: answers.stage || '',
          city: answers.city || '',
          district: answers.neighborhood || '',
          bedrooms: answers.bedrooms || '',
          suites: answers.suites || '',
          parking: answers.parking || '',
          area: answers.area || '',
          rent_price: rentMode === 'show' ? normalizeValueText(rentPrice) : '',
          condo_fee: condoMode === 'show' ? normalizeValueText(condoFee) : '',
          iptu: iptuMode === 'show' ? normalizeValueText(iptuValue) : '',
          guarantee_id: rentGuarantee,
          guarantee: rentGuarantee !== 'nao_informar' ? rentGuarantee : '',
          guarantee_label: rentGuarantee !== 'nao_informar' ? getRentalGuaranteeLabel(rentGuarantee) : '',
          highlights: normalizeList(answers.differentials),
          cta: answers.cta || 'Fale com o corretor',
          deliverables: {
            hero_image: true,
            instagram_text: true,
            hashtags: true,
            cta: true,
            whatsapp: true,
            portal_description: true,
          },
          value_condition: valueCondition,
          primary_destination: selectedDestination,
          compatible_destinations: compatibleDestinations,
          additional_info: '',
        },
      })

      if (error) throw new Error(error.message || 'Não foi possível gerar a campanha.')
      if (!data?.success) throw new Error(data?.message || data?.error || 'Não foi possível gerar a campanha.')

      if (data.status === 'processing') {
        setProcessingMessage('Criando sua campanha...')
        setGenerationResult({
          ...data,
          texts: data.texts || {},
        })
        setPhase('processing')
        setGenerationLoading(false)
        await pollGeneration(data.generation_id || data.hero_generation_id)
        return
      }

      setGenerationResult({
        ...data,
        imageUrl: data.image_url || '',
        texts: data.texts || {},
      })
      setPhase('result')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Não foi possível gerar a campanha.')
    } finally {
      setGenerationLoading(false)
    }
  }

  const downloadTexts = () => {
    const texts = generationResult?.texts || {}
    const content = TEXT_BLOCKS
      .map(([key, title]) => `${title}\n${texts[key] || 'Texto não retornado.'}`)
      .join('\n\n---\n\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'campanha-ia-textos.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderQuestionControls = () => {
    if (!currentQuestion) return null

    if (currentQuestion.type === 'text') {
      return (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitAnswer(currentQuestion.id, textDraft)
            }}
            placeholder={currentQuestion.placeholder}
            className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
          <Button type="button" onClick={() => commitAnswer(currentQuestion.id, textDraft)} disabled={!textDraft.trim()}>
            <Send className="h-4 w-4" />
            Enviar
          </Button>
          {currentQuestion.optionalLabel && (
            <Button type="button" variant="secondary" onClick={() => commitAnswer(currentQuestion.id, 'Não informar')}>
              {currentQuestion.optionalLabel}
            </Button>
          )}
        </div>
      )
    }

    if (currentQuestion.type === 'multi' || currentQuestion.type === 'multiGrouped') {
      const groups = currentQuestion.groups || [{ title: '', options: currentQuestion.options || [] }]
      const selectedWithCustom = [
        ...multiDraft,
        ...(customDifferential.trim() ? [normalizeTerm(customDifferential).slice(0, 60)] : []),
      ].filter(Boolean)
      return (
        <div className="mt-4 space-y-4">
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.title || 'opcoes'}>
                {group.title && (
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-amber-700">{group.title}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const normalizedOption = normalizeTerm(option)
                    const active = multiDraft.includes(normalizedOption)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMultiDraft((current) => (
                            current.includes(normalizedOption)
                              ? current.filter((item) => item !== normalizedOption)
                              : [...current, normalizedOption]
                          ))
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {normalizedOption}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <input
            value={customDifferential}
            onChange={(event) => setCustomDifferential(event.target.value)}
            placeholder="Outro diferencial importante"
            maxLength={60}
            className="min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
          <Button type="button" onClick={() => commitAnswer(currentQuestion.id, selectedWithCustom)} disabled={selectedWithCustom.length === 0}>
            Confirmar diferenciais
          </Button>
        </div>
      )
    }

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {currentQuestion.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => commitAnswer(currentQuestion.id, option)}
            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
              answers[currentQuestion.id] === option ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-950 hover:bg-gray-950 hover:text-white'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      <Header title="Campanha IA" subtitle="Fluxo limpo para validar Chat Guiado, Prompt Humano e imagens opcionais." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à Home
        </Link>

        {phase === 'intro' && (
          <section className="mt-6 overflow-hidden rounded-[2rem] bg-gray-950 p-7 text-white shadow-xl shadow-gray-950/10 sm:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Hero IA Next
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                Vamos montar sua campanha agora
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-gray-300 sm:text-lg">
                Responda algumas perguntas e a IA criará sua campanha.
              </p>
              <Button type="button" onClick={() => setPhase('goal')} className="mt-8">
                Começar
              </Button>
            </div>
          </section>
        )}

        {phase === 'goal' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>O que deseja divulgar?</AssistantBubble>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => resetForGoal(item.id)}
                  className="rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-gray-950 hover:shadow-md"
                >
                  <Building2 className="h-7 w-7 text-amber-600" />
                  <p className="mt-4 text-xl font-black text-gray-950">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
                    A conversa será adaptada para esse objetivo.
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === 'chat' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <div className="mb-5 flex justify-between gap-3">
              <Button type="button" variant="secondary" onClick={goBackInChat}>
                Voltar
              </Button>
            </div>
            <div className="space-y-5">
              <AssistantBubble>
                Perfeito. Vou montar uma campanha de {goal === 'rent' ? 'locação' : 'venda'} com você, passo a passo.
              </AssistantBubble>
              {chatFlow.slice(0, chatIndex).map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <AssistantBubble>{question.question}</AssistantBubble>
                  <div className="flex items-start justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => goToQuestion(index)}
                      className="mt-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <UserBubble>{formatAnswer(answers[question.id])}</UserBubble>
                  </div>
                </div>
              ))}
              {currentQuestion && (
                <div>
                  <AssistantBubble>{currentQuestion.question}</AssistantBubble>
                  {renderQuestionControls()}
                </div>
              )}
            </div>
          </section>
        )}

        {phase === 'values' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>{goal === 'rent' ? 'Quais valores deseja divulgar?' : 'Deseja divulgar valor ou condições?'}</AssistantBubble>

            {goal === 'sale' && (
              <>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {[
                    { id: 'price', title: 'Mostrar valor do imóvel', description: 'O valor informado poderá aparecer na campanha.' },
                    { id: 'conditions', title: 'Mostrar apenas condições', description: 'Sem preço. Apenas condições comerciais reais.' },
                    { id: 'hidden', title: 'Não mostrar valores', description: 'A campanha não deve mostrar preço nem condições.' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSaleValueMode(item.id)
                        if (item.id === 'hidden') {
                          setSalePrice('')
                          setSaleConditions([])
                        }
                        setPromptTouched(false)
                        setHumanPrompt('')
                        setGenerationError('')
                      }}
                      className={`rounded-3xl border p-5 text-left transition ${
                        saleValueMode === item.id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      <p className="text-lg font-black">{item.title}</p>
                      <p className={`mt-2 text-sm font-semibold leading-relaxed ${saleValueMode === item.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.description}
                      </p>
                    </button>
                  ))}
                </div>

                {saleValueMode === 'price' && (
                  <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                    <label className="text-sm font-black text-gray-950" htmlFor="sale-price">
                      Valor do imóvel
                    </label>
                    <input
                      id="sale-price"
                      value={salePrice}
                      onChange={(event) => {
                        setSalePrice(event.target.value)
                        setPromptTouched(false)
                        setHumanPrompt('')
                      }}
                      placeholder="Ex: R$ 384.000, A partir de R$ 384.000 ou Sob consulta"
                      className="mt-3 min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                )}

                {(saleValueMode === 'price' || saleValueMode === 'conditions') && (
                  <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">
                      {saleValueMode === 'price' ? 'Condições adicionais, se quiser' : 'Condições comerciais reais'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SALE_CONDITION_OPTIONS.map((condition) => {
                        const active = saleConditions.includes(condition)
                        return (
                          <button
                            key={condition}
                            type="button"
                            onClick={() => toggleSaleCondition(condition)}
                            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                              active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            {condition}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {goal === 'rent' && (
              <div className="mt-5 space-y-5">
                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <p className="text-sm font-black text-gray-950">Aluguel</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ['show', 'Mostrar aluguel'],
                      ['hide', 'Não mostrar aluguel'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setRentMode(id)
                          if (id === 'hide') setRentPrice('')
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          rentMode === id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {rentMode === 'show' && (
                    <input
                      value={rentPrice}
                      onChange={(event) => {
                        setRentPrice(event.target.value)
                        setPromptTouched(false)
                        setHumanPrompt('')
                      }}
                      placeholder="Valor do aluguel. Ex: R$ 3.500"
                      className="mt-3 min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                    />
                  )}
                </div>

                {[
                  {
                    title: 'Condomínio',
                    mode: condoMode,
                    setMode: setCondoMode,
                    value: condoFee,
                    setValue: setCondoFee,
                    placeholder: 'Valor do condomínio. Ex: R$ 780',
                    options: [
                      ['show', 'Mostrar condomínio'],
                      ['hide', 'Não mostrar condomínio'],
                      ['na', 'Não se aplica'],
                    ],
                  },
                  {
                    title: 'IPTU',
                    mode: iptuMode,
                    setMode: setIptuMode,
                    value: iptuValue,
                    setValue: setIptuValue,
                    placeholder: 'Valor do IPTU. Ex: R$ 120/mês',
                    options: [
                      ['show', 'Mostrar IPTU'],
                      ['hide', 'Não mostrar IPTU'],
                      ['na', 'Não se aplica'],
                    ],
                  },
                ].map((section) => (
                  <div key={section.title} className="rounded-3xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-black text-gray-950">{section.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.options.map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            section.setMode(id)
                            if (id !== 'show') section.setValue('')
                            setPromptTouched(false)
                            setHumanPrompt('')
                          }}
                          className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                            section.mode === id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {section.mode === 'show' && (
                      <input
                        value={section.value}
                        onChange={(event) => {
                          section.setValue(event.target.value)
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        placeholder={section.placeholder}
                        className="mt-3 min-h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                      />
                    )}
                  </div>
                ))}

                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <p className="text-sm font-black text-gray-950">Garantia</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RENT_GUARANTEE_OPTIONS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setRentGuarantee(id)
                          setPromptTouched(false)
                          setHumanPrompt('')
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                          rentGuarantee === id ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-600">
              <p><strong>Regra atual:</strong> {valueCondition.label}</p>
              {valueCondition.details && <p className="mt-1">{valueCondition.details}</p>}
              {valueCondition.mode === 'hidden' || valueCondition.mode === 'no_values' ? <p className="mt-1">Não mostrar valores na campanha.</p> : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase('chat')}>
                Voltar
              </Button>
              <Button type="button" onClick={goToDestinationStep} disabled={goal === 'sale' ? !saleValueReady : !rentValueReady}>
                Continuar
              </Button>
            </div>
          </section>
        )}

        {phase === 'prompt' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <AssistantBubble>
                Com base na conversa, montei o Prompt Humano da campanha. Você pode ajustar antes de gerar.
              </AssistantBubble>
              <textarea
                value={effectivePrompt}
                onChange={(event) => handlePromptChange(event.target.value)}
                rows={18}
                className="mt-5 w-full resize-none rounded-3xl border border-gray-200 px-5 py-4 text-sm font-semibold leading-relaxed text-gray-800 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setPhase('destination')}>
                  Voltar
                </Button>
                <Button type="button" onClick={() => setPhase('images')} disabled={!effectivePrompt.trim()}>
                  Continuar
                </Button>
              </div>
            </div>
            <aside className="rounded-[2rem] border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resumo da conversa</p>
              <div className="mt-4 space-y-3 text-sm font-semibold text-gray-600">
                <p><strong>Objetivo:</strong> {goal === 'rent' ? 'Locação' : 'Venda de imóvel'}</p>
                {chatFlow.map((question, index) => answers[question.id] ? (
                  <div key={question.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <strong>{question.question}</strong><br />
                        {formatAnswer(answers[question.id])}
                      </p>
                      <button
                        type="button"
                        onClick={() => goToQuestion(index)}
                        className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ) : null)}
                {selectedDestinations.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p>
                        <strong>Formatos</strong><br />
                        Principal: {selectedDestination?.label}
                        {compatibleDestinations.length ? ` | Futuro: ${compatibleDestinations.map((item) => item.label).join(', ')}` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhase('destination')}
                        className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600 hover:bg-gray-200"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p>
                      <strong>Valores e condições</strong><br />
                      {valueCondition.label}
                      {valueCondition.details ? `: ${valueCondition.details}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPhase('values')}
                      className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600 hover:bg-gray-200"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        )}

        {phase === 'destination' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>Onde você pretende usar esta campanha?</AssistantBubble>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              Você pode escolher mais de um formato. O primeiro selecionado será o formato principal da geração; os demais ficam como formatos desejados para adaptação futura.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DESTINATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleDestination(item.id)}
                  className={`rounded-3xl border p-5 text-left transition ${
                    destinationIds.includes(item.id) ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-black">{item.label}</p>
                    {destinationIds[0] === item.id && (
                      <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gray-950">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${destinationIds.includes(item.id) ? 'text-gray-300' : 'text-gray-500'}`}>
                    {item.format_group === 'vertical' ? 'Formato vertical principal.' : item.format_group === 'landscape' ? 'Formato horizontal principal.' : 'Formato quadrado principal.'}
                  </p>
                </button>
              ))}
            </div>
            {selectedDestinations.length > 0 && (
              <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-600">
                <p><strong>Formato principal:</strong> {selectedDestination?.label}</p>
                <p className="mt-1">
                  <strong>Adaptações futuras:</strong> {compatibleDestinations.length ? compatibleDestinations.map((item) => item.label).join(', ') : 'nenhuma selecionada'}
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase(goal === 'sale' ? 'values' : 'chat')}>
                Voltar
              </Button>
              <Button type="button" onClick={() => setPhase('prompt')} disabled={!selectedDestination}>
                Continuar
              </Button>
            </div>
          </section>
        )}

        {phase === 'images' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>Você possui imagens reais deste imóvel?</AssistantBubble>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setImageChoice('yes')}
                className={`rounded-3xl border p-6 text-left transition ${
                  imageChoice === 'yes' ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Upload className="h-7 w-7 text-amber-500" />
                <p className="mt-4 text-lg font-black">Sim, vou enviar agora</p>
                <p className={`mt-2 text-sm font-semibold leading-relaxed ${imageChoice === 'yes' ? 'text-gray-300' : 'text-gray-500'}`}>
                  Uma imagem já é suficiente para este teste.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageChoice('no')
                  setUploadedImages([])
                }}
                className={`rounded-3xl border p-6 text-left transition ${
                  imageChoice === 'no' ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <Image className="h-7 w-7 text-amber-500" />
                <p className="mt-4 text-lg font-black">Não, gerar campanha sem imagens</p>
                <p className={`mt-2 text-sm font-semibold leading-relaxed ${imageChoice === 'no' ? 'text-gray-300' : 'text-gray-500'}`}>
                  A campanha será criada apenas com o Prompt Humano.
                </p>
              </button>
            </div>

            {imageChoice === 'yes' && (
              <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-white p-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-gray-50 px-6 py-10 text-center transition hover:bg-gray-100">
                  <Upload className="h-8 w-8 text-gray-500" />
                  <span className="mt-3 text-sm font-black text-gray-950">Enviar imagens do imóvel</span>
                  <span className="mt-1 text-xs font-semibold text-gray-500">JPG, PNG ou WebP. Sem mínimo obrigatório.</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => handleFiles(event.target.files)}
                  />
                </label>
                {uploadedImages.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {uploadedImages.map((item) => (
                      <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <img src={item.data} alt={item.name} className="aspect-square w-full object-cover" />
                        <p className="truncate px-3 py-2 text-xs font-bold text-gray-600">{item.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generationError && (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                {generationError}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setPhase('prompt')}>
                Voltar
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={!canGenerate} loading={generationLoading}>
                <Wand2 className="h-4 w-4" />
                {generationLoading ? 'Gerando campanha...' : 'Gerar campanha'}
              </Button>
            </div>
          </section>
        )}

        {phase === 'processing' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-6 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-950 text-white">
              <Wand2 className="h-7 w-7 animate-pulse" />
            </div>
            <h1 className="mt-5 text-3xl font-black text-gray-950">Criando sua campanha...</h1>
            <p className="mt-3 text-sm font-semibold text-gray-500">
              {processingMessage}
            </p>
            <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-400" />
            </div>
            {generationError && (
              <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                {generationError}
              </p>
            )}
          </section>
        )}

        {phase === 'result' && generationResult && (
          <section className="mt-6 space-y-6">
            <div className="rounded-[2rem] bg-gray-950 p-6 text-white shadow-xl shadow-gray-950/10 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-200">Campanha IA</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Campanha criada com sucesso</h1>
                  <p className="mt-3 text-sm font-semibold text-gray-300">
                    Sua peça principal e os textos da campanha estão prontos para revisão.
                  </p>
                </div>
                <Button type="button" onClick={() => {
                  setPhase('intro')
                  setGoal('')
                  setAnswers({})
                  setSaleValueMode('')
                  setSalePrice('')
                  setSaleConditions([])
                  setRentMode('')
                  setRentPrice('')
                  setCondoMode('')
                  setCondoFee('')
                  setIptuMode('')
                  setIptuValue('')
                  setRentGuarantee('')
                  setDestinationIds([])
                  setGenerationResult(null)
                }}>
                  Gerar outra campanha
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="overflow-hidden rounded-[1.5rem] bg-gray-100">
                  {generationResult.imageUrl ? (
                    <img src={generationResult.imageUrl} alt="Campanha IA gerada" className="max-h-[760px] w-full object-contain" />
                  ) : (
                    <div className="flex min-h-96 items-center justify-center text-center">
                      <p className="text-sm font-bold text-gray-500">Imagem não retornada.</p>
                    </div>
                  )}
                </div>
                {generationResult.imageUrl && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={generationResult.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-800 hover:bg-gray-50"
                    >
                      Visualizar
                    </a>
                    <a
                      href={generationResult.imageUrl}
                      download="campanha-ia.jpg"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-sm font-black text-white hover:bg-gray-800"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </div>
                )}
              </div>

              <aside className="space-y-5">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resumo</p>
                  <div className="mt-4 space-y-3 text-sm font-semibold text-gray-600">
                    <p><strong>Objetivo:</strong> {goal === 'rent' ? 'Locação' : 'Venda de imóvel'}</p>
                    <p><strong>Tipo:</strong> {answers.propertyType}</p>
                    <p><strong>Local:</strong> {[answers.neighborhood, answers.city].filter(Boolean).join(', ')}</p>
                    <p><strong>Diferenciais:</strong> {formatAnswer(answers.differentials) || 'Não informado'}</p>
                    <p><strong>Valores/condições:</strong> {valueCondition.label}{valueCondition.details ? `: ${valueCondition.details}` : ''}</p>
                    <p><strong>CTA:</strong> {answers.cta}</p>
                    <p><strong>Destino principal:</strong> {selectedDestination?.label || 'Não informado'}</p>
                    <p><strong>Adaptações futuras:</strong> {compatibleDestinations.length ? compatibleDestinations.map((item) => item.label).join(', ') : 'Nenhuma'}</p>
                    <p><strong>Imagens reais:</strong> {uploadedImages.length > 0 ? `${uploadedImages.length} anexada(s)` : 'Não utilizadas'}</p>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-gray-950">Textos da campanha</p>
                    <button
                      type="button"
                      onClick={downloadTexts}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-700 hover:bg-gray-100"
                    >
                      Baixar textos
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {TEXT_BLOCKS.map(([key, title]) => (
                      <TextBlock key={key} title={title} content={generationResult.texts?.[key]} />
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

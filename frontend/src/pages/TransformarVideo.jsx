import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  Image,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'

const MIN_VIDEO_PHOTOS = 5
const MAX_VIDEO_PHOTOS = 15
const TEXT_LIMIT = 80

const GOALS = [
  { id: 'sale', label: 'Venda de imóvel', description: 'Vídeo para divulgar um imóvel à venda.' },
  { id: 'rent', label: 'Locação de imóvel', description: 'Vídeo para anunciar um imóvel para locação.' },
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
  'Conhecer condições',
  'Faça sua simulação',
  'Quero informações',
  'Chamar no WhatsApp',
]

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
      'Pronto para morar',
      'Condomínio seguro',
      'Boa iluminação',
      'Disponibilidade imediata',
      'Fácil visita',
      'Contrato facilitado',
    ],
  },
]

const SALE_CHAT_FLOW = [
  { id: 'propertyType', question: 'Que tipo de imóvel vamos divulgar?', type: 'chips', options: PROPERTY_TYPE_OPTIONS },
  { id: 'profile', question: 'Qual é o perfil comercial deste imóvel?', type: 'chips', options: COMMERCIAL_PROFILE_OPTIONS },
  { id: 'stage', question: 'Qual é o estado atual do imóvel?', type: 'chips', options: PROPERTY_STAGE_OPTIONS },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'Qual é o bairro?', type: 'text', placeholder: 'Ex: Vila Mariana' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  {
    id: 'differentials',
    question: 'Quais diferenciais merecem destaque?',
    type: 'multiGrouped',
    groups: DIFFERENTIAL_GROUPS,
    confirmLabel: 'Confirmar diferenciais',
  },
  { id: 'cta', question: 'Qual chamada deve conduzir o vídeo?', type: 'chips', options: CTA_OPTIONS },
]

const RENT_CHAT_FLOW = [
  { id: 'propertyType', question: 'Que tipo de imóvel será anunciado para locação?', type: 'chips', options: PROPERTY_TYPE_OPTIONS },
  { id: 'city', question: 'Em qual cidade fica o imóvel?', type: 'text', placeholder: 'Ex: São Paulo' },
  { id: 'neighborhood', question: 'Qual é o bairro?', type: 'text', placeholder: 'Ex: Moema' },
  { id: 'bedrooms', question: 'Quantos dormitórios?', type: 'chips', options: BEDROOM_OPTIONS },
  { id: 'suites', question: 'Quantas suítes?', type: 'chips', options: SUITE_OPTIONS },
  { id: 'parking', question: 'Quantas vagas?', type: 'chips', options: PARKING_OPTIONS },
  { id: 'area', question: 'Deseja informar a área?', type: 'text', placeholder: 'Ex: 72 m²', optionalLabel: 'Não informar área' },
  {
    id: 'differentials',
    question: 'Quais diferenciais devem aparecer no vídeo?',
    type: 'multiGrouped',
    groups: RENT_DIFFERENTIAL_GROUPS,
    confirmLabel: 'Confirmar diferenciais',
  },
  { id: 'cta', question: 'Qual chamada deve conduzir o vídeo?', type: 'chips', options: CTA_OPTIONS },
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

const VIDEO_DURATIONS = [
  { id: '30', label: '30 segundos', description: 'Mais direto, ideal para Reels, Stories, Status e WhatsApp.' },
  { id: '45', label: '45 segundos', description: 'Mais completo, ideal para imóveis com mais fotos e diferenciais.' },
]

const PROCESSING_STEPS = [
  'Analisando briefing...',
  'Organizando fotos...',
  'Definindo sequência...',
  'Preparando vídeo...',
]

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return [value]
}

const normalizeLocation = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .split(' ')
  .filter(Boolean)
  .map((word, index) => {
    const lower = word.toLocaleLowerCase('pt-BR')
    if (index > 0 && ['de', 'da', 'do', 'das', 'dos', 'e'].includes(lower)) return lower
    return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
  })
  .join(' ')

const normalizeTerm = (value) => normalizeLocation(value).slice(0, TEXT_LIMIT)

const formatAnswer = (value) => {
  if (Array.isArray(value)) return value.join(', ')
  return value || ''
}

const formatDuration = (duration) => VIDEO_DURATIONS.find((item) => item.id === duration)?.label || ''

const getGoalLabel = (goal) => GOALS.find((item) => item.id === goal)?.label || 'Campanha em vídeo'

const getRentalGuaranteeLabel = (id) => RENT_GUARANTEE_OPTIONS.find((item) => item.id === id)?.label || ''

const buildValueCondition = (goal, saleValues, rentValues) => {
  if (goal === 'rent') {
    const parts = []
    if (rentValues.rentMode === 'show' && rentValues.rentPrice) parts.push(`Aluguel: ${rentValues.rentPrice}`)
    if (rentValues.condoMode === 'show' && rentValues.condoPrice) parts.push(`Condomínio: ${rentValues.condoPrice}`)
    if (rentValues.iptuMode === 'show' && rentValues.iptuPrice) parts.push(`IPTU: ${rentValues.iptuPrice}`)
    if (rentValues.guarantee && rentValues.guarantee !== 'nao_informar') parts.push(`Garantia: ${getRentalGuaranteeLabel(rentValues.guarantee)}`)
    return {
      mode: parts.length ? 'visible' : 'hidden',
      label: parts.length ? 'Mostrar valores informados' : 'Não mostrar valores',
      details: parts.join(' · '),
    }
  }

  if (saleValues.mode === 'price') {
    return {
      mode: 'price',
      label: 'Mostrar valor do imóvel',
      details: [
        saleValues.price ? `Valor: ${saleValues.price}` : '',
        saleValues.conditions.length ? `Condições: ${saleValues.conditions.join(', ')}` : '',
      ].filter(Boolean).join(' · '),
    }
  }

  if (saleValues.mode === 'conditions') {
    return {
      mode: 'conditions',
      label: 'Mostrar apenas condições',
      details: saleValues.conditions.join(', '),
    }
  }

  return {
    mode: 'hidden',
    label: 'Não mostrar valores',
    details: '',
  }
}

const buildVideoStyleDirector = ({ goal, answers, valueCondition, duration }) => {
  const profile = goal === 'rent' ? 'Locação' : answers.profile
  const isMcmv = profile === 'Minha Casa Minha Vida'
  const isMid = profile === 'Médio padrão'
  const isHigh = profile === 'Alto padrão'
  const isLuxury = profile === 'Luxo'
  const isLaunch = ['Lançamento', 'Pré-lançamento'].includes(profile) || ['Lançamento', 'Pré-lançamento'].includes(answers.stage)

  if (goal === 'rent') {
    return {
      family: 'Locação',
      promise: 'Disponibilidade, localização e contato rápido.',
      visualDirection: 'Vídeo limpo, prático e objetivo, com fotos reais transmitindo confiança e clareza.',
      hierarchy: `Abertura com melhor foto, sequência de ambientes, diferenciais, valores informados e CTA ${answers.cta || 'de contato'}.`,
      tone: 'Direto, confiável e fácil de entender.',
      avoid: 'Não parecer lançamento, não inventar ambientes e não usar luxo pesado sem motivo.',
    }
  }

  if (isMcmv) {
    return {
      family: 'Casa própria / Minha Casa Minha Vida',
      promise: 'Conquista, facilidade e oportunidade real.',
      visualDirection: 'Vídeo claro, moderno e otimista, com tons leves e ritmo acessível.',
      hierarchy: `Gancho de casa própria, fotos principais, benefícios reais, ${valueCondition.label.toLowerCase()} e CTA ${answers.cta || 'de atendimento'}.`,
      tone: 'Popular qualificado, acolhedor e sem linguagem de luxo.',
      avoid: 'Evitar preto/dourado, estética de alto padrão e promessas não informadas.',
    }
  }

  if (isHigh || isLuxury) {
    return {
      family: isLuxury ? 'Luxo' : 'Alto padrão',
      promise: 'Desejo, exclusividade e experiência de morar bem.',
      visualDirection: 'Vídeo sofisticado, editorial e aspiracional, valorizando detalhes e atmosfera.',
      hierarchy: `Abertura forte, fotos mais elegantes, diferenciais de lifestyle, localização e CTA ${answers.cta || 'de visita'}.`,
      tone: 'Elegante, seletivo e premium apenas porque o perfil permite.',
      avoid: 'Não exagerar em ficha técnica nem repetir a mesma foto sem necessidade.',
    }
  }

  if (isLaunch) {
    return {
      family: 'Lançamento / oportunidade',
      promise: 'Novidade, oportunidade e decisão no tempo certo.',
      visualDirection: 'Vídeo moderno, dinâmico e comercial, com ritmo de campanha de lançamento.',
      hierarchy: `Gancho inicial, contexto do imóvel, diferenciais, condições quando informadas e CTA ${answers.cta || 'de interesse'}.`,
      tone: 'Energético, confiável e orientado à conversão.',
      avoid: 'Não inventar disponibilidade, metragem, preço ou benefício comercial.',
    }
  }

  if (isMid) {
    return {
      family: 'Médio padrão / praticidade',
      promise: 'Conforto, localização e rotina mais prática.',
      visualDirection: 'Vídeo urbano, limpo e confiável, com cores claras e linguagem moderna.',
      hierarchy: `Abertura com imóvel, sequência de ambientes, diferenciais de rotina, valor/condição se houver e CTA ${answers.cta || 'de visita'}.`,
      tone: 'Comercial, direto e bem acabado.',
      avoid: 'Não aplicar visual de luxo pesado nem transformar ficha técnica em protagonista.',
    }
  }

  return {
    family: profile || 'Campanha imobiliária',
    promise: 'Apresentar o imóvel com clareza, desejo e ação.',
    visualDirection: 'Vídeo profissional, moderno e de alto impacto, respeitando as fotos reais enviadas.',
    hierarchy: `Abertura, fotos principais, diferenciais, contexto do imóvel e CTA ${answers.cta || 'principal'}.`,
    tone: 'Seguro, comercial e fácil de entender.',
    avoid: 'Não inventar dados, não usar imagens fora do imóvel e não poluir a peça.',
  }
}

export default function TransformarVideo() {
  const [phase, setPhase] = useState('intro')
  const [goal, setGoal] = useState('')
  const [answers, setAnswers] = useState({})
  const [chatIndex, setChatIndex] = useState(0)
  const [textDraft, setTextDraft] = useState('')
  const [multiDraft, setMultiDraft] = useState([])
  const [customDifferential, setCustomDifferential] = useState('')
  const [saleValues, setSaleValues] = useState({ mode: '', price: '', conditions: [] })
  const [rentValues, setRentValues] = useState({
    rentMode: '',
    rentPrice: '',
    condoMode: '',
    condoPrice: '',
    iptuMode: '',
    iptuPrice: '',
    guarantee: '',
  })
  const [photos, setPhotos] = useState([])
  const [photoNotice, setPhotoNotice] = useState('')
  const [duration, setDuration] = useState('')
  const [processingStep, setProcessingStep] = useState(0)

  const photosRef = useRef([])
  const processingTimerRef = useRef(null)

  const chatFlow = goal === 'rent' ? RENT_CHAT_FLOW : SALE_CHAT_FLOW
  const currentQuestion = chatFlow[chatIndex]
  const coverPhoto = photos[0]?.preview || null
  const valueCondition = useMemo(() => buildValueCondition(goal, saleValues, rentValues), [goal, rentValues, saleValues])
  const styleDirector = useMemo(
    () => buildVideoStyleDirector({ goal, answers, valueCondition, duration }),
    [goal, answers, valueCondition, duration],
  )

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview))
    if (processingTimerRef.current) window.clearTimeout(processingTimerRef.current)
  }, [])

  const updateAnswer = (key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  const resetQuestionDrafts = () => {
    setTextDraft('')
    setMultiDraft([])
    setCustomDifferential('')
  }

  const startGoal = (nextGoal) => {
    setGoal(nextGoal)
    setAnswers({})
    setChatIndex(0)
    resetQuestionDrafts()
    setPhase('chat')
  }

  const goBack = () => {
    setPhotoNotice('')
    if (phase === 'goal') return setPhase('intro')
    if (phase === 'chat') {
      if (chatIndex === 0) return setPhase('goal')
      const previousIndex = chatIndex - 1
      const previousQuestion = chatFlow[previousIndex]
      setChatIndex(previousIndex)
      const previousAnswer = answers[previousQuestion.id]
      if (previousQuestion.type === 'multiGrouped') {
        setMultiDraft(normalizeList(previousAnswer))
      } else {
        setTextDraft(formatAnswer(previousAnswer))
      }
      return
    }
    if (phase === 'values') return setPhase('chat')
    if (phase === 'photos') return setPhase('values')
    if (phase === 'duration') return setPhase('photos')
    if (phase === 'review') return setPhase('duration')
    if (phase === 'result') return setPhase('review')
    setPhase('intro')
  }

  const resetFlow = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
    setPhase('intro')
    setGoal('')
    setAnswers({})
    setChatIndex(0)
    resetQuestionDrafts()
    setSaleValues({ mode: '', price: '', conditions: [] })
    setRentValues({
      rentMode: '',
      rentPrice: '',
      condoMode: '',
      condoPrice: '',
      iptuMode: '',
      iptuPrice: '',
      guarantee: '',
    })
    setPhotos([])
    setPhotoNotice('')
    setDuration('')
    setProcessingStep(0)
  }

  const commitAnswer = (id, value) => {
    updateAnswer(id, value)
    resetQuestionDrafts()
    if (chatIndex >= chatFlow.length - 1) {
      setPhase('values')
      return
    }
    setChatIndex((current) => current + 1)
  }

  const handleEditQuestion = (index) => {
    const question = chatFlow[index]
    setChatIndex(index)
    setPhase('chat')
    if (question.type === 'multiGrouped') {
      setMultiDraft(normalizeList(answers[question.id]))
    } else {
      setTextDraft(formatAnswer(answers[question.id]))
    }
  }

  const handleFiles = (fileList) => {
    const incoming = Array.from(fileList || []).filter((file) => file.type?.startsWith('image/'))
    if (incoming.length === 0) {
      setPhotoNotice('Envie apenas imagens em JPG, PNG ou WebP.')
      return
    }

    setPhotos((current) => {
      const available = MAX_VIDEO_PHOTOS - current.length
      if (available <= 0) {
        setPhotoNotice(`Você já atingiu o limite de ${MAX_VIDEO_PHOTOS} fotos.`)
        return current
      }

      if (incoming.length > available) {
        setPhotoNotice(`Foram adicionadas apenas ${available} foto${available === 1 ? '' : 's'} para respeitar o limite de ${MAX_VIDEO_PHOTOS}.`)
      } else {
        setPhotoNotice('')
      }

      const nextPhotos = incoming.slice(0, available).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        preview: URL.createObjectURL(file),
      }))

      return [...current, ...nextPhotos]
    })
  }

  const removePhoto = (id) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.preview)
      return current.filter((photo) => photo.id !== id)
    })
    setPhotoNotice('')
  }

  const startFakeProcessing = () => {
    setPhase('processing')
    setProcessingStep(0)
    PROCESSING_STEPS.forEach((_, index) => {
      window.setTimeout(() => setProcessingStep(index), index * 450)
    })
    processingTimerRef.current = window.setTimeout(() => setPhase('result'), 2600)
  }

  const canContinueValues = () => {
    if (goal === 'rent') {
      if (!rentValues.rentMode || !rentValues.condoMode || !rentValues.iptuMode || !rentValues.guarantee) return false
      if (rentValues.rentMode === 'show' && !rentValues.rentPrice.trim()) return false
      if (rentValues.condoMode === 'show' && !rentValues.condoPrice.trim()) return false
      if (rentValues.iptuMode === 'show' && !rentValues.iptuPrice.trim()) return false
      return true
    }
    if (!saleValues.mode) return false
    if (saleValues.mode === 'price' && !saleValues.price.trim()) return false
    if (saleValues.mode === 'conditions' && saleValues.conditions.length === 0) return false
    return true
  }

  const summaryRows = [
    ['Objetivo', getGoalLabel(goal)],
    ['Imóvel', answers.propertyType],
    ['Local', [answers.neighborhood, answers.city].filter(Boolean).join(', ')],
    ...(goal === 'sale' ? [['Perfil', answers.profile], ['Estado', answers.stage]] : []),
    ['Dormitórios', answers.bedrooms],
    ['Suítes', answers.suites],
    ['Vagas', answers.parking],
    ...(answers.area ? [['Área', answers.area]] : []),
    ['Diferenciais', formatAnswer(answers.differentials)],
    ['Valores e condições', valueCondition.details || valueCondition.label],
    ['Fotos', `${photos.length} fotos`],
    ['Duração', formatDuration(duration)],
    ['CTA', answers.cta],
  ]

  const renderQuestionControls = () => {
    if (!currentQuestion) return null

    if (currentQuestion.type === 'chips') {
      return (
        <div className="mt-4 flex flex-wrap gap-3">
          {currentQuestion.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => commitAnswer(currentQuestion.id, option)}
              className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-gray-700 transition hover:border-primary-300 hover:bg-primary-50"
            >
              {option}
            </button>
          ))}
        </div>
      )
    }

    if (currentQuestion.type === 'multiGrouped') {
      const selectedWithCustom = [
        ...multiDraft,
        ...(customDifferential.trim() ? [normalizeTerm(customDifferential)] : []),
      ].filter(Boolean)

      return (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {currentQuestion.groups.map((group) => (
              <div key={group.title} className="rounded-3xl border border-blue-100 bg-white p-4">
                <p className="text-sm font-black text-gray-950">{group.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = multiDraft.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMultiDraft((current) => (
                            current.includes(option)
                              ? current.filter((item) => item !== option)
                              : [...current, option]
                          ))
                        }}
                        className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                          active
                            ? 'border-primary-800 bg-primary-800 text-white'
                            : 'border-blue-100 bg-primary-50 text-primary-800 hover:border-primary-300'
                        }`}
                      >
                        {option}
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
            maxLength={TEXT_LIMIT}
            className="min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          <Button type="button" onClick={() => commitAnswer(currentQuestion.id, selectedWithCustom)} disabled={selectedWithCustom.length === 0}>
            {currentQuestion.confirmLabel || 'Confirmar'}
          </Button>
        </div>
      )
    }

    return (
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={textDraft}
          onChange={(event) => setTextDraft(event.target.value)}
          placeholder={currentQuestion.placeholder}
          className="min-h-12 flex-1 rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
        />
        {currentQuestion.optionalLabel && (
          <Button type="button" variant="secondary" onClick={() => commitAnswer(currentQuestion.id, 'Não informar')}>
            {currentQuestion.optionalLabel}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => commitAnswer(currentQuestion.id, normalizeLocation(textDraft))}
          disabled={!textDraft.trim()}
        >
          Enviar
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header title="Vídeo IA" subtitle="Crie uma campanha em vídeo usando a mesma inteligência do Hero IA Next, agora adaptada para fotos do imóvel." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Home
        </Link>

        {phase === 'intro' && (
          <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#0F2742] p-7 text-white shadow-xl shadow-[#0F2742]/10 sm:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Video className="h-4 w-4 text-cyan-200" />
                Produto 2
              </div>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
                Vamos montar sua campanha em vídeo
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-gray-300 sm:text-lg">
                Siga o fluxo guiado, envie de 5 a 15 fotos e escolha se o vídeo terá 30s ou 45s.
              </p>
              <Button type="button" onClick={() => setPhase('goal')} className="mt-8">
                Começar
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {phase === 'goal' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>O que deseja divulgar?</AssistantBubble>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startGoal(item.id)}
                  className="rounded-[1.75rem] border border-blue-100 bg-white p-6 text-left transition hover:border-primary-300 hover:bg-primary-50"
                >
                  <Film className="h-7 w-7 text-primary-600" />
                  <p className="mt-4 text-xl font-black text-gray-950">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">{item.description}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {phase === 'chat' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <div className="space-y-5">
              <AssistantBubble>
                Perfeito. Vou montar uma campanha em vídeo de {getGoalLabel(goal).toLowerCase()} com você, passo a passo.
              </AssistantBubble>
              {chatFlow.slice(0, chatIndex).map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <AssistantBubble>{question.question}</AssistantBubble>
                  <div className="ml-12 flex max-w-3xl items-start justify-between gap-3 rounded-3xl rounded-tr-md bg-primary-800 px-5 py-4 text-white">
                    <p className="text-sm font-bold leading-relaxed">{formatAnswer(answers[question.id])}</p>
                    <button type="button" onClick={() => handleEditQuestion(index)} className="text-xs font-black text-cyan-100 hover:text-white">
                      Editar
                    </button>
                  </div>
                </div>
              ))}
              {currentQuestion && (
                <div>
                  <AssistantBubble>{currentQuestion.question}</AssistantBubble>
                  {renderQuestionControls()}
                </div>
              )}
              <div className="pt-2">
                <Button type="button" variant="secondary" onClick={goBack}>
                  Voltar
                </Button>
              </div>
            </div>
          </section>
        )}

        {phase === 'values' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>
              {goal === 'rent' ? 'Quais valores deseja divulgar?' : 'Deseja divulgar valor ou condições?'}
            </AssistantBubble>

            {goal === 'rent' ? (
              <RentalValuesForm rentValues={rentValues} setRentValues={setRentValues} />
            ) : (
              <SaleValuesForm saleValues={saleValues} setSaleValues={setSaleValues} />
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Voltar
              </Button>
              <Button type="button" onClick={() => setPhase('photos')} disabled={!canContinueValues()}>
                Continuar
              </Button>
            </div>
          </section>
        )}

        {phase === 'photos' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>Envie de 5 a 15 fotos para montar a sequência do vídeo.</AssistantBubble>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              A primeira foto enviada será utilizada como imagem principal do vídeo. Recomendamos enviar primeiro a melhor foto do imóvel.
            </p>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-gray-600">
              Ela será a referência futura para thumbnail, abertura do vídeo, preview e tela WOW.
            </p>

            <div className="mt-5 rounded-3xl border border-dashed border-blue-100 bg-white p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-slate-50 px-6 py-10 text-center transition hover:bg-primary-50">
                <Upload className="h-9 w-9 text-primary-600" />
                <span className="mt-3 text-sm font-black text-slate-950">Selecionar fotos do imóvel</span>
                <span className="mt-1 text-xs font-semibold text-slate-500">Mínimo 5, máximo 15 imagens.</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              </label>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-800">
                  {photos.length}/{MAX_VIDEO_PHOTOS} fotos
                </span>
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
                      setPhotos([])
                      setPhotoNotice('')
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    Remover todas
                  </button>
                )}
              </div>
              {photos.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="relative">
                        <img src={photo.preview} alt={photo.name} className="aspect-square w-full object-cover" />
                        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-slate-700">
                          {index === 0 ? 'Foto Principal' : 'Apoio'}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="absolute right-2 top-2 rounded-full bg-slate-950/70 p-1 text-white hover:bg-slate-950"
                          aria-label={`Remover ${photo.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="truncate px-3 py-2 text-xs font-bold text-slate-500">{photo.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(photoNotice || (photos.length > 0 && photos.length < MIN_VIDEO_PHOTOS)) && (
              <p className="mt-4 rounded-2xl border border-blue-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                {photoNotice || `Envie pelo menos ${MIN_VIDEO_PHOTOS} fotos para preparar o vídeo.`}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={goBack}>
                Voltar
              </Button>
              <Button type="button" onClick={() => setPhase('duration')} disabled={photos.length < MIN_VIDEO_PHOTOS}>
                Continuar
              </Button>
            </div>
          </section>
        )}

        {phase === 'duration' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <AssistantBubble>Qual duração deseja para o vídeo?</AssistantBubble>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {VIDEO_DURATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDuration(item.id)
                    setPhase('review')
                  }}
                  className={`rounded-[1.75rem] border p-6 text-left transition ${
                    duration === item.id
                      ? 'border-primary-800 bg-primary-800 text-white'
                      : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  <Video className="h-7 w-7 text-primary-600" />
                  <p className="mt-4 text-xl font-black">{item.label}</p>
                  <p className={`mt-2 text-sm font-semibold leading-relaxed ${duration === item.id ? 'text-cyan-50/80' : 'text-gray-500'}`}>
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <Button type="button" variant="secondary" onClick={goBack}>
                Voltar
              </Button>
            </div>
          </section>
        )}

        {phase === 'review' && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <AssistantBubble>
                Com base na conversa, montei a estratégia do vídeo. Confira antes de avançar.
              </AssistantBubble>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {summaryRows.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-primary-700">{label}</p>
                    <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{value || 'Não informado'}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={goBack}>
                  Voltar
                </Button>
                <Button type="button" onClick={startFakeProcessing}>
                  <Wand2 className="h-4 w-4" />
                  Gerar campanha em vídeo
                </Button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[2rem] border border-blue-100 bg-primary-50 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">Style Director</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{styleDirector.family}</h2>
                <div className="mt-4 space-y-3 text-sm font-semibold leading-relaxed text-slate-600">
                  <p><strong>Promessa:</strong> {styleDirector.promise}</p>
                  <p><strong>Direção visual:</strong> {styleDirector.visualDirection}</p>
                  <p><strong>Hierarquia:</strong> {styleDirector.hierarchy}</p>
                  <p><strong>Tom:</strong> {styleDirector.tone}</p>
                  <p><strong>Evitar:</strong> {styleDirector.avoid}</p>
                </div>
              </div>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-primary-700">Fase 1</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  Ainda não há backend, fornecedor, storage ou consumo de tokens. Esta tela valida a arquitetura visual do Produto 2.
                </p>
              </div>
            </aside>
          </section>
        )}

        {phase === 'processing' && (
          <section className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-6 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-800 text-white">
              <Wand2 className="h-7 w-7 animate-pulse" />
            </div>
            <h1 className="mt-5 text-3xl font-black text-gray-950">Preparando sua campanha em vídeo...</h1>
            <p className="mt-3 text-sm font-semibold text-gray-500">
              Esta é uma simulação local do fluxo. Nenhum arquivo foi enviado.
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {PROCESSING_STEPS.map((item, index) => (
                <div key={item} className={`rounded-2xl border p-4 ${index <= processingStep ? 'border-primary-200 bg-primary-50' : 'border-slate-200 bg-slate-50'}`}>
                  <CheckCircle2 className={`h-5 w-5 ${index <= processingStep ? 'text-primary-700' : 'text-slate-300'}`} />
                  <p className="mt-3 text-xs font-black leading-relaxed text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'result' && (
          <section className="mt-6 space-y-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-xl shadow-primary-900/10 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Vídeo IA</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Campanha em vídeo preparada</h1>
                  <p className="mt-3 text-sm font-semibold text-gray-300">
                    A estrutura está pronta para a futura geração real do vídeo.
                  </p>
                </div>
                <Button type="button" onClick={resetFlow}>
                  Gerar outro vídeo
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
                <div className="relative aspect-[9/16] max-h-[720px] bg-gray-950 sm:aspect-video">
                  {coverPhoto ? (
                    <img src={coverPhoto} alt="Foto principal da campanha em vídeo" className="h-full w-full object-cover opacity-85" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-primary-900">
                      <Image className="h-16 w-16 text-cyan-100" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-gray-950/20 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-primary-900">
                    Prévia local
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-primary-900 shadow-xl">
                      <PlayCircle className="h-10 w-10" />
                    </div>
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-100">{styleDirector.family}</p>
                    <h2 className="mt-2 text-3xl font-black">{answers.cta}</h2>
                    <p className="mt-2 text-sm font-semibold text-cyan-50/80">
                      {formatDuration(duration)} · {photos.length} fotos · {getGoalLabel(goal)}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 border-t border-slate-200 p-5 sm:grid-cols-3">
                  <InfoPill label="Duração" value={formatDuration(duration)} />
                  <InfoPill label="Fotos" value={`${photos.length} imagens`} />
                  <InfoPill label="CTA" value={answers.cta || 'Não informado'} />
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xl font-black text-gray-950">Sequência prevista</p>
                  <div className="mt-4 space-y-3">
                    {[
                      'Abertura com imagem principal',
                      'Fotos de apoio em ritmo dinâmico',
                      'Diferenciais e contexto do imóvel',
                      'Valor ou condição quando selecionado',
                      'CTA final para contato',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                        <CheckCircle2 className="h-5 w-5 text-primary-700" />
                        <p className="text-sm font-bold text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  <Button type="button" onClick={resetFlow}>
                    <RotateCcw className="h-4 w-4" />
                    Criar outro vídeo
                  </Button>
                  <Link to="/hero" className="inline-flex items-center justify-center rounded-xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
                    Criar Campanha IA
                  </Link>
                  <Link to="/nova-campanha" className="inline-flex items-center justify-center rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-primary-800 hover:bg-primary-50">
                    Criar banners rápidos
                  </Link>
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function Header({ title, subtitle }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 sm:px-7 lg:px-8">
        <p className="text-xs font-black uppercase tracking-wide text-primary-700">SmartCorretorAI 3.0</p>
        <h1 className="text-2xl font-black tracking-tight text-gray-950">{title}</h1>
        <p className="max-w-3xl text-sm font-semibold leading-relaxed text-gray-500">{subtitle}</p>
      </div>
    </header>
  )
}

function AssistantBubble({ children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-3xl rounded-3xl rounded-tl-md border border-blue-100 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-bold leading-relaxed text-slate-700">{children}</p>
      </div>
    </div>
  )
}

function SaleValuesForm({ saleValues, setSaleValues }) {
  const toggleCondition = (condition) => {
    setSaleValues((current) => ({
      ...current,
      conditions: current.conditions.includes(condition)
        ? current.conditions.filter((item) => item !== condition)
        : [...current.conditions, condition],
    }))
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        {[
          { id: 'price', title: 'Mostrar valor do imóvel', description: 'O valor informado poderá aparecer no vídeo.' },
          { id: 'conditions', title: 'Mostrar apenas condições', description: 'Sem preço. Apenas condições comerciais reais.' },
          { id: 'hidden', title: 'Não mostrar valores', description: 'O vídeo não deve mostrar preço nem condições.' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSaleValues((current) => ({ ...current, mode: item.id }))}
            className={`rounded-3xl border p-5 text-left transition ${
              saleValues.mode === item.id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
            }`}
          >
            <p className="font-black">{item.title}</p>
            <p className={`mt-2 text-sm font-semibold leading-relaxed ${saleValues.mode === item.id ? 'text-cyan-50/80' : 'text-gray-500'}`}>
              {item.description}
            </p>
          </button>
        ))}
      </div>

      {saleValues.mode === 'price' && (
        <input
          value={saleValues.price}
          onChange={(event) => setSaleValues((current) => ({ ...current, price: event.target.value }))}
          placeholder="Ex: R$ 384.000, A partir de R$ 384.000 ou Sob consulta"
          className="min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
        />
      )}

      {(saleValues.mode === 'price' || saleValues.mode === 'conditions') && (
        <div className="rounded-3xl border border-blue-100 bg-white p-4">
          <p className="text-sm font-black text-gray-950">Condições comerciais</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SALE_CONDITION_OPTIONS.map((condition) => {
              const active = saleValues.conditions.includes(condition)
              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                    active ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-primary-50 text-primary-800 hover:border-primary-300'
                  }`}
                >
                  {condition}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function RentalValuesForm({ rentValues, setRentValues }) {
  const update = (key, value) => setRentValues((current) => ({ ...current, [key]: value }))

  return (
    <div className="mt-5 space-y-5">
      <RentalValueBlock
        title="Aluguel"
        mode={rentValues.rentMode}
        value={rentValues.rentPrice}
        showLabel="Mostrar aluguel"
        hideLabel="Não mostrar aluguel"
        placeholder="Ex: R$ 3.200/mês"
        onMode={(value) => update('rentMode', value)}
        onValue={(value) => update('rentPrice', value)}
      />
      <RentalValueBlock
        title="Condomínio"
        mode={rentValues.condoMode}
        value={rentValues.condoPrice}
        showLabel="Mostrar condomínio"
        hideLabel="Não mostrar condomínio"
        naLabel="Não se aplica"
        placeholder="Ex: R$ 750"
        onMode={(value) => update('condoMode', value)}
        onValue={(value) => update('condoPrice', value)}
      />
      <RentalValueBlock
        title="IPTU"
        mode={rentValues.iptuMode}
        value={rentValues.iptuPrice}
        showLabel="Mostrar IPTU"
        hideLabel="Não mostrar IPTU"
        naLabel="Não se aplica"
        placeholder="Ex: R$ 180/mês"
        onMode={(value) => update('iptuMode', value)}
        onValue={(value) => update('iptuPrice', value)}
      />

      <div className="rounded-3xl border border-blue-100 bg-white p-4">
        <p className="text-sm font-black text-gray-950">Garantia</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {RENT_GUARANTEE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => update('guarantee', option.id)}
              className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                rentValues.guarantee === option.id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-primary-50 text-primary-800 hover:border-primary-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RentalValueBlock({ title, mode, value, showLabel, hideLabel, naLabel, placeholder, onMode, onValue }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-4">
      <p className="text-sm font-black text-gray-950">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { id: 'show', label: showLabel },
          { id: 'hide', label: hideLabel },
          ...(naLabel ? [{ id: 'na', label: naLabel }] : []),
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onMode(option.id)}
            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
              mode === option.id ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-primary-50 text-primary-800 hover:border-primary-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {mode === 'show' && (
        <input
          value={value}
          onChange={(event) => onValue(event.target.value)}
          placeholder={placeholder}
          className="mt-3 min-h-12 w-full rounded-2xl border border-blue-100 bg-slate-50 px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
        />
      )}
    </div>
  )
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-primary-700">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    </div>
  )
}

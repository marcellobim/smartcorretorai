import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Download,
  Image,
  Layers3,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { useProperties } from '../hooks/useProperties'
import { formatArea, formatCurrency } from '../utils/formatters'
import { supabase } from '../lib/supabase'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'
const MIN_HERO_PHOTOS = 3
const HERO_RESULT_STORAGE_KEY = 'smartcorretorai:hero-ia:last-result'

const IMAGE_MODES = [
  {
    id: 'main_photo',
    icon: '📸',
    label: 'Melhorar foto principal',
    description: 'Utilizar a foto principal do imóvel como base para a campanha.',
  },
  {
    id: 'reference_photos',
    icon: '🖼',
    label: 'Utilizar todas as fotos do imóvel',
    description: 'Utilizar as imagens cadastradas para montar uma campanha completa.',
  },
  {
    id: 'new_image',
    icon: '✨',
    label: 'Explorar conceitos da região',
    description: 'Criar uma campanha mais criativa usando contexto da região e do imóvel.',
  },
]

const AUDIENCES = [
  { id: 'primeiro_imovel', label: 'Primeiro imóvel' },
  { id: 'familia', label: 'Família' },
  { id: 'investidor', label: 'Investidor' },
  { id: 'executivo', label: 'Executivo' },
  { id: 'alto_padrao', label: 'Alto padrão' },
  { id: 'lancamento', label: 'Lançamento' },
  { id: 'pre_lancamento', label: 'Pré-lançamento' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'locacao', label: 'Locação' },
]

const PROPERTY_STATES = [
  'Pronto para morar',
  'Em obras',
  'Reformado',
  'Novo',
  'Usado',
  'Lançamento',
  'Pré-lançamento',
]

const CTA_OPTIONS = [
  'Agende sua visita',
  'Fale com o corretor',
  'Quero mais informações',
  'Ver disponibilidade',
  'Receber atendimento',
  'Reservar interesse',
  'Conhecer condições',
]

function readStoredHeroResult() {
  try {
    const raw = window.sessionStorage.getItem(HERO_RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.imageUrl ? parsed : null
  } catch {
    return null
  }
}

function writeStoredHeroResult(result) {
  try {
    if (result?.imageUrl) {
      window.sessionStorage.setItem(HERO_RESULT_STORAGE_KEY, JSON.stringify(result))
    } else {
      window.sessionStorage.removeItem(HERO_RESULT_STORAGE_KEY)
    }
  } catch {
    // Session persistence is a convenience; generation must not depend on it.
  }
}

async function downloadImageFile(url, filename) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('download_failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.target = '_blank'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
}

const VALUE_CONDITION_OPTIONS = [
  { id: 'show_registered_price', icon: '💰', label: 'Mostrar valor' },
  { id: 'commercial_terms', icon: '📋', label: 'Mostrar apenas condições' },
  { id: 'hide_values', icon: '🚫', label: 'Não mostrar valores' },
]

const SALE_PROPERTY_TYPES = ['Apartamento', 'Casa', 'Terreno/Lote', 'Comercial']

const SALE_PROFILES = ['Minha Casa Minha Vida', 'Médio padrão', 'Alto padrão', 'Luxo']

const SALE_STAGES = [
  'Pré-lançamento',
  'Lançamento',
  'Em obras',
  'Pronto para morar',
  'Reformado',
  'Novo',
  'Usado',
]

const SALE_HIGHLIGHTS = [
  'Próximo ao metrô',
  'Lazer completo',
  'Varanda gourmet',
  'Vista livre',
  'Shopping próximo',
  'Segurança',
  'Piscina',
  'Academia',
  'Coworking',
  'Pet place',
  'Comércio próximo',
  'Gastronomia',
  'Parque próximo',
  'Mobilidade',
]

const SALE_CONDITIONS = [
  'Aceita financiamento',
  'FGTS',
  'Subsídio',
  'Entrada facilitada',
  'Condições especiais',
]

const SALE_CTA_OPTIONS = ['Agende sua visita', 'Saiba mais', 'Fale comigo']

const DESTINATION_OPTIONS = [
  {
    id: 'feed_instagram',
    icon: '📱',
    label: 'Feed Instagram',
    formatGroup: 'square_feed',
    compatibleIds: ['facebook', 'whatsapp'],
  },
  {
    id: 'story_reels',
    icon: '🎥',
    label: 'Story/Reels',
    formatGroup: 'vertical',
    compatibleIds: [],
  },
  {
    id: 'whatsapp',
    icon: '💬',
    label: 'WhatsApp',
    formatGroup: 'square_feed',
    compatibleIds: ['feed_instagram', 'facebook'],
  },
  {
    id: 'facebook',
    icon: '📘',
    label: 'Facebook',
    formatGroup: 'square_feed',
    compatibleIds: ['feed_instagram', 'whatsapp'],
  },
  {
    id: 'landing_page',
    icon: '🌐',
    label: 'Landing Page',
    formatGroup: 'landscape',
    compatibleIds: ['google_ads'],
  },
  {
    id: 'portal_imobiliario',
    icon: '🏢',
    label: 'Portal Imobiliário',
    formatGroup: 'portal',
    compatibleIds: [],
  },
  {
    id: 'google_ads',
    icon: '📢',
    label: 'Google Ads',
    formatGroup: 'landscape',
    compatibleIds: ['landing_page'],
  },
]

const SUBCATEGORIES = {
  primeiro_imovel: ['FGTS', 'Subsídio', 'Entrada facilitada'],
  familia: ['Conforto', 'Lazer', 'Segurança'],
  investidor: ['Valorização', 'Rentabilidade', 'Escassez'],
  executivo: ['Localização', 'Conveniência', 'Exclusividade'],
  alto_padrao: ['Exclusividade', 'Acabamento', 'Privacidade'],
  lancamento: ['Oportunidade', 'Condições especiais', 'Novo empreendimento'],
  pre_lancamento: ['Antecipação', 'Reserva de unidade', 'Potencial de valorização'],
  terreno: ['Potencial construtivo', 'Localização', 'Investimento'],
  comercial: ['Fluxo', 'Visibilidade', 'Estrutura'],
  locacao: ['Praticidade', 'Localização', 'Agilidade'],
}

const CREATIVE_CONCEPTS = [
  'Família',
  'Lifestyle',
  'Investimento',
  'Exclusividade',
]

const CREATIVE_CONCEPT_ICONS = {
  Família: '👨‍👩‍👧‍👦',
  Lifestyle: '🌴',
  Investimento: '📈',
  Exclusividade: '💎',
}

const DELIVERABLES = [
  { id: 'hero_image', label: 'Hero IA', locked: true },
  { id: 'instagram_text', label: 'Texto Instagram' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'cta', label: 'CTA' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'portal_description', label: 'Descrição Portal' },
]

const CREATIVE_DIRECTIONS = [
  {
    id: 'lifestyle',
    title: 'Lifestyle',
    description: 'Valoriza desejo de morar, rotina e percepção emocional.',
  },
  {
    id: 'investidor',
    title: 'Investidor',
    description: 'Foca em oportunidade, liquidez e potencial comercial sem promessas.',
  },
  {
    id: 'exclusividade',
    title: 'Exclusividade',
    description: 'Traz uma leitura mais sofisticada e aspiracional.',
  },
]

const parseMasterProperty = (description = '') => {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return null

  try {
    return JSON.parse(raw.slice(markerIndex + MASTER_MARKER.length).trim())
  } catch {
    return null
  }
}

const getPhotoList = (property) => {
  const master = parseMasterProperty(property?.descricao)
  const masterPhotos = Array.isArray(master?.fotos_imovel) ? master.fotos_imovel : []
  const propertyPhotos = Array.isArray(property?.fotos) ? property.fotos : []
  return propertyPhotos.length > 0 ? propertyPhotos : masterPhotos
}

const getHighlights = (property) => {
  const master = parseMasterProperty(property?.descricao)
  if (Array.isArray(master?.destaques_selecionados)) return master.destaques_selecionados
  if (Array.isArray(master?.destaques)) return master.destaques
  return []
}

const getPropertyState = (property) => {
  const master = parseMasterProperty(property?.descricao)
  return master?.estado_imovel || property?.estado_imovel || ''
}

const normalizePlaceName = (value = '') => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const lower = cleaned.toLowerCase()
  const known = {
    'sao paulo': 'São Paulo',
    'são paulo': 'São Paulo',
  }
  if (known[lower]) return known[lower]
  return lower
    .split(' ')
    .map((word) => {
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

const getPropertyTitle = (property) => {
  if (!property) return 'Imóvel'
  return property.titulo || [property.tipo, property.bairro].filter(Boolean).join(' em ') || 'Imóvel cadastrado'
}

const getLocation = (property) => [property?.bairro, property?.cidade].filter(Boolean).join(', ') || 'Localização não informada'

const getProfileStatus = (user) => {
  const requiredFields = [
    user?.nome || user?.displayName,
    user?.whatsapp,
    user?.email,
    user?.creci,
  ]
  const completed = requiredFields.filter(Boolean).length
  return {
    completed,
    total: requiredFields.length,
    complete: completed === requiredFields.length,
  }
}

const getBrandStatus = (user) => ({
  hasBrandName: Boolean(user?.imobiliaria),
  hasLogo: Boolean(user?.logo_url),
})

const buildInitialDeliverables = () => DELIVERABLES.reduce((acc, item) => {
  acc[item.id] = true
  return acc
}, {})

const getMasterProfile = (property) => {
  const master = parseMasterProperty(property?.descricao)
  return master?.perfil_imovel || ''
}

const buildHumanPrompt = ({
  propertyType,
  profile,
  stage,
  city,
  neighborhood,
  bedrooms,
  suites,
  parkingSpaces,
  area,
  highlights,
  otherHighlight,
  valueCondition,
  value,
  conditions,
  cta,
  destination,
  imageMode,
  concepts,
}) => {
  const location = [neighborhood, city].filter(Boolean).join(', ')
  const featureParts = [
    bedrooms ? `${bedrooms} dormitório${String(bedrooms) === '1' ? '' : 's'}` : '',
    suites ? `${suites} suíte${String(suites) === '1' ? '' : 's'}` : '',
    parkingSpaces ? `${parkingSpaces} vaga${String(parkingSpaces) === '1' ? '' : 's'}` : '',
    area ? `${area}m²` : '',
  ].filter(Boolean)
  const allHighlights = [...highlights, otherHighlight].filter(Boolean)
  const commercialParts = [
    valueCondition?.id === 'show_registered_price' && value ? `Valor: ${value}.` : '',
    valueCondition?.id === 'commercial_terms' && conditions.length > 0 ? `Condições comerciais: ${conditions.join(', ')}.` : '',
    valueCondition?.id === 'hide_values' ? 'Não mostrar valores na campanha.' : '',
  ].filter(Boolean)

  return [
    `Crie uma campanha imobiliária premium para ${destination?.label || 'Instagram'}.`,
    '',
    `${propertyType || 'Imóvel'} de ${profile || 'perfil residencial'}${location ? ` localizado em ${location}` : ''}.`,
    stage ? `Imóvel ${stage.toLowerCase()}${featureParts.length > 0 ? `, com ${featureParts.join(', ')}` : ''}.` : featureParts.length > 0 ? `Características principais: ${featureParts.join(', ')}.` : '',
    allHighlights.length > 0 ? `Possui ${allHighlights.join(', ')}.` : '',
    concepts.length > 0 ? `A campanha deve explorar os conceitos de ${concepts.join(', ')}.` : '',
    imageMode ? `Uso das imagens: ${imageMode.description}` : '',
    ...commercialParts,
    `CTA: ${cta || 'Agende sua visita'}.`,
    '',
    'A campanha deve destacar primeiro o valor comercial e emocional do imóvel, depois os diferenciais reais informados.',
    'Criar uma peça visual moderna, elegante e forte para venda imobiliária.',
    'Não inventar imóvel, fachada, planta, lazer, localização, condições ou dados não informados.',
  ].filter((line) => line !== '').join('\n')
}

export default function Hero() {
  const { user } = useAuth()
  const { properties, loading } = useProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [imageModeId, setImageModeId] = useState('')
  const [propertyState, setPropertyState] = useState('')
  const [propertyStateConfirmed, setPropertyStateConfirmed] = useState(false)
  const [audienceIds, setAudienceIds] = useState([])
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [subcategoriesConfirmed, setSubcategoriesConfirmed] = useState(false)
  const [creativeConcepts, setCreativeConcepts] = useState([])
  const [creativeConceptsConfirmed, setCreativeConceptsConfirmed] = useState(false)
  const [selectedHighlights, setSelectedHighlights] = useState([])
  const [highlightsConfirmed, setHighlightsConfirmed] = useState(false)
  const [ctaChoice, setCtaChoice] = useState('')
  const [customCta, setCustomCta] = useState('')
  const [ctaConfirmed, setCtaConfirmed] = useState(false)
  const [valueConditionId, setValueConditionId] = useState('')
  const [valueConditionDetails, setValueConditionDetails] = useState('')
  const [valueConditionConfirmed, setValueConditionConfirmed] = useState(false)
  const [primaryDestinationId, setPrimaryDestinationId] = useState('')
  const [compatibleDestinationIds, setCompatibleDestinationIds] = useState([])
  const [destinationConfirmed, setDestinationConfirmed] = useState(false)
  const [deliverables, setDeliverables] = useState(buildInitialDeliverables)
  const [deliverablesConfirmed, setDeliverablesConfirmed] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [additionalConfirmed, setAdditionalConfirmed] = useState(false)
  const [resultVisible, setResultVisible] = useState(() => Boolean(readStoredHeroResult()))
  const [generationLoading, setGenerationLoading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationResult, setGenerationResult] = useState(() => readStoredHeroResult())
  const [campaignPropertyType, setCampaignPropertyType] = useState('')
  const [campaignProfile, setCampaignProfile] = useState('')
  const [campaignCity, setCampaignCity] = useState('')
  const [campaignNeighborhood, setCampaignNeighborhood] = useState('')
  const [campaignBedrooms, setCampaignBedrooms] = useState('')
  const [campaignSuites, setCampaignSuites] = useState('')
  const [campaignParkingSpaces, setCampaignParkingSpaces] = useState('')
  const [campaignArea, setCampaignArea] = useState('')
  const [campaignValue, setCampaignValue] = useState('')
  const [campaignOtherHighlight, setCampaignOtherHighlight] = useState('')
  const [campaignConditions, setCampaignConditions] = useState([])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  )
  const photos = getPhotoList(selectedProperty)
  const propertyHighlights = getHighlights(selectedProperty)
  const savedPropertyState = getPropertyState(selectedProperty)
  const profileStatus = getProfileStatus(user)
  const brandStatus = getBrandStatus(user)

  const imageMode = IMAGE_MODES.find((item) => item.id === imageModeId)
  const audiences = []
  const audienceLabels = []
  const audienceKey = audienceIds.join('|')
  const subcategories = Array.from(new Set(
    audienceIds.flatMap((id) => SUBCATEGORIES[id] || []),
  ))
  const subcategory = selectedSubcategories.join(', ')
  const selectedCta = ctaChoice || 'Agende sua visita'
  const valueCondition = VALUE_CONDITION_OPTIONS.find((item) => item.id === valueConditionId)
  const valueConditionSummary = valueConditionId === 'show_registered_price'
    ? [valueCondition?.label, campaignValue].filter(Boolean).join(' - ')
    : valueConditionId === 'commercial_terms'
      ? [valueCondition?.label, campaignConditions.join(', ')].filter(Boolean).join(' - ')
      : valueCondition?.label || ''
  const primaryDestination = DESTINATION_OPTIONS.find((item) => item.id === primaryDestinationId)
  const allCompatibleDestinations = primaryDestination
    ? DESTINATION_OPTIONS.filter((item) => primaryDestination.compatibleIds.includes(item.id))
    : []
  const compatibleDestinations = allCompatibleDestinations
  const compatibleDestinationSummary = compatibleDestinations.length > 0
    ? compatibleDestinations.map((item) => item.label).join(', ')
    : 'Nenhum uso adicional compatível nesta versão'
  const chosenDeliverables = DELIVERABLES.filter((item) => deliverables[item.id])

  const canShowImageMode = false
  const canShowPropertyState = false
  const canShowAudience = false
  const canShowConcepts = false
  const canShowSubcategory = false
  const canShowHighlights = false
  const canShowCta = false
  const canShowValueConditions = false
  const canShowDestination = false
  const canShowDeliverables = false
  const canShowAdditionalInfo = false
  const canShowSimplifiedValueConditions = false
  const canShowSimplifiedDestination = false
  const canShowChecklist = Boolean(primaryDestinationId)
  const requiresHeroPhotos = imageModeId !== 'new_image'
  const humanPrompt = useMemo(() => buildHumanPrompt({
    propertyType: campaignPropertyType,
    profile: campaignProfile,
    stage: propertyState,
    city: campaignCity,
    neighborhood: campaignNeighborhood,
    bedrooms: campaignBedrooms,
    suites: campaignSuites,
    parkingSpaces: campaignParkingSpaces,
    area: campaignArea,
    highlights: selectedHighlights,
    otherHighlight: campaignOtherHighlight,
    valueCondition,
    value: campaignValue,
    conditions: campaignConditions,
    cta: selectedCta,
    destination: primaryDestination,
    imageMode,
    concepts: creativeConcepts,
  }), [
    campaignPropertyType,
    campaignProfile,
    propertyState,
    campaignCity,
    campaignNeighborhood,
    campaignBedrooms,
    campaignSuites,
    campaignParkingSpaces,
    campaignArea,
    selectedHighlights,
    campaignOtherHighlight,
    valueCondition,
    campaignValue,
    campaignConditions,
    selectedCta,
    primaryDestination,
    imageMode,
    creativeConcepts,
  ])
  const canGenerate = Boolean(
    selectedProperty
    && (!requiresHeroPhotos || photos.length >= MIN_HERO_PHOTOS)
    && campaignPropertyType
    && campaignProfile
    && propertyState
    && campaignCity
    && campaignNeighborhood
    && imageModeId
    && (imageModeId !== 'new_image' || creativeConcepts.length > 0)
    && valueConditionId
    && selectedCta
    && primaryDestinationId
  )
  const hasCompletedHero = Boolean(generationResult?.imageUrl)

  useEffect(() => {
    if (!selectedPropertyId) return
    const master = parseMasterProperty(selectedProperty?.descricao)
    setImageModeId('')
    setPropertyState(getPropertyState(selectedProperty))
    setPropertyStateConfirmed(false)
    setAudienceIds([])
    setSelectedSubcategories([])
    setSubcategoriesConfirmed(false)
    setCreativeConcepts([])
    setCreativeConceptsConfirmed(false)
    setSelectedHighlights([])
    setHighlightsConfirmed(false)
    setCtaChoice('')
    setCustomCta('')
    setCtaConfirmed(false)
    setValueConditionId('')
    setValueConditionDetails('')
    setValueConditionConfirmed(false)
    setPrimaryDestinationId('')
    setCompatibleDestinationIds([])
    setDestinationConfirmed(false)
    setDeliverables(buildInitialDeliverables())
    setDeliverablesConfirmed(false)
    setAdditionalInfo('')
    setAdditionalConfirmed(false)
    setResultVisible(false)
    setGenerationError('')
    setGenerationResult(null)
    setCampaignPropertyType(selectedProperty?.tipo || '')
    setCampaignProfile(getMasterProfile(selectedProperty))
    setCampaignCity(normalizePlaceName(selectedProperty?.cidade || ''))
    setCampaignNeighborhood(normalizePlaceName(selectedProperty?.bairro || ''))
    setCampaignBedrooms(selectedProperty?.quartos ? String(selectedProperty.quartos) : '')
    setCampaignSuites(master?.suites ? String(master.suites) : '')
    setCampaignParkingSpaces(selectedProperty?.vagas ? String(selectedProperty.vagas) : '')
    setCampaignArea(selectedProperty?.area_m2 ? String(selectedProperty.area_m2) : '')
    setCampaignValue(selectedProperty?.preco ? formatCurrency(Number(selectedProperty.preco)) : '')
    setCampaignOtherHighlight('')
    setCampaignConditions([])
  }, [selectedPropertyId])

  useEffect(() => {
    if (!selectedPropertyId) return
    setSelectedSubcategories([])
    setSubcategoriesConfirmed(false)
    setCreativeConcepts([])
    setCreativeConceptsConfirmed(false)
    setSelectedHighlights([])
    setHighlightsConfirmed(false)
    setCtaChoice('')
    setCustomCta('')
    setCtaConfirmed(false)
    setValueConditionId('')
    setValueConditionDetails('')
    setValueConditionConfirmed(false)
    setPrimaryDestinationId('')
    setCompatibleDestinationIds([])
    setDestinationConfirmed(false)
    setDeliverablesConfirmed(false)
    setAdditionalConfirmed(false)
    setResultVisible(false)
    setGenerationError('')
    setGenerationResult(null)
  }, [audienceKey, selectedPropertyId])

  useEffect(() => {
    writeStoredHeroResult(generationResult)
  }, [generationResult])

  const toggleAudience = (audienceId) => {
    setAudienceIds((current) => (
      current.includes(audienceId)
        ? current.filter((item) => item !== audienceId)
        : [...current, audienceId]
    ))
    setResultVisible(false)
    setGenerationError('')
    setGenerationResult(null)
  }

  const toggleHighlight = (highlight) => {
    setResultVisible(false)
    setHighlightsConfirmed(false)
    setCtaConfirmed(false)
    setValueConditionConfirmed(false)
    setPrimaryDestinationId('')
    setCompatibleDestinationIds([])
    setDestinationConfirmed(false)
    setDeliverablesConfirmed(false)
    setAdditionalConfirmed(false)
    setGenerationError('')
    setGenerationResult(null)
    setSelectedHighlights((current) => (
      current.includes(highlight)
        ? current.filter((item) => item !== highlight)
        : [...current, highlight]
    ))
  }

  const toggleDeliverable = (deliverable) => {
    if (deliverable.locked) return
    setResultVisible(false)
    setGenerationError('')
    setGenerationResult(null)
    setDeliverablesConfirmed(false)
    setDeliverables((current) => ({
      ...current,
      [deliverable.id]: !current[deliverable.id],
    }))
  }

  const handleGenerate = async () => {
    if (!canGenerate || generationLoading) return

    setGenerationLoading(true)
    setGenerationError('')
    setGenerationResult(null)

    const payload = {
      property_id: selectedProperty.id,
      human_prompt: humanPrompt,
      image_mode: imageModeId,
      image_mode_label: imageMode?.label || '',
      property_state: propertyState || savedPropertyState,
      audience_ids: [],
      audiences: [],
      subcategory: creativeConcepts.join(', '),
      subcategories: creativeConcepts,
      creative_concepts: creativeConcepts,
      highlights: [...selectedHighlights, campaignOtherHighlight].filter(Boolean).slice(0, 8),
      deliverables,
      deliverable_items: chosenDeliverables.map((item) => ({ id: item.id, label: item.label })),
      cta: selectedCta,
      value_condition: {
        mode: valueConditionId,
        label: valueCondition?.label || '',
        details: campaignConditions.join(', '),
      },
      campaign_property_type: campaignPropertyType,
      campaign_profile: campaignProfile,
      campaign_city: campaignCity,
      campaign_neighborhood: campaignNeighborhood,
      campaign_features: {
        bedrooms: campaignBedrooms,
        suites: campaignSuites,
        parking_spaces: campaignParkingSpaces,
        area: campaignArea,
      },
      primary_destination: primaryDestination
        ? {
            id: primaryDestination.id,
            label: primaryDestination.label,
            format_group: primaryDestination.formatGroup,
          }
        : null,
      compatible_destinations: compatibleDestinations.map((item) => ({
        id: item.id,
        label: item.label,
        format_group: item.formatGroup,
      })),
      additional_info: '',
    }

    try {
      const { data, error } = await supabase.functions.invoke('gerar-hero-ia', { body: payload })

      if (error) {
        throw new Error(error.message || 'Não foi possível preparar o Hero IA.')
      }

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Não foi possível preparar o Hero IA.')
      }

      const imageUrl = data.image_url || data.imageUrl || ''
      if (!imageUrl) {
        throw new Error(data?.message || data?.error || 'Hero IA nao retornou a imagem gerada. Tente novamente em alguns instantes.')
      }

      const nextGenerationResult = {
        ...data,
        imageUrl,
        texts: data.texts || {},
        propertyTitle: getPropertyTitle(selectedProperty),
        imageModeLabel: imageMode?.label || '',
        audiences: audienceLabels,
        subcategory: creativeConcepts.join(', '),
        subcategories: creativeConcepts,
        creativeConcepts,
        propertyState: propertyState || savedPropertyState,
        highlights: [...selectedHighlights, campaignOtherHighlight].filter(Boolean).slice(0, 8),
        cta: selectedCta,
        valueCondition: valueConditionSummary || 'Não informado',
        primaryDestination: primaryDestination?.label || '',
        compatibleDestinations: compatibleDestinations.map((item) => item.label),
        deliverables: chosenDeliverables.map((item) => item.label),
        additionalInfo: '',
        humanPrompt,
      }
      setGenerationResult(nextGenerationResult)
      setResultVisible(true)
    } catch (error) {
      setResultVisible(false)
      setGenerationError(error instanceof Error ? error.message : 'Não foi possível preparar o Hero IA.')
    } finally {
      setGenerationLoading(false)
    }
  }

  return (
    <div>
      <Header title="Hero IA" subtitle="Crie uma imagem premium de impacto para divulgar seu imóvel." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à Home
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl bg-gray-950 p-6 text-white shadow-xl shadow-gray-950/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Smart Prompt Engine
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Hero IA
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300">
                Um assistente guiado monta o briefing visual e gera uma imagem principal premium para divulgar seu imóvel.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-gray-300">Fluxo seguro</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-200">
                Você responde passo a passo. O sistema transforma o briefing em uma entrega visual pronta para uso.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : properties.length === 0 ? (
          <EmptyPropertyState />
        ) : hasCompletedHero ? (
          <HeroWowResult
            generationResult={generationResult}
            onGenerateAnother={() => {
              setResultVisible(false)
              setGenerationResult(null)
              setGenerationError('')
            }}
          />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
            <div className="space-y-5">
              <AssistantStep number="Imóvel" message="Ótimo. Qual imóvel deseja utilizar?">
                <div className="grid gap-3 md:grid-cols-2">
                  {properties.map((property) => {
                    const propertyPhotos = getPhotoList(property)
                    const active = selectedPropertyId === property.id
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => setSelectedPropertyId(property.id)}
                        className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
                          active ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="aspect-[4/3] bg-gray-100">
                          {propertyPhotos[0] ? (
                            <img src={propertyPhotos[0]} alt={getPropertyTitle(property)} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center text-gray-400">
                              <Image className="h-8 w-8" />
                              <span className="mt-2 text-xs font-bold">Sem foto</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-950">{getPropertyTitle(property)}</p>
                              <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {getLocation(property)}
                              </p>
                            </div>
                            {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />}
                          </div>
                          <p className="mt-3 text-xs font-bold text-gray-500">
                            {propertyPhotos.length} foto{propertyPhotos.length === 1 ? '' : 's'} disponível{propertyPhotos.length === 1 ? '' : 'is'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </AssistantStep>

              {selectedProperty && (
                <UserReply>
                  <strong>{getPropertyTitle(selectedProperty)}</strong>
                  <span>{getLocation(selectedProperty)}</span>
                </UserReply>
              )}

              {selectedProperty && (
                <AssistantStep number={1} message="Que tipo de imóvel deseja anunciar?">
                  <ChipGrid>
                    {SALE_PROPERTY_TYPES.map((item) => (
                      <ChipButton
                        key={item}
                        active={campaignPropertyType === item}
                        onClick={() => {
                          setCampaignPropertyType(item)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {campaignPropertyType && (
                <AssistantStep number={2} message="Qual o perfil do imóvel?">
                  <ChipGrid>
                    {SALE_PROFILES.map((item) => (
                      <ChipButton
                        key={item}
                        active={campaignProfile === item}
                        onClick={() => {
                          setCampaignProfile(item)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {campaignProfile && (
                <AssistantStep number={3} message="Qual o estágio do imóvel?">
                  <ChipGrid>
                    {SALE_STAGES.map((item) => (
                      <ChipButton
                        key={item}
                        active={propertyState === item}
                        onClick={() => {
                          setPropertyState(item)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {propertyState && (
                <AssistantStep number={4} message="Onde está localizado?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-black text-gray-950">Cidade</span>
                      <input
                        value={campaignCity}
                        onChange={(event) => setCampaignCity(event.target.value)}
                        onBlur={() => setCampaignCity((value) => normalizePlaceName(value))}
                        placeholder="Ex: São Paulo"
                        className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-black text-gray-950">Bairro</span>
                      <input
                        value={campaignNeighborhood}
                        onChange={(event) => setCampaignNeighborhood(event.target.value)}
                        onBlur={() => setCampaignNeighborhood((value) => normalizePlaceName(value))}
                        placeholder="Ex: Moema"
                        className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                  </div>
                </AssistantStep>
              )}

              {campaignCity && campaignNeighborhood && (
                <AssistantStep number={5} message="Quais são as características principais?">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ['Dormitórios', campaignBedrooms, setCampaignBedrooms],
                      ['Suítes', campaignSuites, setCampaignSuites],
                      ['Vagas', campaignParkingSpaces, setCampaignParkingSpaces],
                      ['Área em m²', campaignArea, setCampaignArea],
                    ].map(([label, value, setter]) => (
                      <label key={label} className="block">
                        <span className="text-sm font-black text-gray-950">{label}</span>
                        <input
                          value={value}
                          onChange={(event) => setter(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                          inputMode="numeric"
                          className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        />
                      </label>
                    ))}
                  </div>
                </AssistantStep>
              )}

              {campaignCity && campaignNeighborhood && (
                <AssistantStep number={6} message="O que deseja destacar?">
                  <ChipGrid>
                    {SALE_HIGHLIGHTS.map((item) => (
                      <ChipButton
                        key={item}
                        active={selectedHighlights.includes(item)}
                        onClick={() => toggleHighlight(item)}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  <label className="mt-4 block">
                    <span className="text-sm font-black text-gray-950">Outro diferencial</span>
                    <input
                      value={campaignOtherHighlight}
                      onChange={(event) => setCampaignOtherHighlight(event.target.value.slice(0, 70))}
                      placeholder="Ex: acabamento sofisticado"
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                </AssistantStep>
              )}

              {campaignCity && campaignNeighborhood && (
                <AssistantStep number={7} message="Quais condições comerciais deseja usar?">
                  <OptionGrid>
                    {VALUE_CONDITION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={valueConditionId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description={item.id === 'show_registered_price' ? 'Usa o valor informado abaixo.' : item.id === 'commercial_terms' ? 'Mostra apenas condições, sem preço.' : 'A campanha não destaca preço.'}
                        onClick={() => {
                          setValueConditionId(item.id)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      />
                    ))}
                  </OptionGrid>
                  {valueConditionId === 'show_registered_price' && (
                    <label className="mt-4 block">
                      <span className="text-sm font-black text-gray-950">Valor</span>
                      <input
                        value={campaignValue}
                        onChange={(event) => setCampaignValue(event.target.value.slice(0, 40))}
                        placeholder="Ex: R$ 1.790.000"
                        className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                  )}
                  {valueConditionId === 'commercial_terms' && (
                    <div className="mt-4">
                      <ChipGrid>
                        {SALE_CONDITIONS.map((item) => (
                          <ChipButton
                            key={item}
                            active={campaignConditions.includes(item)}
                            onClick={() => {
                              setCampaignConditions((current) => (
                                current.includes(item)
                                  ? current.filter((condition) => condition !== item)
                                  : [...current, item]
                              ))
                            }}
                          >
                            {item}
                          </ChipButton>
                        ))}
                      </ChipGrid>
                    </div>
                  )}
                </AssistantStep>
              )}

              {valueConditionId && (
                <AssistantStep number={8} message="Qual CTA deseja usar?">
                  <ChipGrid>
                    {SALE_CTA_OPTIONS.map((item) => (
                      <ChipButton
                        key={item}
                        active={selectedCta === item}
                        onClick={() => {
                          setCtaChoice(item)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {selectedCta && valueConditionId && (
                <AssistantStep number={9} message="Como deseja usar as fotos?">
                  <OptionGrid>
                    {IMAGE_MODES.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={imageModeId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description={item.description}
                        onClick={() => {
                          setImageModeId(item.id)
                          setCreativeConcepts([])
                          setPrimaryDestinationId('')
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {imageModeId === 'new_image' && (
                <AssistantStep number="9.1" message="Quais conceitos deseja explorar?">
                  <ChipGrid>
                    {CREATIVE_CONCEPTS.map((item) => (
                      <ChipButton
                        key={item}
                        active={creativeConcepts.includes(item)}
                        onClick={() => {
                          setCreativeConcepts((current) => (
                            current.includes(item)
                              ? current.filter((concept) => concept !== item)
                              : [...current, item]
                          ))
                          setPrimaryDestinationId('')
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {CREATIVE_CONCEPT_ICONS[item]} {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {imageModeId && (imageModeId !== 'new_image' || creativeConcepts.length > 0) && (
                <AssistantStep number={10} message="Onde você pretende usar esta peça?">
                  <OptionGrid>
                    {DESTINATION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={primaryDestinationId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description={
                          item.compatibleIds.length > 0
                            ? `Também pode funcionar em ${DESTINATION_OPTIONS.filter((dest) => item.compatibleIds.includes(dest.id)).map((dest) => dest.label).join(', ')}.`
                            : 'Este destino pede uma peça própria.'
                        }
                        onClick={() => {
                          setPrimaryDestinationId(item.id)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {canShowImageMode && (
                <AssistantStep number={1} message="Como deseja criar a campanha?">
                  <OptionGrid>
                    {IMAGE_MODES.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={imageModeId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description={item.description}
                        onClick={() => {
                          setImageModeId(item.id)
                          setPropertyStateConfirmed(false)
                          setAudienceIds([])
                          setSelectedSubcategories([])
                          setSubcategoriesConfirmed(false)
                          setCreativeConcepts([])
                          setCreativeConceptsConfirmed(false)
                          setSelectedHighlights([])
                          setHighlightsConfirmed(false)
                          setCtaChoice('')
                          setCustomCta('')
                          setCtaConfirmed(false)
                          setValueConditionId('')
                          setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setPrimaryDestinationId('')
                          setCompatibleDestinationIds([])
                          setDestinationConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {false && imageMode && (
                <UserReply>
                  <strong>{imageMode.label}</strong>
                  <span>{imageMode.description}</span>
                </UserReply>
              )}

              {false && imageModeId === 'new_image' && (
                <AssistantStep number="1.1" message="Quais conceitos deseja explorar?">
                  <p className="mb-4 text-sm font-semibold leading-relaxed text-gray-500">
                    Escolha uma ou mais direções para esta campanha. Elas não entram no Cadastro Mestre e podem mudar a cada geração.
                  </p>
                  <ChipGrid>
                    {CREATIVE_CONCEPTS.map((item) => (
                      <ChipButton
                        key={item}
                        active={creativeConcepts.includes(item)}
                        onClick={() => {
                          setCreativeConcepts((current) => (
                            current.includes(item)
                              ? current.filter((concept) => concept !== item)
                              : [...current, item]
                          ))
                          setValueConditionId('')
                          setPrimaryDestinationId('')
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      >
                        {CREATIVE_CONCEPT_ICONS[item]} {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {canShowSimplifiedValueConditions && (
                <AssistantStep number={2} message="Deseja divulgar valores e condições?">
                  <OptionGrid>
                    {VALUE_CONDITION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={valueConditionId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description="O Cadastro Mestre continua sendo a base da campanha."
                        onClick={() => {
                          setValueConditionId(item.id)
                          setValueConditionDetails('')
                          setPrimaryDestinationId('')
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {false && valueConditionId && (
                <UserReply>
                  <strong>{valueCondition?.label}</strong>
                  <span>Regra de valores definida para esta geração.</span>
                </UserReply>
              )}

              {canShowSimplifiedDestination && (
                <AssistantStep number={3} message="Onde você pretende utilizar esta peça?">
                  <OptionGrid>
                    {DESTINATION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={primaryDestinationId === item.id}
                        title={`${item.icon} ${item.label}`}
                        description={
                          item.compatibleIds.length > 0
                            ? `Também pode funcionar em ${DESTINATION_OPTIONS.filter((dest) => item.compatibleIds.includes(dest.id)).map((dest) => dest.label).join(', ')}.`
                            : 'Este destino pede uma peça própria.'
                        }
                        onClick={() => {
                          setPrimaryDestinationId(item.id)
                          setResultVisible(false)
                          setGenerationError('')
                          setGenerationResult(null)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {false && primaryDestination && (
                <UserReply>
                  <strong>{primaryDestination.label}</strong>
                  <span>{compatibleDestinations.length > 0 ? `Também poderá ser usado em: ${compatibleDestinationSummary}.` : 'Destino principal definido para esta campanha.'}</span>
                </UserReply>
              )}

              {canShowPropertyState && (
                <AssistantStep number={3} message="Qual é o estado atual do imóvel?">
                  {savedPropertyState && (
                    <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                      Cadastro Mestre sugeriu: {savedPropertyState}. Confirme ou escolha outra opção.
                    </div>
                  )}
                  <ChipGrid>
                    {PROPERTY_STATES.map((item) => (
                      <ChipButton
                        key={item}
                        active={propertyState === item}
                        onClick={() => {
                          setPropertyState(item)
                          setPropertyStateConfirmed(true)
                          setAudienceIds([])
                          setSelectedSubcategories([])
                          setSubcategoriesConfirmed(false)
                          setCreativeConcepts([])
                          setCreativeConceptsConfirmed(false)
                          setSelectedHighlights([])
                          setHighlightsConfirmed(false)
                          setCtaChoice('')
                          setCustomCta('')
                          setCtaConfirmed(false)
                          setValueConditionId('')
                          setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setPrimaryDestinationId('')
                          setCompatibleDestinationIds([])
                          setDestinationConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {canShowPropertyState && propertyStateConfirmed && (
                <UserReply>
                  <strong>{propertyState}</strong>
                  <span>Estado do imóvel confirmado para orientar a criação visual.</span>
                </UserReply>
              )}

              {canShowAudience && (
                <AssistantStep number={4} message="Quem você deseja atingir?">
                  <p className="mb-4 text-sm font-semibold leading-relaxed text-gray-500">
                    Você pode escolher mais de uma opção. Isso ajuda a IA a entender melhor o público e o objetivo da peça.
                  </p>
                  <ChipGrid>
                    {AUDIENCES.map((item) => (
                      <ChipButton
                        key={item.id}
                        active={audienceIds.includes(item.id)}
                        onClick={() => toggleAudience(item.id)}
                      >
                        {item.label}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {audienceIds.length > 0 && (
                <UserReply>
                  <strong>{audienceLabels.join(', ')}</strong>
                  <span>Públicos escolhidos para orientar tom visual, objetivo e argumentos.</span>
                </UserReply>
              )}

              {canShowConcepts && (
                <AssistantStep number={5} message="Que conceito deseja explorar?">
                  <p className="mb-4 text-sm font-semibold leading-relaxed text-gray-500">
                    Escolha uma ou mais direções criativas para o Diretor Criativo IA.
                  </p>
                  <ChipGrid>
                    {CREATIVE_CONCEPTS.map((item) => (
                      <ChipButton
                        key={item}
                        active={creativeConcepts.includes(item)}
                        onClick={() => {
                          setCreativeConcepts((current) => (
                            current.includes(item)
                              ? current.filter((concept) => concept !== item)
                              : [...current, item]
                          ))
                          setCreativeConceptsConfirmed(false)
                          setSelectedSubcategories([])
                          setSubcategoriesConfirmed(false)
                          setSelectedHighlights([])
                          setHighlightsConfirmed(false)
                          setCtaChoice('')
                          setCustomCta('')
                          setCtaConfirmed(false)
                          setValueConditionId('')
                          setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setCreativeConceptsConfirmed(true)} disabled={creativeConcepts.length === 0} variant="secondary">
                      Confirmar conceitos
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {creativeConceptsConfirmed && creativeConcepts.length > 0 && (
                <UserReply>
                  <strong>{creativeConcepts.join(', ')}</strong>
                  <span>Conceitos escolhidos para orientar a campanha visual.</span>
                </UserReply>
              )}

              {canShowSubcategory && (
                <AssistantStep number={imageModeId === 'new_image' ? 6 : 5} message="Quais focos fazem mais sentido para esta peça?">
                  <ChipGrid>
                    {subcategories.map((item) => (
                      <ChipButton
                        key={item}
                        active={selectedSubcategories.includes(item)}
                        onClick={() => {
                          setSelectedSubcategories((current) => (
                            current.includes(item)
                              ? current.filter((focus) => focus !== item)
                              : [...current, item]
                          ))
                          setSubcategoriesConfirmed(false)
                          setSelectedHighlights([])
                          setHighlightsConfirmed(false)
                          setCtaChoice('')
                          setCustomCta('')
                          setCtaConfirmed(false)
                          setValueConditionId('')
                          setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setSubcategoriesConfirmed(true)} disabled={selectedSubcategories.length === 0} variant="secondary">
                      Confirmar focos
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {subcategoriesConfirmed && subcategory && (
                <UserReply>
                  <strong>{subcategory}</strong>
                  <span>Focos selecionados.</span>
                </UserReply>
              )}

              {canShowHighlights && (
                <AssistantStep number={imageModeId === 'new_image' ? 7 : 6} message="O que deseja destacar?">
                  {propertyHighlights.length > 0 ? (
                    <>
                      <ChipGrid>
                        {propertyHighlights.map((highlight) => (
                          <ChipButton
                            key={highlight}
                            active={selectedHighlights.includes(highlight)}
                            onClick={() => toggleHighlight(highlight)}
                          >
                            {highlight}
                          </ChipButton>
                        ))}
                      </ChipGrid>
                      <div className="mt-4 flex justify-end">
                        <Button type="button" onClick={() => setHighlightsConfirmed(true)} variant="secondary">
                          Confirmar destaques
                        </Button>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-gray-500">
                        Você pode selecionar mais de uma opção. Elas orientam o briefing e não precisam aparecer literalmente na imagem.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-600">Este imóvel ainda não tem destaques cadastrados.</p>
                      <Button type="button" onClick={() => setHighlightsConfirmed(true)} variant="secondary" className="mt-3">
                        Continuar sem destaques
                      </Button>
                    </div>
                  )}
                </AssistantStep>
              )}

              {highlightsConfirmed && (
                <UserReply>
                  <strong>{selectedHighlights.length > 0 ? `${selectedHighlights.length} destaque(s)` : 'Sem destaque adicional'}</strong>
                  <span>{selectedHighlights.length > 0 ? selectedHighlights.join(', ') : 'Vamos seguir apenas com os dados principais do imóvel.'}</span>
                </UserReply>
              )}

              {canShowCta && (
                <AssistantStep number={imageModeId === 'new_image' ? 8 : 7} message="Qual chamada deseja usar?">
                  <ChipGrid>
                    {CTA_OPTIONS.map((item) => (
                      <ChipButton
                        key={item}
                        active={ctaChoice === item && !customCta.trim()}
                        onClick={() => {
                          setCtaChoice(item)
                          setCustomCta('')
                          setCtaConfirmed(false)
                          setValueConditionId('')
                          setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  <label className="mt-4 block">
                    <span className="text-sm font-black text-gray-950">Outro CTA</span>
                    <input
                      value={customCta}
                      onChange={(event) => {
                        setCustomCta(event.target.value.slice(0, 80))
                        setCtaConfirmed(false)
                        setValueConditionId('')
                        setValueConditionDetails('')
                        setValueConditionConfirmed(false)
                        setPrimaryDestinationId('')
                        setCompatibleDestinationIds([])
                        setDestinationConfirmed(false)
                        setDeliverablesConfirmed(false)
                        setAdditionalConfirmed(false)
                        setResultVisible(false)
                      }}
                      placeholder="Ex: Quero conhecer este imóvel"
                      className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setCtaConfirmed(true)} disabled={!selectedCta} variant="secondary">
                      Confirmar CTA
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {ctaConfirmed && (
                <UserReply>
                  <strong>{selectedCta}</strong>
                  <span>Chamada escolhida para orientar a peça e os textos do pacote.</span>
                </UserReply>
              )}

              {canShowValueConditions && (
                <AssistantStep number={imageModeId === 'new_image' ? 9 : 8} message="Deseja divulgar valores ou condições?">
                  <OptionGrid>
                    {VALUE_CONDITION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={valueConditionId === item.id}
                        title={item.label}
                        description={item.needsDetails ? 'Use o campo abaixo para orientar a criação.' : 'O briefing seguirá com essa regra.'}
                        onClick={() => {
                          setValueConditionId(item.id)
                          if (!item.needsDetails) setValueConditionDetails('')
                          setValueConditionConfirmed(false)
                          setPrimaryDestinationId('')
                          setCompatibleDestinationIds([])
                          setDestinationConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      />
                    ))}
                  </OptionGrid>
                  {valueCondition?.needsDetails && (
                    <label className="mt-4 block">
                      <span className="text-sm font-black text-gray-950">Detalhes opcionais</span>
                      <textarea
                        value={valueConditionDetails}
                        onChange={(event) => {
                          setValueConditionDetails(event.target.value.slice(0, 280))
                          setValueConditionConfirmed(false)
                          setPrimaryDestinationId('')
                          setCompatibleDestinationIds([])
                          setDestinationConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                        rows={3}
                        placeholder="Ex: unidades de 27m² a 35m², entrada a partir de R$ 500, fluxo direto com a construtora..."
                        className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setValueConditionConfirmed(true)} disabled={!valueConditionId} variant="secondary">
                      Confirmar valores e condições
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {valueConditionConfirmed && (
                <UserReply>
                  <strong>{valueCondition?.label || 'Valores e condições definidos'}</strong>
                  <span>{valueConditionDetails.trim() || 'Sem observação adicional sobre valores ou condições.'}</span>
                </UserReply>
              )}

              {canShowDestination && (
                <AssistantStep number={imageModeId === 'new_image' ? 10 : 9} message="Onde você pretende usar esta imagem?">
                  <p className="mb-4 text-sm font-semibold leading-relaxed text-gray-500">
                    Escolha o destino principal. Ele define o formato principal da imagem.
                  </p>
                  <OptionGrid>
                    {DESTINATION_OPTIONS.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={primaryDestinationId === item.id}
                        title={item.label}
                        description={
                          item.compatibleIds.length > 0
                            ? `Também compatível com ${DESTINATION_OPTIONS.filter((dest) => item.compatibleIds.includes(dest.id)).map((dest) => dest.label).join(', ')}.`
                            : 'Este destino pede uma versão própria otimizada.'
                        }
                        onClick={() => {
                          setPrimaryDestinationId(item.id)
                          setCompatibleDestinationIds(item.compatibleIds)
                          setDestinationConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      />
                    ))}
                  </OptionGrid>
                  {primaryDestination && (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-gray-400">Destinos compatíveis</p>
                      {allCompatibleDestinations.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {allCompatibleDestinations.map((item) => (
                            <ChipButton
                              key={item.id}
                              active={compatibleDestinationIds.includes(item.id)}
                              onClick={() => {
                                setCompatibleDestinationIds((current) => (
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id]
                                ))
                                setDestinationConfirmed(false)
                                setDeliverablesConfirmed(false)
                                setAdditionalConfirmed(false)
                                setResultVisible(false)
                              }}
                            >
                              {item.label}
                            </ChipButton>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-bold text-gray-700">{compatibleDestinationSummary}</p>
                      )}
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-500">
                        Formatos diferentes poderão virar novas versões otimizadas depois.
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setDestinationConfirmed(true)} disabled={!primaryDestinationId} variant="secondary">
                      Confirmar destino
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {destinationConfirmed && (
                <UserReply>
                  <strong>{primaryDestination?.label}</strong>
                  <span>{compatibleDestinations.length > 0 ? `Também poderá ser usado em: ${compatibleDestinationSummary}.` : 'Sem uso adicional compatível nesta versão.'}</span>
                </UserReply>
              )}

              {canShowDeliverables && (
                <AssistantStep number={imageModeId === 'new_image' ? 11 : 10} message="O que deseja receber junto?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {DELIVERABLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleDeliverable(item)}
                        className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                          deliverables[item.id] ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <span className="text-sm font-black">{item.label}</span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          deliverables[item.id] ? 'border-amber-300 bg-amber-300 text-gray-950' : 'border-gray-300'
                        }`}>
                          {deliverables[item.id] && <Check className="h-4 w-4" />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setDeliverablesConfirmed(true)} variant="secondary">
                      Confirmar pacote
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {deliverablesConfirmed && (
                <UserReply>
                  <strong>{chosenDeliverables.length} item(ns) no pacote</strong>
                  <span>{chosenDeliverables.map((item) => item.label).join(', ')}</span>
                </UserReply>
              )}

              {canShowAdditionalInfo && (
                <AssistantStep number={imageModeId === 'new_image' ? 12 : 11} message="Deseja acrescentar algo?">
                  <label className="block">
                    <span className="text-sm font-black text-gray-950">Existe algum detalhe importante que não perguntamos?</span>
                    <textarea
                      value={additionalInfo}
                      onChange={(event) => {
                        setAdditionalInfo(event.target.value.slice(0, 400))
                        setAdditionalConfirmed(false)
                        setResultVisible(false)
                      }}
                      rows={4}
                      placeholder="Ex: valorizar a sala integrada, criar uma atmosfera mais sofisticada, evitar excesso de texto..."
                      className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                    <span className="mt-1 block text-right text-xs font-semibold text-gray-400">{additionalInfo.length}/400</span>
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setAdditionalConfirmed(true)} variant="secondary">
                      Continuar
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {additionalConfirmed && (
                <UserReply>
                  <strong>{additionalInfo.trim() ? 'Orientação adicionada' : 'Sem orientação adicional'}</strong>
                  <span>{additionalInfo.trim() || 'O assistente seguirá com o briefing guiado.'}</span>
                </UserReply>
              )}

              {canShowChecklist && (
                <AssistantStep number="Resumo" message="Confira a campanha antes de gerar.">
                  <Checklist
                    property={selectedProperty}
                    imageMode={imageMode}
                    propertyState={propertyState}
                    audiences={audiences}
                    creativeConcepts={creativeConcepts}
                    subcategory={subcategory}
                    highlights={selectedHighlights}
                    cta={selectedCta}
                    valueConditionSummary={valueConditionSummary}
                    primaryDestination={primaryDestination}
                    compatibleDestinations={compatibleDestinations}
                    additionalInfo={additionalInfo}
                    deliverables={chosenDeliverables}
                    humanPrompt={humanPrompt}
                    photos={photos}
                    requiresPhotos={requiresHeroPhotos}
                    canGenerate={canGenerate}
                    generationLoading={generationLoading}
                    generationError={generationError}
                    onGenerate={handleGenerate}
                  />
                </AssistantStep>
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <ReadinessCard
                selectedProperty={selectedProperty}
                photoCount={photos.length}
                requiresPhotos={requiresHeroPhotos}
                profileStatus={profileStatus}
                brandStatus={brandStatus}
              />
              <ResultPanel
                visible={resultVisible}
                primaryDestination={primaryDestination}
                compatibleDestinations={compatibleDestinations}
                generationResult={generationResult}
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function HeroWowResult({ generationResult, onGenerateAnother }) {
  const compatibleDestinations = Array.isArray(generationResult.compatibleDestinations)
    ? generationResult.compatibleDestinations
    : []
  const deliverables = Array.isArray(generationResult.deliverables)
    ? generationResult.deliverables
    : []
  const generatedTexts = generationResult.texts && typeof generationResult.texts === 'object'
    ? generationResult.texts
    : {}
  const briefingItems = [
    ['Imóvel', generationResult.propertyTitle],
    ['Público-alvo', Array.isArray(generationResult.audiences) ? generationResult.audiences.join(', ') : 'Não informado'],
    ...(Array.isArray(generationResult.creativeConcepts) && generationResult.creativeConcepts.length > 0
      ? [['Conceitos', generationResult.creativeConcepts.join(', ')]]
      : []),
    ['Focos', generationResult.subcategory || 'Não informado'],
    ['CTA', generationResult.cta || 'Não informado'],
    ['Destino principal', generationResult.primaryDestination || 'Não informado'],
    ['Destinos compatíveis', compatibleDestinations.length > 0 ? compatibleDestinations.join(', ') : 'Nenhum uso adicional nesta versão'],
  ]

  const textBlocks = [
    { key: 'instagram', title: 'Texto Instagram', content: generatedTexts.instagram },
    { key: 'whatsapp', title: 'WhatsApp', content: generatedTexts.whatsapp },
    { key: 'cta', title: 'CTA', content: generatedTexts.cta },
    { key: 'portal', title: 'Descrição Portal', content: generatedTexts.portal },
    { key: 'hashtags', title: 'Hashtags', content: generatedTexts.hashtags },
  ]
  const textFileContent = textBlocks
    .map((item) => `${item.title}\r\n${item.content || 'Texto não retornado.'}`)
    .join('\r\n\r\n')

  const handleDownloadTexts = () => {
    const blob = new Blob([textFileContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'hero-ia-textos.txt'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDownloadHeroImage = () => {
    downloadImageFile(generationResult.imageUrl, 'smartcorretorai-hero-ia.png')
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="overflow-hidden rounded-[2rem] bg-gray-950 text-white shadow-2xl shadow-gray-950/20">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="bg-gray-950">
            <div className="aspect-square lg:aspect-[5/4]">
              <img
                src={generationResult.imageUrl}
                alt="Hero IA criado"
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Entrega concluída
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
              Hero IA criado com sucesso
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-300">
              Sua imagem principal está pronta para publicação.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href={generationResult.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-gray-950 transition hover:bg-gray-100"
              >
                <Image className="h-4 w-4" />
                Visualizar
              </a>
              <button
                type="button"
                onClick={handleDownloadHeroImage}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={handleDownloadTexts}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 sm:col-span-2"
              >
                <Download className="h-4 w-4" />
                Baixar textos
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-100">Pacote selecionado</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-200">
                {deliverables.length > 0 ? deliverables.join(', ') : 'Hero IA'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Briefing usado</p>
          <h3 className="mt-1 text-xl font-black text-gray-950">Resumo do resultado</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {briefingItems.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 text-sm font-black leading-relaxed text-gray-950">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Textos do pacote</p>
          <h3 className="mt-1 text-xl font-black text-gray-950">Textos prontos para copiar ou baixar</h3>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {textBlocks.map((item) => (
              <TextDeliveryBlock key={item.key} title={item.title} content={item.content} />
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">Próximas ações</p>
        <h3 className="mt-1 text-xl font-black text-gray-950">O que deseja fazer agora?</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {['Criar Story', 'Criar Campanha IA', 'Criar Landing IA', 'Criar Vídeo IA'].map((action) => (
            <button
              key={action}
              type="button"
              disabled
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-black text-gray-400"
            >
              {action}
            </button>
          ))}
          <button
            type="button"
            onClick={onGenerateAnother}
            className="rounded-2xl bg-gray-950 px-4 py-4 text-sm font-black text-white transition hover:bg-gray-800"
          >
            Gerar outro Hero
          </button>
        </div>
      </section>
    </section>
  )
}

function TextDeliveryBlock({ title, content }) {
  const [copied, setCopied] = useState(false)
  const displayContent = String(content || '').trim() || 'Texto não retornado. Gere novamente para atualizar este bloco.'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard can be unavailable in restricted browser contexts.
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-gray-950">{title}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-700 transition hover:border-gray-300"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-3 min-h-16 whitespace-pre-line rounded-2xl bg-white p-3 text-sm font-semibold leading-relaxed text-gray-700">
        {displayContent}
      </p>
    </div>
  )
}

function AssistantStep({ number, message, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-amber-300">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-gray-400">Assistente Hero IA</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-gray-950">{message}</h2>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function UserReply({ children }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl rounded-3xl bg-gray-950 px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

function OptionGrid({ children }) {
  return <div className="grid gap-3 md:grid-cols-3">{children}</div>
}

function ChipGrid({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function ChoiceButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <p className={`text-sm font-black ${active ? 'text-white' : 'text-gray-950'}`}>{title}</p>
      <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-gray-300' : 'text-gray-500'}`}>{description}</p>
    </button>
  )
}

function ChipButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition ${
        active
          ? 'border-gray-950 bg-gray-950 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

function Checklist({ property, imageMode, propertyState, audiences, creativeConcepts, subcategory, highlights, cta, valueConditionSummary, primaryDestination, compatibleDestinations, additionalInfo, deliverables, humanPrompt, photos, requiresPhotos, canGenerate, generationLoading, generationError, onGenerate }) {
  const creativeConceptSummary = Array.isArray(creativeConcepts) && creativeConcepts.length > 0
    ? creativeConcepts.join(', ')
    : 'Não se aplica'
  const compatibleDestinationSummary = Array.isArray(compatibleDestinations) && compatibleDestinations.length > 0
    ? compatibleDestinations.map((item) => item.label).join(', ')
    : 'Nenhum uso adicional compatível nesta versão'
  const rows = [
    ['Imóvel', getPropertyTitle(property)],
    ['Modo de criação', imageMode?.label || 'Não informado'],
    ['Conceitos selecionados', creativeConceptSummary],
    ['Regra de valores', valueConditionSummary || 'Não informado'],
    ['Destino da campanha', primaryDestination?.label || 'Não informado'],
    ['Usos compatíveis', compatibleDestinationSummary],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-sm font-black leading-relaxed text-gray-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">Prompt Humano</p>
        <p className="mt-3 whitespace-pre-line rounded-2xl bg-white p-4 text-sm font-semibold leading-relaxed text-gray-800">
          {humanPrompt}
        </p>
      </div>

      {requiresPhotos && photos.length < MIN_HERO_PHOTOS && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Este imóvel tem {photos.length} foto{photos.length === 1 ? '' : 's'}. Adicione pelo menos {MIN_HERO_PHOTOS} fotos no Cadastro Mestre antes da geração real.
        </div>
      )}

      {!requiresPhotos && photos.length === 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Geração livre ativada: este teste usará apenas o Prompt Humano, sem foto de referência.
        </div>
      )}

      {generationError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {generationError}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-gray-950">Pronto para gerar sua campanha?</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            O Cadastro Mestre será usado como briefing principal.
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={!canGenerate} loading={generationLoading} className="justify-center">
          <Wand2 className="h-4 w-4" />
          {generationLoading ? 'Gerando campanha...' : 'Gerar campanha'}
        </Button>
      </div>
    </div>
  )
}

function ReadinessCard({ selectedProperty, photoCount, requiresPhotos, profileStatus, brandStatus }) {
  const items = [
    {
      label: 'Imóvel selecionado',
      ok: Boolean(selectedProperty),
      hint: selectedProperty ? getPropertyTitle(selectedProperty) : 'Escolha um Cadastro Mestre.',
    },
    {
      label: 'Fotos do imóvel',
      ok: !requiresPhotos || photoCount >= MIN_HERO_PHOTOS,
      hint: requiresPhotos
        ? `${photoCount}/${MIN_HERO_PHOTOS} mínimas para criar o Hero IA.`
        : photoCount > 0
          ? `${photoCount} foto${photoCount === 1 ? '' : 's'} disponível${photoCount === 1 ? '' : 'is'}, mas este modo pode gerar sem referência.`
          : 'Geração livre por Prompt Humano não exige foto neste teste.',
    },
    {
      label: 'Perfil Comercial',
      ok: profileStatus.complete,
      hint: profileStatus.complete ? 'Completo.' : `${profileStatus.completed}/${profileStatus.total} campos essenciais preenchidos.`,
      to: '/configuracoes?tab=perfil',
    },
    {
      label: 'Marca',
      ok: brandStatus.hasBrandName || brandStatus.hasLogo,
      hint: brandStatus.hasBrandName || brandStatus.hasLogo ? 'Marca disponível.' : 'Opcional, mas melhora consistência visual.',
      to: '/configuracoes?tab=perfil',
    },
  ]

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Prontidão</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">Checklist do Hero IA</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-gray-50 p-3">
            <div className="flex items-start gap-3">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-950">{item.label}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{item.hint}</p>
                {item.to && !item.ok && (
                  <Link to={item.to} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-800">
                    Completar perfil
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ResultPanel({ visible, primaryDestination, compatibleDestinations, generationResult }) {
  const isPrepared = visible && generationResult
  const compatibleDestinationSummary = Array.isArray(compatibleDestinations) && compatibleDestinations.length > 0
    ? compatibleDestinations.map((item) => item.label).join(', ')
    : ''
  const preparedCompatibleSummary = Array.isArray(generationResult?.compatibleDestinations) && generationResult.compatibleDestinations.length > 0
    ? generationResult.compatibleDestinations.join(', ')
    : ''

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resultado</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">{generationResult?.imageUrl ? 'Hero IA gerado' : isPrepared ? 'Hero IA preparado' : 'Hero IA em preparação'}</h2>
      <div className="mt-4 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
        <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden p-6 text-center">
          {generationResult?.imageUrl && (
            <img
              src={generationResult.imageUrl}
              alt="Hero IA gerado"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className={`${generationResult?.imageUrl ? 'hidden' : 'flex'} h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm`}>
            <Sparkles className="h-7 w-7" />
          </div>
          <p className={`${generationResult?.imageUrl ? 'hidden' : 'block'} mt-4 text-sm font-black text-gray-950`}>
            {isPrepared ? 'Briefing salvo com sucesso' : visible ? 'Hero IA em preparação' : 'O resultado aparecerá aqui'}
          </p>
          <p className={`${generationResult?.imageUrl ? 'hidden' : 'block'} mt-2 max-w-xs text-xs font-semibold leading-relaxed text-gray-500`}>
            {visible
              ? generationResult?.message || 'Sua imagem principal está pronta.'
              : 'Nenhuma imagem real será simulada e nenhum Smart Token será consumido nesta etapa.'}
          </p>
          {visible && primaryDestination && (
            <div className="relative z-10 mt-4 rounded-2xl bg-white/95 px-4 py-3 text-left shadow-sm">
              <p className="text-xs font-black text-gray-950">
                Seu Hero Principal será preparado para: {generationResult?.primaryDestination || primaryDestination.label}
              </p>
              {(preparedCompatibleSummary || compatibleDestinationSummary) && (
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Também poderá ser usado em: {preparedCompatibleSummary || compatibleDestinationSummary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {isPrepared && (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-950">Resumo inteligente do briefing</p>
          <div className="mt-3 space-y-2 text-xs font-semibold leading-relaxed text-emerald-900">
            <p><strong>Imóvel:</strong> {generationResult.propertyTitle}</p>
            <p><strong>Tipo de imagem:</strong> {generationResult.imageModeLabel}</p>
            <p><strong>Públicos:</strong> {generationResult.audiences.join(', ')}</p>
            {Array.isArray(generationResult.creativeConcepts) && generationResult.creativeConcepts.length > 0 && (
              <p><strong>Conceitos:</strong> {generationResult.creativeConcepts.join(', ')}</p>
            )}
            <p><strong>Focos:</strong> {generationResult.subcategory}</p>
            <p><strong>Estado do imóvel:</strong> {generationResult.propertyState}</p>
            <p><strong>Destaques:</strong> {generationResult.highlights.length > 0 ? generationResult.highlights.join(', ') : 'Sem destaque adicional'}</p>
            <p><strong>CTA:</strong> {generationResult.cta}</p>
            <p><strong>Valores e condições:</strong> {generationResult.valueCondition}</p>
            <p><strong>Pacote:</strong> {generationResult.deliverables.join(', ')}</p>
            {generationResult.additionalInfo && (
              <p><strong>Detalhes adicionais:</strong> {generationResult.additionalInfo}</p>
            )}
          </div>
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-gray-700">
            Imagem principal pronta para publicação.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <ResultBlock title="Hero Principal" active={isPrepared} />
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-black text-gray-950">3 Direções Criativas</p>
          <div className="mt-3 space-y-2">
            {CREATIVE_DIRECTIONS.map((direction) => (
              <div key={direction.id} className="rounded-2xl bg-white p-3">
                <p className="text-xs font-black text-gray-950">{direction.title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{direction.description}</p>
                <button type="button" disabled className="mt-2 text-xs font-black text-gray-400">
                  Gerar esta versão
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Download className="h-4 w-4" />
          Download
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <RefreshCw className="h-4 w-4" />
          Gerar nova versão
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Layers3 className="h-4 w-4" />
          Criar Campanha IA
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <BadgeCheck className="h-4 w-4" />
          Criar Landing IA
        </button>
      </div>
    </section>
  )
}

function ResultBlock({ title, active }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-sm font-black text-gray-950">{title}</p>
      <p className="mt-1 text-xs font-semibold text-gray-500">
        {active ? 'Imagem principal pronta.' : 'Aguardando checklist.'}
      </p>
    </div>
  )
}

function EmptyPropertyState() {
  return (
    <section className="mt-6 rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        <Building2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-black text-gray-950">Comece cadastrando seu primeiro imóvel.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        A Hero IA precisa de um Cadastro Mestre com dados e pelo menos {MIN_HERO_PHOTOS} fotos para preparar a geração.
      </p>
      <Link
        to="/meus-imoveis"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800"
      >
        Abrir Cadastro Mestre
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

function LoadingState() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-gray-100" />
    </div>
  )
}

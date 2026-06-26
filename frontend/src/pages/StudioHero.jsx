import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Film,
  ImagePlus,
  Loader2,
  MessageSquareText,
  Pencil,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { Button } from '../components/ui/Button'

const BUCKET = 'studio-videos'
const MAX_DIFFERENTIALS = 1
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const STUDIO_HERO_DEMO_VIDEO_URL = '/previews/studio-hero/moema-demo.mp4'
const PREMIUM_PLAN_IDS = new Set(['start', 'starter', 'pro', 'elite'])
const IS_DEV = import.meta.env.DEV
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEV_RECOVERY_JOB_ID = 'e22ea1f2-2130-4030-be74-0591c2b11bd7'
const TYPEWRITER_INITIAL_DELAY_MS = 350
const TYPEWRITER_CHAR_DELAY_MS = 30
const TYPEWRITER_FINAL_CURSOR_MS = 400

function logStudioHero(level, event, payload) {
  if (!IS_DEV) return
  console[level](event, payload)
}

function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim())
}

function extractJobIdFromResponse(data, fallbackJobId = '') {
  const jobId = data && typeof data === 'object'
    ? data.jobId || data.job_id
    : ''
  if (isUuid(jobId)) return jobId
  if (isUuid(fallbackJobId)) return fallbackJobId
  return ''
}

const IMAGE_SLOTS = [
  {
    key: 'image1',
    label: 'Imagem 1',
    helper: 'Primeira imagem da narrativa. Escolha uma foto forte do imovel.',
    fileName: 'input-1',
  },
  {
    key: 'image2',
    label: 'Imagem 2',
    helper: 'Imagem final da narrativa. A ordem influencia o impacto do comercial.',
    fileName: 'input-2',
  },
]

const STUDIO_CREATION_MODES = [
  {
    id: 'cinematic',
    title: 'Comercial Cinematografico',
    description: 'Crie um comercial curto e impactante a partir das melhores imagens do imovel.',
    status: 'Ativo agora',
    Icon: Film,
    active: true,
    accent: 'cyan',
    cta: 'Criar comercial',
  },
  {
    id: 'free_ai',
    title: 'Comercial IA Livre',
    description: 'Crie um comercial do zero apenas conversando com a IA, sem enviar imagens.',
    status: 'Em breve',
    Icon: MessageSquareText,
    active: false,
    accent: 'violet',
    cta: 'Em breve',
  },
  {
    id: 'smart_carousel',
    title: 'Carrossel Inteligente',
    description: 'Transforme imagens em uma apresentacao dinamica e profissional para divulgacao.',
    status: 'Em breve',
    Icon: ImagePlus,
    active: false,
    accent: 'green',
    cta: 'Em breve',
  },
  {
    id: 'improve_video',
    title: 'Melhorar meu Video',
    description: 'Envie um video gravado no celular e deixe a IA preparar uma versao mais profissional com legenda, musica, som e acabamento.',
    status: 'Em breve',
    Icon: PlayCircle,
    active: false,
    accent: 'amber',
    cta: 'Em breve',
  },
]

const STUDIO_MODE_ACCENTS = {
  cyan: {
    card: 'border-cyan-200 bg-white shadow-cyan-100/70 hover:border-cyan-400 hover:shadow-cyan-200/70',
    icon: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100',
    status: 'bg-emerald-50 text-emerald-700',
    cta: 'text-cyan-700',
    glow: 'from-cyan-400/20 via-transparent to-transparent',
  },
  violet: {
    card: 'border-violet-100 bg-white/85 shadow-violet-100/60 hover:border-violet-300 hover:shadow-violet-200/60',
    icon: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
    status: 'bg-violet-50 text-violet-700',
    cta: 'text-violet-700',
    glow: 'from-violet-400/20 via-transparent to-transparent',
  },
  green: {
    card: 'border-emerald-100 bg-white/85 shadow-emerald-100/60 hover:border-emerald-300 hover:shadow-emerald-200/60',
    icon: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    status: 'bg-emerald-50 text-emerald-700',
    cta: 'text-emerald-700',
    glow: 'from-emerald-400/20 via-transparent to-transparent',
  },
  amber: {
    card: 'border-amber-100 bg-white/85 shadow-amber-100/60 hover:border-amber-300 hover:shadow-amber-200/60',
    icon: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    status: 'bg-amber-50 text-amber-700',
    cta: 'text-amber-700',
    glow: 'from-amber-400/20 via-transparent to-transparent',
  },
}

const ASSISTANT_HINTS = {
  1: 'Perfeito. Vamos comecar pelo objetivo.',
  2: 'Otimo. Agora me diga qual imovel vamos apresentar.',
  3: 'Excelente. Isso define o tom do comercial.',
}

const OBJECTIVE_OPTIONS = [
  { id: 'sale', label: 'Venda de imovel', oferta: 'A VENDA' },
  { id: 'rent', label: 'Locacao de imovel', oferta: 'PARA LOCACAO' },
]

const RESIDENTIAL_PROPERTY_TYPES = ['APARTAMENTO', 'CASA']
const COMMERCIAL_PROPERTY_TYPES = ['SALA COMERCIAL', 'LOJA', 'LAJE CORPORATIVA', 'GALPAO']
const SALE_PROPERTY_TYPES = [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES]
const RENT_PROPERTY_TYPES = [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES]

const SALE_STAGES = ['PRE-LANCAMENTO', 'LANCAMENTO', 'PRONTO']

const RESIDENTIAL_PROFILES = ['ECONOMICO', 'ALTO PADRAO', 'LUXO']
const HOUSE_LOCATION_OPTIONS = ['CONDOMINIO FECHADO', 'BAIRRO ABERTO']

const UF_OPTIONS = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'MT', 'MS']

const IMAGE_COUNT_OPTIONS = [2, 3, 4, 6, 8]

const BEDROOM_OPTIONS = ['1 DORMITORIO', '2 DORMITORIOS', '3 DORMITORIOS', '4 DORMITORIOS']
const SUITE_OPTIONS = ['SEM SUITE', '1 SUITE', '2 SUITES', '3 SUITES', '4 SUITES']
const PARKING_OPTIONS = ['SEM VAGA', '1 VAGA', '2 VAGAS', '3 VAGAS', '4 VAGAS']
const AREA_OPTIONS = ['ATE 50 M2', '50 A 100 M2', '100 A 200 M2', 'ACIMA DE 200 M2']
const COMMERCIAL_ROOM_OPTIONS = ['1 SALA/CONJUNTO', '2 SALAS/CONJUNTOS', '3 SALAS/CONJUNTOS', 'ANDAR INTEIRO']
const BATHROOM_OPTIONS = ['1 BANHEIRO', '2 BANHEIROS', '3 BANHEIROS', '4 BANHEIROS OU MAIS']

const SALE_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'ESPACO INTERNO',
  'VARANDA / AREA EXTERNA',
  'ACABAMENTO',
  'LAZER',
  'VISTA',
  'OPORTUNIDADE',
]

const HOUSE_DIFFERENTIAL_OPTIONS = [
  'CONDOMINIO',
  'AREA EXTERNA',
  'ESPACO INTERNO',
  'SEGURANCA',
  'ACABAMENTO',
  'LOCALIZACAO',
  'OPORTUNIDADE',
]

const SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'INFRAESTRUTURA',
  'NEGOCIOS',
  'VISIBILIDADE',
]

const RENT_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'ESPACO INTERNO',
  'VARANDA / AREA EXTERNA',
  'ACABAMENTO',
  'LAZER',
  'VISTA',
  'OPORTUNIDADE',
]

const RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO',
  'INFRAESTRUTURA',
  'NEGOCIOS',
  'VISIBILIDADE',
]

const SALE_CTA_OPTIONS = [
  'SAIBA MAIS',
  'AGENDE SUA VISITA',
  'ENTRE EM CONTATO',
  'SOLICITE MAIS INFORMACOES',
  'INFORMACOES NA BIO',
]

const RENT_CTA_OPTIONS = [
  'SAIBA MAIS',
  'AGENDE SUA VISITA',
  'ENTRE EM CONTATO',
  'SOLICITE MAIS INFORMACOES',
  'INFORMACOES NA BIO',
]

const GENERATION_MESSAGES = [
  { Icon: Film, text: 'Estamos preparando a direcao criativa do seu comercial.' },
  { Icon: ImagePlus, text: 'A ordem das imagens ajuda a construir a narrativa.' },
  { Icon: PlayCircle, text: 'Seu comercial sera finalizado com o CTA escolhido.' },
  { Icon: MessageSquareText, text: 'Depois da criacao, voce recebera textos prontos para divulgacao.' },
  { Icon: ShieldCheck, text: 'A entrega final fica pronta para revisar, baixar e divulgar.' },
  { Icon: CheckCircle2, text: 'Estamos organizando video, chamada e materiais de apoio.' },
]
const initialAnswers = {
  objective: '',
  oferta: '',
  propertyType: '',
  stage: '',
  profile: '',
  city: '',
  cityOther: '',
  district: '',
  bedrooms: '',
  suites: '',
  parking: '',
  area: '',
  commercialRooms: '',
  bathrooms: '',
  differentials: [],
  rentConditions: [],
  cta: '',
  houseLocationType: '',
  uf: '',
  imageCount: 2,
}

const getStudioHeroAccess = (user) => {
  const plan = String(user?.plano || user?.plan || user?.subscription_plan || '').toLowerCase()
  const role = String(user?.role || '').toLowerCase()
  const email = String(user?.email || '').toLowerCase()
  const isAdmin = role === 'admin' || email === 'riccieri68@gmail.com'
  const isSubscriber = PREMIUM_PLAN_IDS.has(plan)
  const tokenBalance = Number(
    user?.smart_tokens_saldo
    ?? user?.tokens_saldo
    ?? user?.saldo_creditos
    ?? user?.creditos_avulsos
    ?? user?.total_disponivel
    ?? 0
  )
  const hasTokens = Number.isFinite(tokenBalance) && tokenBalance > 0

  return {
    isAdmin,
    isSubscriber,
    hasTokens,
    canGenerate: isAdmin || isSubscriber || hasTokens,
  }
}

function getUploadContentType(file) {
  const rawType = String(file?.type || '').toLowerCase()
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()

  if (rawType === 'image/jpg') return 'image/jpeg'
  if (SUPPORTED_IMAGE_TYPES.has(rawType)) return rawType
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'

  return ''
}

function getFileExtensionFromContentType(contentType) {
  if (contentType === 'image/png') return 'png'
  return 'jpg'
}

function getImageErrorTarget(value) {
  const text = String(value || '').toLowerCase()

  if (text.includes('imagem 1') || text.includes('input-1')) return 'image1'
  if (text.includes('imagem 2') || text.includes('input-2')) return 'image2'
  if (text.includes('imagem') || text.includes('jpg') || text.includes('png')) return 'all'

  return ''
}

function normalizeFreeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 60)
}

function normalizeImpactText(value, fallback, maxWords = 1) {
  const words = normalizeFreeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
  return words.join(' ') || fallback
}

function getCommercialImpactWord(answers) {
  const source = [
    answers.profile,
    answers.stage,
    answers.propertyType,
    answers.oferta,
    ...answers.differentials,
    ...answers.rentConditions,
  ].join(' ').toUpperCase()

  if (/PRAIA|MAR|VISTA|LITORAL/.test(source)) return 'PRAIA'
  if (/INVEST|RENDA|VALORIZ/.test(source)) return 'INVESTIMENTO'
  if (/COMERCIAL|SALA|LAJE|NEGOC/.test(source)) return 'NEGOCIOS'
  if (/LUXO/.test(source)) return 'LUXO'
  if (/ALTO|DESIGN|SOFISTIC/.test(source)) return 'DESIGN'
  if (/MCMV|ECONOM|POPULAR|SUBSID/.test(source)) return 'OPORTUNIDADE'
  if (/PRONTO/.test(source)) return 'MORAR'
  return 'EXCLUSIVO'
}

function getShortCtaPreview(cta) {
  const clean = normalizeFreeText(cta)
  if (/SAIBA/.test(clean)) return 'SAIBA MAIS'
  if (/AGENDE|VISITA/.test(clean)) return 'AGENDE'
  if (/CONTATO|FALE|CORRETOR|WHATS/.test(clean)) return 'CONTATO'
  if (/VISITE|CONHECA|QUERO/.test(clean)) return 'VISITE'
  return normalizeImpactText(clean, 'SAIBA MAIS', 2)
}

function getCreativeProgressMessage(step, uploadStep) {
  if (step >= uploadStep) return 'Agora suas imagens entram como base visual do comercial.'
  if (step >= uploadStep - 1) return 'Estamos quase terminando. Falta escolher as imagens.'
  if (step >= 4) return 'O estilo do comercial ja esta ganhando forma.'
  if (step >= 2) return 'Otimo. Ja temos uma boa base para seguir.'
  return 'Vamos construir a direcao criativa em poucos passos.'
}

function getAssistantHint(number) {
  return ASSISTANT_HINTS[number] || 'Isso vai ajudar bastante a deixar o comercial mais certeiro.'
}

function buildStudioHeroFinalCta(answers) {
  return {
    label: answers.cta || '',
    channel: 'text',
    value: '',
  }
}

function formatStudioHeroFinalCta(finalCta) {
  return finalCta.label || 'SAIBA MAIS'
}

function getLocationValue(value, other = '') {
  return value === 'OUTRO' ? normalizeFreeText(other) : normalizeFreeText(value)
}

function isCommercialType(type) {
  return COMMERCIAL_PROPERTY_TYPES.includes(type)
}

function isResidentialType(type) {
  return RESIDENTIAL_PROPERTY_TYPES.includes(type)
}

function getPropertyTypeOptions(objective) {
  return objective === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES
}

function getProfileOptions(answers) {
  return isResidentialType(answers.propertyType) ? RESIDENTIAL_PROFILES : []
}

function getStageOptions(answers) {
  return SALE_STAGES
}

function getDifferentialOptions(answers) {
  if (answers.objective === 'rent') {
    return isCommercialType(answers.propertyType)
      ? RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS
      : RENT_DIFFERENTIAL_OPTIONS
  }

  if (answers.propertyType === 'CASA') return HOUSE_DIFFERENTIAL_OPTIONS
  if (answers.propertyType === 'GALPAO') return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'LOGISTICA']
  if (answers.propertyType === 'LOJA') return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'VISIBILIDADE']
  if (answers.propertyType === 'SALA COMERCIAL' || answers.propertyType === 'LAJE CORPORATIVA') {
    return ['LOCALIZACAO', 'INFRAESTRUTURA', 'NEGOCIOS', 'ESTRUTURA CORPORATIVA']
  }
  if (isCommercialType(answers.propertyType)) return SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS
  return SALE_DIFFERENTIAL_OPTIONS
}

function getCtaOptions(answers) {
  if (answers.objective === 'rent') return RENT_CTA_OPTIONS
  return SALE_CTA_OPTIONS
}

function getConfiguration(answers) {
  if (isCommercialType(answers.propertyType)) {
    return [answers.commercialRooms, answers.bathrooms, answers.parking, answers.area].filter(Boolean).join(', ')
  }

  return [answers.bedrooms, answers.suites, answers.parking].filter(Boolean).join(', ')
}

function getFinalFeatureText(answers) {
  const items = [
    answers.objective === 'rent' ? 'LOCACAO' : 'VENDA',
    answers.propertyType,
    answers.stage,
    answers.profile,
    answers.houseLocationType,
    answers.city,
    answers.district,
    ...answers.differentials,
    ...answers.rentConditions,
  ].filter(Boolean)
  return [...new Set(items)].join(', ')
}

function getObjectiveLabel(objectiveId) {
  return OBJECTIVE_OPTIONS.find((item) => item.id === objectiveId)?.label || ''
}

function buildDeliveryTexts({ answers, districtValue, cityValue }) {
  const bairro = normalizeImpactText(districtValue, 'IMOVEL', 2)
  const tipo = normalizeImpactText(answers.propertyType, 'IMOVEL', 2)
  const diferencial = normalizeImpactText(answers.differentials[0], getCommercialImpactWord(answers), 2)
  const cta = formatStudioHeroFinalCta(buildStudioHeroFinalCta(answers)) || answers.cta || 'Entre em contato'
  const isCommercial = isCommercialType(answers.propertyType)
  const locationTag = bairro.replace(/\s+/g, '')
  const typeTag = tipo.replace(/\s+/g, '')

  return [
    {
      label: 'Legenda Instagram',
      text: `${bairro} em destaque. Um comercial criado para apresentar o imovel com impacto, atmosfera e movimento. ${cta}.`,
    },
    {
      label: 'Legenda Facebook',
      text: `Veja este ${tipo.toLowerCase()} em ${bairro}. Comercial criado para valorizar o imovel e despertar interesse logo nos primeiros segundos. ${cta}.`,
    },
    ...(isCommercial ? [{
      label: 'Texto LinkedIn',
      text: `${bairro} ganha uma apresentacao comercial com foco em ${diferencial.toLowerCase()}. Ideal para gerar atencao, autoridade e novas oportunidades. ${cta}.`,
    }] : []),
    {
      label: 'Texto WhatsApp',
      text: `Oi! Preparei um comercial rapido deste imovel em ${bairro}. Ficou bem visual e ajuda a sentir melhor o espaco. ${cta}.`,
    },
    {
      label: 'Descricao Portal',
      text: `${tipo} em ${bairro}. Material em comercial curto criado para destacar o imovel com linguagem moderna, visual profissional e foco em ${diferencial.toLowerCase()}.`,
    },
    {
      label: 'Hashtags',
      text: `#SmartCorretorAI #${locationTag} #${typeTag} #MercadoImobiliario #Imoveis #VideoImobiliario`,
    },
  ]
}

async function invokeStudioFunction(name, body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  let responseBody = null
  try {
    responseBody = responseText ? JSON.parse(responseText) : null
  } catch {
    responseBody = responseText
  }

  logStudioHero('info', 'studio_hero_function_response', {
    functionName: name,
    status: response.status,
    ok: response.ok,
  })

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  }
}

export default function StudioHero() {
  const { user } = useAuth()
  const pollTimerRef = useRef(null)
  const uploadSectionRef = useRef(null)
  const [studioMode, setStudioMode] = useState('')
  const [modeNotice, setModeNotice] = useState('')
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState(initialAnswers)
  const [files, setFiles] = useState({ image1: null, image2: null })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0)

  const isSale = answers.objective === 'sale'
  const isRent = answers.objective === 'rent'
  const propertyTypeOptions = getPropertyTypeOptions(answers.objective)
  const profileOptions = getProfileOptions(answers)
  const stageOptions = getStageOptions(answers)
  const differentialOptions = getDifferentialOptions(answers)
  const ctaOptions = getCtaOptions(answers)
  const cityValue = getLocationValue(answers.uf || answers.city, answers.cityOther)
  const districtValue = normalizeFreeText(answers.district)
  const normalizedLocation = [districtValue, cityValue].filter(Boolean).join('-')
  const configuration = getConfiguration(answers)
  const finalFeatures = getFinalFeatureText({
    ...answers,
    city: cityValue,
    district: districtValue,
  })
  const isGenerating = ['uploading', 'generating'].includes(status)
  const hasProfileStep = isResidentialType(answers.propertyType)
  const hasHouseLocationStep = answers.propertyType === 'CASA'
  const hasStageStep = isSale && isResidentialType(answers.propertyType)
  const profileStep = 3
  const houseLocationStep = profileStep + (hasProfileStep ? 1 : 0)
  const stageStep = houseLocationStep + (hasHouseLocationStep ? 1 : 0)
  const locationStep = stageStep + (hasStageStep ? 1 : 0)
  const differentialsStep = locationStep + 1
  const ctaStep = differentialsStep + 1
  const imageCountStep = ctaStep + 1
  const uploadStep = imageCountStep + 1
  const imageErrorTarget = getImageErrorTarget(message)
  const studioHeroAccess = getStudioHeroAccess(user)
  const showDevRecovery = false
  const generationMessage = GENERATION_MESSAGES[generationMessageIndex % GENERATION_MESSAGES.length]
  const progressPercent = Math.min(100, Math.max(8, Math.round((Math.min(step, uploadStep) / uploadStep) * 100)))
  const progressMessage = getCreativeProgressMessage(step, uploadStep)
  const stepSummaries = {
    1: answers.objective ? getObjectiveLabel(answers.objective) : '',
    2: answers.propertyType,
    [profileStep]: hasProfileStep ? answers.profile : '',
    [houseLocationStep]: hasHouseLocationStep ? answers.houseLocationType : '',
    [stageStep]: hasStageStep ? answers.stage : '',
    [locationStep]: normalizedLocation,
    [differentialsStep]: answers.differentials.join(', '),
    [ctaStep]: answers.cta,
    [imageCountStep]: answers.imageCount === 2 ? `${answers.imageCount} imagens` : '',
    [uploadStep]: files.image1 && files.image2 ? '2 imagens selecionadas' : '',
  }

  const canGenerateBriefing = Boolean(
    answers.objective &&
    answers.propertyType &&
    (!hasProfileStep || answers.profile) &&
    (!hasHouseLocationStep || answers.houseLocationType) &&
    (!hasStageStep || answers.stage) &&
    cityValue &&
    districtValue &&
    answers.differentials.length > 0 &&
    answers.cta &&
    answers.imageCount === 2 &&
    files.image1 &&
    files.image2
  )
  const canGenerate = canGenerateBriefing && studioHeroAccess.canGenerate

  const updateObjective = (option) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      objective: option.id,
      oferta: option.oferta,
      propertyType: '',
      stage: '',
      profile: '',
      city: '',
      cityOther: '',
      uf: '',
      district: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      commercialRooms: '',
      bathrooms: '',
      differentials: [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 2,
    }))
    setStep(2)
  }

  const updatePropertyType = (propertyType) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      propertyType,
      stage: '',
      profile: '',
      bedrooms: '',
      suites: '',
      parking: '',
      area: '',
      commercialRooms: '',
      bathrooms: '',
      differentials: [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 2,
    }))
    setStep(isResidentialType(propertyType) ? profileStep : locationStep)
  }

  const updateProfile = (profile) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      profile,
      differentials: [],
      rentConditions: [],
      cta: '',
      houseLocationType: '',
      imageCount: 2,
    }))
    setStep(answers.propertyType === 'CASA' ? houseLocationStep : (hasStageStep ? stageStep : locationStep))
  }

  const updateAnswer = (field, value, nextStep = step + 1) => {
    resetGenerationState()
    setAnswers((current) => ({ ...current, [field]: value }))
    if (nextStep) setStep(nextStep)
  }

  const toggleDifferential = (item) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      differentials: current.differentials.includes(item) ? [] : [item],
      cta: '',
      imageCount: 2,
    }))
  }

  const updateCtaLabel = (cta) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      cta,
    }))
    setStep(imageCountStep)
  }

  const uploadImage = async (slot, file, jobDraftId) => {
    const contentType = getUploadContentType(file)

    if (!contentType) {
      logStudioHero('warn', 'studio_hero_invalid_image_type', {
        slot: slot.key,
        fileType: file?.type || '',
        fileName: file?.name || '',
        fileSize: file?.size || 0,
      })
      throw new Error(`${slot.label}: Para este teste, envie imagens JPG ou PNG.`)
    }

    const extension = getFileExtensionFromContentType(contentType)
    const path = `${user.id}/${jobDraftId}/${slot.fileName}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType,
        upsert: true,
      })

    if (error) {
      logStudioHero('error', 'studio_hero_upload_error', {
        bucket: BUCKET,
        path,
        slot: slot.key,
        contentType,
        fileType: file.type || '',
        fileName: file.name || '',
        fileSize: file.size || 0,
        message: error.message,
      })
      throw new Error(`Falha no upload de ${slot.label}. Para este teste, envie imagens JPG ou PNG.`)
    }

    return path
  }

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearPolling(), [])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationMessageIndex(0)
      return undefined
    }
    const timer = window.setInterval(() => {
      setGenerationMessageIndex((current) => (current + 1) % GENERATION_MESSAGES.length)
    }, 3200)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  function resetGenerationState() {
    clearPolling()
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
  }

  const focusUploadArea = (block = 'nearest') => {
    window.setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block })
    }, 0)
  }

  const goToUploadStep = () => {
    setStep(uploadStep)
    focusUploadArea('center')
  }

  const handleImageChange = (slotKey, file) => {
    resetGenerationState()
    const nextFiles = { ...files, [slotKey]: file }
    setFiles(nextFiles)

    if (nextFiles.image1 && nextFiles.image2) {
      setStep(uploadStep)
    }
  }

  useEffect(() => {
    if (status === 'failed' && imageErrorTarget) {
      setStep(uploadStep)
      focusUploadArea('center')
    }
  }, [status, imageErrorTarget])

  const pollVideoStatus = async (nextJobId, options = {}) => {
    const isRecovery = options.mode === 'recovery'
    const normalizedJobId = String(nextJobId || '').trim()
    const regexResult = UUID_PATTERN.test(normalizedJobId)

    if (!regexResult) {
      logStudioHero('error', 'studio_hero_invalid_poll_job_id', {
        receivedType: typeof nextJobId,
        length: typeof nextJobId === 'string' ? nextJobId.length : undefined,
        valueLength: normalizedJobId.length,
        trimmedValue: normalizedJobId,
        regexResult,
      })
      clearPolling()
      setStatus('failed')
      setMessage('Nao foi possivel preparar o comercial neste momento.')
      return
    }

    try {
      const result = await invokeStudioFunction('get-video-job-status', { jobId: normalizedJobId })
      const data = result.body

      if (!result.ok) throw new Error(data?.error || 'Falha ao consultar comercial.')
      if (!data?.ok) throw new Error(data?.error || 'Comercial ainda nao disponivel.')

      if (data.status === 'completed') {
        clearPolling()
        setStatus('completed')
        setVideoUrl(data.signedVideoUrl || '')
        setMessage('Seu comercial esta pronto.')
        return
      }

      if (data.status === 'failed') {
        clearPolling()
        setStatus('failed')
        setMessage('Nao foi possivel criar o comercial neste momento.')
        return
      }

      setStatus('generating')
      setMessage(isRecovery ? 'Comercial ainda em preparacao. Tente novamente em alguns segundos.' : (data.message || 'Criando seu comercial...'))
      if (!isRecovery) {
        pollTimerRef.current = setTimeout(() => pollVideoStatus(normalizedJobId), 9000)
      }
    } catch (error) {
      clearPolling()
      logStudioHero('error', 'studio_hero_status_error', {
        jobId: normalizedJobId,
        message: error instanceof Error ? error.message : String(error),
      })
      setStatus('failed')
      setMessage('Nao foi possivel preparar o comercial neste momento.')
    }
  }

  const handleRecoverDevVideo = async () => {
    clearPolling()
    setVideoUrl('')
    setStatus('generating')
    setMessage('Consultando comercial em andamento...')
    await pollVideoStatus(DEV_RECOVERY_JOB_ID, { mode: 'recovery' })
  }

  const handleGenerate = async () => {
    if (!user?.id || !canGenerateBriefing) return
    if (!studioHeroAccess.canGenerate) {
      setStatus('failed')
      setMessage('Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja o exemplo e ative quando quiser.')
      return
    }

    clearPolling()
    setStatus('uploading')
    setMessage('Preparando seu comercial...')
    setVideoUrl('')

    try {
      const draftId = crypto.randomUUID()
      const [inputImage1Path, inputImage2Path] = await Promise.all([
        uploadImage(IMAGE_SLOTS[0], files.image1, draftId),
        uploadImage(IMAGE_SLOTS[1], files.image2, draftId),
      ])

      setStatus('generating')
      setMessage('Criando seu comercial...')

      const result = await invokeStudioFunction('criar-video-ia', {
        style: answers.profile || 'ALTO PADRAO',
        bairro: normalizedLocation,
        caracteristica: finalFeatures,
        oferta: answers.oferta,
        cta: answers.cta,
        jobId: draftId,
        inputImage1Path,
        inputImage2Path,
      })
      const data = result.body

      if (!result.ok) {
        throw new Error(data?.error || 'Falha ao iniciar comercial.')
      }
      if (!data?.ok && !data?.success) throw new Error(data?.error || 'Comercial ainda nao disponivel neste ambiente.')

      const nextJobId = extractJobIdFromResponse(data, draftId)
      if (!nextJobId) {
        throw new Error('invalid_job_id')
      }
      setVideoUrl('')
      setStatus('generating')
      setMessage(data.message || 'Criando seu comercial...')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      logStudioHero('error', 'studio_hero_generate_error', {
        message: error instanceof Error ? error.message : String(error),
      })
      setStatus('failed')
      const friendlyMessage = error instanceof Error && /JPG|PNG|imagem|assinantes|Smart Tokens/i.test(error.message)
        ? error.message
        : 'No momento, o servico de criacao esta temporariamente limitado pelo provedor de video. Seus Smart Tokens nao serao consumidos se a criacao nao for concluida. Tente novamente mais tarde.'
      setMessage(friendlyMessage)
    }
  }

  const resetFlow = () => {
    clearPolling()
    setAnswers(initialAnswers)
    setFiles({ image1: null, image2: null })
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
    setStep(1)
  }

  const selectStudioMode = (mode) => {
    if (!mode.active) {
      setModeNotice('Este modo estara disponivel em breve.')
      return
    }
    setModeNotice('')
    setStudioMode(mode.id)
    resetFlow()
  }

  if (!studioMode) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_42%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_46%,#0e7490_100%)] text-white shadow-2xl shadow-cyan-950/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(103,232,249,0.26),transparent_28%),radial-gradient(circle_at_86%_20%,rgba(125,211,252,0.18),transparent_30%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
            <div className="relative grid gap-8 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100">
                  <Film className="h-4 w-4" />
                  Studio Hero
                </div>
                <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                  Studio Hero
                </h1>
                <p className="mt-4 max-w-2xl text-xl font-black leading-8 text-cyan-50">
                  Seu estudio inteligente de criacao de videos imobiliarios.
                </p>
                <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                  Crie comerciais cinematograficos, apresentacoes profissionais ou melhore videos gravados em poucos minutos com IA.
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
                <p className="text-sm font-black text-white">O que voce pode criar</p>
                <ul className="mt-4 space-y-3 text-sm font-bold leading-6 text-slate-100">
                  {[
                    'Comerciais cinematograficos',
                    'Comerciais criados apenas com IA',
                    'Carrosseis inteligentes',
                    'Melhoria automatica de videos',
                    'Novos modos chegando',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-100/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {modeNotice && (
            <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-sm font-bold text-primary-900">
              {modeNotice}
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STUDIO_CREATION_MODES.map((mode) => {
              const ModeIcon = mode.Icon
              const accent = STUDIO_MODE_ACCENTS[mode.accent] || STUDIO_MODE_ACCENTS.cyan
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => selectStudioMode(mode)}
                  className={`relative flex min-h-[240px] flex-col overflow-hidden rounded-3xl border p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${accent.card}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${accent.glow}`} />
                  <div className="flex items-start justify-between gap-4">
                    <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${accent.icon}`}>
                      <ModeIcon className="h-5 w-5" />
                    </span>
                    <span className={`relative rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${accent.status}`}>
                      {mode.status}
                    </span>
                  </div>
                  <h2 className="relative mt-5 text-xl font-black text-slate-950">{mode.title}</h2>
                  <p className="relative mt-3 flex-1 text-sm font-semibold leading-6 text-slate-600">{mode.description}</p>
                  <span className={`relative mt-5 text-sm font-black ${accent.cta}`}>
                    {mode.active ? mode.cta : 'Em breve'}
                  </span>
                </button>
              )
            })}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7fb_38%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_48%,#0e7490_100%)] text-white shadow-2xl shadow-cyan-950/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(103,232,249,0.24),transparent_30%),radial-gradient(circle_at_84%_28%,rgba(56,189,248,0.16),transparent_34%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="relative grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Film className="h-4 w-4" />
                Comercial Cinematografico
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Vamos criar seu comercial.
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black text-white">
                O Studio Hero vai construir a direcao criativa a partir das suas escolhas e imagens.
              </p>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                Um fluxo curto para transformar suas escolhas e imagens em uma peca de divulgacao mais cinematografica.
              </p>
              <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-cyan-50">
                Suas respostas definem estilo, ritmo e atmosfera. O comercial final usa poucas palavras para ficar mais forte.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetFlow()
                  setStudioMode('')
                }}
                className="mt-6 rounded-2xl border border-white/15 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-white/10"
              >
                Escolher outro tipo de criacao
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <p className="font-black">Como vamos conduzir?</p>
              </div>
              <ul className="mt-5 space-y-4 text-sm font-bold leading-6 text-slate-100">
                {[
                  'Criar direcao criativa para o comercial',
                  'Usar as melhores imagens do imovel',
                  'Gerar uma peca curta para redes sociais',
                  'Entregar textos prontos para divulgacao',
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Regra futura: Produtos 1, 2 e 4 devem exibir exemplo real antes da primeira pergunta. */}
        <section className="overflow-hidden rounded-[2rem] border border-cyan-100 bg-white p-5 shadow-xl shadow-cyan-100/50 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Exemplo real</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Veja um exemplo real
              </h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                Exemplo de video criado a partir da nossa conversa e das imagens do imovel.
              </p>
              <p className="mt-3 max-w-xl text-xs font-semibold leading-5 text-slate-500">
                Cada comercial e unico. Novas versoes podem apresentar cenas, movimentos e resultados diferentes.
              </p>
            </div>
            <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-cyan-950/20">
              <div className="overflow-hidden rounded-[1.35rem] bg-slate-950">
                <video
                  src={STUDIO_HERO_DEMO_VIDEO_URL}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full bg-slate-950 object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 pb-12">
          <div className="rounded-3xl border border-cyan-100 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-700">
                  Direcao Criativa
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{progressMessage}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">
                <MessageSquareText className="h-4 w-4" />
                {progressPercent}%
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary-700 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <AssistantStep number={1} currentStep={step} summary={stepSummaries[1]} onEdit={() => setStep(1)} message="O que deseja divulgar?">
            <OptionGrid>
              {OBJECTIVE_OPTIONS.map((option) => (
                <ChoiceButton
                  key={option.id}
                  active={answers.objective === option.id}
                  title={option.label}
                  description={option.id === 'sale' ? 'Comercial para venda do imovel.' : 'Comercial para divulgar locacao.'}
                  onClick={() => updateObjective(option)}
                />
              ))}
            </OptionGrid>
          </AssistantStep>

          {false && answers.objective && (
            <UserReply onEdit={() => setStep(1)}>
              <strong>{getObjectiveLabel(answers.objective)}</strong>
              <span>{answers.oferta}</span>
            </UserReply>
          )}

          {answers.objective && (
            <AssistantStep number={2} currentStep={step} summary={stepSummaries[2]} onEdit={() => setStep(2)} message="Que tipo de imovel vamos divulgar?">
              <ChipGrid>
                {propertyTypeOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.propertyType === option}
                    onClick={() => updatePropertyType(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.propertyType && (
            <UserReply onEdit={() => setStep(2)}>
              <strong>{answers.propertyType}</strong>
              <span>Otimo. Agora ja sei qual sera o tipo de imovel.</span>
            </UserReply>
          )}

          {answers.propertyType && hasProfileStep && (
            <AssistantStep number={3} currentStep={step} summary={stepSummaries[profileStep]} onEdit={() => setStep(profileStep)} message="Qual e o perfil comercial deste imovel?">
              <ChipGrid>
                {profileOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.profile === option}
                    onClick={() => updateProfile(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.profile && hasProfileStep && (
            <UserReply onEdit={() => setStep(3)}>
              <strong>{answers.profile}</strong>
              <span>Excelente escolha. Vamos seguir com esse tom.</span>
            </UserReply>
          )}

          {hasHouseLocationStep && answers.profile && (
            <AssistantStep number={houseLocationStep} currentStep={step} summary={stepSummaries[houseLocationStep]} onEdit={() => setStep(houseLocationStep)} message="Onde o imovel esta localizado?">
              <ChipGrid>
                {HOUSE_LOCATION_OPTIONS.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.houseLocationType === option}
                    onClick={() => {
                      resetGenerationState()
                      setAnswers((current) => ({
                        ...current,
                        houseLocationType: option,
                        stage: '',
                        cta: '',
                      }))
                      setStep(hasStageStep ? stageStep : locationStep)
                    }}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.houseLocationType && (
            <UserReply onEdit={() => setStep(houseLocationStep)}>
              <strong>{answers.houseLocationType}</strong>
              <span>Perfeito. Isso ajuda a imaginar a cena.</span>
            </UserReply>
          )}

          {hasStageStep && (!hasHouseLocationStep || answers.houseLocationType) && answers.profile && (
            <AssistantStep number={stageStep} currentStep={step} summary={stepSummaries[stageStep]} onEdit={() => setStep(stageStep)} message="Qual e o estagio do imovel?">
              <ChipGrid>
                {stageOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.stage === option}
                    onClick={() => {
                      resetGenerationState()
                      setAnswers((current) => ({
                        ...current,
                        stage: option,
                        cta: '',
                      }))
                      setStep(locationStep)
                    }}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && hasStageStep && answers.stage && (
            <UserReply onEdit={() => setStep(stageStep)}>
              <strong>{answers.stage}</strong>
              <span>Perfeito. O clima do comercial fica mais claro.</span>
            </UserReply>
          )}

          {answers.propertyType && (!hasProfileStep || answers.profile) && (!hasHouseLocationStep || answers.houseLocationType) && (!hasStageStep || answers.stage) && (
            <AssistantStep number={locationStep} currentStep={step} summary={stepSummaries[locationStep]} onEdit={() => setStep(locationStep)} message="Qual e a UF e o bairro do imovel?">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">UF</p>
                  <ChipGrid className="mt-3">
                    {UF_OPTIONS.map((option) => (
                      <ChipButton
                        key={option}
                        active={answers.uf === option}
                        onClick={() => {
                          resetGenerationState()
                          setAnswers((current) => ({ ...current, uf: option, city: option }))
                        }}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Bairro</p>
                  <input
                    value={answers.district}
                    onChange={(event) => {
                      resetGenerationState()
                      setAnswers((current) => ({ ...current, district: normalizeFreeText(event.target.value) }))
                    }}
                    placeholder="DIGITE O BAIRRO"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!cityValue || !districtValue} onClick={() => setStep(differentialsStep)}>
                    Confirmar direcao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {false && cityValue && districtValue && step >= differentialsStep && (
            <UserReply onEdit={() => setStep(locationStep)}>
              <strong>{normalizedLocation}</strong>
              <span>Localizacao normalizada para o comercial.</span>
            </UserReply>
          )}

          {cityValue && districtValue && step >= differentialsStep && (
            <AssistantStep number={differentialsStep} currentStep={step} summary={stepSummaries[differentialsStep]} onEdit={() => setStep(differentialsStep)} message="O que voce deseja destacar neste comercial?">
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-600">Escolha o ponto que deve ganhar mais forca no video.</p>
                <ChipGrid>
                  {differentialOptions.map((option) => {
                    const selected = answers.differentials.includes(option)
                    const disabled = !selected && answers.differentials.length >= MAX_DIFFERENTIALS
                    return (
                      <ChipButton
                        key={option}
                        active={selected}
                        disabled={disabled}
                        onClick={() => toggleDifferential(option)}
                      >
                        {option}
                      </ChipButton>
                    )
                  })}
                </ChipGrid>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500">
                    {answers.differentials.length}/{MAX_DIFFERENTIALS} selecionado
                  </span>
                  <Button
                    type="button"
                    disabled={answers.differentials.length === 0}
                    onClick={() => setStep(ctaStep)}
                  >
                    Confirmar diferencial
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {false && answers.differentials.length > 0 && step >= ctaStep && (
            <UserReply onEdit={() => setStep(differentialsStep)}>
              <strong>{answers.differentials.join(', ')}</strong>
              <span>Esses dados orientam o tom visual, mas nao aparecem todos no video.</span>
            </UserReply>
          )}

          {answers.differentials.length > 0 && step >= ctaStep && (
            <AssistantStep number={ctaStep} currentStep={step} summary={stepSummaries[ctaStep]} onEdit={() => setStep(ctaStep)} message="Qual chamada final deseja usar?">
              <ChipGrid>
                {ctaOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.cta === option}
                    onClick={() => updateCtaLabel(option)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {false && answers.cta && (
            <UserReply onEdit={() => setStep(ctaStep)}>
              <strong>{answers.cta}</strong>
              <span>Essa sera a chamada final preparada pelo SmartCorretorAI.</span>
            </UserReply>
          )}

          {answers.cta && step >= imageCountStep && (
            <AssistantStep number={imageCountStep} currentStep={step} summary={stepSummaries[imageCountStep]} onEdit={() => setStep(imageCountStep)} message="Quantas imagens deseja usar?">
              <div className="space-y-4">
                <ChipGrid>
                  {IMAGE_COUNT_OPTIONS.map((count) => (
                    <ChipButton
                      key={count}
                      active={answers.imageCount === count}
                      onClick={() => {
                        resetGenerationState()
                        setAnswers((current) => ({ ...current, imageCount: count }))
                      }}
                    >
                      {count} imagens
                    </ChipButton>
                  ))}
                </ChipGrid>
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-semibold leading-6 text-primary-900">
                  Mais imagens podem consumir mais Smart Tokens.
                </div>
                {answers.imageCount !== 2 && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                    Neste primeiro modo, a geracao cinematografica esta liberada com 2 imagens. As opcoes com mais imagens serao ativadas em breve.
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="button" disabled={answers.imageCount !== 2} onClick={() => setStep(uploadStep)}>
                    Continuar com 2 imagens
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {false && answers.cta && answers.imageCount === 2 && step >= uploadStep && (
            <UserReply onEdit={() => setStep(imageCountStep)}>
              <strong>{formatStudioHeroFinalCta(buildStudioHeroFinalCta(answers))}</strong>
              <span>{answers.imageCount} imagens selecionadas para este modo.</span>
            </UserReply>
          )}

          {answers.cta && answers.imageCount === 2 && step >= uploadStep && (
            <AssistantStep number={uploadStep} currentStep={step} summary={stepSummaries[uploadStep]} onEdit={() => setStep(uploadStep)} message="Agora chegou uma das partes mais importantes. Escolha as imagens que melhor representam o imovel.">
              <div ref={uploadSectionRef} className="grid gap-5 scroll-mt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.75fr)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {IMAGE_SLOTS.map((slot) => (
                      <FilePicker
                        key={slot.key}
                        slot={slot}
                        file={files[slot.key]}
                        error={imageErrorTarget === slot.key || imageErrorTarget === 'all'}
                        onChange={(file) => handleImageChange(slot.key, file)}
                      />
                    ))}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-semibold leading-5 text-slate-500">
                    Escolha as imagens que melhor representam o imovel. A ordem das imagens influencia a narrativa do comercial. Quanto melhores forem as imagens, maior tende a ser o impacto visual do resultado.
                  </div>
                </div>

                <div className="lg:sticky lg:top-4 lg:self-start">
                  <UploadActionPanel
                    answers={answers}
                    cityValue={cityValue}
                    districtValue={districtValue}
                    configuration={configuration}
                    files={files}
                    studioHeroAccess={studioHeroAccess}
                    canGenerate={canGenerate}
                    isGenerating={isGenerating}
                    status={status}
                    message={message}
                    generationMessage={generationMessage}
                    videoUrl={videoUrl}
                    onEdit={setStep}
                    onEditImages={goToUploadStep}
                    onGenerate={handleGenerate}
                  />
                </div>
              </div>
            </AssistantStep>
          )}

          {showDevRecovery && (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-700">Recuperacao DEV</p>
                  <p className="mt-1 text-sm font-bold text-amber-950">
                    Consultar o video em andamento sem criar nova geracao.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRecoverDevVideo}
                  disabled={isGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Recuperar video em andamento
                </button>
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar conversa
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function AssistantStep({ number, currentStep, summary, onEdit, message, children }) {
  const answered = Boolean(summary) && number < currentStep
  const active = number === currentStep || !answered

  if (answered) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50/70"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-slate-950">{summary}</span>
            <span className="block text-[11px] font-black uppercase tracking-wide text-slate-400">Etapa {number}</span>
          </span>
        </span>
        <Pencil className="h-4 w-4 shrink-0 text-cyan-700" />
      </button>
    )
  }

  return (
    <section className="rounded-3xl border border-cyan-100 bg-white/95 p-4 shadow-sm transition duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-cyan-800">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-slate-400">Direcao criativa</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            <TypewriterText text={message} active={active} />
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{getAssistantHint(number)}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function UserReply({ children, onEdit }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="max-w-xl rounded-3xl border border-cyan-100 bg-cyan-50/90 px-4 py-3 text-left text-primary-950 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
      >
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
          <span className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-700">Editar resposta</span>
        </div>
      </button>
    </div>
  )
}

function OptionGrid({ children, className = '' }) {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className}`}>
      {children}
    </div>
  )
}

function ChipGrid({ children, className = '' }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
}

function ChoiceButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-cyan-700 bg-primary-950 text-white shadow-lg shadow-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
      }`}
    >
      <p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p>
      <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-slate-200' : 'text-slate-500'}`}>{description}</p>
    </button>
  )
}

function ChipButton({ active, disabled = false, children, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-cyan-700 bg-primary-950 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50'
      }`}
    >
      {children}
    </button>
  )
}

function OptionGroup({ title, options, value, onSelect }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ChipGrid className="mt-3">
        {options.map((option) => (
          <ChipButton
            key={option}
            active={value === option}
            onClick={() => onSelect(option)}
          >
            {option}
          </ChipButton>
        ))}
      </ChipGrid>
    </div>
  )
}

function FilePicker({ slot, file, error = false, onChange }) {
  return (
    <label
      className={`group flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed p-4 shadow-sm transition ${
        error
          ? 'border-red-300 bg-red-50 hover:border-red-400'
          : 'border-primary-200 bg-white hover:border-primary-400 hover:bg-primary-50/40'
      }`}
    >
      <input
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">{slot.label}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{slot.helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-950 text-cyan-100">
          <ImagePlus className="h-5 w-5" />
        </div>
      </div>
      <div className="flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-52 lg:h-56 2xl:h-64">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt={`${slot.label} selecionada`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <UploadCloud className="h-8 w-8" />
            <span className="text-xs font-bold">Selecionar imagem</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="min-h-4 truncate text-xs font-bold text-slate-500">{file?.name || ' '}</p>
        {file && (
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">
            Clique no card para trocar a imagem
          </p>
        )}
        {error && (
          <p className="text-xs font-black text-red-600">
            Revise esta imagem. Para este teste, use JPG ou PNG.
          </p>
        )}
      </div>
    </label>
  )
}

function UploadActionPanel({
  answers,
  cityValue,
  districtValue,
  configuration,
  files,
  studioHeroAccess,
  canGenerate,
  isGenerating,
  status,
  message,
  generationMessage,
  videoUrl,
  onEdit,
  onEditImages,
  onGenerate,
}) {
  const hasImage1 = Boolean(files.image1)
  const hasImage2 = Boolean(files.image2)
  const ready = hasImage1 && hasImage2

  if (!ready) {
    return (
      <div className="rounded-3xl border border-cyan-100 bg-cyan-50/80 p-5 shadow-sm">
        <p className="text-sm font-black text-primary-950">Envie as duas imagens</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-primary-800">
          Assim que as imagens forem selecionadas, o resumo e o botao Criar comercial aparecem aqui ao lado.
        </p>
        <div className="mt-4 space-y-2 text-sm font-bold text-primary-900">
          <div className={`rounded-2xl border px-4 py-3 ${hasImage1 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-white/70 bg-white/80'}`}>
            Imagem 1 {hasImage1 ? 'selecionada' : 'pendente'}
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${hasImage2 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-white/70 bg-white/80'}`}>
            Imagem 2 {hasImage2 ? 'selecionada' : 'pendente'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {(status !== 'idle' || videoUrl) && (
        <ResultPanel
          status={status}
          message={message}
          generationMessage={generationMessage}
          videoUrl={videoUrl}
          answers={answers}
          cityValue={cityValue}
          districtValue={districtValue}
          compact
        />
      )}
      <div className="rounded-3xl border border-primary-100 bg-white p-4 shadow-sm">
        <StudioChecklist
          answers={answers}
          cityValue={cityValue}
          districtValue={districtValue}
          configuration={configuration}
          files={files}
          studioHeroAccess={studioHeroAccess}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          status={status}
          message={message}
          generationMessage={generationMessage}
          videoUrl={videoUrl}
          onEdit={onEdit}
          onEditImages={onEditImages}
          onGenerate={onGenerate}
        />
      </div>
    </div>
  )
}

function TypewriterText({ text, active }) {
  const [visibleText, setVisibleText] = useState(active ? '' : text)
  const [showCursor, setShowCursor] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisibleText(text)
      setShowCursor(false)
      return undefined
    }

    let index = 0
    let intervalId = null
    let finalTimerId = null
    setVisibleText('')
    setShowCursor(true)

    const startTimerId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1
        setVisibleText(text.slice(0, index))
        if (index >= text.length) {
          window.clearInterval(intervalId)
          finalTimerId = window.setTimeout(() => setShowCursor(false), TYPEWRITER_FINAL_CURSOR_MS)
        }
      }, TYPEWRITER_CHAR_DELAY_MS)
    }, TYPEWRITER_INITIAL_DELAY_MS)

    return () => {
      window.clearTimeout(startTimerId)
      if (intervalId) window.clearInterval(intervalId)
      if (finalTimerId) window.clearTimeout(finalTimerId)
    }
  }, [active, text])

  return (
    <>
      {visibleText}
      {showCursor && <span className="ml-1 animate-pulse font-black text-cyan-700">▋</span>}
    </>
  )
}

function ActionCard({ canGenerate, studioHeroAccess, isGenerating, status, message, onReview, onGenerate }) {
  const hasError = status === 'failed' && message

  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm ${
        hasError ? 'border-red-100 bg-red-50' : 'border-primary-100 bg-primary-50/70'
      }`}
    >
      {hasError && (
        <p className="mb-3 text-sm font-semibold text-red-700">{message}</p>
      )}
      {!studioHeroAccess?.canGenerate && (
        <div className="mb-3 rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm font-semibold leading-6 text-primary-800">
          Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja o exemplo e ative quando quiser.
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Pronto para gerar seu video?</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            As imagens estao selecionadas. Voce pode gerar agora ou revisar as escolhas antes de continuar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" onClick={onReview} disabled={isGenerating}>
            Revisar dados
          </Button>
          <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="justify-center">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando comercial
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Criar comercial
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StudioChecklist({ answers, cityValue, districtValue, configuration, files, studioHeroAccess, canGenerate, isGenerating, status, message, generationMessage, videoUrl, onEdit, onEditImages, onGenerate }) {
  const isSale = answers.objective === 'sale'
  const hasProfileStep = isResidentialType(answers.propertyType)
  const hasHouseLocationStep = answers.propertyType === 'CASA'
  const hasStageStep = isSale && isResidentialType(answers.propertyType)
  const profileStep = 3
  const houseLocationStep = profileStep + (hasProfileStep ? 1 : 0)
  const stageStep = houseLocationStep + (hasHouseLocationStep ? 1 : 0)
  const locationStep = stageStep + (hasStageStep ? 1 : 0)
  const differentialsStep = locationStep + 1
  const ctaStep = differentialsStep + 1
  const imageCountStep = ctaStep + 1
  const uploadStep = imageCountStep + 1
  const imageErrorTarget = getImageErrorTarget(message)
  const studioHeroFinalCta = buildStudioHeroFinalCta(answers)
  const normalizedLocation = [normalizeFreeText(districtValue), cityValue].filter(Boolean).join('-')
  const visibleTextPreview = [
    ['Localizacao', normalizedLocation],
    ['Palavra comercial', getCommercialImpactWord(answers)],
    ['Encerramento', answers.cta],
  ]
  const rows = [
    ['Tipo', 'Comercial Cinematografico', 1],
    [isCommercialType(answers.propertyType) ? 'Tipo comercial' : 'Imovel', answers.propertyType, 2],
    ...(hasProfileStep ? [['Perfil', answers.profile, profileStep]] : []),
    ...(hasHouseLocationStep ? [['Localizacao da casa', answers.houseLocationType, houseLocationStep]] : []),
    ...(hasStageStep ? [['Estagio', answers.stage, stageStep]] : []),
    ['Localizacao', normalizedLocation, locationStep],
    ['Destaque', answers.differentials.join(', '), differentialsStep],
    ['Encerramento', answers.cta, ctaStep],
    ['Imagens', `${answers.imageCount} imagens`, imageCountStep],
    ['Imagem 1', files.image1?.name, uploadStep],
    ['Imagem 2', files.image2?.name, uploadStep],
  ].filter((row) => row[2])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfeff_100%)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {videoUrl ? 'Comercial criado com sucesso.' : 'Seu comercial sera criado com:'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {message || 'Revise suas escolhas e clique em Criar comercial quando estiver pronto.'}
          </p>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-slate-500">
            Cada comercial e criado de forma unica. Novas versoes podem apresentar cenas, movimentos e resultados diferentes.
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="justify-center">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando comercial
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Criar comercial
            </>
          )}
        </Button>
      </div>

      {status === 'failed' && message && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{message}</span>
          {imageErrorTarget && (
            <Button type="button" variant="secondary" onClick={onEditImages}>
              Voltar para imagens
            </Button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-primary-800">Textos conceituais do comercial</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {visibleTextPreview.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/70 bg-white px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-primary-900">
          O encerramento final e controlado pelo SmartCorretorAI para manter consistencia de campanha.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Encerramento escolhido</p>
        <p className="mt-2 text-sm font-black leading-6 text-emerald-950">
          {formatStudioHeroFinalCta(studioHeroFinalCta)}
        </p>
      </div>

      {!studioHeroAccess?.canGenerate && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold leading-6 text-primary-800">
          Disponivel para assinantes ou usuarios com Smart Tokens suficientes. Veja exemplos e ative quando quiser.
        </div>
      )}

      <div className="grid gap-2">
        {rows.map(([label, value, editStep]) => (
          <button
            key={label}
            type="button"
            onClick={() => (label.startsWith('Imagem') ? onEditImages() : onEdit(editStep))}
            className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/50"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 line-clamp-2 text-xs font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-cyan-700">
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultPanel({ status, message, generationMessage, videoUrl, answers, cityValue, districtValue, compact = false }) {
  const completed = Boolean(videoUrl)
  const deliveryTexts = completed ? buildDeliveryTexts({ answers, districtValue, cityValue }) : []
  const GenerationIcon = generationMessage?.Icon || Film
  const studioHeroFinalCta = buildStudioHeroFinalCta(answers || {})
  const finalCtaText = formatStudioHeroFinalCta(studioHeroFinalCta)
  return (
    <section className={`rounded-3xl border border-cyan-100 bg-white shadow-xl shadow-cyan-100/40 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Resultado</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {completed ? 'Seu comercial esta pronto' : 'Preparando seu comercial'}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {completed ? 'Voce recebeu video, download e textos prontos para divulgar.' : (message || 'O video aparecera aqui quando estiver pronto.')}
          </p>
        </div>
        {completed ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        ) : (
          <Film className="h-6 w-6 shrink-0 text-slate-300" />
        )}
      </div>
      {!completed && (status === 'generating' || status === 'uploading') && generationMessage && (
        <div className="mt-4 rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_100%)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100">
              <GenerationIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-primary-950">{generationMessage.text}</p>
              <p className="mt-1 text-xs font-semibold text-cyan-800">Criando atmosfera, ritmo e narrativa visual.</p>
            </div>
          </div>
        </div>
      )}
      <div className={`${compact ? 'mt-4' : 'mt-5'} overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-slate-200/70`}>
        <div className={`mx-auto flex aspect-[9/16] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100 ${compact ? 'max-h-[72vh]' : 'max-h-[820px]'}`}>
          {videoUrl ? (
            <div className="relative h-full w-full">
              <video id="studio-hero-result-video" src={videoUrl} controls className="h-full w-full object-contain" />
              <div className="pointer-events-none absolute inset-x-6 bottom-8 rounded-2xl bg-slate-950/80 px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-2xl">
                {finalCtaText}
              </div>
            </div>
          ) : (
            <div className="px-6 text-center">
              {status === 'generating' || status === 'uploading' ? (
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-700" />
              ) : (
                <Film className="mx-auto h-10 w-10 text-slate-300" />
              )}
              <p className="mt-3 text-sm font-bold text-slate-500">
                {status === 'failed' ? 'Nao foi possivel criar o comercial agora.' : 'Aguardando resultado.'}
              </p>
            </div>
          )}
        </div>
      </div>
      {completed && (
        <div className="mt-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-cyan-800">CTA final do comercial</p>
          <p className="mt-2 text-sm font-black leading-6 text-primary-950">{finalCtaText}</p>
          <p className="mt-2 text-xs font-semibold leading-5 text-primary-800">
            Preparado para a camada final gravada no MP4 em uma proxima etapa de overlay.
          </p>
        </div>
      )}
      {completed && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => document.getElementById('studio-hero-result-video')?.play?.()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-900"
          >
            <PlayCircle className="h-4 w-4" />
            Assistir
          </button>
          <a
            href={videoUrl}
            download="studio-hero-video.mp4"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-800"
          >
            <Download className="h-4 w-4" />
            Baixar
          </a>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Criar nova versao
          </button>
        </div>
      )}
      {completed && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">Textos prontos para divulgar</p>
          <div className="mt-4 grid gap-3">
            {deliveryTexts.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(item.text)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

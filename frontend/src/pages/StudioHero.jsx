import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Film,
  ImagePlus,
  Loader2,
  MessageSquareText,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { Button } from '../components/ui/Button'

const BUCKET = 'studio-videos'
const MAX_DIFFERENTIALS = 3
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const STUDIO_HERO_DEMO_VIDEO_URL = '/previews/studio-hero/moema-demo.mp4'

const IMAGE_SLOTS = [
  {
    key: 'image1',
    label: 'Imagem 1',
    helper: 'Abertura do video. Use fachada, portaria ou melhor imagem externa.',
    fileName: 'input-1',
  },
  {
    key: 'image2',
    label: 'Imagem 2',
    helper: 'Cena final. Use sala, lazer, varanda ou imagem mais bonita.',
    fileName: 'input-2',
  },
]

const OBJECTIVE_OPTIONS = [
  { id: 'sale', label: 'Venda de imovel', oferta: 'A VENDA' },
  { id: 'rent', label: 'Locacao de imovel', oferta: 'PARA LOCACAO' },
]

const SALE_PROPERTY_TYPES = ['APARTAMENTO', 'CASA', 'TERRENO', 'SALA COMERCIAL', 'LAJE COMERCIAL']
const RENT_PROPERTY_TYPES = ['APARTAMENTO', 'CASA', 'SALA COMERCIAL', 'LAJE COMERCIAL']

const SALE_RESIDENTIAL_STAGES = ['PRE-LANCAMENTO', 'LANCAMENTO', 'PRONTO PARA MORAR']
const SALE_COMMERCIAL_STAGES = ['PRE-LANCAMENTO', 'LANCAMENTO', 'PRONTO']

const SALE_APARTMENT_PROFILES = ['ECONOMICA / MCMV', 'MEDIO PADRAO', 'ALTO PADRAO']
const SALE_DEFAULT_PROFILES = ['MEDIO PADRAO', 'ALTO PADRAO']
const SALE_COMMERCIAL_PROFILES = ['COMERCIAL', 'ALTO PADRAO']

const RENT_RESIDENTIAL_PROFILES = ['RESIDENCIAL', 'ALTO PADRAO', 'PRONTO PARA MORAR']
const RENT_COMMERCIAL_PROFILES = ['COMERCIAL', 'ALTO PADRAO']

const CITIES = [
  'SAO PAULO',
  'SANTO ANDRE',
  'SAO BERNARDO',
  'CAMPINAS',
  'RIO DE JANEIRO',
  'CURITIBA',
  'FLORIANOPOLIS',
  'OUTRO',
]

const BEDROOM_OPTIONS = ['1 DORMITORIO', '2 DORMITORIOS', '3 DORMITORIOS', '4 DORMITORIOS']
const SUITE_OPTIONS = ['SEM SUITE', '1 SUITE', '2 SUITES', '3 SUITES', '4 SUITES']
const PARKING_OPTIONS = ['SEM VAGA', '1 VAGA', '2 VAGAS', '3 VAGAS', '4 VAGAS']
const AREA_OPTIONS = ['ATE 50 M2', '50 A 100 M2', '100 A 200 M2', 'ACIMA DE 200 M2']
const COMMERCIAL_ROOM_OPTIONS = ['1 SALA/CONJUNTO', '2 SALAS/CONJUNTOS', '3 SALAS/CONJUNTOS', 'ANDAR INTEIRO']
const BATHROOM_OPTIONS = ['1 BANHEIRO', '2 BANHEIROS', '3 BANHEIROS', '4 BANHEIROS OU MAIS']

const SALE_DIFFERENTIAL_OPTIONS = [
  'VARANDA GOURMET',
  'LAZER COMPLETO',
  'CONDOMINIO COMPLETO',
  'VISTA LIVRE',
  'PROXIMO AO METRO/TRANSPORTE',
  'PROXIMO A COMERCIO E SERVICOS',
  'PORTARIA 24H',
  'SEGURANCA',
  'AREA VERDE',
  'ACEITA FINANCIAMENTO',
]

const SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'LOCALIZACAO ESTRATEGICA',
  'PROXIMO AO METRO/TRANSPORTE',
  'PROXIMO A COMERCIO E SERVICOS',
  'FACIL ACESSO',
  'PREDIO CORPORATIVO',
  'RECEPCAO',
  'SEGURANCA/PORTARIA',
  'ESTACIONAMENTO',
  'INTERNET DE ULTIMA GERACAO',
  'INFRAESTRUTURA PARA EMPRESAS',
  'SALA DE REUNIAO',
  'AR-CONDICIONADO',
  'PISO ELEVADO',
  'GERADOR',
]

const RENT_DIFFERENTIAL_OPTIONS = [
  'DISPONIBILIDADE IMEDIATA',
  'MOBILIADO',
  'SEMIMOBILIADO',
  'ACEITA PET',
  'CONDOMINIO COMPLETO',
  'LAZER NO CONDOMINIO',
  'VARANDA',
  'VAGA DE GARAGEM',
  'PORTARIA 24H',
  'PROXIMO AO METRO/TRANSPORTE',
  'PROXIMO A COMERCIO E SERVICOS',
]

const RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS = [
  'DISPONIBILIDADE IMEDIATA',
  'LOCALIZACAO ESTRATEGICA',
  'PROXIMO AO METRO/TRANSPORTE',
  'FACIL ACESSO',
  'PREDIO CORPORATIVO',
  'RECEPCAO',
  'SEGURANCA/PORTARIA',
  'ESTACIONAMENTO',
  'INTERNET DE ULTIMA GERACAO',
  'INFRAESTRUTURA PARA EMPRESAS',
  'SALA DE REUNIAO',
  'AR-CONDICIONADO',
]

const RENT_CONDITION_OPTIONS = [
  'ACEITA SEGURO-FIANCA',
  'ACEITA DEPOSITO',
  'ACEITA FIADOR',
  'GARANTIA FACILITADA',
  'CONTRATO FLEXIVEL',
]

const SALE_CTA_OPTIONS = [
  'AGENDE SUA VISITA',
  'FALE COM UM CORRETOR',
  'SAIBA MAIS',
  'CONHECA O IMOVEL',
]

const SALE_LAUNCH_CTA_OPTIONS = [
  'GARANTA SUA UNIDADE',
  'SIMULE AGORA',
  'SAIBA MAIS',
  'FALE COM UM CORRETOR',
]

const RENT_CTA_OPTIONS = [
  'AGENDE SUA VISITA',
  'FALE COM UM CORRETOR',
  'QUERO CONHECER',
  'VER DISPONIBILIDADE',
  'SAIBA MAIS',
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
}

function getUploadContentType(file) {
  const rawType = String(file?.type || '').toLowerCase()
  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()

  if (rawType === 'image/jpg') return 'image/jpeg'
  if (SUPPORTED_IMAGE_TYPES.has(rawType)) return rawType
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'

  return ''
}

function getFileExtensionFromContentType(contentType) {
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return 'jpg'
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

function getLocationValue(value, other = '') {
  return value === 'OUTRO' ? normalizeFreeText(other) : normalizeFreeText(value)
}

function isCommercialType(type) {
  return type === 'SALA COMERCIAL' || type === 'LAJE COMERCIAL'
}

function isLandType(type) {
  return type === 'TERRENO'
}

function getPropertyTypeOptions(objective) {
  return objective === 'rent' ? RENT_PROPERTY_TYPES : SALE_PROPERTY_TYPES
}

function getProfileOptions(answers) {
  if (answers.objective === 'rent') {
    return isCommercialType(answers.propertyType) ? RENT_COMMERCIAL_PROFILES : RENT_RESIDENTIAL_PROFILES
  }
  if (answers.propertyType === 'APARTAMENTO') return SALE_APARTMENT_PROFILES
  if (isCommercialType(answers.propertyType)) return SALE_COMMERCIAL_PROFILES
  return SALE_DEFAULT_PROFILES
}

function getStageOptions(answers) {
  return isCommercialType(answers.propertyType) ? SALE_COMMERCIAL_STAGES : SALE_RESIDENTIAL_STAGES
}

function getDifferentialOptions(answers) {
  if (answers.objective === 'rent') {
    return isCommercialType(answers.propertyType)
      ? RENT_COMMERCIAL_DIFFERENTIAL_OPTIONS
      : RENT_DIFFERENTIAL_OPTIONS
  }

  return isCommercialType(answers.propertyType)
    ? SALE_COMMERCIAL_DIFFERENTIAL_OPTIONS
    : SALE_DIFFERENTIAL_OPTIONS
}

function getCtaOptions(answers) {
  if (answers.objective === 'rent') return RENT_CTA_OPTIONS
  if (answers.stage === 'PRE-LANCAMENTO' || answers.stage === 'LANCAMENTO') return SALE_LAUNCH_CTA_OPTIONS
  return SALE_CTA_OPTIONS
}

function getConfiguration(answers) {
  if (isLandType(answers.propertyType)) {
    return [answers.area].filter(Boolean).join(', ')
  }

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
    answers.city,
    answers.district,
    getConfiguration(answers),
    ...answers.differentials,
    ...answers.rentConditions,
  ].filter(Boolean)
  return [...new Set(items)].join(', ')
}

function getObjectiveLabel(objectiveId) {
  return OBJECTIVE_OPTIONS.find((item) => item.id === objectiveId)?.label || ''
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

  console.info('studio_hero_function_response', {
    functionName: name,
    status: response.status,
    ok: response.ok,
    body: responseBody,
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
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState(initialAnswers)
  const [files, setFiles] = useState({ image1: null, image2: null })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const isSale = answers.objective === 'sale'
  const isRent = answers.objective === 'rent'
  const propertyTypeOptions = getPropertyTypeOptions(answers.objective)
  const profileOptions = getProfileOptions(answers)
  const stageOptions = getStageOptions(answers)
  const differentialOptions = getDifferentialOptions(answers)
  const ctaOptions = getCtaOptions(answers)
  const cityValue = getLocationValue(answers.city, answers.cityOther)
  const districtValue = normalizeFreeText(answers.district)
  const configuration = getConfiguration(answers)
  const finalFeatures = getFinalFeatureText({
    ...answers,
    city: cityValue,
    district: districtValue,
  })
  const isGenerating = ['uploading', 'generating'].includes(status)
  const locationStep = isSale ? 5 : 4
  const configurationStep = locationStep + 1
  const differentialsStep = configurationStep + 1
  const rentConditionsStep = isRent ? differentialsStep + 1 : null
  const ctaStep = isRent ? differentialsStep + 2 : differentialsStep + 1
  const uploadStep = ctaStep + 1
  const reviewStep = uploadStep + 1

  const canGenerate = Boolean(
    answers.objective &&
    answers.propertyType &&
    (!isSale || answers.stage) &&
    answers.profile &&
    cityValue &&
    districtValue &&
    configuration &&
    answers.differentials.length > 0 &&
    answers.cta &&
    files.image1 &&
    files.image2
  )

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
    }))
    setStep(3)
  }

  const updateProfile = (profile) => {
    resetGenerationState()
    setAnswers((current) => ({
      ...current,
      profile,
      differentials: [],
      rentConditions: [],
      cta: '',
    }))
    setStep(isSale ? 4 : locationStep)
  }

  const updateAnswer = (field, value, nextStep = step + 1) => {
    resetGenerationState()
    setAnswers((current) => ({ ...current, [field]: value }))
    if (nextStep) setStep(nextStep)
  }

  const toggleDifferential = (item) => {
    resetGenerationState()
    setAnswers((current) => {
      const selected = current.differentials.includes(item)
      if (selected) {
        return {
          ...current,
          differentials: current.differentials.filter((value) => value !== item),
        }
      }
      if (current.differentials.length >= MAX_DIFFERENTIALS) return current
      return {
        ...current,
        differentials: [...current.differentials, item],
      }
    })
  }

  const toggleRentCondition = (item) => {
    resetGenerationState()
    setAnswers((current) => {
      const selected = current.rentConditions.includes(item)
      return {
        ...current,
        rentConditions: selected
          ? current.rentConditions.filter((value) => value !== item)
          : [...current.rentConditions, item],
      }
    })
  }

  const uploadImage = async (slot, file, jobDraftId) => {
    const contentType = getUploadContentType(file)

    if (!contentType) {
      throw new Error(`${slot.label}: envie uma imagem JPG, PNG ou WebP.`)
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
      console.error('studio_hero_upload_error', {
        bucket: BUCKET,
        path,
        slot: slot.key,
        contentType,
        fileType: file.type || '',
        fileName: file.name || '',
        fileSize: file.size || 0,
        message: error.message,
        error,
      })
      throw new Error(`Falha no upload de ${slot.label}. Verifique se a imagem e JPG, PNG ou WebP e tente novamente.`)
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

  function resetGenerationState() {
    clearPolling()
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
  }

  const pollVideoStatus = async (nextJobId) => {
    if (!nextJobId) return

    try {
      const result = await invokeStudioFunction('get-video-job-status', { jobId: nextJobId })
      const data = result.body

      if (!result.ok) throw new Error(data?.error || 'Falha ao consultar video.')
      if (!data?.ok) throw new Error(data?.error || 'Video ainda nao disponivel.')

      if (data.status === 'completed') {
        clearPolling()
        setStatus('completed')
        setVideoUrl(data.signedVideoUrl || '')
        setMessage('Video pronto para revisar.')
        return
      }

      if (data.status === 'failed') {
        clearPolling()
        setStatus('failed')
        setMessage(data.error || 'Nao foi possivel gerar o video agora.')
        return
      }

      setStatus('generating')
      setMessage(data.message || 'Video em criacao. Atualizando automaticamente.')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      clearPolling()
      console.error('studio_hero_status_error', {
        jobId: nextJobId,
        message: error instanceof Error ? error.message : String(error),
        error,
      })
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel consultar o video agora.')
    }
  }

  const handleGenerate = async () => {
    if (!user?.id || !canGenerate) return

    clearPolling()
    setStatus('uploading')
    setMessage('Preparando imagens com seguranca...')
    setVideoUrl('')

    try {
      const draftId = crypto.randomUUID()
      const [inputImage1Path, inputImage2Path] = await Promise.all([
        uploadImage(IMAGE_SLOTS[0], files.image1, draftId),
        uploadImage(IMAGE_SLOTS[1], files.image2, draftId),
      ])

      setStatus('generating')
      setMessage('Criando seu video. Isso pode levar alguns instantes.')

      const result = await invokeStudioFunction('criar-video-ia', {
        style: answers.profile || 'ALTO PADRAO',
        bairro: districtValue,
        caracteristica: finalFeatures,
        oferta: answers.oferta,
        cta: answers.cta,
        jobId: draftId,
        inputImage1Path,
        inputImage2Path,
      })
      const data = result.body

      if (!result.ok) {
        throw new Error(data?.error || 'Falha ao iniciar video.')
      }
      if (!data?.ok && !data?.success) throw new Error(data?.error || 'Video ainda nao disponivel neste ambiente.')

      const nextJobId = data.jobId || data.job_id || draftId
      setVideoUrl('')
      setStatus('generating')
      setMessage(data.message || 'Video em criacao. Atualizando automaticamente.')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      console.error('studio_hero_generate_error', {
        message: error instanceof Error ? error.message : String(error),
        error,
      })
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o video agora.')
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] bg-primary-950 text-white shadow-xl">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Film className="h-4 w-4" />
                Studio Hero IA
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Olá! 👋
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black text-white">
                Sou sua assistente de criação de vídeos.
              </p>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-200">
                Juntos vamos transformar imagens estáticas em um vídeo com movimento, som e efeitos para destacar seu imóvel e chamar mais atenção nas redes sociais.
              </p>
              <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-200">
                Você não precisa escrever prompts nem entender de IA.
              </p>
              <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-200">
                Eu vou te guiar em cada etapa.
              </p>
              <p className="mt-5 max-w-2xl text-lg font-black text-white">
                Vamos começar?
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <p className="font-black">O que a IA vai fazer?</p>
              </div>
              <ul className="mt-5 space-y-4 text-sm font-bold leading-6 text-slate-100">
                {[
                  'Transformar imagens em vídeo',
                  'Adicionar movimento cinematográfico',
                  'Criar atmosfera e ritmo visual',
                  'Gerar uma nova versão exclusiva para divulgação',
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
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">Exemplo real</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Veja o que a IA pode criar
              </h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                Exemplo de vídeo criado a partir da nossa conversa e das imagens do imóvel.
              </p>
              <p className="mt-3 max-w-xl text-xs font-semibold leading-5 text-slate-500">
                Cada vídeo criado pela IA é único. Novas gerações podem produzir resultados diferentes, mesmo utilizando as mesmas imagens e informações.
              </p>
            </div>
            <div className="mx-auto w-full max-w-2xl rounded-[1.75rem] border border-slate-200 bg-slate-950 p-2 shadow-2xl shadow-slate-200/80">
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
          <AssistantStep number={1} message="O que deseja divulgar?">
            <OptionGrid>
              {OBJECTIVE_OPTIONS.map((option) => (
                <ChoiceButton
                  key={option.id}
                  active={answers.objective === option.id}
                  title={option.label}
                  description={option.id === 'sale' ? 'Oferta de venda com CTA comercial.' : 'Campanha objetiva para locacao.'}
                  onClick={() => updateObjective(option)}
                />
              ))}
            </OptionGrid>
          </AssistantStep>

          {answers.objective && (
            <UserReply onEdit={() => setStep(1)}>
              <strong>{getObjectiveLabel(answers.objective)}</strong>
              <span>{answers.oferta}</span>
            </UserReply>
          )}

          {answers.objective && (
            <AssistantStep number={2} message="Que tipo de imovel vamos divulgar?">
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

          {answers.propertyType && (
            <UserReply onEdit={() => setStep(2)}>
              <strong>{answers.propertyType}</strong>
              <span>Tipo de imovel definido para o video.</span>
            </UserReply>
          )}

          {answers.propertyType && (
            <AssistantStep number={3} message="Qual e o perfil comercial deste imovel?">
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

          {answers.profile && (
            <UserReply onEdit={() => setStep(3)}>
              <strong>{answers.profile}</strong>
              <span>Perfil usado para orientar ritmo, tom e oferta.</span>
            </UserReply>
          )}

          {isSale && answers.profile && (
            <AssistantStep number={4} message="Qual e o estagio da obra?">
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

          {isSale && answers.stage && (
            <UserReply onEdit={() => setStep(4)}>
              <strong>{answers.stage}</strong>
              <span>Estagio considerado na estrategia do video.</span>
            </UserReply>
          )}

          {answers.profile && (!isSale || answers.stage) && (
            <AssistantStep number={locationStep} message="Onde fica o imovel?">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cidade</p>
                  <ChipGrid className="mt-3">
                    {CITIES.map((option) => (
                      <ChipButton
                        key={option}
                        active={answers.city === option}
                        onClick={() => {
                          resetGenerationState()
                          setAnswers((current) => ({ ...current, city: option }))
                        }}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  {answers.city === 'OUTRO' && (
                    <input
                      value={answers.cityOther}
                      onChange={(event) => {
                        resetGenerationState()
                        setAnswers((current) => ({ ...current, cityOther: normalizeFreeText(event.target.value) }))
                      }}
                      placeholder="DIGITE A CIDADE"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  )}
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
                  <Button type="button" disabled={!cityValue || !districtValue} onClick={() => setStep(configurationStep)}>
                    Confirmar localizacao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {cityValue && districtValue && step >= configurationStep && (
            <UserReply onEdit={() => setStep(locationStep)}>
              <strong>{districtValue}</strong>
              <span>{cityValue}</span>
            </UserReply>
          )}

          {cityValue && districtValue && step >= configurationStep && (
            <AssistantStep number={configurationStep} message="Qual e a configuracao do imovel?">
              <div className="space-y-5">
                {isLandType(answers.propertyType) ? (
                  <OptionGroup title="Area do terreno" options={AREA_OPTIONS} value={answers.area} onSelect={(value) => updateAnswer('area', value, null)} />
                ) : isCommercialType(answers.propertyType) ? (
                  <>
                    <OptionGroup title="Salas ou conjuntos" options={COMMERCIAL_ROOM_OPTIONS} value={answers.commercialRooms} onSelect={(value) => updateAnswer('commercialRooms', value, null)} />
                    <OptionGroup title="Banheiros" options={BATHROOM_OPTIONS} value={answers.bathrooms} onSelect={(value) => updateAnswer('bathrooms', value, null)} />
                    <OptionGroup title="Vagas" options={PARKING_OPTIONS} value={answers.parking} onSelect={(value) => updateAnswer('parking', value, null)} />
                    <OptionGroup title="Metragem" options={AREA_OPTIONS} value={answers.area} onSelect={(value) => updateAnswer('area', value, null)} />
                  </>
                ) : (
                  <>
                    <OptionGroup title="Dormitorios" options={BEDROOM_OPTIONS} value={answers.bedrooms} onSelect={(value) => updateAnswer('bedrooms', value, null)} />
                    <OptionGroup title="Suites" options={SUITE_OPTIONS} value={answers.suites} onSelect={(value) => updateAnswer('suites', value, null)} />
                    <OptionGroup title="Vagas" options={PARKING_OPTIONS} value={answers.parking} onSelect={(value) => updateAnswer('parking', value, null)} />
                  </>
                )}
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Configuracao montada</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{configuration || 'Selecione os dados principais desta configuracao.'}</p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!configuration} onClick={() => setStep(differentialsStep)}>
                    Confirmar configuracao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {configuration && step >= differentialsStep && (
            <UserReply onEdit={() => setStep(configurationStep)}>
              <strong>{configuration}</strong>
              <span>Configuracao principal do imovel.</span>
            </UserReply>
          )}

          {configuration && step >= differentialsStep && (
            <AssistantStep number={differentialsStep} message="Quais diferenciais quer destacar?">
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-600">Escolha ate {MAX_DIFFERENTIALS} diferenciais.</p>
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
                    {answers.differentials.length}/{MAX_DIFFERENTIALS} selecionados
                  </span>
                  <Button
                    type="button"
                    disabled={answers.differentials.length === 0}
                    onClick={() => setStep(isRent ? rentConditionsStep : ctaStep)}
                  >
                    Confirmar diferenciais
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {answers.differentials.length > 0 && step >= (isRent ? rentConditionsStep : ctaStep) && (
            <UserReply onEdit={() => setStep(differentialsStep)}>
              <strong>{answers.differentials.join(', ')}</strong>
              <span>Diferenciais que vao orientar o video.</span>
            </UserReply>
          )}

          {isRent && answers.differentials.length > 0 && step >= rentConditionsStep && (
            <AssistantStep number={rentConditionsStep} message="Quais condicoes comerciais deseja destacar?">
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-600">Opcional. Voce pode continuar sem escolher.</p>
                <ChipGrid>
                  {RENT_CONDITION_OPTIONS.map((option) => (
                    <ChipButton
                      key={option}
                      active={answers.rentConditions.includes(option)}
                      onClick={() => toggleRentCondition(option)}
                    >
                      {option}
                    </ChipButton>
                  ))}
                </ChipGrid>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(ctaStep)}>
                    Continuar
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {isRent && step >= ctaStep && (
            <UserReply onEdit={() => setStep(rentConditionsStep)}>
              <strong>{answers.rentConditions.length > 0 ? answers.rentConditions.join(', ') : 'Sem condicao comercial destacada'}</strong>
              <span>Condicoes opcionais para o video.</span>
            </UserReply>
          )}

          {answers.differentials.length > 0 && step >= ctaStep && (
            <AssistantStep number={ctaStep} message="Qual chamada final deseja usar?">
              <ChipGrid>
                {ctaOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.cta === option}
                    onClick={() => updateAnswer('cta', option, uploadStep)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {answers.cta && (
            <UserReply onEdit={() => setStep(ctaStep)}>
              <strong>{answers.cta}</strong>
              <span>CTA final do video.</span>
            </UserReply>
          )}

          {answers.cta && (
            <AssistantStep number={uploadStep} message="Agora envie as imagens que vao dar vida ao video.">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {IMAGE_SLOTS.map((slot) => (
                    <FilePicker
                      key={slot.key}
                      slot={slot}
                      file={files[slot.key]}
                      onChange={(file) => {
                        resetGenerationState()
                        setFiles((current) => ({ ...current, [slot.key]: file }))
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!files.image1 || !files.image2} onClick={() => setStep(reviewStep)}>
                    Revisar campanha
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {files.image1 && files.image2 && step >= reviewStep && (
            <UserReply onEdit={() => setStep(uploadStep)}>
              <strong>Imagens selecionadas</strong>
              <span>{files.image1.name}</span>
              <span>{files.image2.name}</span>
            </UserReply>
          )}

          {canGenerate && step >= reviewStep && (
            <AssistantStep number="Revisao" message="Confira as escolhas antes de gerar.">
              <StudioChecklist
                answers={answers}
                cityValue={cityValue}
                districtValue={districtValue}
                configuration={configuration}
                files={files}
                canGenerate={canGenerate}
                isGenerating={isGenerating}
                status={status}
                message={message}
                videoUrl={videoUrl}
                onEdit={setStep}
                onGenerate={handleGenerate}
              />
            </AssistantStep>
          )}

          {(status !== 'idle' || videoUrl) && (
            <ResultPanel status={status} message={message} videoUrl={videoUrl} />
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

function AssistantStep({ number, message, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-950 text-cyan-100">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary-800">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-slate-400">Assistente de video</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">{message}</h2>
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
        className="max-w-2xl rounded-3xl bg-primary-950 px-5 py-4 text-left text-white shadow-sm transition hover:bg-primary-900"
      >
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
          <span className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-100">Editar resposta</span>
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
        active ? 'border-primary-950 bg-primary-950 text-white' : 'border-slate-200 bg-white hover:border-primary-400'
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
          ? 'border-primary-950 bg-primary-950 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-primary-400'
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

function FilePicker({ slot, file, onChange }) {
  return (
    <label className="group flex cursor-pointer flex-col gap-4 rounded-3xl border border-dashed border-primary-200 bg-white p-5 shadow-sm transition hover:border-primary-400 hover:bg-primary-50/40">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
      <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt={`${slot.label} selecionada`}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <UploadCloud className="h-8 w-8" />
            <span className="text-xs font-bold">Selecionar imagem</span>
          </div>
        )}
      </div>
      <p className="min-h-4 truncate text-xs font-bold text-slate-500">{file?.name || ' '}</p>
    </label>
  )
}

function StudioChecklist({ answers, cityValue, districtValue, configuration, files, canGenerate, isGenerating, status, message, videoUrl, onEdit, onGenerate }) {
  const isSale = answers.objective === 'sale'
  const isRent = answers.objective === 'rent'
  const locationStep = isSale ? 5 : 4
  const configurationStep = locationStep + 1
  const differentialsStep = configurationStep + 1
  const rentConditionsStep = isRent ? differentialsStep + 1 : null
  const ctaStep = isRent ? differentialsStep + 2 : differentialsStep + 1
  const uploadStep = ctaStep + 1
  const rows = [
    ['Objetivo', getObjectiveLabel(answers.objective), 1],
    ['Tipo', answers.propertyType, 2],
    ['Perfil', answers.profile, 3],
    ...(isSale ? [['Estagio da obra', answers.stage, 4]] : []),
    ['Cidade', cityValue, locationStep],
    ['Bairro', districtValue, locationStep],
    ['Configuracao', configuration, configurationStep],
    ['Diferenciais', answers.differentials.join(', '), differentialsStep],
    ...(isRent ? [['Condicoes comerciais', answers.rentConditions.join(', ') || 'Nao destacar', rentConditionsStep]] : []),
    ['CTA', answers.cta, ctaStep],
    ['Imagem 1', files.image1?.name, uploadStep],
    ['Imagem 2', files.image2?.name, uploadStep],
  ].filter((row) => row[2])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value, editStep]) => (
          <button
            key={label}
            type="button"
            onClick={() => onEdit(editStep)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/60"
          >
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-primary-700">Editar</p>
          </button>
        ))}
      </div>

      {status === 'failed' && message && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {videoUrl ? 'Video criado com sucesso.' : 'Pronto para gerar seu video?'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {message || 'A campanha sera criada com as escolhas acima.'}
          </p>
          <p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-slate-500">
            Cada vídeo é criado de forma única pela IA. Mesmo utilizando as mesmas imagens e informações, novas gerações podem apresentar cenas, movimentos e resultados diferentes.
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="justify-center">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando video
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Gerar video
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ResultPanel({ status, message, videoUrl }) {
  const completed = Boolean(videoUrl)
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resultado</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {completed ? 'Video pronto para revisar' : 'Video em preparacao'}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {message || 'O video aparecera aqui quando estiver pronto.'}
          </p>
        </div>
        {completed ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        ) : (
          <Film className="h-6 w-6 shrink-0 text-slate-300" />
        )}
      </div>
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
        <div className="flex aspect-[9/16] max-h-[620px] items-center justify-center">
          {videoUrl ? (
            <video src={videoUrl} controls className="h-full w-full object-contain" />
          ) : (
            <div className="px-6 text-center">
              {status === 'generating' || status === 'uploading' ? (
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-700" />
              ) : (
                <Film className="mx-auto h-10 w-10 text-slate-300" />
              )}
              <p className="mt-3 text-sm font-bold text-slate-500">
                {status === 'failed' ? 'Nao foi possivel criar o video agora.' : 'Aguardando resultado.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

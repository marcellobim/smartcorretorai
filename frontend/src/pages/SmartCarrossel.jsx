import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import CampaignPackage from '../components/campaign/CampaignPackage'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import SmartCarouselCitySelect, { SmartCarouselStateSelect, SmartLocationTextInput } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation from '../components/conversation/GuidedConversation'
import {
  ProductButton,
  ProductCard,
  ProductHero,
  ProductSectionHeading,
  ProductSteps,
  SMART_UI,
} from '../components/design-system'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useProductDraft } from '../hooks/useProductDraft'
import { toFileMetadata } from '../lib/product-draft'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'

const SMART_CAROUSEL_MAX_FILE_BYTES = 15 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const SMART_CAROUSEL_BUCKET = 'studio-videos'
const SMART_CAROUSEL_FUNCTION = 'smart-carousel-creatomate'
const SMART_CAROUSEL_POLL_INTERVAL_MS = 4000
const SMART_CAROUSEL_UPLOAD_TIMEOUT_MS = 2 * 60 * 1000
const SMART_CAROUSEL_FUNCTION_TIMEOUT_MS = 2 * 60 * 1000
const SMART_CAROUSEL_MAX_HIGHLIGHTS = 10
const SMART_CAROUSEL_MIN_IMAGES = 5
const SMART_CAROUSEL_MAX_IMAGES = 20
const SMART_CAROUSEL_MIN_IMAGES_MESSAGE = 'Selecione pelo menos 5 imagens para criar uma apresentação de qualidade.'
const SMART_CAROUSEL_HERO_VIDEO = '/showcase/smartcarrossel/showcase-carrossel.mp4'
const SMART_CAROUSEL_STEPS = [
  { title: 'Fotos', subtitle: 'Selecione e organize' },
  { title: 'Informações', subtitle: 'Preencha os dados' },
  { title: 'Criar apresentação', subtitle: 'Prepare sua apresentação' },
  { title: 'Preview', subtitle: 'Confira o resultado' },
]

function normalizeDistrictName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])([\p{L}])/gu, (_, separator, letter) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`)
}

function getRecoveredPhotosMessage(count) {
  return `Seu progresso foi recuperado. Selecione novamente ${count} ${count === 1 ? 'foto' : 'fotos'} para continuar.`
}

function smartCarouselConfirmation(step, answer) {
  if (step === 1) return answer === 'Locação' ? 'Perfeito! Vamos criar uma apresentação para divulgar a locação desse imóvel.' : 'Perfeito! Vamos criar uma apresentação para apoiar a venda desse imóvel.'
  const confirmations = {
    2: `Ótimo! Vamos considerar o imóvel como “${answer}”.`,
    3: `Perfeito! O tipo “${answer}” já está registrado.`,
    4: `Certo! Registrei ${answer} dormitório${answer === '1' ? '' : 's'}.`,
    5: `Ótimo! Registrei ${answer} suíte${answer === '1' ? '' : 's'}.`,
    6: `Perfeito! Registrei ${answer} vaga${answer === '1' ? '' : 's'}.`,
    7: `Ótimo! O imóvel fica em ${answer}.`,
    8: `Perfeito! A cidade escolhida é ${answer}.`,
    9: `Certo! Localização registrada no bairro ${answer}.`,
    10: answer === 'Sem preço' ? 'Tudo bem! A apresentação seguirá sem informar o preço.' : `Perfeito! O preço será apresentado como ${answer}.`,
    11: `Ótimo! A área informada é ${answer}.`,
    12: `Excelente! ${answer} foram selecionados para valorizar o imóvel.`,
    13: `Perfeito! A chamada final será “${answer}”.`,
    14: answer === 'Telefone profissional' ? 'Ótimo! Seu telefone profissional será incluído.' : 'Tudo certo! A apresentação seguirá sem telefone.',
  }
  return confirmations[step] || 'Perfeito! Informação registrada.'
}

const SMART_CAROUSEL_PROPERTY_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Terreno / Lote']
const SMART_CAROUSEL_CTA_OPTIONS = [
  'Saiba Mais',
  'Agende sua visita',
  'Entre em contato agora',
  'Aguardo seu contato',
]
const SMART_CAROUSEL_CTA_ASSETS = {
  'Saiba Mais': '/studio-hero/cta/cta-saiba-mais.png',
  'Agende sua visita': '/studio-hero/cta/cta-agende-sua-visita.png',
  'Entre em contato agora': '/studio-hero/cta/cta-entre-em-contato-agora.png',
  'Aguardo seu contato': '/studio-hero/cta/cta-aguardo-seu-contato.png',
}
const SMART_CAROUSEL_HIGHLIGHT_GROUPS = [
  {
    title: 'Localização e conveniência',
    items: [
      'Próximo ao metrô', 'Próximo ao trem', 'Próximo ao shopping', 'Próximo a escolas',
      'Próximo a universidades', 'Próximo a hospitais', 'Próximo a mercados',
      'Fácil acesso às principais vias', 'Bairro valorizado', 'Região em crescimento', 'Vista livre',
    ],
  },
  {
    title: 'Condomínio e lazer',
    items: [
      'Lazer completo', 'Piscina', 'Academia', 'Salão de festas', 'Espaço gourmet', 'Churrasqueira',
      'Coworking', 'Pet place', 'Playground', 'Brinquedoteca', 'Quadra esportiva',
      'Quadra de tênis ou beach tennis', 'Bicicletário', 'Portaria 24h', 'Segurança 24h', 'Lounge',
      'Mini mercado', 'Lavanderia', 'Piscina aquecida ou climatizada', 'Conveniência', 'Áreas verdes',
      'Rooftop', 'Espaço delivery', 'Locker para encomendas', 'Espaço wellness', 'Spa ou sauna',
    ],
  },
  {
    title: 'Serviços e facilidades',
    items: [
      'Serviços tipo hotelaria', 'Manobrista', 'Ponto de carregamento para carros elétricos',
      'Depósito privativo por unidade', 'Vagas demarcadas',
    ],
  },
  {
    title: 'Características do imóvel',
    items: [
      'Varanda', 'Varanda gourmet', 'Suíte', 'Closet', 'Planta inteligente', 'Ambientes integrados',
      'Cozinha americana', 'Acabamento premium', 'Iluminação natural', 'Vista panorâmica',
    ],
  },
  {
    title: 'Condição comercial simples',
    items: [
      'Aceita financiamento', 'Usa FGTS', 'Entrada facilitada', 'Subsídio do governo',
      'Documentação em ordem', 'Últimas unidades', 'Condições especiais', 'Alto potencial de valorização',
    ],
  },
].map((group) => ({ ...group, items: Array.from(new Set(group.items)) }))

function getPhotoExtension(file) {
  return file?.type === 'image/png' ? 'png' : 'jpg'
}

function isValidSmartCarouselReceipt(value) {
  return typeof value === 'string'
    && value.length > 20
    && value.length <= 2048
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

async function waitWithTimeout(promise, timeoutMs, message) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function invokeSmartCarouselFunction(accessToken, body) {
  if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente para continuar.')

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), SMART_CAROUSEL_FUNCTION_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/${SMART_CAROUSEL_FUNCTION}`, {
      method: 'POST',
      headers: {
        apikey: supabase.supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Não foi possível continuar. Tente novamente.')
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A solicitação demorou mais que o esperado. Tente novamente.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function removeUploadedJobFiles(paths) {
  const safePaths = Array.from(new Set(paths)).filter((path) => typeof path === 'string' && path.includes('/smart-carousel/'))
  if (!safePaths.length) return
  await supabase.storage.from(SMART_CAROUSEL_BUCKET).remove(safePaths)
}

async function uploadSmartCarouselFiles({ photos, userId, jobId, cta }) {
  const prefix = `${userId}/smart-carousel/${jobId}`
  const uploadedPaths = []
  const imagePaths = []

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index]
      const extension = getPhotoExtension(photo.file)
      const path = `${prefix}/photo-${String(index + 1).padStart(2, '0')}.${extension}`
      const { error } = await supabase.storage.from(SMART_CAROUSEL_BUCKET).upload(path, photo.file, {
        cacheControl: '3600',
        contentType: photo.file.type,
        upsert: false,
      })
      if (error) throw new Error('Não foi possível enviar todas as fotos. Tente novamente.')
      uploadedPaths.push(path)
      imagePaths.push(path)
    }

    const ctaAsset = SMART_CAROUSEL_CTA_ASSETS[cta]
    if (!ctaAsset) throw new Error('Escolha uma chamada final válida.')
    const ctaResponse = await fetch(ctaAsset)
    if (!ctaResponse.ok) throw new Error('Não foi possível preparar a chamada final.')
    const ctaBlob = await ctaResponse.blob()
    const ctaFileName = ctaAsset.split('/').pop()
    const ctaPath = `${prefix}/${ctaFileName}`
    const { error: ctaError } = await supabase.storage.from(SMART_CAROUSEL_BUCKET).upload(ctaPath, ctaBlob, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: false,
    })
    if (ctaError) throw new Error('Não foi possível preparar a chamada final.')
    uploadedPaths.push(ctaPath)

    return { imagePaths, ctaPath, uploadedPaths }
  } catch (error) {
    await removeUploadedJobFiles(uploadedPaths)
    throw error
  }
}

async function uploadSmartCarouselFilesWithTimeout(args) {
  const uploadPromise = uploadSmartCarouselFiles(args)

  try {
    return await waitWithTimeout(
      uploadPromise,
      SMART_CAROUSEL_UPLOAD_TIMEOUT_MS,
      'O envio das fotos demorou mais que o esperado. Tente novamente.',
    )
  } catch (error) {
    uploadPromise
      .then(({ uploadedPaths }) => removeUploadedJobFiles(uploadedPaths))
      .catch(() => {})
    throw error
  }
}

export default function SmartCarrossel() {
  const navigate = useNavigate()
  const { user, accessToken, reloadProfile } = useAuth()
  const mediaDraft = useProductDraft({ productKey: 'smart-carousel:media', schemaVersion: 1, userId: user?.id })
  const flowDraft = useProductDraft({ productKey: 'smart-carousel:flow', schemaVersion: 1, userId: user?.id })
  const restoredMediaDraft = mediaDraft.restoredDraft
  const photoInputRef = useRef(null)
  const photoIdRef = useRef(0)
  const photosRef = useRef([])
  const [photos, setPhotos] = useState([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [generationStage, setGenerationStage] = useState(1)
  const [informationStarted, setInformationStarted] = useState(false)
  const [photoSelectionMessage, setPhotoSelectionMessage] = useState('')
  const [missingPhotoMetadata, setMissingPhotoMetadata] = useState(() => restoredMediaDraft?.photoMetadata || [])
  const [conversationGenerationStatus, setConversationGenerationStatus] = useState('idle')

  useEffect(() => {
    const photoMetadata = photos.length
      ? photos.map((photo, index) => toFileMetadata(photo.file, index)).filter(Boolean)
      : missingPhotoMetadata
    if (!photoMetadata.length) { mediaDraft.clear(); return }
    mediaDraft.save({ photoMetadata, informationStarted, generationStage })
  }, [generationStage, informationStarted, mediaDraft, missingPhotoMetadata, photos])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    if (photos.length >= SMART_CAROUSEL_MIN_IMAGES) return
    setInformationStarted(false)
    setGenerationStage(1)
  }, [photos.length])

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
  }, [])

  const addPhotos = (fileList) => {
    const selectedFiles = Array.from(fileList || []).filter((file) => (
      SUPPORTED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= SMART_CAROUSEL_MAX_FILE_BYTES
    ))
    if (!selectedFiles.length) return

    const current = photosRef.current
    const existingFiles = new Set(current.map(({ file }) => `${file.name}-${file.size}-${file.lastModified}`))
    const uniqueFiles = selectedFiles.filter((file) => {
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`
      if (existingFiles.has(fileKey)) return false
      existingFiles.add(fileKey)
      return true
    })
    const availableSlots = Math.max(SMART_CAROUSEL_MAX_IMAGES - current.length, 0)
    const acceptedFiles = uniqueFiles.slice(0, availableSlots)
    const rejectedCount = uniqueFiles.length - acceptedFiles.length
    const newPhotos = acceptedFiles.map((file) => ({
      id: `smart-carousel-photo-${photoIdRef.current += 1}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    const nextPhotos = [...current, ...newPhotos]

    photosRef.current = nextPhotos
    setPhotos(nextPhotos)
    setMissingPhotoMetadata([])
    setPhotoSelectionMessage(rejectedCount > 0
      ? `O limite é de ${SMART_CAROUSEL_MAX_IMAGES} imagens. ${rejectedCount === 1 ? 'A imagem excedente não foi adicionada.' : `${rejectedCount} imagens excedentes não foram adicionadas.`}`
      : '')
  }

  const handlePhotoInput = (event) => {
    addPhotos(event.target.files)
    event.target.value = ''
  }

  const removePhoto = (photoId) => {
    setPhotoSelectionMessage('')
    setPhotos((current) => {
      const photo = current.find((item) => item.id === photoId)
      if (photo) URL.revokeObjectURL(photo.previewUrl)
      return current.filter((item) => item.id !== photoId)
    })
  }

  const clearPhotos = () => {
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
      return []
    })
    setGenerationStage(1)
    setInformationStarted(false)
    setPhotoSelectionMessage('')
    setMissingPhotoMetadata([])
    mediaDraft.clear()
  }

  const createNewPresentation = () => {
    if (['uploading', 'creating', 'polling'].includes(conversationGenerationStatus)) return

    const currentPhotos = photosRef.current
    photosRef.current = []
    currentPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    photoIdRef.current = 0
    setPhotos([])
    setIsDragActive(false)
    setGenerationStage(1)
    setInformationStarted(false)
    setPhotoSelectionMessage('')
    setMissingPhotoMetadata([])
    setConversationGenerationStatus('idle')
    mediaDraft.clear()
    flowDraft.clear()
  }

  const movePhoto = (index, direction) => {
    setPhotos((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const reordered = [...current]
      const movingPhoto = reordered[index]
      reordered[index] = reordered[targetIndex]
      reordered[targetIndex] = movingPhoto
      return reordered
    })
  }

  const informationUnlocked = informationStarted && photos.length >= SMART_CAROUSEL_MIN_IMAGES
  const currentStep = informationUnlocked ? Math.max(2, generationStage) : 1
  const hasPresentationState = photos.length > 0
    || missingPhotoMetadata.length > 0
    || Boolean(restoredMediaDraft)
    || Boolean(flowDraft.restoredDraft)
  const isGenerationActive = ['uploading', 'creating', 'polling'].includes(conversationGenerationStatus)

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_38%,#eef7fb_100%)] text-slate-900">
      <div className={`${SMART_UI.page} space-y-8`}>
        <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_52%,#ecfeff_100%)] text-slate-900 shadow-2xl shadow-emerald-100/70">
          <ProductHero
            id="smart-carousel-title"
            productName="Carrossel de Anúncios"
            headline="Apresentação Profissional"
            description="Transforme as fotos do seu imóvel em uma apresentação elegante, dinâmica e pronta para divulgação."
            actions={(
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {hasPresentationState && conversationGenerationStatus !== 'succeeded' && (
                  <ProductButton type="button" variant="ghost" disabled={isGenerationActive} onClick={createNewPresentation}>
                    <RotateCcw className="h-4 w-4" />Nova apresentação
                  </ProductButton>
                )}
                <ProductButton type="button" variant="secondary" onClick={() => navigate('/studio-hero')}>Escolher outro tipo de criação</ProductButton>
              </div>
            )}
            visual={<SmartCarouselHeroPhone />}
          />
        </section>

        <ProductSteps
          steps={SMART_CAROUSEL_STEPS}
          activeStep={currentStep}
          label="Etapas do Carrossel de Anúncios"
          accent="emerald"
        />

        <PhotoSection photos={photos} missingPhotoMetadata={missingPhotoMetadata} inputRef={photoInputRef} isDragActive={isDragActive} setIsDragActive={setIsDragActive} addPhotos={addPhotos} handlePhotoInput={handlePhotoInput} removePhoto={removePhoto} clearPhotos={clearPhotos} movePhoto={movePhoto} photoSelectionMessage={photoSelectionMessage} onContinue={() => setInformationStarted(true)} />
        {informationUnlocked && (
          <SmartCarouselConversation
            user={user}
            accessToken={accessToken}
            photos={photos}
            flowDraft={flowDraft}
            refreshBalance={reloadProfile}
            onGenerationStageChange={setGenerationStage}
            onGenerationStatusChange={setConversationGenerationStatus}
            onCreateNew={createNewPresentation}
          />
        )}
      </div>
    </main>
  )
}

function SmartCarouselHeroPhone() {
  return (
    <div className="flex h-full min-h-[290px] items-center justify-center" aria-label="Exemplo do Carrossel de Anúncios">
      <div className="w-full max-w-[190px] rounded-[2.2rem] bg-slate-950 p-2.5 shadow-2xl shadow-emerald-950/35 ring-1 ring-white/20">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.65rem] bg-slate-900">
          <video
            src={SMART_CAROUSEL_HERO_VIDEO}
            aria-label="Demonstração do Carrossel de Anúncios"
            autoPlay
            muted
            loop
            playsInline
            controls={false}
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(event) => event.preventDefault()}
            className="smart-phone-media pointer-events-none absolute inset-0 select-none"
          />
        </div>
      </div>
    </div>
  )
}

function PhotoSection({ photos, missingPhotoMetadata, inputRef, isDragActive, setIsDragActive, addPhotos, handlePhotoInput, removePhoto, clearPhotos, movePhoto, photoSelectionMessage, onContinue }) {
  const hasMinimumImages = photos.length >= SMART_CAROUSEL_MIN_IMAGES
  const missingImages = Math.max(SMART_CAROUSEL_MIN_IMAGES - photos.length, 0)
  const minimumImagesProgress = Math.min((photos.length / SMART_CAROUSEL_MIN_IMAGES) * 100, 100)

  return (
    <ProductCard className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-end">
          <ProductSectionHeading
            eyebrow="Etapa 1"
            title="1. Selecione e organize suas fotos"
            description="Adicione as fotos do imóvel e organize na ordem desejada para a apresentação."
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm font-bold leading-5 text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><span>A primeira foto será a <strong className="font-black text-emerald-700">CAPA</strong></span></div>
            <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm font-bold leading-5 text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg font-black text-emerald-600">↔</span><span>Você pode alterar a ordem a qualquer momento</span></div>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-8">
        <p className="mb-3 text-sm font-black text-slate-700">Mínimo de {SMART_CAROUSEL_MIN_IMAGES} imagens e máximo de {SMART_CAROUSEL_MAX_IMAGES} imagens.</p>
        <div
          aria-live="polite"
          className={`mb-5 rounded-2xl border px-4 py-3 sm:px-5 ${hasMinimumImages ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm font-black ${hasMinimumImages ? 'text-emerald-900' : 'text-amber-900'}`}>
              {hasMinimumImages
                ? 'Quantidade mínima atingida.'
                : `${photos.length} de ${SMART_CAROUSEL_MIN_IMAGES} imagens mínimas`}
            </p>
            <p className={`text-xs font-bold ${hasMinimumImages ? 'text-emerald-700' : 'text-amber-800'}`}>
              {hasMinimumImages
                ? `${photos.length} de ${SMART_CAROUSEL_MAX_IMAGES} imagens selecionadas`
                : `Adicione mais ${missingImages} ${missingImages === 1 ? 'imagem' : 'imagens'} para continuar.`}
            </p>
          </div>
          <div className={`mt-3 h-2 overflow-hidden rounded-full ${hasMinimumImages ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${hasMinimumImages ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${minimumImagesProgress}%` }}
            />
          </div>
        </div>
        {missingPhotoMetadata.length > 0 && <p role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">{getRecoveredPhotosMessage(missingPhotoMetadata.length)}</p>}
        {photoSelectionMessage && <p role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-800">{photoSelectionMessage}</p>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple onChange={handlePhotoInput} className="sr-only" />
        {photos.length === 0 ? (
          <div onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragActive(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragActive(false)} onDrop={(event) => { event.preventDefault(); setIsDragActive(false); addPhotos(event.dataTransfer.files) }} className={`group mt-7 flex min-h-[310px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-5 py-10 text-center outline-none transition sm:min-h-[340px] sm:px-8 ${isDragActive ? 'border-emerald-500 bg-emerald-100/70 shadow-inner' : 'border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.82),rgba(248,250,252,0.9))] hover:border-emerald-400 hover:bg-emerald-50/80 focus:ring-4 focus:ring-emerald-100'}`}>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-100 bg-white text-emerald-700 shadow-[0_18px_40px_-24px_rgba(5,150,105,0.8)] transition group-hover:-translate-y-1 group-hover:shadow-[0_22px_45px_-22px_rgba(5,150,105,0.85)]"><ImageIcon className="h-8 w-8" /><span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white ring-4 ring-emerald-50"><UploadCloud className="h-4 w-4" /></span></div>
            <p className="mt-7 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Arraste suas fotos aqui</p><p className="mt-2 text-sm font-semibold text-slate-500 sm:text-base">ou escolha as imagens do imóvel</p>
            <ProductButton type="button" variant="success" onClick={(event) => { event.stopPropagation(); inputRef.current?.click() }} className="mt-6">Selecionar fotos</ProductButton>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">JPG ou PNG · seleção múltipla</p>
          </div>
        ) : (
          <div className="mt-7">
            <div className="mb-5 rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(248,250,252,0.96))] p-4 shadow-[0_14px_30px_-28px_rgba(5,150,105,0.65)] sm:p-5"><div className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 shadow-sm">↔ Ordem editável</div><h3 className="mt-3 text-lg font-black tracking-tight text-slate-950 sm:text-xl">Organize sua apresentação</h3><p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">A apresentação será criada exatamente na ordem das fotos exibidas abaixo. Use as setas para reorganizar as imagens sempre que desejar. A primeira foto será utilizada como capa.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo, index) => (
                <ProductCard as="article" key={photo.id} variant="flat" className="group overflow-hidden transition duration-300 hover:-translate-y-1 hover:ring-emerald-200 hover:shadow-xl">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100"><img src={photo.previewUrl} alt={`Foto ${index + 1} da apresentação`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /><div className="absolute left-2.5 top-2.5 flex items-center gap-1.5"><span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-black text-white shadow-lg backdrop-blur ${index === 0 ? 'bg-emerald-600' : 'bg-slate-950/80'}`}>{index + 1}</span>{index === 0 && <span className="rounded-xl bg-emerald-600 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">Capa</span>}</div><ProductButton type="button" variant="danger" size="sm" onClick={() => removePhoto(photo.id)} aria-label={`Remover foto ${index + 1}`} title="Remover foto" className="absolute bottom-2.5 right-2.5 h-8 min-h-0 w-8 rounded-xl p-0 opacity-85 shadow-lg backdrop-blur group-hover:opacity-100"><Trash2 className="h-4 w-4" /></ProductButton></div>
                  <div className="p-2.5"><p className="truncate text-xs font-bold text-slate-500" title={photo.file.name}>{photo.file.name}</p>{photos.length > 1 && <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200/80"><ProductButton type="button" variant="ghost" size="sm" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`Mover foto ${index + 1} para a esquerda`} title="Mover para a esquerda" className="h-8 min-h-0 rounded-lg p-0 text-slate-500 hover:text-emerald-700"><ChevronLeft className="h-4 w-4" /></ProductButton><span className="px-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Mover</span><ProductButton type="button" variant="ghost" size="sm" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label={`Mover foto ${index + 1} para a direita`} title="Mover para a direita" className="h-8 min-h-0 rounded-lg p-0 text-slate-500 hover:text-emerald-700"><ChevronRight className="h-4 w-4" /></ProductButton></div>}</div>
                </ProductCard>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"><ProductButton type="button" variant="success" onClick={() => inputRef.current?.click()}><Plus className="h-4 w-4" />Adicionar mais fotos</ProductButton><ProductButton type="button" variant="ghost" onClick={clearPhotos}><Trash2 className="h-4 w-4" />Limpar seleção</ProductButton></div>
          </div>
        )}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
          <p className="text-sm font-bold leading-6 text-slate-600">
            {hasMinimumImages ? 'Suas imagens estão prontas. Você ainda pode adicionar e organizar fotos depois.' : `Adicione mais ${missingImages} ${missingImages === 1 ? 'imagem' : 'imagens'} para continuar para as informações.`}
          </p>
          <ProductButton type="button" variant="success" disabled={!hasMinimumImages} onClick={onContinue} className="mt-4 w-full sm:mt-0 sm:w-auto sm:shrink-0">
            Continuar para informações
          </ProductButton>
        </div>
      </div>
    </ProductCard>
  )
}

function SmartCarouselConversation({ user, accessToken, photos, flowDraft, refreshBalance, onGenerationStageChange, onGenerationStatusChange, onCreateNew }) {
  const restoredFlow = flowDraft.restoredDraft || {}
  const [purpose, setPurpose] = useState(() => restoredFlow.purpose || '')
  const [propertyStage, setPropertyStage] = useState(() => restoredFlow.propertyStage || '')
  const [propertyType, setPropertyType] = useState(() => restoredFlow.propertyType || '')
  const [bedrooms, setBedrooms] = useState(() => restoredFlow.bedrooms || '')
  const [suites, setSuites] = useState(() => restoredFlow.suites || '')
  const [parkingSpaces, setParkingSpaces] = useState(() => restoredFlow.parkingSpaces || '')
  const [uf, setUf] = useState(() => restoredFlow.uf || '')
  const [city, setCity] = useState(() => restoredFlow.city || '')
  const [district, setDistrict] = useState(() => restoredFlow.district || '')
  const [priceMode, setPriceMode] = useState(() => restoredFlow.priceMode || '')
  const [priceDigits, setPriceDigits] = useState(() => restoredFlow.priceDigits || '')
  const [area, setArea] = useState(() => restoredFlow.area || '')
  const [highlights, setHighlights] = useState(() => restoredFlow.highlights || [])
  const [cta, setCta] = useState(() => restoredFlow.cta || '')
  const [sharePhone, setSharePhone] = useState(() => restoredFlow.sharePhone || '')
  const [conversationSnapshot, setConversationSnapshot] = useState(() => restoredFlow.conversation || null)
  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const generationInFlightRef = useRef(false)
  const [generationStatus, setGenerationStatus] = useState('idle')
  const [generationError, setGenerationError] = useState('')
  const [receipt, setReceipt] = useState('')
  const [activeJobId, setActiveJobId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [campaignPackage, setCampaignPackage] = useState(null)

  const resetCarouselFromStep = (targetStep) => {
    const resetters = [
      [1, () => setPurpose('')], [2, () => setPropertyStage('')], [3, () => setPropertyType('')],
      [4, () => setBedrooms('')], [5, () => setSuites('')], [6, () => setParkingSpaces('')],
      [7, () => setUf('')], [8, () => setCity('')], [9, () => setDistrict('')],
      [10, () => { setPriceMode(''); setPriceDigits('') }], [11, () => setArea('')],
      [12, () => setHighlights([])], [13, () => setCta('')], [14, () => setSharePhone('')],
    ]
    resetters.filter(([itemStep]) => itemStep >= Number(targetStep)).forEach(([, resetValue]) => resetValue())
    generationInFlightRef.current = false
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
    setGenerationStatus('idle')
    setGenerationError('')
    setReceipt('')
    setActiveJobId('')
    setVideoUrl('')
    setCampaignPackage(null)
    onGenerationStageChange(2)
  }
  const conversation = useGuidedConversation({ initialQuestionId: 1, initialState: restoredFlow.conversation, onEdit: resetCarouselFromStep, onStateChange: setConversationSnapshot })
  const step = Number(conversation.activeQuestionId)

  useEffect(() => {
    const draft = { purpose, propertyStage, propertyType, bedrooms, suites, parkingSpaces, uf, city, district, priceMode, priceDigits, area, highlights, cta, sharePhone, conversation: conversationSnapshot }
    if (!conversationSnapshot?.history?.length && !Object.values(draft).some(value => typeof value === 'string' ? value : Array.isArray(value) ? value.length : false)) {
      flowDraft.clear()
      return
    }
    flowDraft.save(draft)
  }, [area, bedrooms, city, conversationSnapshot, cta, district, flowDraft, highlights, parkingSpaces, priceDigits, priceMode, propertyStage, propertyType, purpose, sharePhone, suites, uf])

  const createNewPresentation = () => {
    flowDraft.clear()
    conversation.resetConversation()
    onCreateNew()
  }

  const profilePhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const formatPrice = (digits) => digits ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(digits)) : ''
  const normalizedDistrict = normalizeDistrictName(district)
  const priceLabel = priceDigits ? `${priceMode === 'starting_at' ? 'A partir de ' : ''}${formatPrice(priceDigits)}` : ''
  const stageOptions = purpose === 'rent' ? ['Pronto para mudar'] : ['Pronto para morar', 'Lançamento', 'Em construção']
  const numberOptions = ['0', '1', '2', '3', '4', '5+']

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
    }
  }, [])

  useEffect(() => {
    onGenerationStatusChange(generationStatus)
  }, [generationStatus, onGenerationStatusChange])

  useEffect(() => () => onGenerationStatusChange('idle'), [onGenerationStatusChange])

  const toggleHighlight = (item) => setHighlights((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length >= SMART_CAROUSEL_MAX_HIGHLIGHTS ? current : [...current, item])
  const messages = ['', 'Qual é a finalidade do imóvel?', 'Qual é o estado atual do imóvel?', 'Que tipo de imóvel será apresentado?', 'Quantos dormitórios o imóvel possui?', 'Quantas suítes?', 'Quantas vagas estão disponíveis?', 'Em qual estado fica o imóvel?', 'Agora escolha a cidade.', 'Em qual bairro ele está localizado?', 'Como deseja apresentar o preço?', 'Qual é a área do imóvel?', 'Quais são os principais destaques?', 'Qual chamada deseja usar no final?', 'Deseja divulgar seu telefone profissional?', 'Tudo pronto. Revise suas escolhas antes de criar.']
  const summaryItems = [[1, purpose === 'sale' ? 'Venda' : purpose === 'rent' ? 'Locação' : ''], [2, propertyStage], [3, propertyType], [4, bedrooms ? `${bedrooms} dormitório${bedrooms === '1' ? '' : 's'}` : ''], [5, suites ? `${suites} suíte${suites === '1' ? '' : 's'}` : ''], [6, parkingSpaces ? `${parkingSpaces} vaga${parkingSpaces === '1' ? '' : 's'}` : ''], [7, uf], [8, city], [9, normalizedDistrict], [10, priceLabel], [11, area ? `${area} m²` : ''], [12, highlights.length ? `${highlights.length} destaques` : ''], [13, cta], [14, sharePhone === 'yes' ? 'Telefone profissional' : sharePhone === 'no' ? 'Sem telefone' : '']].filter(([, value]) => Boolean(value))

  const submitCarouselAnswer = ({ setter, value, answer = value, nextStep }) => {
    const accepted = conversation.submitAnswer({ questionId: step, question: messages[step], answer, confirmation: smartCarouselConfirmation(step, answer), nextQuestionId: nextStep })
    if (accepted) setter?.(value)
    return accepted
  }

  const confirmedAnswers = {
    purpose,
    property_stage: propertyStage,
    property_type: propertyType,
    bedrooms,
    suites,
    parking_spaces: parkingSpaces,
    uf,
    city,
    district: normalizedDistrict,
    price_label: priceLabel,
    area,
    highlights,
  }

  const stopWithError = (message, keepReceipt = false) => {
    if (!mountedRef.current) return
    generationInFlightRef.current = false
    setGenerationStatus('failed')
    setGenerationError(getSmartTokenErrorMessage(message, 'Não foi possível criar sua apresentação. Tente novamente.'))
    void refreshBalance()
    if (!keepReceipt) {
      setReceipt('')
      setActiveJobId('')
    }
  }

  const pollRenderStatus = async (signedReceipt, jobId = activeJobId) => {
    if (!mountedRef.current) return
    if (!isValidSmartCarouselReceipt(signedReceipt) && !jobId) {
      stopWithError('Não foi possível acompanhar sua apresentação.')
      return
    }
    try {
      const data = await invokeSmartCarouselFunction(accessToken, {
        action: 'status',
        ...(isValidSmartCarouselReceipt(signedReceipt) ? { receipt: signedReceipt } : { job_id: jobId }),
      })
      if (!mountedRef.current) return

      if (data.status === 'succeeded' && data.video_url) {
        generationInFlightRef.current = false
        setReceipt('')
        setActiveJobId('')
        if (Array.isArray(data?.campaign_package?.campaigns)) setCampaignPackage(data.campaign_package)
        setVideoUrl(data.video_url)
        setGenerationStatus('succeeded')
        setGenerationError('')
        onGenerationStageChange(4)
        void refreshBalance()
        return
      }

      if (data.status === 'failed') {
        stopWithError(data.error || 'Não foi possível criar sua apresentação. Tente novamente.')
        return
      }

      setGenerationStatus('polling')
      pollTimerRef.current = window.setTimeout(() => pollRenderStatus(signedReceipt, jobId), SMART_CAROUSEL_POLL_INTERVAL_MS)
    } catch (error) {
      stopWithError(error instanceof Error ? error.message : 'Não foi possível acompanhar sua apresentação.', true)
    }
  }

  const resumeStatus = () => {
    if ((!receipt && !activeJobId) || generationInFlightRef.current) return
    generationInFlightRef.current = true
    setGenerationStatus('polling')
    setGenerationError('')
    onGenerationStageChange(3)
    pollRenderStatus(receipt, activeJobId)
  }

  const createPresentation = async () => {
    if (generationInFlightRef.current) return
    if (photos.length < SMART_CAROUSEL_MIN_IMAGES) {
      stopWithError(SMART_CAROUSEL_MIN_IMAGES_MESSAGE)
      return
    }
    if (photos.length > SMART_CAROUSEL_MAX_IMAGES) {
      stopWithError(`Selecione no máximo ${SMART_CAROUSEL_MAX_IMAGES} imagens para continuar.`)
      return
    }
    if (step < 15 || !cta || !sharePhone) {
      stopWithError('Conclua todas as perguntas antes de criar sua apresentação.')
      return
    }
    if (!user?.id || !accessToken) {
      stopWithError('Sua sessão expirou. Entre novamente para continuar.')
      return
    }

    generationInFlightRef.current = true
    setGenerationStatus('uploading')
    setGenerationError('')
    setReceipt('')
    setVideoUrl('')
    setCampaignPackage(null)

    const jobId = crypto.randomUUID()
    setActiveJobId(jobId)
    let uploadedPaths = []
    try {
      const uploaded = await uploadSmartCarouselFilesWithTimeout({ photos, userId: user.id, jobId, cta })
      uploadedPaths = uploaded.uploadedPaths
      if (!mountedRef.current) return
      setGenerationStatus('creating')

      const data = await invokeSmartCarouselFunction(accessToken, {
        action: 'create',
        job_id: jobId,
        image_paths: uploaded.imagePaths,
        cta_path: uploaded.ctaPath,
        answers: confirmedAnswers,
        cta,
        share_phone: sharePhone === 'yes',
      })
      if (!mountedRef.current) return
      if (data.status === 'succeeded' && data.video_url) {
        generationInFlightRef.current = false
        setActiveJobId('')
        setVideoUrl(data.video_url)
        if (Array.isArray(data?.campaign_package?.campaigns)) setCampaignPackage(data.campaign_package)
        setGenerationStatus('succeeded')
        onGenerationStageChange(4)
        void refreshBalance()
        return
      }
      if (data.campaign_package && (!Array.isArray(data.campaign_package.campaigns) || data.campaign_package.campaigns.length !== 3)) {
        throw new Error('Não foi possível preparar sua campanha completa.')
      }

      if (data.campaign_package) setCampaignPackage(data.campaign_package)
      if (isValidSmartCarouselReceipt(data.receipt)) setReceipt(data.receipt)
      setGenerationStatus('polling')
      onGenerationStageChange(3)
      pollRenderStatus(data.receipt || '', jobId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível criar sua apresentação.'
      if (/demorou mais que o esperado|failed to fetch|network/i.test(message)) {
        setGenerationStatus('polling')
        onGenerationStageChange(3)
        pollRenderStatus('', jobId)
      } else {
        await removeUploadedJobFiles(uploadedPaths)
        setActiveJobId('')
        stopWithError(message)
      }
    }
  }

  const isGenerating = ['uploading', 'creating', 'polling'].includes(generationStatus)
  const hasMinimumImages = photos.length >= SMART_CAROUSEL_MIN_IMAGES
  const generationStatusMessage = generationStatus === 'uploading'
    ? 'Enviando fotos...'
    : generationStatus === 'creating'
      ? 'Iniciando apresentação...'
      : 'Criando apresentação...'
  const generationProgress = generationStatus === 'uploading' ? 34 : generationStatus === 'creating' ? 67 : 84

  let questionContent = null
  if (step === 1) questionContent = <OptionGrid><ChoiceButton active={purpose === 'sale'} title="🏡 Venda" description="Apresentação para comercialização do imóvel." onClick={() => submitCarouselAnswer({ setter: setPurpose, value: 'sale', answer: 'Venda', nextStep: 2 })} /><ChoiceButton active={purpose === 'rent'} title="🔑 Locação" description="Apresentação para encontrar o locatário ideal." onClick={() => submitCarouselAnswer({ setter: setPurpose, value: 'rent', answer: 'Locação', nextStep: 2 })} /></OptionGrid>
  else if (step === 2) questionContent = <ChipGrid>{stageOptions.map((item) => <ChipButton key={item} active={propertyStage === item} onClick={() => submitCarouselAnswer({ setter: setPropertyStage, value: item, nextStep: 3 })}>{item}</ChipButton>)}</ChipGrid>
  else if (step === 3) questionContent = <ChipGrid>{SMART_CAROUSEL_PROPERTY_TYPES.map((item) => <ChipButton key={item} active={propertyType === item} onClick={() => submitCarouselAnswer({ setter: setPropertyType, value: item, nextStep: 4 })}>{item}</ChipButton>)}</ChipGrid>
  else if ([4, 5, 6].includes(step)) { const value = step === 4 ? bedrooms : step === 5 ? suites : parkingSpaces; const setter = step === 4 ? setBedrooms : step === 5 ? setSuites : setParkingSpaces; questionContent = <ChipGrid>{numberOptions.map((item) => <ChipButton key={item} active={value === item} onClick={() => submitCarouselAnswer({ setter, value: item, nextStep: step + 1 })}>{item}</ChipButton>)}</ChipGrid> }
  else if (step === 7) questionContent = <SmartCarouselStateSelect value={uf} onChange={(nextUf) => { if (nextUf && submitCarouselAnswer({ setter: setUf, value: nextUf, nextStep: 8 })) setCity('') }} />
  else if (step === 8) questionContent = <SmartCarouselCitySelect uf={uf} value={city} onChange={(nextCity) => { if (nextCity) submitCarouselAnswer({ setter: setCity, value: nextCity, nextStep: 9 }) }} />
  else if (step === 9) questionContent = <div><SmartLocationTextInput value={district} onChange={(event) => setDistrict(event.target.value)} /><ProductButton type="button" variant="success" disabled={!district.trim()} onClick={() => submitCarouselAnswer({ setter: setDistrict, value: normalizedDistrict, answer: normalizedDistrict, nextStep: 10 })} className="mt-4">Continuar</ProductButton></div>
  else if (step === 10) questionContent = <div><ChipGrid><ChipButton active={priceMode === 'fixed'} onClick={() => setPriceMode('fixed')}>Preço fixo</ChipButton><ChipButton active={priceMode === 'starting_at'} onClick={() => setPriceMode('starting_at')}>A partir de</ChipButton></ChipGrid><input value={formatPrice(priceDigits)} onChange={(event) => setPriceDigits(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" placeholder="R$ 0 (opcional)" className="mt-4 w-full rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><ProductButton type="button" variant="success" disabled={!priceMode || !priceDigits} onClick={() => submitCarouselAnswer({ setter: () => {}, value: priceMode, answer: priceLabel, nextStep: 11 })}>Continuar</ProductButton><ProductButton type="button" variant="ghost" onClick={() => { if (submitCarouselAnswer({ setter: () => {}, value: '', answer: 'Sem preço', nextStep: 11 })) { setPriceMode(''); setPriceDigits('') } }}>Continuar sem informar preço</ProductButton></div></div>
  else if (step === 11) questionContent = <div><div className="relative"><input value={area} onChange={(event) => setArea(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Ex: 120" className="w-full rounded-2xl border border-emerald-100 px-4 py-3 pr-14 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">m²</span></div><ProductButton type="button" variant="success" disabled={!area} onClick={() => submitCarouselAnswer({ setter: () => {}, value: area, answer: `${area} m²`, nextStep: 12 })} className="mt-4">Continuar</ProductButton></div>
  else if (step === 12) questionContent = <div className="space-y-4">{SMART_CAROUSEL_HIGHLIGHT_GROUPS.map((group) => <ProductCard as="section" key={group.title} variant="muted" className="p-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{group.title}</p><div className="flex flex-wrap gap-2">{group.items.map((item) => <ChipButton key={item} active={highlights.includes(item)} disabled={!highlights.includes(item) && highlights.length >= SMART_CAROUSEL_MAX_HIGHLIGHTS} onClick={() => toggleHighlight(item)}>{item}</ChipButton>)}</div></ProductCard>)}<div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{highlights.length} de {SMART_CAROUSEL_MAX_HIGHLIGHTS} selecionados</span><ProductButton type="button" variant="success" disabled={!highlights.length} onClick={() => submitCarouselAnswer({ setter: () => {}, value: highlights, answer: `${highlights.length} destaques`, nextStep: 13 })}>Continuar</ProductButton></div></div>
  else if (step === 13) questionContent = <ChipGrid>{SMART_CAROUSEL_CTA_OPTIONS.map((item) => <ChipButton key={item} active={cta === item} onClick={() => submitCarouselAnswer({ setter: setCta, value: item, nextStep: 14 })}>{item}</ChipButton>)}</ChipGrid>
  else if (step === 14) questionContent = <OptionGrid><ChoiceButton disabled={!profilePhone} active={sharePhone === 'yes'} title="Sim" description={profilePhone || 'Cadastre um telefone no Perfil Profissional.'} onClick={() => submitCarouselAnswer({ setter: setSharePhone, value: 'yes', answer: 'Telefone profissional', nextStep: 15 })} /><ChoiceButton active={sharePhone === 'no'} title="Não" description="Continuar sem divulgar telefone." onClick={() => submitCarouselAnswer({ setter: setSharePhone, value: 'no', answer: 'Sem telefone', nextStep: 15 })} /></OptionGrid>
  else questionContent = (
    <div className="space-y-4 text-center sm:space-y-5">
      <SmartTokenEstimate cost={SMART_TOKEN_COSTS.smartCarousel} quantityLabel={`${photos.length} imagens selecionadas · preço fixo`} />
      <ProductButton
        type="button"
        variant="success"
        loading={isGenerating}
        disabled={isGenerating || !hasMinimumImages}
        onClick={createPresentation}
        aria-describedby={!hasMinimumImages ? 'smart-carousel-minimum-images-message' : undefined}
        className="sticky bottom-3 z-10 w-full py-4 text-base sm:py-5 sm:text-lg"
      >
        {!isGenerating && <Sparkles className="h-5 w-5" />}
        Criar apresentação
      </ProductButton>

      {!hasMinimumImages && (
        <p id="smart-carousel-minimum-images-message" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          {SMART_CAROUSEL_MIN_IMAGES_MESSAGE}
        </p>
      )}

      {isGenerating && (
        <ProductCard variant="muted" className="border-emerald-100 bg-emerald-50/70 p-5 text-left">
          <div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" /><p className="text-sm font-black text-emerald-900">{generationStatusMessage}</p></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${generationProgress}%` }} /></div>
        </ProductCard>
      )}

      {generationStatus === 'failed' && (
        <ProductCard variant="flat" className="border-rose-100 bg-rose-50 p-5 text-left">
          <p className="text-sm font-bold leading-6 text-rose-800">{generationError}</p>
          <ProductButton type="button" variant="danger" onClick={receipt || activeJobId ? resumeStatus : createPresentation} className="mt-4"><RotateCcw className="h-4 w-4" />Tentar novamente</ProductButton>
        </ProductCard>
      )}

      {generationStatus === 'succeeded' && videoUrl && (
        <CampaignPackage
          mediaPresentation="mobile"
          data={{
            sourceProduct: 'Smart Carrossel',
            mediaType: 'video',
            previewUrl: videoUrl,
            downloadUrl: videoUrl,
            downloadName: 'smart-carrossel-apresentacao.mp4',
            purpose,
            propertyStage,
            propertyType,
            bedrooms,
            suites,
            parkingSpaces,
            state: uf,
            city,
            district: normalizedDistrict,
            price: priceLabel,
            area,
            highlights,
            cta,
            contactAuthorized: sharePhone === 'yes',
            phone: sharePhone === 'yes' ? profilePhone : '',
            aiCampaigns: campaignPackage?.campaigns || [],
            googleAds: campaignPackage?.google_ads,
          }}
          onCreateNew={createNewPresentation}
          createNewLabel="Criar nova apresentação"
        />
      )}
    </div>
  )

  return <GuidedConversation
    designSystem
    accent="emerald"
    history={conversation.history}
    phase={conversation.phase}
    questionId={step}
    question={messages[step]}
    questionNumber={Math.min(step, 14)}
    totalQuestions={14}
    onEdit={conversation.editAnswer}
    summaryItems={summaryItems.map(([id, label]) => ({ id, label }))}
    eyebrow="Etapa 2"
    review={step >= 15}
    editDisabled={isGenerating}
  >
    {questionContent}
  </GuidedConversation>
}

function OptionGrid({ children, className = '' }) { return <div className={`grid gap-3 md:grid-cols-2 ${className}`}>{children}</div> }
function ChipGrid({ children, className = '' }) { return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div> }
function ChoiceButton({ active, disabled = false, title, description, onClick }) { return <ProductCard as="button" type="button" variant="flat" disabled={disabled} onClick={onClick} className={`p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${SMART_UI.focus} ${active ? 'border-emerald-700 bg-emerald-950 text-white shadow-lg shadow-emerald-100' : 'hover:border-emerald-300 hover:bg-emerald-50/40'}`}><p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p><p className={`mt-2 text-xs leading-relaxed ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{description}</p></ProductCard> }
function ChipButton({ active, disabled = false, children, onClick }) { return <ProductButton type="button" variant={active ? 'success' : 'secondary'} size="sm" disabled={disabled} onClick={onClick} className={`rounded-full ${active ? 'border-emerald-700 bg-emerald-950 shadow-sm hover:border-emerald-700 hover:bg-emerald-950' : 'border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'}`}>{children}</ProductButton> }

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileVideo,
  Phone,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import Header from '../components/layout/Header'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

const SMART_VIDEO_MAX_DURATION_SECONDS = 195
const VIDEO_BUCKET = 'studio-videos'
const MAX_HIGHLIGHTS = 3
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm']

const PROPERTY_GOALS = ['Venda', 'Locação']
const PROPERTY_TYPES = [
  'Apartamento',
  'Casa',
  'Casa em condomínio',
  'Sala comercial',
  'Laje corporativa',
  'Loja',
  'Terreno',
  'Chácara / Sítio',
]
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]
const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5+']
const SUITE_OPTIONS = ['Sem suíte', '1', '2', '3', '4+']
const PARKING_OPTIONS = ['Sem vaga', '1', '2', '3', '4+']
const HIGHLIGHT_OPTIONS = [
  'Vista livre',
  'Varanda gourmet',
  'Lazer completo',
  'Piscina',
  'Churrasqueira',
  'Próximo ao metrô',
  'Reformado',
  'Mobiliado',
  'Pronto para morar',
  'Aceita financiamento',
  'Alto padrão',
  'Condomínio completo',
]
const CTA_OPTIONS = [
  'Agende sua visita',
  'Fale comigo',
  'Entre em contato',
  'Chame no WhatsApp',
  'Conheça este imóvel',
  'Solicite mais informações',
]

const QUESTION_FLOW = [
  { id: 'video', question: 'Envie seu vídeo do imóvel.', type: 'video' },
  { id: 'dealType', question: 'Este imóvel é para:', type: 'chips', options: PROPERTY_GOALS },
  { id: 'propertyType', question: 'Qual é o tipo do imóvel?', type: 'chips', options: PROPERTY_TYPES },
  { id: 'location', question: 'Onde está localizado o imóvel?', type: 'location' },
  { id: 'features', question: 'Selecione as características do imóvel.', type: 'featureGroups' },
  { id: 'highlights', question: 'Quais destaques deseja mostrar no vídeo?', type: 'multi', options: HIGHLIGHT_OPTIONS },
  { id: 'cta', question: 'Como deseja encerrar o vídeo?', type: 'chips', options: CTA_OPTIONS },
  { id: 'phone', question: 'Deseja mostrar um telefone no final do vídeo?', type: 'phone' },
]

const initialAnswers = {
  video: null,
  dealType: '',
  propertyType: '',
  location: { uf: '', neighborhood: '' },
  features: { bedrooms: '', suites: '', parking: '' },
  highlights: [],
  cta: '',
  phone: { masked: '', normalized: '' },
}

function normalizeNeighborhood(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^\s+/, '')
}

function formatFileSize(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Duração não identificada'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatSummaryDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Duração não identificada'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes <= 0) return `${remainingSeconds}s`
  return `${minutes}min${String(remainingSeconds).padStart(2, '0')}s`
}

function formatNeighborhoodForDisplay(value) {
  return normalizeNeighborhood(value)
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.length <= 2 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function formatBedroomLabel(value) {
  if (value === '1') return '1 dormitório'
  if (value === '5+') return '5 ou mais dormitórios'
  return value ? `${value} dormitórios` : ''
}

function formatSuiteLabel(value) {
  if (value === 'Sem suíte') return value
  if (value === '1') return '1 suíte'
  if (value === '4+') return '4 ou mais suítes'
  return value ? `${value} suítes` : ''
}

function formatParkingLabel(value) {
  if (value === 'Sem vaga') return value
  if (value === '1') return '1 vaga'
  if (value === '4+') return '4 ou mais vagas'
  return value ? `${value} vagas` : ''
}

function getFileExtension(fileName) {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

function isAllowedVideo(file) {
  return ALLOWED_VIDEO_TYPES.includes(file.type) || ALLOWED_VIDEO_EXTENSIONS.includes(getFileExtension(file.name))
}

function isSmartVideoDurationAllowed(duration) {
  return Number.isFinite(duration) && duration <= SMART_VIDEO_MAX_DURATION_SECONDS
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function getVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      const duration = video.duration
      video.currentTime = Math.min(0.1, Math.max(0, duration / 10))
    }
    video.onseeked = () => {
      let thumbnail = ''
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 180
        const context = canvas.getContext('2d')
        context?.drawImage(video, 0, 0, canvas.width, canvas.height)
        thumbnail = canvas.toDataURL('image/jpeg', 0.78)
      } catch {
        thumbnail = ''
      }
      URL.revokeObjectURL(url)
      resolve({ duration: video.duration, thumbnail })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: Number.NaN, thumbnail: '' })
    }
    video.src = url
  })
}

function buildSmartVideoData(answers) {
  return {
    schemaVersion: 'smart_video_input_v1',
    video: answers.video ? {
      id: answers.video.id,
      name: answers.video.name,
      sizeBytes: answers.video.size,
      durationSeconds: answers.video.duration,
      mimeType: answers.video.type,
      storageBucket: answers.video.storageBucket,
      storagePath: answers.video.storagePath,
      status: answers.video.status,
    } : null,
    commercialCommunication: {
      dealType: answers.dealType,
      propertyType: answers.propertyType,
      uf: answers.location.uf,
      neighborhood: answers.location.neighborhood.trim(),
      bedrooms: answers.features.bedrooms,
      suites: answers.features.suites,
      parking: answers.features.parking,
      highlights: answers.highlights,
      cta: answers.cta,
      phone: answers.phone.masked || null,
      phoneNormalized: answers.phone.normalized || null,
    },
  }
}

export default function SmartVideo() {
  const { user, accessToken } = useAuth()
  const [phase, setPhase] = useState('intro')
  const [answers, setAnswers] = useState(initialAnswers)
  const [chatIndex, setChatIndex] = useState(0)
  const [videoError, setVideoError] = useState('')
  const [locationDraft, setLocationDraft] = useState(initialAnswers.location)
  const [featureDraft, setFeatureDraft] = useState(initialAnswers.features)
  const [highlightDraft, setHighlightDraft] = useState([])
  const [highlightNotice, setHighlightNotice] = useState('')
  const [phoneDraft, setPhoneDraft] = useState(initialAnswers.phone)
  const [reviewError, setReviewError] = useState('')
  const [generationNotice, setGenerationNotice] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const pollTimerRef = useRef(null)
  const [job, setJob] = useState({ id: '', status: 'idle', message: '', videoUrl: '', error: '' })

  const currentQuestion = QUESTION_FLOW[chatIndex]
  const progress = phase === 'review'
    ? 100
    : Math.round(((chatIndex + (phase === 'chat' ? 1 : 0)) / (QUESTION_FLOW.length + 1)) * 100)

  const summaryRows = useMemo(() => ([
    { id: 'video', label: 'Vídeo', type: 'video', value: answers.video },
    { id: 'dealType', label: 'Objetivo', value: answers.dealType },
    { id: 'propertyType', label: 'Tipo', value: answers.propertyType },
    { id: 'uf', label: 'UF', value: answers.location.uf },
    { id: 'neighborhood', label: 'Bairro', value: formatNeighborhoodForDisplay(answers.location.neighborhood) },
    { id: 'bedrooms', label: 'Dormitórios', value: formatBedroomLabel(answers.features.bedrooms) },
    { id: 'suites', label: 'Suítes', value: formatSuiteLabel(answers.features.suites) },
    { id: 'parking', label: 'Vagas', value: formatParkingLabel(answers.features.parking) },
    { id: 'highlights', label: 'Destaques', type: 'chips', value: answers.highlights },
    { id: 'cta', label: 'CTA', icon: Wand2, value: answers.cta },
    ...(answers.phone.masked ? [{ id: 'phone', label: 'Telefone', icon: Phone, value: answers.phone.masked }] : []),
  ]), [answers])

  useEffect(() => {
    return () => {
      if (answers.video?.previewUrl) URL.revokeObjectURL(answers.video.previewUrl)
    }
  }, [answers.video?.previewUrl])

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
  }, [])

  const invokeVideoFunction = async (name, body) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken || ''}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Não foi possível processar o Smart Video.')
    return data
  }

  const pollSmartVideoJob = async (jobId) => {
    try {
      const data = await invokeVideoFunction('get-video-job-status', { jobId })
      if (data.status === 'completed' && data.signedVideoUrl) {
        setJob({ id: jobId, status: 'completed', message: 'Seu Smart Video está pronto.', videoUrl: data.signedVideoUrl, error: '' })
        return
      }
      if (data.status === 'failed') {
        setJob({ id: jobId, status: 'failed', message: '', videoUrl: '', error: data.error || 'Não foi possível concluir o Smart Video.' })
        return
      }
      setJob((current) => ({ ...current, status: data.status || 'processing', message: data.message || 'O Smart está preparando seu vídeo.' }))
      pollTimerRef.current = setTimeout(() => pollSmartVideoJob(jobId), 7000)
    } catch (error) {
      setJob({ id: jobId, status: 'failed', message: '', videoUrl: '', error: error instanceof Error ? error.message : 'Falha ao consultar o Smart Video.' })
    }
  }

  const startChat = () => {
    setPhase('chat')
    setChatIndex(0)
  }

  const goToQuestion = (index) => {
    const safeIndex = Math.max(0, Math.min(index, QUESTION_FLOW.length - 1))
    const question = QUESTION_FLOW[safeIndex]
    if (question.id === 'location') setLocationDraft(answers.location)
    if (question.id === 'features') setFeatureDraft(answers.features)
    if (question.id === 'highlights') {
      setHighlightDraft(answers.highlights.slice(0, MAX_HIGHLIGHTS))
      setHighlightNotice('')
    }
    if (question.id === 'phone') setPhoneDraft(answers.phone)
    setChatIndex(safeIndex)
    setPhase('chat')
    setGenerationNotice('')
  }

  const goBack = () => {
    if (phase === 'review') return setPhase('chat')
    if (phase === 'chat' && chatIndex > 0) return goToQuestion(chatIndex - 1)
    if (phase === 'chat') return setPhase('intro')
    return setPhase('intro')
  }

  const commitAnswer = (questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }))
    setReviewError('')
    setGenerationNotice('')
    if (questionId === 'highlights') setHighlightNotice('')
    if (chatIndex >= QUESTION_FLOW.length - 1) {
      setPhase('review')
      return
    }
    setChatIndex((current) => current + 1)
  }

  const deleteStoredVideo = async (video) => {
    if (!video?.storagePath) return
    const { error } = await supabase.storage.from(VIDEO_BUCKET).remove([video.storagePath])
    if (error && import.meta.env.DEV) console.warn('Falha ao remover vídeo substituído:', error.message)
  }

  const handleVideoFile = async (file) => {
    setVideoError('')
    if (!file) return

    if (!isAllowedVideo(file)) {
      setVideoError('Formato não permitido. Envie um vídeo em MP4, MOV ou WEBM.')
      return
    }

    if (!user?.id) {
      setVideoError('Sua sessão expirou. Faça login novamente para enviar o vídeo.')
      return
    }

    setIsUploading(true)
    setUploadProgress(15)
    const metadata = await getVideoMetadata(file)
    if (Number.isFinite(metadata.duration) && !isSmartVideoDurationAllowed(metadata.duration)) {
      setVideoError('Este vídeo ultrapassa o limite aceito. Envie uma versão com aproximadamente 3 minutos.')
      setIsUploading(false)
      setUploadProgress(0)
      return
    }

    if (!Number.isFinite(metadata.duration)) {
      setVideoError('Não foi possível identificar a duração deste vídeo. Verifique o arquivo e tente novamente.')
      setIsUploading(false)
      setUploadProgress(0)
      return
    }

    const videoId = crypto.randomUUID()
    const extension = getFileExtension(file.name)
    const storagePath = `${user.id}/smart-video/${videoId}/source.${extension}`
    setUploadProgress(40)
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setVideoError(`Não foi possível enviar o vídeo: ${uploadError.message}`)
      setIsUploading(false)
      setUploadProgress(0)
      return
    }

    const previousVideo = answers.video
    if (previousVideo?.previewUrl) URL.revokeObjectURL(previousVideo.previewUrl)
    setAnswers((current) => ({
      ...current,
      video: {
        id: videoId,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        previewUrl: URL.createObjectURL(file),
        storageBucket: VIDEO_BUCKET,
        storagePath,
        status: 'uploaded',
      },
    }))
    setUploadProgress(100)
    setIsUploading(false)
    await deleteStoredVideo(previousVideo)
    setGenerationNotice('')
  }

  const removeVideo = async () => {
    const videoToRemove = answers.video
    if (answers.video?.previewUrl) URL.revokeObjectURL(answers.video.previewUrl)
    setAnswers((current) => ({ ...current, video: null }))
    setUploadProgress(0)
    setVideoError('')
    setChatIndex(0)
    setPhase('chat')
    await deleteStoredVideo(videoToRemove)
  }

  const submitLocation = () => {
    const corrected = {
      uf: locationDraft.uf,
      neighborhood: normalizeNeighborhood(locationDraft.neighborhood).trim(),
    }
    if (!corrected.uf || !corrected.neighborhood) return
    commitAnswer('location', corrected)
  }

  const submitFeatures = () => {
    if (!featureDraft.bedrooms || !featureDraft.suites || !featureDraft.parking) return
    commitAnswer('features', featureDraft)
  }

  const submitPhone = () => {
    commitAnswer('phone', phoneDraft)
  }

  const validateSmartVideoData = () => {
    if (!isSmartVideoDurationAllowed(answers.video?.duration)) {
      setReviewError('Este vídeo ultrapassa o limite aceito. Envie uma versão com aproximadamente 3 minutos.')
      return null
    }

    const isValid = Boolean(
      answers.video
      && answers.dealType
      && answers.propertyType
      && answers.location.uf
      && answers.location.neighborhood.trim()
      && answers.features.bedrooms
      && answers.features.suites
      && answers.features.parking
      && answers.highlights.length > 0
      && answers.highlights.length <= MAX_HIGHLIGHTS
      && answers.cta,
    )
    if (!isValid) {
      setReviewError('Revise as informações antes de gerar o Smart Video.')
      return null
    }
    setReviewError('')
    return buildSmartVideoData(answers)
  }

  const handleGenerate = async () => {
    const smartVideoData = validateSmartVideoData()
    if (!smartVideoData) return
    if (!accessToken) {
      setReviewError('Sua sessão expirou. Faça login novamente.')
      return
    }
    setJob({ id: '', status: 'queued', message: 'Enviando para processamento.', videoUrl: '', error: '' })
    setGenerationNotice('Seu vídeo entrou na fila de processamento.')
    setPhase('result')
    try {
      const data = await invokeVideoFunction('create-smart-video-job', smartVideoData)
      setJob({ id: data.jobId, status: 'queued', message: 'Vídeo na fila de processamento.', videoUrl: '', error: '' })
      pollTimerRef.current = setTimeout(() => pollSmartVideoJob(data.jobId), 1000)
    } catch (error) {
      setJob({ id: '', status: 'failed', message: '', videoUrl: '', error: error instanceof Error ? error.message : 'Não foi possível iniciar o Smart Video.' })
    }
  }

  const formatAnswer = (question) => {
    const value = answers[question.id]
    if (question.id === 'video') return value ? `${value.name} · ${formatDuration(value.duration)} · ${formatFileSize(value.size)}` : ''
    if (question.id === 'location') return `${value.uf} · ${formatNeighborhoodForDisplay(value.neighborhood)}`
    if (question.id === 'features') return `${formatBedroomLabel(value.bedrooms)} · ${formatSuiteLabel(value.suites)} · ${formatParkingLabel(value.parking)}`
    if (question.id === 'highlights') return value.join(', ')
    if (question.id === 'phone') return value.masked || 'Sem telefone'
    return value
  }

  const renderChipGroup = (options, selected, onSelect) => (
    <div className="mt-4 flex flex-wrap gap-3">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
            selected === option
              ? 'border-primary-800 bg-primary-800 text-white'
              : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )

  const renderQuestionControls = () => {
    if (!currentQuestion) return null

    if (currentQuestion.type === 'video') {
      return (
        <div className="mt-4 space-y-4">
          <div className="max-w-3xl space-y-2 text-sm font-semibold leading-relaxed text-gray-600">
            <p>Vídeos de até <strong>3 minutos</strong>. Formatos aceitos: MP4, MOV e WEBM.</p>
            <p>O Smart melhora o ritmo do vídeo, adiciona música, comunicação comercial e um CTA profissional.</p>
          </div>
          {!answers.video ? (
            <div className="rounded-3xl border border-dashed border-blue-100 bg-white p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl bg-slate-50 px-6 py-10 text-center transition hover:bg-primary-50">
                <Upload className="h-9 w-9 text-primary-600" />
                <span className="mt-3 text-sm font-black text-slate-950">Selecionar vídeo do imóvel</span>
                <span className="mt-1 text-xs font-semibold text-slate-500">MP4, MOV ou WEBM · até 3 minutos</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  className="hidden"
                  onChange={(event) => handleVideoFile(event.target.files?.[0])}
                />
              </label>
            </div>
          ) : (
            <>
              <VideoPreviewCard video={answers.video} uploadProgress={uploadProgress} onRemove={removeVideo} onReplace={() => fileInputRef.current?.click()} />
              <Button type="button" onClick={() => commitAnswer('video', answers.video)} disabled={isUploading} className="mt-4">
                Continuar
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={(event) => handleVideoFile(event.target.files?.[0])}
          />
          {videoError && (
            <p className="whitespace-pre-line rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold leading-relaxed text-red-700">
              {videoError}
            </p>
          )}
          {isUploading && (
            <div className="rounded-2xl border border-blue-100 bg-white p-4" role="status" aria-live="polite">
              <div className="flex justify-between text-xs font-black text-slate-600"><span>Enviando vídeo</span><span>{uploadProgress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary-700 transition-all" style={{ width: `${uploadProgress}%` }} /></div>
            </div>
          )}
        </div>
      )
    }

    if (currentQuestion.type === 'chips') {
      return renderChipGroup(currentQuestion.options, answers[currentQuestion.id], (option) => commitAnswer(currentQuestion.id, option))
    }

    if (currentQuestion.type === 'location') {
      return (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <div>
              <label className="text-sm font-black text-gray-950" htmlFor="smart-video-uf">Estado</label>
              <select
                id="smart-video-uf"
                value={locationDraft.uf}
                onChange={(event) => setLocationDraft((current) => ({ ...current, uf: event.target.value }))}
                className="mt-2 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">UF</option>
                {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-black text-gray-950" htmlFor="smart-video-neighborhood">Bairro</label>
              <input
                id="smart-video-neighborhood"
                value={locationDraft.neighborhood}
                onChange={(event) => setLocationDraft((current) => ({ ...current, neighborhood: normalizeNeighborhood(event.target.value) }))}
                onBlur={() => setLocationDraft((current) => ({ ...current, neighborhood: normalizeNeighborhood(current.neighborhood).trim() }))}
                placeholder="Ex: Vila Mariana"
                className="mt-2 min-h-12 w-full rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
          <Button type="button" onClick={submitLocation} disabled={!locationDraft.uf || !locationDraft.neighborhood.trim()}>
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </div>
      )
    }

    if (currentQuestion.type === 'featureGroups') {
      return (
        <div className="mt-4 space-y-4">
          <FeatureChoice title="Dormitórios" options={BEDROOM_OPTIONS} value={featureDraft.bedrooms} onChange={(value) => setFeatureDraft((current) => ({ ...current, bedrooms: value }))} />
          <FeatureChoice title="Suítes" options={SUITE_OPTIONS} value={featureDraft.suites} onChange={(value) => setFeatureDraft((current) => ({ ...current, suites: value }))} />
          <FeatureChoice title="Vagas" options={PARKING_OPTIONS} value={featureDraft.parking} onChange={(value) => setFeatureDraft((current) => ({ ...current, parking: value }))} />
          <Button type="button" onClick={submitFeatures} disabled={!featureDraft.bedrooms || !featureDraft.suites || !featureDraft.parking}>
            Confirmar características
          </Button>
        </div>
      )
    }

    if (currentQuestion.type === 'multi') {
      return (
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-black text-slate-700">Selecione até 3 destaques</p>
            <p className="text-xs font-black uppercase tracking-wide text-primary-700">{highlightDraft.length} de {MAX_HIGHLIGHTS}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentQuestion.options.map((option) => {
              const active = highlightDraft.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  aria-disabled={!active && highlightDraft.length >= MAX_HIGHLIGHTS}
                  onClick={() => {
                    setHighlightDraft((current) => {
                      if (current.includes(option)) {
                        setHighlightNotice('')
                        return current.filter((item) => item !== option)
                      }
                      if (current.length >= MAX_HIGHLIGHTS) {
                        setHighlightNotice('Você pode escolher até 3 destaques.')
                        return current
                      }
                      setHighlightNotice('')
                      return [...current, option]
                    })
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                    active
                      ? 'border-primary-800 bg-primary-800 text-white'
                      : highlightDraft.length >= MAX_HIGHLIGHTS
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-blue-100 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
          {highlightNotice && (
            <p className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-800">
              {highlightNotice}
            </p>
          )}
          <Button type="button" onClick={() => commitAnswer('highlights', highlightDraft)} disabled={highlightDraft.length === 0}>
            Confirmar destaques
          </Button>
        </div>
      )
    }

    if (currentQuestion.type === 'phone') {
      return (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={phoneDraft.masked}
            onChange={(event) => {
              const normalized = event.target.value.replace(/\D/g, '').slice(0, 11)
              setPhoneDraft({ masked: formatPhone(normalized), normalized })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitPhone()
            }}
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            className="min-h-12 flex-1 rounded-2xl border border-blue-100 bg-white px-4 text-sm font-bold text-gray-800 outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
          <Button type="button" onClick={submitPhone}>
            Continuar
          </Button>
          <Button type="button" variant="secondary" onClick={() => commitAnswer('phone', { masked: '', normalized: '' })}>
            Não mostrar telefone
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header title="Smart Video" subtitle="Aprimore vídeos reais de imóveis com ritmo, música e comunicação profissional." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Home
        </Link>

        {phase === 'intro' && (
          <section className="mt-6 overflow-hidden rounded-[2rem] bg-[#0F2742] p-7 text-white shadow-xl shadow-[#0F2742]/10 sm:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Video className="h-4 w-4 text-cyan-200" />
                Smart Video
              </div>
              <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Melhore seu vídeo do imóvel
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-gray-300 sm:text-lg">
                Envie o vídeo do imóvel e escolha as informações que deseja destacar. O Smart melhora o ritmo, adiciona música, comunicação comercial e um CTA profissional.
              </p>
              <Button type="button" onClick={startChat} size="lg" className="mt-8 min-h-12 px-6">
                Enviar meu vídeo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {(phase === 'chat' || phase === 'review') && (
          <div className="mt-6 rounded-[2rem] border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wide text-primary-700">
                {phase === 'review' ? 'Resumo' : `Etapa ${chatIndex + 1} de ${QUESTION_FLOW.length}`}
              </p>
              <span className="text-xs font-black text-gray-500">{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary-800 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {phase === 'chat' && (
          <section className="mt-4 rounded-[2rem] border border-gray-200 bg-gray-50 p-5 sm:p-8">
            <div className="space-y-5">
              <AssistantBubble>
                Perfeito. Vou montar o Smart Video com você, passo a passo.
              </AssistantBubble>
              {QUESTION_FLOW.slice(0, chatIndex).map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <AssistantBubble>{question.question}</AssistantBubble>
                  <div className="ml-12 flex max-w-3xl items-start justify-between gap-3 rounded-3xl rounded-tr-md bg-primary-800 px-5 py-4 text-white">
                    <p className="text-sm font-bold leading-relaxed">{formatAnswer(question)}</p>
                    <button type="button" onClick={() => goToQuestion(index)} className="text-xs font-black text-cyan-100 hover:text-white">
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

        {phase === 'review' && (
          <section className="mx-auto mt-4 max-w-5xl">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              <AssistantBubble>Está tudo correto?</AssistantBubble>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {summaryRows.map((row) => <SummaryItem key={row.id} row={row} />)}
              </div>
              {reviewError && (
                <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {reviewError}
                </p>
              )}
              {generationNotice && (
                <p className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                  {generationNotice}
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => goToQuestion(0)}>
                  <RotateCcw className="h-4 w-4" />
                  Editar informações
                </Button>
                <Button type="button" onClick={handleGenerate}>
                  <Wand2 className="h-4 w-4" />
                  Gerar Smart Video
                </Button>
              </div>
            </div>
          </section>
        )}

        {phase === 'result' && (
          <section className="mt-6 space-y-6">
            <div className="rounded-[2rem] bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-xl shadow-primary-900/10 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-cyan-100">Smart Video</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Prévia da entrega</h1>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-gray-300">
                    Seu vídeo será apresentado em formato vertical, pronto para Reels, Stories e WhatsApp.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setPhase('review')}>
                  Voltar ao resumo
                </Button>
              </div>
            </div>

            <div className="mx-auto max-w-5xl rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
              {generationNotice && (
                <p className="mb-5 rounded-2xl border border-primary-100 bg-primary-50 p-3 text-sm font-bold text-primary-800">
                  {generationNotice}
                </p>
              )}
              <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-center">
                <div className="mx-auto w-full max-w-[320px] rounded-[2.25rem] border border-slate-200 bg-slate-950 p-2.5 shadow-xl shadow-slate-200/80">
                  <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.65rem] bg-gradient-to-br from-slate-100 via-white to-primary-50">
                    <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-300/80" />
                    {job.videoUrl ? (
                      <video src={job.videoUrl} controls playsInline className="h-full w-full object-contain bg-black" />
                    ) : <div className="px-8 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary-800 shadow-sm ring-1 ring-blue-100">
                        <FileVideo className="h-7 w-7" />
                      </div>
                      <p className="mt-5 text-base font-black leading-snug text-slate-950">{job.status === 'failed' ? 'Não foi possível concluir' : job.message || 'Seu Smart Video aparecerá aqui após a geração.'}</p>
                      <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500">
                        {job.error || 'A entrega final manterá o vídeo em destaque, com comunicação discreta e formato vertical.'}
                      </p>
                      {['queued', 'processing', 'rendering'].includes(job.status) && <div className="mx-auto mt-5 h-2 w-40 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary-700" /></div>}
                    </div>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-primary-700">Entrega em vídeo</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">Formato Reels/Stories</h2>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                      O resultado final ficará centralizado em uma moldura de celular, com proporção 9:16 e ações próximas ao preview.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPill label="Formato" value="Vertical 9:16" />
                    <InfoPill label="CTA" value={answers.cta || 'Não informado'} />
                    <InfoPill label="Objetivo" value={answers.dealType || 'Não informado'} />
                    <InfoPill label="Tipo" value={answers.propertyType || 'Não informado'} />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" disabled={!job.videoUrl} onClick={() => job.videoUrl && window.open(job.videoUrl, '_blank', 'noopener,noreferrer')} className={!job.videoUrl ? 'cursor-not-allowed' : ''}>
                      <Download className="h-4 w-4" />
                      Baixar vídeo
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => goToQuestion(0)}>
                      Editar informações
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
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

function SummaryItem({ row }) {
  const Icon = row.icon

  if (row.type === 'video') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
        <p className="text-xs font-black uppercase tracking-wide text-primary-700">{row.label}</p>
        {row.value ? (
          <div className="mt-2 min-w-0">
            <p className="truncate text-sm font-black text-slate-800">{row.value.name}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {formatSummaryDuration(row.value.duration)} • {formatFileSize(row.value.size)}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">Não informado</p>
        )}
      </div>
    )
  }

  if (row.type === 'chips') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
        <p className="text-xs font-black uppercase tracking-wide text-primary-700">{row.label}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {row.value?.length ? row.value.map((highlight) => (
            <span key={highlight} className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-black text-primary-800 shadow-sm">
              {highlight}
            </span>
          )) : (
            <span className="text-sm font-bold text-slate-700">Não informado</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary-700" />}
        <p className="text-xs font-black uppercase tracking-wide text-primary-700">{row.label}</p>
      </div>
      <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{row.value || 'Não informado'}</p>
    </div>
  )
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-primary-700">{label}</p>
      <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{value}</p>
    </div>
  )
}

function VideoPreviewCard({ video, uploadProgress, onRemove, onReplace }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          {video.thumbnail ? (
            <img src={video.thumbnail} alt={video.name} className="aspect-video h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-video h-full w-full flex-col items-center justify-center text-slate-400">
              <FileVideo className="h-8 w-8" />
              <span className="mt-2 text-xs font-bold">Thumbnail indisponível</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{video.name}</p>
          <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
            <span className="rounded-2xl bg-slate-50 px-3 py-2">{formatDuration(video.duration)}</span>
            <span className="rounded-2xl bg-slate-50 px-3 py-2">{formatFileSize(video.size)}</span>
            <span className="rounded-2xl bg-slate-50 px-3 py-2">{video.type || 'video'}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onReplace} className="rounded-full border border-blue-100 px-3 py-2 text-xs font-black text-primary-800 hover:bg-primary-50">
              Substituir
            </button>
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-full border border-red-100 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50">
              <X className="h-3.5 w-3.5" />
              Remover
            </button>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-black text-slate-500"><span>Upload concluído</span><span>{uploadProgress}%</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureChoice({ title, options, value, onChange }) {
  return (
    <div className="rounded-3xl border border-blue-100 bg-white p-4">
      <p className="text-sm font-black text-gray-950">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-4 py-2 text-sm font-black transition ${
              value === option ? 'border-primary-800 bg-primary-800 text-white' : 'border-blue-100 bg-primary-50 text-primary-800 hover:border-primary-300'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

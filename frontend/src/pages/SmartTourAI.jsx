import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, PlayCircle, Trash2, UploadCloud, Video, X } from 'lucide-react'
import Header from '../components/layout/Header'
import CampaignPackage from '../components/campaign/CampaignPackage'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, ProductSteps } from '../components/design-system'
import { buildSmartTourCampaignPackage } from '../components/campaign/buildSmartTourCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation, { getConversationScrollBehavior } from '../components/conversation/GuidedConversation'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useProductDraft } from '../hooks/useProductDraft'
import { useAuth } from '../lib/auth-context'
import { restoreProductDraftShape, toFileMetadata } from '../lib/product-draft'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'
import { supabase } from '../lib/supabase'
import { getMetaConnectionStatus, redirectToMetaOAuth } from '../lib/meta-oauth-connection'
import { clearPendingSmartTourPublication, preservePendingSmartTourPublication, publishSmartTourPublication, readPendingSmartTourPublication, recoverSmartTourPublication } from '../lib/smart-tour-social-publish'
import { clearSmartTourActiveJob, getSmartTourStatusHttpStatus, readSmartTourActiveJob, shouldRecoverSmartTourGenerateResponse, shouldRetrySmartTourStatusResponse, shouldRetryStartingJobNotFound, writeSmartTourActiveJob } from '../lib/smart-tour-job-recovery'
import { mergeSmartTourCampaignHashtags } from '../lib/smart-tour-hashtags'
import { SMART_TOUR_EXAMPLES, SMART_TOUR_MAX_IMAGES, SMART_TOUR_PRODUCT_NAME } from '../config/smartTour'
import { getSmartTourNextQuestion, getSmartTourReviewEditNext } from '../config/smartTourConversation'
import { formatSmartTourCurrency, formatSmartTourLocation, getSmartTourHighlightGroups, getSmartTourMeasureFields, getSmartTourPropertyTypes, getSmartTourStageOptions, normalizeSmartTourDistrict, SMART_TOUR_MEASURE_OPTIONS, SMART_TOUR_PROPERTY_TYPES } from '../config/smartTourForm'
import { formatBrazilianPhone } from '../../../supabase/functions/_shared/product3-contract.ts'
import { adaptQuestionsForShortVideos, buildShortVideoInputPath, cleanupShortVideoInput, formatShortVideoDuration, getShortVideosPropertyTypes, getShortVideosStageOptions, getShortVideoTerminalActions, readShortVideoDuration, SHORT_VIDEOS_INPUT_BUCKET, SHORT_VIDEOS_MODULE_ID, SHORT_VIDEOS_VISIBLE, validateShortVideoDuration, validateShortVideoFile } from '../config/shortVideos'

const BUCKET = 'studio-videos'
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTAS = ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', state: '', city: '', district: '', price: '', condominium: '', iptu: '', highlights: [], description: '' }
const visibleExamples = SMART_TOUR_EXAMPLES.filter(example => SHORT_VIDEOS_VISIBLE || example.id !== SHORT_VIDEOS_MODULE_ID).map(example => ({
  ...example,
  ...(example.id === 'animate-images' ? {
    title: 'Fotos em Movimento',
    description: 'Transforme suas fotos em uma apresentação dinâmica, com movimentos suaves e novos ângulos, preservando o imóvel como protagonista.',
  } : example.id === 'campaign-video' ? {
    title: 'Legendas na Tela',
    description: 'Apresente seu imóvel com legendas sincronizadas, música de fundo e destaque para as principais informações.',
  } : example.id === 'narrated-video' ? {
    title: 'Narração Profissional',
    description: 'Apresente seu imóvel com uma narração natural e profissional, acompanhada das principais informações na tela.',
  } : example.id === 'virtual-agent' ? {
    title: 'Corretor Virtual IA',
    description: 'Um corretor virtual apresenta o imóvel de forma envolvente, valoriza cada ambiente e desperta o interesse do cliente para entrar em contato.',
  } : {}),
}))
const guideExamples = visibleExamples.map(example => ({
  id: example.id,
  title: example.title,
  presenter: example.hasPresenter,
  narration: example.hasNarration,
  texts: example.id === 'virtual-agent' ? true : example.hasTexts,
  cta: example.id !== 'animate-images',
}))
const initialGeneration = { mode: 'guided_tour', presenterGender: '', presenterSpeechMode: 'automatic', presenterCustomSpeech: '', narration: '', captions: '', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
const emptyFileMetadata = { name: '', size: 0, type: '', lastModified: 0, order: 0 }
const SMART_TOUR_QUESTION_ORDER = ['images', 'purpose', 'stage', 'type', 'facts', 'location', 'commercial', 'highlights', 'presenter', 'presenter_speech_mode', 'presenter_custom_speech', 'narration', 'captions', 'cta_enabled', 'cta', 'phone', 'review']

function normalizeGeneration(input) {
  const value = { ...initialGeneration, ...input }
  const presenterGender = ['female','male'].includes(value.presenterGender) ? value.presenterGender : 'none'
  const presenterSpeechMode = presenterGender !== 'none' && value.presenterSpeechMode === 'custom' ? 'custom' : 'automatic'
  return { ...value, mode: 'guided_tour', presenterGender, presenterSpeechMode, presenterCustomSpeech: presenterSpeechMode === 'custom' ? String(value.presenterCustomSpeech ?? '') : '', narration: presenterSpeechMode === 'custom' ? 'enabled' : value.narration === 'disabled' ? 'disabled' : 'enabled', captions: presenterSpeechMode === 'custom' ? 'disabled' : value.captions === 'disabled' ? 'disabled' : 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
}

const countWords = value => String(value ?? '').trim().split(/\s+/).filter(Boolean).length
function questionsFor(isShortVideos = false) {
  const questions = [
    ['images', 1, isShortVideos ? 'Envie o vídeo original do imóvel.' : 'Envie até 5 fotos na ordem em que deseja apresentá-las.'], ['purpose', 2, 'Qual é a finalidade do imóvel?'],
    ['stage', 2, 'Qual é o estado atual do imóvel?'], ['type', 2, 'Que tipo de imóvel vamos apresentar?'],
    ['facts', 2, 'Quais são as principais medidas?'], ['location', 2, 'Onde fica o imóvel?'],
    ['commercial', 2, 'Quais informações comerciais deseja incluir?'], ['highlights', 2, 'Quais são os principais destaques?'],
    ['presenter', 3, 'Deseja um apresentador virtual durante o vídeo?'],
    ['presenter_speech_mode', 3, 'O que você quer que o Corretor Virtual fale?'],
    ['presenter_custom_speech', 3, 'Escreva a fala do Corretor Virtual'],
    ['narration', 3, 'Deseja narração durante o vídeo?'],
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta_enabled', 4, 'Deseja uma chamada para ação no final do vídeo?'],
  ]
  const completeQuestions = [...questions, ['cta', 4, 'Qual chamada deseja usar no final?'], ['phone', 4, 'Deseja divulgar seu telefone profissional?'], ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.']]
  return isShortVideos ? adaptQuestionsForShortVideos(completeQuestions) : completeQuestions
}

function smartTourConfirmation(id, answer, isShortVideos = false) {
  if (id === 'purpose') return answer === 'Locação' ? 'Perfeito! Vamos criar uma apresentação para divulgar a locação desse imóvel.' : 'Perfeito! Vamos criar uma apresentação para apoiar a venda desse imóvel.'
  const confirmations = {
    images: isShortVideos ? `Ótimo! O vídeo “${answer}” foi validado.` : `Ótimo! ${answer} serão usadas exatamente na ordem escolhida.`,
    stage: `Perfeito! Vamos considerar o imóvel como “${answer}”.`,
    type: `Ótimo! O tipo “${answer}” já está registrado.`,
    facts: 'Perfeito! As principais medidas do imóvel foram registradas.',
    location: `Ótimo! A localização em ${answer} foi registrada.`,
    commercial: answer === 'Sem informações comerciais' ? 'Tudo bem! Seguiremos sem exibir valores comerciais.' : 'Perfeito! As informações comerciais foram registradas.',
    highlights: `Excelente! ${answer} foram selecionados para valorizar o imóvel.`,
    presenter: answer === 'Nenhum' ? 'Tudo certo! O vídeo seguirá sem apresentador virtual.' : `Perfeito! ${answer} fará a apresentação virtual.`,
    presenter_speech_mode: answer === 'Apresentar o imóvel' ? 'Perfeito! O Smart criará a fala usando as informações do imóvel.' : 'Perfeito! Você definirá exatamente o que o Corretor Virtual vai dizer.',
    presenter_custom_speech: 'Perfeito! A fala será usada exatamente como você escreveu.',
    narration: answer === 'Sim' ? 'Perfeito! A apresentação terá narração profissional.' : 'Tudo certo! A apresentação seguirá sem narração.',
    captions: answer === 'Sim' ? 'Ótimo! Uma seleção curta de destaques poderá aparecer no vídeo.' : 'Tudo certo! As informações continuarão na campanha, mas não aparecerão no vídeo.',
    cta_enabled: answer === 'Sim' ? 'Perfeito! Agora escolha a chamada final.' : 'Tudo certo! O vídeo terminará naturalmente na última cena, sem chamada final.',
    cta: `Ótimo! A chamada final será “${answer}”.`,
    phone: answer === 'Telefone profissional' ? 'Perfeito! Seu telefone profissional será incluído.' : 'Tudo certo! A apresentação seguirá sem telefone.',
  }
  return confirmations[id] || 'Perfeito! Informação registrada.'
}

export default function SmartTourAI() {
  const { user, reloadProfile } = useAuth()
  const tourDraft = useProductDraft({ productKey: 'video-imobiliario', schemaVersion: 1, userId: user?.id })
  const restoredTourDraft = tourDraft.restoredDraft || {}
  const restoredInputFlow = restoredTourDraft.activeInputFlow === 'images' || (SHORT_VIDEOS_VISIBLE && restoredTourDraft.activeInputFlow === SHORT_VIDEOS_MODULE_ID) ? restoredTourDraft.activeInputFlow : null
  const restoredImageMetadata = Array.isArray(restoredTourDraft.imageMetadata)
    ? restoredTourDraft.imageMetadata.map(item => restoreProductDraftShape(emptyFileMetadata, item)).filter(item => item.name && item.size > 0)
    : []
  const restoredShortVideoMetadata = restoredTourDraft.shortVideoMetadata
    ? restoreProductDraftShape({ ...emptyFileMetadata, duration: 0 }, restoredTourDraft.shortVideoMetadata)
    : null
  const inputRef = useRef(null)
  const pollRef = useRef(null)
  const recoveryStartedRef = useRef(false)
  const reviewEditRef = useRef(null)
  const shortVideoGenerationLockRef = useRef(false)
  const [images, setImages] = useState([])
  const [missingImageMetadata, setMissingImageMetadata] = useState(restoredImageMetadata)
  const [shortVideo, setShortVideo] = useState(null)
  const [missingShortVideoMetadata, setMissingShortVideoMetadata] = useState(restoredShortVideoMetadata?.name && restoredShortVideoMetadata.size > 0 ? restoredShortVideoMetadata : null)
  const [property, setProperty] = useState(() => restoreProductDraftShape(initialProperty, restoredTourDraft.property))
  const [generation, setGeneration] = useState(() => restoreProductDraftShape(initialGeneration, restoredTourDraft.generation))
  const [ctaEnabled, setCtaEnabled] = useState(() => typeof restoredTourDraft.ctaEnabled === 'boolean' ? restoredTourDraft.ctaEnabled : null)
  const [cta, setCta] = useState(() => typeof restoredTourDraft.cta === 'string' ? restoredTourDraft.cta : '')
  const [includePhone, setIncludePhone] = useState(() => typeof restoredTourDraft.includePhone === 'boolean' ? restoredTourDraft.includePhone : null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [activeInputFlow, setActiveInputFlow] = useState(restoredInputFlow)
  const [conversationSnapshot, setConversationSnapshot] = useState(() => restoredTourDraft.conversation || null)
  const isShortVideos = activeInputFlow === SHORT_VIDEOS_MODULE_ID
  const questions = useMemo(() => questionsFor(isShortVideos), [isShortVideos])
  const rawPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const phone = formatBrazilianPhone(rawPhone)
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => ({ ...current, [field]: value }))
  const clearInputMedia = () => {
    setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
    setShortVideo(null)
    setMissingImageMetadata([])
    setMissingShortVideoMetadata(null)
  }

  useEffect(() => () => {
    if (shortVideo?.preview) URL.revokeObjectURL(shortVideo.preview)
  }, [shortVideo?.preview])

  const resetTourFromQuestion = (questionId) => {
    if (reviewEditRef.current) {
      if (questionId === 'images') clearInputMedia()
      if (questionId === 'purpose') setProperty(current => ({ ...current, purpose: '', stage: '' }))
      if (questionId === 'stage') setProperty(current => ({ ...current, stage: '' }))
      if (questionId === 'type') setProperty(current => ({ ...current, type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [] }))
      if (questionId === 'facts') setProperty(current => ({ ...current, bedrooms: '', suites: '', parkingSpaces: '', area: '' }))
      if (questionId === 'location') setProperty(current => ({ ...current, state: '', city: '', district: '' }))
      if (questionId === 'commercial') setProperty(current => ({ ...current, price: '', condominium: '', iptu: '' }))
      if (questionId === 'highlights') setProperty(current => ({ ...current, highlights: [] }))
      if (questionId === 'presenter') setGeneration(current => ({ ...current, presenterGender: '', presenterSpeechMode: 'automatic', presenterCustomSpeech: '' }))
      if (questionId === 'presenter_speech_mode') setGeneration(current => ({ ...current, presenterSpeechMode: 'automatic', presenterCustomSpeech: '' }))
      if (questionId === 'presenter_custom_speech') setGeneration(current => ({ ...current, presenterCustomSpeech: '' }))
      if (questionId === 'narration') setGeneration(current => ({ ...current, narration: '' }))
      if (questionId === 'captions') setGeneration(current => ({ ...current, captions: '' }))
      if (questionId === 'cta_enabled') { setCtaEnabled(null); setCta(''); setIncludePhone(null) }
      if (questionId === 'cta') setCta('')
      if (questionId === 'phone') setIncludePhone(null)
      setStatus('idle')
      setMessage('')
      return
    }
    const targetIndex = SMART_TOUR_QUESTION_ORDER.indexOf(questionId)
    const shouldReset = id => SMART_TOUR_QUESTION_ORDER.indexOf(id) >= targetIndex
    if (shouldReset('images')) clearInputMedia()
    const propertyFields = [['purpose', 'purpose'], ['stage', 'stage'], ['type', 'type'], ['facts', 'bedrooms'], ['facts', 'suites'], ['facts', 'parkingSpaces'], ['facts', 'area'], ['location', 'state'], ['location', 'city'], ['location', 'district'], ['commercial', 'price'], ['commercial', 'condominium'], ['commercial', 'iptu'], ['highlights', 'highlights']]
    setProperty(current => propertyFields.reduce((nextProperty, [questionKey, field]) => shouldReset(questionKey) ? { ...nextProperty, [field]: field === 'highlights' ? [] : '' } : nextProperty, current))
    setGeneration(current => ({
      ...current,
      ...(shouldReset('presenter') ? { presenterGender: '' } : {}),
      ...(shouldReset('presenter_speech_mode') ? { presenterSpeechMode: 'automatic' } : {}),
      ...(shouldReset('presenter_custom_speech') ? { presenterCustomSpeech: '' } : {}),
      ...(shouldReset('narration') ? { narration: '' } : {}),
      ...(shouldReset('captions') ? { captions: '' } : {}),
      furniture: 'original', stagingPresentation: 'final_only',
    }))
    if (shouldReset('cta_enabled')) setCtaEnabled(null)
    if (shouldReset('cta')) setCta('')
    if (shouldReset('phone')) setIncludePhone(null)
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('idle')
    setMessage('')
    setResult(null)
  }
  const conversation = useGuidedConversation({ initialQuestionId: 'images', initialState: restoredTourDraft.conversation, onEdit: resetTourFromQuestion, onStateChange: setConversationSnapshot })
  const questionIndex = Math.max(0, questions.findIndex(item => item[0] === conversation.activeQuestionId))
  const question = questions[questionIndex] || questions[0]

  useEffect(() => {
    if (!['idle', 'error'].includes(status)) return
    if (readSmartTourActiveJob(sessionStorage).record) return
    const imageMetadata = images.length
      ? images.map((item, order) => toFileMetadata(item.file, order)).filter(Boolean)
      : missingImageMetadata
    const shortVideoMetadata = shortVideo?.file
      ? { ...toFileMetadata(shortVideo.file, 0), duration: shortVideo.duration }
      : missingShortVideoMetadata
    const draft = { activeInputFlow, property, generation, ctaEnabled, cta, includePhone, imageMetadata, shortVideoMetadata, conversation: conversationSnapshot }
    const meaningful = activeInputFlow || conversationSnapshot?.history?.length || imageMetadata.length || shortVideoMetadata || Object.values(property).some(value => Array.isArray(value) ? value.length : Boolean(value))
    if (!meaningful) { tourDraft.clear(); return }
    tourDraft.save(draft)
  }, [activeInputFlow, conversationSnapshot, cta, ctaEnabled, generation, images, includePhone, missingImageMetadata, missingShortVideoMetadata, property, shortVideo, status, tourDraft])
  const answerQuestion = ({ answer, answerId = '', nextQuestionId = getSmartTourNextQuestion({ questionId: question[0], answerId, mode: generation.mode }), apply }) => {
    let resolvedNextQuestionId = nextQuestionId
    if (reviewEditRef.current) {
      resolvedNextQuestionId = getSmartTourReviewEditNext({ originQuestionId: reviewEditRef.current, questionId: question[0], answerId, mode: generation.mode })
      if (resolvedNextQuestionId === 'review') reviewEditRef.current = null
    }
    if (isShortVideos && resolvedNextQuestionId === 'presenter') resolvedNextQuestionId = 'narration'
    const accepted = conversation.submitAnswer({ questionId: question[0], question: question[2], answer, confirmation: smartTourConfirmation(question[0], answer, isShortVideos), nextQuestionId: resolvedNextQuestionId })
    if (accepted) apply?.()
    return accepted
  }
  const editConversationAnswer = questionId => {
    if (question[0] === 'review') reviewEditRef.current = questionId
    conversation.editAnswer(questionId)
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])
  useEffect(() => {
    if (recoveryStartedRef.current) return
    const { record: activeJob, invalid } = readSmartTourActiveJob(sessionStorage)
    if (invalid) {
      clearSmartTourActiveJob(sessionStorage)
      return
    }
    if (!activeJob) return
    recoveryStartedRef.current = true
    setActiveInputFlow(activeJob.inputFlow)
    setStatus('generating')
    setMessage('Retomando sua criação...')
    poll(activeJob.jobId)
  }, [])

  const addImages = files => {
    const selectedInSystemOrder = Array.from(files)
    if (selectedInSystemOrder.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage('Envie imagens JPG ou PNG de até 15 MB.')
    setImages(current => {
      const known = new Set(current.map(item => item.key))
      const uniqueInSystemOrder = selectedInSystemOrder.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      if (current.length + uniqueInSystemOrder.length > SMART_TOUR_MAX_IMAGES) { setMessage(`Você pode enviar no máximo ${SMART_TOUR_MAX_IMAGES} imagens.`); return current }
      setMessage('')
      setMissingImageMetadata([])
      return [...current, ...uniqueInSystemOrder.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))]
    })
  }
  const addShortVideo = async files => {
    const file = Array.from(files || [])[0]
    const fileError = validateShortVideoFile(file)
    if (fileError) return setMessage(fileError)
    setMessage('Validando a duração do vídeo...')
    try {
      const duration = await readShortVideoDuration(file)
      const durationError = validateShortVideoDuration(duration)
      if (durationError) return setMessage(durationError)
      setShortVideo({ file, duration, preview: URL.createObjectURL(file) })
      setMissingShortVideoMetadata(null)
      setMessage('')
    } catch (error) {
      setMessage(getSmartTokenErrorMessage(error, 'Não foi possível validar o vídeo.'))
    }
  }
  const move = (position, offset) => setImages(current => { const target = position + offset; if (target < 0 || target >= current.length) return current; const nextImages = [...current]; [nextImages[position], nextImages[target]] = [nextImages[target], nextImages[position]]; return nextImages })
  const remove = position => setImages(current => current.filter((item, itemIndex) => { if (itemIndex === position) URL.revokeObjectURL(item.preview); return itemIndex !== position }))
  const toggleHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < 10 ? [...property.highlights, value] : property.highlights)

  async function poll(jobId) {
    const { record: activeJob } = readSmartTourActiveJob(sessionStorage)
    try {
      const { data, error } = await supabase.functions.invoke('smart-tour-status', { body: { jobId } })
      if (error || !data?.ok) {
        if (shouldRetryStartingJobNotFound(activeJob, error)) {
          setStatus('generating')
          setMessage('Retomando sua criação...')
          pollRef.current = setTimeout(() => poll(jobId), 3000)
          return
        }
        if (getSmartTourStatusHttpStatus(error) === 404) {
          const terminalActions = getShortVideoTerminalActions(activeJob, 'not-found')
          if (terminalActions.cleanupInput) {
            try {
              await cleanupShortVideoInput(supabase.storage, user.id, activeJob.jobId)
            } catch {
              setStatus('error')
              setMessage('Não foi possível remover o vídeo temporário. Recarregue a página para tentar novamente.')
              return
            }
          }
          clearSmartTourActiveJob(sessionStorage)
          if (terminalActions.releaseLock) shortVideoGenerationLockRef.current = false
          setStatus('error')
          setMessage('Esta criação não está mais disponível. Tente novamente.')
          return
        }
        if (shouldRetrySmartTourStatusResponse(error, data)) {
          setStatus('generating')
          setMessage('Confirmando o andamento da sua criação...')
          pollRef.current = setTimeout(() => poll(jobId), 3000)
          return
        }
        throw new Error(data?.error || 'Não foi possível consultar a criação.')
      }
      if (data.status === 'completed') { clearSmartTourActiveJob(sessionStorage); setResult({ ...data, campaignPackage: mergeSmartTourCampaignHashtags(activeJob?.campaignPackage || {}, data.hashtags), inputFlow: activeJob?.inputFlow || 'images' }); setStatus('completed'); void reloadProfile(); return }
      if (data.status === 'failed') { clearSmartTourActiveJob(sessionStorage); if (getShortVideoTerminalActions(activeJob, 'failed').releaseLock) shortVideoGenerationLockRef.current = false; setStatus('error'); setMessage(getSmartTokenErrorMessage(data.error, 'Não foi possível concluir. Tente novamente.')); void reloadProfile(); return }
      setMessage(data.message || 'A IA está criando sua apresentação...'); pollRef.current = setTimeout(() => poll(jobId), 9000)
    } catch (error) { setStatus('error'); setMessage(getSmartTokenErrorMessage(error, 'Não foi possível concluir. Tente novamente.')); void reloadProfile() }
  }

  const createTour = async () => {
    if (isShortVideos) {
      if (shortVideoGenerationLockRef.current) {
        setMessage('A criação do Short Videos já foi iniciada. Aguarde a conclusão.')
        return
      }
      if (!shortVideo?.file) return setMessage('Selecione um vídeo MP4 antes de continuar.')
      shortVideoGenerationLockRef.current = true
    }
    setStatus('uploading'); setMessage(isShortVideos ? 'Enviando seu vídeo com segurança...' : 'Enviando suas fotos com segurança...')
    try {
      const requestId = crypto.randomUUID()
      const apiGeneration = normalizeGeneration(generation)
      const customPresenterSpeech = !isShortVideos && apiGeneration.presenterSpeechMode === 'custom'
      const videoCtaEnabled = ctaEnabled === true && !customPresenterSpeech
      const selectedCta = videoCtaEnabled ? cta : ''
      if (isShortVideos) {
        const videoPath = buildShortVideoInputPath(user.id, requestId)
        const { error: uploadError } = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET).upload(videoPath, shortVideo.file, { contentType: 'video/mp4' })
        if (uploadError) throw new Error('O vídeo não pôde ser enviado. Tente novamente.')
        setStatus('generating'); setMessage('A IA está selecionando os melhores momentos do seu vídeo...')
        let campaignPackage = buildSmartTourCampaignPackage({ property, language:'pt-BR', cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '' })
        writeSmartTourActiveJob(sessionStorage, { jobId:requestId, campaignPackage, inputFlow: SHORT_VIDEOS_MODULE_ID, phase:'starting', updatedAt:Date.now() })
        tourDraft.clear()
        const { data, error } = await supabase.functions.invoke('smart-tour-generate', { body: {
          inputFlow: SHORT_VIDEOS_MODULE_ID,
          clientRequestId: requestId,
          videoPath,
          videoMetadata: { durationSeconds: shortVideo.duration, mimeType: 'video/mp4' },
          property,
          generation: { ...apiGeneration, presenterGender: 'none' },
          selectedCta,
          includeProfessionalPhone: videoCtaEnabled && includePhone === true,
          language: 'pt-BR',
        } })
        if (error || !data?.ok || !data?.jobId) {
          setStatus('generating')
          setMessage('Confirmando o início da sua criação...')
          poll(requestId)
          return
        }
        campaignPackage = buildSmartTourCampaignPackage({ property, language:'pt-BR', cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', hashtags:data.hashtags })
        writeSmartTourActiveJob(sessionStorage, { jobId:data.jobId, campaignPackage, inputFlow: SHORT_VIDEOS_MODULE_ID, phase:'active', updatedAt:Date.now() }); poll(data.jobId)
        return
      }
      const orderedImages = images.slice()
      const imagePaths = new Array(orderedImages.length)
      for (let imageIndex = 0; imageIndex < orderedImages.length; imageIndex += 1) {
        const file = orderedImages[imageIndex].file
        const path = `${user.id}/smart-tour/${requestId}/${String(imageIndex + 1).padStart(2, '0')}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
        if (error) throw new Error('Uma das fotos não pôde ser enviada. Tente novamente.')
        imagePaths[imageIndex] = path
      }
      setStatus('generating'); setMessage('A IA está criando sua apresentação...')
      let campaignPackage = buildSmartTourCampaignPackage({ property, language:'pt-BR', cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', unifiedSocialPublishing:true })
      writeSmartTourActiveJob(sessionStorage, { jobId:requestId, campaignPackage, inputFlow:'images', phase:'starting', updatedAt:Date.now() })
      tourDraft.clear()
      const { data, error } = await supabase.functions.invoke('smart-tour-generate', { body: { clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: apiGeneration, selectedCta, includeProfessionalPhone: videoCtaEnabled && includePhone === true, language: 'pt-BR' } })
      if (shouldRecoverSmartTourGenerateResponse(error, data)) {
        setStatus('generating')
        setMessage('Confirmando o início da sua criação...')
        poll(requestId)
        return
      }
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || 'Não foi possível iniciar a criação.')
      campaignPackage = buildSmartTourCampaignPackage({ property, language:'pt-BR', cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', hashtags:data.hashtags, unifiedSocialPublishing:true })
      writeSmartTourActiveJob(sessionStorage, { jobId:data.jobId, campaignPackage, inputFlow:'images', phase:'active', updatedAt:Date.now() }); poll(data.jobId)
    } catch (error) { if (isShortVideos) shortVideoGenerationLockRef.current = false; setStatus('error'); setMessage(getSmartTokenErrorMessage(error, 'Não foi possível criar sua apresentação.')); void reloadProfile() }
  }

  const reset = () => {
    tourDraft.clear()
    clearSmartTourActiveJob(sessionStorage)
    shortVideoGenerationLockRef.current = false
    clearInputMedia()
    reviewEditRef.current = null
    setActiveInputFlow(null)
    setProperty(initialProperty)
    setGeneration(initialGeneration)
    setCtaEnabled(null)
    setCta('')
    setIncludePhone(null)
    conversation.resetConversation()
    setStatus('idle')
    setMessage('')
    setResult(null)
  }

  const selectInputFlow = inputFlow => {
    if (inputFlow === SHORT_VIDEOS_MODULE_ID && !SHORT_VIDEOS_VISIBLE) return
    if (activeInputFlow !== inputFlow) reset()
    setActiveInputFlow(inputFlow)
    window.requestAnimationFrame(() => document.getElementById('smart-tour-creation')?.scrollIntoView({ behavior: getConversationScrollBehavior(), block: 'start' }))
  }
  if (result) { const isShortVideoResult = result.inputFlow === SHORT_VIDEOS_MODULE_ID; return <><Header title={SMART_TOUR_PRODUCT_NAME} subtitle="Seu vídeo imobiliário profissional." /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: SMART_TOUR_PRODUCT_NAME, ...(!isShortVideoResult ? { sourceType:'video_imobiliario', sourceId:result.jobId, mediaAssetId:result.jobId } : {}), mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl, downloadName: isShortVideoResult ? 'short-smartcorretorai.mp4' : 'smartcorretorai-apresentacao.mp4' }} videoPublish={!isShortVideoResult ? { enabled:true, captionEditable:true, loadConnection:() => getMetaConnectionStatus(supabase), resumeIntent:user?.id ? readPendingSmartTourPublication(window.sessionStorage,user.id) : null, onPublish:(intent,destinations) => publishSmartTourPublication(supabase,intent,destinations), onRecover:(intent,destinations) => recoverSmartTourPublication(supabase,intent,destinations), onResumed:() => clearPendingSmartTourPublication(window.sessionStorage,user?.id), onConnect:async intent => { if (!preservePendingSmartTourPublication(window.sessionStorage,user?.id,intent)) throw new Error('video_publication_pending_not_saved'); await redirectToMetaOAuth(supabase,url => window.location.assign(url)) } } : undefined} mediaPresentation={isShortVideoResult ? 'mobile' : 'default'} protectVideoDownload={isShortVideoResult} onCreateNew={reset} createNewLabel="Criar novo vídeo" /></main></> }

  const measureFields = getSmartTourMeasureFields(property.type)
  const measureLabels = { bedrooms: 'dormitórios', suites: 'suítes', parkingSpaces: 'vagas', area: 'm²' }
  const measuresSummary = measureFields.map(field => property[field] && `${property[field]} ${measureLabels[field]}`).filter(Boolean).join(' · ')
  const valuesSummary = [property.price && `${property.purpose === 'rent' ? 'Locação' : 'Preço'} ${property.price}`, property.condominium && `Condomínio ${property.condominium}`, property.iptu && `IPTU ${property.iptu}`].filter(Boolean).join(' · ')
  const isReviewContext = question[0] === 'review' || Boolean(reviewEditRef.current)
  const summary = [
    { id: 'images', label: isShortVideos ? (shortVideo && `${shortVideo.file.name} · ${formatShortVideoDuration(shortVideo.duration)} · saída em formato Short vertical`) : (images.length && `${images.length} foto${images.length > 1 ? 's' : ''}`) },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
    { id: 'stage', label: property.stage },
    { id: 'type', label: property.type },
    { id: 'facts', label: measuresSummary },
    { id: 'location', label: formatSmartTourLocation(property) },
    { id: 'commercial', label: valuesSummary || (isReviewContext ? 'Sem valores informados' : '') },
    { id: 'highlights', label: property.highlights.length ? `${property.highlights.length} destaques` : (isReviewContext ? 'Sem destaques adicionais' : '') },
    ...(!isShortVideos ? [{ id: 'presenter', label: generation.presenterGender === 'female' ? 'Corretora' : generation.presenterGender === 'male' ? 'Corretor' : (isReviewContext ? 'Nenhum' : '') }] : []),
    ...(!isShortVideos && ['female','male'].includes(generation.presenterGender) ? [{ id: 'presenter_speech_mode', label: generation.presenterSpeechMode === 'custom' ? 'Escrever minha própria fala' : 'Apresentar o imóvel' }] : []),
    ...(!isShortVideos && generation.presenterSpeechMode === 'custom' && generation.presenterCustomSpeech ? [{ id: 'presenter_custom_speech', label: generation.presenterCustomSpeech }] : []),
    { id: 'narration', label: generation.presenterSpeechMode === 'custom' ? 'Sim (implícita)' : generation.narration === 'enabled' ? 'Sim' : generation.narration === 'disabled' ? 'Não' : '' },
    { id: 'captions', label: generation.captions === 'enabled' ? 'Sim' : generation.captions === 'disabled' ? 'Não' : '' },
    { id: 'cta_enabled', label: ctaEnabled === true ? 'Sim' : ctaEnabled === false ? 'Não' : '' },
    { id: 'cta', label: ctaEnabled === true ? cta : '' },
    { id: 'phone', label: ctaEnabled === true ? (includePhone === true ? phone : includePhone === false ? 'Sem telefone' : '') : '' },
  ].filter(item => Boolean(item.label))
  const visualStep = status === 'idle' ? question[1] : 5
  return <>
    <Header title={SMART_TOUR_PRODUCT_NAME} subtitle="O SmartCorretorAI organiza o contexto. A IA faz o trabalho pesado." />
    <main className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
      <ProductHero
        id="smart-tour-title"
        productName="Vídeo Imobiliário"
        headline="Transforme as fotos dos seus imóveis em comerciais profissionais."
        description="Gere vídeos prontos para anúncios, redes sociais e atendimento. Escolha apenas o resultado que deseja. O SmartCorretorAI faz o restante."
      />

      <ProductCard className="mt-8 p-5 sm:p-7">
        <ProductSectionHeading
          eyebrow="Exemplos de experiências"
          title="Escolha o resultado que você deseja"
          description="Estas são as combinações mais utilizadas. Durante a criação do vídeo você pode personalizar cada opção e criar a combinação que melhor atende à sua necessidade."
        />
        <SmartTourShowcase />
      </ProductCard>

      <SmartTourGuide />

      <SmartTourStartChoice
        onSelectImages={() => selectInputFlow('images')}
        onSelectShortVideos={() => selectInputFlow(SHORT_VIDEOS_MODULE_ID)}
        shortVideosVisible={SHORT_VIDEOS_VISIBLE}
      />

      {activeInputFlow && <div id="smart-tour-creation" className="mt-10 space-y-8 scroll-mt-6">
        <ProductSectionHeading eyebrow={isShortVideos ? 'Short Videos' : 'Criação guiada'} title="Agora, conte como será o seu vídeo" />
        <ProductSteps steps={[
          { title: isShortVideos ? 'Vídeo' : 'Fotos', subtitle: 'Envio' },
          { title: 'Imóvel', subtitle: 'Informações' },
          { title: 'Estilo', subtitle: 'Apresentação' },
          { title: 'Revisão', subtitle: 'Conferência' },
          { title: 'Criar', subtitle: 'Vídeo' },
        ]} activeStep={visualStep} />
    <GuidedConversation
      history={conversation.history}
      phase={conversation.phase}
      questionId={question[0]}
      question={question[2]}
      questionNumber={questionIndex + 1}
      totalQuestions={questions.length}
      onEdit={editConversationAnswer}
      summaryItems={summary}
      review={question[0] === 'review'}
      editDisabled={['uploading', 'generating'].includes(status)}
      designSystem
      eyebrow={isShortVideos ? 'Short Videos' : 'Criação guiada'}
    >
      <Question id={question[0]} {...{ images, missingImageMetadata, shortVideo, missingShortVideoMetadata, isShortVideos, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, message, status, addImages, addShortVideo, move, remove, answerQuestion, setPropertyField, setGeneration, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, setShortVideo, createTour, resetCreation: reset, reviewItems: summary, onReviewEdit: editConversationAnswer }} />
    </GuidedConversation>
      </div>}
    </main>
  </>
}

function SmartTourGuide() {
  const [activeGuideId, setActiveGuideId] = useState(null)
  const [hoveredGuideId, setHoveredGuideId] = useState(null)
  return <ProductCard className="mt-8 p-5 sm:p-7">
    <ProductSectionHeading
      eyebrow="Guia rápido"
      title="Como criar cada tipo de vídeo"
      description="Passe o mouse ou toque em uma opção para ver como ela foi configurada."
    />
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {guideExamples.map((example, index) => {
        const isActive = activeGuideId === example.id || hoveredGuideId === example.id
        return <div key={example.id} className="relative" onMouseEnter={() => setHoveredGuideId(example.id)} onMouseLeave={() => setHoveredGuideId(current => current === example.id ? null : current)}>
          <button
            type="button"
            aria-expanded={isActive}
            aria-controls={`guide-${example.id}`}
            onClick={() => setActiveGuideId(current => current === example.id ? null : example.id)}
            className={`flex min-h-12 w-full items-center justify-center rounded-smart-control border px-3 py-2 text-center text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm ${isActive ? 'border-primary-300 bg-primary-50 text-primary-900 shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-900'}`}
          >
            {example.title}
          </button>
          {isActive && <div id={`guide-${example.id}`} role="tooltip" className={`absolute top-[calc(100%+0.5rem)] z-30 w-[min(220px,calc(100vw-3rem))] rounded-2xl border border-white/10 bg-slate-950 p-4 text-xs font-bold text-white shadow-2xl ${index % 2 === 0 ? 'left-0' : 'right-0'} lg:left-1/2 lg:right-auto lg:-translate-x-1/2`}>
            <div className="space-y-2">
              {[['Apresentador', example.presenter], ['Narração', example.narration], ['Textos', example.texts], ['CTA', example.cta]].map(([label, enabled]) => <p key={label} className="flex items-center justify-between gap-4"><span>{label}:</span><span className="text-cyan-200">{enabled ? 'Sim' : 'Não'}</span></p>)}
            </div>
          </div>}
        </div>
      })}
    </div>
  </ProductCard>
}

function SmartTourStartChoice({ onSelectImages, onSelectShortVideos, shortVideosVisible }) {
  return <ProductCard className="mt-8 p-5 sm:p-7">
    <ProductSectionHeading title="Como deseja começar?" />
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ProductCard as="article" variant="flat" className="flex h-full flex-col p-5 sm:p-6">
        <h3 className="text-lg font-black text-slate-950">Criar um vídeo com fotos</h3>
        <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">Utilize até 5 fotos do imóvel para criar uma apresentação profissional.</p>
        <ProductButton type="button" onClick={onSelectImages} className="mt-5 w-full sm:w-fit">
          Criar vídeo com fotos
        </ProductButton>
      </ProductCard>
      {shortVideosVisible && <ProductCard as="article" variant="flat" className="flex h-full flex-col p-5 sm:p-6">
        <h3 className="text-lg font-black text-slate-950">Transformar um vídeo em Short</h3>
        <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">Envie um vídeo do imóvel e transforme-o em um Short automaticamente.</p>
        <ProductButton type="button" onClick={onSelectShortVideos} className="mt-5 w-full sm:w-fit">
          Criar Short com vídeo
        </ProductButton>
      </ProductCard>}
    </div>
  </ProductCard>
}

function SmartTourShowcase() {
  const [activeIndex, setActiveIndex] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)
  const activeExample = activeIndex === null ? null : visibleExamples[activeIndex]
  const close = () => {
    modalVideoRef.current?.pause()
    setActiveIndex(null)
  }
  const showPrevious = () => setActiveIndex(current => (current - 1 + SMART_TOUR_EXAMPLES.length) % SMART_TOUR_EXAMPLES.length)
  const showNext = () => setActiveIndex(current => (current + 1) % SMART_TOUR_EXAMPLES.length)

  useEffect(() => {
    if (activeIndex === null) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowLeft') setActiveIndex(current => (current - 1 + SMART_TOUR_EXAMPLES.length) % SMART_TOUR_EXAMPLES.length)
      if (event.key === 'ArrowRight') setActiveIndex(current => (current + 1) % SMART_TOUR_EXAMPLES.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex])

  return <>
    <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {visibleExamples.map((example, exampleIndex) => (
        <ProductCard as="article" key={example.id} variant="flat" className="flex min-w-0 flex-col p-4">
          <button
            type="button"
            onClick={() => setActiveIndex(exampleIndex)}
            className="group mx-auto block w-full max-w-[190px] rounded-[2rem] border border-slate-700 bg-slate-950 p-2 text-left shadow-xl shadow-slate-200/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label={`Ampliar demonstração: ${example.title}`}
          >
            <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.45rem] bg-slate-900">
              {example.placeholder ? <ExamplePlaceholder example={example} /> : (
                <video
                  src={example.video}
                  aria-label={`Demonstração: ${example.title}`}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                  preload="metadata"
                  disablePictureInPicture
                  disableRemotePlayback
                  controlsList="nodownload noremoteplayback"
                  onContextMenu={event => event.preventDefault()}
                  className="smart-phone-media absolute inset-0 bg-black"
                />
              )}
              <span className="absolute inset-0 rounded-[1.45rem] ring-1 ring-inset ring-white/10 transition group-hover:ring-primary-300/60" />
            </div>
          </button>
          <h3 className="mt-4 text-center text-base font-black text-slate-950">{example.title}</h3>
          <p className="mt-2 flex-1 text-center text-sm font-semibold leading-6 text-slate-600">{example.description}</p>
          <ProductButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setActiveIndex(exampleIndex)}
            className="mx-auto mt-4"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Ver exemplo
          </ProductButton>
        </ProductCard>
      ))}
    </div>

    {activeExample && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Demonstração ampliada: ${activeExample.title}`}
        onMouseDown={event => { if (event.target === event.currentTarget) close() }}
      >
        <div className="relative flex max-h-full w-full max-w-4xl flex-col items-center">
          <div className="mb-3 flex w-full items-center justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{activeExample.title}</p>
              <p className="text-xs font-semibold text-slate-300">{activeIndex + 1} de {SMART_TOUR_EXAMPLES.length}</p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950" aria-label="Fechar demonstração">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid min-h-0 w-full max-w-[560px] grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-1 sm:gap-3">
            <button type="button" onClick={showPrevious} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Demonstração anterior">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative h-[min(calc(100dvh-9rem),calc(177.778vw-13.333rem),760px)] w-auto max-w-full justify-self-center aspect-[9/16] overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl">
              {activeExample.placeholder ? <ExamplePlaceholder example={activeExample} large /> : (
                <video
                  key={activeExample.id}
                  ref={modalVideoRef}
                  src={activeExample.video}
                  aria-label={`Demonstração ampliada: ${activeExample.title}`}
                  autoPlay
                  playsInline
                  controls
                  preload="metadata"
                  disablePictureInPicture
                  disableRemotePlayback
                  controlsList="nodownload noremoteplayback"
                  onContextMenu={event => event.preventDefault()}
                  className="smart-presentation-media bg-black"
                />
              )}
            </div>
            <button type="button" onClick={showNext} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Próxima demonstração">
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    )}
  </>
}

function ExamplePlaceholder({ example, large = false }) {
  return <div className="relative flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_42%),linear-gradient(160deg,#0f172a_0%,#1e293b_52%,#0f2742_100%)] px-4 text-center text-white">
    <PlayCircle className={large ? 'h-14 w-14 text-cyan-200' : 'h-9 w-9 text-cyan-200'} />
    <p className={`${large ? 'mt-5 text-sm' : 'mt-4 text-[10px]'} font-black uppercase tracking-[0.2em] text-cyan-100`}>Vídeo pendente</p>
    <p className={`${large ? 'mt-3 text-base' : 'mt-2 text-xs'} font-black`}>{example.title}</p>
    <p className={`${large ? 'mt-4 max-w-sm text-sm' : 'mt-3 text-[10px]'} break-all font-semibold leading-5 text-slate-300`}>{example.video}</p>
  </div>
}

function Question(props) {
  const { id, images, missingImageMetadata, shortVideo, missingShortVideoMetadata, isShortVideos, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, message, status, addImages, addShortVideo, move, remove, answerQuestion, setPropertyField, setGeneration, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, setShortVideo, createTour, resetCreation, reviewItems, onReviewEdit } = props
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; return <button key={item.id} type="button" onClick={() => select(item.id, item.label)} className={`rounded-smart-control border p-4 text-left font-bold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${value === item.id ? 'border-primary-500 bg-primary-50 text-primary-950 ring-2 ring-primary-100' : 'border-slate-200 bg-white hover:border-primary-300'}`}><b className="text-sm">{item.label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const explainedChoices = (explanation, items, value, select) => <><p className="mb-3 text-xs font-semibold leading-5 text-slate-500">{explanation}</p>{choices(items, value, select)}</>
  const cont = (disabled, answer, nextQuestionId, apply, answerId = '') => <ProductButton type="button" disabled={disabled} onClick={() => answerQuestion({ answer, answerId, nextQuestionId, apply })} className="mt-5">Continuar</ProductButton>
  const applyCustomPresenterVideoChoices = () => {
    setGeneration(current => ({ ...current, narration: 'enabled', captions: 'disabled' }))
    setCtaEnabled(false)
    setCta('')
    setIncludePhone(false)
  }
  if (id === 'images' && isShortVideos) return <>
    <input ref={inputRef} type="file" accept="video/mp4" hidden onChange={event => { addShortVideo(event.target.files); event.target.value = '' }} />
    <p className="mb-3 text-sm font-semibold leading-6 text-slate-600">Envie um vídeo de até 5 minutos. A IA selecionará automaticamente os melhores momentos para criar um Short vertical.</p>
    {missingShortVideoMetadata && !shortVideo && <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Rascunho restaurado. Selecione novamente o vídeo “{missingShortVideoMetadata.name}”; o arquivo físico não é armazenado.</p>}
    {!shortVideo ? <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed border-primary-200 bg-primary-50/60 px-4 text-center transition hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"><UploadCloud className="text-primary-600" /><b className="mt-2 text-sm">Selecionar vídeo</b><span className="text-xs text-slate-500">Um arquivo MP4 de até 5 minutos</span><span className="mt-1 text-xs text-slate-400">Máximo de 250 MB</span></button> : <div className="rounded-smart-card border border-slate-200 bg-white p-4"><video src={shortVideo.preview} controls playsInline preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="mx-auto max-h-80 w-full rounded-2xl bg-slate-950 object-contain" aria-label="Prévia do vídeo original" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><Video className="h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{shortVideo.file.name}</p><p className="text-xs font-semibold text-slate-500">{formatShortVideoDuration(shortVideo.duration)} · {(shortVideo.file.size / 1024 / 1024).toFixed(1)} MB</p></div><ProductButton type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>Substituir</ProductButton><ProductButton type="button" variant="danger" size="sm" onClick={() => setShortVideo(null)} aria-label="Remover vídeo"><Trash2 className="h-4 w-4" />Remover</ProductButton></div></div>}
    {message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}
    {shortVideo && cont(false, shortVideo.file.name, 'purpose')}
  </>
  if (id === 'images') return <><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} />{missingImageMetadata.length > 0 && images.length === 0 && <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Rascunho restaurado. Selecione novamente {missingImageMetadata.length} {missingImageMetadata.length === 1 ? 'imagem' : 'imagens'} na ordem indicada; os arquivos físicos não são armazenados.</p>}<button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed border-primary-200 bg-primary-50/60 transition hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"><UploadCloud className="text-primary-600" /><b className="mt-2 text-sm">Selecionar fotos</b><span className="text-xs text-slate-500">Selecione de 1 a {SMART_TOUR_MAX_IMAGES} fotos</span><span className="mt-1 text-xs text-slate-400">JPG ou PNG · até 15 MB cada</span></button><p className="mt-3 text-xs font-bold">{images.length} de {SMART_TOUR_MAX_IMAGES} imagens</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><img src={item.preview} alt={`Foto ${position + 1}`} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false, `${images.length} foto${images.length > 1 ? 's' : ''}`, 'purpose')}</>
  if (id === 'purpose') return choices([{id:'sale',label:'Venda'},{id:'rent',label:'Locação'}], property.purpose, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'stage', apply: () => setPropertyField('purpose', value) }))
  if (id === 'stage') { const stageOptions = isShortVideos ? getShortVideosStageOptions(property.purpose, STAGES) : getSmartTourStageOptions(property.purpose, STAGES); return choices(stageOptions, property.stage, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'type', apply: () => setPropertyField('stage', value) })) }
  if (id === 'type') { const propertyTypes = isShortVideos ? getShortVideosPropertyTypes(property.purpose, SMART_TOUR_PROPERTY_TYPES) : getSmartTourPropertyTypes(property.purpose, SMART_TOUR_PROPERTY_TYPES); return <>{choices(propertyTypes, property.type, value => setPropertyField('type', value))}{cont(!property.type, property.type, 'facts')}</> }
  if (id === 'facts') {
    const fields = getSmartTourMeasureFields(property.type)
    const fieldLabels = { bedrooms:'Dormitórios', suites:'Suítes', parkingSpaces:'Vagas', area:'Área' }
    const answer = fields.map(field => `${fieldLabels[field]}: ${property[field]}${field === 'area' ? ' m²' : ''}`).join(' · ')
    const isIncomplete = fields.some(field => field === 'area' ? Number(property.area) <= 0 : property[field] === '')
    return <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => field === 'area' ? (
          <label key={field} className="text-xs font-black">
            {fieldLabels[field]}
            <div className="mt-1 flex items-center rounded-smart-control border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
              <input
                aria-label="Área do imóvel"
                value={property.area}
                onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 6); setPropertyField('area', Number(digits) > 0 ? String(Number(digits)) : '') }}
                inputMode="numeric"
                placeholder="Ex.: 85"
                className="min-w-0 flex-1 rounded-xl border-0 p-3 outline-none"
              />
              <span className="pr-3 text-sm font-black text-slate-500">m²</span>
            </div>
          </label>
        ) : (
          <fieldset key={field} className="min-w-0">
            <legend className="text-xs font-black">{fieldLabels[field]}</legend>
            <div className="mt-1 flex flex-wrap gap-2" aria-label={`Opções de ${fieldLabels[field].toLocaleLowerCase('pt-BR')}`}>
              {SMART_TOUR_MEASURE_OPTIONS[field].map(option => <button key={option} type="button" onClick={() => setPropertyField(field, option)} className={`min-w-11 rounded-smart-control border px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${property[field] === option ? 'border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-100' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'}`}>{option}</button>)}
            </div>
          </fieldset>
        ))}
      </div>
      {cont(isIncomplete, answer, 'location')}
    </>
  }
  if (id === 'location') { const normalizedDistrict = normalizeSmartTourDistrict(property.district); const location = formatSmartTourLocation({ ...property, district: normalizedDistrict }); return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder="Bairro" className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !normalizedDistrict, location, 'commercial', () => setPropertyField('district', normalizedDistrict))}</div> }
  if (id === 'commercial') { const commercialAnswer = [property.price, property.condominium, property.iptu].filter(Boolean).join(' · ') || 'Sem informações comerciais'; const commercialFields = [['price', property.purpose === 'rent' ? 'Valor da locação' : 'Preço'], ['condominium','Condomínio'], ['iptu','IPTU']]; return <><div className="grid gap-3 sm:grid-cols-3">{commercialFields.map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field, formatSmartTourCurrency(event.target.value))} inputMode="numeric" placeholder="R$ 0" className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false, commercialAnswer, 'highlights')}</> }
  if (id === 'highlights') { const highlightGroups = getSmartTourHighlightGroups(property.type); return <><p className="mb-3 text-xs font-bold text-slate-500">Selecione até 10 características. Somente os itens escolhidos serão enviados como contexto.</p><div className="space-y-4">{highlightGroups.map(group => <section key={group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{group.title}</h4><div className="flex flex-wrap gap-2">{group.items.map(item => <button key={item} type="button" disabled={!property.highlights.includes(item) && property.highlights.length >= 10} onClick={() => toggleHighlight(item)} className={`rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${property.highlights.includes(item) ? 'border-primary-400 bg-primary-50 text-primary-900' : 'border-slate-200 bg-white hover:border-primary-300'}`}>{item}</button>)}</div></section>)}</div>{cont(false, property.highlights.length ? `${property.highlights.length} destaques` : 'Nenhum destaque adicional', 'presenter')}</> }
  if (id === 'presenter') return explainedChoices('Um corretor ou corretora virtual poderá apresentar o imóvel de forma natural, mantendo os ambientes como o principal destaque.', [{id:'female',label:'Corretora'},{id:'male',label:'Corretor'},{id:'none',label:'Nenhum'}], generation.presenterGender, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGeneration(current => ({ ...current, presenterGender: value, presenterSpeechMode: 'automatic', presenterCustomSpeech: '' })) }))
  if (id === 'presenter_speech_mode') return explainedChoices('Escolha como a fala do Corretor Virtual será definida.', [
    {id:'automatic',label:'Apresentar o imóvel',description:'O Smart cria a fala usando as informações do imóvel.'},
    {id:'custom',label:'Escrever minha própria fala',description:'Você escreve exatamente o que o Corretor Virtual vai dizer.'},
  ], generation.presenterSpeechMode, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGeneration(current => ({ ...current, presenterSpeechMode: value, presenterCustomSpeech: '', ...(value === 'custom' ? { narration: 'enabled' } : {}) })) }))
  if (id === 'presenter_custom_speech') {
    const wordCount = countWords(generation.presenterCustomSpeech)
    const invalid = wordCount < 1 || wordCount > 25
    return <>
      <label className="block text-sm font-black text-slate-800" htmlFor="presenter-custom-speech">Escreva a fala do Corretor Virtual</label>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">O vídeo tem 10 segundos. Escreva até 25 palavras para manter uma fala natural.</p>
      <textarea id="presenter-custom-speech" value={generation.presenterCustomSpeech} onChange={event => setGeneration(current => ({ ...current, presenterCustomSpeech: event.target.value, narration: 'enabled' }))} rows={5} className="mt-3 w-full rounded-smart-control border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold"><span className={wordCount > 25 ? 'text-red-600' : 'text-slate-500'}>{wordCount} / 25 palavras</span>{wordCount > 25 && <span role="alert" className="text-right text-red-600">Reduza a fala para no máximo 25 palavras.</span>}</div>
      {cont(invalid, generation.presenterCustomSpeech, 'review', applyCustomPresenterVideoChoices)}
    </>
  }
  if (id === 'narration') return explainedChoices('Uma narração em português do Brasil apresentará o imóvel de forma natural e sincronizada com as imagens.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.narration, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('narration', value) }))
  if (id === 'captions') return explainedChoices('As informações do imóvel continuarão sendo utilizadas para gerar a campanha completa. Ao escolher ‘Não’, elas apenas deixarão de aparecer durante o vídeo.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.captions, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('captions', value) }))
  if (id === 'cta_enabled') return explainedChoices('Ao final do vídeo poderá ser exibido um convite para contato utilizando as informações do seu cadastro profissional.', [{id:'yes',label:'Sim'},{id:'no',label:'Não'}], ctaEnabled === true ? 'yes' : ctaEnabled === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { const enabled = value === 'yes'; setCtaEnabled(enabled); if (!enabled) { setCta(''); setIncludePhone(false) } } }))
  if (id === 'cta') return choices(CTAS, cta, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setCta(value) }))
  if (id === 'phone') return choices([{id:'yes',label:'Sim',description:phone || 'Cadastre o telefone no Perfil Profissional.'},{id:'no',label:'Não'}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; answerQuestion({ answer: value === 'yes' ? 'Telefone profissional' : 'Sem telefone', answerId: value, apply: () => setIncludePhone(value === 'yes') }) })
  const finalChoiceItems = [
    ...(!isShortVideos ? [{ label: 'Apresentador', value: generation.presenterGender === 'female' ? 'Corretora' : generation.presenterGender === 'male' ? 'Corretor' : 'Nenhum' }] : []),
    ...(!isShortVideos && ['female','male'].includes(generation.presenterGender) ? [{ label: 'Fala do Corretor Virtual', value: generation.presenterSpeechMode === 'custom' ? generation.presenterCustomSpeech : 'Apresentar o imóvel' }] : []),
    { label: 'Narração', value: generation.presenterSpeechMode === 'custom' ? 'Sim (implícita)' : generation.narration === 'enabled' ? 'Sim' : 'Não' },
    { label: 'Textos', value: generation.captions === 'enabled' ? 'Sim' : 'Não' },
    { label: 'CTA', value: ctaEnabled === true ? (cta || 'Sim') : 'Não' },
    ...(ctaEnabled === true ? [{ label: 'Telefone', value: includePhone === true ? phone : 'Não' }] : []),
  ]
  return <>
    <div className="rounded-2xl bg-primary-50 p-4 text-sm font-semibold leading-6 text-primary-950 ring-1 ring-primary-100">
      <p className="text-lg font-black">Revise suas escolhas</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {finalChoiceItems.map(item => <div key={item.label} className="rounded-2xl border border-primary-100 bg-white px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wide text-primary-700">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></div>)}
      </div>
      <p className="mt-4 font-black">Confirma suas escolhas?</p>
    </div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Todas as escolhas</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-primary-700">{reviewLabel(item.id, isShortVideos)}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-slate-700">{item.label}</p></div><button type="button" onClick={() => onReviewEdit(item.id)} className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-primary-700 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500">Editar</button></div></div>)}
    </div>
    {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-primary-600" />}<b className="text-sm">{message}</b></div>}
    <SmartTokenEstimate cost={SMART_TOKEN_COSTS.geminiVideo} />
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ProductButton type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="w-full"><Video className="h-4 w-4" />{status === 'error' ? 'Tentar novamente' : 'Confirmar e criar vídeo'}</ProductButton>
      <ProductButton type="button" variant="secondary" disabled={['uploading','generating'].includes(status)} onClick={resetCreation}>Refazer criação</ProductButton>
    </div>
  </>
}

function reviewLabel(id, isShortVideos = false) {
  return {
    images: isShortVideos ? 'Vídeo original' : 'Fotos', purpose: 'Finalidade', stage: 'Estado', type: 'Tipo', facts: 'Medidas',
    location: 'Localização', commercial: 'Valores', highlights: 'Destaques',
    presenter: 'Apresentador', presenter_speech_mode: 'Fala do Corretor Virtual', presenter_custom_speech: 'Texto personalizado', narration: 'Narração', captions: 'Destaques no vídeo', cta_enabled: 'CTA final', cta: 'Chamada escolhida', phone: 'Telefone',
  }[id] || id
}

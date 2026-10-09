import { VIDEO_REAUTH_MESSAGE, isVideoSessionInvalid, requireVideoSession, validVideoUploads, verifyVideoUploads } from '../lib/smart-tour-auth-recovery'
import { BRAND } from '../config/brand'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, PlayCircle, Trash2, UploadCloud, Video, X } from 'lucide-react'
import Header from '../components/layout/Header'
import CampaignPackage from '../components/campaign/CampaignPackage'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading } from '../components/design-system'
import { buildSmartTourCampaignPackage } from '../components/campaign/buildSmartTourCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect, SmartLocationSelect } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation, { getConversationScrollBehavior } from '../components/conversation/GuidedConversation'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useProductDraft } from '../hooks/useProductDraft'
import { useAccountAnalytics } from '../hooks/useAccountAnalytics'
import { useAuth } from '../lib/auth-context'
import { useLocale } from '../i18n/useLocale'
import { ACCOUNT_ANALYTICS_PRODUCTS as PRODUCTS, ACCOUNT_ANALYTICS_STEPS as STEPS } from '../lib/account-analytics'
import { restoreProductDraftShape, toFileMetadata } from '../lib/product-draft'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'
import { supabase } from '../lib/supabase'
import { getMetaConnectionStatus, redirectToMetaOAuth } from '../lib/meta-oauth-connection'
import { clearPendingSmartTourPublication, preservePendingSmartTourPublication, publishSmartTourPublication, readPendingSmartTourPublication, recoverSmartTourPublication } from '../lib/smart-tour-social-publish'
import { clearSmartTourActiveJob, getSmartTourStatusHttpStatus, parseLatestCompletedSmartTour, readSmartTourActiveJob, shouldRecoverSmartTourGenerateResponse, shouldRetrySmartTourStatusResponse, shouldRetryStartingJobNotFound, writeSmartTourActiveJob } from '../lib/smart-tour-job-recovery'
import { mergeSmartTourCampaignHashtags } from '../lib/smart-tour-hashtags'
import { SMART_TOUR_EXAMPLES, SMART_TOUR_MAX_IMAGES, SMART_TOUR_PRODUCT_NAME } from '../config/smartTour'
import { getSmartTourNextQuestion, getSmartTourReviewEditNext, shouldAskProfessionalIdentity } from '../config/smartTourConversation'
import { buildProfessionalIdentity, formatProfessionalIdentity } from '../config/professionalProfile'
import ProfessionalIdentityQuestion from '../components/professional/ProfessionalIdentityQuestion'
import { formatSmartTourCurrency, formatSmartTourLocation, getSmartTourHighlightGroups, getSmartTourMeasureFields, getSmartTourPropertyTypes, getSmartTourStageOptions, normalizeSmartTourDistrict, SMART_TOUR_MEASURE_OPTIONS, SMART_TOUR_PROPERTY_TYPES } from '../config/smartTourForm'
import { getCountiesByState, getStatesForMarket, getUsCitiesByCounty, isValidCountyForState, isValidUsZipCode, normalizeUsZipCode } from '../config/locations'
import { formatPhone } from '../utils/phoneFormatters'
import { adaptQuestionsForShortVideos, buildShortVideoInputPath, cleanupShortVideoInput, formatShortVideoDuration, getShortVideosPropertyTypes, getShortVideosStageOptions, getShortVideoTerminalActions, readShortVideoDuration, SHORT_VIDEOS_INPUT_BUCKET, SHORT_VIDEOS_MODULE_ID, SHORT_VIDEOS_VISIBLE, validateShortVideoDuration, validateShortVideoFile } from '../config/shortVideos'

const BUCKET = 'studio-videos'
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTA_OPTIONS = Object.freeze({ BR: [{ id: 'schedule_visit', label: 'Agende sua visita' }, { id: 'learn_more', label: 'Saiba mais' }, { id: 'contact_now', label: 'Entre em contato agora' }, { id: 'contact_me', label: 'Fale comigo' }], US: [{ id: 'schedule_visit', label: 'Schedule a visit' }, { id: 'learn_more', label: 'Learn more' }, { id: 'contact_now', label: 'Contact us' }, { id: 'contact_me', label: 'Contact me' }] })
const US_STAGES = Object.freeze([{ id: 'preconstruction', label: 'Pre-construction' }, { id: 'new_development', label: 'New development' }, { id: 'under_construction', label: 'Under construction' }, { id: 'move_in_ready', label: 'Move-in ready' }])
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', bathrooms: '', parkingSpaces: '', area: '', state: '', county: '', city: '', district: '', zipCode: '', neighborhoodCommunity: '', price: '', condominium: '', iptu: '', hoa: '', propertyTaxes: '', highlights: [], description: '' }
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
const SMART_TOUR_QUESTION_ORDER = ['images', 'purpose', 'stage', 'type', 'facts', 'location', 'commercial', 'highlights', 'presenter', 'presenter_speech_mode', 'presenter_custom_speech', 'narration', 'captions', 'professional_identity', 'cta_enabled', 'cta', 'phone', 'review']
const formatUsLocation = ({ neighborhoodCommunity = '', city = '', county = '', state = '', zipCode = '' }) => [neighborhoodCommunity, city, county, state, zipCode].filter(Boolean).join(', ')

function normalizeGeneration(input) {
  const value = { ...initialGeneration, ...input }
  const presenterGender = ['female','male'].includes(value.presenterGender) ? value.presenterGender : 'none'
  const presenterSpeechMode = value.presenterSpeechMode === 'custom' ? 'custom' : 'automatic'
  return { ...value, mode: 'guided_tour', presenterGender, presenterSpeechMode, presenterCustomSpeech: presenterSpeechMode === 'custom' ? String(value.presenterCustomSpeech ?? '') : '', narration: presenterSpeechMode === 'custom' ? 'enabled' : value.narration === 'disabled' ? 'disabled' : 'enabled', captions: value.captions === 'disabled' ? 'disabled' : 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: value.language === 'en-US' ? 'en-US' : 'pt-BR' }
}

const countWords = value => String(value ?? '').trim().split(/\s+/).filter(Boolean).length
function questionsFor(isShortVideos = false, t = key => key) {
  const questions = [
    ['images', 1, t(isShortVideos ? 'smartTour.questions.video' : 'smartTour.questions.images')], ['purpose', 2, t('smartTour.questions.purpose')],
    ['stage', 2, t('smartTour.questions.stage')], ['type', 2, t('smartTour.questions.type')],
    ['facts', 2, t('smartTour.questions.facts')], ['location', 2, t('smartTour.questions.location')],
    ['commercial', 2, t('smartTour.questions.commercial')], ['highlights', 2, t('smartTour.questions.highlights')],
    ['presenter', 3, t('smartTour.questions.presenter')],
    ['presenter_speech_mode', 3, t('smartTour.questions.presenterSpeechMode')],
    ['presenter_custom_speech', 3, t('smartTour.questions.customSpeech')],
    ['narration', 3, t('smartTour.questions.narration')],
    ['captions', 3, t('smartTour.captions.question')],
    ['professional_identity', 4, t('smartTour.professionalIdentity.question')],
    ['cta_enabled', 4, t('smartTour.questions.ctaEnabled')],
  ]
  const completeQuestions = [...questions, ['cta', 4, t('smartTour.questions.cta')], ['phone', 4, t('smartTour.questions.phone')], ['review', 4, t('smartTour.questions.review')]]
  return isShortVideos ? adaptQuestionsForShortVideos(completeQuestions) : completeQuestions
}

function smartTourConfirmation(id, answer, isShortVideos = false, t = key => key) {
  const withValue = (key) => t(key).replace('{value}', answer)
  if (id === 'purpose') return answer === t('smartTour.purpose.rent') ? t('smartTour.confirmations.rent') : t('smartTour.confirmations.sale')
  const confirmations = {
    images: withValue(isShortVideos ? 'smartTour.confirmations.videoValidated' : 'smartTour.confirmations.photosOrdered'),
    stage: withValue('smartTour.confirmations.stage'), type: withValue('smartTour.confirmations.type'),
    facts: t('smartTour.confirmations.facts'),
    location: withValue('smartTour.confirmations.location'),
    commercial: !answer ? t('smartTour.confirmations.commercialEmpty') : t('smartTour.confirmations.commercial'),
    highlights: withValue('smartTour.confirmations.highlights'), presenter: answer === t('smartTour.presenter.none') ? t('smartTour.confirmations.noPresenter') : withValue('smartTour.confirmations.presenter'),
    presenter_speech_mode: answer === t('smartTour.speechMode.automatic') ? t('smartTour.confirmations.automaticSpeech') : t('smartTour.confirmations.customSpeechMode'),
    presenter_custom_speech: t('smartTour.confirmations.customSpeech'),
    narration: answer === t('smartTour.options.yes') ? t('smartTour.confirmations.narrationOn') : t('smartTour.confirmations.narrationOff'), captions: answer === t('smartTour.options.yes') ? t('smartTour.confirmations.captionsOn') : t('smartTour.confirmations.captionsOff'), cta_enabled: answer === t('smartTour.options.yes') ? t('smartTour.confirmations.ctaOn') : t('smartTour.confirmations.ctaOff'), cta: withValue('smartTour.confirmations.cta'), phone: answer === t('smartTour.review.phone') ? t('smartTour.confirmations.phoneOn') : t('smartTour.confirmations.phoneOff'),
  }
  return confirmations[id] || t('smartTour.confirmations.default')
}

export default function SmartTourAI() {
  const { user, profile, reloadProfile, updateUser } = useAuth()
  const { locale, market, t } = useLocale()
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
  const previousMarketRef = useRef(market)
  const pollRef = useRef(null)
  const recoveryStartedRef = useRef(false)
  const reviewEditRef = useRef(null)
  const shortVideoGenerationLockRef = useRef(false)
  const generationLockRef = useRef(false)
  const [uploads, setUploads] = useState(() => validVideoUploads(restoredTourDraft.uploads, user?.id))
  const uploadsRef = useRef(uploads)
  const [resumeAfterLogin, setResumeAfterLogin] = useState(restoredTourDraft.resumeAfterLogin === true)
  const [authRequired, setAuthRequired] = useState(false)
  const [images, setImages] = useState([])
  const [missingImageMetadata, setMissingImageMetadata] = useState(restoredImageMetadata)
  const [shortVideo, setShortVideo] = useState(null)
  const [missingShortVideoMetadata, setMissingShortVideoMetadata] = useState(restoredShortVideoMetadata?.name && restoredShortVideoMetadata.size > 0 ? restoredShortVideoMetadata : null)
  const [property, setProperty] = useState(() => restoreProductDraftShape(initialProperty, restoredTourDraft.property))
  const [generation, setGeneration] = useState(() => restoreProductDraftShape(initialGeneration, restoredTourDraft.generation))
  const [ctaEnabled, setCtaEnabled] = useState(() => typeof restoredTourDraft.ctaEnabled === 'boolean' ? restoredTourDraft.ctaEnabled : null)
  const [cta, setCta] = useState(() => typeof restoredTourDraft.cta === 'string' ? restoredTourDraft.cta : '')
  const [includePhone, setIncludePhone] = useState(() => typeof restoredTourDraft.includePhone === 'boolean' ? restoredTourDraft.includePhone : null)
  const [showProfessionalIdentity, setShowProfessionalIdentity] = useState(() => typeof restoredTourDraft.showProfessionalIdentity === 'boolean' ? restoredTourDraft.showProfessionalIdentity : null)
  // The legacy boolean is retained exclusively for the frozen Short Videos path.
  // A photo-flow legacy draft that opted in is deliberately incomplete: we ask the
  // name choice again rather than inventing it.
  const [professionalIdentitySelection, setProfessionalIdentitySelection] = useState(() => {
    const saved = restoredTourDraft.professionalIdentity
    if (saved?.enabled === false) return { enabled: false, name_source: null }
    if (saved?.enabled === true && ['real', 'display'].includes(saved.name_source)) return { enabled: true, name_source: saved.name_source }
    if (restoredTourDraft.showProfessionalIdentity === false) return { enabled: false, name_source: null }
    return { enabled: null, name_source: null }
  })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [recoverableJob, setRecoverableJob] = useState(null)
  // Real Estate Video is photo-first. Short Videos remain isolated and disabled here.
  const [activeInputFlow, setActiveInputFlow] = useState(restoredInputFlow || 'images')
  const [conversationSnapshot, setConversationSnapshot] = useState(() => restoredTourDraft.conversation || null)
  const isShortVideos = activeInputFlow === SHORT_VIDEOS_MODULE_ID
  const questions = useMemo(() => questionsFor(isShortVideos, t), [isShortVideos, t])
  const professionalMarket = user?.market === 'US' || market === 'US' ? 'US' : 'BR'
  const legacyProfessionalIdentity = formatProfessionalIdentity(profile || user || {}, professionalMarket)
  const professionalIdentity = buildProfessionalIdentity(profile || user || {}, professionalIdentitySelection, professionalMarket)
  const canAskProfessionalIdentity = !isShortVideos && shouldAskProfessionalIdentity({ captions: generation.captions, identity: true })
  const rawPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const phone = formatPhone(rawPhone, professionalMarket)
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => ({ ...current, [field]: value }))
  const clearUploadedPhotos = () => { uploadsRef.current = null; setUploads(null) }
  const clearInputMedia = () => {
    clearUploadedPhotos()
    setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
    setShortVideo(null)
    setMissingImageMetadata([])
    setMissingShortVideoMetadata(null)
  }

  useEffect(() => () => {
    if (shortVideo?.preview) URL.revokeObjectURL(shortVideo.preview)
  }, [shortVideo?.preview])

  useEffect(() => {
    if (previousMarketRef.current === market) return
    previousMarketRef.current = market
    // Counts for bedrooms and parking remain meaningful; market-specific facts do not.
    setProperty(current => ({
      ...current,
      stage: '', type: '', suites: '', bathrooms: '', area: '', state: '', county: '', city: '', district: '', zipCode: '', neighborhoodCommunity: '',
      price: '', condominium: '', iptu: '', hoa: '', propertyTaxes: '', highlights: [],
    }))
    setCta('')
    setConversationSnapshot(null)
  }, [market])

  const resetTourFromQuestion = (questionId) => {
    if (reviewEditRef.current) {
      if (questionId === 'images') clearInputMedia()
      if (questionId === 'purpose') setProperty(current => ({ ...current, purpose: '', stage: '' }))
      if (questionId === 'stage') setProperty(current => ({ ...current, stage: '' }))
      if (questionId === 'type') setProperty(current => ({ ...current, type: '', bedrooms: '', suites: '', bathrooms: '', parkingSpaces: '', area: '', highlights: [] }))
      if (questionId === 'facts') setProperty(current => ({ ...current, bedrooms: '', suites: '', bathrooms: '', parkingSpaces: '', area: '' }))
      if (questionId === 'location') setProperty(current => ({ ...current, state: '', county: '', city: '', district: '', zipCode: '', neighborhoodCommunity: '' }))
      if (questionId === 'commercial') setProperty(current => ({ ...current, price: '', condominium: '', iptu: '', hoa: '', propertyTaxes: '' }))
      if (questionId === 'highlights') setProperty(current => ({ ...current, highlights: [] }))
      if (questionId === 'presenter') setGeneration(current => ({ ...current, presenterGender: '' }))
      if (questionId === 'presenter_speech_mode') setGeneration(current => ({ ...current, presenterSpeechMode: 'automatic', presenterCustomSpeech: '' }))
      if (questionId === 'presenter_custom_speech') setGeneration(current => ({ ...current, presenterCustomSpeech: '' }))
      if (questionId === 'narration') setGeneration(current => ({ ...current, narration: '' }))
      if (questionId === 'captions') setGeneration(current => ({ ...current, captions: '' }))
      if (questionId === 'professional_identity') {
        if (isShortVideos) setShowProfessionalIdentity(null)
        else setProfessionalIdentitySelection({ enabled: null, name_source: null })
      }
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
    const propertyFields = [['purpose', 'purpose'], ['stage', 'stage'], ['type', 'type'], ['facts', 'bedrooms'], ['facts', 'suites'], ['facts', 'bathrooms'], ['facts', 'parkingSpaces'], ['facts', 'area'], ['location', 'state'], ['location', 'county'], ['location', 'city'], ['location', 'district'], ['location', 'zipCode'], ['location', 'neighborhoodCommunity'], ['commercial', 'price'], ['commercial', 'condominium'], ['commercial', 'iptu'], ['commercial', 'hoa'], ['commercial', 'propertyTaxes'], ['highlights', 'highlights']]
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
    if (shouldReset('professional_identity')) {
      if (isShortVideos) setShowProfessionalIdentity(null)
      else setProfessionalIdentitySelection({ enabled: null, name_source: null })
    }
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
  const reachedStep = !activeInputFlow
    ? null
    : question[0] === 'review' ? STEPS.REVIEW
      : question[0] === 'images' ? (images.length ? STEPS.UPLOAD : STEPS.FLOW_STARTED)
        : STEPS.DETAILS
  const { trackGenerationClicked } = useAccountAnalytics(PRODUCTS.VIDEO_IMOBILIARIO, reachedStep)

  useEffect(() => {
    if (!['idle', 'error'].includes(status)) return
    if (readSmartTourActiveJob(sessionStorage).record) return
    const imageMetadata = images.length
      ? images.map((item, order) => toFileMetadata(item.file, order)).filter(Boolean)
      : missingImageMetadata
    const shortVideoMetadata = shortVideo?.file
      ? { ...toFileMetadata(shortVideo.file, 0), duration: shortVideo.duration }
      : missingShortVideoMetadata
    const draft = { activeInputFlow, property, generation, locale, market, ctaEnabled, cta, includePhone, showProfessionalIdentity, professionalIdentity: professionalIdentitySelection, imageMetadata, shortVideoMetadata, conversation: conversationSnapshot, uploads, resumeAfterLogin }
    const meaningful = activeInputFlow || conversationSnapshot?.history?.length || imageMetadata.length || shortVideoMetadata || Object.values(property).some(value => Array.isArray(value) ? value.length : Boolean(value))
    if (!meaningful) { tourDraft.clear(); return }
    tourDraft.save(draft)
  }, [activeInputFlow, conversationSnapshot, cta, ctaEnabled, generation, images, includePhone, missingImageMetadata, missingShortVideoMetadata, professionalIdentitySelection, property, shortVideo, showProfessionalIdentity, status, tourDraft, uploads, resumeAfterLogin])
  const answerQuestion = ({ answer, answerId = '', nextQuestionId = getSmartTourNextQuestion({ questionId: question[0], answerId, mode: generation.mode }), apply }) => {
    let resolvedNextQuestionId = nextQuestionId
    const shouldShowProfessionalIdentity = question[0] === 'captions'
      ? (!isShortVideos && shouldAskProfessionalIdentity({ captions: answerId, identity: true }))
      : canAskProfessionalIdentity
    if (resolvedNextQuestionId === 'professional_identity' && !shouldShowProfessionalIdentity) resolvedNextQuestionId = 'cta_enabled'
    if (reviewEditRef.current) {
      resolvedNextQuestionId = getSmartTourReviewEditNext({ originQuestionId: reviewEditRef.current, questionId: question[0], answerId, mode: generation.mode })
      if (resolvedNextQuestionId === 'review') reviewEditRef.current = null
    }
    if (isShortVideos && resolvedNextQuestionId === 'presenter') resolvedNextQuestionId = 'narration'
    const accepted = conversation.submitAnswer({ questionId: question[0], question: question[2], answer, confirmation: smartTourConfirmation(question[0], answer, isShortVideos, t), nextQuestionId: resolvedNextQuestionId })
    if (accepted) apply?.()
    return accepted
  }
  const editConversationAnswer = questionId => {
    if (question[0] === 'review') reviewEditRef.current = questionId
    conversation.editAnswer(questionId)
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])
  useEffect(() => {
    if (restoredTourDraft.resumeAfterLogin) return
    if (recoveryStartedRef.current) return
    const { record: activeJob, invalid } = readSmartTourActiveJob(sessionStorage)
    if (invalid) {
      clearSmartTourActiveJob(sessionStorage)
      return
    }
    if (!activeJob) {
      recoveryStartedRef.current = true
      void supabase.functions.invoke('smart-tour-status', { body: { action: 'discover_latest' } }).then(({ data, error }) => {
        if (error) return
        const latest = parseLatestCompletedSmartTour(data)
        if (!latest) return
        tourDraft.clear()
        const campaignPackage = {
          unifiedSocialPublishing: true,
          aiCampaigns: latest.publicationOptions.map((option, index) => ({
            id: option.id,
            name: `Opção ${index + 1}`,
            instagram: option.text,
            facebook: option.text,
            whatsapp: option.text,
            linkedin: option.text,
            hashtags: latest.hashtags,
          })),
        }
        setResult({ ...latest, campaignPackage: mergeSmartTourCampaignHashtags(campaignPackage, latest.hashtags), inputFlow: 'images' })
        setStatus('completed')
      })
      return
    }
    recoveryStartedRef.current = true
    // Reading recovery metadata must never re-enter tracking or dispatch work.
    setRecoverableJob(activeJob)
    setMessage(t('smartTour.status.recoveryAvailable'))
  }, [])

  const addImages = files => {
    clearUploadedPhotos()
    const selectedInSystemOrder = Array.from(files)
    if (selectedInSystemOrder.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage(t('smartTour.uploadValidation.invalidImages'))
    setImages(current => {
      const known = new Set(current.map(item => item.key))
      const uniqueInSystemOrder = selectedInSystemOrder.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      if (current.length + uniqueInSystemOrder.length > SMART_TOUR_MAX_IMAGES) { setMessage(t('smartTour.uploadValidation.maxImages').replace('{count}', SMART_TOUR_MAX_IMAGES)); return current }
      setMessage('')
      setMissingImageMetadata([])
      return [...current, ...uniqueInSystemOrder.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))]
    })
  }
  const addShortVideo = async files => {
    const file = Array.from(files || [])[0]
    const fileError = validateShortVideoFile(file)
    if (fileError) return setMessage(fileError)
    setMessage(t('smartTour.uploadValidation.validatingVideo'))
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
  const move = (position, offset) => { clearUploadedPhotos(); setImages(current => { const target = position + offset; if (target < 0 || target >= current.length) return current; const nextImages = [...current]; [nextImages[position], nextImages[target]] = [nextImages[target], nextImages[position]]; return nextImages }) }
  const remove = position => { clearUploadedPhotos(); setImages(current => current.filter((item, itemIndex) => { if (itemIndex === position) URL.revokeObjectURL(item.preview); return itemIndex !== position })) }
  const toggleHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < 10 ? [...property.highlights, value] : property.highlights)

  async function poll(jobId) {
    const { record: activeJob } = readSmartTourActiveJob(sessionStorage)
    try {
      const { data, error } = await supabase.functions.invoke('smart-tour-status', { body: { jobId } })
      if (await isVideoSessionInvalid(error, data)) { requireLogin(); return }
      if (error || !data?.ok) {
        if (shouldRetryStartingJobNotFound(activeJob, error)) {
          setStatus('generating')
          setMessage(t('smartTour.status.resuming'))
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
              setMessage(t('smartTour.status.removeTemporaryVideo'))
              return
            }
          }
          clearSmartTourActiveJob(sessionStorage)
          if (terminalActions.releaseLock) shortVideoGenerationLockRef.current = false
          setStatus('error')
          setMessage(t('smartTour.status.unavailable'))
          return
        }
        if (shouldRetrySmartTourStatusResponse(error, data)) {
          setStatus('generating')
          setMessage(t('smartTour.status.checkingProgress'))
          pollRef.current = setTimeout(() => poll(jobId), 3000)
          return
        }
        throw new Error(data?.error || 'Não foi possível consultar a criação.')
      }
      if (data.status === 'completed') { tourDraft.clear(); clearUploadedPhotos(); setResumeAfterLogin(false); clearSmartTourActiveJob(sessionStorage); setResult({ ...data, campaignPackage: mergeSmartTourCampaignHashtags(activeJob?.campaignPackage || {}, data.hashtags), inputFlow: activeJob?.inputFlow || 'images' }); setStatus('completed'); void reloadProfile(); return }
      if (data.status === 'failed') { clearUploadedPhotos(); clearSmartTourActiveJob(sessionStorage); if (getShortVideoTerminalActions(activeJob, 'failed').releaseLock) shortVideoGenerationLockRef.current = false; setStatus('error'); setMessage(getSmartTokenErrorMessage(data.error, 'Não foi possível concluir. Tente novamente.')); void reloadProfile(); return }
      setMessage(data.message || t('smartTour.status.creating')); pollRef.current = setTimeout(() => poll(jobId), 9000)
    } catch (error) {
      if (await isVideoSessionInvalid(error)) { requireLogin(); return }
      setStatus('error'); setMessage(getSmartTokenErrorMessage(error, 'Não foi possível concluir. Tente novamente.')); void reloadProfile()
    }
  }

  const preserveBriefing = (resume = true) => tourDraft.replace({
    activeInputFlow, property, generation, ctaEnabled, cta, includePhone, showProfessionalIdentity, professionalIdentity: professionalIdentitySelection,
    imageMetadata: images.length ? images.map((item, order) => toFileMetadata(item.file, order)) : missingImageMetadata,
    shortVideoMetadata: shortVideo?.file ? { ...toFileMetadata(shortVideo.file), duration: shortVideo.duration } : missingShortVideoMetadata,
    conversation: conversationSnapshot, uploads: uploadsRef.current, resumeAfterLogin: resume,
  })
  const requireLogin = () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    setResumeAfterLogin(true)
    preserveBriefing()
    setAuthRequired(true)
    setStatus('error')
    setMessage(VIDEO_REAUTH_MESSAGE)
  }
  const loginAgain = async () => {
    if (!preserveBriefing()) { setMessage(t('smartTour.status.saveBriefingLogin')); return }
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) { setMessage(t('smartTour.status.openLogin')); return }
    window.location.assign('/login')
  }
  const createTour = async () => {
    if (generationLockRef.current || authRequired) return
    if (!isShortVideos && professionalIdentitySelection.enabled === null) {
      setStatus('error')
      setMessage(market === 'US' ? 'Choose whether to include professional information before creating the video.' : 'Escolha se deseja incluir identificação profissional antes de criar o vídeo.')
      return
    }
    if (isShortVideos) {
      if (shortVideoGenerationLockRef.current) {
        setMessage(t('smartTour.status.shortAlreadyStarted'))
        return
      }
      if (!shortVideo?.file) return setMessage(t('smartTour.status.selectVideo'))
      shortVideoGenerationLockRef.current = true
    }
    generationLockRef.current = true
    setResumeAfterLogin(true)
    if (!preserveBriefing()) { generationLockRef.current = false; setStatus('error'); setMessage(t('smartTour.status.saveBriefing')); return }
    trackGenerationClicked()
    setStatus('uploading'); setMessage(t(isShortVideos ? 'smartTour.status.uploadingVideo' : 'smartTour.status.uploadingPhotos'))
    try {
      await requireVideoSession(supabase, user.id)
      setAuthRequired(false)
      const pendingJob = readSmartTourActiveJob(sessionStorage).record
      if (pendingJob) { await poll(pendingJob.jobId); return }
      const savedUploads = !isShortVideos && validVideoUploads(uploadsRef.current, user.id)
      const requestId = savedUploads?.requestId || crypto.randomUUID()
      const apiGeneration = normalizeGeneration({ ...generation, language: market === 'US' ? 'en-US' : 'pt-BR' })
      const videoCtaEnabled = ctaEnabled === true
      const selectedCta = videoCtaEnabled ? cta : ''
      if (isShortVideos) {
        const videoPath = buildShortVideoInputPath(user.id, requestId)
        const { error: uploadError } = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET).upload(videoPath, shortVideo.file, { contentType: 'video/mp4' })
        if (uploadError) throw new Error('O vídeo não pôde ser enviado. Tente novamente.')
        setStatus('generating'); setMessage(t('smartTour.uploadValidation.selectingMoments'))
        let campaignPackage = buildSmartTourCampaignPackage({ property, language:apiGeneration.language, cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '' })
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
          showProfessionalIdentity: showProfessionalIdentity === true,
          language: apiGeneration.language, market,
        } })
        if (error || !data?.ok || !data?.jobId) {
          setStatus('generating')
          setMessage(t('smartTour.uploadValidation.confirmingStart'))
          poll(requestId)
          return
        }
        campaignPackage = buildSmartTourCampaignPackage({ property, language:apiGeneration.language, cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', hashtags:data.hashtags })
        writeSmartTourActiveJob(sessionStorage, { jobId:data.jobId, campaignPackage, inputFlow: SHORT_VIDEOS_MODULE_ID, phase:'active', updatedAt:Date.now() }); poll(data.jobId)
        return
      }
      const propertyPayload = market === 'US'
        ? { ...property, suites: '', condominium: '', iptu: '', district: '' }
        : { ...property, bathrooms: '', hoa: '', propertyTaxes: '', county: '', zipCode: '', neighborhoodCommunity: '' }
      const orderedImages = images.slice()
      if (!savedUploads && !orderedImages.length) throw new Error('Selecione as fotos novamente; seu briefing foi preservado.')
      if (savedUploads) await verifyVideoUploads(supabase, savedUploads, user.id)
      const imagePaths = savedUploads ? [...savedUploads.paths] : new Array(orderedImages.length)
      for (let imageIndex = 0; !savedUploads && imageIndex < orderedImages.length; imageIndex += 1) {
        const file = orderedImages[imageIndex].file
        const path = `${user.id}/smart-tour/${requestId}/${String(imageIndex + 1).padStart(2, '0')}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
        if (error) { if (await isVideoSessionInvalid(error)) throw error; throw new Error('Uma das fotos não pôde ser enviada. Tente novamente.') }
        imagePaths[imageIndex] = path
      }
      uploadsRef.current = { requestId, paths: imagePaths, savedAt: savedUploads?.savedAt || Date.now() }
      setUploads(uploadsRef.current)
      preserveBriefing()
      setStatus('generating'); setMessage(t('smartTour.status.creating'))
      let campaignPackage = buildSmartTourCampaignPackage({ property, language:apiGeneration.language, cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', unifiedSocialPublishing:true })
      writeSmartTourActiveJob(sessionStorage, { jobId:requestId, campaignPackage, inputFlow:'images', phase:'starting', updatedAt:Date.now() })
      const { data, error } = await supabase.functions.invoke('smart-tour-generate', { body: { clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property: propertyPayload, generation: apiGeneration, selectedCta, includeProfessionalPhone: videoCtaEnabled && includePhone === true, professional_identity: { enabled: professionalIdentitySelection.enabled === true, ...(professionalIdentitySelection.enabled === true ? { name_source: professionalIdentitySelection.name_source } : {}) }, language: apiGeneration.language, market } })
      if (await isVideoSessionInvalid(error, data)) {
        clearSmartTourActiveJob(sessionStorage)
        requireLogin()
        return
      }
      if (shouldRecoverSmartTourGenerateResponse(error, data)) {
        setStatus('generating')
        setMessage(t('smartTour.uploadValidation.confirmingStart'))
        poll(requestId)
        return
      }
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || 'Não foi possível iniciar a criação.')
      setResumeAfterLogin(false)
      preserveBriefing(false)
      campaignPackage = buildSmartTourCampaignPackage({ property, language:apiGeneration.language, cta:selectedCta, phone:videoCtaEnabled && includePhone ? phone : '', hashtags:data.hashtags, unifiedSocialPublishing:true })
      writeSmartTourActiveJob(sessionStorage, { jobId:data.jobId, campaignPackage, inputFlow:'images', phase:'active', updatedAt:Date.now() }); poll(data.jobId)
    } catch (error) {
      if (isShortVideos) shortVideoGenerationLockRef.current = false
      if (await isVideoSessionInvalid(error)) { requireLogin(); return }
      setStatus('error')
      setMessage(getSmartTokenErrorMessage(error, /^(As fotos salvas|Uma foto salva|Selecione as fotos|Não foi possível verificar sua sessão|Entre com a mesma conta)/.test(error?.message || '') ? error.message : 'Não foi possível criar sua apresentação.'))
    } finally { generationLockRef.current = false }
  }

  const reset = () => {
    setAuthRequired(false)
    setResumeAfterLogin(false)
    tourDraft.clear()
    clearSmartTourActiveJob(sessionStorage)
    shortVideoGenerationLockRef.current = false
    clearInputMedia()
    reviewEditRef.current = null
    setActiveInputFlow('images')
    setProperty(initialProperty)
    setGeneration(initialGeneration)
    setCtaEnabled(null)
    setCta('')
    setIncludePhone(null)
    setShowProfessionalIdentity(null)
    setProfessionalIdentitySelection({ enabled: null, name_source: null })
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
  if (result) { const isShortVideoResult = result.inputFlow === SHORT_VIDEOS_MODULE_ID; return <><Header title={SMART_TOUR_PRODUCT_NAME} subtitle={t('smartTour.resultSubtitle')} /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: SMART_TOUR_PRODUCT_NAME, ...(!isShortVideoResult ? { sourceType:'video_imobiliario', sourceId:result.jobId, mediaAssetId:result.jobId } : {}), mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl, downloadName: isShortVideoResult ? 'short-smartcorretorai.mp4' : 'smartcorretorai-apresentacao.mp4' }} videoPublish={!isShortVideoResult ? { enabled:true, captionEditable:true, loadConnection:() => getMetaConnectionStatus(supabase), resumeIntent:user?.id ? readPendingSmartTourPublication(window.sessionStorage,user.id) : null, onPublish:(intent,destinations) => publishSmartTourPublication(supabase,intent,destinations), onRecover:(intent,destinations) => recoverSmartTourPublication(supabase,intent,destinations), onResumed:() => clearPendingSmartTourPublication(window.sessionStorage,user?.id), onConnect:async intent => { if (!preservePendingSmartTourPublication(window.sessionStorage,user?.id,intent)) throw new Error('video_publication_pending_not_saved'); await redirectToMetaOAuth(supabase,url => window.location.assign(url)) } } : undefined} mediaPresentation={isShortVideoResult ? 'mobile' : 'default'} protectVideoDownload={isShortVideoResult} onCreateNew={reset} createNewLabel={t('smartTour.createNew')} /></main></> }

  const measureFields = getSmartTourMeasureFields(property.type, { market })
  const measureLabels = { bedrooms: t('smartTour.fields.bedrooms'), suites: t('smartTour.fields.suites'), bathrooms: t('smartTour.fields.bathrooms'), parkingSpaces: t('smartTour.fields.parkingSpaces'), area: market === 'US' ? 'sqft' : 'm²' }
  const measuresSummary = measureFields.map(field => property[field] && `${property[field]} ${measureLabels[field]}`).filter(Boolean).join(' · ')
  const stageLabel = market === 'US' ? (US_STAGES.find(option => option.id === property.stage)?.label || property.stage) : property.stage
  const propertyTypeLabel = getSmartTourPropertyTypes(property.purpose, { market }).find(option => option.value === property.type)?.labelKey ? t(getSmartTourPropertyTypes(property.purpose, { market }).find(option => option.value === property.type).labelKey) : property.type
  const valuesSummary = market === 'US'
    ? [property.price && `${property.purpose === 'rent' ? t('smartTour.commercial.rent') : t('smartTour.commercial.price')} ${property.price}`, property.hoa && `${t('smartTour.commercial.hoa')} ${property.hoa}`, property.propertyTaxes && `${t('smartTour.commercial.propertyTaxes')} ${property.propertyTaxes}`].filter(Boolean).join(' · ')
    : [property.price && `${property.purpose === 'rent' ? t('smartTour.commercial.rent') : t('smartTour.commercial.price')} ${property.price}`, property.condominium && `${t('smartTour.commercial.condominium')} ${property.condominium}`, property.iptu && `${t('smartTour.commercial.iptu')} ${property.iptu}`].filter(Boolean).join(' · ')
  const isReviewContext = question[0] === 'review' || Boolean(reviewEditRef.current)
  const summary = [
    { id: 'images', label: isShortVideos ? (shortVideo && `${shortVideo.file.name} · ${formatShortVideoDuration(shortVideo.duration)} · saída em formato Short vertical`) : ((images.length || uploads?.paths.length) && `${images.length || uploads.paths.length} fotos`) },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? t('smartTour.purpose.sale') : t('smartTour.purpose.rent')) },
    { id: 'stage', label: stageLabel },
    { id: 'type', label: propertyTypeLabel },
    { id: 'facts', label: measuresSummary },
    { id: 'location', label: market === 'US' ? formatUsLocation(property) : formatSmartTourLocation(property) },
    { id: 'commercial', label: valuesSummary || (isReviewContext ? t('smartTour.commercial.none') : '') },
    { id: 'highlights', label: property.highlights.length ? t('smartTour.highlightSelection.selectedCount').replace('{count}', property.highlights.length) : (isReviewContext ? t('smartTour.highlightSelection.none') : '') },
    ...(!isShortVideos ? [{ id: 'presenter', label: generation.presenterGender === 'female' ? t('smartTour.presenter.female') : generation.presenterGender === 'male' ? t('smartTour.presenter.male') : (isReviewContext ? t('smartTour.presenter.none') : '') }] : []),
    ...(!isShortVideos ? [{ id: 'presenter_speech_mode', label: generation.presenterSpeechMode === 'custom' ? t('smartTour.speechMode.custom') : t('smartTour.speechMode.automatic') }] : []),
    ...(!isShortVideos && generation.presenterSpeechMode === 'custom' && generation.presenterCustomSpeech ? [{ id: 'presenter_custom_speech', label: generation.presenterCustomSpeech }] : []),
    { id: 'narration', label: generation.presenterSpeechMode === 'custom' ? t('smartTour.review.implicitYes') : generation.narration === 'enabled' ? t('smartTour.options.yes') : generation.narration === 'disabled' ? t('smartTour.options.no') : '' }, { id: 'captions', label: generation.captions === 'enabled' ? t('smartTour.options.yes') : generation.captions === 'disabled' ? t('smartTour.options.no') : '' },
    { id: 'professional_identity', label: isShortVideos ? (showProfessionalIdentity === true ? legacyProfessionalIdentity : showProfessionalIdentity === false ? t('smartTour.options.no') : '') : (professionalIdentitySelection.enabled === true ? professionalIdentity?.formatted || '' : professionalIdentitySelection.enabled === false ? t('smartTour.options.no') : '') },
    { id: 'cta_enabled', label: ctaEnabled === true ? t('smartTour.options.yes') : ctaEnabled === false ? t('smartTour.options.no') : '' },
    { id: 'cta', label: ctaEnabled === true ? cta : '' },
    { id: 'phone', label: ctaEnabled === true ? (includePhone === true ? phone : includePhone === false ? t('smartTour.phone.none') : '') : '' },
  ].filter(item => Boolean(item.label))
  const visualStep = status === 'idle' ? question[1] : 5
  return <>
    <Header title={SMART_TOUR_PRODUCT_NAME} subtitle={t('smartTour.headerSubtitle')} />
    <main className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
      <ProductHero
        id="smart-tour-title"
        productName={t('smartTour.productName')}
        headline={t('smartTour.heroHeadline')}
        description={t('smartTour.heroDescription')}
      />

      {recoverableJob && <ProductCard className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{t('smartTour.status.recoveryAvailable')}</p><p className="mt-1 text-sm text-slate-600">{t('smartTour.status.recoveryReadOnly')}</p></div><ProductButton type="button" variant="secondary" onClick={() => { setStatus('generating'); setMessage(t('smartTour.status.resuming')); poll(recoverableJob.jobId); setRecoverableJob(null) }}>{t('smartTour.status.resumeTracking')}</ProductButton></ProductCard>}

      <ProductCard className="mt-8 p-5 sm:p-7">
        <ProductSectionHeading
          eyebrow={t('smartTour.showcase.eyebrow')}
          title={t('smartTour.showcase.title')}
          description={t('smartTour.showcase.description')}
        />
        <SmartTourShowcase />
      </ProductCard>

      <SmartTourGuide />

      {activeInputFlow && <div id="smart-tour-creation" className="mt-10 space-y-8 scroll-mt-6">
        <ProductSectionHeading eyebrow={isShortVideos ? t('smartTour.shortVideos') : t('smartTour.guidedCreation')} title={t('smartTour.creationTitle')} />
    <GuidedConversation
      market={isShortVideos ? undefined : market}
      history={conversation.history}
      phase={conversation.phase}
      questionId={question[0]}
      question={question[2]}
      questionNumber={questionIndex + 1}
      totalQuestions={questions.length}
      onEdit={editConversationAnswer}
      showSummary={false}
      review={question[0] === 'review'}
      editDisabled={['uploading', 'generating'].includes(status)}
      designSystem
      eyebrow={isShortVideos ? t('smartTour.shortVideos') : t('smartTour.guidedCreation')}
    >
      <Question id={question[0]} {...{ images, missingImageMetadata, shortVideo, missingShortVideoMetadata, isShortVideos, authRequired, loginAgain, uploads, resumeAfterLogin, market, property, generation, ctaEnabled, cta, includePhone, phone, professionalIdentity, legacyProfessionalIdentity, professionalIdentitySelection, profile: profile || user, showProfessionalIdentity, t, inputRef, message, status, addImages, addShortVideo, move, remove, answerQuestion, setPropertyField, setGeneration, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, setShowProfessionalIdentity, setProfessionalIdentitySelection, updateUser, reloadProfile, setShortVideo, createTour, resetCreation: reset, reviewItems: summary, onReviewEdit: editConversationAnswer }} />
    </GuidedConversation>
      </div>}
    </main>
  </>
}

function SmartTourGuide() {
  const { t, market } = useLocale()
  const [activeGuideId, setActiveGuideId] = useState(null)
  const [hoveredGuideId, setHoveredGuideId] = useState(null)
  const examples = market === 'US' ? [] : guideExamples
  if (!examples.length) return null
  return <ProductCard className="mt-8 p-5 sm:p-7">
    <ProductSectionHeading
      eyebrow={t('smartTour.guide.eyebrow')}
      title={t('smartTour.guide.title')}
      description={t('smartTour.guide.description')}
    />
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {examples.map((example, index) => {
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
              {[[t('smartTour.review.presenter'), example.presenter], [t('smartTour.review.narration'), example.narration], [t('smartTour.guide.texts'), example.texts], ['CTA', example.cta]].map(([label, enabled]) => <p key={label} className="flex items-center justify-between gap-4"><span>{label}:</span><span className="text-cyan-200">{enabled ? t('smartTour.options.yes') : t('smartTour.options.no')}</span></p>)}
            </div>
          </div>}
        </div>
      })}
    </div>
  </ProductCard>
}

function SmartTourStartChoice({ onSelectImages, onSelectShortVideos, shortVideosVisible }) {
  const { t } = useLocale()
  return <ProductCard className="mt-8 p-5 sm:p-7">
    <ProductSectionHeading title={t('smartTour.start.title')} />
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ProductCard as="article" variant="flat" className="flex h-full flex-col p-5 sm:p-6">
        <h3 className="text-lg font-black text-slate-950">{t('smartTour.start.photosTitle')}</h3>
        <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">{t('smartTour.start.photosDescription')}</p>
        <ProductButton type="button" onClick={onSelectImages} className="mt-5 w-full sm:w-fit">
          {t('smartTour.start.photosAction')}
        </ProductButton>
      </ProductCard>
      {shortVideosVisible && <ProductCard as="article" variant="flat" className="flex h-full flex-col p-5 sm:p-6">
        <h3 className="text-lg font-black text-slate-950">{t('smartTour.start.shortTitle')}</h3>
        <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">{t('smartTour.start.shortDescription')}</p>
        <ProductButton type="button" onClick={onSelectShortVideos} className="mt-5 w-full sm:w-fit">
          {t('smartTour.start.shortAction')}
        </ProductButton>
      </ProductCard>}
    </div>
  </ProductCard>
}

function SmartTourShowcase() {
  const { t, market } = useLocale()
  const [activeIndex, setActiveIndex] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)
  const examples = market === 'US' ? [] : visibleExamples
  const activeExample = activeIndex === null ? null : examples[activeIndex]
  const close = () => {
    modalVideoRef.current?.pause()
    setActiveIndex(null)
  }
  const showPrevious = () => setActiveIndex(current => (current - 1 + examples.length) % examples.length)
  const showNext = () => setActiveIndex(current => (current + 1) % examples.length)

  useEffect(() => {
    if (activeIndex === null) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowLeft') setActiveIndex(current => (current - 1 + examples.length) % examples.length)
      if (event.key === 'ArrowRight') setActiveIndex(current => (current + 1) % examples.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex, examples.length])

  if (!examples.length) return <p className="mt-6 text-sm font-semibold leading-6 text-slate-600">{t('smartTour.showcase.usAssetsPending')}</p>
  return <>
    <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {examples.map((example, exampleIndex) => (
        <ProductCard as="article" key={example.id} variant="flat" className="flex min-w-0 flex-col p-4">
          <button
            type="button"
            onClick={() => setActiveIndex(exampleIndex)}
            className="group mx-auto block w-full max-w-[190px] rounded-[2rem] border border-slate-700 bg-slate-950 p-2 text-left shadow-xl shadow-slate-200/70 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label={`${t('smartTour.showcase.expand')}: ${example.title}`}
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
            {t('smartTour.showcase.viewExample')}
          </ProductButton>
        </ProductCard>
      ))}
    </div>

    {activeExample && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`${t('smartTour.showcase.expanded')}: ${activeExample.title}`}
        onMouseDown={event => { if (event.target === event.currentTarget) close() }}
      >
        <div className="relative flex max-h-full w-full max-w-4xl flex-col items-center">
          <div className="mb-3 flex w-full items-center justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{activeExample.title}</p>
              <p className="text-xs font-semibold text-slate-300">{activeIndex + 1} {t('smartTour.showcase.of')} {examples.length}</p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950" aria-label={t('smartTour.showcase.close')}>
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

function UsSmartTourLocationQuestion({ property, setPropertyField, t, cont }) {
  const counties = getCountiesByState(property.state)
  const zipCode = normalizeUsZipCode(property.zipCode)
  const [cities, setCities] = useState([])
  const [cityStatus, setCityStatus] = useState('idle')
  const [cityError, setCityError] = useState('')
  const requestRef = useRef(0)
  const loadCities = useCallback(() => {
    const request = ++requestRef.current
    if (!isValidCountyForState(property.state, property.county)) {
      setCities([]); setCityStatus('idle'); setCityError('')
      return undefined
    }
    const controller = new AbortController()
    setCities([]); setCityStatus('loading'); setCityError('')
    getUsCitiesByCounty(property.state, property.county, { signal: controller.signal })
      .then(items => { if (request === requestRef.current) { setCities(items); setCityStatus('ready') } })
      .catch(error => { if (error?.name !== 'AbortError' && request === requestRef.current) { setCities([]); setCityStatus('error'); setCityError(t('smartTour.location.cityLoadError')) } })
    return () => controller.abort()
  }, [property.county, property.state, t])
  useEffect(() => loadCities(), [loadCities])
  const location = formatUsLocation({ ...property, zipCode })
  const ready = Boolean(property.state && isValidCountyForState(property.state, property.county) && cities.includes(property.city) && (!zipCode || isValidUsZipCode(zipCode)))
  return <div className="space-y-3">
    <label className="block text-xs font-black">{t('smartTour.location.state')}<SmartLocationSelect ariaLabel={t('smartTour.location.state')} value={property.state} onChange={value => { setPropertyField('state', value); setPropertyField('county', ''); setPropertyField('city', ''); setPropertyField('zipCode', ''); setPropertyField('neighborhoodCommunity', '') }} className="mt-1"><option value="">{t('smartTour.location.selectState')}</option>{getStatesForMarket('US').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</SmartLocationSelect></label>
    <label className="block text-xs font-black">{t('smartTour.location.county')}<SmartLocationSelect ariaLabel={t('smartTour.location.county')} value={property.county} disabled={!property.state} onChange={value => { setPropertyField('county', value); setPropertyField('city', ''); setPropertyField('zipCode', ''); setPropertyField('neighborhoodCommunity', '') }} className="mt-1"><option value="">{property.state ? t('smartTour.location.selectCounty') : t('smartTour.location.selectStateFirst')}</option>{counties.map(option => <option key={option.countyFips} value={option.value}>{option.label}</option>)}</SmartLocationSelect></label>
    <label className="block text-xs font-black">{t('smartTour.location.city')}<SmartLocationSelect ariaLabel={t('smartTour.location.city')} value={property.city} disabled={cityStatus !== 'ready'} onChange={value => setPropertyField('city', value)} className="mt-1"><option value="">{cityStatus === 'loading' ? t('smartTour.location.loadingCities') : cityStatus === 'error' ? t('smartTour.location.citiesUnavailable') : t('smartTour.location.selectCity')}</option>{cities.map(city => <option key={city} value={city}>{city}</option>)}</SmartLocationSelect>{cityStatus === 'error' && <ProductButton type="button" variant="ghost" size="sm" onClick={loadCities} className="mt-2">{t('smartTour.location.tryAgain')}</ProductButton>}{cityError && <span role="alert" className="mt-1 block text-xs text-red-600">{cityError}</span>}{cityStatus === 'ready' && cities.length === 0 && <span className="mt-1 block text-xs text-slate-600">{t('smartTour.location.noCities')}</span>}</label>
    <label className="block text-xs font-black">{t('smartTour.location.zipCodeOptional')}<input aria-label={t('smartTour.location.zipCodeOptional')} value={property.zipCode} onChange={event => setPropertyField('zipCode', normalizeUsZipCode(event.target.value))} inputMode="numeric" placeholder="12345" className="mt-1 w-full rounded-xl border p-3" />{property.zipCode && !isValidUsZipCode(zipCode) && <span className="mt-1 block text-xs text-red-600">{t('smartTour.location.zipCodeHint')}</span>}</label>
    <label className="block text-xs font-black">{t('smartTour.location.neighborhoodCommunityOptional')}<input aria-label={t('smartTour.location.neighborhoodCommunityOptional')} value={property.neighborhoodCommunity} onChange={event => setPropertyField('neighborhoodCommunity', event.target.value)} placeholder={t('smartTour.location.optional')} className="mt-1 w-full rounded-xl border p-3" /></label>
    {cont(!ready, location, 'commercial', () => setPropertyField('zipCode', zipCode))}
  </div>
}

function Question(props) {
  const { id, images, missingImageMetadata, shortVideo, missingShortVideoMetadata, isShortVideos, authRequired, loginAgain, uploads, resumeAfterLogin, market, property, generation, ctaEnabled, cta, includePhone, phone, professionalIdentity, legacyProfessionalIdentity, professionalIdentitySelection, profile, showProfessionalIdentity, t, inputRef, message, status, addImages, addShortVideo, move, remove, answerQuestion, setPropertyField, setGeneration, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, setShowProfessionalIdentity, setProfessionalIdentitySelection, updateUser, reloadProfile, setShortVideo, createTour, resetCreation, reviewItems, onReviewEdit } = props
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; const itemValue = item.value ?? item.id; const label = item.labelKey ? t(item.labelKey) : item.label; return <button key={itemValue} type="button" onClick={() => select(itemValue, label)} className={`rounded-smart-control border p-4 text-left font-bold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${value === itemValue ? 'border-primary-500 bg-primary-50 text-primary-950 ring-2 ring-primary-100' : 'border-slate-200 bg-white hover:border-primary-300'}`}><b className="text-sm">{label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const explainedChoices = (explanation, items, value, select) => <><p className="mb-3 text-xs font-semibold leading-5 text-slate-500">{explanation}</p>{choices(items, value, select)}</>
  const cont = (disabled, answer, nextQuestionId, apply, answerId = '') => <ProductButton type="button" disabled={disabled} onClick={() => answerQuestion({ answer, answerId, nextQuestionId, apply })} className="mt-5">{t('smartTour.continue')}</ProductButton>
  const applyCustomPresenterVideoChoices = () => {
    setGeneration(current => ({ ...current, narration: 'enabled' }))
  }
  if (id === 'images' && isShortVideos) return <>
    <input ref={inputRef} type="file" accept="video/mp4" hidden onChange={event => { addShortVideo(event.target.files); event.target.value = '' }} />
    <p className="mb-3 text-sm font-semibold leading-6 text-slate-600">{t('smartTour.upload.videoInstruction')}</p>
    {missingShortVideoMetadata && !shortVideo && <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{t('smartTour.upload.draftRestored')} “{missingShortVideoMetadata.name}”; {t('smartTour.upload.fileNotStored')}</p>}
    {!shortVideo ? <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed border-primary-200 bg-primary-50/60 px-4 text-center transition hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"><UploadCloud className="text-primary-600" /><b className="mt-2 text-sm">{t('smartTour.upload.selectVideo')}</b><span className="text-xs text-slate-500">{t('smartTour.upload.videoLimit')}</span><span className="mt-1 text-xs text-slate-400">{t('smartTour.upload.max250')}</span></button> : <div className="rounded-smart-card border border-slate-200 bg-white p-4"><video src={shortVideo.preview} controls playsInline preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="mx-auto max-h-80 w-full rounded-2xl bg-slate-950 object-contain" aria-label={t('smartTour.upload.videoPreview')} /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><Video className="h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{shortVideo.file.name}</p><p className="text-xs font-semibold text-slate-500">{formatShortVideoDuration(shortVideo.duration)} · {(shortVideo.file.size / 1024 / 1024).toFixed(1)} MB</p></div><ProductButton type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>{t('smartTour.upload.replace')}</ProductButton><ProductButton type="button" variant="danger" size="sm" onClick={() => setShortVideo(null)} aria-label={t('smartTour.upload.removeVideo')}><Trash2 className="h-4 w-4" />{t('smartTour.upload.remove')}</ProductButton></div></div>}
    {message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}
    {shortVideo && cont(false, shortVideo.file.name, 'purpose')}
  </>
  if (id === 'images') return <><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} />{missingImageMetadata.length > 0 && images.length === 0 && <p role="status" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{t('smartTour.upload.photosDraftRestored')} {missingImageMetadata.length} {t(missingImageMetadata.length === 1 ? 'smartTour.upload.photo' : 'smartTour.upload.photos')} {t('smartTour.upload.inOrder')}; {t('smartTour.upload.fileNotStored')}</p>}<button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed border-primary-200 bg-primary-50/60 transition hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"><UploadCloud className="text-primary-600" /><b className="mt-2 text-sm">{t('smartTour.upload.selectPhotos')}</b><span className="text-xs text-slate-500">{t('smartTour.upload.photosLimit')} {SMART_TOUR_MAX_IMAGES} {t('smartTour.upload.photos')}</span><span className="mt-1 text-xs text-slate-400">{t('smartTour.upload.photoFormat')}</span></button><p className="mt-3 text-xs font-bold">{images.length} {t('smartTour.showcase.of')} {SMART_TOUR_MAX_IMAGES} {t('smartTour.upload.photos')}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><img src={item.preview} alt={`${t('smartTour.upload.photo')} ${position + 1}`} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" aria-label={offset < 0 ? t('smartTour.upload.moveUp') : t('smartTour.upload.moveDown')} disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" aria-label={t('smartTour.upload.removePhoto')} onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false, `${images.length} ${t(images.length === 1 ? 'smartTour.upload.photo' : 'smartTour.upload.photos')}`, 'purpose')}</>
  if (id === 'purpose') return choices([{id:'sale',label:t('smartTour.purpose.sale')},{id:'rent',label:t('smartTour.purpose.rent')}], property.purpose, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'stage', apply: () => setPropertyField('purpose', value) }))
  if (id === 'stage') { const stageOptions = isShortVideos ? getShortVideosStageOptions(property.purpose, STAGES) : market === 'US' ? US_STAGES : getSmartTourStageOptions(property.purpose, STAGES); return choices(stageOptions, property.stage, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'type', apply: () => setPropertyField('stage', value) })) }
  if (id === 'type') { const propertyTypes = isShortVideos ? getShortVideosPropertyTypes(property.purpose, SMART_TOUR_PROPERTY_TYPES) : getSmartTourPropertyTypes(property.purpose, { market }); return <>{choices(propertyTypes, property.type, value => setPropertyField('type', value))}{cont(!property.type, property.type, 'facts')}</> }
  if (id === 'facts') {
    const fields = getSmartTourMeasureFields(property.type, { market })
    const fieldLabels = { bedrooms:t('smartTour.fields.bedrooms'), suites:t('smartTour.fields.suites'), bathrooms:t('smartTour.fields.bathrooms'), parkingSpaces:t('smartTour.fields.parkingSpaces'), area:t('smartTour.fields.area') }
    const areaUnit = market === 'US' ? 'sqft' : 'm²'
    const answer = fields.map(field => `${fieldLabels[field]}: ${property[field]}${field === 'area' ? ` ${areaUnit}` : ''}`).join(' · ')
    const isIncomplete = fields.some(field => field === 'area' ? Number(property.area) <= 0 : property[field] === '')
    return <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => field === 'area' ? (
          <label key={field} className="text-xs font-black">
            {fieldLabels[field]}
            <div className="mt-1 flex items-center rounded-smart-control border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
              <input
                aria-label={t('smartTour.fields.area')}
                value={property.area}
                onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 6); setPropertyField('area', Number(digits) > 0 ? String(Number(digits)) : '') }}
                inputMode="numeric"
                placeholder={t('smartTour.areaPlaceholder')}
                className="min-w-0 flex-1 rounded-xl border-0 p-3 outline-none"
              />
              <span className="pr-3 text-sm font-black text-slate-500">{areaUnit}</span>
            </div>
          </label>
        ) : (
          <fieldset key={field} className="min-w-0">
            <legend className="text-xs font-black">{fieldLabels[field]}</legend>
            <div className="mt-1 flex flex-wrap gap-2" aria-label={`${t('smartTour.fields.optionsFor')} ${fieldLabels[field].toLocaleLowerCase(market === 'US' ? 'en-US' : 'pt-BR')}`}>
              {SMART_TOUR_MEASURE_OPTIONS[field].map(option => <button key={option} type="button" onClick={() => setPropertyField(field, option)} className={`min-w-11 rounded-smart-control border px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${property[field] === option ? 'border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-100' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'}`}>{option}</button>)}
            </div>
          </fieldset>
        ))}
      </div>
      {cont(isIncomplete, answer, 'location')}
    </>
  }
  if (id === 'location') {
    if (market === 'US') return <UsSmartTourLocationQuestion property={property} setPropertyField={setPropertyField} t={t} cont={cont} />
    const normalizedDistrict = normalizeSmartTourDistrict(property.district); const location = formatSmartTourLocation({ ...property, district: normalizedDistrict }); return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder={t('smartTour.fields.district')} className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !normalizedDistrict, location, 'commercial', () => setPropertyField('district', normalizedDistrict))}</div>
  }
  if (id === 'commercial') { const commercialFields = market === 'US' ? [['price', property.purpose === 'rent' ? t('smartTour.commercial.rent') : t('smartTour.commercial.price')], ['hoa', t('smartTour.commercial.hoa')], ['propertyTaxes', t('smartTour.commercial.propertyTaxes')]] : [['price', property.purpose === 'rent' ? t('smartTour.commercial.rent') : t('smartTour.commercial.price')], ['condominium', t('smartTour.commercial.condominium')], ['iptu', t('smartTour.commercial.iptu')]]; const commercialAnswer = commercialFields.map(([field, label]) => property[field] && `${label}: ${property[field]}`).filter(Boolean).join(' · '); return <><div className="grid gap-3 sm:grid-cols-3">{commercialFields.map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field, formatSmartTourCurrency(event.target.value, market))} inputMode="numeric" placeholder={market === 'US' ? '$0' : 'R$ 0'} className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false, commercialAnswer, 'highlights')}</> }
  if (id === 'highlights') { const highlightGroups = getSmartTourHighlightGroups(property.type, { market }); return <><p className="mb-3 text-xs font-bold text-slate-500">{t('smartTour.highlightSelection.instruction')}</p><div className="space-y-4">{highlightGroups.map(group => <section key={group.id || group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{group.labelKey ? t(group.labelKey) : group.title}</h4><div className="flex flex-wrap gap-2">{group.items.map(rawItem => { const item = typeof rawItem === 'string' ? { value: rawItem, label: rawItem } : rawItem; const label = item.labelKey ? t(item.labelKey) : item.label; return <button key={item.value} type="button" disabled={!property.highlights.includes(item.value) && property.highlights.length >= 10} onClick={() => toggleHighlight(item.value)} className={`rounded-full border px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${property.highlights.includes(item.value) ? 'border-primary-400 bg-primary-50 text-primary-900' : 'border-slate-200 bg-white hover:border-primary-300'}`}>{label}</button> })}</div></section>)}</div>{cont(false, property.highlights.length ? t('smartTour.highlightSelection.selectedCount').replace('{count}', property.highlights.length) : t('smartTour.highlightSelection.none'), 'presenter')}</> }
  if (id === 'presenter') return explainedChoices(t('smartTour.presenter.description'), [{id:'female',label:t('smartTour.presenter.female')},{id:'male',label:t('smartTour.presenter.male')},{id:'none',label:t('smartTour.presenter.none')}], generation.presenterGender, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGeneration(current => ({ ...current, presenterGender: value })) }))
  if (id === 'presenter_speech_mode') return explainedChoices(t('smartTour.speechMode.description'), [
    {id:'automatic',label:t('smartTour.speechMode.automatic'),description:t('smartTour.speechMode.automaticDescription')},
    {id:'custom',label:t('smartTour.speechMode.custom'),description:t('smartTour.speechMode.customDescription')},
  ], generation.presenterSpeechMode, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGeneration(current => ({ ...current, presenterSpeechMode: value, presenterCustomSpeech: '', ...(value === 'custom' ? { narration: 'enabled' } : {}) })) }))
  if (id === 'presenter_custom_speech') {
    const wordCount = countWords(generation.presenterCustomSpeech)
    const invalid = wordCount < 1 || wordCount > 25
    return <>
      <label className="block text-sm font-black text-slate-800" htmlFor="presenter-custom-speech">{t('smartTour.customSpeech.label')}</label>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{t('smartTour.customSpeech.helper')}</p>
      <textarea id="presenter-custom-speech" value={generation.presenterCustomSpeech} onChange={event => setGeneration(current => ({ ...current, presenterCustomSpeech: event.target.value, narration: 'enabled' }))} rows={5} className="mt-3 w-full rounded-smart-control border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold"><span className={wordCount > 25 ? 'text-red-600' : 'text-slate-500'}>{wordCount} / 25 {t('smartTour.customSpeech.words')}</span>{wordCount > 25 && <span role="alert" className="text-right text-red-600">{t('smartTour.customSpeech.limit')}</span>}</div>
      {cont(invalid, generation.presenterCustomSpeech, 'captions', applyCustomPresenterVideoChoices)}
    </>
  }
  if (id === 'narration') return explainedChoices(t('smartTour.narrationDescription'), [{id:'enabled',label:t('smartTour.options.yes')},{id:'disabled',label:t('smartTour.options.no')}], generation.narration, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('narration', value) }))
  if (id === 'captions') return explainedChoices(t('smartTour.captions.description'), [{id:'enabled',label:t('smartTour.options.yes')},{id:'disabled',label:t('smartTour.options.no')}], generation.captions, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('captions', value) }))
  if (id === 'professional_identity') {
    // Do not route the new selection through Short Videos. Its legacy boolean
    // contract remains its only professional-identity representation.
    if (isShortVideos) return explainedChoices(t('smartTour.professionalIdentity.description'), [{id:'yes',label:t('smartTour.options.yes'),description:legacyProfessionalIdentity},{id:'no',label:t('smartTour.options.no')}], showProfessionalIdentity === true ? 'yes' : showProfessionalIdentity === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setShowProfessionalIdentity(value === 'yes') }))
    return <ProfessionalIdentityQuestion
      market={market}
      profile={profile || {}}
      value={professionalIdentitySelection}
      onChange={setProfessionalIdentitySelection}
      onSaveProfile={async patch => {
        const { error } = await supabase.from('profiles').update(patch).eq('id', profile?.id)
        if (error) throw error
        updateUser?.(patch)
        await reloadProfile?.()
      }}
      onComplete={(selection, formatted) => answerQuestion({
        answer: selection.enabled ? formatted : t('smartTour.options.no'),
        answerId: selection.enabled ? 'yes' : 'no',
        apply: () => setProfessionalIdentitySelection(selection),
      })}
    />
  }
  if (id === 'cta_enabled') return explainedChoices(t('smartTour.ctaDescription'), [{id:'yes',label:t('smartTour.options.yes')},{id:'no',label:t('smartTour.options.no')}], ctaEnabled === true ? 'yes' : ctaEnabled === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { const enabled = value === 'yes'; setCtaEnabled(enabled); if (!enabled) { setCta(''); setIncludePhone(false) } } }))
  if (id === 'cta') return choices((CTA_OPTIONS[market] || CTA_OPTIONS.BR).map(option => ({ ...option, value: option.label })), cta, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setCta(label) }))
  if (id === 'phone') return choices([{id:'yes',label:t('smartTour.options.yes'),description:phone || t('smartTour.phone.missing')},{id:'no',label:t('smartTour.options.no')}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; answerQuestion({ answer: value === 'yes' ? t('smartTour.review.phone') : t('smartTour.phone.none'), answerId: value, apply: () => setIncludePhone(value === 'yes') }) })
  const finalChoiceItems = [
    ...(!isShortVideos ? [{ label: t('smartTour.review.presenter'), value: generation.presenterGender === 'female' ? t('smartTour.presenter.female') : generation.presenterGender === 'male' ? t('smartTour.presenter.male') : t('smartTour.presenter.none') }] : []),
    ...(!isShortVideos ? [{ label: t('smartTour.review.speechSource'), value: generation.presenterSpeechMode === 'custom' ? generation.presenterCustomSpeech : t('smartTour.speechMode.automatic') }] : []),
    { label: t('smartTour.review.narration'), value: generation.presenterSpeechMode === 'custom' ? t('smartTour.review.implicitYes') : generation.narration === 'enabled' ? t('smartTour.options.yes') : t('smartTour.options.no') },
    { label: t('smartTour.captions.reviewLabel'), value: generation.captions === 'enabled' ? t('smartTour.options.yes') : t('smartTour.options.no') },
    { label: 'CTA', value: ctaEnabled === true ? (cta || t('smartTour.options.yes')) : t('smartTour.options.no') },
    ...(isShortVideos ? (showProfessionalIdentity !== null ? [{ label: t('smartTour.professionalIdentity.reviewLabel'), value: showProfessionalIdentity ? legacyProfessionalIdentity : t('smartTour.options.no') }] : []) : (professionalIdentitySelection.enabled !== null ? [{ label: t('smartTour.professionalIdentity.reviewLabel'), value: professionalIdentitySelection.enabled ? professionalIdentity?.formatted || '' : t('smartTour.options.no') }] : [])),
    ...(ctaEnabled === true ? [{ label: t('smartTour.review.phone'), value: includePhone === true ? phone : t('smartTour.options.no') }] : []),
  ]
  return <>
    <div className="rounded-2xl bg-primary-50 p-4 text-sm font-semibold leading-6 text-primary-950 ring-1 ring-primary-100">
      <p className="text-lg font-black">{t('smartTour.review.title')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {finalChoiceItems.map(item => <div key={item.label} className="rounded-2xl border border-primary-100 bg-white px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wide text-primary-700">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></div>)}
      </div>
      <p className="mt-4 font-black">{t('smartTour.review.confirm')}</p>
    </div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{t('smartTour.review.allChoices')}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-primary-700">{reviewLabel(item.id, isShortVideos, t)}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-slate-700">{item.label}</p></div><button type="button" onClick={() => onReviewEdit(item.id)} className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-primary-700 transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500">{t('smartTour.edit')}</button></div></div>)}
    </div>
    {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-primary-600" />}<b className="text-sm">{message}</b></div>}
    {resumeAfterLogin && <p role="status" className="mt-4 text-sm">{t('smartTour.status.briefingPreserved')} {uploads ? t('smartTour.status.uploadsWillVerify') : t('smartTour.status.reselectPhotos')} {t('smartTour.status.reviewToContinue')}</p>}
    {authRequired && <ProductButton type="button" onClick={loginAgain}>{t('smartTour.status.loginAgain')}</ProductButton>}
    <SmartTokenEstimate cost={SMART_TOKEN_COSTS.geminiVideo} />
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ProductButton type="button" disabled={authRequired || ['uploading','generating'].includes(status)} onClick={createTour} className="w-full"><Video className="h-4 w-4" />{resumeAfterLogin ? t('smartTour.review.confirmContinue') : status === 'error' ? t('smartTour.review.retry') : t('smartTour.review.confirmCreate')}</ProductButton>
      <ProductButton type="button" variant="secondary" disabled={['uploading','generating'].includes(status)} onClick={resetCreation}>{t('smartTour.review.redo')}</ProductButton>
    </div>
  </>
}

function reviewLabel(id, isShortVideos = false, t = key => key) {
  return {
    images: isShortVideos ? t('smartTour.review.originalVideo') : t('smartTour.review.photos'), purpose: t('smartTour.review.purpose'), stage: t('smartTour.review.stage'), type: t('smartTour.review.type'), facts: t('smartTour.review.facts'),
    location: t('smartTour.review.location'), commercial: t('smartTour.review.values'), highlights: t('smartTour.review.highlights'),
    presenter: t('smartTour.review.presenter'), presenter_speech_mode: t('smartTour.review.speechSource'), presenter_custom_speech: t('smartTour.review.customNarration'), narration: t('smartTour.review.narration'), captions: t('smartTour.captions.reviewLabel'), professional_identity: t('smartTour.professionalIdentity.reviewLabel'), cta_enabled: t('smartTour.review.finalCta'), cta: t('smartTour.review.selectedCta'), phone: t('smartTour.review.phone'),
  }[id] || id
}

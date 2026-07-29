import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Image as ImageIcon, Loader2, PlayCircle, Sparkles, Trash2, UploadCloud, Video, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import CampaignPackage from '../components/campaign/CampaignPackage'
import { buildVirtualStagingCampaignPackage } from '../components/campaign/buildVirtualStagingCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation from '../components/conversation/GuidedConversation'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, ProductSteps } from '../components/design-system'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { VIRTUAL_STAGING_MAX_IMAGES, VIRTUAL_STAGING_PRODUCT_NAME } from '../config/virtualStaging'
import { buildFurnishRenovatePayload, buildFurnishRenovateReviewItems, canAddFurnishRenovateImages, FURNISH_RENOVATE_COPY, FURNISH_RENOVATE_HIGHLIGHT_GROUPS, FURNISH_RENOVATE_JOURNEY_ID, FURNISH_RENOVATE_MAX_HIGHLIGHTS, FURNISH_RENOVATE_MAX_IMAGES, FURNISH_RENOVATE_PROPERTY_TYPES, FURNISH_RENOVATE_QUESTIONS } from '../config/virtualStagingFurnish'
import { getRecoverableVirtualStagingJourneyId, getVirtualStagingJourney, getVirtualStagingJourneySessionKey, isUsableVirtualStagingVideoUrl, parseVirtualStagingJobRecord, VIRTUAL_STAGING_JOURNEYS } from '../config/virtualStagingJourneys'
import { buildLifeInPropertyGenerationPayload, getLifeSceneLabel, LIFE_IN_PROPERTY_JOURNEY_ID, LIFE_RENTAL_STAGE_OPTIONS, LIFE_SCENE_OPTIONS } from '../config/virtualStagingLife'
import { BROKER_PRESENTATION_JOURNEY_ID, BROKER_REFERENCE_OPTIONS, buildBrokerPresentationFilePayload, buildBrokerPresentationGenerationPayload, validatePresenterReferenceSelection } from '../config/virtualStagingBroker'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../config/virtualStagingConversation'
import { formatVirtualStagingCurrency, formatVirtualStagingLocation, getVirtualStagingHighlightGroups, getVirtualStagingMeasureFields, normalizeVirtualStagingDistrict, VIRTUAL_STAGING_MEASURE_OPTIONS, VIRTUAL_STAGING_PROPERTY_TYPES } from '../config/virtualStagingForm'
import { formatBrazilianPhone } from '../../../supabase/functions/_shared/product3-contract.ts'

const BUCKET = 'studio-videos'
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTAS = ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', state: '', city: '', district: '', neighborhood: '', price: '', condominium: '', iptu: '', highlights: [], description: '' }
const initialGeneration = { mode: 'guided_tour', narration: '', captions: '', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
function questionsFor(journeyId) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) return FURNISH_RENOVATE_QUESTIONS
  const sharedQuestions = [
    ['images', 1, 'Envie até 5 fotos na ordem em que deseja apresentá-las.'], ['purpose', 2, 'Qual é a finalidade do imóvel?'],
    ['stage', 2, 'Qual é o estado atual do imóvel?'], ['type', 2, 'Que tipo de imóvel vamos apresentar?'],
    ['facts', 2, 'Quais são as principais medidas?'], ['location', 2, 'Onde fica o imóvel?'],
    ['commercial', 2, 'Quais informações comerciais deseja incluir?'], ['highlights', 2, 'Quais são os principais destaques?'],
  ]
  if (journeyId === LIFE_IN_PROPERTY_JOURNEY_ID) return [
    ...sharedQuestions,
    ['life_scene', 3, 'Quem deseja incluir para valorizar ainda mais a apresentação do seu imóvel?'],
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta', 4, 'Qual chamada deseja usar no final?'],
    ['phone', 4, 'Deseja divulgar seu telefone profissional?'],
    ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.'],
  ]
  if (journeyId === BROKER_PRESENTATION_JOURNEY_ID) return [
    ['presenter_reference', 1, 'Deseja utilizar sua própria imagem como referência para apresentar o imóvel?'],
    ['presenter_photo', 1, 'Envie uma foto com o rosto visível.'],
    ...sharedQuestions,
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta', 4, 'Qual chamada deseja usar no final?'],
    ['phone', 4, 'Deseja divulgar seu telefone profissional?'],
    ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.'],
    ['presenter_reference_required', 1, 'Este módulo utiliza uma foto sua como referência para criar o apresentador. Sem uma foto de referência, utilize o Vídeo Imobiliário para criar sua apresentação.'],
  ]
  return sharedQuestions
}

function virtualStagingConfirmation(id, answer, journeyId) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) {
    if (id === 'images') return 'Ótimo! As fotografias serão usadas na ordem escolhida.'
  }
  if (id === 'purpose') return answer === 'Locação' ? 'Perfeito! Vamos criar uma apresentação para divulgar a locação desse imóvel.' : 'Perfeito! Vamos criar uma apresentação para apoiar a venda desse imóvel.'
  const confirmations = {
    images: `Ótimo! ${answer} serão usadas exatamente na ordem escolhida.`,
    stage: `Perfeito! Vamos considerar o imóvel como “${answer}”.`,
    type: `Ótimo! O tipo “${answer}” já está registrado.`,
    facts: 'Perfeito! As principais medidas do imóvel foram registradas.',
    location: `Ótimo! A localização em ${answer} foi registrada.`,
    commercial: answer === 'Sem informações comerciais' ? 'Tudo bem! Seguiremos sem exibir valores comerciais.' : 'Perfeito! As informações comerciais foram registradas.',
    highlights: `Excelente! ${answer} foram selecionados para valorizar o imóvel.`,
    life_scene: `Perfeito! Vamos criar cenas com ${answer.toLocaleLowerCase('pt-BR')} utilizando o imóvel naturalmente.`,
    presenter_reference: answer === 'Sim' ? 'Perfeito! Agora envie a foto que será usada como referência do apresentador.' : 'Tudo certo. Você pode continuar sua criação no produto Vídeo Imobiliário.',
    presenter_photo: 'Foto do apresentador confirmada para esta criação.',
    narration: answer === 'Sim' ? 'Perfeito! A apresentação terá narração profissional.' : 'Tudo certo! A apresentação seguirá sem narração.',
    captions: answer === 'Sim' ? 'Ótimo! Uma seleção curta de destaques poderá aparecer no vídeo.' : 'Tudo certo! As informações continuarão na campanha, mas não aparecerão no vídeo.',
    cta_enabled: answer === 'Sim' ? 'Perfeito! Agora escolha a chamada final.' : 'Tudo certo! O vídeo terminará naturalmente na última cena, sem chamada final.',
    cta: `Ótimo! A chamada final será “${answer}”.`,
    phone: answer === 'Telefone profissional' ? 'Perfeito! Seu telefone profissional será incluído.' : 'Tudo certo! A apresentação seguirá sem telefone.',
  }
  return confirmations[id] || 'Perfeito! Informação registrada.'
}

export default function VirtualStagingAI() {
  const [selectedJourneyId, setSelectedJourneyId] = useState(() => getRecoverableVirtualStagingJourneyId(globalThis.sessionStorage))
  const modulesRef = useRef(null)
  const chatRef = useRef(null)
  const selectedJourney = getVirtualStagingJourney(selectedJourneyId)

  useEffect(() => {
    if (selectedJourney) chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedJourney])

  const chooseAnotherJourney = () => {
    setSelectedJourneyId(null)
    requestAnimationFrame(() => modulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return <>
    <Header title={VIRTUAL_STAGING_PRODUCT_NAME} subtitle="Experiências imobiliárias com inteligência artificial." />
    <main className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
      <ProductHero
        id="virtual-space-title"
        eyebrow="SmartCorretorAI"
        title="Virtual Space"
        description="Reimagine ambientes, crie experiências com pessoas e apresente seus imóveis utilizando sua própria imagem."
        visual={<VirtualSpaceHeroVisual />}
      />

      <ProductCard ref={modulesRef} className="mt-8 scroll-mt-6 p-5 sm:p-7">
        <ProductSectionHeading
          eyebrow="Três experiências em um só espaço"
          title="Escolha como deseja apresentar seu imóvel"
          description="Cada módulo cria uma experiência diferente, preservando a mesma jornada simples e guiada."
        />
        <VirtualStagingModules selectedJourneyId={selectedJourneyId} onSelect={setSelectedJourneyId} />
      </ProductCard>

      {selectedJourney && <div ref={chatRef} className="scroll-mt-6">
        <VirtualStagingJourney
          key={selectedJourney.id}
          journey={selectedJourney}
          onChooseAnother={chooseAnotherJourney}
        />
      </div>}
    </main>
  </>
}

function VirtualStagingJourney({ journey, onChooseAnother }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const presenterInputRef = useRef(null)
  const presenterReferenceRef = useRef(null)
  const pollRef = useRef(null)
  const reviewEditRef = useRef(null)
  const [images, setImages] = useState([])
  const [property, setProperty] = useState(initialProperty)
  const [generation, setGeneration] = useState(initialGeneration)
  const [lifeScene, setLifeScene] = useState('')
  const [presenterReferenceDecision, setPresenterReferenceDecision] = useState(null)
  const [presenterReference, setPresenterReference] = useState(null)
  const [presenterReferenceMessage, setPresenterReferenceMessage] = useState('')
  const [ctaEnabled, setCtaEnabled] = useState(null)
  const [cta, setCta] = useState('')
  const [includePhone, setIncludePhone] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const activeJobKey = getVirtualStagingJourneySessionKey(journey.id)
  const isFurnishRenovate = journey.id === FURNISH_RENOVATE_JOURNEY_ID
  const isLifeInProperty = journey.id === LIFE_IN_PROPERTY_JOURNEY_ID
  const isBrokerPresentation = journey.id === BROKER_PRESENTATION_JOURNEY_ID
  const questions = useMemo(() => questionsFor(journey.id), [journey.id])
  const questionOrder = useMemo(() => questions.map(item => item[0]), [questions])
  const rawPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const phone = formatBrazilianPhone(rawPhone)
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => ({ ...current, [field]: value }))
  const clearPresenterReference = () => {
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
    presenterReferenceRef.current = null
    setPresenterReference(null)
    setPresenterReferenceMessage('')
  }
  const addPresenterReference = files => {
    const { file, error } = validatePresenterReferenceSelection(files)
    if (error) { setPresenterReferenceMessage(error); return }
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
    const nextReference = { file, preview: URL.createObjectURL(file) }
    presenterReferenceRef.current = nextReference
    setPresenterReference(nextReference)
    setPresenterReferenceMessage('')
  }

  const resetTourFromQuestion = (questionId) => {
    if (reviewEditRef.current) {
      if (questionId === 'presenter_reference') { setPresenterReferenceDecision(null); clearPresenterReference() }
      if (questionId === 'presenter_photo') clearPresenterReference()
      if (questionId === 'images') setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
      if (questionId === 'purpose') setProperty(current => ({ ...current, purpose: '', stage: '' }))
      if (questionId === 'stage') setProperty(current => ({ ...current, stage: '' }))
      if (questionId === 'type') setProperty(current => ({ ...current, type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [] }))
      if (questionId === 'facts') setProperty(current => ({ ...current, bedrooms: '', suites: '', parkingSpaces: '', area: '' }))
      if (questionId === 'location') setProperty(current => ({ ...current, state: '', city: '', district: '' }))
      if (questionId === 'commercial') setProperty(current => ({ ...current, price: '', condominium: '', iptu: '' }))
      if (questionId === 'highlights') setProperty(current => ({ ...current, highlights: [] }))
      if (['state', 'city', 'neighborhood', 'bedrooms', 'suites', 'parkingSpaces', 'area'].includes(questionId)) setProperty(current => ({ ...current, [questionId]: '', ...(questionId === 'state' ? { city: '' } : {}) }))
      if (questionId === 'life_scene') setLifeScene('')
      if (questionId === 'narration') setGeneration(current => ({ ...current, narration: '' }))
      if (questionId === 'captions') setGeneration(current => ({ ...current, captions: '' }))
      if (questionId === 'cta_enabled') { setCtaEnabled(null); setCta(''); setIncludePhone(null) }
      if (questionId === 'cta') setCta('')
      if (questionId === 'phone') setIncludePhone(null)
      setStatus('idle')
      setMessage('')
      return
    }
    const targetIndex = questionOrder.indexOf(questionId)
    const shouldReset = id => questionOrder.indexOf(id) >= targetIndex
    if (shouldReset('presenter_reference')) setPresenterReferenceDecision(null)
    if (shouldReset('presenter_photo')) clearPresenterReference()
    if (shouldReset('images')) setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
    const propertyFields = [['purpose', 'purpose'], ['stage', 'stage'], ['type', 'type'], ['facts', 'bedrooms'], ['facts', 'suites'], ['facts', 'parkingSpaces'], ['facts', 'area'], ['location', 'state'], ['location', 'city'], ['location', 'district'], ['state', 'state'], ['state', 'city'], ['city', 'city'], ['neighborhood', 'neighborhood'], ['bedrooms', 'bedrooms'], ['suites', 'suites'], ['parkingSpaces', 'parkingSpaces'], ['area', 'area'], ['commercial', 'price'], ['commercial', 'condominium'], ['commercial', 'iptu'], ['highlights', 'highlights']]
    setProperty(current => propertyFields.reduce((nextProperty, [questionKey, field]) => shouldReset(questionKey) ? { ...nextProperty, [field]: field === 'highlights' ? [] : '' } : nextProperty, current))
    setGeneration(current => ({
      ...current,
      ...(shouldReset('narration') ? { narration: '' } : {}),
      ...(shouldReset('captions') ? { captions: '' } : {}),
      furniture: 'original', stagingPresentation: 'final_only',
    }))
    if (shouldReset('life_scene')) setLifeScene('')
    if (shouldReset('cta_enabled')) setCtaEnabled(null)
    if (shouldReset('cta')) setCta('')
    if (shouldReset('phone')) setIncludePhone(null)
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('idle')
    setMessage('')
    setResult(null)
  }
  const conversation = useGuidedConversation({ initialQuestionId: isBrokerPresentation ? 'presenter_reference' : 'images', onEdit: resetTourFromQuestion })
  const questionIndex = Math.max(0, questions.findIndex(item => item[0] === conversation.activeQuestionId))
  const question = questions[questionIndex] || questions[0]
  const answerQuestion = ({ answer, answerId = '', nextQuestionId = getVirtualStagingNextQuestion({ questionId: question[0], answerId, mode: generation.mode, journeyId: journey.id }), apply }) => {
    let resolvedNextQuestionId = nextQuestionId
    if (reviewEditRef.current) {
      resolvedNextQuestionId = getVirtualStagingReviewEditNext({ originQuestionId: reviewEditRef.current, questionId: question[0], answerId, mode: generation.mode, journeyId: journey.id })
      if (resolvedNextQuestionId === 'review') reviewEditRef.current = null
    }
    const accepted = conversation.submitAnswer({ questionId: question[0], question: question[2], answer, confirmation: virtualStagingConfirmation(question[0], answer, journey.id), nextQuestionId: resolvedNextQuestionId })
    if (accepted) apply?.()
    return accepted
  }
  const editConversationAnswer = questionId => {
    if (question[0] === 'review') reviewEditRef.current = questionId
    conversation.editAnswer(questionId)
  }

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    if (presenterReferenceRef.current?.preview) URL.revokeObjectURL(presenterReferenceRef.current.preview)
  }, [])
  useEffect(() => {
    const stored = parseVirtualStagingJobRecord(sessionStorage.getItem(activeJobKey))
    if (!stored) return
    setStatus('generating')
    setMessage('Retomando sua criação...')
    poll(stored.jobId)
  }, [activeJobKey])

  const addImages = files => {
    const imageLimit = isFurnishRenovate ? FURNISH_RENOVATE_MAX_IMAGES : VIRTUAL_STAGING_MAX_IMAGES
    const selectedInSystemOrder = Array.from(files)
    if (selectedInSystemOrder.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage('Envie imagens JPG ou PNG de até 15 MB.')
    setImages(current => {
      const known = new Set(current.map(item => item.key))
      const uniqueInSystemOrder = selectedInSystemOrder.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      const exceedsLimit = isFurnishRenovate ? !canAddFurnishRenovateImages(current.length, uniqueInSystemOrder.length) : current.length + uniqueInSystemOrder.length > imageLimit
      if (exceedsLimit) { setMessage(`Você pode enviar no máximo ${imageLimit} imagens.`); return current }
      setMessage('')
      return [...current, ...uniqueInSystemOrder.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))]
    })
  }
  const move = (position, offset) => setImages(current => { const target = position + offset; if (target < 0 || target >= current.length) return current; const nextImages = [...current]; [nextImages[position], nextImages[target]] = [nextImages[target], nextImages[position]]; return nextImages })
  const remove = position => setImages(current => current.filter((item, itemIndex) => { if (itemIndex === position) URL.revokeObjectURL(item.preview); return itemIndex !== position }))
  const toggleHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < 10 ? [...property.highlights, value] : property.highlights)
  const toggleFurnishHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < FURNISH_RENOVATE_MAX_HIGHLIGHTS ? [...property.highlights, value] : property.highlights)

  async function poll(jobId) {
    try {
      const { data, error } = await supabase.functions.invoke('virtual-staging-status', { body: { jobId } })
      if (error || !data?.ok) throw new Error(data?.error || 'Não foi possível consultar a criação.')
      if (data.status === 'completed') {
        const stored = parseVirtualStagingJobRecord(sessionStorage.getItem(activeJobKey)) || { jobId }
        if (!isUsableVirtualStagingVideoUrl(data.signedVideoUrl)) {
          setStatus('result_unavailable')
          setMessage('Sua apresentação foi concluída, mas o vídeo está temporariamente indisponível. Consulte o resultado novamente.')
          return
        }
        const campaignPackage = stored.campaignPackage || {}
        const completedResult = { ...data, campaignPackage }
        sessionStorage.setItem(activeJobKey, JSON.stringify({
          ...stored,
          jobId,
          campaignPackage,
          result: { status: data.status, signedVideoUrl: data.signedVideoUrl },
          updatedAt: Date.now(),
        }))
        setResult(completedResult)
        setStatus('completed')
        return
      }
      if (data.status === 'failed') throw new Error(data.error)
      setMessage(data.message || 'A IA está criando sua apresentação...'); pollRef.current = setTimeout(() => poll(jobId), 9000)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Não foi possível concluir. Tente novamente.') }
  }

  const retryResultStatus = () => {
    const stored = parseVirtualStagingJobRecord(sessionStorage.getItem(activeJobKey))
    if (!stored) {
      setStatus('error')
      setMessage('Não foi possível recuperar esta criação.')
      return
    }
    if (pollRef.current) clearTimeout(pollRef.current)
    setStatus('generating')
    setMessage('Consultando sua apresentação...')
    poll(stored.jobId)
  }

  const createTour = async () => {
    if (isBrokerPresentation && !presenterReference?.file) return setMessage('Envie uma foto do apresentador para continuar.')
    if (isFurnishRenovate && (!property.purpose || !property.type || !property.state || !property.city || !property.neighborhood || property.bedrooms === '' || property.suites === '' || property.parkingSpaces === '' || Number(property.area) <= 0)) return setMessage('Revise os dados residenciais antes de criar a apresentação.')
    setStatus('uploading'); setMessage('Enviando suas fotos com segurança...')
    try {
      const requestId = crypto.randomUUID()
      let presenterReferencePath = ''
      if (isBrokerPresentation) {
        const presenterFile = presenterReference.file
        presenterReferencePath = `${user.id}/virtual-staging/${requestId}/presenter-reference.${presenterFile.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(presenterReferencePath, presenterFile, { contentType: presenterFile.type })
        if (error) throw new Error('A foto do apresentador não pôde ser enviada. Tente novamente.')
      }
      const orderedImages = images.slice()
      const imagePaths = new Array(orderedImages.length)
      for (let imageIndex = 0; imageIndex < orderedImages.length; imageIndex += 1) {
        const file = orderedImages[imageIndex].file
        const path = `${user.id}/virtual-staging/${requestId}/${String(imageIndex + 1).padStart(2, '0')}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
        if (error) throw new Error('Uma das fotos não pôde ser enviada. Tente novamente.')
        imagePaths[imageIndex] = path
      }
      setStatus('generating'); setMessage(isFurnishRenovate ? 'A IA está preparando a transformação dos ambientes...' : 'A IA está criando sua apresentação...')
      const requestBody = isFurnishRenovate
        ? { clientRequestId: requestId, ...buildFurnishRenovatePayload({ imagePaths, property }) }
        : (() => {
            const apiGeneration = isLifeInProperty
              ? buildLifeInPropertyGenerationPayload({ lifeScene, captions: generation.captions })
              : buildBrokerPresentationGenerationPayload({ captions: generation.captions })
            const selectedCta = isLifeInProperty || isBrokerPresentation || ctaEnabled === true ? cta : ''
            const includeProfessionalPhone = (isLifeInProperty || isBrokerPresentation || ctaEnabled === true) && includePhone === true
            const brokerFiles = isBrokerPresentation ? buildBrokerPresentationFilePayload({ presenterReferencePath, propertyImagePaths: imagePaths }) : {}
            return { clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: apiGeneration, selectedCta, includeProfessionalPhone, language: 'pt-BR', ...brokerFiles }
          })()
      const { data, error } = await supabase.functions.invoke('virtual-staging-generate', { body: requestBody })
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || 'Não foi possível iniciar a criação.')
      const campaignPackage = isFurnishRenovate ? {} : buildVirtualStagingCampaignPackage({ property, language:'pt-BR', cta:requestBody.selectedCta, phone:requestBody.includeProfessionalPhone ? phone : '' })
      sessionStorage.setItem(activeJobKey, JSON.stringify({ jobId:data.jobId, campaignPackage, updatedAt:Date.now() })); poll(data.jobId)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Não foi possível criar sua apresentação.') }
  }

  const reset = () => { sessionStorage.removeItem(activeJobKey); images.forEach(item => URL.revokeObjectURL(item.preview)); clearPresenterReference(); reviewEditRef.current = null; setImages([]); setProperty(initialProperty); setGeneration(initialGeneration); setLifeScene(''); setPresenterReferenceDecision(null); setCtaEnabled(null); setCta(''); setIncludePhone(null); conversation.resetConversation(); setStatus('idle'); setMessage(''); setResult(null) }
  if (result) return <section className="mt-10"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: VIRTUAL_STAGING_PRODUCT_NAME, mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl }} onCreateNew={reset} createNewLabel="Criar novo projeto" /></section>
  if (status === 'result_unavailable') return <section role="alert" className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm sm:p-7"><p className="text-sm font-black text-amber-900">{message}</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Button type="button" onClick={retryResultStatus}>Consultar resultado novamente</Button><button type="button" onClick={reset} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-black text-amber-900">Criar novo projeto</button></div></section>

  const measureFields = getVirtualStagingMeasureFields(property.type)
  const measureLabels = { bedrooms: 'dormitórios', suites: 'suítes', parkingSpaces: 'vagas', area: 'm²' }
  const measuresSummary = measureFields.map(field => property[field] && `${property[field]} ${measureLabels[field]}`).filter(Boolean).join(' · ')
  const valuesSummary = [property.price && `${property.purpose === 'rent' ? 'Locação' : 'Preço'} ${property.price}`, property.condominium && `Condomínio ${property.condominium}`, property.iptu && `IPTU ${property.iptu}`].filter(Boolean).join(' · ')
  const isReviewContext = question[0] === 'review' || Boolean(reviewEditRef.current)
  const hasFurnishHighlightsAnswer = conversation.history.some(turn => turn.questionId === 'highlights')
  const furnishSummary = [
    { id: 'images', label: images.length && `${images.length} fotografia${images.length > 1 ? 's' : ''}` },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
    { id: 'type', label: property.type },
    { id: 'bedrooms', label: property.bedrooms !== '' && `${property.bedrooms} dormitório${property.bedrooms === '1' ? '' : 's'}` },
    { id: 'suites', label: property.suites !== '' && `${property.suites} suíte${property.suites === '1' ? '' : 's'}` },
    { id: 'parkingSpaces', label: property.parkingSpaces !== '' && `${property.parkingSpaces} vaga${property.parkingSpaces === '1' ? '' : 's'}` },
    { id: 'area', label: property.area && `${property.area} m²` },
    { id: 'state', label: property.state },
    { id: 'city', label: property.city },
    { id: 'neighborhood', label: property.neighborhood },
    { id: 'highlights', label: property.highlights.length ? property.highlights.join(' · ') : (hasFurnishHighlightsAnswer || isReviewContext ? 'Nenhum destaque adicional' : '') },
  ].filter(item => Boolean(item.label))
  const furnishReviewItems = buildFurnishRenovateReviewItems({ imagesCount: images.length, property })
  const standardSummary = [
    { id: 'images', label: images.length && `${images.length} foto${images.length > 1 ? 's' : ''}` },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
    { id: 'stage', label: property.stage },
    { id: 'type', label: property.type },
    { id: 'facts', label: measuresSummary },
    { id: 'location', label: formatVirtualStagingLocation(property) },
    { id: 'commercial', label: valuesSummary || (isReviewContext ? 'Sem valores informados' : '') },
    { id: 'highlights', label: property.highlights.length ? `${property.highlights.length} destaques` : (isReviewContext ? 'Sem destaques adicionais' : '') },
    ...(isBrokerPresentation
      ? [
          { id: 'presenter_reference', label: presenterReferenceDecision === true ? 'Apresentação pelo Corretor: Imagem própria enviada' : '' },
          { id: 'presenter_photo', label: presenterReference ? 'Foto do apresentador: 1 imagem temporária' : '' },
        ]
      : isLifeInProperty
        ? [{ id: 'life_scene', label: lifeScene ? `Vida no Imóvel: ${getLifeSceneLabel(lifeScene)}` : '' }]
        : [{ id: 'narration', label: generation.narration === 'enabled' ? 'Sim' : generation.narration === 'disabled' ? 'Não' : '' }]),
    { id: 'captions', label: generation.captions === 'enabled' ? 'Sim' : generation.captions === 'disabled' ? 'Não' : '' },
    ...(!isLifeInProperty && !isBrokerPresentation ? [{ id: 'cta_enabled', label: ctaEnabled === true ? 'Sim' : ctaEnabled === false ? 'Não' : '' }] : []),
    { id: 'cta', label: isLifeInProperty || isBrokerPresentation || ctaEnabled === true ? cta : '' },
    { id: 'phone', label: isLifeInProperty || isBrokerPresentation || ctaEnabled === true ? (includePhone === true ? phone : includePhone === false ? 'Sem telefone' : '') : '' },
  ].filter(item => Boolean(item.label))
  const summary = isFurnishRenovate ? furnishSummary : standardSummary
  const visualStep = status === 'idle' ? question[1] : 5
  const chooseAnotherButton = isFurnishRenovate
    ? <ProductButton type="button" variant="secondary" onClick={onChooseAnother}>Escolher outro módulo</ProductButton>
    : <button type="button" onClick={onChooseAnother} className="min-h-11 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">Escolher outro módulo</button>
  return <section aria-labelledby={`virtual-staging-chat-${journey.id}`} className={`mt-10 ${isFurnishRenovate ? 'space-y-8' : ''}`}>
      {isFurnishRenovate && <FurnishReimagineHero />}
      {isFurnishRenovate ? <ProductSectionHeading
        id={`virtual-staging-chat-${journey.id}`}
        eyebrow={`Jornada selecionada · ${journey.title}`}
        title="Agora, conte como deseja transformar seu imóvel"
        description="Responda uma pergunta por vez. Suas escolhas ficam organizadas no resumo ao lado."
        action={chooseAnotherButton}
      /> : <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Jornada selecionada · {journey.title}</p>
          <h2 id={`virtual-staging-chat-${journey.id}`} className="mt-2 text-2xl font-black text-slate-950">Agora, conte como deseja transformar seu imóvel</h2>
        </div>
        {chooseAnotherButton}
      </div>}
    {isFurnishRenovate
      ? <ProductSteps steps={[
          { title: 'Fotos', subtitle: 'Envio' },
          { title: 'Imóvel', subtitle: 'Finalidade' },
          { title: 'Tipologia', subtitle: 'Características' },
          { title: 'Revisão', subtitle: 'Conferência' },
          { title: 'Criar', subtitle: 'Apresentação' },
        ]} activeStep={visualStep} />
      : <div className="mb-6 grid grid-cols-5 gap-2">{(isBrokerPresentation ? ['Referência','Imóvel','Estilo','Revisão','Criar'] : ['Fotos','Imóvel','Estilo','Revisão','Criar']).map((label, step) => <div key={label}><div className={`h-2 rounded-full ${step + 1 <= visualStep ? 'bg-emerald-500' : 'bg-slate-200'}`} /><p className="mt-2 truncate text-center text-xs font-black text-slate-600">{label}</p></div>)}</div>}
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
      designSystem={isFurnishRenovate}
    >
      <Question id={question[0]} {...{ journeyId: journey.id, lifeScene, presenterReferenceDecision, presenterReference, presenterReferenceMessage, images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, presenterInputRef, message, status, addPresenterReference, clearPresenterReference, addImages, move, remove, answerQuestion, setLifeScene, setPresenterReferenceDecision, setPropertyField, setGenerationField, toggleHighlight, toggleFurnishHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, resetCreation: reset, reviewItems: isFurnishRenovate ? furnishReviewItems : summary, onReviewEdit: editConversationAnswer, navigateToVideoProduct: () => navigate('/smart-tour-ai') }} />
    </GuidedConversation>
  </section>
}

function FurnishReimagineHero() {
  return <ProductHero
    id="reimagine-internal-title"
    eyebrow="Reimagine AI"
    title="Dê uma nova vida"
    highlight="às fotos do seu imóvel."
    description="Transforme ambientes vazios ou já mobiliados em uma apresentação visual mais atraente."
    secondaryDescription="O Reimagine AI cria uma nova apresentação visual a partir das fotografias do imóvel. A inteligência artificial pode decorar ambientes vazios, renovar ambientes já mobiliados e reinterpretar parcialmente a composição para tornar a apresentação mais atraente."
    visual={<FurnishReimagineComparison />}
  />
}

function VirtualSpaceHeroVisual() {
  return <div aria-label="Os três módulos do Virtual Space" className="relative flex min-h-[290px] items-center justify-center overflow-hidden lg:min-h-[275px]">
    <div className="absolute inset-y-2 right-0 w-[88%] opacity-30 [background-image:radial-gradient(circle_at_center,#3b82f6_1.5px,transparent_1.5px)] [background-size:18px_18px]" aria-hidden="true" />
    <div className="relative grid w-full grid-cols-3 items-end gap-2 px-1 sm:gap-3 sm:px-4">
      {VIRTUAL_STAGING_JOURNEYS.map((journey, index) => <article key={journey.id} className={`min-w-0 ${index === 1 ? '-translate-y-4' : ''}`}>
        <div className="mx-auto w-full max-w-[132px] rounded-[1.65rem] border border-slate-700 bg-slate-950 p-1.5 shadow-[0_22px_48px_-18px_rgba(15,23,42,0.68)] ring-2 ring-white">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[1.25rem] bg-slate-900">
            <video src={journey.demoVideo} aria-label={`Exemplo do módulo ${journey.title}`} autoPlay muted loop playsInline controls={false} preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="absolute inset-0 h-full w-full bg-black object-cover" />
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[132px] text-center text-[10px] font-black leading-4 text-slate-700 sm:text-xs">{journey.title}</p>
      </article>)}
    </div>
  </div>
}

function FurnishReimagineComparison() {
  const phoneClass = 'mx-auto w-full max-w-[174px] rounded-[2rem] border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-300/70'
  return <div aria-label="Comparação antes e depois criada pelo Reimagine AI" className="relative rounded-smart-card border border-smart-border bg-slate-50/75 p-4 sm:p-5">
    <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,#3b82f6_1.2px,transparent_1.2px)] [background-size:18px_18px]" aria-hidden="true" />
    <div className="relative grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)]">
      <article className="text-center">
        <p className="mb-3 text-xs font-black text-slate-900">Fotografias originais <span className="text-slate-400">· Antes</span></p>
        <div className={phoneClass}><div className="flex aspect-[9/16] flex-col items-center justify-center rounded-[1.7rem] border border-dashed border-emerald-300/30 bg-[linear-gradient(145deg,#0f172a,#134e4a)] px-6 text-center text-white"><ImageIcon className="h-9 w-9 text-emerald-300" /><p className="mt-4 text-sm font-black">Suas fotografias</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-300">Ambientes vazios ou já mobiliados.</p></div></div>
      </article>
      <div className="flex justify-center" aria-hidden="true"><span className="flex h-10 w-10 rotate-90 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-200 sm:rotate-0"><ArrowRight className="h-5 w-5" /></span></div>
      <article className="text-center">
        <p className="mb-3 text-xs font-black text-slate-900">Apresentação criada pela IA <span className="text-slate-400">· Depois</span></p>
        <div className={phoneClass}><div className="relative aspect-[9/16] overflow-hidden rounded-[1.7rem] bg-slate-900"><video src="/demos-videos/animar-imagens.mp4" aria-label="Exemplo de apresentação criada pela IA" autoPlay muted loop playsInline controls={false} preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="absolute inset-0 h-full w-full bg-black object-contain" /></div></div>
      </article>
    </div>
    <p className="relative mt-4 text-center text-xs font-bold leading-5 text-slate-500">Veja como suas fotos podem ganhar uma nova apresentação visual.</p>
  </div>
}

function VirtualStagingModules({ selectedJourneyId, onSelect }) {
  const [activeDemo, setActiveDemo] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeDemo = () => {
    modalVideoRef.current?.pause()
    setActiveDemo(null)
  }

  useEffect(() => {
    if (!activeDemo) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        modalVideoRef.current?.pause()
        setActiveDemo(null)
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeDemo])

  return <>
    <div className="mt-7 grid gap-5 md:grid-cols-3">
      {VIRTUAL_STAGING_JOURNEYS.map(journey => {
      const isSelected = selectedJourneyId === journey.id
      const hasOfficialDemo = journey.demoAssetStatus === 'official'
      const preview = <div className="mx-auto w-full max-w-[190px] rounded-[2rem] border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-200/70">
        <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.45rem] bg-slate-900">
          <video
            src={journey.demoVideo}
            aria-label={`Demonstração: ${journey.title}`}
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
            className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
          />
          <span className="absolute inset-0 rounded-[1.45rem] ring-1 ring-inset ring-white/10 transition group-hover:ring-primary-300/60" />
        </div>
      </div>
      return <article
        key={journey.id}
        className={`group flex min-w-0 flex-col rounded-3xl bg-white p-4 text-left transition-all duration-200 ${isSelected ? 'shadow-[0_20px_45px_-24px_rgba(30,64,175,0.65)] ring-2 ring-primary-500' : 'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.55)] ring-1 ring-slate-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-26px_rgba(15,23,42,0.5)] hover:ring-primary-200'}`}
      >
        {hasOfficialDemo ? <button type="button" onClick={() => setActiveDemo(journey)} aria-label={`Ampliar demonstração: ${journey.title}`} className="mx-auto block w-full rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">{preview}</button> : preview}
        <h3 className="mt-4 text-center text-base font-black text-slate-950">{journey.title}</h3>
        <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-600">{journey.description}</p>
        {hasOfficialDemo && <ProductButton type="button" variant="secondary" size="sm" onClick={() => setActiveDemo(journey)} className="mx-auto mt-4"><PlayCircle className="h-4 w-4" aria-hidden="true" />Ver exemplo</ProductButton>}
        <ProductButton type="button" variant={isSelected ? 'primary' : 'secondary'} aria-pressed={isSelected} aria-controls={isSelected ? `virtual-staging-chat-${journey.id}` : undefined} onClick={() => onSelect(journey.id)} className="mx-auto mt-4 w-fit">
          {isSelected ? 'Módulo selecionado' : 'Escolher módulo'}
        </ProductButton>
      </article>
      })}
    </div>
    {activeDemo && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Demonstração ampliada: ${activeDemo.title}`} onMouseDown={event => { if (event.target === event.currentTarget) closeDemo() }}>
      <div className="relative flex max-h-full w-full max-w-4xl flex-col items-center">
        <div className="mb-3 flex w-full items-center justify-between gap-3 text-white">
          <p className="truncate text-lg font-black">{activeDemo.title}</p>
          <button ref={closeButtonRef} type="button" onClick={closeDemo} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70" aria-label="Fechar demonstração"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex aspect-[9/16] max-h-[calc(100vh-9rem)] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl sm:flex-none sm:w-[min(420px,70vw)]">
          <video key={activeDemo.id} ref={modalVideoRef} src={activeDemo.demoVideo} aria-label={`Demonstração ampliada: ${activeDemo.title}`} autoPlay playsInline controls preload="metadata" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback" onContextMenu={event => event.preventDefault()} className="h-full w-full bg-black object-contain" />
        </div>
      </div>
    </div>}
  </>
}

function Question(props) {
  const { id, journeyId, lifeScene, presenterReferenceDecision, presenterReference, presenterReferenceMessage, images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, presenterInputRef, message, status, addPresenterReference, clearPresenterReference, addImages, move, remove, answerQuestion, setLifeScene, setPresenterReferenceDecision, setPropertyField, setGenerationField, toggleHighlight, toggleFurnishHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, resetCreation, reviewItems, onReviewEdit, navigateToVideoProduct } = props
  const isFurnishRenovate = journeyId === FURNISH_RENOVATE_JOURNEY_ID
  const isLifeInProperty = journeyId === LIFE_IN_PROPERTY_JOURNEY_ID
  const isBrokerPresentation = journeyId === BROKER_PRESENTATION_JOURNEY_ID
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; return <button key={item.id} type="button" onClick={() => select(item.id, item.label)} className={`rounded-smart-control border p-4 text-left font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${value === item.id ? (isFurnishRenovate ? 'border-primary-500 bg-primary-50 text-primary-950 ring-2 ring-primary-100' : 'border-emerald-400 bg-emerald-50') : `border-slate-200 bg-white ${isFurnishRenovate ? 'hover:border-primary-300 focus:ring-primary-500' : ''}`}`}><b className="text-sm">{item.label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const explainedChoices = (explanation, items, value, select) => <><p className="mb-3 text-xs font-semibold leading-5 text-slate-500">{explanation}</p>{choices(items, value, select)}</>
  const cont = (disabled, answer, nextQuestionId, apply, answerId = '') => <Button type="button" disabled={disabled} onClick={() => answerQuestion({ answer, answerId, nextQuestionId, apply })} className="mt-5">Continuar</Button>
  if (id === 'presenter_reference') return choices(BROKER_REFERENCE_OPTIONS, presenterReferenceDecision === true ? 'yes' : presenterReferenceDecision === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { setPresenterReferenceDecision(value === 'yes'); if (value === 'no') clearPresenterReference() } }))
  if (id === 'presenter_photo') return <>
    <p className="text-sm font-semibold leading-6 text-slate-600">Ela será utilizada somente nesta criação como referência para o apresentador.</p>
    <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm font-semibold leading-6 text-cyan-950">A IA utilizará sua foto como referência de identidade. O apresentador será semelhante a você, mas pequenas diferenças de aparência podem ocorrer durante a geração.</div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Foto do apresentador</p>
    <input ref={presenterInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={event => { addPresenterReference(event.target.files); event.target.value = '' }} />
    {!presenterReference ? <button type="button" onClick={() => presenterInputRef.current?.click()} className="mt-3 flex min-h-36 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-4 text-center"><UploadCloud className="text-emerald-600" /><b className="mt-2 text-sm">Selecionar foto do apresentador</b><span className="mt-1 text-xs text-slate-500">Uma foto · JPG ou PNG · até 15 MB</span></button> : <div className="mt-3 overflow-hidden rounded-3xl border border-emerald-200 bg-white p-3 shadow-sm"><img src={presenterReference.preview} alt="Preview da foto do apresentador" className="mx-auto aspect-square max-h-72 w-full rounded-2xl object-cover sm:max-w-72" /><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center"><button type="button" onClick={() => presenterInputRef.current?.click()} className="min-h-11 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-black text-emerald-800 hover:bg-emerald-50">Substituir foto</button><button type="button" onClick={clearPresenterReference} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-50">Remover foto</button></div></div>}
    {presenterReferenceMessage && <p className="mt-3 text-sm font-bold text-red-600">{presenterReferenceMessage}</p>}
    {presenterReference && cont(false, '1 foto do apresentador', 'images')}
  </>
  if (id === 'presenter_reference_required') return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold leading-6 text-amber-950">Este módulo utiliza uma foto sua como referência para criar o apresentador. Sem uma foto de referência, utilize o Vídeo Imobiliário para criar sua apresentação.</p><Button type="button" onClick={navigateToVideoProduct} className="mt-5">Ir para Vídeo Imobiliário</Button></div>
  if (id === 'images') {
    const imageLimit = isFurnishRenovate ? FURNISH_RENOVATE_MAX_IMAGES : VIRTUAL_STAGING_MAX_IMAGES
    return <>{isBrokerPresentation && <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Imagens do imóvel</p>}<input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} /><button type="button" onClick={() => inputRef.current?.click()} className={`flex min-h-32 w-full flex-col items-center justify-center rounded-smart-card border-2 border-dashed px-4 text-center transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${isFurnishRenovate ? 'border-primary-200 bg-primary-50/60 hover:border-primary-400 focus:ring-primary-500' : 'border-emerald-200 bg-emerald-50/50'}`}><UploadCloud className={isFurnishRenovate ? 'text-primary-600' : 'text-emerald-600'} /><b className="mt-2 text-sm">{isFurnishRenovate ? 'Selecionar fotografias' : isBrokerPresentation ? 'Selecionar fotos do imóvel' : 'Selecionar fotos'}</b>{isFurnishRenovate ? <><span className="text-xs text-slate-500">Selecione de 1 a 5 fotos.</span><span className="mt-1 text-xs text-slate-400">JPG ou PNG · ambientes vazios ou já mobiliados.</span></> : <><span className="text-xs text-slate-500">Selecione de 1 a {VIRTUAL_STAGING_MAX_IMAGES} fotos</span><span className="mt-1 text-xs text-slate-400">JPG ou PNG · até 15 MB cada</span></>}</button>{isFurnishRenovate && <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{FURNISH_RENOVATE_COPY.uploadHint}</p>}<p className="mt-3 text-xs font-bold">{images.length} de {imageLimit} imagens</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border p-2"><img src={item.preview} alt={`Foto ${position + 1}`} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false, `${images.length} foto${images.length > 1 ? 's' : ''}`)}</>
  }
  if (id === 'purpose') return choices([{id:'sale',label:'Venda'},{id:'rent',label:'Locação'}], property.purpose, (value, label) => answerQuestion({ answer: label, nextQuestionId: isFurnishRenovate ? 'type' : 'stage', apply: () => setPropertyField('purpose', value) }))
  if (id === 'stage') { const stageOptions = property.purpose === 'rent' ? LIFE_RENTAL_STAGE_OPTIONS : STAGES; return choices(stageOptions, property.stage, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'type', apply: () => setPropertyField('stage', value) })) }
  if (id === 'type' && isFurnishRenovate) return choices(FURNISH_RENOVATE_PROPERTY_TYPES, property.type, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setPropertyField('type', value) }))
  if (id === 'type') return <>{choices(VIRTUAL_STAGING_PROPERTY_TYPES, property.type, value => setPropertyField('type', value))}{cont(!property.type, property.type, 'facts')}</>
  if (['bedrooms', 'suites', 'parkingSpaces'].includes(id)) {
    const labels = { bedrooms: 'dormitórios', suites: 'suítes', parkingSpaces: 'vagas' }
    return choices(VIRTUAL_STAGING_MEASURE_OPTIONS[id], property[id], value => answerQuestion({ answer: `${value} ${labels[id]}`, answerId: value, apply: () => setPropertyField(id, value) }))
  }
  if (id === 'area') return <><label className="text-xs font-black">Área do imóvel<div className="mt-1 flex items-center rounded-smart-control border bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100"><input aria-label="Área do imóvel" value={property.area} onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 6); setPropertyField('area', Number(digits) > 0 ? String(Number(digits)) : '') }} inputMode="numeric" placeholder="Ex.: 85" className="min-w-0 flex-1 rounded-smart-control border-0 p-3 outline-none" /><span className="pr-3 text-sm font-black text-slate-500">m²</span></div></label>{cont(Number(property.area) <= 0, `${property.area} m²`, 'state')}</>
  if (id === 'state') return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state', value); setPropertyField('city', '') }} />{cont(!property.state, property.state, 'city')}</div>
  if (id === 'city') return <div className="space-y-3"><SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city', value)} />{cont(!property.state || !property.city, property.city, 'neighborhood')}</div>
  if (id === 'neighborhood') { const neighborhood = normalizeVirtualStagingDistrict(property.neighborhood); return <><input aria-label="Bairro" value={property.neighborhood} onChange={event => setPropertyField('neighborhood', event.target.value)} placeholder="Ex.: Limão" className="w-full rounded-xl border p-3" />{cont(!neighborhood, neighborhood, 'highlights', () => setPropertyField('neighborhood', neighborhood))}</> }
  if (id === 'facts') {
    const fields = getVirtualStagingMeasureFields(property.type)
    const fieldLabels = { bedrooms:'Dormitórios', suites:'Suítes', parkingSpaces:'Vagas', area:'Área' }
    const answer = fields.filter(field => property[field] !== '').map(field => `${fieldLabels[field]}: ${property[field]}${field === 'area' ? ' m²' : ''}`).join(' · ') || 'Sem medidas adicionais'
    const isIncomplete = fields.some(field => field === 'area' ? (!isFurnishRenovate && Number(property.area) <= 0) : property[field] === '')
    return <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => field === 'area' ? (
          <label key={field} className="text-xs font-black">
            {fieldLabels[field]}
            <div className="mt-1 flex items-center rounded-xl border bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
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
              {VIRTUAL_STAGING_MEASURE_OPTIONS[field].map(option => <button key={option} type="button" onClick={() => setPropertyField(field, option)} className={`min-w-11 rounded-xl border px-3 py-2 text-sm font-black transition ${property[field] === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}>{option}</button>)}
            </div>
          </fieldset>
        ))}
      </div>
      {cont(isIncomplete, answer, 'location')}
    </>
  }
  if (id === 'location') { const normalizedDistrict = normalizeVirtualStagingDistrict(property.district); const location = isFurnishRenovate ? [normalizedDistrict, property.city].filter(Boolean).join(', ') : formatVirtualStagingLocation({ ...property, district: normalizedDistrict }); return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder="Bairro" className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !normalizedDistrict, location, isFurnishRenovate ? 'highlights' : 'commercial', () => setPropertyField('district', normalizedDistrict))}</div> }
  if (id === 'commercial') { const commercialAnswer = [property.price, property.condominium, property.iptu].filter(Boolean).join(' · ') || 'Sem informações comerciais'; const commercialFields = [['price', property.purpose === 'rent' ? 'Valor da locação' : 'Preço'], ['condominium','Condomínio'], ['iptu','IPTU']]; return <><div className="grid gap-3 sm:grid-cols-3">{commercialFields.map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field, formatVirtualStagingCurrency(event.target.value))} inputMode="numeric" placeholder="R$ 0" className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false, commercialAnswer, 'highlights')}</> }
  if (id === 'highlights') { const highlightGroups = isFurnishRenovate ? FURNISH_RENOVATE_HIGHLIGHT_GROUPS : getVirtualStagingHighlightGroups(property.type); const highlightLimit = isFurnishRenovate ? FURNISH_RENOVATE_MAX_HIGHLIGHTS : 10; const nextQuestionId = isFurnishRenovate ? 'review' : isLifeInProperty ? 'life_scene' : 'captions'; return <><p className="mb-3 text-xs font-bold text-slate-500">{isFurnishRenovate ? 'Selecione até 3 opções. Somente os destaques escolhidos serão usados na narração.' : 'Selecione até 10 características. Somente os itens escolhidos serão enviados como contexto.'}</p><div className="space-y-4">{highlightGroups.map(group => <section key={group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{group.title}</h4><div className="flex flex-wrap gap-2">{group.items.map(item => <button key={item} type="button" disabled={!property.highlights.includes(item) && property.highlights.length >= highlightLimit} onClick={() => isFurnishRenovate ? toggleFurnishHighlight(item) : toggleHighlight(item)} className={`rounded-full border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45 ${property.highlights.includes(item) ? 'border-emerald-400 bg-emerald-50' : ''}`}>{item}</button>)}</div></section>)}</div>{cont(false, property.highlights.length ? `${property.highlights.length} destaques` : 'Nenhum destaque adicional', nextQuestionId)}</> }
  if (id === 'life_scene') return choices(LIFE_SCENE_OPTIONS, lifeScene, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setLifeScene(value) }))
  if (id === 'narration') return explainedChoices('Uma narração em português do Brasil apresentará o imóvel de forma natural e sincronizada com as imagens.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.narration, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('narration', value) }))
  if (id === 'captions') return explainedChoices('As informações do imóvel continuarão sendo utilizadas para gerar a campanha completa. Ao escolher ‘Não’, elas apenas deixarão de aparecer durante o vídeo.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.captions, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('captions', value) }))
  if (id === 'cta_enabled') return explainedChoices('Ao final do vídeo poderá ser exibido um convite para contato utilizando as informações do seu cadastro profissional.', [{id:'yes',label:'Sim'},{id:'no',label:'Não'}], ctaEnabled === true ? 'yes' : ctaEnabled === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { const enabled = value === 'yes'; setCtaEnabled(enabled); if (!enabled) { setCta(''); setIncludePhone(false) } } }))
  if (id === 'cta') return choices(CTAS, cta, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setCta(value) }))
  if (id === 'phone') return choices([{id:'yes',label:'Sim',description:phone || 'Cadastre o telefone no Perfil Profissional.'},{id:'no',label:'Não'}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; answerQuestion({ answer: value === 'yes' ? 'Telefone profissional' : 'Sem telefone', answerId: value, apply: () => setIncludePhone(value === 'yes') }) })
  if (isFurnishRenovate) {
    return <>
      <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950">
        <p className="text-lg font-black">Revise sua apresentação</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{item.displayLabel || reviewLabel(item.id)}</p><p className="mt-1 text-sm font-black text-slate-800">{item.label}</p></div><button type="button" onClick={() => onReviewEdit(item.id)} className="rounded-xl px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50">Editar</button></div></div>)}</div>
        <p className="mt-5 rounded-2xl border border-emerald-100 bg-white/80 p-4 font-bold">{FURNISH_RENOVATE_COPY.reviewNotice}</p>
      </div>
      {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-emerald-600" />}<b className="text-sm">{message}</b></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><Button type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="w-full"><Video className="mr-2 h-4 w-4" />{status === 'error' ? 'Tentar novamente' : 'Criar apresentação'}</Button><button type="button" disabled={['uploading','generating'].includes(status)} onClick={resetCreation} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Refazer dados</button></div>
    </>
  }
  const finalChoiceItems = [
    ...(isBrokerPresentation
      ? [
          { label: 'Apresentação pelo Corretor', value: 'Imagem própria enviada' },
          { label: 'Foto do apresentador', value: '1 imagem temporária' },
        ]
      : isLifeInProperty
      ? [{ label: 'Vida no Imóvel', value: getLifeSceneLabel(lifeScene) }]
      : [{ label: 'Narração', value: generation.narration === 'enabled' ? 'Sim' : 'Não' }]),
    { label: 'Textos', value: generation.captions === 'enabled' ? 'Sim' : 'Não' },
    { label: 'CTA', value: isLifeInProperty || isBrokerPresentation ? cta : ctaEnabled === true ? (cta || 'Sim') : 'Não' },
    ...((isLifeInProperty || isBrokerPresentation || ctaEnabled === true) ? [{ label: 'Telefone', value: includePhone === true ? phone : 'Não' }] : []),
  ]
  return <>
    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950">
      <p className="text-lg font-black">Revise suas escolhas</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {finalChoiceItems.map(item => <div key={item.label} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{item.label}</p><p className="mt-1 text-sm font-black text-slate-800">{item.value}</p></div>)}
      </div>
      <p className="mt-4 font-black">Confirma suas escolhas?</p>
    </div>
    <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Todas as escolhas</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{reviewLabel(item.id)}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-slate-700">{item.label}</p></div><button type="button" onClick={() => onReviewEdit(item.id)} className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50">Editar</button></div></div>)}
    </div>
    {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-emerald-600" />}<b className="text-sm">{message}</b></div>}
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Button type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="w-full"><Video className="mr-2 h-4 w-4" />{status === 'error' ? 'Tentar novamente' : 'Confirmar e criar vídeo'}</Button>
      <button type="button" disabled={['uploading','generating'].includes(status)} onClick={resetCreation} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Refazer criação</button>
    </div>
  </>
}

function reviewLabel(id) {
  return {
    images: 'Fotografias', purpose: 'Finalidade', stage: 'Estado', type: 'Tipo', facts: 'Medidas', area: 'Área', state: 'Estado', city: 'Cidade', district: 'Bairro', neighborhood: 'Bairro', bedrooms: 'Dormitórios', suites: 'Suítes', parkingSpaces: 'Vagas',
    location: 'Localização', commercial: 'Valores', highlights: 'Destaques',
    presenter_reference: 'Apresentação pelo Corretor', presenter_photo: 'Foto do apresentador', life_scene: 'Vida no Imóvel', narration: 'Narração', captions: 'Destaques no vídeo', cta_enabled: 'CTA final', cta: 'Chamada escolhida', phone: 'Telefone',
  }[id] || id
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, PlayCircle, Sparkles, Trash2, UploadCloud, Video, X } from 'lucide-react'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import CampaignPackage from '../components/campaign/CampaignPackage'
import { buildSmartTourCampaignPackage } from '../components/campaign/buildSmartTourCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import GuidedConversation from '../components/conversation/GuidedConversation'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { SMART_TOUR_EXAMPLES, SMART_TOUR_MAX_IMAGES, SMART_TOUR_PRODUCT_NAME } from '../config/smartTour'
import { getSmartTourNextQuestion, getSmartTourReviewEditNext } from '../config/smartTourConversation'
import { formatSmartTourCurrency, formatSmartTourLocation, getSmartTourHighlightGroups, getSmartTourMeasureFields, normalizeSmartTourDistrict, SMART_TOUR_MEASURE_OPTIONS, SMART_TOUR_PROPERTY_TYPES } from '../config/smartTourForm'
import { formatBrazilianPhone } from '../../../supabase/functions/_shared/product3-contract.ts'

const BUCKET = 'studio-videos'
const ACTIVE_JOB_KEY = 'smartcorretorai:smart-tour:active-job'
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTAS = ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', state: '', city: '', district: '', price: '', condominium: '', iptu: '', highlights: [], description: '' }
const initialGeneration = { mode: 'guided_tour', presenterGender: '', narration: '', captions: '', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
const SMART_TOUR_QUESTION_ORDER = ['images', 'purpose', 'stage', 'type', 'facts', 'location', 'commercial', 'highlights', 'presenter', 'narration', 'captions', 'cta_enabled', 'cta', 'phone', 'review']

function normalizeGeneration(input) {
  const value = { ...initialGeneration, ...input }
  return { ...value, mode: 'guided_tour', presenterGender: ['female','male'].includes(value.presenterGender) ? value.presenterGender : 'none', narration: value.narration === 'disabled' ? 'disabled' : 'enabled', captions: value.captions === 'disabled' ? 'disabled' : 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }
}
function questionsFor() {
  const questions = [
    ['images', 1, 'Envie até 5 fotos na ordem em que deseja apresentá-las.'], ['purpose', 2, 'Qual é a finalidade do imóvel?'],
    ['stage', 2, 'Qual é o estado atual do imóvel?'], ['type', 2, 'Que tipo de imóvel vamos apresentar?'],
    ['facts', 2, 'Quais são as principais medidas?'], ['location', 2, 'Onde fica o imóvel?'],
    ['commercial', 2, 'Quais informações comerciais deseja incluir?'], ['highlights', 2, 'Quais são os principais destaques?'],
    ['presenter', 3, 'Deseja um apresentador virtual durante o vídeo?'],
    ['narration', 3, 'Deseja narração durante o vídeo?'],
    ['captions', 3, 'Deseja destacar algumas informações importantes durante o vídeo?'],
    ['cta_enabled', 4, 'Deseja uma chamada para ação no final do vídeo?'],
  ]
  return [...questions, ['cta', 4, 'Qual chamada deseja usar no final?'], ['phone', 4, 'Deseja divulgar seu telefone profissional?'], ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.']]
}

function smartTourConfirmation(id, answer) {
  if (id === 'purpose') return answer === 'Locação' ? 'Perfeito! Vamos criar uma apresentação para divulgar a locação desse imóvel.' : 'Perfeito! Vamos criar uma apresentação para apoiar a venda desse imóvel.'
  const confirmations = {
    images: `Ótimo! ${answer} serão usadas exatamente na ordem escolhida.`,
    stage: `Perfeito! Vamos considerar o imóvel como “${answer}”.`,
    type: `Ótimo! O tipo “${answer}” já está registrado.`,
    facts: 'Perfeito! As principais medidas do imóvel foram registradas.',
    location: `Ótimo! A localização em ${answer} foi registrada.`,
    commercial: answer === 'Sem informações comerciais' ? 'Tudo bem! Seguiremos sem exibir valores comerciais.' : 'Perfeito! As informações comerciais foram registradas.',
    highlights: `Excelente! ${answer} foram selecionados para valorizar o imóvel.`,
    presenter: answer === 'Nenhum' ? 'Tudo certo! O vídeo seguirá sem apresentador virtual.' : `Perfeito! ${answer} fará a apresentação virtual.`,
    narration: answer === 'Sim' ? 'Perfeito! A apresentação terá narração profissional.' : 'Tudo certo! A apresentação seguirá sem narração.',
    captions: answer === 'Sim' ? 'Ótimo! Uma seleção curta de destaques poderá aparecer no vídeo.' : 'Tudo certo! As informações continuarão na campanha, mas não aparecerão no vídeo.',
    cta_enabled: answer === 'Sim' ? 'Perfeito! Agora escolha a chamada final.' : 'Tudo certo! O vídeo terminará naturalmente na última cena, sem chamada final.',
    cta: `Ótimo! A chamada final será “${answer}”.`,
    phone: answer === 'Telefone profissional' ? 'Perfeito! Seu telefone profissional será incluído.' : 'Tudo certo! A apresentação seguirá sem telefone.',
  }
  return confirmations[id] || 'Perfeito! Informação registrada.'
}

export default function SmartTourAI() {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const pollRef = useRef(null)
  const reviewEditRef = useRef(null)
  const [images, setImages] = useState([])
  const [property, setProperty] = useState(initialProperty)
  const [generation, setGeneration] = useState(initialGeneration)
  const [ctaEnabled, setCtaEnabled] = useState(null)
  const [cta, setCta] = useState('')
  const [includePhone, setIncludePhone] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const questions = useMemo(() => questionsFor(), [])
  const rawPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const phone = formatBrazilianPhone(rawPhone)
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => ({ ...current, [field]: value }))

  const resetTourFromQuestion = (questionId) => {
    if (reviewEditRef.current) {
      if (questionId === 'images') setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
      if (questionId === 'purpose') setProperty(current => ({ ...current, purpose: '', stage: '' }))
      if (questionId === 'stage') setProperty(current => ({ ...current, stage: '' }))
      if (questionId === 'type') setProperty(current => ({ ...current, type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [] }))
      if (questionId === 'facts') setProperty(current => ({ ...current, bedrooms: '', suites: '', parkingSpaces: '', area: '' }))
      if (questionId === 'location') setProperty(current => ({ ...current, state: '', city: '', district: '' }))
      if (questionId === 'commercial') setProperty(current => ({ ...current, price: '', condominium: '', iptu: '' }))
      if (questionId === 'highlights') setProperty(current => ({ ...current, highlights: [] }))
      if (questionId === 'presenter') setGeneration(current => ({ ...current, presenterGender: '' }))
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
    if (shouldReset('images')) setImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return [] })
    const propertyFields = [['purpose', 'purpose'], ['stage', 'stage'], ['type', 'type'], ['facts', 'bedrooms'], ['facts', 'suites'], ['facts', 'parkingSpaces'], ['facts', 'area'], ['location', 'state'], ['location', 'city'], ['location', 'district'], ['commercial', 'price'], ['commercial', 'condominium'], ['commercial', 'iptu'], ['highlights', 'highlights']]
    setProperty(current => propertyFields.reduce((nextProperty, [questionKey, field]) => shouldReset(questionKey) ? { ...nextProperty, [field]: field === 'highlights' ? [] : '' } : nextProperty, current))
    setGeneration(current => ({
      ...current,
      ...(shouldReset('presenter') ? { presenterGender: '' } : {}),
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
  const conversation = useGuidedConversation({ initialQuestionId: 'images', onEdit: resetTourFromQuestion })
  const questionIndex = Math.max(0, questions.findIndex(item => item[0] === conversation.activeQuestionId))
  const question = questions[questionIndex] || questions[0]
  const answerQuestion = ({ answer, answerId = '', nextQuestionId = getSmartTourNextQuestion({ questionId: question[0], answerId, mode: generation.mode }), apply }) => {
    let resolvedNextQuestionId = nextQuestionId
    if (reviewEditRef.current) {
      resolvedNextQuestionId = getSmartTourReviewEditNext({ originQuestionId: reviewEditRef.current, questionId: question[0], answerId, mode: generation.mode })
      if (resolvedNextQuestionId === 'review') reviewEditRef.current = null
    }
    const accepted = conversation.submitAnswer({ questionId: question[0], question: question[2], answer, confirmation: smartTourConfirmation(question[0], answer), nextQuestionId: resolvedNextQuestionId })
    if (accepted) apply?.()
    return accepted
  }
  const editConversationAnswer = questionId => {
    if (question[0] === 'review') reviewEditRef.current = questionId
    conversation.editAnswer(questionId)
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])
  useEffect(() => { const stored = sessionStorage.getItem(ACTIVE_JOB_KEY); if (stored) { let jobId = stored; try { jobId = JSON.parse(stored).jobId || stored } catch { /* legacy value */ } setStatus('generating'); setMessage('Retomando sua criação...'); poll(jobId) } }, [])

  const addImages = files => {
    const selectedInSystemOrder = Array.from(files)
    if (selectedInSystemOrder.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage('Envie imagens JPG ou PNG de até 15 MB.')
    setImages(current => {
      const known = new Set(current.map(item => item.key))
      const uniqueInSystemOrder = selectedInSystemOrder.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
      if (current.length + uniqueInSystemOrder.length > SMART_TOUR_MAX_IMAGES) { setMessage(`Você pode enviar no máximo ${SMART_TOUR_MAX_IMAGES} imagens.`); return current }
      setMessage('')
      return [...current, ...uniqueInSystemOrder.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))]
    })
  }
  const move = (position, offset) => setImages(current => { const target = position + offset; if (target < 0 || target >= current.length) return current; const nextImages = [...current]; [nextImages[position], nextImages[target]] = [nextImages[target], nextImages[position]]; return nextImages })
  const remove = position => setImages(current => current.filter((item, itemIndex) => { if (itemIndex === position) URL.revokeObjectURL(item.preview); return itemIndex !== position }))
  const toggleHighlight = value => setPropertyField('highlights', property.highlights.includes(value) ? property.highlights.filter(item => item !== value) : property.highlights.length < 10 ? [...property.highlights, value] : property.highlights)

  async function poll(jobId) {
    try {
      const { data, error } = await supabase.functions.invoke('smart-tour-status', { body: { jobId } })
      if (error || !data?.ok) throw new Error(data?.error || 'Não foi possível consultar a criação.')
      if (data.status === 'completed') { let campaignPackage = {}; try { campaignPackage = JSON.parse(sessionStorage.getItem(ACTIVE_JOB_KEY) || '{}').campaignPackage || {} } catch { /* legacy value */ } sessionStorage.removeItem(ACTIVE_JOB_KEY); setResult({ ...data, campaignPackage }); setStatus('completed'); return }
      if (data.status === 'failed') throw new Error(data.error)
      setMessage(data.message || 'A IA está criando sua apresentação...'); pollRef.current = setTimeout(() => poll(jobId), 9000)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Não foi possível concluir. Tente novamente.') }
  }

  const createTour = async () => {
    setStatus('uploading'); setMessage('Enviando suas fotos com segurança...')
    try {
      const requestId = crypto.randomUUID()
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
      const apiGeneration = normalizeGeneration(generation)
      const selectedCta = ctaEnabled === true ? cta : ''
      const { data, error } = await supabase.functions.invoke('smart-tour-generate', { body: { clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: apiGeneration, selectedCta, includeProfessionalPhone: ctaEnabled === true && includePhone === true, language: 'pt-BR' } })
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || 'Não foi possível iniciar a criação.')
      const campaignPackage = buildSmartTourCampaignPackage({ property, language:'pt-BR', cta:selectedCta, phone:ctaEnabled === true && includePhone ? phone : '' })
      sessionStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId:data.jobId, campaignPackage })); poll(data.jobId)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Não foi possível criar sua apresentação.') }
  }

  const reset = () => { images.forEach(item => URL.revokeObjectURL(item.preview)); reviewEditRef.current = null; setImages([]); setProperty(initialProperty); setGeneration(initialGeneration); setCtaEnabled(null); setCta(''); setIncludePhone(null); conversation.resetConversation(); setStatus('idle'); setMessage(''); setResult(null) }
  if (result) return <><Header title={SMART_TOUR_PRODUCT_NAME} subtitle="Sua apresentação imobiliária premium." /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: SMART_TOUR_PRODUCT_NAME, mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl }} onCreateNew={reset} createNewLabel="Criar nova apresentação" /></main></>

  const measureFields = getSmartTourMeasureFields(property.type)
  const measureLabels = { bedrooms: 'dormitórios', suites: 'suítes', parkingSpaces: 'vagas', area: 'm²' }
  const measuresSummary = measureFields.map(field => property[field] && `${property[field]} ${measureLabels[field]}`).filter(Boolean).join(' · ')
  const valuesSummary = [property.price && `${property.purpose === 'rent' ? 'Locação' : 'Preço'} ${property.price}`, property.condominium && `Condomínio ${property.condominium}`, property.iptu && `IPTU ${property.iptu}`].filter(Boolean).join(' · ')
  const isReviewContext = question[0] === 'review' || Boolean(reviewEditRef.current)
  const summary = [
    { id: 'images', label: images.length && `${images.length} foto${images.length > 1 ? 's' : ''}` },
    { id: 'purpose', label: property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação') },
    { id: 'stage', label: property.stage },
    { id: 'type', label: property.type },
    { id: 'facts', label: measuresSummary },
    { id: 'location', label: formatSmartTourLocation(property) },
    { id: 'commercial', label: valuesSummary || (isReviewContext ? 'Sem valores informados' : '') },
    { id: 'highlights', label: property.highlights.length ? `${property.highlights.length} destaques` : (isReviewContext ? 'Sem destaques adicionais' : '') },
    { id: 'presenter', label: generation.presenterGender === 'female' ? 'Corretora' : generation.presenterGender === 'male' ? 'Corretor' : (isReviewContext ? 'Nenhum' : '') },
    { id: 'narration', label: generation.narration === 'enabled' ? 'Sim' : generation.narration === 'disabled' ? 'Não' : '' },
    { id: 'captions', label: generation.captions === 'enabled' ? 'Sim' : generation.captions === 'disabled' ? 'Não' : '' },
    { id: 'cta_enabled', label: ctaEnabled === true ? 'Sim' : ctaEnabled === false ? 'Não' : '' },
    { id: 'cta', label: ctaEnabled === true ? cta : '' },
    { id: 'phone', label: ctaEnabled === true ? (includePhone === true ? phone : includePhone === false ? 'Sem telefone' : '') : '' },
  ].filter(item => Boolean(item.label))
  const visualStep = status === 'idle' ? question[1] : 5
  return <>
    <Header title={SMART_TOUR_PRODUCT_NAME} subtitle="O SmartCorretorAI organiza o contexto. A IA faz o trabalho pesado." />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#052e3b_0%,#0f172a_48%,#047857_100%)] px-6 py-9 text-white shadow-2xl shadow-emerald-950/20 sm:px-10 sm:py-11">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(110,231,183,0.24),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.16),transparent_30%)]" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-100 ring-1 ring-white/10">
            <Sparkles className="h-4 w-4" />
            Smart Tour AI
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">Transforme fotos em uma apresentação que conduz a visita.</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-200 sm:text-base">
            Escolha a experiência ideal no chat. A IA organiza movimentos, narração, destaques e apresentação virtual conforme suas escolhas.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Exemplos de experiências</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Quatro formas de apresentar seu imóvel</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            Esta vitrine apresenta apenas as quatro famílias principais. As variações de cada experiência continuam disponíveis no chat de criação.
          </p>
        </div>
        <SmartTourShowcase />
      </section>

      <div className="mb-5 mt-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Criação guiada</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Agora, conte como será o seu Smart Tour</h2>
      </div>
    <div className="mb-6 grid grid-cols-5 gap-2">{['Fotos','Imóvel','Estilo','Revisão','Criar'].map((label, step) => <div key={label}><div className={`h-2 rounded-full ${step + 1 <= visualStep ? 'bg-emerald-500' : 'bg-slate-200'}`} /><p className="mt-2 truncate text-center text-xs font-black text-slate-600">{label}</p></div>)}</div>
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
    >
      <Question id={question[0]} {...{ images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, message, status, addImages, move, remove, answerQuestion, setPropertyField, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, reviewItems: summary, onReviewEdit: editConversationAnswer }} />
    </GuidedConversation>
    </main>
  </>
}

function SmartTourShowcase() {
  const [activeIndex, setActiveIndex] = useState(null)
  const modalVideoRef = useRef(null)
  const closeButtonRef = useRef(null)
  const activeExample = activeIndex === null ? null : SMART_TOUR_EXAMPLES[activeIndex]
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
    <div className="grid grid-flow-col auto-cols-[minmax(240px,82vw)] gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin] snap-x snap-mandatory sm:auto-cols-[280px] lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible lg:pb-0">
      {SMART_TOUR_EXAMPLES.map((example, exampleIndex) => (
        <article key={example.id} className="min-w-0 snap-center rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveIndex(exampleIndex)}
            className="group mx-auto block w-full max-w-[190px] rounded-[2rem] border border-slate-200 bg-slate-950 p-2 text-left shadow-xl shadow-slate-200/70 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label={`Ampliar demonstração: ${example.title}`}
          >
            <div className="relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[1.45rem] bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_48%,#047857_100%)]">
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
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                />
              )}
              <span className="absolute inset-0 rounded-[1.45rem] ring-1 ring-inset ring-white/10 transition group-hover:ring-emerald-300/60" />
            </div>
          </button>
          <h3 className="mt-4 text-center text-base font-black text-slate-950">{example.title}</h3>
          <p className="mt-2 text-center text-sm font-semibold leading-6 text-slate-600">{example.description}</p>
          <button
            type="button"
            onClick={() => setActiveIndex(exampleIndex)}
            className="mx-auto mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Ver exemplo
          </button>
        </article>
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
            <button ref={closeButtonRef} type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar demonstração">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2 sm:gap-5">
            <button type="button" onClick={showPrevious} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Demonstração anterior">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex aspect-[9/16] max-h-[calc(100vh-9rem)] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-2xl sm:flex-none sm:w-[min(420px,70vw)]">
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
                  className="h-full w-full bg-black object-contain"
                />
              )}
            </div>
            <button type="button" onClick={showNext} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Próxima demonstração">
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    )}
  </>
}

function ExamplePlaceholder({ example, large = false }) {
  return <div className="relative flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.22),transparent_42%),linear-gradient(160deg,#0f172a_0%,#1e293b_52%,#064e3b_100%)] px-4 text-center text-white">
    <PlayCircle className={large ? 'h-14 w-14 text-emerald-200' : 'h-9 w-9 text-emerald-200'} />
    <p className={`${large ? 'mt-5 text-sm' : 'mt-4 text-[10px]'} font-black uppercase tracking-[0.2em] text-emerald-100`}>Vídeo pendente</p>
    <p className={`${large ? 'mt-3 text-base' : 'mt-2 text-xs'} font-black`}>{example.title}</p>
    <p className={`${large ? 'mt-4 max-w-sm text-sm' : 'mt-3 text-[10px]'} break-all font-semibold leading-5 text-slate-300`}>{example.video}</p>
  </div>
}

function Question(props) {
  const { id, images, property, generation, ctaEnabled, cta, includePhone, phone, inputRef, message, status, addImages, move, remove, answerQuestion, setPropertyField, setGenerationField, toggleHighlight, setCtaEnabled, setCta, setIncludePhone, createTour, reviewItems, onReviewEdit } = props
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; return <button key={item.id} type="button" onClick={() => select(item.id, item.label)} className={`rounded-2xl border p-4 text-left ${value === item.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}><b className="text-sm">{item.label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const explainedChoices = (explanation, items, value, select) => <><p className="mb-3 text-xs font-semibold leading-5 text-slate-500">{explanation}</p>{choices(items, value, select)}</>
  const cont = (disabled, answer, nextQuestionId, apply, answerId = '') => <Button type="button" disabled={disabled} onClick={() => answerQuestion({ answer, answerId, nextQuestionId, apply })} className="mt-5">Continuar</Button>
  if (id === 'images') return <><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} /><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/50"><UploadCloud className="text-emerald-600" /><b className="mt-2 text-sm">Selecionar fotos</b><span className="text-xs text-slate-500">Selecione de 1 a {SMART_TOUR_MAX_IMAGES} fotos</span><span className="mt-1 text-xs text-slate-400">JPG ou PNG · até 15 MB cada</span></button><p className="mt-3 text-xs font-bold">{images.length} de {SMART_TOUR_MAX_IMAGES} imagens</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border p-2"><img src={item.preview} alt={`Foto ${position + 1}`} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false, `${images.length} foto${images.length > 1 ? 's' : ''}`, 'purpose')}</>
  if (id === 'purpose') return choices([{id:'sale',label:'Venda'},{id:'rent',label:'Locação'}], property.purpose, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'stage', apply: () => setPropertyField('purpose', value) }))
  if (id === 'stage') return choices(property.purpose === 'rent' ? ['Pronto para mudar'] : STAGES, property.stage, (value, label) => answerQuestion({ answer: label, nextQuestionId: 'type', apply: () => setPropertyField('stage', value) }))
  if (id === 'type') return <>{choices(SMART_TOUR_PROPERTY_TYPES, property.type, value => setPropertyField('type', value))}{cont(!property.type, property.type, 'facts')}</>
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
              {SMART_TOUR_MEASURE_OPTIONS[field].map(option => <button key={option} type="button" onClick={() => setPropertyField(field, option)} className={`min-w-11 rounded-xl border px-3 py-2 text-sm font-black transition ${property[field] === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}>{option}</button>)}
            </div>
          </fieldset>
        ))}
      </div>
      {cont(isIncomplete, answer, 'location')}
    </>
  }
  if (id === 'location') { const normalizedDistrict = normalizeSmartTourDistrict(property.district); const location = formatSmartTourLocation({ ...property, district: normalizedDistrict }); return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder="Bairro" className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !normalizedDistrict, location, 'commercial', () => setPropertyField('district', normalizedDistrict))}</div> }
  if (id === 'commercial') { const commercialAnswer = [property.price, property.condominium, property.iptu].filter(Boolean).join(' · ') || 'Sem informações comerciais'; const commercialFields = [['price', property.purpose === 'rent' ? 'Valor da locação' : 'Preço'], ['condominium','Condomínio'], ['iptu','IPTU']]; return <><div className="grid gap-3 sm:grid-cols-3">{commercialFields.map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field, formatSmartTourCurrency(event.target.value))} inputMode="numeric" placeholder="R$ 0" className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false, commercialAnswer, 'highlights')}</> }
  if (id === 'highlights') { const highlightGroups = getSmartTourHighlightGroups(property.type); return <><p className="mb-3 text-xs font-bold text-slate-500">Selecione até 10 características. Somente os itens escolhidos serão enviados como contexto.</p><div className="space-y-4">{highlightGroups.map(group => <section key={group.title}><h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{group.title}</h4><div className="flex flex-wrap gap-2">{group.items.map(item => <button key={item} type="button" disabled={!property.highlights.includes(item) && property.highlights.length >= 10} onClick={() => toggleHighlight(item)} className={`rounded-full border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45 ${property.highlights.includes(item) ? 'border-emerald-400 bg-emerald-50' : ''}`}>{item}</button>)}</div></section>)}</div>{cont(false, property.highlights.length ? `${property.highlights.length} destaques` : 'Nenhum destaque adicional', 'presenter')}</> }
  if (id === 'presenter') return explainedChoices('Um corretor ou corretora virtual poderá apresentar o imóvel de forma natural, mantendo os ambientes como o principal destaque.', [{id:'female',label:'Corretora'},{id:'male',label:'Corretor'},{id:'none',label:'Nenhum'}], generation.presenterGender, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('presenterGender', value) }))
  if (id === 'narration') return explainedChoices('Uma narração em português do Brasil apresentará o imóvel de forma natural e sincronizada com as imagens.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.narration, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('narration', value) }))
  if (id === 'captions') return explainedChoices('As informações do imóvel continuarão sendo utilizadas para gerar a campanha completa. Ao escolher ‘Não’, elas apenas deixarão de aparecer durante o vídeo.', [{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation.captions, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setGenerationField('captions', value) }))
  if (id === 'cta_enabled') return explainedChoices('Ao final do vídeo poderá ser exibido um convite para contato utilizando as informações do seu cadastro profissional.', [{id:'yes',label:'Sim'},{id:'no',label:'Não'}], ctaEnabled === true ? 'yes' : ctaEnabled === false ? 'no' : '', (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => { const enabled = value === 'yes'; setCtaEnabled(enabled); if (!enabled) { setCta(''); setIncludePhone(false) } } }))
  if (id === 'cta') return choices(CTAS, cta, (value, label) => answerQuestion({ answer: label, answerId: value, apply: () => setCta(value) }))
  if (id === 'phone') return choices([{id:'yes',label:'Sim',description:phone || 'Cadastre o telefone no Perfil Profissional.'},{id:'no',label:'Não'}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; answerQuestion({ answer: value === 'yes' ? 'Telefone profissional' : 'Sem telefone', answerId: value, apply: () => setIncludePhone(value === 'yes') }) })
  return <>
    <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-950">
      <p className="font-black">Tudo pronto!</p>
      <p className="mt-2">Sua apresentação será criada utilizando todas as fotos enviadas, respeitando a ordem escolhida e todas as informações confirmadas durante esta conversa.</p>
      <p className="mt-2">Nenhuma informação será inventada.</p>
      <p className="mt-2">Agora é só clicar em Criar apresentação.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {reviewItems.map(item => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{reviewLabel(item.id)}</p><p className="mt-1 break-words text-sm font-bold leading-6 text-slate-700">{item.label}</p></div><button type="button" onClick={() => onReviewEdit(item.id)} className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50">Editar</button></div></div>)}
    </div>
    {message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-emerald-600" />}<b className="text-sm">{message}</b></div>}
    <Button type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="mt-5 w-full"><Video className="mr-2 h-4 w-4" />{status === 'error' ? 'Tentar novamente' : 'Criar apresentação'}</Button>
  </>
}

function reviewLabel(id) {
  return {
    images: 'Fotos', purpose: 'Finalidade', stage: 'Estado', type: 'Tipo', facts: 'Medidas',
    location: 'Localização', commercial: 'Valores', highlights: 'Destaques',
    presenter: 'Apresentador', narration: 'Narração', captions: 'Destaques no vídeo', cta_enabled: 'CTA final', cta: 'Chamada escolhida', phone: 'Telefone',
  }[id] || id
}

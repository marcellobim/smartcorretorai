import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Loader2, MessageSquareText, PlayCircle, Sparkles, Trash2, UploadCloud, Video, X } from 'lucide-react'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import CampaignPackage from '../components/campaign/CampaignPackage'
import { buildSmartTourCampaignPackage } from '../components/campaign/buildSmartTourCampaignPackage'
import SmartCarouselCitySelect, { SmartCarouselStateSelect } from '../components/location/SmartCarouselCitySelect'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { SMART_TOUR_EXAMPLES, SMART_TOUR_LANGUAGES, SMART_TOUR_MAX_IMAGES, SMART_TOUR_MODES, SMART_TOUR_PRODUCT_NAME } from '../config/smartTour'

const BUCKET = 'studio-videos'
const ACTIVE_JOB_KEY = 'smartcorretorai:smart-tour:active-job'
const TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Terreno / Lote', 'Comercial']
const STAGES = ['Pré-lançamento', 'Lançamento', 'Em obras', 'Pronto para morar']
const CTAS = ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']
const HIGHLIGHTS = ['Próximo ao metrô', 'Lazer completo', 'Varanda gourmet', 'Vista livre', 'Piscina', 'Academia', 'Segurança 24h', 'Iluminação natural', 'Acabamento premium', 'Ambientes integrados', 'Bairro valorizado']
const initialProperty = { purpose: '', stage: '', type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', state: '', city: '', district: '', price: '', condominium: '', iptu: '', highlights: [], description: '' }
const initialGeneration = { mode: '', presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only', language: 'pt-BR' }

function normalizeGeneration(input) {
  const value = { ...initialGeneration, ...input }
  if (value.mode === 'guided_tour') return { ...value, presenterGender: value.presenterGender === 'male' ? 'male' : 'female', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only' }
  if (value.mode === 'narrated_tour') return { ...value, presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only' }
  if (value.mode === 'cinematic_tour') return { ...value, presenterGender: 'none', narration: 'disabled', stagingPresentation: 'final_only' }
  return { ...value, presenterGender: 'none', stagingPresentation: value.furniture === 'virtual_staging' ? value.stagingPresentation : 'final_only' }
}
function questionsFor(generation) {
  const questions = [
    ['images', 1, 'Envie as fotos na ordem em que deseja apresentá-las.'], ['purpose', 2, 'Qual é a finalidade do imóvel?'],
    ['stage', 2, 'Qual é o estado atual do imóvel?'], ['type', 2, 'Que tipo de imóvel vamos apresentar?'],
    ['facts', 2, 'Quais são as principais medidas?'], ['location', 2, 'Onde fica o imóvel?'],
    ['commercial', 2, 'Quais informações comerciais deseja incluir?'], ['highlights', 2, 'Quais são os principais destaques?'],
    ['description', 2, 'Deseja acrescentar uma descrição comercial?'], ['mode', 3, 'Como deseja apresentar este imóvel?'],
  ]
  if (generation.mode === 'guided_tour') questions.push(['presenter', 3, 'Quem você prefere apresentando o imóvel?'])
  if (generation.mode === 'smart_staging') {
    questions.push(['furniture', 3, 'Como deseja apresentar os ambientes?'])
    if (generation.furniture === 'virtual_staging') questions.push(['staging', 3, 'Como deseja mostrar o resultado?'])
    questions.push(['narration', 3, 'Deseja narração?'], ['captions', 3, 'Deseja textos na tela?'])
  }
  if (generation.mode === 'cinematic_tour') questions.push(['captions', 3, 'Deseja textos na tela?'], ['furniture', 3, 'Deseja manter os ambientes como estão ou mobiliar ambientes vazios?'])
  return [...questions, ['language', 3, 'Qual será o idioma da apresentação?'], ['cta', 4, 'Qual chamada deseja usar no final?'], ['phone', 4, 'Deseja divulgar seu telefone profissional?'], ['review', 4, 'Tudo pronto. Revise as escolhas antes de criar.']]
}

export default function SmartTourAI() {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const pollRef = useRef(null)
  const [images, setImages] = useState([])
  const [property, setProperty] = useState(initialProperty)
  const [generation, setGeneration] = useState(initialGeneration)
  const [cta, setCta] = useState('')
  const [includePhone, setIncludePhone] = useState(null)
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const questions = useMemo(() => questionsFor(generation), [generation])
  const question = questions[Math.min(index, questions.length - 1)]
  const phone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const next = () => setIndex(current => Math.min(current + 1, questions.length - 1))
  const setPropertyField = (field, value) => setProperty(current => ({ ...current, [field]: value }))
  const setGenerationField = (field, value) => setGeneration(current => normalizeGeneration({ ...current, [field]: value }))

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])
  useEffect(() => { const stored = sessionStorage.getItem(ACTIVE_JOB_KEY); if (stored) { let jobId = stored; try { jobId = JSON.parse(stored).jobId || stored } catch { /* legacy value */ } setStatus('generating'); setMessage('Retomando sua criação...'); poll(jobId) } }, [])

  const addImages = files => {
    const selected = [...files]
    if (selected.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 15 * 1024 * 1024)) return setMessage('Envie imagens JPG ou PNG de até 15 MB.')
    const known = new Set(images.map(item => item.key))
    const unique = selected.filter(file => !known.has(`${file.name}:${file.size}:${file.lastModified}`))
    if (images.length + unique.length > SMART_TOUR_MAX_IMAGES) return setMessage('Você pode enviar no máximo 6 imagens.')
    setMessage(''); setImages(current => [...current, ...unique.map(file => ({ file, key: `${file.name}:${file.size}:${file.lastModified}`, preview: URL.createObjectURL(file) }))])
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
      const imagePaths = []
      for (let imageIndex = 0; imageIndex < images.length; imageIndex += 1) {
        const file = images[imageIndex].file
        const path = `${user.id}/smart-tour/${requestId}/${String(imageIndex + 1).padStart(2, '0')}.${file.type === 'image/png' ? 'png' : 'jpg'}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
        if (error) throw new Error('Uma das fotos não pôde ser enviada. Tente novamente.')
        imagePaths.push(path)
      }
      setStatus('generating'); setMessage('A IA está criando sua apresentação...')
      const { data, error } = await supabase.functions.invoke('smart-tour-generate', { body: { clientRequestId: requestId, imagePaths, imageOrder: imagePaths, property, generation: normalizeGeneration(generation), selectedCta: cta, includeProfessionalPhone: includePhone === true, language: generation.language } })
      if (error || !data?.ok || !data?.jobId) throw new Error(data?.error || 'Não foi possível iniciar a criação.')
      const campaignPackage = buildSmartTourCampaignPackage({ property, language:generation.language, cta, phone:includePhone ? phone : '' })
      sessionStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId:data.jobId, campaignPackage })); poll(data.jobId)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Não foi possível criar sua apresentação.') }
  }

  const reset = () => { images.forEach(item => URL.revokeObjectURL(item.preview)); setImages([]); setProperty(initialProperty); setGeneration(initialGeneration); setCta(''); setIncludePhone(null); setIndex(0); setStatus('idle'); setMessage(''); setResult(null) }
  if (result) return <><Header title={SMART_TOUR_PRODUCT_NAME} subtitle="Sua apresentação imobiliária premium." /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-7"><CampaignPackage data={{ ...result.campaignPackage, sourceProduct: SMART_TOUR_PRODUCT_NAME, mediaType: 'video', previewUrl: result.signedVideoUrl, downloadUrl: result.signedVideoUrl }} onCreateNew={reset} createNewLabel="Criar nova apresentação" /></main></>

  const summary = [images.length && `${images.length} foto${images.length > 1 ? 's' : ''}`, property.purpose && (property.purpose === 'sale' ? 'Venda' : 'Locação'), property.type, [property.district, property.city, property.state].filter(Boolean).join(', '), SMART_TOUR_MODES.find(item => item.id === generation.mode)?.label, SMART_TOUR_LANGUAGES.find(item => item.id === generation.language)?.label, cta, includePhone === true ? phone : includePhone === false ? 'Sem telefone' : ''].filter(Boolean)
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
            Escolha a experiência ideal no chat. A IA organiza movimentos, narração, textos, apresentação virtual e ambientação conforme suas escolhas.
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
    <section className="rounded-[2rem] border border-slate-200 bg-transparent"><div className="border-b border-slate-100 p-5 sm:px-8"><div className="flex gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageSquareText /></span><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Criação guiada</p><h2 className="text-xl font-black">Converse com a IA</h2></div></div></div>
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8"><div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm"><div className="flex gap-3"><Sparkles className="mt-1 text-emerald-600" /><div className="min-w-0 flex-1"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase text-emerald-800">Pergunta {index + 1} de {questions.length}</span><h3 className="mt-3 text-xl font-black sm:text-2xl">{question[2]}</h3><div className="mt-6"><Question id={question[0]} {...{ images, property, generation, cta, includePhone, phone, inputRef, message, status, addImages, move, remove, next, setPropertyField, setGenerationField, toggleHighlight, setCta, setIncludePhone, createTour }} /></div></div></div></div>
        <aside className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 lg:sticky lg:top-6 lg:self-start"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Resumo da apresentação</p><div className="mt-4 space-y-2">{summary.map((value, itemIndex) => <div key={`${value}-${itemIndex}`} className="flex gap-2 text-sm font-bold text-slate-700"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />{value}</div>)}</div></aside></div></section></main></>
}

function SmartTourShowcase() {
  const [activeIndex, setActiveIndex] = useState(null)
  const activeExample = activeIndex === null ? null : SMART_TOUR_EXAMPLES[activeIndex]
  const close = () => setActiveIndex(null)
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
            <button type="button" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fechar demonstração">
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
  const { id, images, property, generation, cta, includePhone, phone, inputRef, message, status, addImages, move, remove, next, setPropertyField, setGenerationField, toggleHighlight, setCta, setIncludePhone, createTour } = props
  const choices = (items, value, select) => <div className="grid gap-3 sm:grid-cols-2">{items.map(raw => { const item = typeof raw === 'string' ? { id: raw, label: raw } : raw; return <button key={item.id} type="button" onClick={() => select(item.id)} className={`rounded-2xl border p-4 text-left ${value === item.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}><b className="text-sm">{item.label}</b>{item.description && <span className="mt-1 block text-xs text-slate-500">{item.description}</span>}</button>})}</div>
  const cont = disabled => <Button type="button" disabled={disabled} onClick={next} className="mt-5">Continuar</Button>
  if (id === 'images') return <><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png" hidden onChange={event => { addImages(event.target.files); event.target.value = '' }} /><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-32 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/50"><UploadCloud className="text-emerald-600" /><b className="mt-2 text-sm">Selecionar fotos</b><span className="text-xs text-slate-500">JPG ou PNG · até 15 MB</span></button><p className="mt-3 text-xs font-bold">{images.length} de 6 imagens</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{images.map((item, position) => <div key={item.key} className="flex items-center gap-2 rounded-xl border p-2"><img src={item.preview} className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{position + 1}. {item.file.name}</span>{[-1,1].map(offset => <button key={offset} type="button" disabled={position + offset < 0 || position + offset >= images.length} onClick={() => move(position, offset)}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}<button type="button" onClick={() => remove(position)}><Trash2 className="h-4 w-4" /></button></div>)}</div>{message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}{images.length > 0 && cont(false)}</>
  if (id === 'purpose') return choices([{id:'sale',label:'Venda'},{id:'rent',label:'Locação'}], property.purpose, value => { setPropertyField('purpose', value); next() })
  if (id === 'stage') return choices(STAGES, property.stage, value => { setPropertyField('stage', value); next() })
  if (id === 'type') return <>{choices(TYPES, property.type, value => setPropertyField('type', value))}{cont(!property.type)}</>
  if (id === 'facts') return <><div className="grid gap-3 sm:grid-cols-2">{[['bedrooms','Dormitórios'],['suites','Suítes'],['parkingSpaces','Vagas'],['area','Área em m²']].map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field,event.target.value.replace(/\D/g,'').slice(0,6))} className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(!property.area)}</>
  if (id === 'location') return <div className="space-y-3"><SmartCarouselStateSelect value={property.state} onChange={value => { setPropertyField('state',value); setPropertyField('city','') }} />{property.state && <SmartCarouselCitySelect uf={property.state} value={property.city} onChange={value => setPropertyField('city',value)} />}<input value={property.district} onChange={event => setPropertyField('district',event.target.value)} placeholder="Bairro" className="w-full rounded-xl border p-3" />{cont(!property.state || !property.city || !property.district.trim())}</div>
  if (id === 'commercial') return <><div className="grid gap-3 sm:grid-cols-3">{[['price','Preço'],['condominium','Condomínio'],['iptu','IPTU']].map(([field,label]) => <label key={field} className="text-xs font-black">{label}<input value={property[field]} onChange={event => setPropertyField(field,event.target.value.slice(0,40))} placeholder="Opcional" className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>{cont(false)}</>
  if (id === 'highlights') return <><div className="flex flex-wrap gap-2">{HIGHLIGHTS.map(item => <button key={item} type="button" onClick={() => toggleHighlight(item)} className={`rounded-full border px-3 py-2 text-xs font-bold ${property.highlights.includes(item) ? 'border-emerald-400 bg-emerald-50' : ''}`}>{item}</button>)}</div>{cont(false)}</>
  if (id === 'description') return <><textarea rows="5" value={property.description} onChange={event => setPropertyField('description',event.target.value.slice(0,1000))} placeholder="Opcional. Use somente informações reais." className="w-full rounded-xl border p-3" />{cont(false)}</>
  if (id === 'mode') return choices(SMART_TOUR_MODES, generation.mode, value => { setGenerationField('mode',value); setTimeout(next,0) })
  if (id === 'presenter') return choices([{id:'female',label:'Corretora'},{id:'male',label:'Corretor'}], generation.presenterGender, value => { setGenerationField('presenterGender',value); next() })
  if (id === 'furniture') return choices([{id:'original',label:'Manter original'},{id:'virtual_staging',label:'Mobiliar com IA'}], generation.furniture, value => { setGenerationField('furniture',value); setTimeout(next,0) })
  if (id === 'staging') return choices([{id:'final_only',label:'Apenas mobiliado'},{id:'before_after',label:'Antes e depois'}], generation.stagingPresentation, value => { setGenerationField('stagingPresentation',value); next() })
  if (id === 'narration' || id === 'captions') return choices([{id:'enabled',label:'Sim'},{id:'disabled',label:'Não'}], generation[id], value => { setGenerationField(id,value); next() })
  if (id === 'language') return choices(SMART_TOUR_LANGUAGES, generation.language, value => { setGenerationField('language',value); next() })
  if (id === 'cta') return choices(CTAS, cta, value => { setCta(value); next() })
  if (id === 'phone') return choices([{id:'yes',label:'Sim',description:phone || 'Cadastre o telefone no Perfil Profissional.'},{id:'no',label:'Não'}], includePhone === true ? 'yes' : includePhone === false ? 'no' : '', value => { if (value === 'yes' && !phone) return; setIncludePhone(value === 'yes'); next() })
  return <><div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold">Usaremos todas as {images.length} imagens, exatamente na ordem escolhida. Nenhuma informação ausente será inventada.</div>{message && <div className="mt-4 flex gap-3 rounded-2xl border p-4">{['uploading','generating'].includes(status) && <Loader2 className="animate-spin text-emerald-600" />}<b className="text-sm">{message}</b></div>}<Button type="button" disabled={['uploading','generating'].includes(status)} onClick={createTour} className="mt-5 w-full"><Video className="mr-2 h-4 w-4" />{status === 'error' ? 'Tentar novamente' : 'Criar apresentação'}</Button></>
}

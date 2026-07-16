import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImagePlus,
  MessageSquareText,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import { Button } from '../components/ui/Button'

const SMART_CAROUSEL_MAX_FILE_BYTES = 15 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const TYPEWRITER_INITIAL_DELAY_MS = 350
const TYPEWRITER_CHAR_DELAY_MS = 30
const TYPEWRITER_FINAL_CURSOR_MS = 400

const SMART_CAROUSEL_PROPERTY_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Sobrado', 'Terreno / Lote']
const SMART_CAROUSEL_STATE_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]
const SMART_CAROUSEL_CTA_OPTIONS = [
  'Saiba Mais',
  'Agende sua visita',
  'Entre em contato agora',
  'Aguardo seu contato',
]
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

export default function SmartCarrossel() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const photoInputRef = useRef(null)
  const photoIdRef = useRef(0)
  const photosRef = useRef([])
  const [photos, setPhotos] = useState([])
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
  }, [])

  const addPhotos = (fileList) => {
    const selectedFiles = Array.from(fileList || []).filter((file) => (
      SUPPORTED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= SMART_CAROUSEL_MAX_FILE_BYTES
    ))
    if (!selectedFiles.length) return

    setPhotos((current) => {
      const existingFiles = new Set(current.map(({ file }) => `${file.name}-${file.size}-${file.lastModified}`))
      const newPhotos = selectedFiles
        .filter((file) => !existingFiles.has(`${file.name}-${file.size}-${file.lastModified}`))
        .map((file) => ({
          id: `smart-carousel-photo-${photoIdRef.current += 1}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }))

      return [...current, ...newPhotos]
    })
  }

  const handlePhotoInput = (event) => {
    addPhotos(event.target.files)
    event.target.value = ''
  }

  const removePhoto = (photoId) => {
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

  const currentStep = photos.length > 0 ? 2 : 1

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_38%,#eef7fb_100%)] px-4 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(115deg,#f0fdf8_0%,#f8fffc_54%,#ecfdf5_100%)] p-5 shadow-[0_24px_70px_-40px_rgba(6,78,59,0.35)] sm:rounded-[2rem] sm:p-8 lg:p-10">
          <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-100/40 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700"><Sparkles className="h-4 w-4" />Smart Carrossel</div>
              <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.45rem]">Smart Carrossel</h1>
              <p className="mt-3 text-lg font-black text-emerald-700 sm:text-xl">Apresentação Profissional</p>
              <p className="mt-5 max-w-lg text-base font-semibold leading-7 text-slate-600">Transforme as fotos do seu imóvel em uma apresentação elegante, dinâmica e pronta para divulgação.</p>
              <button type="button" onClick={() => navigate('/studio-hero')} className="mt-6 w-fit rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-black text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700">Escolher outro tipo de criação</button>
            </div>

            <div className="relative mx-auto w-full max-w-xl py-5 lg:py-2" aria-hidden="true">
              <div className="absolute inset-y-10 right-0 w-[82%] translate-x-3 rotate-2 rounded-3xl bg-emerald-200/40 shadow-xl" />
              <div className="absolute inset-y-7 right-[5%] w-[84%] translate-x-1 rotate-1 overflow-hidden rounded-3xl border-4 border-white/70 opacity-55 shadow-xl"><img src="/banners-rapidos/hero-imovel.jpg" alt="" className="h-full w-full object-cover" /></div>
              <div className="relative mr-[10%] min-h-[245px] overflow-hidden rounded-[1.6rem] border-4 border-white bg-slate-950 shadow-[0_28px_55px_-24px_rgba(15,23,42,0.6)] sm:min-h-[300px]">
                <img src="/banners-rapidos/hero-imovel.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/25 to-transparent" />
                <div className="absolute inset-y-0 left-0 flex w-[64%] flex-col justify-center p-5 text-white sm:p-8"><span className="w-fit rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-black tracking-wide">1 / 8</span><p className="mt-5 text-2xl font-black leading-none tracking-tight sm:text-4xl">Seu imóvel<br />em <span className="text-emerald-300">destaque</span></p><p className="mt-3 text-xs font-bold text-white/80 sm:text-sm">Uma apresentação que valoriza cada detalhe.</p></div>
                <div className="absolute left-[60%] top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/55 text-white shadow-2xl backdrop-blur sm:h-20 sm:w-20"><PlayCircle className="h-9 w-9 fill-white/15 sm:h-11 sm:w-11" /></div>
                <div className="absolute bottom-4 right-5 flex gap-1.5"><span className="h-2 w-5 rounded-full bg-emerald-400" /><span className="h-2 w-2 rounded-full bg-white/55" /><span className="h-2 w-2 rounded-full bg-white/35" /></div>
              </div>
            </div>
          </div>

          <nav className="relative mt-8 overflow-x-auto rounded-2xl border border-emerald-100/80 bg-white/90 p-2 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] backdrop-blur" aria-label="Etapas do Smart Carrossel">
            <ol className="grid min-w-[650px] grid-cols-4 gap-2 sm:min-w-0">
              {[
                { number: 1, title: 'Fotos', subtitle: 'Selecione e organize' },
                { number: 2, title: 'Informações', subtitle: 'Preencha os dados' },
                { number: 3, title: 'Criar apresentação', subtitle: 'Prepare sua apresentação' },
                { number: 4, title: 'Preview', subtitle: 'Confira o resultado' },
              ].map((item) => {
                const active = item.number === currentStep
                const completed = item.number < currentStep
                return <li key={item.number} className={`rounded-xl px-3 py-3 transition sm:px-4 ${active ? 'bg-white text-emerald-800 shadow-md ring-1 ring-emerald-100' : completed ? 'bg-emerald-50/80 text-emerald-800' : 'text-slate-500'}`}><div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.number}</span><div className="min-w-0"><p className="text-xs font-black text-slate-900 sm:text-sm">{item.title}</p><p className="mt-0.5 hidden text-[11px] font-semibold text-slate-400 sm:block">{item.subtitle}</p></div></div></li>
              })}
            </ol>
          </nav>
        </section>

        <PhotoSection photos={photos} inputRef={photoInputRef} isDragActive={isDragActive} setIsDragActive={setIsDragActive} addPhotos={addPhotos} handlePhotoInput={handlePhotoInput} removePhoto={removePhoto} clearPhotos={clearPhotos} movePhoto={movePhoto} />
        {photos.length > 0 && <SmartCarouselConversation user={user} />}
      </div>
    </main>
  )
}

function PhotoSection({ photos, inputRef, isDragActive, setIsDragActive, addPhotos, handlePhotoInput, removePhoto, clearPhotos, movePhoto }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] sm:rounded-[2rem]">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><ImagePlus className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Etapa 1</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">1. Selecione e organize suas fotos</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Adicione as fotos do imóvel e organize na ordem desejada para a apresentação.</p></div></div><div className="grid gap-2 sm:grid-cols-2"><div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm font-bold leading-5 text-slate-700"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><span>A primeira foto será a <strong className="font-black text-emerald-700">CAPA</strong></span></div><div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm font-bold leading-5 text-slate-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg font-black text-emerald-600">↔</span><span>Você pode alterar a ordem a qualquer momento</span></div></div></div></div>
      <div className="p-5 sm:p-8">
        {photos.length > 0 && <div className="mb-5 w-fit rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">{photos.length} {photos.length === 1 ? 'foto selecionada' : 'fotos selecionadas'}</div>}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple onChange={handlePhotoInput} className="sr-only" />
        {photos.length === 0 ? (
          <div onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragActive(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragActive(false)} onDrop={(event) => { event.preventDefault(); setIsDragActive(false); addPhotos(event.dataTransfer.files) }} className={`group mt-7 flex min-h-[310px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-5 py-10 text-center outline-none transition sm:min-h-[340px] sm:px-8 ${isDragActive ? 'border-emerald-500 bg-emerald-100/70 shadow-inner' : 'border-emerald-200 bg-[linear-gradient(145deg,rgba(236,253,245,0.82),rgba(248,250,252,0.9))] hover:border-emerald-400 hover:bg-emerald-50/80 focus:ring-4 focus:ring-emerald-100'}`}>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-100 bg-white text-emerald-700 shadow-[0_18px_40px_-24px_rgba(5,150,105,0.8)] transition group-hover:-translate-y-1 group-hover:shadow-[0_22px_45px_-22px_rgba(5,150,105,0.85)]"><ImageIcon className="h-8 w-8" /><span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white ring-4 ring-emerald-50"><UploadCloud className="h-4 w-4" /></span></div>
            <p className="mt-7 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Arraste suas fotos aqui</p><p className="mt-2 text-sm font-semibold text-slate-500 sm:text-base">ou escolha as imagens do imóvel</p>
            <button type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click() }} className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_-18px_rgba(5,150,105,0.95)] transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100">Selecionar fotos</button>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">JPG ou PNG · seleção múltipla</p>
          </div>
        ) : (
          <div className="mt-7">
            <div className="mb-5 rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.9),rgba(248,250,252,0.96))] p-4 shadow-[0_14px_30px_-28px_rgba(5,150,105,0.65)] sm:p-5"><div className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700 shadow-sm">↔ Ordem editável</div><h3 className="mt-3 text-lg font-black tracking-tight text-slate-950 sm:text-xl">Organize sua apresentação</h3><p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">A apresentação será criada exatamente na ordem das fotos exibidas abaixo. Use as setas para reorganizar as imagens sempre que desejar. A primeira foto será utilizada como capa.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo, index) => (
                <article key={photo.id} className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_34px_-25px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_24px_44px_-24px_rgba(5,150,105,0.35)]">
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100"><img src={photo.previewUrl} alt={`Foto ${index + 1} da apresentação`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /><div className="absolute left-2.5 top-2.5 flex items-center gap-1.5"><span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-black text-white shadow-lg backdrop-blur ${index === 0 ? 'bg-emerald-600' : 'bg-slate-950/80'}`}>{index + 1}</span>{index === 0 && <span className="rounded-xl bg-emerald-600 px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">Capa</span>}</div><button type="button" onClick={() => removePhoto(photo.id)} aria-label={`Remover foto ${index + 1}`} title="Remover foto" className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-500 opacity-85 shadow-lg backdrop-blur transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-rose-300"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="p-2.5"><p className="truncate text-xs font-bold text-slate-500" title={photo.file.name}>{photo.file.name}</p>{photos.length > 1 && <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200/80"><button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`Mover foto ${index + 1} para a esquerda`} title="Mover para a esquerda" className="flex h-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-emerald-700 hover:shadow-sm disabled:cursor-not-allowed disabled:text-slate-300"><ChevronLeft className="h-4 w-4" /></button><span className="px-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Mover</span><button type="button" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label={`Mover foto ${index + 1} para a direita`} title="Mover para a direita" className="flex h-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-emerald-700 hover:shadow-sm disabled:cursor-not-allowed disabled:text-slate-300"><ChevronRight className="h-4 w-4" /></button></div>}</div>
                </article>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"><Plus className="h-4 w-4" />Adicionar mais fotos</button><button type="button" onClick={clearPhotos} className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-100"><Trash2 className="h-4 w-4" />Limpar seleção</button></div>
          </div>
        )}
      </div>
    </section>
  )
}

function SmartCarouselConversation({ user }) {
  const [step, setStep] = useState(1)
  const [purpose, setPurpose] = useState('')
  const [propertyStage, setPropertyStage] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [suites, setSuites] = useState('')
  const [parkingSpaces, setParkingSpaces] = useState('')
  const [uf, setUf] = useState('')
  const [cities, setCities] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [priceMode, setPriceMode] = useState('')
  const [priceDigits, setPriceDigits] = useState('')
  const [area, setArea] = useState('')
  const [highlights, setHighlights] = useState([])
  const [cta, setCta] = useState('')
  const [sharePhone, setSharePhone] = useState('')

  const profilePhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const formatPrice = (digits) => digits ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(digits)) : ''
  const priceLabel = priceDigits ? `${priceMode === 'starting_at' ? 'A partir de ' : ''}${formatPrice(priceDigits)}` : ''
  const stageOptions = purpose === 'rent' ? ['Pronto para mudar'] : ['Pronto para morar', 'Lançamento', 'Em construção']
  const numberOptions = ['0', '1', '2', '3', '4', '5+']

  useEffect(() => {
    if (!uf) { setCities([]); setCitiesLoading(false); return undefined }
    const controller = new AbortController()
    setCitiesLoading(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal })
      .then((response) => response.json())
      .then((items) => setCities(Array.isArray(items) ? items.map((item) => item?.nome).filter(Boolean) : []))
      .catch((error) => { if (error?.name !== 'AbortError') setCities([]) })
      .finally(() => { if (!controller.signal.aborted) setCitiesLoading(false) })
    return () => controller.abort()
  }, [uf])

  const choose = (setter, value, nextStep) => { setter(value); setStep(nextStep) }
  const toggleHighlight = (item) => setHighlights((current) => current.includes(item) ? current.filter((value) => value !== item) : current.length >= 20 ? current : [...current, item])
  const messages = ['', 'Vamos começar. Qual é a finalidade do imóvel?', 'Perfeito. Qual é o estado atual do imóvel?', 'Ótimo. Que tipo de imóvel será apresentado?', 'Excelente. Quantos dormitórios o imóvel possui?', 'Perfeito. Quantas suítes?', 'Ótimo. Quantas vagas estão disponíveis?', 'Excelente. Em qual estado fica o imóvel?', 'Perfeito. Agora escolha a cidade.', 'Ótimo. Em qual bairro ele está localizado?', 'Excelente. Como deseja apresentar o preço?', 'Perfeito. Qual é a área do imóvel?', 'Ótimo. Quais são os principais destaques?', 'Excelente. Qual chamada deseja usar no final?', 'Perfeito. Deseja divulgar seu telefone profissional?', 'Excelente. Sua apresentação está pronta para a próxima etapa.']
  const summaryItems = [[1, purpose === 'sale' ? 'Venda' : purpose === 'rent' ? 'Locação' : ''], [2, propertyStage], [3, propertyType], [4, bedrooms ? `${bedrooms} dormitório${bedrooms === '1' ? '' : 's'}` : ''], [5, suites ? `${suites} suíte${suites === '1' ? '' : 's'}` : ''], [6, parkingSpaces ? `${parkingSpaces} vaga${parkingSpaces === '1' ? '' : 's'}` : ''], [7, uf], [8, city], [9, district], [10, priceLabel], [11, area ? `${area} m²` : ''], [12, highlights.length ? `${highlights.length} destaques` : ''], [13, cta], [14, sharePhone === 'yes' ? 'Telefone profissional' : sharePhone === 'no' ? 'Sem telefone' : '']].filter(([, value]) => Boolean(value))

  let questionContent = null
  if (step === 1) questionContent = <OptionGrid><ChoiceButton active={purpose === 'sale'} title="🏡 Venda" description="Apresentação para comercialização do imóvel." onClick={() => choose(setPurpose, 'sale', 2)} /><ChoiceButton active={purpose === 'rent'} title="🔑 Locação" description="Apresentação para encontrar o locatário ideal." onClick={() => choose(setPurpose, 'rent', 2)} /></OptionGrid>
  else if (step === 2) questionContent = <ChipGrid>{stageOptions.map((item) => <ChipButton key={item} active={propertyStage === item} onClick={() => choose(setPropertyStage, item, 3)}>{item}</ChipButton>)}</ChipGrid>
  else if (step === 3) questionContent = <ChipGrid>{SMART_CAROUSEL_PROPERTY_TYPES.map((item) => <ChipButton key={item} active={propertyType === item} onClick={() => choose(setPropertyType, item, 4)}>{item}</ChipButton>)}</ChipGrid>
  else if ([4, 5, 6].includes(step)) { const value = step === 4 ? bedrooms : step === 5 ? suites : parkingSpaces; const setter = step === 4 ? setBedrooms : step === 5 ? setSuites : setParkingSpaces; questionContent = <ChipGrid>{numberOptions.map((item) => <ChipButton key={item} active={value === item} onClick={() => choose(setter, item, step + 1)}>{item}</ChipButton>)}</ChipGrid> }
  else if (step === 7) questionContent = <select value={uf} onChange={(event) => { setUf(event.target.value); setCity(''); if (event.target.value) setStep(8) }} className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"><option value="">Selecione o estado</option>{SMART_CAROUSEL_STATE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
  else if (step === 8) questionContent = <select value={city} disabled={!uf || citiesLoading} onChange={(event) => { setCity(event.target.value); if (event.target.value) setStep(9) }} className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"><option value="">{citiesLoading ? 'Carregando cidades...' : 'Selecione a cidade'}</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
  else if (step === 9) questionContent = <div><input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="Digite o bairro" className="w-full rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><Button type="button" disabled={!district.trim()} onClick={() => setStep(10)} className="mt-4">Continuar</Button></div>
  else if (step === 10) questionContent = <div><ChipGrid><ChipButton active={priceMode === 'fixed'} onClick={() => setPriceMode('fixed')}>Preço fixo</ChipButton><ChipButton active={priceMode === 'starting_at'} onClick={() => setPriceMode('starting_at')}>A partir de</ChipButton></ChipGrid><input value={formatPrice(priceDigits)} onChange={(event) => setPriceDigits(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" placeholder="R$ 0" className="mt-4 w-full rounded-2xl border border-emerald-100 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><Button type="button" disabled={!priceMode || !priceDigits} onClick={() => setStep(11)} className="mt-4">Continuar</Button></div>
  else if (step === 11) questionContent = <div><div className="relative"><input value={area} onChange={(event) => setArea(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Ex: 120" className="w-full rounded-2xl border border-emerald-100 px-4 py-3 pr-14 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">m²</span></div><Button type="button" disabled={!area} onClick={() => setStep(12)} className="mt-4">Continuar</Button></div>
  else if (step === 12) questionContent = <div className="space-y-4">{SMART_CAROUSEL_HIGHLIGHT_GROUPS.map((group) => <div key={group.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{group.title}</p><div className="flex flex-wrap gap-2">{group.items.map((item) => <ChipButton key={item} active={highlights.includes(item)} onClick={() => toggleHighlight(item)}>{item}</ChipButton>)}</div></div>)}<div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{highlights.length}/20 selecionados</span><Button type="button" disabled={!highlights.length} onClick={() => setStep(13)}>Continuar</Button></div></div>
  else if (step === 13) questionContent = <ChipGrid>{SMART_CAROUSEL_CTA_OPTIONS.map((item) => <ChipButton key={item} active={cta === item} onClick={() => choose(setCta, item, 14)}>{item}</ChipButton>)}</ChipGrid>
  else if (step === 14) questionContent = <div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={!profilePhone} onClick={() => choose(setSharePhone, 'yes', 15)} className="rounded-2xl border border-emerald-100 bg-white p-4 text-left hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"><span className="text-sm font-black text-slate-950">Sim</span><span className="mt-1 block text-xs font-semibold text-slate-500">{profilePhone || 'Cadastre um telefone no Perfil Profissional.'}</span></button><button type="button" onClick={() => choose(setSharePhone, 'no', 15)} className="rounded-2xl border border-emerald-100 bg-white p-4 text-left hover:border-emerald-300"><span className="text-sm font-black text-slate-950">Não</span><span className="mt-1 block text-xs font-semibold text-slate-500">Continuar sem divulgar telefone.</span></button></div>
  else questionContent = <div className="text-center"><button type="button" disabled aria-disabled="true" className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-5 text-lg font-black text-white opacity-55 shadow-[0_20px_38px_-20px_rgba(5,150,105,0.95)]"><Sparkles className="h-5 w-5" />Criar apresentação</button><p className="mt-3 text-xs font-semibold text-slate-500">Geração será conectada na próxima etapa.</p></div>

  return <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] sm:rounded-[2rem]"><div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><MessageSquareText className="h-5 w-5" /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Etapa 2</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Converse com a IA</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Uma pergunta por vez para construir sua apresentação.</p></div></div></div><div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-8"><SmartCarouselAssistantCard step={step} message={messages[step]}>{questionContent}</SmartCarouselAssistantCard><aside className="rounded-3xl border border-emerald-100 bg-[linear-gradient(145deg,#f0fdf4,#ffffff)] p-5 lg:sticky lg:top-6 lg:self-start"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Resumo da apresentação</p>{summaryItems.length ? <div className="mt-4 space-y-2">{summaryItems.map(([itemStep, value]) => <button key={itemStep} type="button" onClick={() => setStep(itemStep)} className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{value}</span></button>)}</div> : <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">Suas escolhas aparecerão aqui durante a conversa.</p>}</aside></div></section>
}

function SmartCarouselAssistantCard({ step, message, children }) {
  return <div className="rounded-3xl border border-emerald-100 bg-[linear-gradient(145deg,#ffffff,#f8fffb)] p-5 shadow-sm sm:p-6"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-800">{step < 15 ? `Pergunta ${step} de 14` : 'Resumo concluído'}</span><h3 className="mt-3 text-xl font-black leading-tight text-slate-950 sm:text-2xl"><TypewriterText text={message} active /></h3><div className="mt-6">{children}</div></div></div></div>
}

function OptionGrid({ children, className = '' }) { return <div className={`grid gap-3 md:grid-cols-2 ${className}`}>{children}</div> }
function ChipGrid({ children, className = '' }) { return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div> }
function ChoiceButton({ active, title, description, onClick }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition ${active ? 'border-cyan-700 bg-primary-950 text-white shadow-lg shadow-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'}`}><p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p><p className={`mt-2 text-xs leading-relaxed ${active ? 'text-slate-200' : 'text-slate-500'}`}>{description}</p></button> }
function ChipButton({ active, disabled = false, children, onClick }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-full border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'border-cyan-700 bg-primary-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50'}`}>{children}</button> }

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

  return <>{visibleText}{showCursor && <span className="ml-1 inline-block h-5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-cyan-700" />}</>
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Download,
  Image,
  Layers3,
  MapPin,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { useProperties } from '../hooks/useProperties'
import { formatArea, formatCurrency } from '../utils/formatters'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'
const MIN_HERO_PHOTOS = 3

const heroStyles = [
  {
    id: 'premium-impact',
    title: 'Impacto premium',
    description: 'Imagem principal forte, com foco em percepção de valor e apresentação sofisticada.',
  },
  {
    id: 'clean-real-estate',
    title: 'Imobiliário limpo',
    description: 'Visual claro, elegante e direto para destacar o imóvel sem excesso de informação.',
  },
  {
    id: 'warm-inviting',
    title: 'Acolhedor',
    description: 'Direção visual mais humana, ideal para imóveis residenciais e comunicação próxima.',
  },
]

const parseMasterProperty = (description = '') => {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return null

  try {
    return JSON.parse(raw.slice(markerIndex + MASTER_MARKER.length).trim())
  } catch {
    return null
  }
}

const getPhotoList = (property) => {
  const master = parseMasterProperty(property?.descricao)
  const masterPhotos = Array.isArray(master?.fotos_imovel) ? master.fotos_imovel : []
  const propertyPhotos = Array.isArray(property?.fotos) ? property.fotos : []
  return propertyPhotos.length > 0 ? propertyPhotos : masterPhotos
}

const getHighlights = (property) => {
  const master = parseMasterProperty(property?.descricao)
  if (Array.isArray(master?.destaques_selecionados)) return master.destaques_selecionados
  if (Array.isArray(master?.destaques)) return master.destaques
  return []
}

const getProfileStatus = (user) => {
  const requiredFields = [
    user?.nome || user?.displayName,
    user?.whatsapp,
    user?.email,
    user?.creci,
  ]
  const completed = requiredFields.filter(Boolean).length
  return {
    completed,
    total: requiredFields.length,
    complete: completed === requiredFields.length,
  }
}

const getBrandStatus = (user) => ({
  hasBrandName: Boolean(user?.imobiliaria),
  hasLogo: Boolean(user?.logo_url),
})

export default function Hero() {
  const { user } = useAuth()
  const { properties, loading } = useProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [selectedStyleId, setSelectedStyleId] = useState(heroStyles[0].id)
  const [orientation, setOrientation] = useState('')
  const [resultVisible, setResultVisible] = useState(false)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  )
  const selectedPhotos = getPhotoList(selectedProperty)
  const selectedHighlights = getHighlights(selectedProperty)
  const selectedStyle = heroStyles.find((style) => style.id === selectedStyleId) || heroStyles[0]
  const profileStatus = getProfileStatus(user)
  const brandStatus = getBrandStatus(user)
  const canPrepareHero = Boolean(selectedProperty && selectedPhotos.length >= MIN_HERO_PHOTOS)

  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      setSelectedPropertyId(properties[0].id)
    }
  }, [properties, selectedPropertyId])

  const handlePrepare = () => {
    if (!canPrepareHero) return
    setResultVisible(true)
  }

  return (
    <div>
      <Header title="Hero IA" subtitle="Crie uma imagem premium de impacto para divulgar seu imóvel." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à Home
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl bg-gray-950 p-6 text-white shadow-xl shadow-gray-950/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Produto premium visual
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Hero IA
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300">
                Selecione um imóvel do Cadastro Mestre, confira as fotos e prepare uma imagem de impacto para abrir sua divulgação.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-gray-300">Prévia estrutural</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-200">
                O fluxo visual está pronto. A geração real será conectada apenas por uma etapa segura.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : properties.length === 0 ? (
          <EmptyPropertyState />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <SectionCard
                icon={Building2}
                eyebrow="Cadastro Mestre"
                title="Escolha o imóvel"
                description="A Hero IA usa os dados e fotos já cadastrados. Nenhum dado será inventado."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {properties.map((property) => {
                    const photos = getPhotoList(property)
                    const active = selectedPropertyId === property.id
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => {
                          setSelectedPropertyId(property.id)
                          setResultVisible(false)
                        }}
                        className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
                          active ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="aspect-[4/3] bg-gray-100">
                          {photos[0] ? (
                            <img src={photos[0]} alt={property.titulo || 'Imóvel'} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center text-gray-400">
                              <Image className="h-8 w-8" />
                              <span className="mt-2 text-xs font-bold">Sem foto</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-950">{property.titulo || `${property.tipo} em ${property.bairro}`}</p>
                              <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {property.bairro}, {property.cidade}
                              </p>
                            </div>
                            {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />}
                          </div>
                          <p className="mt-3 text-xs font-bold text-gray-500">{photos.length} foto{photos.length === 1 ? '' : 's'} disponível{photos.length === 1 ? '' : 'is'}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </SectionCard>

              {selectedProperty && (
                <>
                  <SectionCard
                    icon={Layers3}
                    eyebrow="Resumo"
                    title="Dados que serão usados"
                    description="A imagem premium será preparada a partir dos dados reais do imóvel selecionado."
                  >
                    <PropertySummary property={selectedProperty} highlights={selectedHighlights} />
                  </SectionCard>

                  <SectionCard
                    icon={Image}
                    eyebrow="Fotos"
                    title="Fotos disponíveis"
                    description={`Use pelo menos ${MIN_HERO_PHOTOS} fotos para orientar melhor a composição visual.`}
                  >
                    {selectedPhotos.length < MIN_HERO_PHOTOS && (
                      <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                        Este imóvel tem menos de {MIN_HERO_PHOTOS} fotos. Adicione mais fotos no Cadastro Mestre antes de gerar.
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {selectedPhotos.slice(0, 5).map((photo, index) => (
                        <div key={`${photo}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                          {index === 0 && (
                            <span className="absolute bottom-1 left-1 rounded bg-gray-950 px-2 py-1 text-[10px] font-black text-white">
                              Principal
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Palette}
                    eyebrow="Direção visual"
                    title="Perfil visual recomendado"
                    description="Escolha a direção visual. A marca e o perfil comercial serão usados apenas quando estiverem disponíveis."
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      {heroStyles.map((style) => {
                        const active = selectedStyleId === style.id
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => {
                              setSelectedStyleId(style.id)
                              setResultVisible(false)
                            }}
                            className={`rounded-2xl border p-4 text-left transition ${
                              active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white hover:border-gray-400'
                            }`}
                          >
                            <p className={`text-sm font-black ${active ? 'text-white' : 'text-gray-950'}`}>{style.title}</p>
                            <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-gray-300' : 'text-gray-500'}`}>{style.description}</p>
                          </button>
                        )
                      })}
                    </div>

                    <label className="mt-5 block">
                      <span className="text-sm font-black text-gray-950">Orientação opcional</span>
                      <textarea
                        value={orientation}
                        onChange={(event) => setOrientation(event.target.value.slice(0, 400))}
                        rows={4}
                        placeholder="Ex: valorizar varanda gourmet, deixar visual mais sofisticado, priorizar sala integrada..."
                        className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                      <span className="mt-1 block text-right text-xs font-semibold text-gray-400">{orientation.length}/400</span>
                    </label>
                  </SectionCard>
                </>
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <ReadinessCard
                selectedProperty={selectedProperty}
                photoCount={selectedPhotos.length}
                profileStatus={profileStatus}
                brandStatus={brandStatus}
              />

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Ação</p>
                <h2 className="mt-1 text-lg font-black text-gray-950">Gerar Hero IA</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  Nesta etapa, o botão prepara a área de resultado. A geração real será conectada depois em ambiente seguro.
                </p>
                <Button
                  type="button"
                  onClick={handlePrepare}
                  disabled={!canPrepareHero}
                  className="mt-4 w-full justify-center"
                >
                  <Wand2 className="h-4 w-4" />
                  Gerar Hero IA
                </Button>
                {!canPrepareHero && (
                  <p className="mt-3 text-xs font-semibold leading-relaxed text-amber-700">
                    Selecione um imóvel com pelo menos {MIN_HERO_PHOTOS} fotos para continuar.
                  </p>
                )}
              </section>

              <ResultPanel visible={resultVisible} property={selectedProperty} style={selectedStyle} />
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function SectionCard({ icon: Icon, eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-amber-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black text-gray-950">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function PropertySummary({ property, highlights }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem label="Tipo" value={property.tipo || 'Não informado'} />
        <SummaryItem label="Localização" value={[property.bairro, property.cidade].filter(Boolean).join(', ') || 'Não informada'} />
        <SummaryItem label="Preço" value={property.preco ? formatCurrency(property.preco) : 'Consulte'} />
        <SummaryItem label="Área" value={property.area ? formatArea(property.area) : 'Não informada'} />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-gray-500">Destaques</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {highlights.length > 0 ? highlights.slice(0, 8).map((item) => (
            <span key={item} className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
              {item}
            </span>
          )) : (
            <span className="text-sm font-semibold text-gray-400">Sem destaques cadastrados.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-black text-gray-950">{value}</p>
    </div>
  )
}

function ReadinessCard({ selectedProperty, photoCount, profileStatus, brandStatus }) {
  const items = [
    {
      label: 'Imóvel selecionado',
      ok: Boolean(selectedProperty),
      hint: selectedProperty ? selectedProperty.titulo || selectedProperty.tipo : 'Escolha um Cadastro Mestre.',
    },
    {
      label: 'Fotos do imóvel',
      ok: photoCount >= MIN_HERO_PHOTOS,
      hint: `${photoCount}/${MIN_HERO_PHOTOS} mínimas para gerar.`,
    },
    {
      label: 'Perfil Comercial',
      ok: profileStatus.complete,
      hint: profileStatus.complete ? 'Completo.' : `${profileStatus.completed}/${profileStatus.total} campos essenciais preenchidos.`,
      to: '/configuracoes?tab=perfil',
    },
    {
      label: 'Marca',
      ok: brandStatus.hasBrandName || brandStatus.hasLogo,
      hint: brandStatus.hasBrandName || brandStatus.hasLogo ? 'Marca disponível.' : 'Opcional, mas melhora consistência visual.',
      to: '/configuracoes?tab=perfil',
    },
  ]

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Prontidão</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">Checklist do Hero IA</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-gray-50 p-3">
            <div className="flex items-start gap-3">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-950">{item.label}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{item.hint}</p>
                {item.to && !item.ok && (
                  <Link to={item.to} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-800">
                    Completar perfil
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ResultPanel({ visible, property, style }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resultado</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">Preview principal</h2>
      <div className="mt-4 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
        <div className="flex aspect-[4/3] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm font-black text-gray-950">
            {visible ? 'Geração Hero IA em preparação' : 'O resultado aparecerá aqui'}
          </p>
          <p className="mt-2 max-w-xs text-xs font-semibold leading-relaxed text-gray-500">
            {visible
              ? `Fluxo preparado para ${property?.titulo || property?.tipo || 'o imóvel'} com direção "${style.title}".`
              : 'Nenhuma imagem real será simulada antes da conexão segura da geração.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Download className="h-4 w-4" />
          Baixar
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <RefreshCw className="h-4 w-4" />
          Gerar variação
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Layers3 className="h-4 w-4" />
          Criar campanha com esta imagem
        </button>
      </div>
    </section>
  )
}

function EmptyPropertyState() {
  return (
    <section className="mt-6 rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
        <Building2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-black text-gray-950">Comece cadastrando seu primeiro imóvel.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        A Hero IA precisa de um Cadastro Mestre com dados e pelo menos {MIN_HERO_PHOTOS} fotos para preparar a geração.
      </p>
      <Link
        to="/meus-imoveis"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800"
      >
        Abrir Cadastro Mestre
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

function LoadingState() {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-gray-100" />
    </div>
  )
}

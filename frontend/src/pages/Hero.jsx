import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Download,
  Image,
  Layers3,
  MapPin,
  MessageSquareText,
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

const IMAGE_MODES = [
  {
    id: 'main_photo',
    label: 'Usar foto principal',
    description: 'Parte da melhor imagem do imóvel para criar uma peça de impacto.',
  },
  {
    id: 'reference_photos',
    label: 'Usar fotos como referência',
    description: 'Considera o conjunto de fotos para orientar estilo, ambiente e diferenciais.',
  },
  {
    id: 'new_image',
    label: 'Criar imagem nova com IA',
    description: 'Cria uma composição nova a partir dos dados do imóvel e do objetivo comercial.',
  },
]

const AUDIENCES = [
  { id: 'primeiro_imovel', label: 'Primeiro imóvel' },
  { id: 'familia', label: 'Família' },
  { id: 'investidor', label: 'Investidor' },
  { id: 'executivo', label: 'Executivo' },
  { id: 'alto_padrao', label: 'Alto padrão' },
  { id: 'lancamento', label: 'Lançamento' },
  { id: 'pre_lancamento', label: 'Pré-lançamento' },
  { id: 'terreno', label: 'Terreno' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'locacao', label: 'Locação' },
]

const PROPERTY_STATES = [
  'Pronto para morar',
  'Em obras',
  'Reformado',
  'Novo',
  'Usado',
  'Lançamento',
  'Pré-lançamento',
]

const SUBCATEGORIES = {
  primeiro_imovel: ['FGTS', 'Subsídio', 'Entrada facilitada'],
  familia: ['Conforto', 'Lazer', 'Segurança'],
  investidor: ['Valorização', 'Rentabilidade', 'Escassez'],
  executivo: ['Localização', 'Conveniência', 'Exclusividade'],
  alto_padrao: ['Exclusividade', 'Acabamento', 'Privacidade'],
  lancamento: ['Oportunidade', 'Condições especiais', 'Novo empreendimento'],
  pre_lancamento: ['Antecipação', 'Reserva de unidade', 'Potencial de valorização'],
  terreno: ['Potencial construtivo', 'Localização', 'Investimento'],
  comercial: ['Fluxo', 'Visibilidade', 'Estrutura'],
  locacao: ['Praticidade', 'Localização', 'Agilidade'],
}

const DELIVERABLES = [
  { id: 'hero_image', label: 'Hero IA', locked: true },
  { id: 'instagram_text', label: 'Texto Instagram' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'cta', label: 'CTA' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'portal_description', label: 'Descrição Portal' },
]

const CREATIVE_DIRECTIONS = [
  {
    id: 'lifestyle',
    title: 'Lifestyle',
    description: 'Valoriza desejo de morar, rotina e percepção emocional.',
  },
  {
    id: 'investidor',
    title: 'Investidor',
    description: 'Foca em oportunidade, liquidez e potencial comercial sem promessas.',
  },
  {
    id: 'exclusividade',
    title: 'Exclusividade',
    description: 'Traz uma leitura mais sofisticada e aspiracional.',
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

const getPropertyState = (property) => {
  const master = parseMasterProperty(property?.descricao)
  return master?.estado_imovel || property?.estado_imovel || ''
}

const getPropertyTitle = (property) => {
  if (!property) return 'Imóvel'
  return property.titulo || [property.tipo, property.bairro].filter(Boolean).join(' em ') || 'Imóvel cadastrado'
}

const getLocation = (property) => [property?.bairro, property?.cidade].filter(Boolean).join(', ') || 'Localização não informada'

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

const buildInitialDeliverables = () => DELIVERABLES.reduce((acc, item) => {
  acc[item.id] = true
  return acc
}, {})

export default function Hero() {
  const { user } = useAuth()
  const { properties, loading } = useProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [imageModeId, setImageModeId] = useState('')
  const [propertyState, setPropertyState] = useState('')
  const [audienceId, setAudienceId] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [selectedHighlights, setSelectedHighlights] = useState([])
  const [highlightsConfirmed, setHighlightsConfirmed] = useState(false)
  const [deliverables, setDeliverables] = useState(buildInitialDeliverables)
  const [deliverablesConfirmed, setDeliverablesConfirmed] = useState(false)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [additionalConfirmed, setAdditionalConfirmed] = useState(false)
  const [resultVisible, setResultVisible] = useState(false)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  )
  const photos = getPhotoList(selectedProperty)
  const propertyHighlights = getHighlights(selectedProperty)
  const savedPropertyState = getPropertyState(selectedProperty)
  const profileStatus = getProfileStatus(user)
  const brandStatus = getBrandStatus(user)

  const imageMode = IMAGE_MODES.find((item) => item.id === imageModeId)
  const audience = AUDIENCES.find((item) => item.id === audienceId)
  const subcategories = SUBCATEGORIES[audienceId] || []
  const chosenDeliverables = DELIVERABLES.filter((item) => deliverables[item.id])

  const canShowImageMode = Boolean(selectedProperty)
  const canShowPropertyState = Boolean(imageModeId)
  const canShowAudience = Boolean(propertyState)
  const canShowSubcategory = Boolean(audienceId)
  const canShowHighlights = Boolean(subcategory)
  const canShowDeliverables = highlightsConfirmed
  const canShowAdditionalInfo = deliverablesConfirmed
  const canShowChecklist = additionalConfirmed
  const canGenerate = Boolean(
    selectedProperty
    && photos.length >= MIN_HERO_PHOTOS
    && imageModeId
    && propertyState
    && audienceId
    && subcategory
    && highlightsConfirmed
    && deliverablesConfirmed
    && additionalConfirmed,
  )

  useEffect(() => {
    setImageModeId('')
    setPropertyState(getPropertyState(selectedProperty))
    setAudienceId('')
    setSubcategory('')
    setSelectedHighlights([])
    setHighlightsConfirmed(false)
    setDeliverables(buildInitialDeliverables())
    setDeliverablesConfirmed(false)
    setAdditionalInfo('')
    setAdditionalConfirmed(false)
    setResultVisible(false)
  }, [selectedPropertyId])

  useEffect(() => {
    setSubcategory('')
    setSelectedHighlights([])
    setHighlightsConfirmed(false)
    setDeliverablesConfirmed(false)
    setAdditionalConfirmed(false)
    setResultVisible(false)
  }, [audienceId])

  const toggleHighlight = (highlight) => {
    setResultVisible(false)
    setHighlightsConfirmed(false)
    setSelectedHighlights((current) => (
      current.includes(highlight)
        ? current.filter((item) => item !== highlight)
        : [...current, highlight]
    ))
  }

  const toggleDeliverable = (deliverable) => {
    if (deliverable.locked) return
    setResultVisible(false)
    setDeliverablesConfirmed(false)
    setDeliverables((current) => ({
      ...current,
      [deliverable.id]: !current[deliverable.id],
    }))
  }

  const handleGenerate = () => {
    if (!canGenerate) return
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
                Smart Prompt Engine
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Hero IA
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300">
                Um assistente guiado monta o briefing visual do seu imóvel. Nesta etapa, nenhuma imagem real é gerada e nenhum Smart Token é consumido.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-gray-300">Fluxo seguro</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-200">
                Você escolhe as respostas. O sistema prepara o checklist para a futura geração server-side.
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <LoadingState />
        ) : properties.length === 0 ? (
          <EmptyPropertyState />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
            <div className="space-y-5">
              <AssistantStep number={1} message="Ótimo. Qual imóvel deseja utilizar?">
                <div className="grid gap-3 md:grid-cols-2">
                  {properties.map((property) => {
                    const propertyPhotos = getPhotoList(property)
                    const active = selectedPropertyId === property.id
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => setSelectedPropertyId(property.id)}
                        className={`overflow-hidden rounded-2xl border bg-white text-left transition ${
                          active ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="aspect-[4/3] bg-gray-100">
                          {propertyPhotos[0] ? (
                            <img src={propertyPhotos[0]} alt={getPropertyTitle(property)} className="h-full w-full object-cover" />
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
                              <p className="truncate text-sm font-black text-gray-950">{getPropertyTitle(property)}</p>
                              <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                {getLocation(property)}
                              </p>
                            </div>
                            {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />}
                          </div>
                          <p className="mt-3 text-xs font-bold text-gray-500">
                            {propertyPhotos.length} foto{propertyPhotos.length === 1 ? '' : 's'} disponível{propertyPhotos.length === 1 ? '' : 'is'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </AssistantStep>

              {selectedProperty && (
                <UserReply>
                  <strong>{getPropertyTitle(selectedProperty)}</strong>
                  <span>{getLocation(selectedProperty)}</span>
                </UserReply>
              )}

              {canShowImageMode && (
                <AssistantStep number={2} message="Como deseja criar sua imagem?">
                  <OptionGrid>
                    {IMAGE_MODES.map((item) => (
                      <ChoiceButton
                        key={item.id}
                        active={imageModeId === item.id}
                        title={item.label}
                        description={item.description}
                        onClick={() => {
                          setImageModeId(item.id)
                          setResultVisible(false)
                        }}
                      />
                    ))}
                  </OptionGrid>
                </AssistantStep>
              )}

              {imageMode && (
                <UserReply>
                  <strong>{imageMode.label}</strong>
                  <span>{imageMode.description}</span>
                </UserReply>
              )}

              {canShowPropertyState && (
                <AssistantStep number={3} message="Qual é o estado atual do imóvel?">
                  {savedPropertyState && (
                    <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                      Cadastro Mestre sugeriu: {savedPropertyState}. Confirme ou escolha outra opção.
                    </div>
                  )}
                  <ChipGrid>
                    {PROPERTY_STATES.map((item) => (
                      <ChipButton
                        key={item}
                        active={propertyState === item}
                        onClick={() => {
                          setPropertyState(item)
                          setAudienceId('')
                          setSubcategory('')
                          setSelectedHighlights([])
                          setHighlightsConfirmed(false)
                          setDeliverablesConfirmed(false)
                          setAdditionalConfirmed(false)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {propertyState && (
                <UserReply>
                  <strong>{propertyState}</strong>
                  <span>Estado do imóvel confirmado para orientar o futuro prompt.</span>
                </UserReply>
              )}

              {canShowAudience && (
                <AssistantStep number={4} message="Quem você deseja atingir?">
                  <ChipGrid>
                    {AUDIENCES.map((item) => (
                      <ChipButton
                        key={item.id}
                        active={audienceId === item.id}
                        onClick={() => {
                          setAudienceId(item.id)
                          setResultVisible(false)
                        }}
                      >
                        {item.label}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {audience && (
                <UserReply>
                  <strong>{audience.label}</strong>
                  <span>Público-alvo escolhido para orientar tom visual e argumentos.</span>
                </UserReply>
              )}

              {canShowSubcategory && (
                <AssistantStep number={5} message={`Qual foco faz mais sentido para ${audience?.label}?`}>
                  <ChipGrid>
                    {subcategories.map((item) => (
                      <ChipButton
                        key={item}
                        active={subcategory === item}
                        onClick={() => {
                          setSubcategory(item)
                          setResultVisible(false)
                        }}
                      >
                        {item}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                </AssistantStep>
              )}

              {subcategory && (
                <UserReply>
                  <strong>{subcategory}</strong>
                  <span>Subcategoria selecionada.</span>
                </UserReply>
              )}

              {canShowHighlights && (
                <AssistantStep number={6} message="O que deseja destacar?">
                  {propertyHighlights.length > 0 ? (
                    <>
                      <ChipGrid>
                        {propertyHighlights.map((highlight) => (
                          <ChipButton
                            key={highlight}
                            active={selectedHighlights.includes(highlight)}
                            onClick={() => toggleHighlight(highlight)}
                          >
                            {highlight}
                          </ChipButton>
                        ))}
                      </ChipGrid>
                      <div className="mt-4 flex justify-end">
                        <Button type="button" onClick={() => setHighlightsConfirmed(true)} variant="secondary">
                          Confirmar destaques
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-600">Este imóvel ainda não tem destaques cadastrados.</p>
                      <Button type="button" onClick={() => setHighlightsConfirmed(true)} variant="secondary" className="mt-3">
                        Continuar sem destaques
                      </Button>
                    </div>
                  )}
                </AssistantStep>
              )}

              {highlightsConfirmed && (
                <UserReply>
                  <strong>{selectedHighlights.length > 0 ? `${selectedHighlights.length} destaque(s)` : 'Sem destaque adicional'}</strong>
                  <span>{selectedHighlights.length > 0 ? selectedHighlights.join(', ') : 'Vamos seguir apenas com os dados principais do imóvel.'}</span>
                </UserReply>
              )}

              {canShowDeliverables && (
                <AssistantStep number={7} message="O que deseja receber junto?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {DELIVERABLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleDeliverable(item)}
                        className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                          deliverables[item.id] ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <span className="text-sm font-black">{item.label}</span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          deliverables[item.id] ? 'border-amber-300 bg-amber-300 text-gray-950' : 'border-gray-300'
                        }`}>
                          {deliverables[item.id] && <Check className="h-4 w-4" />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setDeliverablesConfirmed(true)} variant="secondary">
                      Confirmar pacote
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {deliverablesConfirmed && (
                <UserReply>
                  <strong>{chosenDeliverables.length} item(ns) no pacote</strong>
                  <span>{chosenDeliverables.map((item) => item.label).join(', ')}</span>
                </UserReply>
              )}

              {canShowAdditionalInfo && (
                <AssistantStep number={8} message="Deseja acrescentar algo?">
                  <label className="block">
                    <span className="text-sm font-black text-gray-950">Existe algum detalhe importante que não perguntamos?</span>
                    <textarea
                      value={additionalInfo}
                      onChange={(event) => {
                        setAdditionalInfo(event.target.value.slice(0, 400))
                        setAdditionalConfirmed(false)
                        setResultVisible(false)
                      }}
                      rows={4}
                      placeholder="Ex: valorizar a sala integrada, criar uma atmosfera mais sofisticada, evitar excesso de texto..."
                      className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    />
                    <span className="mt-1 block text-right text-xs font-semibold text-gray-400">{additionalInfo.length}/400</span>
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => setAdditionalConfirmed(true)} variant="secondary">
                      Continuar
                    </Button>
                  </div>
                </AssistantStep>
              )}

              {additionalConfirmed && (
                <UserReply>
                  <strong>{additionalInfo.trim() ? 'Orientação adicionada' : 'Sem orientação adicional'}</strong>
                  <span>{additionalInfo.trim() || 'O assistente seguirá com o briefing guiado.'}</span>
                </UserReply>
              )}

              {canShowChecklist && (
                <AssistantStep number={9} message="Confira o checklist final antes de gerar.">
                  <Checklist
                    property={selectedProperty}
                    imageMode={imageMode}
                    propertyState={propertyState}
                    audience={audience}
                    subcategory={subcategory}
                    highlights={selectedHighlights}
                    additionalInfo={additionalInfo}
                    deliverables={chosenDeliverables}
                    photos={photos}
                    canGenerate={canGenerate}
                    onGenerate={handleGenerate}
                  />
                </AssistantStep>
              )}
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <ReadinessCard
                selectedProperty={selectedProperty}
                photoCount={photos.length}
                profileStatus={profileStatus}
                brandStatus={brandStatus}
              />
              <ResultPanel visible={resultVisible} />
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

function AssistantStep({ number, message, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-amber-300">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-gray-400">Assistente Hero IA</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-gray-950">{message}</h2>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function UserReply({ children }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-2xl rounded-3xl bg-gray-950 px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

function OptionGrid({ children }) {
  return <div className="grid gap-3 md:grid-cols-3">{children}</div>
}

function ChipGrid({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function ChoiceButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <p className={`text-sm font-black ${active ? 'text-white' : 'text-gray-950'}`}>{title}</p>
      <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-gray-300' : 'text-gray-500'}`}>{description}</p>
    </button>
  )
}

function ChipButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition ${
        active
          ? 'border-gray-950 bg-gray-950 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

function Checklist({ property, imageMode, propertyState, audience, subcategory, highlights, additionalInfo, deliverables, photos, canGenerate, onGenerate }) {
  const rows = [
    ['Imóvel', getPropertyTitle(property)],
    ['Tipo de imagem', imageMode?.label || 'Não informado'],
    ['Estado do imóvel', propertyState || 'Não informado'],
    ['Público', audience?.label || 'Não informado'],
    ['Subcategoria', subcategory || 'Não informada'],
    ['Destaques', highlights.length > 0 ? highlights.join(', ') : 'Sem destaque adicional'],
    ['Informações adicionais', additionalInfo.trim() || 'Nenhuma'],
    ['Pacote escolhido', deliverables.map((item) => item.label).join(', ')],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-1 text-sm font-black leading-relaxed text-gray-950">{value}</p>
          </div>
        ))}
      </div>

      {photos.length < MIN_HERO_PHOTOS && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Este imóvel tem {photos.length} foto{photos.length === 1 ? '' : 's'}. Adicione pelo menos {MIN_HERO_PHOTOS} fotos no Cadastro Mestre antes da geração real.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-gray-950">Pronto para preparar a experiência?</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Esta etapa mostra o placeholder e não consome Smart Tokens.
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={!canGenerate} className="justify-center">
          <Wand2 className="h-4 w-4" />
          Sim, gerar agora
        </Button>
      </div>
    </div>
  )
}

function ReadinessCard({ selectedProperty, photoCount, profileStatus, brandStatus }) {
  const items = [
    {
      label: 'Imóvel selecionado',
      ok: Boolean(selectedProperty),
      hint: selectedProperty ? getPropertyTitle(selectedProperty) : 'Escolha um Cadastro Mestre.',
    },
    {
      label: 'Fotos do imóvel',
      ok: photoCount >= MIN_HERO_PHOTOS,
      hint: `${photoCount}/${MIN_HERO_PHOTOS} mínimas para a futura geração.`,
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

function ResultPanel({ visible }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-amber-700">Resultado</p>
      <h2 className="mt-1 text-lg font-black text-gray-950">Hero IA em preparação</h2>
      <div className="mt-4 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100">
        <div className="flex aspect-[4/3] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm font-black text-gray-950">
            {visible ? 'Hero IA em preparação' : 'O resultado aparecerá aqui'}
          </p>
          <p className="mt-2 max-w-xs text-xs font-semibold leading-relaxed text-gray-500">
            {visible
              ? 'A estrutura está pronta para Hero Principal, textos e próximas ações quando o backend real for conectado.'
              : 'Nenhuma imagem real será simulada e nenhum Smart Token será consumido nesta etapa.'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ResultBlock title="Hero Principal" active={visible} />
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-black text-gray-950">3 Direções Criativas</p>
          <div className="mt-3 space-y-2">
            {CREATIVE_DIRECTIONS.map((direction) => (
              <div key={direction.id} className="rounded-2xl bg-white p-3">
                <p className="text-xs font-black text-gray-950">{direction.title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">{direction.description}</p>
                <button type="button" disabled className="mt-2 text-xs font-black text-gray-400">
                  Gerar esta versão
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Download className="h-4 w-4" />
          Download
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <RefreshCw className="h-4 w-4" />
          Gerar nova versão
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <Layers3 className="h-4 w-4" />
          Criar Campanha IA
        </button>
        <button type="button" disabled className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-400">
          <BadgeCheck className="h-4 w-4" />
          Criar Landing IA
        </button>
      </div>
    </section>
  )
}

function ResultBlock({ title, active }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <p className="text-sm font-black text-gray-950">{title}</p>
      <p className="mt-1 text-xs font-semibold text-gray-500">
        {active ? 'Preparado para futura geração real.' : 'Aguardando checklist.'}
      </p>
    </div>
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
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
      <div className="space-y-6">
        <div className="h-72 animate-pulse rounded-3xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-gray-100" />
    </div>
  )
}

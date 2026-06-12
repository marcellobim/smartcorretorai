import { useEffect, useMemo, useState } from 'react'
import {
  Bed,
  Camera,
  Car,
  CheckCircle2,
  Clock3,
  Edit2,
  Home,
  Image,
  MapPin,
  Maximize,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select, Textarea } from '../components/ui/Input'
import { useProperties } from '../hooks/useProperties'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { formatArea, formatCurrency } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'
const RETENTION_DAYS = 7
const MIN_MASTER_PHOTOS = 3
const MAX_MASTER_PHOTOS = 5
const MAX_MASTER_HIGHLIGHTS = 20
const FINALIDADE_MVP = 'Venda'

const EMPTY_FORM = {
  titulo: '',
  perfil_imovel: '',
  tipo: '',
  preco: '',
  area: '',
  quartos: 2,
  suites: 1,
  vagas: 1,
  bairro: '',
  cidade: '',
  estado: '',
  descricao: '',
  destaques: [],
  fotos: [],
  video: null,
}

const TIPOS_MESTRE = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Studio / Loft',
  'Sobrado',
  'Terreno / Lote',
  'Comercial',
]

const PERFIS_IMOVEL = [
  'Minha Casa Minha Vida',
  'Médio padrão',
  'Alto padrão',
  'Luxo',
  'Lançamento',
  'Pré-lançamento',
  'Terreno / Lote',
  'Comercial',
  'Locação',
]

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const HIGHLIGHT_GROUPS = [
  {
    title: 'Localização',
    items: [
      'Próximo ao metrô',
      'Próximo ao shopping',
      'Próximo a escolas',
      'Próximo a mercados',
      'Fácil acesso às principais vias',
      'Bairro valorizado',
      'Região em crescimento',
      'Vista livre',
    ],
  },
  {
    title: 'Condomínio e lazer',
    items: [
      'Lazer completo',
      'Piscina',
      'Academia',
      'Salão de festas',
      'Espaço gourmet',
      'Churrasqueira',
      'Coworking',
      'Pet place',
      'Playground',
      'Quadra de tênis ou beach tennis',
      'Lounge',
      'Mini mercado',
      'Lavanderia',
      'Piscina aquecida ou climatizada',
      'Áreas verdes',
      'Rooftop',
      'Espaço delivery',
      'Locker para encomendas',
      'Espaço wellness',
      'Spa ou sauna',
    ],
  },
  {
    title: 'Serviços e facilidades',
    items: [
      'Serviços tipo hotelaria',
      'Manobrista',
      'Ponto de carregamento para carros elétricos',
      'Depósito privativo por unidade',
      'Vagas demarcadas',
      'Portaria 24h',
      'Segurança 24h',
    ],
  },
  {
    title: 'Características do imóvel',
    items: [
      'Varanda',
      'Varanda gourmet',
      'Suíte',
      'Closet',
      'Planta inteligente',
      'Ambientes integrados',
      'Cozinha americana',
      'Acabamento premium',
      'Iluminação natural',
      'Vista panorâmica',
    ],
  },
  {
    title: 'Condição comercial',
    items: [
      'Aceita financiamento',
      'Usa FGTS',
      'Entrada facilitada',
      'Subsídio do governo',
      'Documentação em ordem',
      'Últimas unidades',
      'Condições especiais',
      'Alto potencial de valorização',
    ],
  },
]

const normalizeText = (value = '') => String(value).trim().replace(/\s+/g, ' ')

const capitalizeWord = (word = '') => {
  const lower = word.toLocaleLowerCase('pt-BR')
  if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(lower)) return lower
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

const normalizeNeighborhood = (value = '') => normalizeText(value)
  .split(' ')
  .filter(Boolean)
  .map(capitalizeWord)
  .join(' ')

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getRetentionDate = () => {
  const date = new Date()
  date.setDate(date.getDate() + RETENTION_DAYS)
  return date.toISOString()
}

const splitDescription = (description = '') => {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return { publicDescription: raw.trim(), master: null }

  const publicDescription = raw.slice(0, markerIndex).trim()
  const jsonText = raw.slice(markerIndex + MASTER_MARKER.length).trim()
  try {
    return { publicDescription, master: JSON.parse(jsonText) }
  } catch {
    return { publicDescription, master: null }
  }
}

const buildStoredDescription = (publicDescription, masterProperty) => (
  `${normalizeText(publicDescription)}\n\n${MASTER_MARKER}\n${JSON.stringify(masterProperty)}`
)

const getMasterFromProperty = (property) => splitDescription(property?.descricao).master

const getMasterStatus = (property) => {
  const master = getMasterFromProperty(property)
  if (!master) return 'incompleto'
  const hasCore = Boolean(master?.perfil_imovel && property?.tipo && property?.bairro && property?.cidade && property?.estado)
  const hasPhotos = Array.isArray(property?.fotos) && property.fotos.length >= MIN_MASTER_PHOTOS
  return hasCore && hasPhotos ? 'completo' : 'incompleto'
}

const toFormState = (property) => {
  if (!property) return { ...EMPTY_FORM, fotos: [], destaques: [] }
  const { publicDescription, master } = splitDescription(property.descricao)
  return {
    titulo: property.titulo || '',
    perfil_imovel: master?.perfil_imovel || '',
    tipo: property.tipo || '',
    preco: property.preco || master?.preco || '',
    area: property.area || master?.area || '',
    quartos: property.quartos ?? master?.dormitorios ?? 0,
    suites: property.suites ?? master?.suites ?? master?.banheiros ?? property.banheiros ?? 0,
    vagas: property.vagas ?? master?.vagas ?? 0,
    bairro: property.bairro || '',
    cidade: property.cidade || '',
    estado: property.estado || '',
    descricao: publicDescription || '',
    destaques: Array.isArray(master?.destaques_selecionados) ? master.destaques_selecionados : [],
    fotos: Array.isArray(property.fotos)
      ? property.fotos.map((url) => ({ type: 'remote', url, preview: url }))
      : [],
    video: master?.video_opcional_url
      ? { type: 'remote', url: master.video_opcional_url, name: master.video_opcional_nome || 'Vídeo cadastrado' }
      : null,
  }
}

export default function MeusImoveis() {
  const { user } = useAuth()
  const { properties, loading, create, update, remove } = useProperties()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState(() => toFormState(null))
  const [saving, setSaving] = useState(false)
  const [cidades, setCidades] = useState([])
  const [loadingCities, setLoadingCities] = useState(false)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return properties.filter((property) => (
      property.titulo?.toLowerCase().includes(term)
      || property.bairro?.toLowerCase().includes(term)
      || property.cidade?.toLowerCase().includes(term)
    ))
  }, [properties, search])

  const completeCount = properties.filter((property) => getMasterStatus(property) === 'completo').length

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    if (!form.estado) {
      setCidades([])
      return
    }

    let cancelled = false
    setLoadingCities(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.estado}/municipios`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        const cityNames = Array.isArray(data)
          ? data.map((city) => city.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
          : []
        setCidades(cityNames)
      })
      .catch(() => {
        if (!cancelled) {
          setCidades(form.cidade ? [form.cidade] : [])
          toast.error('Não foi possível carregar as cidades deste estado.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.estado])

  const handleEstadoChange = (estado) => {
    setForm((current) => ({
      ...current,
      estado,
      cidade: current.estado === estado ? current.cidade : '',
    }))
  }

  const openCreate = () => {
    setEditingProperty(null)
    setForm(toFormState(null))
    setShowModal(true)
  }

  const openEdit = (property) => {
    setEditingProperty(property)
    setForm(toFormState(property))
    setShowModal(true)
  }

  const toggleHighlight = (item) => {
    setForm((current) => {
      if (current.destaques.includes(item)) {
        return { ...current, destaques: current.destaques.filter((value) => value !== item) }
      }
      if (current.destaques.length >= MAX_MASTER_HIGHLIGHTS) {
        toast.error(`Selecione até ${MAX_MASTER_HIGHLIGHTS} destaques.`)
        return current
      }
      return { ...current, destaques: [...current.destaques, item] }
    })
  }

  const handlePhotos = (files) => {
    const incoming = Array.from(files || []).filter((file) => file.type?.startsWith('image/'))
    if (incoming.length === 0) {
      toast.error('Envie imagens em JPG ou PNG.')
      return
    }

    setForm((current) => {
      const available = MAX_MASTER_PHOTOS - current.fotos.length
      if (available <= 0) {
        toast.error(`Envie no máximo ${MAX_MASTER_PHOTOS} fotos do imóvel.`)
        return current
      }
      if (incoming.length > available) {
        toast.error(`Foram adicionadas apenas ${available} foto${available === 1 ? '' : 's'} para respeitar o limite.`)
      }
      const nextPhotos = incoming.slice(0, available).map((file) => ({
        type: 'file',
        file,
        preview: URL.createObjectURL(file),
      }))
      return { ...current, fotos: [...current.fotos, ...nextPhotos] }
    })
  }

  const removePhoto = (index) => {
    setForm((current) => ({ ...current, fotos: current.fotos.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const handleVideo = (files) => {
    const file = Array.from(files || []).find((item) => item.type?.startsWith('video/'))
    if (!file) {
      toast.error('Envie um arquivo de vídeo válido.')
      return
    }
    setForm((current) => ({
      ...current,
      video: {
        type: 'file',
        file,
        name: file.name,
        preview: URL.createObjectURL(file),
      },
    }))
  }

  const uploadAsset = async (asset, folder, index = 0) => {
    if (!asset || asset.type === 'remote') return asset?.url || null
    if (!user?.id) throw new Error('Sessão expirada. Faça login novamente.')

    const ext = (asset.file.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/master-properties/${folder}-${Date.now()}-${index}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('smartcorretor-assets')
      .upload(path, asset.file, { contentType: asset.file.type, upsert: true })

    if (uploadError) throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`)
    if (!path.startsWith(`${user.id}/`)) throw new Error('Caminho de upload inválido.')

    const { data: signed, error: signedError } = await supabase.storage
      .from('smartcorretor-assets')
      .createSignedUrl(path, 60 * 60 * 24 * RETENTION_DAYS)

    if (signedError) throw new Error(`Falha ao preparar arquivo: ${signedError.message}`)
    return signed.signedUrl
  }

  const validateForm = () => {
    if (!form.perfil_imovel || !form.tipo || !form.estado || !form.cidade || !normalizeNeighborhood(form.bairro)) {
      toast.error('Preencha perfil, tipo, estado, cidade e bairro.')
      return false
    }
    if (form.fotos.length < MIN_MASTER_PHOTOS) {
      toast.error(`Envie de ${MIN_MASTER_PHOTOS} a ${MAX_MASTER_PHOTOS} fotos do imóvel.`)
      return false
    }
    return true
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    try {
      setSaving(true)
      const fotosUrls = []
      for (let index = 0; index < form.fotos.length; index++) {
        const url = await uploadAsset(form.fotos[index], 'foto', index)
        if (url) fotosUrls.push(url)
      }

      const videoUrl = form.video ? await uploadAsset(form.video, 'video', 0) : null
      const titulo = normalizeText(form.titulo)
        || `${form.tipo} em ${normalizeNeighborhood(form.bairro) || 'bairro informado'}`
      const normalizedNeighborhood = normalizeNeighborhood(form.bairro)

      const masterProperty = {
        schema_version: 'master_property_v1',
        retention_days: RETENTION_DAYS,
        reusable_until: getRetentionDate(),
        perfil_imovel: form.perfil_imovel,
        finalidade: 'venda',
        tipo: normalizeText(form.tipo),
        bairro: normalizedNeighborhood,
        cidade: normalizeText(form.cidade),
        estado: form.estado,
        preco: parseNumber(form.preco),
        area: parseNumber(form.area),
        dormitorios: Number(form.quartos) || 0,
        suites: Number(form.suites) || 0,
        vagas: Number(form.vagas) || 0,
        fotos_imovel: fotosUrls,
        foto_principal: fotosUrls[0] || null,
        video_opcional_url: videoUrl,
        video_opcional_nome: form.video?.name || null,
        destaques_selecionados: form.destaques,
        observacoes: normalizeText(form.descricao),
        reutilizacao: {
          banners_rapidos: true,
          hero_ia: true,
          criar_com_ia: true,
          transformar_video: Boolean(videoUrl),
          campanha_ia: true,
          landing_ia: true,
        },
      }

      const payload = {
        titulo,
        tipo: normalizeText(form.tipo),
        finalidade: FINALIDADE_MVP,
        preco: parseNumber(form.preco) || 0,
        quartos: Number(form.quartos) || 0,
        banheiros: Number(form.suites) || 0,
        vagas: Number(form.vagas) || 0,
        bairro: normalizedNeighborhood,
        cidade: normalizeText(form.cidade),
        estado: form.estado,
        descricao: buildStoredDescription(form.descricao, masterProperty),
        fotos: fotosUrls,
      }

      if (editingProperty) await update(editingProperty.id, payload)
      else await create(payload)

      setShowModal(false)
      setEditingProperty(null)
      setForm(toFormState(null))
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar Cadastro Mestre.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await remove(confirmDelete.id)
      setConfirmDelete(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleGenerateCampaign = (property) => {
    navigate('/nova-campanha', { state: { property } })
  }

  return (
    <div>
      <Header title="Cadastro Mestre" subtitle="Cadastre o imóvel uma vez e reutilize os dados nos produtos da plataforma." />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Núcleo reutilizável</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                Cadastro Mestre do imóvel
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
                Dados, fotos, vídeo opcional e destaques ficam organizados por 7 dias para alimentar banners, imagens, vídeos, campanhas e landing pages.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Dados do imóvel', 'Upload 3-5 fotos', 'Vídeo opcional', 'Destaques', 'Retenção 7 dias', 'Reutilização'].map((item) => (
                  <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-gray-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-wide text-amber-300">Status da base</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Imóveis" value={properties.length} />
                <Metric label="Completos" value={completeCount} />
              </div>
              <Button onClick={openCreate} className="mt-5 w-full justify-center">
                <Plus className="h-4 w-4" />
                Cadastrar imóvel
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por imóvel, bairro ou cidade"
                className="input pl-9"
              />
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo Cadastro Mestre
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-3xl bg-gray-100" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyMasterState search={search} onCreate={openCreate} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((property) => (
                <MasterPropertyCard
                  key={property.id}
                  property={property}
                  onEdit={openEdit}
                  onDelete={setConfirmDelete}
                  onGenerateCampaign={handleGenerateCampaign}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingProperty ? 'Editar Cadastro Mestre' : 'Novo Cadastro Mestre'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-10rem)] space-y-6 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-950">Retenção e reutilização</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                  Este cadastro fica preparado para reaproveitamento por 7 dias. Banners usam só os dados necessários, e produtos futuros poderão reutilizar o restante.
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">Perfil do imóvel</p>
            <h3 className="mt-1 text-base font-black text-gray-950">Qual o perfil deste imóvel?</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Essa informação orienta Hero IA, Campanha IA, Landing IA e o Smart Prompt Engine.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PERFIS_IMOVEL.map((perfil) => {
                const active = form.perfil_imovel === perfil
                return (
                  <button
                    key={perfil}
                    type="button"
                    onClick={() => updateField('perfil_imovel', perfil)}
                    className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                      active
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {perfil}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Título interno"
              placeholder="Ex: Apartamento na Lapa"
              value={form.titulo}
              onChange={(event) => updateField('titulo', event.target.value)}
            />
            <Select
              label="Tipo do imóvel"
              value={form.tipo}
              onChange={(event) => updateField('tipo', event.target.value)}
              required
            >
              <option value="">Selecione</option>
              {TIPOS_MESTRE.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Select
              label="Finalidade"
              value={FINALIDADE_MVP}
              disabled
              onChange={() => {}}
            >
              <option value={FINALIDADE_MVP}>{FINALIDADE_MVP}</option>
            </Select>
            <Input
              label="Preço (R$)"
              type="number"
              placeholder="500000"
              value={form.preco}
              onChange={(event) => updateField('preco', event.target.value)}
            />
            <Input
              label="Área (m²)"
              type="number"
              placeholder="80"
              value={form.area}
              onChange={(event) => updateField('area', event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Quartos" type="number" value={form.quartos} onChange={(event) => updateField('quartos', event.target.value)} />
            <Input label="Suítes" type="number" value={form.suites} onChange={(event) => updateField('suites', event.target.value)} />
            <Input label="Vagas" type="number" value={form.vagas} onChange={(event) => updateField('vagas', event.target.value)} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Select
              label="Estado"
              value={form.estado}
              onChange={(event) => handleEstadoChange(event.target.value)}
              required
            >
              <option value="">Selecione o estado</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </Select>
            <Select
              label="Cidade"
              value={form.cidade}
              onChange={(event) => updateField('cidade', event.target.value)}
              disabled={!form.estado || loadingCities}
              required
            >
              <option value="">
                {!form.estado ? 'Selecione o estado primeiro' : loadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}
              </option>
              {form.cidade && !cidades.includes(form.cidade) && <option value={form.cidade}>{form.cidade}</option>}
              {cidades.map((cidade) => <option key={cidade} value={cidade}>{cidade}</option>)}
            </Select>
            <Input
              label="Bairro"
              placeholder="Moema"
              value={form.bairro}
              onChange={(event) => updateField('bairro', event.target.value)}
              onBlur={() => updateField('bairro', normalizeNeighborhood(form.bairro))}
              required
            />
          </div>

          <Textarea
            label="Observações do imóvel"
            placeholder="Ex: andar alto, condomínio bem localizado, unidade reformada..."
            rows={3}
            value={form.descricao}
            onChange={(event) => updateField('descricao', event.target.value)}
          />

          <PhotoUploader photos={form.fotos} onAdd={handlePhotos} onRemove={removePhoto} />
          <VideoUploader video={form.video} onAdd={handleVideo} onRemove={() => updateField('video', null)} />
          <HighlightsPicker selected={form.destaques} onToggle={toggleHighlight} />

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {editingProperty ? 'Salvar Cadastro Mestre' : 'Criar Cadastro Mestre'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Excluir Cadastro Mestre" size="sm">
        <p className="text-sm leading-relaxed text-gray-600">
          Tem certeza que deseja excluir <strong>{confirmDelete?.titulo}</strong>? Esta ação remove o cadastro reutilizável deste imóvel.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-gray-300">{label}</p>
    </div>
  )
}

function EmptyMasterState({ search, onCreate }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
        <Home className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-black text-gray-950">
        {search ? 'Nenhum imóvel encontrado' : 'Comece cadastrando seu primeiro imóvel.'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        {search
          ? 'Tente buscar por outro bairro, cidade ou título.'
          : 'O Cadastro Mestre concentra dados, fotos e destaques para todos os produtos do SmartCorretorAI.'}
      </p>
      {!search && (
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Criar Cadastro Mestre
        </Button>
      )}
    </div>
  )
}

function MasterPropertyCard({ property, onEdit, onDelete, onGenerateCampaign }) {
  const master = getMasterFromProperty(property)
  const status = getMasterStatus(property)
  const photo = property.fotos?.[0]
  const highlights = Array.isArray(master?.destaques_selecionados) ? master.destaques_selecionados.slice(0, 3) : []
  const retention = master?.reusable_until ? new Date(master.reusable_until) : null
  const retentionLabel = retention && !Number.isNaN(retention.getTime())
    ? retention.toLocaleDateString('pt-BR')
    : '7 dias após salvar'

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gray-100">
        {photo ? (
          <img src={photo} alt={property.titulo} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <Image className="h-9 w-9" />
            <span className="mt-2 text-xs font-bold">Sem foto</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-black text-gray-800 shadow-sm">
            {master?.perfil_imovel || 'Venda'}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm ${
            status === 'completo' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {status === 'completo' ? 'Completo' : 'Incompleto'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate text-base font-black text-gray-950">{property.titulo}</h3>
        <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {property.bairro}, {property.cidade} - {property.estado}
        </p>

        <p className="mt-3 text-xl font-black text-primary-600">{formatCurrency(property.preco || 0)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-500">
          {property.quartos > 0 && <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.quartos}</span>}
          {(property.suites || property.banheiros) > 0 && <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{property.suites || property.banheiros} suíte{(property.suites || property.banheiros) === 1 ? '' : 's'}</span>}
          {property.vagas > 0 && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{property.vagas}</span>}
          {property.area && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{formatArea(property.area)}</span>}
        </div>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-gray-500">
            <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />Retenção</span>
            <span>{retentionLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {highlights.length > 0 ? highlights.map((item) => (
              <span key={item} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">
                {item}
              </span>
            )) : (
              <span className="text-xs text-gray-400">Sem destaques selecionados</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
          <Button variant="primary" size="sm" className="flex-1" onClick={() => onGenerateCampaign(property)}>
            <Sparkles className="h-3.5 w-3.5" />
            Gerar banners
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(property)} aria-label="Editar Cadastro Mestre">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(property)} aria-label="Excluir Cadastro Mestre">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        </div>
      </div>
    </article>
  )
}

function PhotoUploader({ photos, onAdd, onRemove }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-gray-950">Fotos do imóvel</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Envie de {MIN_MASTER_PHOTOS} a {MAX_MASTER_PHOTOS} imagens. A primeira foto será a principal.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
          {photos.length}/{MAX_MASTER_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <div key={`${photo.preview}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
              <img src={photo.preview} alt="" className="h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-gray-950 px-1.5 py-0.5 text-[10px] font-black text-white">
                  Principal
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-950/70 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < MAX_MASTER_PHOTOS && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center transition hover:border-amber-300 hover:bg-amber-50/40">
          <Camera className="h-8 w-8 text-gray-400" />
          <span className="mt-2 text-sm font-black text-gray-700">Clique ou arraste as fotos aqui</span>
          <span className="mt-1 text-xs text-gray-400">JPG ou PNG, até {MAX_MASTER_PHOTOS} fotos</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => onAdd(event.target.files)} />
        </label>
      )}
    </section>
  )
}

function VideoUploader({ video, onAdd, onRemove }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-gray-950">Vídeo opcional</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Guarde um vídeo do imóvel ou do corretor para produtos futuros de vídeo.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">Opcional</span>
      </div>

      {video ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-amber-300">
              <Video className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-gray-950">{video.name || 'Vídeo cadastrado'}</p>
              <p className="text-xs text-gray-500">Será reutilizado quando o produto aceitar vídeo.</p>
            </div>
          </div>
          <button type="button" onClick={onRemove} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:bg-white">
            Remover vídeo
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-7 text-center transition hover:border-amber-300 hover:bg-amber-50/40">
          <Upload className="h-7 w-7 text-gray-400" />
          <span className="mt-2 text-sm font-black text-gray-700">Adicionar vídeo opcional</span>
          <span className="mt-1 text-xs text-gray-400">MP4, MOV ou arquivo compatível</span>
          <input type="file" accept="video/*" className="hidden" onChange={(event) => onAdd(event.target.files)} />
        </label>
      )}
    </section>
  )
}

function HighlightsPicker({ selected, onToggle }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-gray-950">Destaques do imóvel</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Selecione os principais diferenciais. Cada produto usará apenas o que fizer sentido.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
          {selected.length}/{MAX_MASTER_HIGHLIGHTS}
        </span>
      </div>

      <div className="space-y-3">
        {HIGHLIGHT_GROUPS.map((group) => (
          <div key={group.title} className="rounded-2xl bg-gray-50 p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">{group.title}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => {
                const active = selected.includes(item)
                const disabled = !active && selected.length >= MAX_MASTER_HIGHLIGHTS
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(item)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : disabled
                          ? 'cursor-not-allowed border-gray-200 bg-white text-gray-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {active && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                    {item}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

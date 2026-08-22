import { Fragment, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Database,
  Eye,
  Gift,
  MessageSquareQuote,
  PlusCircle,
  RefreshCw,
  Search,
  ShoppingCart,
  Users,
  Zap,
  X,
} from 'lucide-react'
import { adminRequest } from '../lib/admin-api'

const TABS = [
  ['overview', 'Visão geral'],
  ['products', 'Produtos'],
  ['clients', 'Clientes'],
  ['finance', 'Financeiro'],
  ['testimonials', 'Depoimentos'],
]

const PERIODS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [0, 'Total'],
]

const PLAN_FILTERS = [
  ['', 'Todos os planos'],
  ['free', 'FREE'],
  ['start', 'START'],
  ['pro', 'PRO'],
  ['elite', 'ELITE'],
]

const STATUS_FILTERS = [
  ['', 'Todos os status'],
  ['ativo', 'Ativa'],
  ['pausado', 'Pausada'],
  ['cancelado', 'Cancelada'],
]

const TESTIMONIAL_STATUS_FILTERS = [
  ['', 'Todos'],
  ['pending', 'Pendentes'],
  ['approved', 'Aprovados'],
  ['published', 'Publicados'],
  ['rejected', 'Recusados'],
]

const testimonialStatusLabel = {
  pending: 'Pendente', approved: 'Aprovado', published: 'Publicado', rejected: 'Recusado',
}

const testimonialStatusTone = {
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-blue-100 text-blue-800',
  published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
}

const integer = value => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0))
const integerOrUnavailable = value => value == null ? 'Indisponível' : integer(value)
const brl = cents => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
}).format(Number(cents ?? 0) / 100)
const date = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
  : '—'
const dateTime = value => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'
const lotSource = { subscription: 'Assinatura', purchase: 'Recarga', admin: 'Administrativo', trial: 'Trial', migration: 'Migração' }
const lotStatus = lot => {
  if (lot.status === 'active' && lot.expiresAt && new Date(lot.expiresAt) <= new Date()) return 'Expirado'
  if (lot.status === 'active' && lot.remainingAmount < lot.originalAmount) return 'Parcialmente consumido'
  return { active: 'Ativo', exhausted: 'Consumido', expired: 'Expirado', revoked: 'Revogado' }[lot.status] || lot.status
}

const planTone = {
  FREE: 'bg-slate-100 text-slate-700',
  START: 'bg-blue-100 text-blue-800',
  PRO: 'bg-violet-100 text-violet-800',
  ELITE: 'bg-amber-100 text-amber-900',
}

const statusTone = {
  ativo: 'bg-emerald-100 text-emerald-800',
  pausado: 'bg-orange-100 text-orange-800',
  cancelado: 'bg-slate-100 text-slate-700',
  sem_assinatura: 'bg-slate-100 text-slate-600',
}

function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          {detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}
        </div>
        <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</div>
}

function AdminUnavailable({ section }) {
  return (
    <div className="mt-6 space-y-6">
      <Section title={section} description="A estrutura do Admin está disponível, mas os dados desta seção ainda não são compatíveis com o backend administrativo atual.">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Atualização administrativa pendente. Nenhum valor foi substituído por zero e a ausência da migration não interrompe a renderização.
        </div>
      </Section>
      {section === 'Visão geral' && (
        <Section title="Requer atenção" description="Será preenchido somente quando o backend protegido fornecer eventos reais.">
          <p className="text-sm text-slate-500">Dados operacionais temporariamente indisponíveis.</p>
        </Section>
      )}
    </div>
  )
}

function isOperationalOverview(value) {
  return Boolean(
    value?.users && value?.subscriptions && value?.smartTokens && value?.commerce
    && value?.generation && Array.isArray(value?.products) && value?.attention && value?.availability,
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [period, setPeriod] = useState(30)
  const [expandedProducts, setExpandedProducts] = useState(() => new Set())
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState(false)
  const [clients, setClients] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [clientDetail, setClientDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [grantAmount, setGrantAmount] = useState('')
  const [grantReason, setGrantReason] = useState('')
  const [grantRequestId, setGrantRequestId] = useState(() => crypto.randomUUID())
  const [granting, setGranting] = useState(false)
  const [testimonials, setTestimonials] = useState([])
  const [testimonialPagination, setTestimonialPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [testimonialStatus, setTestimonialStatus] = useState('')
  const [testimonialsLoading, setTestimonialsLoading] = useState(false)
  const [testimonialsError, setTestimonialsError] = useState(false)
  const [testimonialDetail, setTestimonialDetail] = useState(null)
  const [testimonialDetailLoading, setTestimonialDetailLoading] = useState(false)
  const [testimonialAction, setTestimonialAction] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [lastBonusOperation, setLastBonusOperation] = useState(null)

  const loadOverview = useCallback(async selectedPeriod => {
    setOverviewLoading(true)
    setOverviewError(false)
    try {
      const response = await adminRequest('overview', { period: selectedPeriod })
      if (!isOperationalOverview(response)) throw new Error('admin_overview_contract_mismatch')
      setOverview(response)
    } catch {
      setOverview(null)
      setOverviewError(true)
      toast.error('Não foi possível carregar os dados administrativos.')
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const loadClients = useCallback(async page => {
    setClientsLoading(true)
    setClientsError(false)
    try {
      const response = await adminRequest('list_clients', { page, search, plan, status })
      setClients(response.clients || [])
      setPagination(response.pagination || { page: 1, total: 0, totalPages: 1 })
    } catch {
      setClients([])
      setClientsError(true)
      toast.error('Não foi possível carregar os clientes.')
    } finally {
      setClientsLoading(false)
    }
  }, [plan, search, status])

  useEffect(() => { loadOverview(period) }, [loadOverview, period])
  useEffect(() => { loadClients(1) }, [loadClients])

  const loadTestimonials = useCallback(async page => {
    setTestimonialsLoading(true)
    setTestimonialsError(false)
    try {
      const response = await adminRequest('list_testimonials', { page, status: testimonialStatus })
      setTestimonials(response.testimonials || [])
      setTestimonialPagination(response.pagination || { page: 1, total: 0, totalPages: 1 })
    } catch {
      setTestimonials([])
      setTestimonialsError(true)
      toast.error('Não foi possível carregar os depoimentos.')
    } finally {
      setTestimonialsLoading(false)
    }
  }, [testimonialStatus])

  useEffect(() => {
    if (activeTab === 'testimonials') loadTestimonials(1)
  }, [activeTab, loadTestimonials])

  const submitSearch = event => {
    event.preventDefault()
    setSearch(searchInput.trim())
  }

  const openClient = async userId => {
    setDetailLoading(true)
    setClientDetail(null)
    setGrantAmount('')
    setGrantReason('')
    setGrantRequestId(crypto.randomUUID())
    try {
      setClientDetail(await adminRequest('get_client', { userId }))
    } catch {
      toast.error('Não foi possível carregar o detalhe do cliente.')
    } finally {
      setDetailLoading(false)
    }
  }

  const submitGrant = async event => {
    event.preventDefault()
    if (!clientDetail?.client?.id || granting) return
    setGranting(true)
    try {
      await adminRequest('add_smart_tokens', {
        userId: clientDetail.client.id,
        amount: Number(grantAmount),
        reason: grantReason,
        requestId: grantRequestId,
      })
      toast.success('Smart Tokens adicionados com lote administrativo auditado.')
      setGrantAmount('')
      setGrantReason('')
      setGrantRequestId(crypto.randomUUID())
      await Promise.all([openClient(clientDetail.client.id), loadClients(pagination.page), loadOverview(period)])
    } catch (error) {
      toast.error(error?.message || 'Não foi possível adicionar Smart Tokens.')
    } finally {
      setGranting(false)
    }
  }

  const openTestimonial = async testimonialId => {
    setTestimonialDetailLoading(true)
    setTestimonialDetail(null)
    setRejectionReason('')
    setLastBonusOperation(null)
    try {
      const response = await adminRequest('get_testimonial', { testimonialId })
      setTestimonialDetail(response.testimonial || null)
    } catch (error) {
      toast.error(error?.message || 'Não foi possível carregar o depoimento.')
    } finally {
      setTestimonialDetailLoading(false)
    }
  }

  const refreshTestimonial = async testimonialId => {
    const response = await adminRequest('get_testimonial', { testimonialId })
    setTestimonialDetail(response.testimonial || null)
    await loadTestimonials(testimonialPagination.page)
  }

  const runTestimonialAction = async (action, payload, successMessage) => {
    if (!testimonialDetail?.id || testimonialAction) return
    setTestimonialAction(action)
    try {
      await adminRequest(action, { testimonialId: testimonialDetail.id, ...payload })
      toast.success(successMessage)
      setRejectionReason('')
      await refreshTestimonial(testimonialDetail.id)
    } catch (error) {
      toast.error(error?.message || 'Não foi possível atualizar o depoimento.')
    } finally {
      setTestimonialAction('')
    }
  }

  const approveWithBonus = async () => {
    if (!testimonialDetail?.id || testimonialAction) return
    if (!window.confirm('Conceder 500 Smart Tokens para esta conta?')) return
    setTestimonialAction('approve_testimonial_and_grant_bonus')
    try {
      const result = await adminRequest('approve_testimonial_and_grant_bonus', {
        testimonialId: testimonialDetail.id,
        requestId: crypto.randomUUID(),
      })
      setLastBonusOperation(result)
      if (result.result === 'bonus_already_granted') {
        toast('Esta conta já recebeu o bônus da campanha.', { icon: 'ℹ️' })
      } else if (result.notificationSent) {
        toast.success('500 ST concedidos e notificação enviada.')
      } else {
        toast('Crédito confirmado; a notificação por e-mail falhou ou já foi processada.', { icon: '⚠️' })
      }
      await refreshTestimonial(testimonialDetail.id)
    } catch (error) {
      toast.error(error?.message || 'Não foi possível conceder o bônus.')
    } finally {
      setTestimonialAction('')
    }
  }

  const periodLabel = PERIODS.find(([value]) => value === period)?.[1] || '30 dias'
  const products = overview?.products || []
  const attentionTotal = overview
    ? Number(overview.attention.pausedSubscriptions ?? 0) + Number(overview.attention.failedEmails ?? 0)
      + Number(overview.attention.failedJobs ?? 0) + Number(overview.attention.failedGenerations ?? 0)
    : 0

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">Operação</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Admin SmartCorretorAI</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Dados operacionais reais, protegidos e consolidados no backend.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Período das métricas"
              value={period}
              onChange={event => setPeriod(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => loadOverview(period)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        </header>

        <nav className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" aria-label="Seções administrativas">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {overviewLoading && !['clients', 'testimonials'].includes(activeTab) ? (
          <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-slate-500" /></div>
        ) : overview ? (
          <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard label="Usuários" value={integer(overview.users.total)} detail={`${integer(overview.users.newInPeriod)} novos em ${periodLabel}`} icon={Users} />
                  <MetricCard label="Assinaturas ativas" value={integer(overview.subscriptions.active)} detail={`${integer(overview.subscriptions.paused)} pausadas`} icon={CreditCard} />
                  <MetricCard label="Recargas vendidas" value={integer(overview.commerce.rechargesSold)} detail="Pagamentos com lote criado" icon={ShoppingCart} />
                  <MetricCard label="Gerações no período" value={integer(overview.generation.total)} detail={`${integer(overview.generation.failures)} falhas`} icon={Activity} />
                  <MetricCard label="Requer atenção" value={integer(attentionTotal)} detail="Falhas e assinaturas pausadas" icon={AlertTriangle} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="ST de assinatura" value={integerOrUnavailable(overview.smartTokens.subscriptionGranted)} detail={`Concedidos em ${periodLabel}`} icon={Database} />
                  <MetricCard label="ST extras vendidos" value={integerOrUnavailable(overview.smartTokens.purchaseGranted)} detail={overview.commerce.rechargeCustomers == null ? 'Compradores indisponíveis' : `${integer(overview.commerce.rechargeCustomers)} compradores em ${periodLabel}`} icon={ShoppingCart} />
                  <MetricCard label="ST consumidos" value={integerOrUnavailable(overview.smartTokens.consumed)} detail={`Consumo confirmado em ${periodLabel}`} icon={Activity} />
                  <MetricCard label="ST em circulação" value={integerOrUnavailable(overview.smartTokens.circulation)} detail="Saldo visível atual em lotes ativos" icon={Zap} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <Section title="Clientes por plano" description="Plano comercial atual registrado no perfil.">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(overview.users.byPlan).map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">{key === 'elite' ? 'ELITE' : key}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{integer(value)}</p>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="Requer atenção" description={`Estado atual das assinaturas e ocorrências reais em ${periodLabel}.`}>
                    <div className="space-y-3">
                      {[
                        ['Assinaturas pausadas', overview.attention.pausedSubscriptions],
                        ['E-mails transacionais com falha', overview.attention.failedEmails],
                        ['Jobs de vídeo com falha', overview.attention.failedJobs],
                        ['Gerações com falha', overview.attention.failedGenerations],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                          <span className="text-sm text-slate-700">{label}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{integer(value)}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>

                <Section title="Assinaturas" description="Estado sincronizado pelo webhook Stripe.">
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Ativas', overview.subscriptions.active],
                      ['Pausadas', overview.subscriptions.paused],
                      ['Canceladas', overview.subscriptions.cancelled],
                      ['START ativas', overview.subscriptions.activeByPlan.start],
                      ['PRO ativas', overview.subscriptions.activeByPlan.pro],
                      ['ELITE ativas', overview.subscriptions.activeByPlan.elite],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-2 text-xl font-semibold text-slate-950">{integer(value)}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Atividade por geração" description="Clientes distintos com geração persistida; não representa login, sessão ou permanência no site.">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Hoje</p><p className="mt-2 text-xl font-semibold">{integerOrUnavailable(overview.generation.activeUsersToday)}</p></div>
                    <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Últimos 7 dias</p><p className="mt-2 text-xl font-semibold">{integerOrUnavailable(overview.generation.activeUsers7Days)}</p></div>
                    <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Últimos 30 dias</p><p className="mt-2 text-xl font-semibold">{integerOrUnavailable(overview.generation.activeUsers30Days)}</p></div>
                  </div>
                </Section>
              </div>
            )}

            {activeTab === 'products' && (
              <Section title="Uso por produto" description={`Execuções persistidas no backend — ${periodLabel}.`}>
                {products.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3">Produto</th>
                          <th className="px-3 py-3 text-right">Gerações</th>
                          <th className="px-3 py-3 text-right">Sucesso</th>
                          <th className="px-3 py-3 text-right">Falhas</th>
                          <th className="px-3 py-3 text-right">ST consumidos</th>
                          <th className="px-3 py-3 text-right">Participação</th>
                          <th className="px-3 py-3">Provider</th>
                          <th className="px-3 py-3">Modelo/Motor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.map(product => (<Fragment key={product.key}>
                          <tr>
                            <td className="px-3 py-4 font-medium text-slate-900">
                              {product.modules?.length ? <button type="button" className="flex items-center gap-2 text-left" onClick={() => setExpandedProducts(current => { const next = new Set(current); next.has(product.key) ? next.delete(product.key) : next.add(product.key); return next })} aria-expanded={expandedProducts.has(product.key)}>
                                <ChevronDown className={`h-4 w-4 transition ${expandedProducts.has(product.key) ? 'rotate-180' : ''}`} />{product.label}
                              </button> : product.label}
                            </td>
                            <td className="px-3 py-4 text-right">{integer(product.generations)}</td>
                            <td className="px-3 py-4 text-right text-emerald-700">{integer(product.success)}</td>
                            <td className="px-3 py-4 text-right text-red-700">{integer(product.failures)}</td>
                            <td className="px-3 py-4 text-right">{product.smartTokensConsumed === null ? '—' : integer(product.smartTokensConsumed)}</td>
                            <td className="px-3 py-4 text-right">{product.participationPercent.toLocaleString('pt-BR')}%</td>
                            <td className="px-3 py-4">{product.providers?.join(', ') || '—'}</td>
                            <td className="px-3 py-4">{product.models?.join(', ') || '—'}</td>
                          </tr>
                          {expandedProducts.has(product.key) && product.modules?.map(module => (
                            <tr key={`${product.key}:${module.key}`} className="bg-slate-50/70">
                              <td className="px-3 py-3 pl-10 text-slate-700"><span className="font-medium">{module.label}</span>{module.historicalCoverage !== 'complete' && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">{module.historicalCoverage === 'new_only' ? 'novos registros' : 'histórico parcial'}</span>}</td>
                              <td className="px-3 py-3 text-right">{module.historicalCoverage === 'new_only' && module.generations === 0 ? '—' : integer(module.generations)}</td>
                              <td className="px-3 py-3 text-right text-emerald-700">{module.historicalCoverage === 'new_only' && module.generations === 0 ? '—' : integer(module.success)}</td>
                              <td className="px-3 py-3 text-right text-red-700">{module.historicalCoverage === 'new_only' && module.generations === 0 ? '—' : integer(module.failures)}</td>
                              <td className="px-3 py-3 text-right">{module.smartTokensConsumed == null ? '—' : integer(module.smartTokensConsumed)}</td>
                              <td className="px-3 py-3 text-right">{module.participationPercent.toLocaleString('pt-BR')}%</td>
                              <td className="px-3 py-3">{module.providers?.join(', ') || '—'}</td>
                              <td className="px-3 py-3">{module.models?.join(', ') || '—'}</td>
                            </tr>
                          ))}
                        </Fragment>))}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty>Nenhuma geração registrada no período.</Empty>}
                <p className="mt-4 text-xs text-slate-500">Campos não determináveis aparecem como “—”. Módulos com cobertura parcial contabilizam somente registros identificáveis com segurança.</p>
              </Section>
            )}

            {activeTab === 'finance' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Recargas vendidas" value={integer(overview.commerce.rechargesSold)} detail="Contagem financeira por lotes Stripe" icon={ShoppingCart} />
                  <MetricCard label="ST de recargas concedidos" value={overview.smartTokens.purchaseGranted === null ? 'Indisponível' : integer(overview.smartTokens.purchaseGranted)} detail="Somente pacotes reconhecidos" icon={Zap} />
                  <MetricCard label="ST de assinaturas concedidos" value={overview.smartTokens.subscriptionGranted === null ? 'Indisponível' : integer(overview.smartTokens.subscriptionGranted)} detail="Competências pagas reconhecidas" icon={Database} />
                  <MetricCard label="Valor mensal teórico" value={brl(overview.commerce.theoreticalMonthlyBrlCents)} detail="Planos ativos × preço normal; não é receita real" icon={CircleDollarSign} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="ST extras vendidos" value={integerOrUnavailable(overview.smartTokens.purchaseGranted)} detail={`No período: ${periodLabel}`} icon={ShoppingCart} />
                  <MetricCard label="ST extras restantes" value={integerOrUnavailable(overview.smartTokens.purchaseRemaining)} detail="Remaining amount de recargas ativas" icon={Zap} />
                  <MetricCard label="ST extras consumidos" value={integerOrUnavailable(overview.smartTokens.purchaseConsumed)} detail={`Consumo FEFO confirmado em ${periodLabel}`} icon={Activity} />
                  <MetricCard label="Ticket médio de catálogo" value={overview.commerce.averageRechargeCatalogCents === null ? 'Indisponível' : brl(overview.commerce.averageRechargeCatalogCents)} detail="Não é receita conciliada" icon={CircleDollarSign} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Section title="Recargas" description="Contagem por pacote homologado.">
                    <div className="space-y-3">
                      <div className="flex justify-between rounded-xl bg-slate-50 p-4"><span>2.000 ST — R$49,90</span><strong>{integer(overview.commerce.rechargePackages.brl_49_90)}</strong></div>
                      <div className="flex justify-between rounded-xl bg-slate-50 p-4"><span>4.000 ST — R$97,90</span><strong>{integer(overview.commerce.rechargePackages.brl_97_90)}</strong></div>
                      <div className="flex justify-between border-t border-slate-200 pt-4 text-sm"><span>Valor bruto pelo catálogo</span><strong>{overview.commerce.catalogRechargeValueBrlCents === null ? 'Indisponível' : brl(overview.commerce.catalogRechargeValueBrlCents)}</strong></div>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600 sm:grid-cols-4">
                        <span>Ativos: <strong>{integerOrUnavailable(overview.commerce.purchaseLotsByStatus.active)}</strong></span>
                        <span>Parciais: <strong>{integerOrUnavailable(overview.commerce.purchaseLotsByStatus.partial)}</strong></span>
                        <span>Consumidos: <strong>{integerOrUnavailable(overview.commerce.purchaseLotsByStatus.exhausted)}</strong></span>
                        <span>Expirados: <strong>{integerOrUnavailable(overview.commerce.purchaseLotsByStatus.expired)}</strong></span>
                      </div>
                      <p className="text-xs text-slate-500">Valor calculado pelos pacotes reconhecidos; não inclui conciliação Stripe nem taxas.</p>
                    </div>
                  </Section>

                  <Section title="Equilíbrio financeiro" description="Sem números estimados apresentados como margem real.">
                    <div className="space-y-3 text-sm text-slate-600">
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Receita efetivamente paga, taxas Stripe e uso de SMART15 não são persistidos de forma agregável no banco atual.</p>
                      <p className="rounded-xl border border-slate-200 p-4">Custos reais por provider/modelo ainda não possuem cobertura consistente para todos os produtos.</p>
                      <p className="text-xs text-slate-500">Próxima evolução: registrar valores financeiros liquidados e custo real por geração antes de calcular margem.</p>
                    </div>
                  </Section>
                </div>
              </div>
            )}
          </div>
        ) : overviewError && !['clients', 'testimonials'].includes(activeTab) ? (
          <AdminUnavailable section={activeTab === 'products' ? 'Produtos' : activeTab === 'finance' ? 'Financeiro' : 'Visão geral'} />
        ) : null}

        {activeTab === 'clients' && (
          <div className="mt-6">
            {(detailLoading || clientDetail) && (
              <div className="mb-6">
                <Section title="Detalhe operacional do cliente" description="Dados financeiros e de uso persistidos no backend.">
                  {detailLoading ? (
                    <div className="flex min-h-48 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-slate-500" /></div>
                  ) : clientDetail && (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{clientDetail.client.name || 'Sem nome'}</p>
                          <p className="text-sm text-slate-500">{clientDetail.client.email}</p>
                        </div>
                        <button type="button" onClick={() => setClientDetail(null)} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm"><X className="h-4 w-4" /> Fechar</button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          ['Plano', clientDetail.client.plan],
                          ['Assinatura', clientDetail.client.subscriptionStatus.replace('_', ' ')],
                          ['Saldo atual', `${integer(clientDetail.client.smartTokenBalance)} ST`],
                          ['Stripe', clientDetail.client.hasStripeCustomer ? 'Vinculado' : 'Não vinculado'],
                          ['ST de assinatura', clientDetail.client.subscriptionGranted == null ? 'Indisponível' : `${integer(clientDetail.client.subscriptionGranted)} ST`],
                          ['ST extras comprados', clientDetail.client.purchaseGranted == null ? 'Indisponível' : `${integer(clientDetail.client.purchaseGranted)} ST`],
                          ['Recargas', integerOrUnavailable(clientDetail.client.rechargeCount)],
                          ['Valor bruto de catálogo', clientDetail.client.rechargeCatalogCents === null ? 'Indisponível' : brl(clientDetail.client.rechargeCatalogCents)],
                          ['Gerações', integerOrUnavailable(clientDetail.client.totalGenerations)],
                          ['Falhas', integerOrUnavailable(clientDetail.client.failedGenerations)],
                          ['Última geração', dateTime(clientDetail.client.lastGenerationAt)],
                          ['Cadastro', date(clientDetail.client.createdAt)],
                        ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-900">{value}</p></div>)}
                      </div>
                      <p className="text-xs text-slate-500">{clientDetail.activityDefinition} Métricas de login e permanência ainda não são capturadas.</p>

                      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Lotes de Smart Tokens</h3>
                          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200">
                            <table className="min-w-full text-left text-xs">
                              <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Origem</th><th className="p-3 text-right">Original</th><th className="p-3 text-right">Restante</th><th className="p-3">Status</th><th className="p-3">Validade</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">{clientDetail.lots.map(lot => <tr key={lot.id}><td className="p-3">{lotSource[lot.source] || lot.source}</td><td className="p-3 text-right">{integer(lot.originalAmount)}</td><td className="p-3 text-right">{integer(lot.remainingAmount)}</td><td className="p-3">{lotStatus(lot)}</td><td className="p-3">{lot.expiresAt ? date(lot.expiresAt) : 'Sem vencimento'}</td></tr>)}</tbody>
                            </table>
                            {!clientDetail.lots.length && <div className="p-5 text-center text-slate-500">Nenhum lote.</div>}
                          </div>
                        </div>

                        <form onSubmit={submitGrant} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h3 className="font-semibold text-slate-950">Adicionar Smart Tokens</h3>
                          <p className="mt-1 text-xs text-slate-500">Cria lote administrativo separado, sem vencimento, com auditoria obrigatória.</p>
                          {!clientDetail.adminCreditOperationsAvailable && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Ação indisponível até a migration administrativa ser aplicada.</p>}
                          <label className="mt-4 block text-xs font-medium text-slate-700">Quantidade
                            <input type="number" min="1" max="10000" required disabled={!clientDetail.adminCreditOperationsAvailable} value={grantAmount} onChange={event => setGrantAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100" />
                          </label>
                          <label className="mt-3 block text-xs font-medium text-slate-700">Motivo
                            <textarea minLength="10" maxLength="500" required disabled={!clientDetail.adminCreditOperationsAvailable} value={grantReason} onChange={event => setGrantReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100" placeholder="Descreva a compensação ou cortesia" />
                          </label>
                          <button disabled={granting || !clientDetail.adminCreditOperationsAvailable} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><PlusCircle className="h-4 w-4" /> {granting ? 'Adicionando…' : 'Adicionar Smart Tokens'}</button>
                        </form>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Histórico administrativo</h3>
                        <div className="mt-3 space-y-2">{clientDetail.adjustments.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>+{integer(item.amount)} ST</strong><span className="text-xs text-slate-500">{dateTime(item.createdAt)}</span></div><p className="mt-1 text-slate-700">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Por {item.adminName}{item.adminEmail ? ` — ${item.adminEmail}` : ''}</p></div>)}</div>
                        {!clientDetail.adjustments.length && <p className="mt-3 text-sm text-slate-500">Nenhum ajuste administrativo registrado.</p>}
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            )}
            <Section title="Clientes" description="Lista paginada; busca e filtros executados no backend protegido.">
              <form onSubmit={submitSearch} className="grid gap-3 lg:grid-cols-[1fr_180px_190px_auto]">
                <label className="relative">
                  <span className="sr-only">Buscar cliente</span>
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={event => setSearchInput(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
                  />
                </label>
                <select aria-label="Filtrar plano" value={plan} onChange={event => setPlan(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  {PLAN_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select aria-label="Filtrar assinatura" value={status} onChange={event => setStatus(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">Buscar</button>
              </form>

              {clientsLoading ? (
                <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-slate-500" /></div>
              ) : clientsError ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Clientes temporariamente indisponíveis no backend administrativo atual. A página permanece operacional e nenhum dado foi inventado.</div>
              ) : clients.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Plano</th><th className="px-3 py-3">Assinatura</th>
                        <th className="px-3 py-3 text-right">Saldo ST</th><th className="px-3 py-3 text-right">ST assinatura</th><th className="px-3 py-3 text-right">ST extras</th><th className="px-3 py-3 text-right">Recargas</th><th className="px-3 py-3 text-right">Valor catálogo</th><th className="px-3 py-3 text-right">Gerações</th><th className="px-3 py-3">Última geração</th><th className="px-3 py-3">Cadastro</th><th className="px-3 py-3">Próxima competência</th><th className="px-3 py-3">Stripe</th><th className="px-3 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients.map(client => (
                        <tr key={client.id}>
                          <td className="px-3 py-4"><p className="font-medium text-slate-900">{client.name || 'Sem nome'}</p><p className="mt-1 text-xs text-slate-500">{client.email}</p></td>
                          <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planTone[client.plan]}`}>{client.plan}</span></td>
                          <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[client.subscriptionStatus] || statusTone.sem_assinatura}`}>{client.subscriptionStatus.replace('_', ' ')}</span></td>
                          <td className="px-3 py-4 text-right font-medium">{integer(client.smartTokenBalance)} ST</td>
                          <td className="px-3 py-4 text-right">{integerOrUnavailable(client.subscriptionGranted)}</td>
                          <td className="px-3 py-4 text-right">{integerOrUnavailable(client.purchaseGranted)}</td>
                          <td className="px-3 py-4 text-right">{integerOrUnavailable(client.rechargeCount)}</td>
                          <td className="px-3 py-4 text-right">{client.rechargeCatalogCents === null ? '—' : brl(client.rechargeCatalogCents)}</td>
                          <td className="px-3 py-4 text-right">{integerOrUnavailable(client.totalGenerations)}</td>
                          <td className="px-3 py-4 text-slate-600">{dateTime(client.lastGenerationAt)}</td>
                          <td className="px-3 py-4 text-slate-600">{date(client.createdAt)}</td>
                          <td className="px-3 py-4 text-slate-600">{date(client.currentPeriodEnd)}</td>
                          <td className="px-3 py-4 text-slate-600">{client.hasStripeCustomer ? 'Vinculado' : 'Não vinculado'}</td>
                          <td className="px-3 py-4"><button type="button" onClick={() => openClient(client.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"><Eye className="h-3.5 w-3.5" /> Abrir</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="mt-5"><Empty>Nenhum cliente encontrado.</Empty></div>}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>{integer(pagination.total)} clientes</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={pagination.page <= 1} onClick={() => loadClients(pagination.page - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span>Página {pagination.page} de {pagination.totalPages}</span>
                  <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => loadClients(pagination.page + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'testimonials' && (
          <div className="mt-6 space-y-6">
            {(testimonialDetailLoading || testimonialDetail) && (
              <Section title="Detalhe do depoimento" description="Auditoria, consentimentos e ações protegidas pelo backend administrativo.">
                {testimonialDetailLoading ? (
                  <div className="flex min-h-48 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-slate-500" /></div>
                ) : testimonialDetail && (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-950">{testimonialDetail.client.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${planTone[testimonialDetail.client.plan] || planTone.FREE}`}>{testimonialDetail.client.plan}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${testimonialStatusTone[testimonialDetail.status]}`}>{testimonialStatusLabel[testimonialDetail.status]}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{testimonialDetail.client.email || 'E-mail de login indisponível'}</p>
                        {testimonialDetail.professionLabel && <p className="mt-1 text-sm text-slate-600">{testimonialDetail.professionLabel}</p>}
                      </div>
                      <button type="button" onClick={() => setTestimonialDetail(null)} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm"><X className="h-4 w-4" /> Fechar</button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{testimonialDetail.body}</p>
                      <p className="mt-4 text-xs text-slate-500">Enviado em {dateTime(testimonialDetail.submittedAt)}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Publicação</p><p className="mt-2 font-semibold">{testimonialDetail.publicationConsent ? 'Autorizada' : 'Não autorizada'}</p></div>
                      <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Nome/profissão</p><p className="mt-2 font-semibold">{testimonialDetail.attributionConsent ? 'Autorizados' : 'Manter anônimo'}</p></div>
                      <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Bônus da conta</p><p className="mt-2 font-semibold">{testimonialDetail.bonusGranted ? '500 ST já concedidos' : 'Não concedido'}</p>{testimonialDetail.bonusGranted && !testimonialDetail.bonusLinkedToTestimonial && <p className="mt-1 text-xs text-slate-500">Concedido por outro depoimento.</p>}</div>
                      <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">E-mails persistidos</p><p className="mt-2 font-semibold">Indisponível nesta etapa</p></div>
                    </div>

                    {(testimonialDetail.approvedAt || testimonialDetail.rejectedAt || testimonialDetail.publishedAt) && (
                      <div className="grid gap-3 md:grid-cols-3">
                        {testimonialDetail.approvedAt && <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><strong>Aprovado</strong><p className="mt-1">{dateTime(testimonialDetail.approvedAt)}{testimonialDetail.approvedBy ? ` por ${testimonialDetail.approvedBy}` : ''}</p></div>}
                        {testimonialDetail.rejectedAt && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-900"><strong>Recusado</strong><p className="mt-1">{dateTime(testimonialDetail.rejectedAt)}{testimonialDetail.rejectedBy ? ` por ${testimonialDetail.rejectedBy}` : ''}</p><p className="mt-2">{testimonialDetail.rejectionReason}</p></div>}
                        {testimonialDetail.publishedAt && <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Publicado</strong><p className="mt-1">{dateTime(testimonialDetail.publishedAt)}{testimonialDetail.publishedBy ? ` por ${testimonialDetail.publishedBy}` : ''}</p></div>}
                      </div>
                    )}

                    {testimonialDetail.adjustment && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <strong>Concessão auditada: +{integer(testimonialDetail.adjustment.amount)} ST</strong>
                        <p className="mt-1">{testimonialDetail.adjustment.reason}</p>
                        <p className="mt-1 text-xs">{dateTime(testimonialDetail.adjustment.createdAt)}</p>
                      </div>
                    )}

                    {lastBonusOperation && (
                      <div className={`rounded-xl border p-4 text-sm ${lastBonusOperation.notificationSent ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                        <strong>{lastBonusOperation.result === 'bonus_already_granted' ? 'Esta conta já recebeu o bônus.' : `Saldo confirmado: ${integer(lastBonusOperation.smartTokenBalance)} ST`}</strong>
                        <p className="mt-1">{lastBonusOperation.notificationSent ? 'E-mail de bônus enviado.' : 'Crédito preservado; notificação não enviada ou já processada.'}</p>
                      </div>
                    )}

                    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <h3 className="font-semibold text-slate-950">Ações de aprovação</h3>
                        <p className="mt-1 text-xs text-slate-500">O valor do bônus e a conta são definidos exclusivamente no servidor.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" disabled={testimonialAction || testimonialDetail.status !== 'pending'} onClick={() => runTestimonialAction('approve_testimonial', {}, 'Depoimento aprovado sem bônus.')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40">Aprovar sem bônus</button>
                          <button type="button" disabled={testimonialAction || testimonialDetail.bonusGranted || !['pending', 'approved'].includes(testimonialDetail.status)} onClick={approveWithBonus} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><Gift className="h-4 w-4" /> Aprovar + conceder 500 ST</button>
                          <button type="button" disabled={testimonialAction || testimonialDetail.status !== 'approved' || !testimonialDetail.publicationConsent} onClick={() => runTestimonialAction('publish_testimonial', {}, 'Depoimento marcado como publicado.')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40">Marcar como publicado</button>
                        </div>
                        {!testimonialDetail.publicationConsent && <p className="mt-3 text-xs text-amber-700">Publicação bloqueada: o cliente não autorizou.</p>}
                      </div>

                      <form onSubmit={event => { event.preventDefault(); runTestimonialAction('reject_testimonial', { reason: rejectionReason }, 'Depoimento recusado.') }} className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <h3 className="font-semibold text-red-950">Recusar depoimento</h3>
                        <p className="mt-1 text-xs text-red-800">Não altera Smart Tokens e exige motivo auditável.</p>
                        <textarea required maxLength="1000" disabled={testimonialAction || testimonialDetail.bonusGranted || !['pending', 'approved'].includes(testimonialDetail.status)} value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Motivo da recusa" className="mt-3 min-h-20 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100" />
                        <button disabled={testimonialAction || !rejectionReason.trim() || testimonialDetail.bonusGranted || !['pending', 'approved'].includes(testimonialDetail.status)} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-40">Recusar</button>
                      </form>
                    </div>
                  </div>
                )}
              </Section>
            )}

            <Section title="Depoimentos" description="Lista protegida e filtrada pelo backend administrativo.">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar depoimentos por status">
                  {TESTIMONIAL_STATUS_FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setTestimonialStatus(value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${testimonialStatus === value ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{label}</button>)}
                </div>
                <button type="button" onClick={() => loadTestimonials(testimonialPagination.page)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Atualizar</button>
              </div>

              {testimonialsLoading ? (
                <div className="flex min-h-64 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-slate-500" /></div>
              ) : testimonialsError ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Depoimentos temporariamente indisponíveis. Confirme a aplicação das etapas de banco antes de usar esta área.</div>
              ) : testimonials.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Depoimento</th><th className="px-3 py-3">Envio</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Consentimentos</th><th className="px-3 py-3">Bônus</th><th className="px-3 py-3"><span className="sr-only">Ações</span></th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {testimonials.map(testimonial => <tr key={testimonial.id}>
                        <td className="px-3 py-4"><p className="font-medium text-slate-900">{testimonial.client.name}</p><p className="mt-1 text-xs text-slate-500">{testimonial.client.email || 'E-mail indisponível'} · {testimonial.client.plan}</p></td>
                        <td className="max-w-md px-3 py-4 text-slate-700"><p className="line-clamp-2">{testimonial.excerpt}</p></td>
                        <td className="px-3 py-4 text-slate-600">{dateTime(testimonial.submittedAt)}</td>
                        <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${testimonialStatusTone[testimonial.status]}`}>{testimonialStatusLabel[testimonial.status]}</span></td>
                        <td className="px-3 py-4 text-xs text-slate-600"><p>Publicação: {testimonial.publicationConsent ? 'sim' : 'não'}</p><p className="mt-1">Atribuição: {testimonial.attributionConsent ? 'sim' : 'não'}</p></td>
                        <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${testimonial.bonusGranted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{testimonial.bonusGranted ? 'Concedido' : 'Não'}</span></td>
                        <td className="px-3 py-4"><button type="button" onClick={() => openTestimonial(testimonial.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"><Eye className="h-3.5 w-3.5" /> Abrir</button></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              ) : <div className="mt-5"><Empty><MessageSquareQuote className="mx-auto mb-2 h-5 w-5" />Nenhum depoimento encontrado.</Empty></div>}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>{integer(testimonialPagination.total)} depoimentos</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={testimonialPagination.page <= 1} onClick={() => loadTestimonials(testimonialPagination.page - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span>Página {testimonialPagination.page} de {testimonialPagination.totalPages}</span>
                  <button type="button" disabled={testimonialPagination.page >= testimonialPagination.totalPages} onClick={() => loadTestimonials(testimonialPagination.page + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </main>
  )
}

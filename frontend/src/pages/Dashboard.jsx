import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Image,
  Layers3,
  MapPin,
  PlayCircle,
  Sparkles,
  UserCircle2,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { useAuth } from '../lib/auth-context'
import { useProperties } from '../hooks/useProperties'
import { useCampaigns } from '../hooks/useCampaigns'

const mainActions = [
  {
    id: 'divulgar-imovel',
    icon: Home,
    title: 'Tenho um imóvel para divulgar',
    description: 'Comece pelo cadastro do imóvel e receba materiais prontos para apresentar.',
    to: '/nova-campanha',
    label: 'Começar',
    tone: 'dark',
    ready: true,
  },
  {
    id: 'criar-com-ia',
    icon: Wand2,
    title: 'Criar com IA',
    description: 'Descreva o que precisa e deixe a IA montar o caminho ideal.',
    label: 'Em preparação',
    ready: false,
  },
  {
    id: 'transformar-video',
    icon: Video,
    title: 'Transformar meu vídeo',
    description: 'Transforme gravações em materiais mais claros para divulgar.',
    label: 'Em preparação',
    ready: false,
  },
  {
    id: 'banners-rapidos',
    icon: Image,
    title: 'Criar campanha rapidamente',
    description: 'Use a Biblioteca Profissional para gerar banners rápidos e estáveis.',
    to: '/nova-campanha',
    label: 'Criar banners',
    tone: 'amber',
    ready: true,
  },
  {
    id: 'landing-page',
    icon: FileText,
    title: 'Criar landing page',
    description: 'Prepare uma página do imóvel para apresentar tudo em um só lugar.',
    label: 'Em breve',
    ready: false,
  },
]

const statusLabel = {
  concluido: 'Pronto',
  gerando: 'Processando',
  erro: 'Atenção',
}

const formatDate = (value) => {
  if (!value) return 'Sem data'
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value))
  } catch {
    return 'Sem data'
  }
}

const getMainPhoto = (property) => (
  property?.fotos?.[0]
  || property?.photos?.[0]
  || property?.foto_principal
  || property?.image_url
  || property?.preview_url
  || null
)

const getTokenSnapshot = (user) => {
  const total =
    Number(user?.smart_tokens_total)
    || Number(user?.tokens_total)
    || Number(user?.limite_mensal)
    || Number(user?.total_disponivel)
    || 0
  const remaining =
    Number(user?.smart_tokens_saldo)
    || Number(user?.tokens_saldo)
    || Number(user?.restantes_mes)
    || Number(user?.total_disponivel)
    || 0
  const safeTotal = Math.max(total, remaining, 0)
  const used = Math.max(safeTotal - remaining, 0)
  const percent = safeTotal > 0 ? Math.min(100, Math.round((used / safeTotal) * 100)) : 0
  const renewal = user?.proxima_renovacao || user?.renovacao_tokens || user?.billing_cycle_anchor || null

  return {
    total: safeTotal,
    remaining,
    percent,
    renewalLabel: renewal ? formatDate(renewal) : 'Próximo ciclo',
  }
}

const getProfileStatus = (user) => {
  const required = [
    user?.nome || user?.displayName,
    user?.email,
    user?.whatsapp || user?.telefone || user?.phone || user?.phone_number,
    user?.creci,
  ]
  const completed = required.filter(Boolean).length
  const total = required.length
  return {
    completed,
    total,
    isComplete: completed === total,
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { properties, loading: propertiesLoading } = useProperties()
  const { campaigns, loading: campaignsLoading } = useCampaigns()

  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.nome?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Corretor'

  const recentProperties = properties.slice(0, 3)
  const recentCampaigns = campaigns.slice(0, 4)
  const lastProperty = recentProperties[0] || null
  const lastCampaign = recentCampaigns[0] || null
  const lastMaterial = recentCampaigns.find(campaign => campaign.preview_url || campaign.status === 'concluido') || lastCampaign
  const tokenSnapshot = getTokenSnapshot(user)
  const profileStatus = getProfileStatus(user)

  return (
    <div>
      <Header title="Home" subtitle="Sua central de criação imobiliária" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gray-950 p-6 text-white shadow-xl shadow-gray-950/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                Olá, {firstName}
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Como posso ajudar você hoje?
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300">
                Escolha uma opção abaixo. A IA guia você passo a passo.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-gray-300">Continue de onde parou</p>
              {lastProperty || lastCampaign || lastMaterial ? (
                <div className="mt-4 space-y-3">
                  <ResumeLine label="Último imóvel" value={lastProperty ? `${lastProperty.bairro || 'Bairro'} · ${lastProperty.cidade || 'Cidade'}` : 'Nenhum imóvel recente'} />
                  <ResumeLine label="Última campanha" value={lastCampaign?.titulo || 'Nenhuma campanha recente'} />
                  <ResumeLine label="Último material" value={lastMaterial?.titulo || 'Nenhum material recente'} />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">Comece cadastrando seu primeiro imóvel.</p>
                  <Link to="/nova-campanha" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-amber-300 hover:text-amber-200">
                    Cadastrar agora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {mainActions.map(action => (
            <ActionCard key={action.id} action={action} />
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Panel
              title="Imóveis recentes"
              action={<Link to="/meus-imoveis" className="text-sm font-black text-gray-600 hover:text-gray-950">Ver imóveis</Link>}
            >
              {propertiesLoading ? (
                <LoadingRows count={3} />
              ) : recentProperties.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {recentProperties.map(property => (
                    <PropertyPreview key={property.id} property={property} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Building2}
                  title="Nenhum imóvel recente"
                  description="Comece cadastrando seu primeiro imóvel."
                  to="/nova-campanha"
                  label="Cadastrar imóvel"
                />
              )}
            </Panel>

            <Panel
              title="Criações recentes"
              action={<Link to="/pacotes-gerados" className="text-sm font-black text-gray-600 hover:text-gray-950">Ver criações</Link>}
            >
              {campaignsLoading ? (
                <LoadingRows count={4} />
              ) : recentCampaigns.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {recentCampaigns.map(campaign => (
                    <CreationPreview key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Layers3}
                  title="Nenhuma criação recente"
                  description="Gere seus primeiros banners ou prepare uma campanha para o imóvel."
                  to="/nova-campanha"
                  label="Criar agora"
                />
              )}
            </Panel>
          </div>

          <aside className="space-y-6">
            <SmartTokensCard snapshot={tokenSnapshot} />
            <ProfileCard status={profileStatus} />
          </aside>
        </section>
      </main>
    </div>
  )
}

function ResumeLine({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function ActionCard({ action }) {
  const Icon = action.icon
  const content = (
    <article className={`flex h-full min-h-[210px] flex-col rounded-3xl border p-5 shadow-sm transition ${
      action.ready
        ? action.tone === 'amber'
          ? 'border-amber-200 bg-amber-50 hover:-translate-y-0.5 hover:shadow-lg'
          : 'border-gray-900 bg-gray-950 text-white hover:-translate-y-0.5 hover:shadow-lg'
        : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          action.ready
            ? action.tone === 'amber' ? 'bg-white text-amber-700' : 'bg-white/10 text-amber-300'
            : 'bg-gray-100 text-gray-500'
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        {!action.ready && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-500">
            Em preparação
          </span>
        )}
      </div>

      <div className="mt-5 flex-1">
        <h2 className={`text-base font-black leading-tight ${action.ready && action.tone === 'dark' ? 'text-white' : 'text-gray-950'}`}>
          {action.title}
        </h2>
        <p className={`mt-2 text-sm leading-relaxed ${action.ready && action.tone === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
          {action.description}
        </p>
      </div>

      <div className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${
        action.ready
          ? action.tone === 'dark' ? 'text-amber-300' : 'text-gray-950'
          : 'text-gray-400'
      }`}>
        {action.label}
        {action.ready ? <ArrowRight className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      </div>
    </article>
  )

  if (!action.ready || !action.to) return content
  return (
    <Link to={action.to} className="block rounded-3xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2">
      {content}
    </Link>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-gray-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function PropertyPreview({ property }) {
  const photo = getMainPhoto(property)
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="aspect-[4/3] bg-gray-100">
        {photo ? (
          <img src={photo} alt={property.titulo || 'Imóvel'} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <Building2 className="h-8 w-8" />
            <span className="mt-2 text-xs font-bold">Sem foto</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-gray-950">{property.bairro || 'Bairro'}</p>
            <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {property.cidade || 'Cidade'}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
            {property.status || 'Ativo'}
          </span>
        </div>
      </div>
    </article>
  )
}

function CreationPreview({ campaign }) {
  const status = statusLabel[campaign.status] || 'Pronto'
  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-950">{campaign.titulo || 'Material gerado'}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(campaign.created_at)}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-gray-600">
          {status}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-500">
        <PlayCircle className="h-4 w-4 text-amber-600" />
        Campanha, banners e materiais gerados
      </div>
    </article>
  )
}

function SmartTokensCard({ snapshot }) {
  const remainingLabel = snapshot.total > 0
    ? `${snapshot.remaining.toLocaleString('pt-BR')} disponíveis`
    : 'Saldo será exibido aqui'

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Smart Tokens</p>
          <h2 className="mt-1 text-lg font-black text-gray-950">Saldo da conta</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <Zap className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5">
        <p className="text-2xl font-black text-gray-950">{remainingLabel}</p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${snapshot.percent}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
          <span>{snapshot.percent}% usado</span>
          <span>Renovação: {snapshot.renewalLabel}</span>
        </div>
      </div>
    </section>
  )
}

function ProfileCard({ status }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-amber-300">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">Perfil Comercial</p>
          <h2 className="mt-1 text-lg font-black text-gray-950">
            {status.isComplete ? 'Completo' : 'Incompleto'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {status.isComplete
              ? 'Seus dados profissionais estão prontos para aparecer nos materiais.'
              : `${status.completed}/${status.total} informações essenciais preenchidas.`}
          </p>
        </div>
      </div>
      <Link
        to="/configuracoes?tab=perfil"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-800 hover:bg-gray-50"
      >
        {status.isComplete ? 'Revisar Perfil' : 'Completar Perfil'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}

function EmptyState({ icon: Icon, title, description, to, label }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-black text-gray-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-gray-500">{description}</p>
      <Link to={to} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-amber-700 hover:text-amber-800">
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function LoadingRows({ count }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  )
}

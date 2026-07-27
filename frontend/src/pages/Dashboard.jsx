import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Image,
  Layers3,
  PlayCircle,
  Sparkles,
  UserCircle2,
  Video,
  Wand2,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { useAuth } from '../lib/auth-context'
import { useCampaigns } from '../hooks/useCampaigns'

const mainActions = [
  {
    id: 'smart-tour-ai',
    icon: PlayCircle,
    title: 'Vídeo Imobiliário',
    description: 'Transforme as fotos dos seus imóveis em comerciais profissionais. Escolha o resultado desejado e nossa IA faz o restante.',
    to: '/smart-tour-ai',
    label: 'Criar vídeo',
    tone: 'featured',
    ready: true,
  },
  {
    id: 'hero-ia',
    icon: Wand2,
    title: 'Banner Imobiliário',
    description: 'Nossa IA transforma as fotos e informações do imóvel em banners profissionais, prontos para divulgar seus imóveis com mais impacto.',
    to: '/hero',
    label: 'Criar Banner',
    tone: 'featured',
    ready: true,
  },
  {
    id: 'studio-hero',
    icon: Video,
    title: 'Studio IA',
    description: 'Crie comerciais imobiliários, vídeos criativos e carrosséis de anúncios com IA.',
    to: '/studio-hero',
    label: 'Abrir Studio IA',
    tone: 'featured',
    ready: true,
  },
  {
    id: 'banners-rapidos',
    icon: Image,
    title: 'Banners Rápidos',
    description: 'Use a Biblioteca Profissional para criar materiais prontos e consistentes.',
    to: '/nova-campanha',
    label: 'Criar banners',
    tone: 'soft',
    ready: true,
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
  const { campaigns, loading: campaignsLoading } = useCampaigns()

  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.nome?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Corretor'

  const recentCampaigns = campaigns.slice(0, 4)
  const lastCampaign = recentCampaigns[0] || null
  const lastMaterial = recentCampaigns.find(campaign => campaign.preview_url || campaign.status === 'concluido') || lastCampaign
  const profileStatus = getProfileStatus(user)

  return (
    <div>
      <Header title="Home" subtitle="Sua central premium de criação imobiliária" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-7 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-6 text-white shadow-xl shadow-primary-900/10 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-50">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                Olá, {firstName}
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                O que vamos criar para o seu imóvel hoje?
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-blue-100">
                Escolha uma criação abaixo. A IA guia você do briefing ao material pronto, sem termos técnicos.
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/12 p-5 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-wide text-blue-100">Continue de onde parou</p>
              {lastCampaign || lastMaterial ? (
                <div className="mt-4 space-y-3">
                  <ResumeLine label="Última campanha" value={lastCampaign?.titulo || 'Nenhuma campanha recente'} />
                  <ResumeLine label="Último material" value={lastMaterial?.titulo || 'Nenhum material recente'} />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-bold text-white">Comece criando seu primeiro material.</p>
                  <Link to="/nova-campanha" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-cyan-100 hover:text-white">
                    Criar banners
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
          <div className="min-w-0 space-y-6">
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
        ? action.tone === 'soft'
          ? 'border-cyan-100 bg-primary-50 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg'
          : 'border-blue-100 bg-white hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/70 hover:shadow-lg'
        : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
          action.ready
            ? action.tone === 'soft' ? 'bg-white text-primary-700' : 'bg-primary-50 text-primary-700'
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
        <h2 className="text-base font-black leading-tight text-slate-950">
          {action.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {action.description}
        </p>
      </div>

      <div className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${
        action.ready
          ? 'text-primary-700'
          : 'text-gray-400'
      }`}>
        {action.label}
        {action.ready ? <ArrowRight className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
      </div>
    </article>
  )

  if (!action.ready || !action.to) return content
  return (
    <Link to={action.to} className="block rounded-3xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2">
      {content}
    </Link>
  )
}

function Panel({ title, action, children }) {
  return (
    <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-gray-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function CreationPreview({ campaign }) {
  const status = statusLabel[campaign.status] || 'Pronto'
  return (
    <article className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50 p-4">
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
        <PlayCircle className="h-4 w-4 text-primary-600" />
        Campanha, banners e materiais gerados
      </div>
    </article>
  )
}

function ProfileCard({ status }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100">
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
      <Link to={to} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary-700 hover:text-primary-800">
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

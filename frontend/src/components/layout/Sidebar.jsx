import { NavLink, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  Coins,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  Shield,
  Sparkles,
  UserCircle2,
  Zap,
} from 'lucide-react'
import { useAuth } from '../../lib/auth-context'

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/meus-imoveis', icon: LayoutGrid, label: 'Cadastro Mestre' },
  { to: '/pacotes-gerados', icon: Package, label: 'Criações' },
  { to: '/nova-campanha', icon: Sparkles, label: 'Banners Rápidos' },
  { to: '/planos', icon: Coins, label: 'Smart Tokens' },
  { to: '/configuracoes?tab=perfil', icon: BadgeCheck, label: 'Perfil Comercial', match: '/configuracoes', tab: 'perfil' },
  { to: '/configuracoes?tab=senha', icon: Settings, label: 'Configurações', match: '/configuracoes', tab: 'senha' },
]

const getTokenSnapshot = (user) => {
  const total = Number(user?.smart_tokens_total ?? user?.tokens_total ?? user?.limite_mensal ?? user?.total_disponivel ?? 0)
  const remaining = Number(user?.smart_tokens_saldo ?? user?.tokens_saldo ?? user?.restantes_mes ?? user?.total_disponivel ?? 0)
  const safeTotal = Math.max(total, remaining, 0)
  const used = Math.max(safeTotal - remaining, 0)
  const percent = safeTotal > 0 ? Math.min(100, Math.round((used / safeTotal) * 100)) : 0
  const renewal = user?.proxima_renovacao || user?.renovacao_tokens || user?.billing_cycle_anchor || null

  return {
    hasBalance: safeTotal > 0 || remaining > 0,
    remaining,
    percent,
    renewalLabel: renewal
      ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(renewal))
      : 'Próximo ciclo',
  }
}

function SidebarLink({ item }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const activeByTab = item.match
    && location.pathname === item.match
    && (!item.tab || searchParams.get('tab') === item.tab || (!searchParams.get('tab') && item.tab === 'perfil'))
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => {
        const active = item.match ? activeByTab : isActive
        return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-150 ${
          active
            ? 'bg-gray-950 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
        }`
      }}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {item.label}
    </NavLink>
  )
}

function SmartTokensPanel({ user }) {
  const snapshot = getTokenSnapshot(user)

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-950 p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-300">Smart Tokens</p>
          <p className="mt-1 text-sm font-black">Saldo disponível</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-amber-300">
          <Zap className="h-4.5 w-4.5" />
        </div>
      </div>

      <p className="mt-4 text-lg font-black">
        {snapshot.hasBalance ? `${snapshot.remaining.toLocaleString('pt-BR')} tokens` : 'Informações do plano'}
      </p>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-300"
          style={{ width: `${snapshot.hasBalance ? snapshot.percent : 18}%` }}
        />
      </div>

      <div className="mt-3 rounded-xl bg-white/5 px-3 py-2">
        <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Renovação</p>
        <p className="mt-0.5 text-xs font-bold text-gray-200">{snapshot.renewalLabel}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <NavLink
          to="/planos"
          className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-black text-white hover:bg-white/10"
        >
          Ver detalhes
        </NavLink>
        <NavLink
          to="/planos"
          className="rounded-xl bg-amber-300 px-3 py-2 text-center text-xs font-black text-gray-950 hover:bg-amber-200"
        >
          Adicionar tokens
        </NavLink>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const displayName =
    user?.displayName ||
    user?.full_name ||
    user?.nome ||
    (user?.email ? user.email.split('@')[0] : null) ||
    'Usuário'

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-950 shadow-md">
          <Zap className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">SmartCorretorAI</p>
          <p className="text-xs text-gray-400">Marketing com IA</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <SidebarLink key={item.label} item={item} />
        ))}

        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-150 ${
                isActive ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
              }`
            }
          >
            <Shield className="h-4.5 w-4.5 shrink-0" />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="space-y-3 border-t border-gray-100 px-3 py-4">
        <SmartTokensPanel user={user} />

        <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

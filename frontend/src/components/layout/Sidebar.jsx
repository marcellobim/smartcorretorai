import { NavLink, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  Box,
  Coins,
  FileText,
  Home,
  Image,
  LayoutTemplate,
  LogOut,
  Package,
  Settings,
  Shield,
  Sparkles,
  UserCircle2,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import BrandMark from '../brand/BrandMark'

const navigationGroups = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', icon: Home, label: 'Home' },
      { to: '/pacotes-gerados', icon: Package, label: 'Criações' },
    ],
  },
  {
    label: 'Criar',
    items: [
      { to: '/smart-tour-ai', icon: Video, label: 'Vídeo Imobiliário', tone: 'bg-violet-100 text-violet-700' },
      { to: '/hero', icon: Image, label: 'Banner Imobiliário', tone: 'bg-emerald-100 text-emerald-700' },
      { to: '/studio-hero', icon: Sparkles, label: 'Studio IA', tone: 'bg-blue-100 text-blue-700' },
      { to: '/virtual-staging', icon: Box, label: 'Virtual Space', tone: 'bg-cyan-100 text-cyan-700' },
      { to: '/nova-campanha', icon: LayoutTemplate, label: 'Banners Rápidos', tone: 'bg-orange-100 text-orange-700' },
      { to: '/campanha-de-textos', icon: FileText, label: 'Campanha de Textos', tone: 'bg-amber-100 text-amber-700' },
    ],
  },
]

const accountItems = [
  { to: '/configuracoes?tab=perfil', icon: BadgeCheck, label: 'Perfil Profissional', match: '/configuracoes', tab: 'perfil' },
  { to: '/configuracoes?tab=senha', icon: Settings, label: 'Configurações', match: '/configuracoes', excludeTab: 'perfil' },
]

const smartTokensItem = { to: '/planos', label: 'Smart Tokens' }

function SidebarLink({ item, onNavigate }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const selectedTab = searchParams.get('tab')
  const activeByTab = item.match
    && location.pathname === item.match
    && (
      item.excludeTab
        ? selectedTab !== item.excludeTab
        : !item.tab || selectedTab === item.tab || (!selectedTab && item.tab === 'perfil')
    )
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) => {
        const active = item.match ? activeByTab : isActive
        return `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-150 ${
          active
            ? 'bg-primary-800 text-white shadow-sm'
            : 'text-slate-600 hover:bg-primary-50 hover:text-primary-800'
        }`
      }}
    >
      {({ isActive }) => {
        const active = item.match ? activeByTab : isActive
        return (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              active ? 'bg-white/10 text-white' : item.tone || 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary-700'
            }`}>
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
          </>
        )
      }}
    </NavLink>
  )
}

function getTokenBalance(user) {
  const candidates = [
    user?.smart_tokens_saldo,
    user?.tokens_saldo,
    user?.restantes_mes,
    user?.total_disponivel,
  ]
  const value = candidates.find(candidate => candidate !== undefined && candidate !== null && candidate !== '')
  if (value === undefined) return null

  const balance = Number(value)
  return Number.isFinite(balance) ? Math.max(balance, 0) : null
}

function SmartTokensLink({ user, onNavigate }) {
  const balance = getTokenBalance(user)

  return (
    <NavLink
      to={smartTokensItem.to}
      onClick={onNavigate}
      className={({ isActive }) => `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-150 ${
        isActive
          ? 'bg-primary-800 text-white shadow-sm'
          : 'text-primary-900 hover:bg-primary-50'
      }`}
    >
      {({ isActive }) => (
        <>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/10 text-white' : 'bg-primary-100 text-primary-700 group-hover:bg-white'}`}>
            <Coins className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate">
            <span>Smart Tokens</span>
            {balance !== null && (
              <span className={`ml-1.5 text-[10px] font-semibold ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>
                {balance.toLocaleString('pt-BR')} disponíveis
              </span>
            )}
          </span>
          <span className={`text-[10px] font-black ${isActive ? 'text-white' : 'text-primary-700'}`}>
            Adicionar
          </span>
        </>
      )}
    </NavLink>
  )
}

function NavigationGroup({ group, onNavigate }) {
  return (
    <section aria-labelledby={`sidebar-${group.label.toLowerCase()}`}>
      <h2 id={`sidebar-${group.label.toLowerCase()}`} className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {group.label}
      </h2>
      <div className="mt-1.5 space-y-1">
        {group.items.map(item => (
          <SidebarLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  )
}

export default function Sidebar({ mobile = false, onClose }) {
  const { user, logout } = useAuth()
  const displayName =
    user?.displayName ||
    user?.full_name ||
    user?.nome ||
    (user?.email ? user.email.split('@')[0] : null) ||
    'Usuário'

  const handleLogout = () => {
    onClose?.()
    logout()
  }

  return (
    <aside className="flex h-dvh w-64 flex-col overflow-hidden border-r border-gray-200 bg-white" aria-label="Menu principal">
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
        <BrandMark size={36} decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">SmartCorretorAI</p>
          <p className="text-xs text-gray-400">Inteligência que vende.</p>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        {navigationGroups.map(group => (
          <NavigationGroup key={group.label} group={group} onNavigate={onClose} />
        ))}

        <section aria-labelledby="sidebar-conta">
          <h2 id="sidebar-conta" className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Conta
          </h2>
          <div className="mt-1.5 space-y-1">
            <SmartTokensLink user={user} onNavigate={onClose} />
            {accountItems.map(item => (
              <SidebarLink key={item.label} item={item} onNavigate={onClose} />
            ))}
          </div>
        </section>

        {user?.role === 'admin' && (
          <section aria-labelledby="sidebar-administracao">
            <h2 id="sidebar-administracao" className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Administração
            </h2>
            <div className="mt-1.5">
              <SidebarLink item={{ to: '/admin', icon: Shield, label: 'Admin' }} onNavigate={onClose} />
            </div>
          </section>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-100 p-3">
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
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

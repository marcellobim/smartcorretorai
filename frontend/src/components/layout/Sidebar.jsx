import { visibleProducts } from '../../config/productAvailability'
import { BRAND } from '../../config/brand'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Box,
  Coins,
  FileText,
  Home,
  Image,
  LayoutTemplate,
  LogOut,
  Radar,
  Settings,
  Shield,
  Sparkles,
  UserCircle2,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import MarketSelector from '../i18n/MarketSelector'
import toast from 'react-hot-toast'
import { formatSmartTokens, getSmartTokenBalance, isTrialUser } from '../../lib/smart-tokens'
import BrandMark from '../brand/BrandMark'
import { useLocale } from '../../i18n/useLocale'

const navigationGroups = t => [
  {
    id: 'principal',
    label: t('navigation.principal'),
    items: [
      { to: '/dashboard', icon: Home, label: t('navigation.home') },
      { to: '/raio-x-anuncio', icon: Radar, label: t('navigation.adRadar') },
    ],
  },
  {
    id: 'criar',
    label: t('navigation.create'),
    items: [
      { to: '/smart-tour-ai', icon: Video, label: t('navigation.realEstateVideo') },
      { to: '/hero', icon: Image, label: t('navigation.realEstateBanner') },
      { to: '/studio-hero', icon: Sparkles, label: t('navigation.aiStudio') },
      { to: '/virtual-staging', icon: Box, label: t('navigation.smartSpace') },
      { to: '/nova-campanha', icon: LayoutTemplate, label: t('navigation.quickBanners') },
      { to: '/campanha-de-textos', icon: FileText, label: t('navigation.textCampaign') },
    ],
  },
]

const customerNavigationGroups = t => navigationGroups(t).map(group => ({ ...group, items: visibleProducts(group.items) })).filter(group => group.items.length)

const accountItems = t => [
  { to: '/configuracoes?tab=cadastro', icon: Settings, label: t('navigation.settings') },
]

const smartTokensItem = t => ({ to: '/planos', label: t('sidebar.smartTokens.label') })

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
              active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary-700'
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

function SmartTokensLink({ profile, onNavigate, t }) {
  const balance = getSmartTokenBalance({ saldo_creditos: profile?.saldo_creditos })
  const trial = isTrialUser(profile)
  const showBalance = balance !== null && (!trial || balance > 0)
  const item = smartTokensItem(t)

  return (
    <div>
      {showBalance && (
        <p className="px-3 pb-1 text-xs font-bold text-slate-500">
          {t('sidebar.smartTokens.balance')} <span className="font-black text-primary-800">{formatSmartTokens(balance)} {t('sidebar.smartTokens.unit')}</span>
        </p>
      )}
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) => `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-150 ${
          isActive
            ? 'bg-primary-800 text-white shadow-sm'
            : 'text-primary-900 hover:bg-primary-50'
        }`}
      >
        {({ isActive }) => (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-primary-700'}`}>
              <Coins className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className={`text-[10px] font-black ${isActive ? 'text-white' : 'text-primary-700'}`}>
              {t('sidebar.smartTokens.add')}
            </span>
          </>
        )}
      </NavLink>
    </div>
  )
}

function NavigationGroup({ group, onNavigate }) {
  return (
    <section aria-labelledby={`sidebar-${group.id}`}>
      <h2 id={`sidebar-${group.id}`} className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
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
  const { user, profile, logout, isAdmin } = useAuth()
  const { t } = useLocale()
  const displayName =
    user?.displayName ||
    user?.full_name ||
    user?.nome ||
    (user?.email ? user.email.split('@')[0] : null) ||
    t('sidebar.userFallback')

  const handleLogout = async () => {
    try {
      await logout()
      onClose?.()
    } catch {
      toast.error('Não foi possível encerrar sua sessão. Tente novamente.')
    }
  }

  return (
    <aside className="flex h-dvh w-64 flex-col overflow-hidden border-r border-gray-200 bg-white" aria-label={t('sidebar.mainMenu')}>
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
        <BrandMark size={36} decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{BRAND.name}</p>
          <p className="text-xs text-gray-400">{t('sidebar.tagline')}</p>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={t('sidebar.closeMenu')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        <section aria-labelledby="sidebar-language">
          <h2 id="sidebar-language" className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Idioma / Language
          </h2>
          <MarketSelector className="mt-1.5" />
        </section>
        {customerNavigationGroups(t).map(group => (
          <NavigationGroup key={group.id} group={group} onNavigate={onClose} />
        ))}

        <section aria-labelledby="sidebar-conta">
          <h2 id="sidebar-conta" className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {t('navigation.account')}
          </h2>
          <div className="mt-1.5 space-y-1">
            <SmartTokensLink profile={profile} onNavigate={onClose} t={t} />
            {accountItems(t).map(item => (
              <SidebarLink key={item.label} item={item} onNavigate={onClose} />
            ))}
          </div>
        </section>

        {isAdmin && (
          <section aria-labelledby="sidebar-administracao">
            <h2 id="sidebar-administracao" className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              {t('navigation.administration')}
            </h2>
            <div className="mt-1.5">
              <SidebarLink item={{ to: '/admin', icon: Shield, label: t('navigation.admin') }} onNavigate={onClose} />
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
            title={t('sidebar.logout')}
            aria-label={t('sidebar.logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

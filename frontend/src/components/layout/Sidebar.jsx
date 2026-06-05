import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Settings,
  Crown,
  CreditCard,
  LogOut,
  Zap,
  Shield,
} from 'lucide-react'
import { useAuth } from '../../lib/auth-context'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/nova-campanha', icon: Sparkles, label: 'Nova Campanha' },
  { to: '/pacotes-gerados', icon: Package, label: 'Campanhas Geradas' },
  { to: '/planos', icon: CreditCard, label: 'Banco de Créditos' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export default function Sidebar() {
  const { user, logout, isPro } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-30">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">SmartCorretorAI</p>
          <p className="text-xs text-gray-400">Marketing com IA</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </NavLink>
        ))}
        
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Shield className="w-4.5 h-4.5 shrink-0" />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100 space-y-2">
        {!isPro && (
          <NavLink
            to="/planos"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary-600 to-accent-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Crown className="w-4 h-4" />
            Upgrade para Pro
          </NavLink>
        )}

        {(() => {
          const nomeExibicao =
            user?.displayName ||
            user?.full_name ||
            user?.nome ||
            (user?.email ? user.email.split('@')[0] : null) ||
            'Usuário'
          return (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary-700">
                  {nomeExibicao.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{nomeExibicao}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
            )
          })()}
      </div>
    </aside>
  )
}

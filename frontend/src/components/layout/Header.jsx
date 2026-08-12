import { Bell, HelpCircle, Menu } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context'
import { Badge } from '../ui/Badge'

export default function Header({ title, subtitle }) {
  const { isPro } = useAuth()
  const { mobileMenuOpen = false, openMobileMenu } = useOutletContext() || {}

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-blue-100 bg-white px-4 py-2 sm:px-6" data-app-header>
      <div className="flex min-w-0 items-center gap-3">
        {openMobileMenu && (
          <button
            type="button"
            onClick={openMobileMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-800 transition-colors hover:bg-primary-50 lg:hidden"
            aria-label="Abrir menu"
            aria-controls="mobile-sidebar"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isPro && (
          <Badge variant="primary" className="hidden sm:flex">
            ✨ Pro
          </Badge>
        )}
        <button type="button" aria-label="Notificações" className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-800 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-500 rounded-full" />
        </button>
        <button type="button" aria-label="Ajuda" className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-800 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}

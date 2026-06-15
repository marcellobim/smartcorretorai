import { Bell, HelpCircle } from 'lucide-react'
import { useAuth } from '../../lib/auth-context'
import { Badge } from '../ui/Badge'

export default function Header({ title, subtitle }) {
  const { user, isPro } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-blue-100 flex items-center justify-between px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {isPro && (
          <Badge variant="primary" className="hidden sm:flex">
            ✨ Pro
          </Badge>
        )}
        <button className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-800 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary-500 rounded-full" />
        </button>
        <button className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-800 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}

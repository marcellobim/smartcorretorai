import { Link } from 'react-router-dom'
import { BRAND } from '../../config/brand'
import { useAnalytics } from '../analytics/AnalyticsProvider'
import { SMART_UI } from '../design-system'

const footerLinks = [
  { label: 'Termos de Uso', to: '/termos' },
  { label: 'Política de Privacidade', to: '/privacidade' },
]

export default function AppFooter() {
  const { openCookiePreferences } = useAnalytics()

  return (
    <footer className="mt-8 border-t border-slate-200/80 bg-white/60" data-app-footer>
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-3 px-smart-page py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:py-5 sm:text-left">
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">
          © 2026 {BRAND.name}.
        </p>
        <nav aria-label="Rodapé" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-slate-600 sm:justify-end sm:text-sm">
          {footerLinks.map(link => (
            <Link key={link.label} to={link.to} className={`inline-flex min-h-10 items-center transition hover:text-primary-700 motion-reduce:transition-none ${SMART_UI.focus}`}>
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={openCookiePreferences} className={`inline-flex min-h-10 items-center transition hover:text-primary-700 motion-reduce:transition-none ${SMART_UI.focus}`}>
            Preferências de cookies
          </button>
          <a href="mailto:suporte@smartcorretorai.com" className={`inline-flex min-h-10 items-center transition hover:text-primary-700 motion-reduce:transition-none ${SMART_UI.focus}`}>
            Suporte
          </a>
        </nav>
      </div>
    </footer>
  )
}

import { Link } from 'react-router-dom'
import { SMART_UI } from '../design-system'

const footerLinks = [
  { label: 'Planos', to: '/planos' },
  { label: 'Smart Tokens', to: '/planos' },
  { label: 'Termos de Uso', to: '/termos' },
  { label: 'Privacidade', to: '/privacidade' },
]

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200/80 bg-white/50" data-app-footer>
      <div className="mx-auto w-full max-w-[92rem] px-smart-page py-6 text-center sm:py-7">
        <nav aria-label="Rodapé" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-bold text-slate-600 sm:text-sm">
          <span className="font-black text-slate-900">SmartCorretorAI</span>
          <span aria-hidden="true">·</span>
          {footerLinks.map(link => (
            <span key={link.label} className="contents">
              <Link to={link.to} className={`transition hover:text-primary-700 motion-reduce:transition-none ${SMART_UI.focus}`}>
                {link.label}
              </Link>
              <span aria-hidden="true">·</span>
            </span>
          ))}
          <a href="mailto:suporte@smartcorretorai.com" className={`transition hover:text-primary-700 motion-reduce:transition-none ${SMART_UI.focus}`}>
            Suporte
          </a>
        </nav>

        <p className="mx-auto mt-4 max-w-4xl text-xs font-medium leading-5 text-slate-500 sm:text-sm sm:leading-6">
          Conteúdos gerados com inteligência artificial podem conter erros ou imprecisões. Revise as informações e o material antes da publicação.
        </p>
        <p className="mt-2 text-xs font-medium text-slate-400">
          © 2026 SmartCorretorAI. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

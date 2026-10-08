import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isBannersRapidos = location.pathname === '/nova-campanha'
  const usesFullWidthMobileLayout = location.pathname === '/dashboard' || isBannersRapidos || location.pathname === '/campanha-de-textos' || location.pathname === '/smart-carrossel' || location.pathname === '/studio-hero' || location.pathname === '/studio-galeria' || location.pathname === '/smart-tour-ai' || location.pathname === '/virtual-staging' || location.pathname === '/hero'
  const usesStandaloneMobileMenuButton = location.pathname === '/smart-carrossel' || location.pathname === '/studio-hero' || location.pathname === '/studio-galeria'

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!mobileMenuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileMenuOpen])

  return (
    <div className="flex min-h-screen items-start bg-slate-50" data-full-width-mobile-layout={usesFullWidthMobileLayout || undefined}>
      <div className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">
        <Sidebar />
      </div>

      {usesStandaloneMobileMenuButton && !mobileMenuOpen && (
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary-800 shadow-lg lg:hidden"
          aria-label="Abrir menu"
          aria-controls="mobile-sidebar"
          aria-expanded="false"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {mobileMenuOpen && (
        <div id="mobile-sidebar" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            aria-label="Fechar menu"
          />
          <div className="relative h-dvh w-64 max-w-[85vw] shadow-2xl">
            <Sidebar mobile onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1">
          <Outlet context={{ mobileMenuOpen, openMobileMenu: () => setMobileMenuOpen(true) }} />
        </main>
      </div>
    </div>
  )
}

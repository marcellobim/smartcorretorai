import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const location = useLocation()
  const isBannersRapidos = location.pathname === '/nova-campanha'
  const usesFullWidthMobileLayout = location.pathname === '/dashboard' || isBannersRapidos || location.pathname === '/smart-carrossel' || location.pathname === '/studio-hero' || location.pathname === '/studio-galeria' || location.pathname === '/hero'

  return (
    <div className="flex min-h-screen items-start bg-slate-50">
      <div className={usesFullWidthMobileLayout ? 'hidden w-64 shrink-0 lg:block' : 'w-64 shrink-0'}>
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

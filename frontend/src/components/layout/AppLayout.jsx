import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const location = useLocation()
  const isBannersRapidos = location.pathname === '/nova-campanha'

  return (
    <div className="flex min-h-screen items-start bg-slate-50">
      <div className={isBannersRapidos ? 'hidden w-64 shrink-0 lg:block' : 'w-64 shrink-0'}>
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

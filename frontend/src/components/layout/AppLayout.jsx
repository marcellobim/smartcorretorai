import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const location = useLocation()
  const isBannersRapidos = location.pathname === '/nova-campanha'

  return (
    <div className="flex h-screen bg-slate-50">
      <div className={isBannersRapidos ? 'hidden lg:block' : 'contents'}>
        <Sidebar />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${isBannersRapidos ? 'ml-0 lg:ml-64' : 'ml-64'}`}>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

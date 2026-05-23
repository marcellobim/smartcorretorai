import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth-context'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import NovaCompanha from './pages/NovaCampanha'
import MeusImoveis from './pages/MeusImoveis'
import PacotesGerados from './pages/PacotesGerados'
import Configuracoes from './pages/Configuracoes'
import Planos from './pages/Planos'
import TermosDeUso from './pages/TermosDeUso'
import Privacidade from './pages/Privacidade'
import AdminDashboard from './pages/AdminDashboard'

function PrivateRoute({ children }) {
  const { user } = useAuthStore()
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuthStore()
  return !user ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  // O AuthProvider já hidrata a sessão sozinho via onAuthStateChange
  // (lib/auth-context.jsx). Antes havia um useAuthStore(s => s.init) aqui
  // que duplicava a hidratação — removido junto com a função init.
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/planos" element={<Planos />} />
      <Route path="/termos" element={<TermosDeUso />} />
      <Route path="/privacidade" element={<Privacidade />} />
      <Route
        path="/login"
        element={<PublicRoute><LoginPage /></PublicRoute>}
      />
      <Route
        path="/cadastro"
        element={<PublicRoute><RegisterPage /></PublicRoute>}
      />
      <Route
        path="/admin"
        element={<AdminRoute><AdminDashboard /></AdminRoute>}
      />
      <Route
        element={<PrivateRoute><AppLayout /></PrivateRoute>}
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/nova-campanha" element={<NovaCompanha />} />
        <Route path="/meus-imoveis" element={<MeusImoveis />} />
        <Route path="/pacotes-gerados" element={<PacotesGerados />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

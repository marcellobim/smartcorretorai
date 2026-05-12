import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
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

function PrivateRoute({ children }) {
  const { user } = useAuthStore()
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user } = useAuthStore()
  return !user ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/planos" element={<Planos />} />
      <Route
        path="/login"
        element={<PublicRoute><LoginPage /></PublicRoute>}
      />
      <Route
        path="/cadastro"
        element={<PublicRoute><RegisterPage /></PublicRoute>}
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

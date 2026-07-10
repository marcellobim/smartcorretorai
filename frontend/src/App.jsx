import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth-context'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import HomeFrankenstein from './pages/HomeFrankenstein'
import HomeOpusExperiment from './pages/HomeOpusExperiment'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import Hero from './pages/Hero'
import HeroNext from './pages/HeroNext'
import TransformarVideo from './pages/TransformarVideo'
import SmartVideo from './pages/SmartVideo'
import StudioHero from './pages/StudioHero'
import NovaCompanha from './pages/NovaCampanha'
import MeusImoveis from './pages/MeusImoveis'
import PacotesGerados from './pages/PacotesGerados'
import Configuracoes from './pages/Configuracoes'
import Planos from './pages/Planos'
import TermosDeUso from './pages/TermosDeUso'
import Privacidade from './pages/Privacidade'
import AdminDashboard from './pages/AdminDashboard'

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <RouteLoader />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <RouteLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <RouteLoader />
  return !user ? children : <Navigate to="/dashboard" replace />
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-800" />
    </div>
  )
}

export default function App() {
  // O AuthProvider já hidrata a sessão sozinho via onAuthStateChange
  // (lib/auth-context.jsx). Antes havia um useAuthStore(s => s.init) aqui
  // que duplicava a hidratação — removido junto com a função init.
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home-frankenstein" element={<HomeFrankenstein />} />
      <Route path="/home-opus" element={<HomeOpusExperiment />} />
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
        <Route path="/hero" element={<HeroNext />} />
        <Route path="/hero-legacy" element={<Hero />} />
        <Route path="/studio-hero" element={<StudioHero />} />
        <Route path="/transformar-video" element={<TransformarVideo />} />
        <Route path="/smart-video" element={<SmartVideo />} />
        <Route path="/nova-campanha" element={<NovaCompanha />} />
        <Route path="/meus-imoveis" element={<MeusImoveis />} />
        <Route path="/pacotes-gerados" element={<PacotesGerados />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

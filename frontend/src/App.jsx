import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth-context'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import LegalOnboardingPage from './pages/LegalOnboardingPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Dashboard from './pages/Dashboard'
import HeroNext from './pages/HeroNext'
import TransformarVideo from './pages/TransformarVideo'
import StudioHero from './pages/StudioHero'
import StudioGallery from './pages/StudioGallery'
import SmartCarrossel from './pages/SmartCarrossel'
import SmartTourAI from './pages/SmartTourAI'
import VirtualStaging from './pages/VirtualStaging'
import NovaCompanha from './pages/NovaCampanha'
import TextCampaign from './pages/TextCampaign'
import RaioXAnuncio from './pages/RaioXAnuncio'
import Configuracoes from './pages/Configuracoes'
import Planos from './pages/Planos'
import TermosDeUso from './pages/TermosDeUso'
import Privacidade from './pages/Privacidade'
import AdminDashboard from './pages/AdminDashboard'
import AdminMfaGate from './components/auth/AdminMfaGate'

function AdminRoute({ children }) {
  const { user, loading, isAdmin, onboardingState } = useAuthStore()
  if (loading || onboardingState === 'checking') return <RouteLoader />
  if (!user) return <Navigate to="/login" replace />
  if (onboardingState === 'needs_acceptance') return <Navigate to="/aceite-legal" replace />
  if (onboardingState === 'admin_blocked' || onboardingState === 'error') return <AuthGateError />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <AdminMfaGate>{children}</AdminMfaGate>
}

function PublicRoute({ children }) {
  const { user, loading, onboardingState } = useAuthStore()
  if (loading || onboardingState === 'checking') return <RouteLoader />
  if (!user) return children
  if (onboardingState === 'needs_acceptance') return <Navigate to="/aceite-legal" replace />
  if (onboardingState === 'admin_blocked' || onboardingState === 'error') return <AuthGateError />
  return <Navigate to="/dashboard" replace />
}

function OnboardingPrivateRoute({ children }) {
  const { user, loading, onboardingState } = useAuthStore()
  if (loading || onboardingState === 'checking') return <RouteLoader />
  if (!user) return <Navigate to="/login" replace />
  if (onboardingState === 'needs_acceptance') return <Navigate to="/aceite-legal" replace />
  if (onboardingState === 'admin_blocked' || onboardingState === 'error') return <AuthGateError />
  return children
}

function AuthGateError() {
  const { signOut } = useAuthStore()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl">
        <h1 className="text-xl font-black text-slate-950">Não foi possível concluir a autenticação</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Entre novamente com e-mail e senha. Contas administrativas não utilizam Google nesta versão.</p>
        <button type="button" onClick={() => signOut()} className="mt-6 rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-800">Voltar para o login</button>
      </section>
    </main>
  )
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
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/aceite-legal" element={<LegalOnboardingPage />} />
      <Route
        path="/esqueci-senha"
        element={<PublicRoute><ForgotPasswordPage /></PublicRoute>}
      />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route
        path="/admin"
        element={<AdminRoute><AdminDashboard /></AdminRoute>}
      />
      <Route element={<OnboardingPrivateRoute><AppLayout /></OnboardingPrivateRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hero" element={<HeroNext />} />
        <Route path="/studio-hero" element={<StudioHero />} />
        <Route path="/studio-galeria" element={<StudioGallery />} />
        <Route path="/smart-carrossel" element={<SmartCarrossel />} />
        <Route path="/smart-tour-ai" element={<SmartTourAI />} />
        <Route path="/virtual-staging" element={<VirtualStaging />} />
        <Route path="/transformar-video" element={<TransformarVideo />} />
        <Route path="/nova-campanha" element={<NovaCompanha />} />
        <Route path="/campanha-de-textos" element={<TextCampaign />} />
        <Route path="/raio-x-anuncio" element={<RaioXAnuncio />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

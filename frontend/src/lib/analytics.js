const ANALYTICS_CONSENT_KEY = 'smartcorretor_analytics_consent'
const GOOGLE_TAG_SCRIPT_ID = 'smartcorretor-ga4'

const SAFE_ROUTE_TITLES = Object.freeze({
  '/': 'SmartCorretorAI',
  '/planos': 'Planos',
  '/termos': 'Termos de Uso',
  '/privacidade': 'Política de Privacidade',
  '/login': 'Login',
  '/cadastro': 'Cadastro',
  '/esqueci-senha': 'Recuperação de senha',
  '/redefinir-senha': 'Redefinição de senha',
  '/admin': 'Admin',
  '/dashboard': 'Home',
  '/hero': 'Banner Imobiliário',
  '/studio-hero': 'Studio IA',
  '/studio-galeria': 'Studio IA',
  '/smart-carrossel': 'Smart Carrossel',
  '/smart-tour-ai': 'Vídeo Imobiliário',
  '/virtual-staging': 'Smart Space',
  '/transformar-video': 'Vídeos Curtos',
  '/nova-campanha': 'Banners Rápidos',
  '/campanha-de-textos': 'Campanha de Textos',
  '/configuracoes': 'Configurações',
})

const ALLOWED_FUNNEL_EVENTS = new Set([
  'sign_up_started',
  'sign_up_completed',
  'login_completed',
  'view_plans',
  'checkout_started',
])

const recentEvents = new Map()
let analyticsInitialized = false

export const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || ''

export function isAnalyticsConfigured() {
  return /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)
}

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function storeAnalyticsConsent(value) {
  if (typeof window === 'undefined' || !['granted', 'denied'].includes(value)) return
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
  } catch {
    // Storage indisponível: mantém a escolha somente nesta sessão React.
  }
}

export function sanitizeAnalyticsPath(pathname) {
  if (typeof pathname !== 'string') return null
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return Object.prototype.hasOwnProperty.call(SAFE_ROUTE_TITLES, normalized) ? normalized : null
}

function safeAbsoluteUrl(pathname) {
  const path = sanitizeAnalyticsPath(pathname)
  if (!path || typeof window === 'undefined') return null
  return `${window.location.origin}${path}`
}

function safeInitialReferrer() {
  if (typeof document === 'undefined' || !document.referrer) return undefined
  try {
    const referrer = new URL(document.referrer)
    if (typeof window !== 'undefined' && referrer.origin === window.location.origin) {
      return safeAbsoluteUrl(referrer.pathname) || referrer.origin
    }
    return referrer.origin
  } catch {
    return undefined
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments) }
  return window.gtag
}

export async function initializeAnalytics() {
  if (!isAnalyticsConfigured() || typeof window === 'undefined') return false
  if (analyticsInitialized) return true

  const gtag = ensureGtag()
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })
  gtag('set', 'ads_data_redaction', true)
  gtag('consent', 'update', { analytics_storage: 'granted' })
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: safeAbsoluteUrl(window.location.pathname) || window.location.origin,
    page_referrer: safeInitialReferrer(),
  })

  if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = GOOGLE_TAG_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
    document.head.appendChild(script)
  }

  analyticsInitialized = true
  return true
}

export function revokeAnalyticsConsent() {
  if (typeof window === 'undefined') return
  if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' })
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim()
    if (name === '_ga' || name?.startsWith('_ga_')) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    }
  })
}

export function trackPageView(pathname, previousPathname = null) {
  if (!analyticsInitialized || getAnalyticsConsent() !== 'granted' || !window.gtag) return false
  const path = sanitizeAnalyticsPath(pathname)
  if (!path) return false
  const previousPath = sanitizeAnalyticsPath(previousPathname)
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: safeAbsoluteUrl(path),
    page_title: SAFE_ROUTE_TITLES[path],
    page_referrer: previousPath ? safeAbsoluteUrl(previousPath) : safeInitialReferrer(),
  })
  return true
}

export function trackFunnelEvent(eventName) {
  if (!analyticsInitialized || getAnalyticsConsent() !== 'granted' || !window.gtag) return false
  if (!ALLOWED_FUNNEL_EVENTS.has(eventName)) return false
  const now = Date.now()
  if (now - (recentEvents.get(eventName) || 0) < 1000) return false
  recentEvents.set(eventName, now)
  window.gtag('event', eventName)
  return true
}

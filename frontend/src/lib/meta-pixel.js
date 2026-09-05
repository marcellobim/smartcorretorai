import { getMarketingConsent, sanitizeAnalyticsPath } from './analytics.js'

const META_PIXEL_SCRIPT_ID = 'smartcorretor-meta-pixel'
const META_PIXEL_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js'
const META_PIXEL_COOKIE_NAMES = new Set(['_fbp', '_fbc'])
const PRODUCTION_HOSTS = new Set([
  'smartcorretorai.com',
  'www.smartcorretorai.com',
  'smartcorretorai.vercel.app',
])

let metaPixelInitialized = false
let metaConsentActive = false

export const META_PIXEL_ID = import.meta.env?.VITE_META_PIXEL_ID?.trim() || ''

export function isMetaPixelConfigured(pixelId = META_PIXEL_ID) {
  return /^\d{15,20}$/.test(pixelId)
}

export function isMetaPixelRuntimeAllowed({
  pixelId = META_PIXEL_ID,
  production = import.meta.env?.PROD === true,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
} = {}) {
  return production && PRODUCTION_HOSTS.has(hostname) && isMetaPixelConfigured(pixelId)
}

function ensureFbq() {
  if (window.fbq) return window.fbq
  const fbq = function fbq() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments) }
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  window._fbq = fbq
  return fbq
}

export async function initializeMetaPixel(options) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (!isMetaPixelRuntimeAllowed(options) || getMarketingConsent() !== 'granted') return false

  const pixelId = options?.pixelId || META_PIXEL_ID
  const fbq = ensureFbq()
  if (!metaPixelInitialized) {
    // Impede a detecção/configuração automática de eventos pelo Pixel.
    fbq('set', 'autoConfig', false, pixelId)
    // Sem objeto de dados do usuário: Advanced Matching permanece desativado.
    fbq('init', pixelId)

    if (!document.getElementById(META_PIXEL_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = META_PIXEL_SCRIPT_ID
      script.async = true
      script.src = META_PIXEL_SCRIPT_URL
      document.head.appendChild(script)
    }
    metaPixelInitialized = true
  }

  if (!metaConsentActive) fbq('consent', 'grant')
  metaConsentActive = true
  return true
}

export function trackMetaPageView(pathname) {
  if (!metaPixelInitialized || !metaConsentActive || getMarketingConsent() !== 'granted' || !window.fbq) return false
  if (!sanitizeAnalyticsPath(pathname)) return false
  window.fbq('track', 'PageView')
  return true
}

export function trackMetaCompleteRegistration() {
  if (!metaPixelInitialized || !metaConsentActive || getMarketingConsent() !== 'granted' || !window.fbq) return false
  window.fbq('track', 'CompleteRegistration')
  return true
}

function expireMetaCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
  if (window.location.hostname === 'smartcorretorai.com' || window.location.hostname.endsWith('.smartcorretorai.com')) {
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.smartcorretorai.com; SameSite=Lax`
  }
}

export function revokeMetaConsent() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  metaConsentActive = false
  if (window.fbq && metaPixelInitialized) window.fbq('consent', 'revoke')

  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim()
    if (META_PIXEL_COOKIE_NAMES.has(name)) expireMetaCookie(name)
  })
}

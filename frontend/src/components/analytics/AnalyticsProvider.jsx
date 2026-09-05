import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getTrackingConsent,
  initializeAnalytics,
  isAnalyticsConfigured,
  revokeAnalyticsConsent,
  sanitizeAnalyticsPath,
  storeTrackingConsent,
  trackFunnelEvent,
  trackPageView,
} from '../../lib/analytics'
import {
  initializeMetaPixel,
  isMetaPixelConfigured,
  revokeMetaConsent,
  trackMetaCompleteRegistration,
  trackMetaPageView,
} from '../../lib/meta-pixel'
import { createMetaRegistrationDispatcher } from '../../lib/meta-registration-dispatcher'

const AnalyticsContext = createContext({
  openCookiePreferences: () => {},
  trackRegistration: () => false,
  trackEvent: () => false,
})

export function useAnalytics() {
  return useContext(AnalyticsContext)
}

export default function AnalyticsProvider({ children }) {
  const location = useLocation()
  const analyticsConfigured = isAnalyticsConfigured()
  const metaConfigured = isMetaPixelConfigured()
  const configured = analyticsConfigured || metaConfigured
  const [consent, setConsent] = useState(() => configured ? getTrackingConsent() : null)
  const [analyticsReady, setAnalyticsReady] = useState(false)
  const [metaReady, setMetaReady] = useState(false)
  const [showPreferences, setShowPreferences] = useState(() => configured && !getTrackingConsent())
  const lastAnalyticsPathRef = useRef(null)
  const lastMetaPathRef = useRef(null)
  const marketingConsentRef = useRef(consent?.marketing)
  const metaReadyRef = useRef(metaReady)
  const metaRegistrationDispatcherRef = useRef(null)
  marketingConsentRef.current = consent?.marketing
  metaReadyRef.current = metaReady
  if (!metaRegistrationDispatcherRef.current) {
    metaRegistrationDispatcherRef.current = createMetaRegistrationDispatcher({
      isMarketingGranted: () => marketingConsentRef.current === 'granted',
      isReady: () => metaReadyRef.current,
      send: trackMetaCompleteRegistration,
    })
  }

  useEffect(() => {
    if (!analyticsConfigured || consent?.analytics !== 'granted') {
      setAnalyticsReady(false)
      return
    }
    let active = true
    void initializeAnalytics().then(initialized => {
      if (active) setAnalyticsReady(initialized)
    })
    return () => { active = false }
  }, [analyticsConfigured, consent?.analytics])

  useEffect(() => {
    if (!metaConfigured || consent?.marketing !== 'granted') {
      metaRegistrationDispatcherRef.current.revoke()
      metaReadyRef.current = false
      setMetaReady(false)
      return
    }
    let active = true
    void initializeMetaPixel().then(initialized => {
      if (active) {
        metaReadyRef.current = initialized
        setMetaReady(initialized)
      }
    })
    return () => { active = false }
  }, [consent?.marketing, metaConfigured])

  useEffect(() => {
    if (!analyticsReady || consent?.analytics !== 'granted') return
    const safePath = sanitizeAnalyticsPath(location.pathname)
    if (!safePath || safePath === lastAnalyticsPathRef.current) return
    trackPageView(safePath, lastAnalyticsPathRef.current)
    lastAnalyticsPathRef.current = safePath
  }, [analyticsReady, consent?.analytics, location.pathname])

  useEffect(() => {
    if (!metaReady || consent?.marketing !== 'granted') return
    const safePath = sanitizeAnalyticsPath(location.pathname)
    if (!safePath || safePath === lastMetaPathRef.current) return
    if (trackMetaPageView(safePath)) lastMetaPathRef.current = safePath
  }, [consent?.marketing, location.pathname, metaReady])

  useEffect(() => {
    if (consent?.marketing !== 'granted') {
      metaRegistrationDispatcherRef.current.revoke()
      return
    }
    if (metaReady) metaRegistrationDispatcherRef.current.flush()
  }, [consent?.marketing, metaReady])

  const trackEvent = useCallback(eventName => {
    if (!analyticsReady || consent?.analytics !== 'granted') return false
    return trackFunnelEvent(eventName)
  }, [analyticsReady, consent?.analytics])

  const trackRegistration = useCallback(
    () => metaRegistrationDispatcherRef.current.request(),
    [],
  )

  const openCookiePreferences = useCallback(() => {
    if (configured) setShowPreferences(true)
  }, [configured])

  const chooseConsent = useCallback(async value => {
    marketingConsentRef.current = value.marketing
    if (value.marketing !== 'granted') metaRegistrationDispatcherRef.current.revoke()
    storeTrackingConsent(value)
    setConsent(value)
    setShowPreferences(false)
    if (value.analytics === 'granted' && analyticsConfigured) {
      setAnalyticsReady(await initializeAnalytics())
    } else {
      revokeAnalyticsConsent()
      setAnalyticsReady(false)
      lastAnalyticsPathRef.current = null
    }
    if (value.marketing === 'granted' && metaConfigured) {
      const initialized = await initializeMetaPixel()
      metaReadyRef.current = initialized
      setMetaReady(initialized)
    } else {
      revokeMetaConsent()
      metaReadyRef.current = false
      setMetaReady(false)
      lastMetaPathRef.current = null
    }
  }, [analyticsConfigured, metaConfigured])

  return (
    <AnalyticsContext.Provider value={{ openCookiePreferences, trackEvent, trackRegistration }}>
      {children}
      {configured && showPreferences && (
        <section
          aria-label="Preferências de cookies"
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        >
          <h2 className="text-base font-black text-slate-950">Cookies</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
            Usamos cookies necessários para o site e, somente com sua autorização, cookies de análise (GA4) e de medição de marketing (Meta Pixel). Você pode escolher apenas análise, aceitar ambos ou continuar somente com os necessários.{' '}
            <Link to="/privacidade" className="font-bold text-primary-700 hover:underline">Saiba mais</Link>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => chooseConsent({ analytics: 'denied', marketing: 'denied' })} className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50">
              Somente necessários
            </button>
            <button type="button" onClick={() => chooseConsent({ analytics: 'granted', marketing: 'denied' })} className="min-h-12 rounded-xl border border-primary-300 px-4 py-3 text-sm font-black text-primary-800 hover:bg-primary-50">
              Aceitar somente análise
            </button>
            <button type="button" onClick={() => chooseConsent({ analytics: 'granted', marketing: 'granted' })} className="min-h-12 rounded-xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
              Aceitar análise e marketing
            </button>
          </div>
        </section>
      )}
    </AnalyticsContext.Provider>
  )
}

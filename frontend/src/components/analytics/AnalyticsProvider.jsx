import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  getAnalyticsConsent,
  initializeAnalytics,
  isAnalyticsConfigured,
  revokeAnalyticsConsent,
  sanitizeAnalyticsPath,
  storeAnalyticsConsent,
  trackFunnelEvent,
  trackPageView,
} from '../../lib/analytics'

const AnalyticsContext = createContext({ trackEvent: () => false })

export function useAnalytics() {
  return useContext(AnalyticsContext)
}

export default function AnalyticsProvider({ children }) {
  const location = useLocation()
  const configured = isAnalyticsConfigured()
  const [consent, setConsent] = useState(() => configured ? getAnalyticsConsent() : null)
  const [ready, setReady] = useState(false)
  const [showPreferences, setShowPreferences] = useState(() => configured && !getAnalyticsConsent())
  const lastPathRef = useRef(null)

  useEffect(() => {
    if (consent !== 'granted') {
      setReady(false)
      return
    }
    let active = true
    void initializeAnalytics().then(initialized => {
      if (active) setReady(initialized)
    })
    return () => { active = false }
  }, [consent])

  useEffect(() => {
    if (!ready || consent !== 'granted') return
    const safePath = sanitizeAnalyticsPath(location.pathname)
    if (!safePath || safePath === lastPathRef.current) return
    trackPageView(safePath, lastPathRef.current)
    lastPathRef.current = safePath
  }, [consent, location.pathname, ready])

  const trackEvent = useCallback(eventName => {
    if (!ready || consent !== 'granted') return false
    return trackFunnelEvent(eventName)
  }, [consent, ready])

  const chooseConsent = useCallback(async value => {
    storeAnalyticsConsent(value)
    setConsent(value)
    setShowPreferences(false)
    if (value === 'granted') {
      setReady(await initializeAnalytics())
    } else {
      revokeAnalyticsConsent()
      setReady(false)
      lastPathRef.current = null
    }
  }, [])

  return (
    <AnalyticsContext.Provider value={{ trackEvent }}>
      {children}
      {configured && (
        <>
          {showPreferences ? (
            <section
              aria-label="Preferências de cookies"
              className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            >
              <h2 className="text-base font-black text-slate-950">Cookies de análise</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Podemos usar Google Analytics 4 para medir páginas visitadas, origem do tráfego e interações agregadas. Não enviamos dados de cadastro, conteúdo privado ou informações de pagamento. Você pode aceitar ou recusar sem afetar o funcionamento do site.{' '}
                <Link to="/privacidade" className="font-bold text-primary-700 hover:underline">Saiba mais</Link>.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => chooseConsent('denied')} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50">
                  Recusar Analytics
                </button>
                <button type="button" onClick={() => chooseConsent('granted')} className="rounded-xl bg-primary-800 px-4 py-3 text-sm font-black text-white hover:bg-primary-700">
                  Aceitar Analytics
                </button>
              </div>
            </section>
          ) : (
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="fixed bottom-3 right-3 z-[90] rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-lg hover:bg-slate-50"
              aria-label="Alterar preferências de cookies"
            >
              Cookies
            </button>
          )}
        </>
      )}
    </AnalyticsContext.Provider>
  )
}

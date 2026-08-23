import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
let turnstileScriptPromise = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    const script = existing || document.createElement('script')
    const handleLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile_unavailable'))
    const handleError = () => reject(new Error('turnstile_load_failed'))

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).catch(error => {
    turnstileScriptPromise = null
    throw error
  })

  return turnstileScriptPromise
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ onTokenChange }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const turnstileRef = useRef(null)
  const [status, setStatus] = useState(TURNSTILE_SITE_KEY ? 'loading' : 'unavailable')
  const [retryNonce, setRetryNonce] = useState(0)

  const clearToken = () => onTokenChange('')

  const reset = () => {
    clearToken()
    if (turnstileRef.current && widgetIdRef.current != null) {
      turnstileRef.current.reset(widgetIdRef.current)
      setStatus('waiting')
    } else if (TURNSTILE_SITE_KEY) {
      setStatus('loading')
      setRetryNonce(value => value + 1)
    }
  }

  useImperativeHandle(ref, () => ({ reset }))

  useEffect(() => {
    let active = true
    if (!TURNSTILE_SITE_KEY) {
      clearToken()
      setStatus('unavailable')
      return undefined
    }

    setStatus('loading')
    loadTurnstile().then(turnstile => {
      if (!active || !containerRef.current) return
      turnstileRef.current = turnstile
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'auto',
        size: 'flexible',
        appearance: 'always',
        'response-field': false,
        callback: token => {
          if (!active || !token) return
          onTokenChange(token)
          setStatus('verified')
        },
        'expired-callback': () => {
          if (!active) return
          clearToken()
          setStatus('expired')
          setTimeout(() => active && reset(), 0)
        },
        'timeout-callback': () => {
          if (!active) return
          clearToken()
          setStatus('expired')
          setTimeout(() => active && reset(), 0)
        },
        'error-callback': () => {
          if (!active) return
          clearToken()
          setStatus('error')
        },
      })
      setStatus('waiting')
    }).catch(() => active && setStatus('error'))

    return () => {
      active = false
      if (turnstileRef.current && widgetIdRef.current != null) {
        turnstileRef.current.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
      turnstileRef.current = null
    }
  }, [onTokenChange, retryNonce])

  return (
    <div className="space-y-2" aria-label="Verificação de segurança">
      <p className="text-xs font-bold text-slate-600">Verificação de segurança</p>
      <div ref={containerRef} className="min-h-[65px] w-full overflow-hidden rounded-lg" />
      {status === 'loading' && <p role="status" className="text-xs text-slate-500">Carregando verificação segura…</p>}
      {status === 'waiting' && <p role="status" className="text-xs text-slate-500">Conclua a verificação para continuar.</p>}
      {status === 'verified' && <p role="status" className="text-xs font-semibold text-emerald-700">Verificação concluída.</p>}
      {status === 'unavailable' && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          Verificação indisponível neste ambiente. Configure VITE_TURNSTILE_SITE_KEY.
        </p>
      )}
      {(status === 'error' || status === 'expired') && (
        <div role="alert" className="flex items-center justify-between gap-3 text-xs font-semibold text-red-700">
          <span>Não foi possível concluir a verificação. Tente novamente.</span>
          <button type="button" onClick={reset} className="shrink-0 underline">Recarregar</button>
        </div>
      )}
    </div>
  )
})

export default TurnstileWidget

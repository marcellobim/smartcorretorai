import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Music2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getTikTokConnectionStatus,
  redirectToTikTokOAuth,
} from '../lib/tiktok-oauth-connection'

const CALLBACK_MESSAGES = Object.freeze({
  authorization_denied: 'A autorização do TikTok foi cancelada.',
  callback_invalid: 'Não foi possível concluir a conexão com o TikTok.',
  code_missing: 'O TikTok não retornou a autorização esperada.',
  scope_missing: 'A permissão necessária do TikTok não foi concedida.',
  state_invalid: 'Não foi possível validar a conexão. Tente novamente.',
})

const GENERIC_ERROR = 'Não foi possível consultar sua conexão com o TikTok. Tente novamente.'

const clearTikTokCallbackParameters = () => {
  const url = new URL(window.location.href)
  url.searchParams.delete('tiktok')
  url.searchParams.delete('reason')
  const search = url.searchParams.toString()
  window.history.replaceState(window.history.state, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`)
}

export default function TikTokIntegration() {
  const [view, setView] = useState({ status: 'loading', account: null, message: null })

  useEffect(() => {
    let active = true
    const callbackUrl = new URL(window.location.href)
    const outcomes = callbackUrl.searchParams.getAll('tiktok')
    const reasons = callbackUrl.searchParams.getAll('reason')
    const hasCallbackParameters = outcomes.length > 0 || reasons.length > 0
    const outcome = outcomes.length === 1 ? outcomes[0] : null
    const reason = reasons.length === 1 ? reasons[0] : null

    const loadStatus = async () => {
      try {
        const status = await getTikTokConnectionStatus(supabase)
        if (!active) return
        setView(status.connected
          ? { status: 'connected', account: status.account, message: null }
          : { status: status.status, account: null, message: null })
      } catch {
        if (active) setView({ status: 'error', account: null, message: GENERIC_ERROR })
      }
    }

    if (hasCallbackParameters) clearTikTokCallbackParameters()

    if (outcome === 'error') {
      const message = CALLBACK_MESSAGES[reason] ?? 'Não foi possível concluir a conexão com o TikTok.'
      setView({ status: 'error', account: null, message })
    } else if (outcome === 'connected' && reasons.length === 0) {
      setView({ status: 'confirming', account: null, message: null })
      void loadStatus()
    } else if (hasCallbackParameters) {
      setView({ status: 'error', account: null, message: 'Não foi possível concluir a conexão com o TikTok.' })
    } else {
      void loadStatus()
    }

    return () => { active = false }
  }, [])

  const connect = async () => {
    setView({ status: 'connecting', account: null, message: null })
    try {
      await redirectToTikTokOAuth(supabase, url => window.location.assign(url))
    } catch {
      setView({
        status: 'error',
        account: null,
        message: 'Não foi possível iniciar a conexão com o TikTok. Tente novamente.',
      })
    }
  }

  const busy = view.status === 'loading' || view.status === 'connecting' || view.status === 'confirming'

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/configuracoes" className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-950">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Configurações
        </Link>

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950 text-white">
              <Music2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-gray-500">Integração oficial</p>
              <h1 className="text-2xl font-black text-gray-950">TikTok</h1>
            </div>
          </div>

          {busy && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-gray-50 p-5 text-sm font-bold text-gray-700" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              {view.status === 'loading' && 'Consultando sua conexão...'}
              {view.status === 'connecting' && 'Iniciando conexão segura...'}
              {view.status === 'confirming' && 'Conexão recebida. Confirmando...'}
            </div>
          )}

          {view.status === 'disconnected' && (
            <div className="mt-8">
              <h2 className="text-lg font-black text-gray-950">TikTok não conectado</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">Conecte sua conta pelo Login Kit oficial do TikTok.</p>
              <button type="button" onClick={connect} className="mt-5 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800">
                Conectar TikTok
              </button>
            </div>
          )}

          {['access_token_expired', 'reconnect_required'].includes(view.status) && (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="status">
              <h2 className="font-black text-amber-950">{view.status === 'access_token_expired' ? 'Acesso ao TikTok expirado' : 'Reconexão necessária'}</h2>
              <p className="mt-2 text-sm text-amber-900">Autorize novamente para restabelecer o acesso à sua conta.</p>
              <button type="button" onClick={connect} className="mt-5 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white">Reconectar TikTok</button>
            </div>
          )}

          {view.status === 'connected' && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-black">TikTok conectado</h2>
              </div>
              {view.account?.display_name && (
                <p className="mt-2 text-sm font-bold text-emerald-900">{view.account.display_name}</p>
              )}
            </div>
          )}

          {view.status === 'error' && (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
              <h2 className="font-black text-red-900">Não foi possível conectar o TikTok</h2>
              <p className="mt-2 text-sm leading-6 text-red-800">{view.message}</p>
              <button type="button" onClick={connect} className="mt-5 rounded-2xl bg-gray-950 px-5 py-3 text-sm font-black text-white hover:bg-gray-800">
                Tentar novamente
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

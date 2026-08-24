import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandMark from '../components/brand/BrandMark'
import { supabase } from '../lib/supabase'

const GENERIC_ERROR = 'Não foi possível entrar com Google. Tente novamente ou entre com e-mail e senha.'

async function removeBlockedGoogleIdentity() {
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error) throw error
  const googleIdentity = data?.identities?.find(identity => identity.provider === 'google')
  if (googleIdentity) {
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity)
    if (unlinkError) throw unlinkError
  }
}

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    const completeCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (!code || params.get('error')) throw new Error('invalid_oauth_callback')

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      window.history.replaceState({}, document.title, '/auth/callback')
      if (error) throw error

      const { data: state, error: stateError } = await supabase.rpc('get_auth_onboarding_state')
      if (stateError) throw stateError

      if (state === 'admin_blocked') {
        try {
          await removeBlockedGoogleIdentity()
        } finally {
          await supabase.auth.signOut({ scope: 'global' })
        }
        throw new Error('admin_google_blocked')
      }
      if (state === 'needs_acceptance') {
        navigate('/aceite-legal', { replace: true })
        return
      }
      if (state === 'accepted' || state === 'not_google') {
        navigate('/dashboard', { replace: true })
        return
      }
      throw new Error('invalid_onboarding_state')
    }

    completeCallback().catch(async () => {
      window.history.replaceState({}, document.title, '/auth/callback')
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      if (active) setErrorMessage(GENERIC_ERROR)
    })

    return () => { active = false }
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <div className="flex items-center justify-center gap-3"><BrandMark size={36} decorative /><span className="font-black">SmartCorretorAI</span></div>
        {errorMessage ? (
          <>
            <p role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">{errorMessage}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-bold text-primary-700 hover:underline">Voltar para o login</Link>
          </>
        ) : (
          <>
            <div className="mx-auto mt-8 h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-800" aria-hidden="true" />
            <p role="status" className="mt-4 text-sm font-semibold text-slate-700">Concluindo sua entrada com segurança…</p>
          </>
        )}
      </section>
    </main>
  )
}

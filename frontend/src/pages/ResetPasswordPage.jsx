import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import BrandMark from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [recoveryReady, setRecoveryReady] = useState(() => sessionStorage.getItem('smartcorretor_password_recovery') === 'pending')
  const navigate = useNavigate()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('smartcorretor_password_recovery', 'pending')
        setRecoveryReady(true)
      }
    })

    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        window.history.replaceState({}, document.title, '/redefinir-senha')
        if (error && active) setRecoveryReady(false)
      })
    }

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const onSubmit = async data => {
    if (data.password !== data.confirmation) {
      setError('confirmation', { type: 'validate', message: 'As senhas não conferem.' })
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    if (!recoveryReady || !sessionData?.session) {
      setError('root', { type: 'auth', message: 'Este link expirou ou já foi utilizado. Solicite um novo.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setError('root', { type: 'auth', message: 'Não foi possível redefinir a senha. Solicite um novo link.' })
      return
    }
    sessionStorage.removeItem('smartcorretor_password_recovery')
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
    if (signOutError) {
      setError('root', { type: 'auth', message: 'Senha alterada, mas não foi possível encerrar todas as sessões. Contate o suporte.' })
      return
    }
    toast.success('Senha redefinida. Entre novamente em todos os dispositivos.')
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="flex items-center gap-3"><BrandMark size={36} decorative /><span className="font-black">SmartCorretorAI</span></div>
        <h1 className="mt-7 text-2xl font-black text-slate-950">Criar nova senha</h1>
        {!recoveryReady ? (
          <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            Este link expirou ou já foi utilizado. <Link to="/esqueci-senha" className="underline">Solicite um novo link.</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input label="Nova senha" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password', { required: 'Informe a nova senha.', minLength: { value: 12, message: 'Use pelo menos 12 caracteres.' } })} />
            <Input label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.confirmation?.message} {...register('confirmation', { required: 'Confirme a nova senha.' })} />
            {errors.root?.message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{errors.root.message}</p>}
            <Button type="submit" loading={isSubmitting} className="w-full">Redefinir senha e encerrar sessões</Button>
          </form>
        )}
      </section>
    </main>
  )
}

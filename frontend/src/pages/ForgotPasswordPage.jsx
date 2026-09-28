import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../config/brand'
import { useForm } from 'react-hook-form'
import { Mail } from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import TurnstileWidget from '../components/auth/TurnstileWidget'

const GENERIC_MESSAGE = 'Se existir uma conta para este e-mail, enviaremos as instruções de recuperação quando o envio estiver disponível.'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRef = useRef(null)
  const handleCaptchaToken = useCallback(token => setCaptchaToken(token), [])
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async ({ email }) => {
    if (!captchaToken) {
      toast.error('Conclua a verificação de segurança para continuar.')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
        captchaToken,
      })
      if (error) throw error
    } catch {
      // A resposta pública não revela se a conta existe ou se o envio foi limitado.
    } finally {
      setSent(true)
      captchaRef.current?.reset()
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="flex items-center gap-3"><BrandMark size={36} decorative /><span className="font-black">{BRAND.name}</span></div>
        <h1 className="mt-7 text-2xl font-black text-slate-950">Recuperar acesso</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Informe seu e-mail de acesso para receber as próximas instruções.</p>
        {sent ? (
          <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
            <Mail className="mb-2 h-5 w-5" />{GENERIC_MESSAGE}
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register('email', { required: 'Informe seu e-mail.', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Informe um e-mail válido.' } })} />
            <TurnstileWidget ref={captchaRef} onTokenChange={handleCaptchaToken} />
            <Button type="submit" loading={isSubmitting} disabled={!captchaToken} className="w-full">Enviar instruções</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm font-bold text-primary-700 hover:underline">Voltar para o login</Link>
      </section>
    </main>
  )
}

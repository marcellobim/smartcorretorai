import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, Eye, EyeOff, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showResendButton, setShowResendButton] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [authDiagnostic, setAuthDiagnostic] = useState(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      setUserEmail(data.email)
      await signIn(data.email, data.senha)
      toast.success('Bem-vindo de volta!')
      navigate('/dashboard')
    } catch (err) {
      if (import.meta.env.VITE_AUTH_DIAGNOSTICS === 'true') {
        setAuthDiagnostic({
          code: err?.code || null,
          message: err?.message || 'Unknown authentication error',
          status: err?.status || null,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL || null,
          environment: import.meta.env.VITE_DEPLOY_ENV || 'unknown',
        })
      }
      if (err.message?.includes('Email not confirmed')) {
        setShowResendButton(true)
        toast.error('Confirme seu email antes de fazer login.')
      } else if (err.message?.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos.')
      } else {
        toast.error(err.message || 'Erro ao fazer login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!userEmail) {
      toast.error('Por favor, insira seu e-mail primeiro')
      return
    }
    setResendingEmail(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: userEmail })
      if (error) throw error
      toast.success('E-mail de confirmação reenviado! Verifique sua caixa de entrada.')
      setShowResendButton(false)
    } catch (err) {
      toast.error(err.message || 'Erro ao reenviar e-mail de confirmação')
    } finally {
      setResendingEmail(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">SmartCorretorAI</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight">
            Gere campanhas de marketing completas em segundos
          </h2>
          <p className="mt-4 text-white/70">
            Banners, vídeos e textos prontos para todas as redes sociais, automatizados com IA.
          </p>
          <div className="mt-8 space-y-3">
            {['5x mais rápido que contratar um designer', 'Formatos para todas as redes sociais', 'Textos persuasivos gerados por IA'].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="w-5 h-5 bg-green-400/20 rounded-full flex items-center justify-center text-green-300 text-xs">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SmartCorretorAI</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
          <p className="mt-1 text-sm text-gray-500">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-primary-600 font-semibold hover:text-primary-700">
              Cadastre-se grátis
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'E-mail obrigatório',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
              })}
            />

            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.senha?.message}
                {...register('senha', { required: 'Senha obrigatória' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-end">
              <Link to="/esqueci-senha" className="text-sm text-primary-600 hover:text-primary-700">
                Esqueceu a senha?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Entrar
            </Button>

            {authDiagnostic && (
              <div data-testid="auth-diagnostic" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <p><strong>code:</strong> {authDiagnostic.code || 'null'}</p>
                <p><strong>message:</strong> {authDiagnostic.message}</p>
                <p><strong>status:</strong> {authDiagnostic.status || 'null'}</p>
                <p><strong>Supabase:</strong> {authDiagnostic.supabaseUrl}</p>
                <p><strong>Vercel environment:</strong> {authDiagnostic.environment}</p>
              </div>
            )}

            {showResendButton && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 font-medium mb-2">
                      Email não confirmado
                    </p>
                    <p className="text-xs text-amber-700 mb-3">
                      Você precisa confirmar seu email antes de fazer login. Não recebeu o email?
                    </p>
                    <Button
                      type="button"
                      onClick={handleResendConfirmation}
                      loading={resendingEmail}
                      variant="outline"
                      className="w-full text-sm"
                    >
                      Reenviar email de confirmação
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

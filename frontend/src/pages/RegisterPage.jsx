import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { Input, Select } from '../components/ui/Input'
import BrandMark from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import TurnstileWidget from '../components/auth/TurnstileWidget'
import GoogleAuthButton from '../components/auth/GoogleAuthButton'
import { LEGAL_ACCEPTANCE_CONTEXT, LEGAL_DOCUMENT_VERSIONS } from '../config/legalDocuments'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRef = useRef(null)
  const signupStartedRef = useRef(false)
  const handleCaptchaToken = useCallback(token => setCaptchaToken(token), [])
  const { signUp, signInWithGoogle } = useAuth()
  const { trackEvent } = useAnalytics()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Não foi possível entrar com Google. Tente novamente ou entre com e-mail e senha.')
      setGoogleLoading(false)
    }
  }

  const onSubmit = async (data) => {
    if (!data.termos) {
      toast.error('Aceite os termos para continuar.')
      return
    }
    if (!captchaToken) {
      toast.error('Conclua a verificação de segurança para continuar.')
      return
    }
    setLoading(true)
    try {
      const signupResult = await signUp(data.email, data.senha, {
        nome: data.nome,
        telefone: data.telefone,
        creci: data.creci,
        estado: data.estado,
        legal_acceptance: {
          accepted: true,
          terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
          privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
          context: LEGAL_ACCEPTANCE_CONTEXT,
        },
      }, captchaToken)
      if (signupResult?.user?.identities?.length > 0) trackEvent('sign_up_completed')
      toast.success('Conta criada! Verifique seu email para confirmar o cadastro.')
      navigate('/login')
    } catch {
      toast.error('Não foi possível concluir o cadastro. Verifique os dados ou tente novamente mais tarde.')
    } finally {
      captchaRef.current?.reset()
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <BrandMark size={32} decorative />
          <span className="font-bold text-gray-900">SmartCorretorAI</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Crie sua conta grátis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Comece grátis com 200 Smart Tokens após confirmar seu e-mail, sem cartão. Já tem conta?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
            Entrar
          </Link>
        </p>

        <div className="mt-8">
          <GoogleAuthButton onClick={handleGoogle} loading={googleLoading} />
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          onFocusCapture={() => {
            if (signupStartedRef.current) return
            signupStartedRef.current = trackEvent('sign_up_started')
          }}
          className="space-y-4"
        >
          <Input
            label="Nome completo"
            placeholder="Seu nome"
            error={errors.nome?.message}
            {...register('nome', { required: 'Nome obrigatório', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })}
          />

          <Input
            label="E-mail profissional"
            type="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'E-mail obrigatório',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido' },
            })}
          />

          <Input
            label="Telefone / WhatsApp"
            type="tel"
            placeholder="(11) 99999-9999"
            error={errors.telefone?.message}
            {...register('telefone', {
              required: 'Telefone obrigatório',
              pattern: { value: /^[\d\s\(\)\-\+]{10,15}$/, message: 'Telefone inválido' },
            })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CRECI"
              placeholder="Ex: 12345-F"
              hint="Opcional"
              {...register('creci')}
            />
            <Select
              label="Estado (UF)"
              error={errors.estado?.message}
              {...register('estado', { required: 'Estado obrigatório' })}
            >
              <option value="">Selecione</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 12 caracteres"
              error={errors.senha?.message}
              {...register('senha', {
                required: 'Senha obrigatória',
                minLength: { value: 12, message: 'Mínimo 12 caracteres' },
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="termos"
              className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('termos', { required: 'Aceite os termos para continuar' })}
            />
            <label htmlFor="termos" className="text-sm text-gray-600">
              Ao criar minha conta, usar o sistema, gerar campanhas ou contratar planos/recargas, declaro que li e aceito os{' '}
              <Link to="/termos" className="text-primary-600 hover:underline">Termos de Uso</Link>{' '}
              e a{' '}
              <Link to="/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>.
            </label>
          </div>
          {errors.termos && <p className="text-xs text-red-500">{errors.termos.message}</p>}

          <TurnstileWidget ref={captchaRef} onTokenChange={handleCaptchaToken} />

          <Button type="submit" loading={loading} disabled={!captchaToken} className="w-full mt-2">
            Criar conta grátis
          </Button>
        </form>
      </div>
    </div>
  )
}

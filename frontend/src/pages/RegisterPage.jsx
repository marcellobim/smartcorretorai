import { useCallback, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
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
import { useLocale } from '../i18n/useLocale'
import MarketSelector from '../components/i18n/MarketSelector'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRef = useRef(null)
  const signupStartedRef = useRef(false)
  const signupSubmissionRef = useRef(false)
  const registrationTrackedRef = useRef(false)
  const handleCaptchaToken = useCallback(token => setCaptchaToken(token), [])
  const { signUp, signInWithGoogle } = useAuth()
  const { trackEvent, trackRegistration } = useAnalytics()
  const { t } = useLocale()
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
    if (signupSubmissionRef.current) return
    if (!data.termos) {
      toast.error('Aceite os termos para continuar.')
      return
    }
    if (!captchaToken) {
      toast.error('Conclua a verificação de segurança para continuar.')
      return
    }
    signupSubmissionRef.current = true
    setLoading(true)
    try {
      const professionalMetadata = {
        nome: data.nome,
        telefone: data.telefone,
        creci: data.creci,
        estado: data.estado,
        market: 'BR',
        ...(data.display_name?.trim() ? { display_name: data.display_name.trim() } : {}),
        ...(data.creci_type ? { creci_type: data.creci_type } : {}),
        ...(data.imobiliaria?.trim() ? { imobiliaria: data.imobiliaria.trim() } : {}),
        ...(data.whatsapp?.trim() ? { whatsapp: data.whatsapp.trim() } : {}),
      }
      const signupResult = await signUp(data.email, data.senha, {
        ...professionalMetadata,
        legal_acceptance: {
          accepted: true,
          terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
          privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
          context: LEGAL_ACCEPTANCE_CONTEXT,
        },
      }, captchaToken)
      if (signupResult?.user?.identities?.length > 0) {
        trackEvent('sign_up_completed')
        if (!registrationTrackedRef.current) {
          registrationTrackedRef.current = trackRegistration()
        }
        toast.success('Conta criada! Verifique seu email para confirmar o cadastro.')
      } else {
        toast.error('Não foi possível concluir um novo cadastro com esses dados. Se você já possui uma conta, entre normalmente ou use “Esqueci minha senha”.')
      }
      navigate('/login')
    } catch {
      toast.error('Não foi possível concluir o cadastro. Verifique os dados ou tente novamente mais tarde.')
    } finally {
      signupSubmissionRef.current = false
      captchaRef.current?.reset()
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <BrandMark size={32} decorative />
          <span className="font-bold text-gray-900">{BRAND.name}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{t('register.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('register.subtitle')}{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
            {t('register.signIn')}
          </Link>
        </p>

        <MarketSelector className="mt-6 w-full" />

        <div className="mt-6">
          <GoogleAuthButton onClick={handleGoogle} loading={googleLoading} />
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('register.or')}</span>
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
            label={t('register.name.label')}
            placeholder={t('register.name.placeholder')}
            error={errors.nome?.message}
            {...register('nome', { required: t('register.name.required'), minLength: { value: 3, message: t('register.name.minLength') } })}
          />

          <Input
            label={t('profile.displayName')}
            placeholder="Ex: Riccieri"
            hint={t('profile.displayNameDescription')}
            {...register('display_name')}
          />

          <Input
            label={t('register.email.label')}
            type="email"
            placeholder={t('register.email.placeholder')}
            error={errors.email?.message}
            {...register('email', {
              required: t('register.email.required'),
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('register.email.invalid') },
            })}
          />

          <Input
            label={t('register.phone.label')}
            type="tel"
            placeholder={t('register.phone.placeholder')}
            error={errors.telefone?.message}
            {...register('telefone', {
              required: t('register.phone.required'),
              pattern: { value: /^[\d\s\(\)\-\+]{10,15}$/, message: t('register.phone.invalid') },
            })}
          />

          <Input
            label={t('profile.whatsapp')}
            type="tel"
            placeholder="(11) 99999-9999"
            {...register('whatsapp')}
          />

          <Input
            label={t('profile.brokerage')}
            placeholder="Ex: Silva Imóveis"
            {...register('imobiliaria')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('register.creci.label')}
              placeholder={t('register.creci.placeholder')}
              hint={t('register.creci.optional')}
              {...register('creci')}
            />
            <Select label={t('profile.creciType')} {...register('creci_type')}>
              <option value="">Selecione</option>
              <option value="F">{t('profile.creciTypes.F')}</option>
              <option value="J">{t('profile.creciTypes.J')}</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('register.state.label')}
              error={errors.estado?.message}
              {...register('estado', { required: t('register.state.required') })}
            >
              <option value="">{t('register.state.select')}</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </Select>
          </div>

          <div className="relative">
            <Input
              label={t('register.password.label')}
              type={showPassword ? 'text' : 'password'}
              placeholder={t('register.password.placeholder')}
              error={errors.senha?.message}
              {...register('senha', {
                required: t('register.password.required'),
                minLength: { value: 12, message: t('register.password.minLength') },
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
              {...register('termos', { required: t('register.terms.required') })}
            />
            <label htmlFor="termos" className="text-sm text-gray-600">
              {t('register.terms.prefix')}{' '}
              <Link to="/termos" className="text-primary-600 hover:underline">{t('register.terms.termsLink')}</Link>{' '}
              {t('register.terms.connector')}{' '}
              <Link to="/privacidade" className="text-primary-600 hover:underline">{t('register.terms.privacyLink')}</Link>.
            </label>
          </div>
          {errors.termos && <p className="text-xs text-red-500">{errors.termos.message}</p>}

          <TurnstileWidget ref={captchaRef} onTokenChange={handleCaptchaToken} />

          <Button type="submit" loading={loading} disabled={!captchaToken} className="w-full mt-2">
            {t('register.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}

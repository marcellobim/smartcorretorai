import { useCallback, useRef, useState } from 'react'
import { BRAND } from '../config/brand'
import { Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../lib/auth-context'
import { Input } from '../components/ui/Input'
import BrandMark from '../components/brand/BrandMark'
import { Button } from '../components/ui/Button'
import TurnstileWidget from '../components/auth/TurnstileWidget'
import GoogleAuthButton from '../components/auth/GoogleAuthButton'
import { LEGAL_ACCEPTANCE_CONTEXT, LEGAL_DOCUMENT_VERSIONS } from '../config/legalDocuments'
import { useAnalytics } from '../components/analytics/AnalyticsProvider'
import { useLocale } from '../i18n/useLocale'
import MarketSelector from '../components/i18n/MarketSelector'
import { authEntryPath, preservePostAuthDestination, readPostAuthDestination } from '../lib/post-auth-destination'

// Account creation captures only the information required to secure the account.
// Professional details are collected and saved by the products only when needed.
export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaRef = useRef(null)
  const signupStartedRef = useRef(false)
  const signupSubmissionRef = useRef(false)
  const handleCaptchaToken = useCallback(token => setCaptchaToken(token), [])
  const { signInWithEmailLink, signInWithGoogle } = useAuth()
  const { trackEvent, trackRegistration } = useAnalytics()
  const { t, market } = useLocale()
  const location = useLocation()
  const destination = readPostAuthDestination(location.search)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const rememberDestination = () => preservePostAuthDestination(destination)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      rememberDestination()
      await signInWithGoogle(destination)
    } catch {
      toast.error(t('register.messages.googleError'))
      setGoogleLoading(false)
    }
  }

  const onSubmit = async data => {
    if (signupSubmissionRef.current) return
    if (!data.termos) return toast.error(t('register.terms.required'))
    if (!captchaToken) return toast.error(t('register.messages.securityRequired'))
    signupSubmissionRef.current = true
    setLoading(true)
    try {
      rememberDestination()
      await signInWithEmailLink(data.email, {
        nome: data.nome.trim(),
        name: data.nome.trim(),
        market: market === 'US' ? 'US' : 'BR',
        legal_acceptance: {
          accepted: true,
          terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
          privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
          context: LEGAL_ACCEPTANCE_CONTEXT,
        },
      }, captchaToken, destination)
      trackEvent('sign_up_completed')
      trackRegistration()
      toast.success(t('register.messages.linkSent'))
    } catch {
      toast.error(t('register.messages.genericError'))
    } finally {
      signupSubmissionRef.current = false
      captchaRef.current?.reset()
      setLoading(false)
    }
  }

  return <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2 mb-8"><BrandMark size={32} decorative /><span className="font-bold text-gray-900">{BRAND.name}</span></div>
      <h1 className="text-2xl font-bold text-gray-900">{t('register.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('register.subtitle')}{' '}<Link to={authEntryPath('/login', destination)} className="text-primary-600 font-semibold hover:text-primary-700">{t('register.signIn')}</Link></p>
      <MarketSelector className="mt-6 w-full" />
      <div className="mt-6"><GoogleAuthButton onClick={handleGoogle} loading={googleLoading} /><div className="my-6 flex items-center gap-3" aria-hidden="true"><div className="h-px flex-1 bg-slate-200" /><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('register.or')}</span><div className="h-px flex-1 bg-slate-200" /></div></div>
      <form onSubmit={handleSubmit(onSubmit)} onFocusCapture={() => { if (!signupStartedRef.current) signupStartedRef.current = trackEvent('sign_up_started') }} className="space-y-4">
        <Input label={t('register.name.label')} placeholder={t('register.name.placeholder')} error={errors.nome?.message} {...register('nome', { required: t('register.name.required'), minLength: { value: 3, message: t('register.name.minLength') } })} />
        <Input label={t('register.email.label')} type="email" placeholder={t('register.email.placeholder')} error={errors.email?.message} {...register('email', { required: t('register.email.required'), pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('register.email.invalid') } })} />
        <div className="flex items-start gap-2 pt-1"><input type="checkbox" id="termos" className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" {...register('termos', { required: t('register.terms.required') })} /><label htmlFor="termos" className="text-sm text-gray-600">{t('register.terms.prefix')}{' '}<Link to="/termos" className="text-primary-600 hover:underline">{t('register.terms.termsLink')}</Link>{' '}{t('register.terms.connector')}{' '}<Link to="/privacidade" className="text-primary-600 hover:underline">{t('register.terms.privacyLink')}</Link>.</label></div>
        {errors.termos && <p className="text-xs text-red-500">{errors.termos.message}</p>}
        <TurnstileWidget ref={captchaRef} onTokenChange={handleCaptchaToken} />
        <Button type="submit" loading={loading} disabled={!captchaToken} className="w-full mt-2">{t('register.submit')}</Button>
      </form>
    </div>
  </div>
}

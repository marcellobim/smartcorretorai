import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Image,
  Lock,
  Music2,
  Palette,
  Upload,
  User,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { Input, Select } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { TIKTOK_LOGIN_KIT_ENABLED } from '../config/tiktok'
import TurnstileWidget from '../components/auth/TurnstileWidget'
import { useLocale } from '../i18n/useLocale'
import { formatPhone, isPhoneCompatibleWithMarket, normalizePhone } from '../utils/phoneFormatters'

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const tabs = [
  { id: 'cadastro', label: 'Cadastro', icon: User },
  { id: 'acesso', label: 'Acesso e Senha', icon: Lock },
  { id: 'plano', label: 'Plano e Assinatura', icon: CreditCard },
]

const SETTINGS_TAB_ALIASES = {
  perfil: 'cadastro',
  senha: 'acesso',
  assinatura: 'plano',
}

const ACTIVE_SUBSCRIPTION_PLANS = new Set(['start', 'pro', 'elite', 'imobiliaria'])

function resolveSettingsTab(value) {
  const resolved = SETTINGS_TAB_ALIASES[value] || value
  return tabs.some(tab => tab.id === resolved) ? resolved : 'cadastro'
}

function ImageUploader({ label, value, onChange, shape = 'circle', hint, market = 'BR' }) {
  const us = market === 'US'
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(value || null)

  useEffect(() => {
    setPreview(value || null)
  }, [value])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(us ? 'Upload a JPG, PNG, or WebP image.' : 'Envie uma imagem em JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(us ? 'Upload an image up to 5 MB.' : 'Envie uma imagem com até 5MB.')
      return
    }
    setPreview(URL.createObjectURL(file))
    onChange(file)
  }

  const clear = (event) => {
    event.stopPropagation()
    setPreview(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${shapeClass} relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-blue-100 bg-slate-50 text-slate-400 transition hover:border-primary-300 hover:bg-primary-50`}
        >
          {preview ? (
            <>
              <img src={preview} alt={label} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clear}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-900/75 text-white"
                aria-label={`${us ? 'Remove' : 'Remover'} ${label}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <Image className="h-7 w-7" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-gray-950">{label}</p>
          {hint && <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p>}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-primary-700 hover:text-primary-800"
          >
            <Upload className="h-3.5 w-3.5" />
            {preview ? (us ? 'Change image' : 'Trocar imagem') : (us ? 'Upload image' : 'Enviar imagem')}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  )
}

function StatusBadge({ complete, optional = false, market = 'BR' }) {
  const us = market === 'US'
  if (optional) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {us ? 'Optional' : 'Opcional'}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
      complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {complete ? (us ? 'Basic profile ready' : 'Perfil básico pronto') : (us ? 'Complete your basic profile' : 'Complete os dados básicos')}
    </span>
  )
}

function SectionCard({ icon: Icon, eyebrow, title, description, complete, optional = false, children, market }) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-primary-700">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-black text-gray-950">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>}
          </div>
        </div>
        {(typeof complete === 'boolean' || optional) && <StatusBadge complete={complete} optional={optional} market={market} />}
      </div>
      {children}
    </section>
  )
}

function FieldNotice({ children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs font-semibold leading-relaxed text-gray-600">
      {children}
    </div>
  )
}

export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(() => resolveSettingsTab(searchParams.get('tab')))
  const { user, session, updateUser, reloadProfile, isAdmin } = useAuth()
  const { t, market } = useLocale()
  const [avatarFile, setAvatarFile] = useState(undefined)
  const [logoFile, setLogoFile] = useState(undefined)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState('')
  const passwordCaptchaRef = useRef(null)
  const handlePasswordCaptchaToken = useCallback(token => setPasswordCaptchaToken(token), [])

  const {
    register: regPerfil,
    handleSubmit: handlePerfil,
    reset: resetPerfil,
    clearErrors: clearProfileErrors,
    setError: setProfileError,
    watch,
    formState: { errors: profileErrors, isSubmitting: savingPerfil },
  } = useForm({
    defaultValues: {
      nome: '',
      display_name: '',
      email: '',
      creci: '',
      creci_type: '',
      estado: '',
      telefone: '',
      whatsapp: '',
      imobiliaria: '',
      instagram: '',
      facebook: '',
      linkedin: '',
      license_number: '',
      license_state: '',
    },
  })

  const {
    register: regSenha,
    handleSubmit: handleSenha,
    reset: resetSenha,
    clearErrors: clearPasswordErrors,
    setError: setPasswordError,
    formState: { errors: passwordErrors, isSubmitting: savingSenha },
  } = useForm()

  useEffect(() => {
    setActiveTab(resolveSettingsTab(searchParams.get('tab')))
  }, [searchParams])

  useEffect(() => {
    if (!user?.id) return
    resetPerfil({
      nome: user?.nome || '',
      display_name: user?.display_name || '',
      email: user?.email || session?.user?.email || '',
      creci: user?.creci || '',
      creci_type: user?.creci_type || '',
      estado: user?.estado || '',
      telefone: formatPhone(user?.telefone || '', market, user?.market),
      whatsapp: formatPhone(user?.whatsapp || user?.telefone || '', market, user?.market),
      imobiliaria: user?.imobiliaria || '',
      instagram: user?.instagram || '',
      facebook: user?.facebook || '',
      linkedin: user?.linkedin || '',
      license_number: user?.license_number || '',
      license_state: user?.license_state || '',
    })
    setAvatarFile(undefined)
    setLogoFile(undefined)
  }, [market, user?.id, user?.nome, user?.display_name, user?.email, user?.creci, user?.creci_type, user?.license_number, user?.license_state, user?.telefone, user?.whatsapp, user?.imobiliaria, user?.instagram, user?.facebook, user?.linkedin, user?.estado, session?.user?.email, resetPerfil])

  const watched = watch()
  const profileComplete = useMemo(() => Boolean(
    watched.nome?.trim()
    && watched.email?.trim()
    && String(watched.whatsapp || '').replace(/\D/g, '').length >= 10
  ), [watched.nome, watched.whatsapp, watched.email])

  const uploadProfileImage = async (file, slot) => {
    if (!file || !(file instanceof File)) return null
    if (!user?.id) throw new Error(copy.sessionExpired)
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/profile/${slot}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('smartcorretor-assets')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) throw new Error(copy.uploadFailed)
    if (!path.startsWith(`${user.id}/`)) throw new Error(copy.invalidUploadPath)

    const { data: signed, error: signedError } = await supabase.storage
      .from('smartcorretor-assets')
      .createSignedUrl(path, 60 * 60 * 24)

    if (signedError) throw new Error(copy.uploadPrepareFailed)
    return signed.signedUrl
  }

  const onSavePerfil = async (data, successMessage = copy.saved) => {
    try {
      let avatar_url = user?.avatar_url || null
      let logo_url = user?.logo_url || null

      if (avatarFile instanceof File) avatar_url = await uploadProfileImage(avatarFile, 'avatar')
      else if (avatarFile === null) avatar_url = null

      if (logoFile instanceof File) logo_url = await uploadProfileImage(logoFile, 'logo')
      else if (logoFile === null) logo_url = null

      const supportsProfessionalProfileSchema = ['display_name', 'creci_type', 'facebook', 'linkedin', 'license_state'].every((field) => Object.prototype.hasOwnProperty.call(user || {}, field))
      const profileUpdate = {
        nome: data.nome,
        email: data.email,
        creci: data.creci,
        estado: data.estado,
        // Store digits only. Presentation is reconstructed by the shared
        // market formatter, so a mask never becomes the source of truth.
        telefone: data.telefone ? normalizePhone(data.telefone, market) : null,
        whatsapp: data.whatsapp ? normalizePhone(data.whatsapp, market) : null,
        imobiliaria: data.imobiliaria,
        avatar_url,
        logo_url,
      }

      if (supportsProfessionalProfileSchema) {
        Object.assign(profileUpdate, {
          display_name: data.display_name || null,
          creci_type: data.creci_type || null,
          instagram: data.instagram || null,
          facebook: data.facebook || null,
          linkedin: data.linkedin || null,
          license_number: data.license_number || null,
          license_state: data.license_state ? String(data.license_state).trim().toUpperCase() : null,
        })
      }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      updateUser(updated)
      await reloadProfile()
      setAvatarFile(undefined)
      setLogoFile(undefined)
      toast.success(successMessage)
    } catch (err) {
      toast.error(err.message || copy.saveError)
    }
  }

  const onSaveBasicProfile = async (data) => {
    clearProfileErrors(['nome', 'email', 'whatsapp'])
    let hasError = false
    const phoneValues = [['telefone', data.telefone], ['whatsapp', data.whatsapp]]

    if (!data.nome?.trim()) {
      setProfileError('nome', { type: 'required', message: copy.requiredName })
      hasError = true
    }
    if (!data.email?.trim()) {
      setProfileError('email', { type: 'required', message: copy.requiredEmail })
      hasError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      setProfileError('email', { type: 'validate', message: copy.invalidEmail })
      hasError = true
    }
    for (const [field, value] of phoneValues) {
      if (value && !isPhoneCompatibleWithMarket(value, market)) {
        setProfileError(field, { type: 'validate', message: market === 'US' ? 'Enter a valid 10-digit phone number.' : 'Informe um telefone com DDD.' })
        hasError = true
      }
    }

    if (hasError) {
      toast.error(copy.requiredReview)
      return
    }

    await onSavePerfil(data)
  }

  const us = market === 'US'
  const copy = us ? {
    title: 'Settings', subtitle: 'Manage your professional profile, access, plan, and subscription in one place.', registration: 'Profile', access: 'Access & password', plan: 'Plan & subscription', keepUpdated: 'Keep your professional profile current. These details are used only when a product and layout support them.', profile: 'Professional profile', profileDescription: 'Your professional email is for marketing materials and does not change your sign-in email.', photo: 'Professional photo', photoHint: 'Optional. Used only when a layout supports a visual signature.', legalName: 'Professional / legal name', legalPlaceholder: 'Your legal professional name', displayPlaceholder: 'E.g., Alex Realty', displayHint: 'Your display name can be used in materials when you choose that option.', license: 'License number', company: 'Company identity', companyDescription: 'Add information only if you want to use your brokerage or company in generated materials.', logo: 'Company logo', logoHint: 'Optional. Use it only when you want to identify your company in materials.', brokeragePlaceholder: 'E.g., Alex Realty Group', optionalNotice: 'All details in this section are optional and never replace your personal professional details automatically.', save: 'Save profile', saved: 'Professional profile updated.', saveError: 'We could not save your profile.', requiredName: 'Enter your professional name.', requiredEmail: 'Enter your professional email.', invalidEmail: 'Enter a valid professional email.', requiredReview: 'Review the highlighted required details.', sessionExpired: 'Your session has expired. Please sign in again.', uploadFailed: 'Could not upload the image.', uploadPrepareFailed: 'Could not prepare the image.', invalidUploadPath: 'Invalid upload path.', accessTitle: 'Access & password', accessDescription: 'The email below identifies your sign-in. It is different from the professional email in your profile.', loginEmail: 'Sign-in email', loginUnavailable: 'Sign-in email unavailable', loginHint: 'This email identifies your account and cannot be changed here.', currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password', passwordPlaceholder: 'At least 12 characters', repeatPassword: 'Repeat your new password', currentRequired: 'Enter your current password.', newRequired: 'Enter your new password.', passwordMin: 'Use at least 12 characters.', confirmRequired: 'Confirm your new password.', passwordsMismatch: 'Passwords do not match.', captchaRequired: 'Complete the security verification to continue.', sessionInvalid: 'Invalid session. Sign in again.', passwordIncorrect: 'Current password is incorrect.', identityFailed: 'We could not confirm your identity.', passwordUpdated: 'Password changed. Sign in again on all devices.', passwordSecureFailed: 'We could not change your password securely. Try again.', allSessionsFailed: 'Password changed, but we could not sign out every session. Contact support.', planTitle: 'Plan & subscription', planDescription: 'Review your current plan and securely manage your Stripe subscription.', currentPlan: 'Current plan', reportedStatus: 'Reported status', manageDescription: 'Update your payment method or cancel your subscription.', manage: 'Manage subscription', viewPlans: 'View available plans and terms', portalFailed: 'We could not open subscription management. Try again.', select: 'Select', phoneHint: 'Official phone used only when you choose to share it.', emailHint: 'Professional information for your materials. This is not your login email.',
  } : {
    title: 'Configurações', subtitle: 'Gerencie seu cadastro, acesso, plano e assinatura em um só lugar.', registration: 'Cadastro', access: 'Acesso e senha', plan: 'Plano e assinatura', keepUpdated: 'Mantenha seu cadastro profissional atualizado. Esses dados podem ser usados nos materiais somente quando o produto e o layout comportarem essa identificação.', profile: 'Dados profissionais', profileDescription: 'Seu e-mail profissional é um dado de divulgação e não altera o e-mail usado para acessar sua conta.', photo: 'Foto profissional', photoHint: 'Foto opcional, usada apenas quando o layout comportar assinatura visual.', legalName: 'Nome profissional / real', legalPlaceholder: 'Seu nome profissional real', displayPlaceholder: 'Ex: Riccieri', displayHint: 'O nome comercial pode ser usado nas peças quando você escolher essa opção.', license: 'Número da licença', company: 'Identidade da empresa', companyDescription: 'Preencha apenas se desejar utilizar os dados da sua imobiliária, construtora ou empresa nos materiais gerados.', logo: 'Logo da empresa', logoHint: 'Opcional. Use apenas quando desejar identificar a empresa nos materiais.', brokeragePlaceholder: 'Ex: Silva Imóveis', optionalNotice: 'Todos os dados desta seção são opcionais e nunca substituem automaticamente seus dados profissionais pessoais.', save: 'Salvar Cadastro', saved: 'Cadastro profissional atualizado.', saveError: 'Erro ao salvar perfil.', requiredName: 'Informe seu nome profissional.', requiredEmail: 'Informe seu e-mail profissional.', invalidEmail: 'Informe um e-mail profissional válido.', requiredReview: 'Revise os dados obrigatórios destacados.', sessionExpired: 'Sessão expirada. Faça login novamente.', uploadFailed: 'Falha ao enviar a imagem.', uploadPrepareFailed: 'Falha ao preparar a imagem.', invalidUploadPath: 'Caminho de upload inválido.', accessTitle: 'Acesso e Senha', accessDescription: 'O e-mail abaixo identifica seu login. Ele é diferente do e-mail profissional informado no Cadastro.', loginEmail: 'E-mail de acesso/login', loginUnavailable: 'E-mail de acesso indisponível', loginHint: 'Este e-mail identifica sua conta e não pode ser alterado nesta tela.', currentPassword: 'Senha atual', newPassword: 'Nova senha', confirmPassword: 'Confirmar nova senha', passwordPlaceholder: 'Mínimo 12 caracteres', repeatPassword: 'Repita a nova senha', changePassword: 'Alterar senha', currentRequired: 'Informe sua senha atual.', newRequired: 'Informe a nova senha.', passwordMin: 'Use pelo menos 12 caracteres.', confirmRequired: 'Confirme a nova senha.', passwordsMismatch: 'As senhas não conferem.', captchaRequired: 'Conclua a verificação de segurança para continuar.', sessionInvalid: 'Sessão inválida. Entre novamente.', passwordIncorrect: 'Senha atual incorreta.', identityFailed: 'Não foi possível confirmar sua identidade.', passwordUpdated: 'Senha alterada. Entre novamente em todos os dispositivos.', passwordSecureFailed: 'Não foi possível alterar a senha com segurança. Tente novamente.', allSessionsFailed: 'Senha alterada, mas não foi possível encerrar todas as sessões. Contate o suporte.', planTitle: 'Plano e Assinatura', planDescription: 'Consulte seu plano atual e gerencie sua assinatura com segurança pelo Stripe.', currentPlan: 'Plano atual', reportedStatus: 'Status informado', manageDescription: 'Altere sua forma de pagamento ou cancele sua assinatura.', manage: 'Gerenciar assinatura', viewPlans: 'Ver planos e condições disponíveis', portalFailed: 'Não foi possível abrir o gerenciamento da assinatura. Tente novamente.', select: 'Selecione', phoneHint: 'Telefone oficial usado somente quando você escolher divulgá-lo.', emailHint: 'Dado profissional para seus materiais. Não é o e-mail de acesso/login.',
  }
  const localizedTabs = [{ id: 'cadastro', label: copy.registration, icon: User }, { id: 'acesso', label: copy.access, icon: Lock }, { id: 'plano', label: copy.plan, icon: CreditCard }]

  const onSaveSenha = async (data) => {
    clearPasswordErrors()
    if (data.nova_senha !== data.confirmar_senha) {
      setPasswordError('confirmar_senha', { type: 'validate', message: copy.passwordsMismatch })
      toast.error(copy.passwordsMismatch)
      return
    }
    if (!passwordCaptchaToken) {
      setPasswordError('root', { type: 'captcha', message: copy.captchaRequired })
      return
    }
    try {
      const accessEmailValue = session?.user?.email
    if (!accessEmailValue) throw new Error(copy.sessionInvalid)
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: accessEmailValue,
        password: data.senha_atual,
        options: { captchaToken: passwordCaptchaToken },
      })
      passwordCaptchaRef.current?.reset()
      if (reauthError) {
        setPasswordError('senha_atual', { type: 'auth', message: copy.passwordIncorrect })
        toast.error(copy.identityFailed)
        return
      }
      const { error } = await supabase.auth.updateUser({ password: data.nova_senha })
      if (error) throw error
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
      if (signOutError) throw new Error(copy.allSessionsFailed)
      toast.success(copy.passwordUpdated)
      resetSenha()
      navigate('/login', { replace: true })
    } catch (err) {
      const message = err.message === copy.allSessionsFailed
        ? err.message
        : copy.passwordSecureFailed
      setPasswordError('root', { type: 'auth', message })
      toast.error(message)
    } finally {
      passwordCaptchaRef.current?.reset()
    }
  }

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  const openSubscriptionPortal = async () => {
    setOpeningPortal(true)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal')
      if (error || !data?.url) throw new Error('portal_unavailable')
      const portalUrl = new URL(data.url)
      if (portalUrl.protocol !== 'https:' || portalUrl.hostname !== 'billing.stripe.com') {
        throw new Error('invalid_portal_url')
      }
      window.location.assign(portalUrl.toString())
    } catch {
      toast.error(copy.portalFailed)
      setOpeningPortal(false)
    }
  }

  const accessEmail = session?.user?.email || copy.loginUnavailable
  const subscriptionStatus = user?.subscription_status || user?.assinatura_status || null
  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_PLANS.has(String(user?.plano || '').trim().toLowerCase())

  return (
    <div>
      <Header title={copy.title} subtitle={copy.subtitle} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="space-y-1 lg:sticky lg:top-6 lg:self-start">
            {localizedTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-3 text-left text-sm font-black transition ${
                  activeTab === id ? 'bg-primary-800 text-white shadow-sm' : 'text-slate-600 hover:bg-primary-50 hover:text-primary-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
            {TIKTOK_LOGIN_KIT_ENABLED && isAdmin && (
              <section className="pt-5" aria-label="Integrações">
                <h2 className="px-3 text-xs font-black uppercase tracking-wide text-slate-500">Integrações</h2>
                <Link to="/configuracoes/integracoes/tiktok" className="mt-2 flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-slate-700 transition hover:border-primary-300 hover:bg-primary-50">
                  <Music2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black">TikTok</span>
                    <span className="mt-1 block text-xs leading-relaxed">Conecte sua conta TikTok</span>
                  </span>
                </Link>
              </section>
            )}
          </nav>

          <div className="min-w-0">
            {activeTab === 'cadastro' && (
              <form onSubmit={handlePerfil(onSaveBasicProfile)} className="space-y-6">
                <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100 shadow-sm">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <p className="pt-1 text-sm font-semibold leading-6 text-slate-700">
                      {copy.keepUpdated}
                    </p>
                  </div>
                </div>

                <SectionCard
                  icon={Briefcase}
                  eyebrow={copy.registration}
                  title={copy.profile}
                  description={copy.profileDescription}
                  complete={profileComplete}
                  market={market}
                >
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ImageUploader
                      label={copy.photo}
                      hint={copy.photoHint}
                      value={avatarFile === null ? null : (avatarFile instanceof File ? null : user?.avatar_url)}
                      onChange={setAvatarFile}
                      shape="circle"
                      market={market}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label={copy.legalName}
                        placeholder={copy.legalPlaceholder}
                        error={profileErrors.nome?.message}
                        {...regPerfil('nome')}
                      />
                      <Input
                        label={t('profile.displayName')}
                        placeholder={copy.displayPlaceholder}
                        hint={copy.displayHint}
                        {...regPerfil('display_name')}
                      />
                      {us ? <><Input label={copy.license} placeholder="E.g., SL123456" {...regPerfil('license_number')} /><Input label="License state" placeholder="FL" maxLength={2} {...regPerfil('license_state', { onChange: event => { event.target.value = event.target.value.toUpperCase() } })} /></> : <><Input label="CRECI" placeholder="Ex: 12345" {...regPerfil('creci')} />
                      <Select label={t('profile.creciType')} {...regPerfil('creci_type')}>
                        <option value="">{copy.select}</option>
                        <option value="F">{t('profile.creciTypes.F')}</option>
                        <option value="J">{t('profile.creciTypes.J')}</option>
                      </Select></>}
                      <Input
                        label={t('profile.phone')}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={market === 'US' ? 14 : 15}
                        placeholder={market === 'US' ? '(999) 999-9999' : '(99) 99999-9999'}
                        error={profileErrors.telefone?.message}
                        {...regPerfil('telefone', { onChange: (event) => { event.target.value = formatPhone(event.target.value, market) } })}
                      />
                      {user?.market && user.market !== market && (user?.telefone || user?.whatsapp) && <FieldNotice>{market === 'US' ? 'Your saved phone is from the other market. It was preserved; confirm or replace it before using it in this market.' : 'Seu telefone salvo é do outro mercado. Ele foi preservado; confirme ou substitua antes de usá-lo neste mercado.'}</FieldNotice>}
                      <Input
                        label={t('profile.whatsapp')}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={market === 'US' ? 14 : 15}
                        placeholder={market === 'US' ? '(999) 999-9999' : '(99) 99999-9999'}
                        hint={copy.phoneHint}
                        error={profileErrors.whatsapp?.message}
                        {...regPerfil('whatsapp', {
                          onChange: (event) => {
                            event.target.value = formatPhone(event.target.value, market)
                          },
                        })}
                      />
                      <Input
                        label={t('profile.email')}
                        type="email"
                        placeholder={us ? 'contact@yourdomain.com' : 'contato@seudominio.com.br'}
                        hint={copy.emailHint}
                        error={profileErrors.email?.message}
                        {...regPerfil('email')}
                      />
                      <Select label={t('profile.state')} {...regPerfil('estado')}>
                        <option value="">{copy.select}</option>
                        {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </Select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={Palette}
                  eyebrow={us ? 'Brand' : 'Marca'}
                  title={copy.company}
                  description={copy.companyDescription}
                  optional
                  market={market}
                >
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ImageUploader
                      label={copy.logo}
                      hint={copy.logoHint}
                      value={logoFile === null ? null : (logoFile instanceof File ? null : user?.logo_url)}
                      onChange={setLogoFile}
                      shape="square"
                      market={market}
                    />
                    <div className="space-y-4">
                      <Input label={t('profile.brokerage')} placeholder={copy.brokeragePlaceholder} {...regPerfil('imobiliaria')} />
                      <Input label={t('profile.instagram')} placeholder="@seuperfil" {...regPerfil('instagram')} />
                      <Input label={t('profile.facebook')} placeholder="facebook.com/seuperfil" {...regPerfil('facebook')} />
                      <Input label={t('profile.linkedin')} placeholder="linkedin.com/in/seuperfil" {...regPerfil('linkedin')} />
                      <FieldNotice>
                        {copy.optionalNotice}
                      </FieldNotice>
                    </div>
                  </div>
                </SectionCard>

                <div className="flex justify-center sm:justify-end">
                  <Button type="submit" loading={savingPerfil} className="w-full px-8 shadow-lg shadow-primary-900/10 sm:w-auto">
                    {copy.save}
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'acesso' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">{copy.accessTitle}</h2>
                <p className="mt-1 text-sm text-gray-500">{copy.accessDescription}</p>
                <form onSubmit={handleSenha(onSaveSenha)} className="mt-6 max-w-xl space-y-4">
                  <Input
                    label={copy.loginEmail}
                    type="email"
                    value={accessEmail}
                    readOnly
                    aria-readonly="true"
                    className="cursor-not-allowed bg-slate-50 text-slate-600"
                    hint={copy.loginHint}
                  />
                  <Input
                    label={copy.currentPassword}
                    type="password"
                    autoComplete="current-password"
                    error={passwordErrors.senha_atual?.message}
                    {...regSenha('senha_atual', { required: copy.currentRequired })}
                  />
                  <Input
                    label={copy.newPassword}
                    type="password"
                    autoComplete="new-password"
                    placeholder={copy.passwordPlaceholder}
                    error={passwordErrors.nova_senha?.message}
                    {...regSenha('nova_senha', { required: copy.newRequired, minLength: { value: 12, message: copy.passwordMin } })}
                  />
                  <Input
                    label={copy.confirmPassword}
                    type="password"
                    autoComplete="new-password"
                    placeholder={copy.repeatPassword}
                    error={passwordErrors.confirmar_senha?.message}
                    {...regSenha('confirmar_senha', { required: copy.confirmRequired })}
                  />
                  {passwordErrors.root?.message && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {passwordErrors.root.message}
                    </p>
                  )}
                  <TurnstileWidget ref={passwordCaptchaRef} onTokenChange={handlePasswordCaptchaToken} />
                  <Button type="submit" loading={savingSenha} disabled={!passwordCaptchaToken}>{copy.changePassword}</Button>
                </form>
              </section>
            )}

            {activeTab === 'plano' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">{copy.planTitle}</h2>
                <p className="mt-1 text-sm text-gray-500">{copy.planDescription}</p>
                <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                  <p className="text-sm font-black text-primary-800">{copy.currentPlan}: {user?.plano || 'Starter'}</p>
                  {subscriptionStatus && (
                    <p className="mt-1 text-xs font-semibold text-primary-600">{copy.reportedStatus}: {subscriptionStatus}</p>
                  )}
                </div>
                {hasActiveSubscription && (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-600">{copy.manageDescription}</p>
                    <Button type="button" loading={openingPortal} onClick={openSubscriptionPortal} className="mt-3">
                      {copy.manage}
                    </Button>
                  </div>
                )}
                <Link to="/planos" className="mt-5 inline-flex text-sm font-black text-primary-700 hover:text-primary-900 hover:underline">
                  {copy.viewPlans}
                </Link>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

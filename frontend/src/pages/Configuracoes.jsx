import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Image,
  Lock,
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

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

function formatBrazilianPhone(value = '') {
  const rawDigits = String(value).replace(/\D/g, '')
  const digits = (rawDigits.length > 11 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

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

function ImageUploader({ label, value, onChange, shape = 'circle', hint }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(value || null)

  useEffect(() => {
    setPreview(value || null)
  }, [value])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem em JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Envie uma imagem com até 5MB.')
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
                aria-label={`Remover ${label}`}
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
            {preview ? 'Trocar imagem' : 'Enviar imagem'}
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

function StatusBadge({ complete, optional = false }) {
  if (optional) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Opcional
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
      complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {complete ? 'Perfil básico pronto' : 'Complete os dados básicos'}
    </span>
  )
}

function SectionCard({ icon: Icon, eyebrow, title, description, complete, optional = false, children }) {
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
        {(typeof complete === 'boolean' || optional) && <StatusBadge complete={complete} optional={optional} />}
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
  const [activeTab, setActiveTab] = useState(() => resolveSettingsTab(searchParams.get('tab')))
  const { user, session, updateUser } = useAuth()
  const [avatarFile, setAvatarFile] = useState(undefined)
  const [logoFile, setLogoFile] = useState(undefined)
  const [openingPortal, setOpeningPortal] = useState(false)

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
      email: '',
      creci: '',
      estado: '',
      telefone: '',
      whatsapp: '',
      imobiliaria: '',
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
      email: user?.email || session?.user?.email || '',
      creci: user?.creci || '',
      estado: user?.estado || '',
      telefone: user?.telefone || '',
      whatsapp: formatBrazilianPhone(user?.whatsapp || user?.telefone || ''),
      imobiliaria: user?.imobiliaria || '',
    })
    setAvatarFile(undefined)
    setLogoFile(undefined)
  }, [user?.id, user?.nome, user?.email, user?.creci, user?.telefone, user?.whatsapp, user?.imobiliaria, user?.estado, session?.user?.email, resetPerfil])

  const watched = watch()
  const profileComplete = useMemo(() => Boolean(
    watched.nome?.trim()
    && watched.email?.trim()
    && String(watched.whatsapp || '').replace(/\D/g, '').length >= 10
  ), [watched.nome, watched.whatsapp, watched.email])

  const uploadProfileImage = async (file, slot) => {
    if (!file || !(file instanceof File)) return null
    if (!user?.id) throw new Error('Sessão expirada. Faça login novamente.')
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/profile/${slot}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('smartcorretor-assets')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) throw new Error(`Falha ao enviar ${slot}: ${uploadError.message}`)
    if (!path.startsWith(`${user.id}/`)) throw new Error('Caminho de upload inválido.')

    const { data: signed, error: signedError } = await supabase.storage
      .from('smartcorretor-assets')
      .createSignedUrl(path, 60 * 60 * 24)

    if (signedError) throw new Error(`Falha ao preparar ${slot}: ${signedError.message}`)
    return signed.signedUrl
  }

  const onSavePerfil = async (data, successMessage = 'Cadastro profissional atualizado.') => {
    try {
      let avatar_url = user?.avatar_url || null
      let logo_url = user?.logo_url || null

      if (avatarFile instanceof File) avatar_url = await uploadProfileImage(avatarFile, 'avatar')
      else if (avatarFile === null) avatar_url = null

      if (logoFile instanceof File) logo_url = await uploadProfileImage(logoFile, 'logo')
      else if (logoFile === null) logo_url = null

      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          nome: data.nome,
          email: data.email,
          creci: data.creci,
          estado: data.estado,
          whatsapp: formatBrazilianPhone(data.whatsapp || user?.telefone || ''),
          imobiliaria: data.imobiliaria,
          avatar_url,
          logo_url,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      updateUser(updated)
      setAvatarFile(undefined)
      setLogoFile(undefined)
      toast.success(successMessage)
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar perfil.')
    }
  }

  const onSaveBasicProfile = async (data) => {
    clearProfileErrors(['nome', 'email', 'whatsapp'])
    let hasError = false
    const phoneDigits = String(data.whatsapp || '').replace(/\D/g, '')

    if (!data.nome?.trim()) {
      setProfileError('nome', { type: 'required', message: 'Informe seu nome profissional.' })
      hasError = true
    }
    if (!data.email?.trim()) {
      setProfileError('email', { type: 'required', message: 'Informe seu e-mail profissional.' })
      hasError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      setProfileError('email', { type: 'validate', message: 'Informe um e-mail profissional válido.' })
      hasError = true
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setProfileError('whatsapp', { type: 'validate', message: 'Informe um telefone com DDD.' })
      hasError = true
    }

    if (hasError) {
      toast.error('Revise os dados obrigatórios destacados.')
      return
    }

    await onSavePerfil(data)
  }

  const onSaveSenha = async (data) => {
    clearPasswordErrors()
    if (data.nova_senha !== data.confirmar_senha) {
      setPasswordError('confirmar_senha', { type: 'validate', message: 'As senhas não conferem.' })
      toast.error('As senhas não conferem.')
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: data.nova_senha })
      if (error) throw error
      toast.success('Senha alterada.')
      resetSenha()
    } catch (err) {
      const message = err.message || 'Não foi possível alterar a senha.'
      setPasswordError('root', { type: 'auth', message })
      toast.error(message)
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
      toast.error('Não foi possível abrir o gerenciamento da assinatura. Tente novamente.')
      setOpeningPortal(false)
    }
  }

  const accessEmail = session?.user?.email || 'E-mail de acesso indisponível'
  const subscriptionStatus = user?.subscription_status || user?.assinatura_status || null
  const hasActiveSubscription = ACTIVE_SUBSCRIPTION_PLANS.has(String(user?.plano || '').trim().toLowerCase())

  return (
    <div>
      <Header title="Configurações" subtitle="Gerencie seu cadastro, acesso, plano e assinatura em um só lugar." />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="space-y-1 lg:sticky lg:top-6 lg:self-start">
            {tabs.map(({ id, label, icon: Icon }) => (
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
                      Mantenha seu cadastro profissional atualizado. Esses dados podem ser usados nos materiais somente quando o produto e o layout comportarem essa identificação.
                    </p>
                  </div>
                </div>

                <SectionCard
                  icon={Briefcase}
                  eyebrow="Cadastro"
                  title="Dados profissionais"
                  description="Seu e-mail profissional é um dado de divulgação e não altera o e-mail usado para acessar sua conta."
                  complete={profileComplete}
                >
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ImageUploader
                      label="Foto profissional"
                      hint="Foto opcional, usada apenas quando o layout comportar assinatura visual."
                      value={avatarFile === null ? null : (avatarFile instanceof File ? null : user?.avatar_url)}
                      onChange={setAvatarFile}
                      shape="circle"
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Nome profissional"
                        placeholder="Seu nome de divulgação"
                        error={profileErrors.nome?.message}
                        {...regPerfil('nome')}
                      />
                      <Input label="CRECI" placeholder="Ex: 12345-F" {...regPerfil('creci')} />
                      <Input
                        label="Telefone / WhatsApp"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={15}
                        placeholder="(11) 99999-9999"
                        hint="Telefone oficial usado somente quando você escolher divulgá-lo."
                        error={profileErrors.whatsapp?.message}
                        {...regPerfil('whatsapp', {
                          onChange: (event) => {
                            event.target.value = formatBrazilianPhone(event.target.value)
                          },
                        })}
                      />
                      <Input
                        label="E-mail profissional"
                        type="email"
                        placeholder="contato@seudominio.com.br"
                        hint="Dado profissional para seus materiais. Não é o e-mail de acesso/login."
                        error={profileErrors.email?.message}
                        {...regPerfil('email')}
                      />
                      <Select label="Estado profissional" {...regPerfil('estado')}>
                        <option value="">Selecione</option>
                        {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </Select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={Palette}
                  eyebrow="Marca"
                  title="Identidade da empresa"
                  description="Preencha apenas se desejar utilizar os dados da sua imobiliária, construtora ou empresa nos materiais gerados."
                  optional
                >
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ImageUploader
                      label="Logo da empresa"
                      hint="Opcional. Use apenas quando desejar identificar a empresa nos materiais."
                      value={logoFile === null ? null : (logoFile instanceof File ? null : user?.logo_url)}
                      onChange={setLogoFile}
                      shape="square"
                    />
                    <div className="space-y-4">
                      <Input label="Imobiliária / empresa" placeholder="Ex: Silva Imóveis" {...regPerfil('imobiliaria')} />
                      <FieldNotice>
                        Todos os dados desta seção são opcionais e nunca substituem automaticamente seus dados profissionais pessoais.
                      </FieldNotice>
                    </div>
                  </div>
                </SectionCard>

                <div className="flex justify-center sm:justify-end">
                  <Button type="submit" loading={savingPerfil} className="w-full px-8 shadow-lg shadow-primary-900/10 sm:w-auto">
                    Salvar Cadastro
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'acesso' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Acesso e Senha</h2>
                <p className="mt-1 text-sm text-gray-500">O e-mail abaixo identifica seu login. Ele é diferente do e-mail profissional informado no Cadastro.</p>
                <form onSubmit={handleSenha(onSaveSenha)} className="mt-6 max-w-xl space-y-4">
                  <Input
                    label="E-mail de acesso/login"
                    type="email"
                    value={accessEmail}
                    readOnly
                    aria-readonly="true"
                    className="cursor-not-allowed bg-slate-50 text-slate-600"
                    hint="Este e-mail identifica sua conta e não pode ser alterado nesta tela."
                  />
                  <Input
                    label="Nova senha"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    error={passwordErrors.nova_senha?.message}
                    {...regSenha('nova_senha', { required: 'Informe a nova senha.', minLength: { value: 8, message: 'Use pelo menos 8 caracteres.' } })}
                  />
                  <Input
                    label="Confirmar nova senha"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    error={passwordErrors.confirmar_senha?.message}
                    {...regSenha('confirmar_senha', { required: 'Confirme a nova senha.' })}
                  />
                  {passwordErrors.root?.message && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {passwordErrors.root.message}
                    </p>
                  )}
                  <Button type="submit" loading={savingSenha}>Alterar senha</Button>
                </form>
              </section>
            )}

            {activeTab === 'plano' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Plano e Assinatura</h2>
                <p className="mt-1 text-sm text-gray-500">Consulte seu plano atual e gerencie sua assinatura com segurança pelo Stripe.</p>
                <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                  <p className="text-sm font-black text-primary-800">Plano atual: {user?.plano || 'Starter'}</p>
                  {subscriptionStatus && (
                    <p className="mt-1 text-xs font-semibold text-primary-600">Status informado: {subscriptionStatus}</p>
                  )}
                </div>
                {hasActiveSubscription && (
                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-600">Altere sua forma de pagamento ou cancele sua assinatura.</p>
                    <Button type="button" loading={openingPortal} onClick={openSubscriptionPortal} className="mt-3">
                      Gerenciar assinatura
                    </Button>
                  </div>
                )}
                <Link to="/planos" className="mt-5 inline-flex text-sm font-black text-primary-700 hover:text-primary-900 hover:underline">
                  Ver planos e condições disponíveis
                </Link>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

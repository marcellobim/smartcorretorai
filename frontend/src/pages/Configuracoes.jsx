import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  Bell,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Facebook,
  Globe2,
  Image,
  Instagram,
  Linkedin,
  Lock,
  Palette,
  Share2,
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

const VISUAL_STYLES = [
  'Profissional e direto',
  'Premium e sofisticado',
  'Moderno e vibrante',
  'Minimalista',
  'Popular e acolhedor',
]

const SOCIAL_LINK_CONFIG = {
  instagram: {
    label: 'Instagram',
    placeholder: 'https://instagram.com/seuperfil',
    icon: Instagram,
    iconClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white',
    hosts: ['instagram.com'],
  },
  facebook: {
    label: 'Facebook',
    placeholder: 'https://facebook.com/seuperfil',
    icon: Facebook,
    iconClass: 'bg-[#1877F2] text-white',
    hosts: ['facebook.com', 'fb.com'],
  },
  linkedin: {
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/seuperfil',
    icon: Linkedin,
    iconClass: 'bg-[#0A66C2] text-white',
    hosts: ['linkedin.com'],
  },
  site: {
    label: 'Site',
    placeholder: 'https://seusite.com.br',
    icon: Globe2,
    iconClass: 'bg-primary-800 text-cyan-100',
    hosts: null,
  },
}

function formatBrazilianPhone(value = '') {
  const rawDigits = String(value).replace(/\D/g, '')
  const digits = (rawDigits.length > 11 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function normalizePublicLink(value = '', network = 'site') {
  const trimmed = String(value).trim()
  if (!trimmed) return ''

  if (network === 'instagram' && trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function validatePublicLink(value, network) {
  if (!value?.trim()) return true

  try {
    const url = new URL(normalizePublicLink(value, network))
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const config = SOCIAL_LINK_CONFIG[network]
    const hasPublicHost = host.includes('.') && host !== 'localhost'
    const hasValidProtocol = url.protocol === 'https:' || url.protocol === 'http:'
    const matchesNetwork = !config.hosts || config.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))

    if (!hasValidProtocol || !hasPublicHost || !matchesNetwork) {
      return `Informe um link público válido do ${config.label}.`
    }
    return true
  } catch {
    return `Informe um link público válido do ${SOCIAL_LINK_CONFIG[network].label}.`
  }
}

const tabs = [
  { id: 'perfil', label: 'Perfil e Marca', icon: User },
  { id: 'senha', label: 'Conta e Senha', icon: Lock },
  { id: 'redes', label: 'Redes Sociais', icon: Share2 },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'assinatura', label: 'Assinatura', icon: CreditCard },
]

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

function SocialLinkField({ network, registration, error }) {
  const config = SOCIAL_LINK_CONFIG[network]
  const Icon = config.icon

  return (
    <div className={`rounded-2xl border bg-white p-4 transition focus-within:border-primary-300 focus-within:shadow-md ${error ? 'border-red-300' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      <div className="flex items-start gap-3">
        <div
          title={config.label}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${config.iconClass}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`social-${network}`} className="block text-sm font-black text-gray-950">
            {config.label}
          </label>
          <p className="mt-0.5 text-xs text-gray-500">Link público opcional</p>
        </div>
      </div>
      <input
        id={`social-${network}`}
        type="url"
        inputMode="url"
        autoComplete="url"
        placeholder={config.placeholder}
        aria-invalid={Boolean(error)}
        className={`input mt-4 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''}`}
        {...registration}
        onBlur={(event) => {
          event.target.value = normalizePublicLink(event.target.value, network)
          registration.onChange(event)
          registration.onBlur(event)
        }}
      />
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
      ) : (
        <p className="mt-2 truncate text-xs text-gray-400">{config.placeholder}</p>
      )}
    </div>
  )
}

export default function Configuracoes() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'perfil')
  const { user, session, updateUser } = useAuth()
  const [avatarFile, setAvatarFile] = useState(undefined)
  const [logoFile, setLogoFile] = useState(undefined)
  const [visualPreferences] = useState({
    primaryColor: '#0F2742',
    secondaryColor: '#0E7490',
    visualStyle: VISUAL_STYLES[0],
  })

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
      site: '',
      instagram: '',
      facebook: '',
      linkedin: '',
    },
  })

  const { register: regSenha, handleSubmit: handleSenha, reset: resetSenha, formState: { isSubmitting: savingSenha } } = useForm()

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
      site: normalizePublicLink(user?.site || '', 'site'),
      instagram: normalizePublicLink(user?.instagram || '', 'instagram'),
      facebook: normalizePublicLink(user?.facebook || '', 'facebook'),
      linkedin: normalizePublicLink(user?.linkedin || '', 'linkedin'),
    })
    setAvatarFile(undefined)
    setLogoFile(undefined)
  }, [user?.id, user?.nome, user?.email, user?.creci, user?.telefone, user?.whatsapp, user?.imobiliaria, user?.site, user?.instagram, user?.facebook, user?.linkedin, user?.estado, session?.user?.email, resetPerfil])

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

  const onSavePerfil = async (data, successMessage = 'Perfil Comercial e Marca atualizados.') => {
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
          site: normalizePublicLink(data.site, 'site'),
          instagram: normalizePublicLink(data.instagram, 'instagram'),
          facebook: normalizePublicLink(data.facebook, 'facebook'),
          linkedin: normalizePublicLink(data.linkedin, 'linkedin'),
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
    if (data.nova_senha !== data.confirmar_senha) {
      toast.error('As senhas não conferem.')
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: data.nova_senha })
      if (error) throw error
      toast.success('Senha alterada.')
      resetSenha()
    } catch (err) {
      toast.error(err.message || 'Erro ao alterar senha.')
    }
  }

  return (
    <div>
      <Header title="Configurações" subtitle="Separe conta, perfil comercial e marca para reutilizar sua identidade nos produtos." />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="space-y-1 lg:sticky lg:top-6 lg:self-start">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
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
            {activeTab === 'perfil' && (
              <form onSubmit={handlePerfil(onSaveBasicProfile)} className="space-y-6">
                <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100 shadow-sm">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <p className="pt-1 text-sm font-semibold leading-6 text-slate-700">
                      Preencha estas informações apenas uma vez. Sempre que necessário, o SmartCorretorAI utilizará automaticamente esses dados para agilizar a criação dos seus materiais.
                    </p>
                  </div>
                </div>

                <SectionCard
                  icon={Briefcase}
                  eyebrow="Perfil profissional"
                  title="Como você aparece nos materiais"
                  description="Mantenha seus dados profissionais atualizados para que possam ser utilizados quando necessário."
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
                        label="Telefone"
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
                      <Input label="Nome da empresa" placeholder="Ex: Silva Imóveis" {...regPerfil('imobiliaria')} />
                      <div
                        className="hidden"
                        aria-hidden="true"
                        data-primary-color={visualPreferences.primaryColor}
                        data-secondary-color={visualPreferences.secondaryColor}
                        data-visual-style={visualPreferences.visualStyle}
                      />
                      <FieldNotice>
                        Todos os dados desta seção são opcionais e nunca substituem automaticamente seus dados profissionais pessoais.
                      </FieldNotice>
                    </div>
                  </div>
                </SectionCard>

                <div className="flex justify-center sm:justify-end">
                  <Button type="submit" loading={savingPerfil} className="w-full px-8 shadow-lg shadow-primary-900/10 sm:w-auto">
                    Salvar Perfil Comercial e Marca
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'senha' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Conta e senha</h2>
                <p className="mt-1 text-sm text-gray-500">Aqui ficam apenas dados de acesso. Não misture login com marca.</p>
                <form onSubmit={handleSenha(onSaveSenha)} className="mt-6 max-w-xl space-y-4">
                  <Input label="Senha atual" type="password" placeholder="••••••••" {...regSenha('senha_atual', { required: 'Obrigatório' })} />
                  <Input label="Nova senha" type="password" placeholder="Mínimo 8 caracteres" {...regSenha('nova_senha', { required: 'Obrigatório', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
                  <Input label="Confirmar nova senha" type="password" placeholder="Repita a nova senha" {...regSenha('confirmar_senha', { required: 'Obrigatório' })} />
                  <Button type="submit" loading={savingSenha}>Alterar senha</Button>
                </form>
              </section>
            )}

            {activeTab === 'redes' && (
              <form
                onSubmit={handlePerfil((data) => onSavePerfil(data, 'Links públicos atualizados.'))}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex items-start gap-3 border-b border-gray-100 pb-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-800 text-cyan-100 shadow-sm">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-primary-700">Presença profissional</p>
                    <h2 className="mt-1 text-lg font-black text-gray-950">Redes sociais</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                      Cadastre apenas seus perfis públicos. O SmartCorretorAI nunca solicitará senhas ou acesso às suas redes sociais.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {Object.keys(SOCIAL_LINK_CONFIG).map((network) => (
                    <SocialLinkField
                      key={network}
                      network={network}
                      error={profileErrors[network]?.message}
                      registration={regPerfil(network, {
                        validate: (value) => validatePublicLink(value, network),
                      })}
                    />
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-xs font-semibold leading-relaxed text-emerald-800">
                  Estes campos guardam somente links públicos opcionais. Nenhuma senha, conexão de conta ou permissão de publicação é solicitada.
                </div>

                <div className="mt-6 flex justify-center sm:justify-end">
                  <Button type="submit" loading={savingPerfil} className="w-full px-8 shadow-lg shadow-primary-900/10 sm:w-auto">
                    Salvar links públicos
                  </Button>
                </div>
              </form>
            )}

            {activeTab === 'notificacoes' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Notificações</h2>
                <p className="mt-1 text-sm text-gray-500">Preferências simples para acompanhar seus materiais.</p>
                <div className="mt-5 space-y-4">
                  {[
                    { id: 'campanha_concluida', label: 'Material concluído', desc: 'Avisar quando uma geração terminar.' },
                    { id: 'dicas_semanais', label: 'Dicas semanais', desc: 'Receber sugestões práticas de marketing imobiliário.' },
                    { id: 'novidades', label: 'Novidades da plataforma', desc: 'Atualizações importantes de produtos.' },
                  ].map((notif) => (
                    <label key={notif.id} className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" defaultChecked className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span>
                        <span className="block text-sm font-black text-gray-900">{notif.label}</span>
                        <span className="block text-xs text-gray-500">{notif.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button className="mt-5">Salvar preferências</Button>
              </section>
            )}

            {activeTab === 'assinatura' && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Assinatura</h2>
                <p className="mt-1 text-sm text-gray-500">Área de plano preservada. Pagamentos não foram alterados nesta fase.</p>
                <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                  <p className="text-sm font-black text-primary-800">Plano atual: {user?.plano || 'Starter'}</p>
                  <p className="mt-1 text-xs font-semibold text-primary-600">Gerenciamento financeiro permanece no fluxo existente.</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

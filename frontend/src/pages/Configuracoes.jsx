import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Image,
  Lock,
  Palette,
  Share2,
  ShieldCheck,
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

function StatusBadge({ complete }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
      complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {complete ? 'Completo' : 'Incompleto'}
    </span>
  )
}

function SectionCard({ icon: Icon, eyebrow, title, description, complete, children }) {
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
        {typeof complete === 'boolean' && <StatusBadge complete={complete} />}
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
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'perfil')
  const { user, session, updateUser } = useAuth()
  const [avatarFile, setAvatarFile] = useState(undefined)
  const [logoFile, setLogoFile] = useState(undefined)
  const [visualPreferences, setVisualPreferences] = useState({
    primaryColor: '#0F2742',
    secondaryColor: '#0E7490',
    visualStyle: VISUAL_STYLES[0],
  })

  const {
    register: regPerfil,
    handleSubmit: handlePerfil,
    reset: resetPerfil,
    watch,
    formState: { isSubmitting: savingPerfil },
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
      whatsapp: user?.whatsapp || '',
      imobiliaria: user?.imobiliaria || '',
      site: user?.site || '',
      instagram: user?.instagram || '',
    })
    setAvatarFile(undefined)
    setLogoFile(undefined)
  }, [user?.id, user?.nome, user?.email, user?.creci, user?.telefone, user?.whatsapp, user?.imobiliaria, user?.site, user?.instagram, user?.estado, session?.user?.email, resetPerfil])

  useEffect(() => {
    const igStatus = searchParams.get('instagram')
    const motivo = searchParams.get('motivo')

    if (igStatus === 'conectado') {
      toast.success('Instagram conectado com sucesso.')
      setActiveTab('redes')
      setSearchParams({})
    } else if (igStatus === 'erro') {
      toast.error(motivo ? decodeURIComponent(motivo) : 'Erro ao conectar Instagram. Tente novamente.')
      setActiveTab('redes')
      setSearchParams({})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const watched = watch()
  const accountEmail = session?.user?.email || user?.email || ''
  const profileComplete = useMemo(() => Boolean(
    watched.nome
    && watched.creci
    && watched.whatsapp
    && watched.email
    && (avatarFile instanceof File || avatarFile === undefined ? user?.avatar_url || avatarFile instanceof File : false)
  ), [watched.nome, watched.creci, watched.whatsapp, watched.email, avatarFile, user?.avatar_url])

  const brandComplete = useMemo(() => Boolean(
    watched.imobiliaria
    && (logoFile instanceof File || logoFile === undefined ? user?.logo_url || logoFile instanceof File : false)
  ), [watched.imobiliaria, logoFile, user?.logo_url])

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

  const onSavePerfil = async (data) => {
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
          telefone: data.telefone,
          whatsapp: data.whatsapp,
          imobiliaria: data.imobiliaria,
          site: data.site,
          instagram: data.instagram,
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
      toast.success('Perfil Comercial e Marca atualizados.')
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar perfil.')
    }
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
              <form onSubmit={handlePerfil(onSavePerfil)} className="space-y-6">
                <SectionCard
                  icon={ShieldCheck}
                  eyebrow="Conta"
                  title="Login e autenticação"
                  description="A conta identifica quem acessa a plataforma. Ela não é a marca e não substitui o perfil comercial."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="E-mail de login" value={accountEmail} disabled readOnly />
                    <Input label="ID da conta" value={user?.id || ''} disabled readOnly />
                  </div>
                  <FieldNotice>
                    Alterações de autenticação ficam na aba Conta e Senha. Nenhum produto deve depender de dados inventados: se o Perfil Comercial estiver incompleto, os materiais devem usar apenas os campos preenchidos.
                  </FieldNotice>
                </SectionCard>

                <SectionCard
                  icon={Briefcase}
                  eyebrow="Perfil Comercial"
                  title="Como você aparece nos materiais"
                  description="Dados profissionais usados em banners, imagens, campanhas, vídeos e landings quando fizer sentido."
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
                      <Input label="Nome profissional" placeholder="Seu nome de divulgação" {...regPerfil('nome')} />
                      <Input label="CRECI" placeholder="Ex: 12345-F" {...regPerfil('creci')} />
                      <Input label="WhatsApp comercial" type="tel" placeholder="(11) 99999-9999" {...regPerfil('whatsapp')} />
                      <Input label="E-mail comercial" type="email" placeholder="contato@seudominio.com.br" {...regPerfil('email')} />
                      <Input label="Telefone alternativo" type="tel" placeholder="(11) 3333-4444" {...regPerfil('telefone')} />
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
                  title="Identidade visual"
                  description="A marca é separada do usuário. Ela define como a comunicação visual deve se comportar."
                  complete={brandComplete}
                >
                  <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <ImageUploader
                      label="Logo"
                      hint="Use a marca da imobiliária ou sua marca pessoal, quando existir."
                      value={logoFile === null ? null : (logoFile instanceof File ? null : user?.logo_url)}
                      onChange={setLogoFile}
                      shape="square"
                    />
                    <div className="space-y-4">
                      <Input label="Nome da marca" placeholder="Ex: Silva Imóveis" {...regPerfil('imobiliaria')} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="label">Cor principal</span>
                          <input
                            type="color"
                            value={visualPreferences.primaryColor}
                            onChange={(event) => setVisualPreferences((current) => ({ ...current, primaryColor: event.target.value }))}
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white p-1"
                          />
                        </label>
                        <label className="block">
                          <span className="label">Cor secundária</span>
                          <input
                            type="color"
                            value={visualPreferences.secondaryColor}
                            onChange={(event) => setVisualPreferences((current) => ({ ...current, secondaryColor: event.target.value }))}
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white p-1"
                          />
                        </label>
                      </div>
                      <Select
                        label="Estilo visual"
                        value={visualPreferences.visualStyle}
                        onChange={(event) => setVisualPreferences((current) => ({ ...current, visualStyle: event.target.value }))}
                      >
                        {VISUAL_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
                      </Select>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Input label="Site" placeholder="https://seusite.com.br" {...regPerfil('site')} />
                        <Input label="Instagram" placeholder="@sua_marca" {...regPerfil('instagram')} />
                      </div>
                      <FieldNotice>
                        Cor principal, cor secundária e estilo visual ficam preparados na interface para reutilização futura. Nesta etapa, a persistência remota usa somente os campos já existentes do perfil, sem migration.
                      </FieldNotice>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={BadgeCheck}
                  eyebrow="Integração futura"
                  title="Reutilização da identidade"
                  description="Esses dados foram organizados para alimentar os próximos produtos sem misturar login, pessoa e marca."
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {['Hero IA', 'Campanha IA Premium', 'Landing IA', 'Biblioteca Profissional'].map((item) => (
                      <div key={item} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm font-black text-gray-950">{item}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">Preparado para reutilizar perfil e marca.</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <div className="flex justify-end">
                  <Button type="submit" loading={savingPerfil}>Salvar Perfil Comercial e Marca</Button>
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
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-gray-950">Redes sociais</h2>
                <p className="mt-1 text-sm text-gray-500">Conexões automáticas serão ativadas em uma fase futura.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {['Instagram', 'Facebook', 'TikTok'].map((item) => (
                    <div key={item} className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
                      <p className="text-sm font-black text-gray-700">{item}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-400">Em preparação</p>
                    </div>
                  ))}
                </div>
              </section>
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

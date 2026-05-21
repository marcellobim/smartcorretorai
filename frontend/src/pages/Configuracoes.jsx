import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { User, Lock, Bell, CreditCard, Share2, CheckCircle2, AlertCircle, Loader2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '../components/layout/Header'
import { Input, Select } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'

// ── Uploader de imagem de perfil (avatar ou logo) ─────────────────────────────
function ImageUploader({ label, value, onChange, shape = 'circle', placeholderIcon = '👤' }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(value || null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { setPreview(value || null) }, [value])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Apenas imagens (jpg/png/webp)'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem maior que 5MB'); return }
    setUploading(true)
    const objUrl = URL.createObjectURL(file)
    setPreview(objUrl)
    onChange(file)
    // Libera o blob após o upload externo terminar (controlado pelo pai)
    setTimeout(() => setUploading(false), 400)
  }

  const limpar = (e) => {
    e.stopPropagation()
    setPreview(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => inputRef.current?.click()}
        className={`${shapeClass} w-20 h-20 border-2 border-dashed border-gray-300 hover:border-primary-400 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center overflow-hidden relative shrink-0`}>
        {preview ? (
          <>
            <img src={preview} alt={label} className="w-full h-full object-cover" />
            <button type="button" onClick={limpar}
              className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <span className="text-2xl text-gray-400">{uploading ? '...' : placeholderIcon}</span>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">PNG/JPG/WebP até 5MB</p>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="mt-1 text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
          <Upload className="w-3 h-3" /> {preview ? 'Trocar' : 'Enviar'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
        className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  )
}

const tabs = [
  { id: 'perfil',      label: 'Perfil',          icon: User },
  { id: 'senha',       label: 'Senha',            icon: Lock },
  { id: 'redes',       label: 'Redes Sociais',    icon: Share2 },
  { id: 'notificacoes',label: 'Notificações',     icon: Bell },
  { id: 'assinatura',  label: 'Assinatura',       icon: CreditCard },
]

// ── Instagram Status Card ────────────────────────────────────────────────────
function InstagramCard() {
  const [status] = useState({ conectado: false, username: null })
  const [conectando, setConectando] = useState(false)
  const [desconectando] = useState(false)

  const conectar = async () => {
    setConectando(true)
    toast('Conexão com Instagram chega em breve.', { icon: '🚧' })
    setTimeout(() => setConectando(false), 600)
  }

  const desconectar = async () => {
    toast('Em breve.', { icon: '🚧' })
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-100">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-sm">
          📸
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">Instagram</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Conecte sua conta Comercial ou Criador para postar automaticamente
          </p>
        </div>
        {status.conectado && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conectado
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {status.conectado ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {status.username?.charAt(0).toUpperCase() || 'IG'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">@{status.username}</p>
                {status.expira_em && (
                  <p className="text-xs text-gray-400">
                    Token válido até {new Date(status.expira_em).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-green-50 rounded-xl text-xs text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Sua conta está conectada. Após gerar anúncios, você pode postar diretamente no Instagram com um clique.</span>
            </div>

            <button
              onClick={desconectar}
              disabled={desconectando}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
            >
              {desconectando ? 'Desconectando...' : 'Desconectar Instagram'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Para postar automaticamente, sua conta do Instagram precisa ser do tipo <strong>Comercial</strong> ou <strong>Criador</strong> e estar vinculada a uma <strong>Página do Facebook</strong>.
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-500">
              <p className="font-semibold text-gray-700">Como funciona:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Clique em "Conectar Instagram" abaixo</li>
                <li>Você será direcionado ao Facebook para autorizar o app</li>
                <li>Após autorizar, volte aqui — a conta estará conectada</li>
                <li>Nos seus anúncios gerados, aparecerá o botão "Postar no Instagram"</li>
              </ol>
            </div>

            <button
              onClick={conectar}
              disabled={conectando}
              className="w-full py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {conectando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</>
              ) : (
                <>📸 Conectar Instagram</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'perfil')
  const { user, updateUser } = useAuth()

  // Lida com retorno do OAuth do Instagram
  useEffect(() => {
    const igStatus = searchParams.get('instagram')
    const motivo = searchParams.get('motivo')

    if (igStatus === 'conectado') {
      toast.success('Instagram conectado com sucesso! 🎉')
      setActiveTab('redes')
      setSearchParams({})
    } else if (igStatus === 'erro') {
      toast.error(motivo ? decodeURIComponent(motivo) : 'Erro ao conectar Instagram. Tente novamente.')
      setActiveTab('redes')
      setSearchParams({})
    }
  }, []) // eslint-disable-line

  const { register: regPerfil, handleSubmit: handlePerfil, reset: resetPerfil, formState: { isSubmitting: savingPerfil } } = useForm({
    defaultValues: {
      nome: user?.nome || '',
      email: user?.email || '',
      creci: user?.creci || '',
      estado: user?.estado || '',
      telefone: user?.telefone || '',
      whatsapp: user?.whatsapp || '',
      imobiliaria: user?.imobiliaria || '',
      instagram: user?.instagram || '',
    },
  })

  // Resetar form quando o profile chegar (caso o user inicial estivesse vazio)
  useEffect(() => {
    if (user?.id) {
      resetPerfil({
        nome: user?.nome || '',
        email: user?.email || '',
        creci: user?.creci || '',
        estado: user?.estado || '',
        telefone: user?.telefone || '',
        whatsapp: user?.whatsapp || '',
        imobiliaria: user?.imobiliaria || '',
        instagram: user?.instagram || '',
      })
      setAvatarFile(null)
      setLogoFile(null)
    }
  }, [user?.id, user?.nome, user?.creci, user?.telefone, user?.whatsapp, user?.imobiliaria, user?.instagram, user?.estado, resetPerfil])

  const [avatarFile, setAvatarFile] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  const { register: regSenha, handleSubmit: handleSenha, reset: resetSenha, formState: { isSubmitting: savingSenha } } = useForm()

  const uploadProfileImage = async (file, slot) => {
    if (!file || !(file instanceof File)) return null
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/profile/${slot}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('smartcorretor-assets')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) throw new Error(`Falha ao subir ${slot}: ${upErr.message}`)
    const { data: pub } = supabase.storage.from('smartcorretor-assets').getPublicUrl(path)
    return pub.publicUrl
  }

  const onSavePerfil = async (data) => {
    try {
      let avatar_url = user?.avatar_url || null
      let logo_url = user?.logo_url || null

      // Avatar: file novo (upload), null (limpar), undefined (não mexido)
      if (avatarFile instanceof File) {
        avatar_url = await uploadProfileImage(avatarFile, 'avatar')
      } else if (avatarFile === null && user?.avatar_url) {
        // Usuário limpou explicitamente
        avatar_url = null
      }

      if (logoFile instanceof File) {
        logo_url = await uploadProfileImage(logoFile, 'logo')
      } else if (logoFile === null && user?.logo_url) {
        logo_url = null
      }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          nome: data.nome,
          creci: data.creci,
          estado: data.estado,
          telefone: data.telefone,
          whatsapp: data.whatsapp,
          imobiliaria: data.imobiliaria,
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
      toast.success('Perfil atualizado!')
    } catch (err) { toast.error(err.message || 'Erro ao salvar perfil') }
  }

  const onSaveSenha = async (data) => {
    if (data.nova_senha !== data.confirmar_senha) { toast.error('As senhas não conferem'); return }
    try {
      const { error } = await supabase.auth.updateUser({ password: data.nova_senha })
      if (error) throw error
      toast.success('Senha alterada!')
      resetSenha()
    } catch (err) { toast.error(err.message || 'Erro ao alterar senha') }
  }

  return (
    <div>
      <Header title="Configurações" />
      <div className="p-6">
        <div className="flex gap-6 max-w-4xl">

          {/* Sidebar */}
          <nav className="w-48 shrink-0 space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeTab === id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1">

            {/* ── Perfil ── */}
            {activeTab === 'perfil' && (
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Perfil do Corretor</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Esses dados são usados pela IA para preencher os banners e vídeos gerados.
                </p>
                <form onSubmit={handlePerfil(onSavePerfil)} className="space-y-5">

                  {/* Imagens */}
                  <div className="grid sm:grid-cols-2 gap-5 p-4 bg-gray-50 rounded-xl">
                    <ImageUploader
                      label="Foto de perfil (opcional)"
                      value={avatarFile === null ? null : (avatarFile instanceof File ? null : user?.avatar_url)}
                      onChange={setAvatarFile}
                      shape="circle"
                      placeholderIcon="👤"
                    />
                    <ImageUploader
                      label="Logo da imobiliária (opcional)"
                      value={logoFile === null ? null : (logoFile instanceof File ? null : user?.logo_url)}
                      onChange={setLogoFile}
                      shape="square"
                      placeholderIcon="🏢"
                    />
                  </div>

                  {/* Identidade */}
                  <Input label="Nome completo" placeholder="Seu nome como aparece nos anúncios" {...regPerfil('nome')} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="CRECI" placeholder="Ex: 12345-F" {...regPerfil('creci')} />
                    <Select label="Estado" {...regPerfil('estado')}>
                      <option value="">Selecione</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Contato */}
                  <Input label="E-mail" type="email" placeholder="seu@email.com" readOnly disabled {...regPerfil('email')} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Telefone" type="tel" placeholder="(11) 3333-4444" {...regPerfil('telefone')} />
                    <Input label="WhatsApp" type="tel" placeholder="(11) 99999-9999" {...regPerfil('whatsapp')} />
                  </div>

                  {/* Marca */}
                  <Input label="Nome da imobiliária (opcional)" placeholder="Ex: ABC Imóveis" {...regPerfil('imobiliaria')} />
                  <Input label="Instagram (opcional)" placeholder="@seuinsta" {...regPerfil('instagram')} />

                  <Button type="submit" loading={savingPerfil}>Salvar alterações</Button>
                </form>
              </div>
            )}

            {/* ── Senha ── */}
            {activeTab === 'senha' && (
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-5">Alterar senha</h2>
                <form onSubmit={handleSenha(onSaveSenha)} className="space-y-4">
                  <Input label="Senha atual" type="password" placeholder="••••••••" {...regSenha('senha_atual', { required: 'Obrigatório' })} />
                  <Input label="Nova senha" type="password" placeholder="Mínimo 8 caracteres" {...regSenha('nova_senha', { required: 'Obrigatório', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
                  <Input label="Confirmar nova senha" type="password" placeholder="Repita a nova senha" {...regSenha('confirmar_senha', { required: 'Obrigatório' })} />
                  <Button type="submit" loading={savingSenha}>Alterar senha</Button>
                </form>
              </div>
            )}

            {/* ── Redes Sociais ── */}
            {activeTab === 'redes' && (
              <div className="space-y-5">
                <div className="card p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Redes Sociais</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Conecte suas redes sociais para publicar anúncios automaticamente com um clique.
                  </p>
                  <InstagramCard />
                </div>

                <div className="card p-5 border-dashed border-gray-200">
                  <div className="flex items-center gap-3 text-gray-400">
                    <span className="text-2xl">👍</span>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Facebook</p>
                      <p className="text-xs text-gray-400">Em breve</p>
                    </div>
                  </div>
                </div>

                <div className="card p-5 border-dashed border-gray-200">
                  <div className="flex items-center gap-3 text-gray-400">
                    <span className="text-2xl">🎵</span>
                    <div>
                      <p className="text-sm font-medium text-gray-600">TikTok</p>
                      <p className="text-xs text-gray-400">Em breve</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notificações ── */}
            {activeTab === 'notificacoes' && (
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-5">Preferências de notificação</h2>
                <div className="space-y-4">
                  {[
                    { id: 'campanha_concluida', label: 'Anúncio concluído', desc: 'Quando seus anúncios forem gerados pela IA' },
                    { id: 'dicas_semanais', label: 'Dicas semanais', desc: 'Receba dicas de marketing imobiliário toda semana' },
                    { id: 'novidades', label: 'Novidades da plataforma', desc: 'Novos recursos e atualizações' },
                  ].map(notif => (
                    <label key={notif.id} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{notif.label}</p>
                        <p className="text-xs text-gray-500">{notif.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button className="mt-5">Salvar preferências</Button>
              </div>
            )}

            {/* ── Assinatura ── */}
            {activeTab === 'assinatura' && (
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-5">Assinatura</h2>
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl mb-5">
                  <p className="text-sm font-semibold text-primary-700">Plano atual: {user?.plano || 'Teste Grátis'}</p>
                  <p className="text-xs text-primary-500 mt-1">Próxima cobrança em 01/06/2026</p>
                </div>
                <div className="space-y-3">
                  <Button variant="secondary" className="w-full">Alterar plano</Button>
                  <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50">Cancelar assinatura</Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

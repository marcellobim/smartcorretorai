import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null }
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) console.error('profile load error', error)

    if (!data) {
      const { data: { user: authU } } = await supabase.auth.getUser()
      if (authU?.id === uid) {
        const { error: insertErr } = await supabase
          .from('profiles')
          .upsert({ id: uid, email: authU.email }, { onConflict: 'id', ignoreDuplicates: true })
        if (insertErr) console.error('profile auto-create error', insertErr)
        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle()
        if (retry.error) console.error('profile reload after create error', retry.error)
        data = retry.data
      }
    }

    setProfile(data || null)
    return data
  }, [])

  const init = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    setAuthUser(session?.user ?? null)
    if (session?.user) await loadProfile(session.user.id)
    setLoading(false)
  }, [loadProfile])

  useEffect(() => {
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setAuthUser(session?.user ?? null)
        if (session?.user) await loadProfile(session.user.id)
        else setProfile(null)
      }
    )
    return () => subscription.unsubscribe()
  }, [init, loadProfile])

  // Fallback: se authUser existe mas profile ficou null após init (ex.: falha de
  // rede, RLS momentâneo, hard reload), força um reload do profile.
  useEffect(() => {
    if (!loading && authUser?.id && !profile) {
      loadProfile(authUser.id)
    }
  }, [authUser?.id, profile, loading, loadProfile])

  // Mantém a sessão "viva": ao ganhar foco da aba, força getSession() e, se vier
  // null, tenta refreshSession() automaticamente. O onAuthStateChange acima
  // captura TOKEN_REFRESHED e atualiza authUser/profile, mas também atualizamos
  // explicitamente aqui para evitar janela de race.
  useEffect(() => {
    const handleFocus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setAuthUser(session.user)
          return
        }
        // Sessão nula: tentar refresh
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr) {
          console.warn('[auth focus] refreshSession falhou:', refreshErr.message)
          setAuthUser(null)
          setProfile(null)
          return
        }
        if (refreshed?.session?.user) {
          setAuthUser(refreshed.session.user)
          await loadProfile(refreshed.session.user.id)
        } else {
          setAuthUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('[auth focus] erro:', err)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    // Limpa o estado local IMEDIATAMENTE para a UI redirecionar sem esperar a rede.
    setAuthUser(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('signOut error', err)
    }
  }

  const reloadProfile = useCallback(async () => {
    if (authUser?.id) return loadProfile(authUser.id)
    return null
  }, [authUser?.id, loadProfile])

  const updateUser = (partial) => {
    setProfile((prev) => ({ ...(prev || {}), ...(partial || {}) }))
  }

  // role pode estar em `profiles.role` OU em `auth.users.user_metadata.role`.
  // Achatamos para `user.role` para que checagens simples (ex. Sidebar `user.role === 'admin'`) funcionem.
  const mergedRole = profile?.role || authUser?.user_metadata?.role || null

  // displayName: usa full_name do profile; se null, cai para a parte antes do @ do email.
  const emailLocal = authUser?.email ? authUser.email.split('@')[0] : null
  const displayName = profile?.full_name || profile?.nome || emailLocal || 'Usuário'

  const user = authUser
    ? { ...authUser, ...(profile || {}), role: mergedRole, displayName, nome: displayName }
    : null
  const isPro = !!(profile?.plano && profile.plano !== 'starter')
  const isAuthenticated = !!authUser
  const isAdmin = mergedRole === 'admin'

  const value = {
    user,
    profile,
    loading,
    isAuthenticated,
    init,
    signIn,
    signUp,
    signOut,
    logout: signOut,
    reloadProfile,
    updateUser,
    isPro,
    isAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve estar dentro de <AuthProvider>')
  return ctx
}

export function useAuthStore(selector) {
  const state = useAuth()
  return typeof selector === 'function' ? selector(state) : state
}

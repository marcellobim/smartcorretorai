import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialResolvedRef = useRef(false)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null }
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle()
      if (error) console.error('[loadProfile] select error:', error)

      if (!data) {
        try {
          const { data: { user: authU } } = await supabase.auth.getUser()
          if (authU?.id === uid) {
            const { error: insertErr } = await supabase
              .from('profiles')
              .upsert({ id: uid, email: authU.email }, { onConflict: 'id', ignoreDuplicates: true })
            if (insertErr) console.error('[loadProfile] auto-create error:', insertErr)
            const retry = await supabase
              .from('profiles')
              .select('*')
              .eq('id', uid)
              .maybeSingle()
            if (retry.error) console.error('[loadProfile] retry error:', retry.error)
            data = retry.data
          }
        } catch (innerErr) {
          console.error('[loadProfile] erro ao tentar auto-criar profile:', innerErr)
        }
      }

      setProfile(data || null)
      return data
    } catch (err) {
      console.error('[loadProfile] erro fatal:', err)
      setProfile(null)
      return null
    }
  }, [])

  // ──────────────────────────────────────────────────────────────────────────
  // Inicialização única + listener de eventos (single source of truth)
  //
  // O Supabase v2 dispara INITIAL_SESSION logo após o subscribe, com a sessão
  // restaurada do localStorage. Isso elimina a necessidade de chamar getSession
  // em paralelo — basta esperar o callback. Mantemos um timer de segurança caso
  // o INITIAL_SESSION não dispare em 3s.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    const resolveSession = async (session, source) => {
      if (!mounted) return
      try {
        const sessionUser = session?.user ?? null
        setAuthUser(sessionUser)
        if (sessionUser) {
          await loadProfile(sessionUser.id)
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error(`[auth ${source}] erro ao resolver sessão:`, err)
      } finally {
        if (mounted && !initialResolvedRef.current) {
          initialResolvedRef.current = true
          setLoading(false)
        }
      }
    }

    // 1) Subscribe — INITIAL_SESSION dispara assim que o cliente hidrata.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.log('[auth] event:', event, 'hasSession:', !!session, 'userId:', session?.user?.id)
        await resolveSession(session, event)
      }
    )

    // 2) Fallback — se INITIAL_SESSION não disparar em 3s, força um getSession.
    //    Cobre cenários raros de hidratação travada do client.
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || initialResolvedRef.current) return
      console.warn('[auth] INITIAL_SESSION não disparou em 3s — fallback getSession()')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!initialResolvedRef.current) {
          await resolveSession(session, 'fallback-getSession')
        }
      } catch (err) {
        console.error('[auth fallback] erro:', err)
        if (mounted && !initialResolvedRef.current) {
          initialResolvedRef.current = true
          setLoading(false)
        }
      }
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // Fallback: se authUser existe mas profile ficou null (RLS momentâneo, rede),
  // tenta recarregar o profile sem mexer no authUser.
  useEffect(() => {
    if (!loading && authUser?.id && !profile) {
      loadProfile(authUser.id)
    }
  }, [authUser?.id, profile, loading, loadProfile])

  // ──────────────────────────────────────────────────────────────────────────
  // Foco da aba: revalida a sessão SEM derrubar o usuário em falhas transitórias.
  // - Só age após a inicialização ter concluído (evita race com hidratação).
  // - Se refreshSession falhar (rede, etc.), mantém o estado atual; o
  //   onAuthStateChange detectará SIGNED_OUT real se for o caso.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleFocus = async () => {
      if (!initialResolvedRef.current) return // ainda hidratando — não interfere
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setAuthUser(session.user)
          return
        }
        // getSession devolveu null. Tenta refresh; se falhar, NÃO desloga.
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr) {
          console.warn('[auth focus] refreshSession falhou (mantendo estado atual):', refreshErr.message)
          return
        }
        if (refreshed?.session?.user) {
          setAuthUser(refreshed.session.user)
          await loadProfile(refreshed.session.user.id)
        }
        // Se refresh deu sucesso mas sem session.user, mantém estado — o
        // onAuthStateChange dispara SIGNED_OUT explicitamente se for o caso.
      } catch (err) {
        console.error('[auth focus] erro:', err)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadProfile])

  // Função `init` exposta no contexto (re-executa a hidratação sob demanda).
  const init = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      else setProfile(null)
    } catch (err) {
      console.error('[init] erro:', err)
    } finally {
      initialResolvedRef.current = true
      setLoading(false)
    }
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

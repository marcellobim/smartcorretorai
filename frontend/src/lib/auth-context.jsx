import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

// ─── Helpers ──────────────────────────────────────────────────────────────
// Promise.race com timeout — não deixa nenhuma chamada de rede travar a UI.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)
    ),
  ])
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialResolvedRef = useRef(false)
  const profileInFlightRef = useRef(false)

  // ─── loadProfile ──────────────────────────────────────────────────────────
  // Busca a linha em `profiles` para o uid passado.
  // - Schema: `profiles.nome` (full name), email, creci, telefone, whatsapp,
  //   avatar_url, logo_url, imobiliaria, site, instagram, role, plano.
  // - RLS: `auth.uid() = id` (migração 20260517).
  // - SELECT * para evitar drift quando colunas novas forem adicionadas.
  // - Timeout duro de 8s por tentativa + 1 retry com 600ms de espera.
  // - Auto-cria a linha (upsert) se não existir, sem chamar supabase.auth.getUser()
  //   (esse método faz request de rede e foi fonte de timeouts; usamos o email
  //   passado pelo caller, que vem do authUser já em memória).
  // - Lock via ref evita chamadas concorrentes que poderiam intercalar
  //   setProfile(null) com setProfile(data) e zerar a UI.
  const loadProfile = useCallback(async (uid, email, attempt = 1) => {
    if (!uid) { setProfile(null); return null }

    if (profileInFlightRef.current && attempt === 1) {
      console.log('[loadProfile] já em andamento — skip')
      return null
    }
    profileInFlightRef.current = true

    try {
      console.log(`[loadProfile] start uid=${uid} attempt=${attempt}`)
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        8000,
        'loadProfile select'
      )

      if (error) {
        console.error('[loadProfile] select error:', error.message || error)
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600))
          return loadProfile(uid, email, attempt + 1)
        }
        return null
      }

      // Linha não existe ainda — tenta auto-criar (signup sem trigger).
      // NÃO chamamos supabase.auth.getUser() (faz request, pode travar);
      // usamos o email passado pelo caller.
      if (!data) {
        console.warn('[loadProfile] row não existe — auto-create')
        const payload = email ? { id: uid, email } : { id: uid }
        const { error: insertErr } = await withTimeout(
          supabase.from('profiles').upsert(payload, { onConflict: 'id', ignoreDuplicates: true }),
          5000,
          'loadProfile upsert'
        )
        if (insertErr) console.error('[loadProfile] auto-create error:', insertErr.message || insertErr)

        const retry = await withTimeout(
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
          5000,
          'loadProfile retry select'
        )
        if (retry.error) console.error('[loadProfile] retry error:', retry.error.message || retry.error)
        const final = retry.data || null
        setProfile(final)
        if (final) console.log('[loadProfile] auto-created OK | nome:', final.nome || '(vazio)')
        return final
      }

      if (!data.nome && !data.full_name) {
        console.warn('[loadProfile] perfil sem nome — exibirá "Usuário". Preencha em Configurações. uid:', uid)
      } else {
        console.log('[loadProfile] OK | nome:', data.nome || data.full_name)
      }
      setProfile(data)
      return data
    } catch (err) {
      console.error('[loadProfile] fatal:', err.message || err)
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800))
        return loadProfile(uid, email, attempt + 1)
      }
      return null
    } finally {
      if (attempt === 1) profileInFlightRef.current = false
    }
  }, [])

  // ─── Single source of truth: onAuthStateChange ───────────────────────────
  // O cliente Supabase dispara INITIAL_SESSION imediatamente após o subscribe,
  // com a sessão restaurada do localStorage. Não usamos getSession() pra
  // hidratar — é mais lento e foi fonte de timeouts. Apenas escutamos.
  useEffect(() => {
    let mounted = true

    const resolveSession = async (newSession, source) => {
      if (!mounted) return
      const sessionUser = newSession?.user ?? null
      console.log(`[auth ${source}] hasSession=${!!newSession} userId=${sessionUser?.id || '(nenhum)'}`)
      setSession(newSession ?? null)
      setAuthUser(sessionUser)
      if (sessionUser) {
        await loadProfile(sessionUser.id, sessionUser.email)
      } else {
        setProfile(null)
      }
      if (mounted && !initialResolvedRef.current) {
        initialResolvedRef.current = true
        setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        // INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED.
        // Pra todos eles tratamos a sessão de forma uniforme — assim o profile
        // é re-checado após token refresh e USER_UPDATED também.
        await resolveSession(session, event)
      }
    )

    // Rede de segurança: se INITIAL_SESSION NÃO disparar em 4s, força um
    // getSession com timeout. Cobre casos raros de hidratação travada.
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || initialResolvedRef.current) return
      console.warn('[auth] INITIAL_SESSION não disparou em 4s — fallback getSession()')
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 4000, 'fallback getSession')
        if (!initialResolvedRef.current) {
          await resolveSession(data?.session ?? null, 'fallback-getSession')
        }
      } catch (err) {
        console.error('[auth fallback] erro:', err.message || err)
        if (mounted && !initialResolvedRef.current) {
          initialResolvedRef.current = true
          setLoading(false)
        }
      }
    }, 4000)

    return () => {
      mounted = false
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  // ─── Re-fetch defensivo ──────────────────────────────────────────────────
  // Se authUser existe mas profile ficou null (loadProfile inicial falhou por
  // timing/RLS), tenta uma vez extra após pequeno delay. Não fica em loop:
  // se o segundo loadProfile também devolver null, paramos.
  const retryAttemptedRef = useRef(false)
  useEffect(() => {
    if (loading) return
    if (!authUser?.id) {
      retryAttemptedRef.current = false
      return
    }
    if (profile || retryAttemptedRef.current) return
    retryAttemptedRef.current = true
    console.log('[auth] profile null com authUser válido — retry defensivo')
    loadProfile(authUser.id, authUser.email)
  }, [authUser?.id, authUser?.email, profile, loading, loadProfile])

  // ─── Foco da aba ─────────────────────────────────────────────────────────
  // Não fazemos getSession/refreshSession manual aqui — o cliente Supabase
  // já tem autoRefreshToken: true (ver lib/supabase.js) e mantém o JWT vivo
  // em background. A única coisa útil no focus é re-fetch do profile caso
  // ele tenha caído pra null por algum motivo (RLS transitório, rede).
  useEffect(() => {
    const handleFocus = () => {
      if (!initialResolvedRef.current) return
      if (authUser?.id && !profile) {
        console.log('[auth focus] profile null — recarregando')
        retryAttemptedRef.current = false
        loadProfile(authUser.id, authUser.email)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [authUser?.id, authUser?.email, profile, loadProfile])

  // ─── Ações de auth ───────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: metadata },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    // Limpa estado local IMEDIATAMENTE pra UI redirecionar sem esperar rede.
    setAuthUser(null)
    setSession(null)
    setProfile(null)
    try { await supabase.auth.signOut() } catch (err) { console.error('signOut error', err) }
  }

  const reloadProfile = useCallback(async () => {
    if (!authUser?.id) return null
    retryAttemptedRef.current = false
    return loadProfile(authUser.id, authUser.email)
  }, [authUser?.id, authUser?.email, loadProfile])

  const updateUser = (partial) => {
    setProfile((prev) => ({ ...(prev || {}), ...(partial || {}) }))
  }

  // ─── Derivados ───────────────────────────────────────────────────────────
  // role pode estar em `profiles.role` OU em `auth.users.user_metadata.role`.
  const mergedRole = profile?.role || authUser?.user_metadata?.role || null

  // displayName: prioridade do schema real (`profiles.nome`), com fallback pra
  // metadata do JWT (preenchida no signUp via options.data) e por fim
  // 'Usuário'. NUNCA cai pro email — isso mascarava o problema antes.
  const metaName =
    authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.nome
    || authUser?.user_metadata?.name
    || null
  const displayName = profile?.nome || profile?.full_name || metaName || 'Usuário'

  const user = authUser
    ? { ...authUser, ...(profile || {}), role: mergedRole, displayName, nome: displayName }
    : null
  const isPro = !!(profile?.plano && profile.plano !== 'starter')
  const isAuthenticated = !!authUser
  const isAdmin = mergedRole === 'admin'

  // JWT direto do contexto — consumidores leem sem chamar supabase.auth.*
  const accessToken = session?.access_token || null

  const value = {
    user,
    profile,
    session,
    accessToken,
    loading,
    isAuthenticated,
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

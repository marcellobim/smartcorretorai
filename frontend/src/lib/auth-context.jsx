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

// Direct PostgREST fetch com Authorization explícito.
//
// Por que não usar supabase.from('profiles').select()? Após F5, o estado
// interno do supabase-js (auth.session, postgrest auth headers) tem race
// condition: o INITIAL_SESSION dispara com o session correto, mas o
// postgrest sub-client pode ainda não ter o JWT propagado. Resultado:
// a query vai sem Authorization, RLS aplica `auth.uid() = id` com uid
// nulo, e a resposta volta vazia silenciosamente.
//
// Fetch direto com header explícito ignora completamente esse estado
// interno — o servidor PostgREST recebe o JWT, valida, e RLS roda com
// o uid correto.
async function fetchProfileDirect(uid, accessToken) {
  const url = `${supabase.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey: supabase.supabaseKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostgREST ${res.status}: ${body.slice(0, 200)}`)
  }
  const arr = await res.json()
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null
}

async function upsertProfileDirect(uid, email, accessToken) {
  const payload = email ? { id: uid, email } : { id: uid }
  const res = await fetch(`${supabase.supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: supabase.supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  })
  // 409 = conflict (linha já existia) — também é OK.
  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostgREST upsert ${res.status}: ${body.slice(0, 200)}`)
  }
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
  const loadProfile = useCallback(async (uid, email, accessToken) => {
    if (!uid) { setProfile(null); return null }
    if (profileInFlightRef.current) {
      console.log('[loadProfile] já em andamento — skip')
      return null
    }
    profileInFlightRef.current = true

    try {
      console.log(`[loadProfile] start uid=${uid} hasToken=${!!accessToken}`)

      // Tenta UMA fetch — direct fetch (com token) ou client supabase (sem token).
      // Direct fetch é o caminho preferido pós F5: bypassa o estado interno do
      // postgrest sub-client (que pode estar dessincronizado e fazer a query
      // sem Authorization, levando RLS a retornar vazio).
      const fetchOnce = async () => {
        if (accessToken) {
          return await withTimeout(
            fetchProfileDirect(uid, accessToken),
            8000,
            'loadProfile direct fetch'
          )
        }
        // Sem token (caso raro) — usa o client. Aceita o risco da race.
        const { data, error } = await withTimeout(
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
          8000,
          'loadProfile client select'
        )
        if (error) throw error
        return data
      }

      // 2 tentativas com 600ms de espera entre elas.
      let data = null
      try {
        data = await fetchOnce()
      } catch (err) {
        console.error('[loadProfile] tentativa 1 falhou:', err.message || err)
        await new Promise((r) => setTimeout(r, 600))
        try {
          data = await fetchOnce()
        } catch (err2) {
          console.error('[loadProfile] tentativa 2 falhou:', err2.message || err2)
          setProfile(null)
          return null
        }
      }

      // Linha não existe — auto-create (somente possível com token).
      if (!data && accessToken) {
        console.warn('[loadProfile] row não existe — auto-create')
        try {
          await withTimeout(upsertProfileDirect(uid, email, accessToken), 5000, 'loadProfile upsert')
          data = await withTimeout(fetchProfileDirect(uid, accessToken), 5000, 'loadProfile post-upsert fetch')
        } catch (err) {
          console.error('[loadProfile] auto-create error:', err.message || err)
        }
      }

      if (!data) {
        console.warn('[loadProfile] sem profile após todas as tentativas. uid:', uid)
        setProfile(null)
        return null
      }

      if (!data.nome && !data.full_name) {
        console.warn('[loadProfile] perfil sem nome — exibirá "Usuário". Preencha em Configurações. uid:', uid)
      } else {
        console.log('[loadProfile] OK | nome:', data.nome || data.full_name)
      }
      setProfile(data)
      return data
    } finally {
      profileInFlightRef.current = false
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
        // Passa o access_token explicitamente — loadProfile usa direct fetch
        // pra evitar a race do estado interno do postgrest no F5.
        await loadProfile(sessionUser.id, sessionUser.email, newSession?.access_token)
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
    loadProfile(authUser.id, authUser.email, session?.access_token)
  }, [authUser?.id, authUser?.email, session?.access_token, profile, loading, loadProfile])

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
        loadProfile(authUser.id, authUser.email, session?.access_token)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [authUser?.id, authUser?.email, session?.access_token, profile, loadProfile])

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
    return loadProfile(authUser.id, authUser.email, session?.access_token)
  }, [authUser?.id, authUser?.email, session?.access_token, loadProfile])

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

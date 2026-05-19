import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
    if (error) console.error('profile load error', error)
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
    await supabase.auth.signOut()
    setAuthUser(null)
    setProfile(null)
  }

  const user = authUser ? { ...authUser, ...(profile || {}) } : null
  const isPro = !!(profile?.plano && profile.plano !== 'starter')

  const value = {
    user,
    profile,
    loading,
    init,
    signIn,
    signUp,
    signOut,
    logout: signOut,
    isPro,
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

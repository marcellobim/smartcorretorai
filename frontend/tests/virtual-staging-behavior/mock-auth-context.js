const user = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  whatsapp: '11999999999',
})

export function useAuth() {
  return { user, isPro: false, reloadProfile: async () => {} }
}

export function useOptionalAuth() {
  return null
}

export function AuthProvider({ children }) {
  return children
}

export function useAuthStore(selector) {
  const state = { user, isPro: false, isAuthenticated: true, loading: false }
  return typeof selector === 'function' ? selector(state) : state
}

import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, token, loading, login, register, logout, updateUser } = useAuthStore()

  return {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isPro: user?.plano === 'pro' || user?.plano === 'imobiliaria',
    isImobiliaria: user?.plano === 'imobiliaria',
    login,
    register,
    logout,
    updateUser,
  }
}

import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, token, loading, login, register, logout, updateUser } = useAuthStore()

  return {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isPro: user?.plano === 'pro' || user?.plano === 'enterprise',
    isEnterprise: user?.plano === 'enterprise',
    login,
    register,
    logout,
    updateUser,
  }
}

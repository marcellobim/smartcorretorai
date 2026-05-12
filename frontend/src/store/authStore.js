import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '../services/auth'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,

      login: async (email, password) => {
        set({ loading: true })
        try {
          const data = await authService.login(email, password)
          set({ user: data.user, token: data.token, loading: false })
          return data
        } catch (err) {
          set({ loading: false })
          throw err
        }
      },

      register: async (payload) => {
        set({ loading: true })
        try {
          const data = await authService.register(payload)
          set({ user: data.user, token: data.token, loading: false })
          return data
        } catch (err) {
          set({ loading: false })
          throw err
        }
      },

      logout: () => {
        authService.logout().catch(() => {})
        set({ user: null, token: null })
      },

      updateUser: (updates) => {
        set({ user: { ...get().user, ...updates } })
      },
    }),
    {
      name: 'smartcorretor-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)

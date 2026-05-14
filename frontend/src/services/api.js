import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: 'https://smartcorretorai-production.up.railway.app/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido ou expirado - fazer logout
      const { logout } = useAuthStore.getState()
      logout()
      
      // Redirecionar para login se não estiver já lá
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true'
      }
    }
    const message = error.response?.data?.message || 'Erro ao conectar com o servidor'
    return Promise.reject(new Error(message))
  },
)

export default api

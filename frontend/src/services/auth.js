import api from './api'

export const authService = {
  async login(email, password) {
    return api.post('/auth/login', { email, password })
  },

  async register(data) {
    return api.post('/auth/register', data)
  },

  async me() {
    return api.get('/auth/me')
  },

  async forgotPassword(email) {
    return api.post('/auth/forgot-password', { email })
  },

  async resetPassword(token, password) {
    return api.post('/auth/reset-password', { token, password })
  },

  async logout() {
    return api.post('/auth/logout')
  },

  async resendConfirmation(email) {
    return api.post('/auth/resend-confirmation', { email })
  },
}

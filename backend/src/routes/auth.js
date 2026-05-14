const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const { register, login, me, logout, forgotPassword, resendConfirmation } = require('../controllers/authController')
const { authMiddleware } = require('../middleware/auth')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Muitas tentativas. Aguarde 15 minutos.' },
  skip: (req) => {
    // Remove rate limit para usuário admin
    if (req.user && req.user.email === 'Riccieri68@gmail.com') {
      return true
    }
    return false
  },
})

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/logout', authMiddleware, logout)
router.get('/me', authMiddleware, me)
router.post('/forgot-password', authLimiter, forgotPassword)
router.post('/resend-confirmation', authLimiter, resendConfirmation)

module.exports = router

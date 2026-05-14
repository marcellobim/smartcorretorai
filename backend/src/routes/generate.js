const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const { campaign, status, credits } = require('../controllers/generateController')
const { authMiddleware } = require('../middleware/auth')

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { success: false, message: 'Aguarde um momento antes de gerar outra campanha.' },
})

router.use(authMiddleware)

router.get('/credits', credits)
router.post('/campaign', generateLimiter, campaign)
router.get('/campaign/:id/status', status)

module.exports = router

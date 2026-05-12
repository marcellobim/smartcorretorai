const router = require('express').Router()
const { checkout, currentPlan } = require('../controllers/subscriptionController')
const { authMiddleware } = require('../middleware/auth')

// O webhook do Stripe é montado direto em app.js (precisa rodar antes do express.json)

router.use(authMiddleware)
router.post('/checkout', checkout)
router.get('/current', currentPlan)

module.exports = router

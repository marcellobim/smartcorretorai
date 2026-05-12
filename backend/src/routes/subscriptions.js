const router = require('express').Router()
const express = require('express')
const { checkout, webhook, currentPlan } = require('../controllers/subscriptionController')
const { authMiddleware } = require('../middleware/auth')

// Webhook precisa do body raw
router.post('/webhook', express.raw({ type: 'application/json' }), webhook)

router.use(authMiddleware)
router.post('/checkout', checkout)
router.get('/current', currentPlan)

module.exports = router

const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
const { render, statusRender } = require('../controllers/renderController')

router.post('/campaign/:id', authenticate, render)
router.get('/campaign/:id/status', authenticate, statusRender)

module.exports = router

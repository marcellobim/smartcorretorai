const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')
const { render, statusRender } = require('../controllers/renderController')

router.post('/campaign/:id', authMiddleware, render)
router.get('/campaign/:id/status', authMiddleware, statusRender)

module.exports = router

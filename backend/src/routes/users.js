const router = require('express').Router()
const { getMe, updateMe, updatePassword } = require('../controllers/userController')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/me', getMe)
router.put('/me', updateMe)
router.put('/me/password', updatePassword)

module.exports = router

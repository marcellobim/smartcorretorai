const router = require('express').Router()
const { list, getOne, remove } = require('../controllers/campaignController')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/', list)
router.get('/:id', getOne)
router.delete('/:id', remove)

module.exports = router

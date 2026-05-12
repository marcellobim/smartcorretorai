const router = require('express').Router()
const { list, create, update, remove } = require('../controllers/propertyController')
const { authMiddleware } = require('../middleware/auth')

router.use(authMiddleware)

router.get('/', list)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

module.exports = router

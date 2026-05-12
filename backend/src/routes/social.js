const router = require('express').Router()
const { authMiddleware } = require('../middleware/auth')
const {
  connectInstagram,
  instagramCallback,
  instagramStatus,
  postarInstagram,
  desconectarInstagram,
} = require('../controllers/socialController')

// Inicia o fluxo OAuth — retorna a URL do Facebook para o frontend redirecionar
router.get('/instagram/connect', authMiddleware, connectInstagram)

// Callback do Facebook OAuth — redireciona o browser de volta ao frontend
router.get('/instagram/callback', instagramCallback)

// Verifica se o Instagram está conectado
router.get('/instagram/status', authMiddleware, instagramStatus)

// Posta a campanha no Instagram
router.post('/instagram/post', authMiddleware, postarInstagram)

// Remove a conexão com o Instagram
router.delete('/instagram/disconnect', authMiddleware, desconectarInstagram)

module.exports = router

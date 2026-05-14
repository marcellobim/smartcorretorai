const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { adminMiddleware } = require('../middleware/adminMiddleware')
const {
  getStats,
  listUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  adjustCredits,
  listCampaigns,
  getRevenue,
  getCosts,
} = require('../controllers/adminController')

const router = express.Router()

// Todas as rotas admin requerem autenticação + role admin
router.use(authMiddleware)
router.use(adminMiddleware)

// Estatísticas gerais
router.get('/stats', getStats)

// Gerenciamento de usuários
router.get('/users', listUsers)
router.get('/users/:id', getUserDetails)
router.put('/users/:id', updateUser)
router.delete('/users/:id', deleteUser)
router.post('/users/:id/credits', adjustCredits)

// Campanhas
router.get('/campaigns', listCampaigns)

// Receita e custos
router.get('/revenue', getRevenue)
router.get('/costs', getCosts)

module.exports = router

const { error } = require('../utils/response')

/**
 * Middleware para proteger rotas administrativas
 * Verifica se o usuário autenticado possui role = 'admin'
 */
async function adminMiddleware(req, res, next) {
  try {
    // authMiddleware já populou req.user
    if (!req.user) {
      return error(res, 'Autenticação necessária', 401)
    }

    // Verifica se o usuário tem role de admin
    if (req.user.role !== 'admin') {
      return error(res, 'Acesso negado. Apenas administradores podem acessar esta área.', 403)
    }

    next()
  } catch (err) {
    console.error('Erro no adminMiddleware:', err)
    return error(res, 'Erro ao verificar permissões de administrador', 500)
  }
}

module.exports = { adminMiddleware }

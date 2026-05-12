const jwt = require('jsonwebtoken')
const supabase = require('../services/supabase')

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token de acesso necessário' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Token inválido' })
    }

    req.user = user
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' })
  }
}

async function checkPlanLimit(resource, limit) {
  return async (req, res, next) => {
    const { data: count } = await supabase
      .from(resource)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    if (count >= limit[req.user.plano || 'starter']) {
      return res.status(403).json({
        success: false,
        message: `Limite do plano atingido. Faça upgrade para continuar.`,
        code: 'PLAN_LIMIT_REACHED',
      })
    }
    next()
  }
}

module.exports = { authMiddleware, checkPlanLimit }

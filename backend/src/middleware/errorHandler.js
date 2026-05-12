function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message })
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token inválido' })
  }

  const status = err.status || err.statusCode || 500
  const message = status < 500 ? err.message : 'Erro interno do servidor'

  res.status(status).json({ success: false, message })
}

module.exports = { errorHandler }

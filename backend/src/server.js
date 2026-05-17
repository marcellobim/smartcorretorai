require('dotenv').config()
const app = require('./app')

const PORT = process.env.PORT || 3001
const HOST = '0.0.0.0' // Railway precisa escutar em 0.0.0.0, não localhost

app.listen(PORT, HOST, () => {
  console.log(`🚀 SmartCorretorAI API rodando na porta ${PORT}`)
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`📡 Escutando em: ${HOST}:${PORT}`)
})

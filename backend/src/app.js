const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const propertyRoutes = require('./routes/properties')
const campaignRoutes = require('./routes/campaigns')
const generateRoutes = require('./routes/generate')
const subscriptionRoutes = require('./routes/subscriptions')
const socialRoutes = require('./routes/social')
const renderRoutes = require('./routes/render')
const { webhook: stripeWebhook } = require('./controllers/subscriptionController')
const { errorHandler } = require('./middleware/errorHandler')

const app = express()

app.use(helmet())

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://smartcorretorai.vercel.app',
  'https://smartcorretorai.com.br',
  'https://www.smartcorretorai.com.br',
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS bloqueado: ${origin}`))
  },
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Stripe webhook precisa do body raw — montado ANTES do express.json
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Muitas requisições. Tente novamente em 15 minutos.' },
  // Polling de status do Creatomate (6s) estouraria o limite sozinho — autenticado, idempotente, sem custo
  skip: (req) => {
    // Skip para polling de status do Creatomate
    if (req.path.startsWith('/render/') && req.path.endsWith('/status')) {
      return true
    }
    // Remove rate limit para usuário admin
    if (req.user && req.user.email === 'Riccieri68@gmail.com') {
      return true
    }
    return false
  },
})
app.use('/api', globalLimiter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/properties', propertyRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/render', renderRoutes)

app.use(errorHandler)

module.exports = app

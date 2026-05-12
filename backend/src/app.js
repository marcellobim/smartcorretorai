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
const { errorHandler } = require('./middleware/errorHandler')

const app = express()

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Muitas requisições. Tente novamente em 15 minutos.' },
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

const jwt = require('jsonwebtoken')
const instagramService = require('../services/instagramService')
const cache = require('../services/cache')
const { success, error } = require('../utils/response')

async function connectInstagram(req, res, next) {
  try {
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      return error(res, 'Integração com Instagram não configurada ainda. Preencha META_APP_ID e META_APP_SECRET no arquivo .env.', 503)
    }
    const state = jwt.sign(
      { userId: req.user.id, ts: Date.now() },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )
    const url = instagramService.getOAuthUrl(state)
    return success(res, { url })
  } catch (err) {
    next(err)
  }
}

async function instagramCallback(req, res) {
  const { code, state, error: oauthError } = req.query
  const base = process.env.FRONTEND_URL || 'http://localhost:5173'

  if (oauthError || !code || !state) {
    const motivo = oauthError || 'parametros_invalidos'
    return res.redirect(`${base}/configuracoes?instagram=erro&motivo=${encodeURIComponent(motivo)}&tab=redes`)
  }

  try {
    const { userId } = jwt.verify(state, process.env.JWT_SECRET)
    await instagramService.handleCallback(code, userId)
    res.redirect(`${base}/configuracoes?instagram=conectado&tab=redes`)
  } catch (err) {
    console.error('Instagram OAuth callback error:', err.message)
    res.redirect(`${base}/configuracoes?instagram=erro&motivo=${encodeURIComponent(err.message)}&tab=redes`)
  }
}

async function instagramStatus(req, res, next) {
  try {
    const cacheKey = `ig_status:${req.user.id}`
    let statusData = cache.get(cacheKey)

    if (!statusData) {
      const conn = await instagramService.getConnection(req.user.id)
      statusData = {
        conectado: !!conn,
        username: conn?.ig_username || null,
        expira_em: conn?.token_expires_at || null,
      }
      cache.set(cacheKey, statusData, 5 * 60 * 1000) // 5 minutos
    }

    return success(res, statusData)
  } catch (err) {
    next(err)
  }
}

async function postarInstagram(req, res, next) {
  try {
    const { campaign_id, video_url, is_reel, cover_url, share_to_feed } = req.body
    if (!campaign_id) return error(res, 'campaign_id é obrigatório', 400)
    
    const options = {}
    if (video_url) {
      options.videoUrl = video_url
      options.isReel = is_reel !== false // default true para vídeos
      if (cover_url) options.coverUrl = cover_url
      if (share_to_feed !== undefined) options.shareToFeed = share_to_feed
    }
    
    const result = await instagramService.postCampaign(req.user.id, campaign_id, options)
    
    const mediaType = result.type === 'reel' ? 'Reel' : result.type === 'video' ? 'Vídeo' : 'Post'
    return success(res, {
      post_id: result.id,
      type: result.type,
      message: `${mediaType} publicado com sucesso no Instagram!`,
    })
  } catch (err) {
    next(err)
  }
}

async function desconectarInstagram(req, res, next) {
  try {
    await instagramService.disconnect(req.user.id)
    cache.del(`ig_status:${req.user.id}`)
    return success(res, { message: 'Instagram desconectado com sucesso.' })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  connectInstagram,
  instagramCallback,
  instagramStatus,
  postarInstagram,
  desconectarInstagram,
}

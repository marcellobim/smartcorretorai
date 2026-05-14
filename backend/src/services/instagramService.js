const sharp = require('sharp')
const supabase = require('./supabase')

const GRAPH = 'https://graph.facebook.com/v19.0'
const SCOPES = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'

// ── OAuth ────────────────────────────────────────────────────────────────────

function getOAuthUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  })
  return `https://www.facebook.com/dialog/oauth?${p}`
}

async function gfetch(url, opts = {}) {
  const res = await fetch(url, opts)
  const json = await res.json()
  if (json.error) throw new Error(`Meta API: ${json.error.message} (código ${json.error.code})`)
  return json
}

async function exchangeCode(code) {
  return gfetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    redirect_uri: process.env.META_REDIRECT_URI,
    code,
  }))
}

async function getLongLivedToken(shortToken) {
  return gfetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    fb_exchange_token: shortToken,
  }))
}

async function getInstagramAccount(userToken) {
  const pages = await gfetch(`${GRAPH}/me/accounts?access_token=${userToken}`)
  if (!pages.data?.length) {
    throw new Error(
      'Nenhuma Página do Facebook encontrada. Seu Instagram precisa ser uma conta Comercial ou Criador vinculada a uma Página do Facebook.'
    )
  }
  for (const page of pages.data) {
    const igData = await gfetch(`${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`)
    if (igData.instagram_business_account?.id) {
      const igUser = await gfetch(`${GRAPH}/${igData.instagram_business_account.id}?fields=username,name&access_token=${page.access_token}`)
      return {
        igUserId: igData.instagram_business_account.id,
        igUsername: igUser.username || igUser.name,
        pageToken: page.access_token,
        pageId: page.id,
      }
    }
  }
  throw new Error('Nenhuma conta do Instagram Comercial encontrada vinculada às suas Páginas do Facebook.')
}

async function handleCallback(code, userId) {
  const { access_token: shortToken } = await exchangeCode(code)
  const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken)
  const { igUserId, igUsername, pageToken, pageId } = await getInstagramAccount(longToken)

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  await supabase.from('social_connections').upsert({
    user_id: userId,
    platform: 'instagram',
    access_token: longToken,
    page_access_token: pageToken,
    page_id: pageId,
    ig_user_id: igUserId,
    ig_username: igUsername,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,platform' })
}

// ── Consulta / Desconexão ────────────────────────────────────────────────────

async function getConnection(userId) {
  const { data } = await supabase
    .from('social_connections')
    .select('ig_user_id, ig_username, token_expires_at, page_access_token, access_token')
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .single()
  return data
}

async function disconnect(userId) {
  await supabase.from('social_connections')
    .delete()
    .eq('user_id', userId)
    .eq('platform', 'instagram')
}

// ── Geração de banner 1080×1080 com Sharp ───────────────────────────────────

async function gerarBanner({ titulo, bairro, cidade, preco, categoria }) {
  const cores = {
    alto_padrao:   ['#D97706', '#78350F'],
    medio_padrao:  ['#2563EB', '#1E3A8A'],
    popular_mcmv:  ['#059669', '#064E3B'],
    lancamento:    ['#7C3AED', '#4C1D95'],
    em_construcao: ['#EA580C', '#7C2D12'],
  }
  const [c1, c2] = cores[categoria] || ['#6366F1', '#312E81']

  const esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const tit = esc((titulo || 'Imovel a Venda').substring(0, 38))
  const loc = esc([bairro, cidade].filter(Boolean).join(', ').substring(0, 40))
  const pre = preco ? esc('R$ ' + Number(preco).toLocaleString('pt-BR')) : ''

  const svg = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <rect width="1080" height="1080" fill="rgba(0,0,0,0.27)"/>
  <rect x="50" y="50" width="980" height="980" rx="50" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
  <polygon points="540,175 690,320 690,475 390,475 390,320" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.45)" stroke-width="5"/>
  <rect x="476" y="375" width="128" height="100" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
  <text x="540" y="580" font-family="Arial, sans-serif" font-size="54" font-weight="bold" fill="white" text-anchor="middle">${tit}</text>
  ${loc ? `<text x="540" y="658" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.82)" text-anchor="middle">${loc}</text>` : ''}
  ${pre ? `<text x="540" y="758" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle">${pre}</text>` : ''}
  <rect x="230" y="808" width="620" height="3" rx="2" fill="rgba(255,255,255,0.32)"/>
  <text x="540" y="865" font-family="Arial, sans-serif" font-size="28" fill="rgba(255,255,255,0.6)" text-anchor="middle">SmartCorretorAI</text>
</svg>`

  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer()
}

// ── Posting ──────────────────────────────────────────────────────────────────

async function postCampaign(userId, campaignId, options = {}) {
  const conn = await getConnection(userId)
  if (!conn) throw new Error('Sua conta do Instagram não está conectada. Acesse Configurações → Redes Sociais.')

  const { data: camp, error: campErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()

  if (campErr || !camp) throw new Error('Campanha não encontrada.')
  if (camp.status !== 'concluido') throw new Error('Aguarde a campanha ser concluída antes de postar.')

  const igTextos = camp.textos_gerados?.instagram_feed
  if (!igTextos) throw new Error('Textos para Instagram não encontrados nesta campanha.')

  const dadosImovel = camp.dados_imovel || {}
  const token = conn.page_access_token || conn.access_token

  // 3) Caption
  const caption = [igTextos.legenda, igTextos.hashtags, igTextos.cta ? `\n👉 ${igTextos.cta}` : '']
    .filter(Boolean).join('\n\n').substring(0, 2200)

  let container, published

  // Verifica se é para postar vídeo/reel ou imagem
  if (options.videoUrl) {
    // Postagem de Reel/Vídeo
    const mediaType = options.isReel ? 'REELS' : 'VIDEO'
    
    container = await gfetch(`${GRAPH}/${conn.ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({ 
        media_type: mediaType,
        video_url: options.videoUrl, 
        caption, 
        access_token: token,
        ...(options.coverUrl && { cover_url: options.coverUrl }),
        ...(options.shareToFeed !== undefined && { share_to_feed: options.shareToFeed })
      }),
    })

    // Aguarda processamento do vídeo (pode levar alguns segundos)
    let attempts = 0
    const maxAttempts = 30 // 30 tentativas = ~2 minutos
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 4000)) // 4 segundos entre checks
      
      const statusCheck = await gfetch(
        `${GRAPH}/${container.id}?fields=status_code&access_token=${token}`
      )
      
      if (statusCheck.status_code === 'FINISHED') break
      if (statusCheck.status_code === 'ERROR') {
        throw new Error('Erro ao processar vídeo no Instagram')
      }
      attempts++
    }

    if (attempts >= maxAttempts) {
      throw new Error('Timeout ao processar vídeo. Tente novamente em alguns minutos.')
    }

  } else {
    // Postagem de Imagem (comportamento original)
    // 1) Gera banner
    const imgBuffer = await gerarBanner({
      titulo: camp.titulo,
      bairro: dadosImovel.bairro,
      cidade: dadosImovel.cidade,
      preco: dadosImovel.preco,
      categoria: dadosImovel.categoria,
    })

    // 2) Upload para Supabase Storage (bucket deve ser público)
    const storagePath = `instagram/${userId}/${campaignId}.jpg`
    const { error: upErr } = await supabase.storage
      .from(process.env.STORAGE_BUCKET)
      .upload(storagePath, imgBuffer, { contentType: 'image/jpeg', upsert: true })

    if (upErr) throw new Error('Erro ao salvar imagem: ' + upErr.message)

    const { data: { publicUrl } } = supabase.storage
      .from(process.env.STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    // 4) Cria container de mídia
    container = await gfetch(`${GRAPH}/${conn.ig_user_id}/media`, {
      method: 'POST',
      body: new URLSearchParams({ image_url: publicUrl, caption, access_token: token }),
    })
  }

  // 5) Publica
  published = await gfetch(`${GRAPH}/${conn.ig_user_id}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  })

  // 6) Registra post_id na campanha
  await supabase.from('campaigns')
    .update({ instagram_post_id: published.id, updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  return { id: published.id, type: options.videoUrl ? (options.isReel ? 'reel' : 'video') : 'image' }
}

module.exports = { getOAuthUrl, handleCallback, getConnection, disconnect, postCampaign }

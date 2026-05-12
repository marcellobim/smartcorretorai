const supabase = require('./supabase')
const { uploadFotos } = require('../utils/storage')

const API_KEY = process.env.CREATOMATE_API_KEY
const BASE_URL = 'https://api.creatomate.com/v1'

// ── IDs dos templates criados no Creatomate ───────────────────────────────────
const TEMPLATE_IDS = {
  banner_luxo:      process.env.CT_BANNER_LUXO      || '74097a36-5b5d-434a-8db7-4038e4c76f55',
  banner_popular:   process.env.CT_BANNER_POPULAR   || 'a637acac-6a7b-42f8-b7d8-e25361eff207',
  reels_moderno:    process.env.CT_REELS_MODERNO    || 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae',
  story_premium:    process.env.CT_STORY_PREMIUM    || '13008c2d-9e7e-4515-a2ac-649c9ea18409',
  video_cinematico: process.env.CT_VIDEO_CINEMATICO || '13696443-a295-4019-802b-d504e9d3c2ac',
}

// ── Quais templates gerar por categoria ──────────────────────────────────────
const CATEGORIA_TEMPLATES = {
  alto_padrao:   ['banner_luxo',    'story_premium', 'reels_moderno', 'video_cinematico'],
  lancamento:    ['banner_luxo',    'story_premium', 'reels_moderno', 'video_cinematico'],
  medio_padrao:  ['banner_luxo',    'story_premium', 'reels_moderno'],
  popular_mcmv:  ['banner_popular', 'story_premium', 'reels_moderno'],
  em_construcao: ['banner_popular', 'story_premium', 'reels_moderno'],
}

// ── Helpers de formatação ─────────────────────────────────────────────────────
const fmtPreco = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : ''
const fmtDetalhes = (d) => [
  d.quartos   && `${d.quartos} quartos`,
  d.banheiros && `${d.banheiros} banheiros`,
  d.vagas     && `${d.vagas} vagas`,
  d.area      && `${d.area} m²`,
].filter(Boolean).join(' · ')
const fmtLoc = (d) => [d.bairro, d.cidade].filter(Boolean).join(' · ')

// ── Modifications por template (nomes exatos dos elementos no Creatomate) ────
function buildMods(templateKey, dados) {
  const fotos = dados.fotos_urls || []
  const f = (i) => fotos[i] || fotos[0] || ''

  switch (templateKey) {
    case 'banner_luxo':
      return {
        'property_media_01': f(0),
        'property_media_02': f(1),
        'property_media_03': f(2),
        'property_media_04': f(3),
        'property_media_05': f(4),
        'location_text_01':  fmtLoc(dados),
        'details_text_01':   fmtDetalhes(dados),
        'details_text_02':   fmtPreco(dados.preco),
        'contact_email':     dados.contact_email || '',
        'contact_phone':     dados.telefone_contato || '',
        'brand_name':        dados.brand_name || 'SmartCorretorAI',
        'realtor_name':      dados.nome_corretor || '',
        ...(dados.agent_photo && { 'agent_photo': dados.agent_photo }),
      }

    case 'banner_popular': {
      const difs = dados.diferenciais || []
      return {
        'property_media_01': f(0),
        'property_media_02': f(1),
        'property_media_03': f(2),
        'price_text':        fmtPreco(dados.preco),
        'details_text_01':   fmtDetalhes(dados),
        'feature_text_01':   difs[0] || '',
        'feature_text_02':   difs[1] || '',
        'feature_text_03':   difs[2] || fmtLoc(dados),
      }
    }

    case 'story_premium':
      return {
        'property_media_01': f(0),
        'property_media_02': f(1),
        'property_media_03': f(2),
        'property_media_04': f(3),
        'headline_01':       dados.titulo || '',
        'price_text':        fmtPreco(dados.preco),
        'details_text_01':   fmtDetalhes(dados),
        'location_text_01':  fmtLoc(dados),
        'cta_text':          dados.telefone_contato
          ? `Fale comigo: ${dados.telefone_contato}`
          : 'Agende sua visita',
      }

    case 'reels_moderno':
      return {
        'property_media_01': f(0),
        'property_media_02': f(1),
        'property_media_03': f(2),
        'headline_01':       dados.titulo || '',
        'location_text_01':  fmtLoc(dados),
      }

    case 'video_cinematico':
      return {
        'property_media_01': f(0),
        'property_media_02': f(1),
        'property_media_03': f(2),
        'property_media_04': f(3),
        'location_text_01':  fmtLoc(dados),
        'badge_text':        (dados.categoria || '').replace(/_/g, ' ').toUpperCase(),
        'headline_01':       dados.titulo || '',
        'contact_email':     dados.contact_email || '',
        'contact_phone':     dados.telefone_contato || '',
        'brand_name':        dados.brand_name || 'SmartCorretorAI',
        'realtor_name':      dados.nome_corretor || '',
        ...(dados.agent_photo && { 'agent_photo': dados.agent_photo }),
      }

    default:
      return {}
  }
}

// ── Dispara um render no Creatomate ──────────────────────────────────────────
async function dispatchRender(templateKey, dados) {
  const templateId = TEMPLATE_IDS[templateKey]
  if (!templateId) throw new Error(`Template não mapeado: ${templateKey}`)

  const body = { template_id: templateId, modifications: buildMods(templateKey, dados) }

  const res = await fetch(`${BASE_URL}/renders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Creatomate ${res.status}: ${msg}`)
  }

  const renders = await res.json()
  const render = Array.isArray(renders) ? renders[0] : renders
  return { renderId: render.id, status: render.status, url: render.url || null }
}

// ── Polling de um render até concluir ────────────────────────────────────────
async function pollRender(renderId, maxMs = 300_000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`${BASE_URL}/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })
    if (!res.ok) continue
    const data = await res.json()
    if (data.status === 'succeeded') return { status: 'succeeded', url: data.url, snapshot_url: data.snapshot_url }
    if (data.status === 'failed') throw new Error(`Render falhou: ${data.error_message || 'motivo desconhecido'}`)
  }
  throw new Error(`Render ${renderId} timeout após ${maxMs / 1000}s`)
}

// ── Gera pacote completo: upload fotos → dispatch → poll → salva no DB ───────
async function gerarPacoteCreatomate(campanha, fotosBase64 = []) {
  const categoria = campanha.dados_imovel?.categoria || 'medio_padrao'
  const templates = CATEGORIA_TEMPLATES[categoria] || CATEGORIA_TEMPLATES.medio_padrao

  // Upload fotos se ainda não temos URLs públicas
  let fotosUrls = campanha.dados_imovel?.fotos_urls || []
  if (!fotosUrls.length && fotosBase64.length) {
    fotosUrls = await uploadFotos(fotosBase64, campanha.id)
  }

  const dados = { ...campanha.dados_imovel, titulo: campanha.titulo, fotos_urls: fotosUrls }

  // Despacha todos os renders em paralelo
  const dispatched = {}
  await Promise.allSettled(
    templates.map(async (tKey) => {
      try {
        const job = await dispatchRender(tKey, dados)
        dispatched[tKey] = { ...job, templateKey: tKey }
      } catch (err) {
        dispatched[tKey] = { status: 'failed', error: err.message, templateKey: tKey }
      }
    })
  )

  // Salva estado inicial no DB imediatamente (renders em andamento)
  await _saveRenders(campanha.id, dispatched)

  // Poll em background — atualiza DB quando cada render conclui
  _pollAndSave(campanha.id, dispatched)

  return dispatched
}

// ── Poll em background e salva URLs finais no DB ─────────────────────────────
async function _pollAndSave(campanhaId, dispatched) {
  const updates = { ...dispatched }

  await Promise.allSettled(
    Object.entries(dispatched).map(async ([key, job]) => {
      if (job.status === 'succeeded' || job.status === 'failed' || !job.renderId) return
      try {
        const result = await pollRender(job.renderId)
        updates[key] = { ...job, ...result }
      } catch (err) {
        updates[key] = { ...job, status: 'failed', error: err.message }
      }
    })
  )

  await _saveRenders(campanhaId, updates)
}

async function _saveRenders(campanhaId, renders) {
  const { data: camp } = await supabase
    .from('campaigns')
    .select('textos_gerados')
    .eq('id', campanhaId)
    .single()

  await supabase.from('campaigns').update({
    textos_gerados: { ...(camp?.textos_gerados || {}), _renders: renders },
    updated_at: new Date().toISOString(),
  }).eq('id', campanhaId)
}

module.exports = { gerarPacoteCreatomate, CATEGORIA_TEMPLATES, TEMPLATE_IDS }

const supabase = require('./supabase')
const { uploadFotos } = require('../utils/storage')

const API_KEY = process.env.CREATOMATE_API_KEY
const BASE_URL = 'https://api.creatomate.com/v1'

// ── IDs dos templates do projeto (mapeados via GET /v1/templates) ─────────────
const TEMPLATE_IDS = {

  // ── SC_ Templates customizados — todos 720×1280 (9:16) ──────────────────
  sc_banner_luxo:       process.env.CT_BANNER_LUXO       || '74097a36-5b5d-434a-8db7-4038e4c76f55', // imagem
  sc_banner_popular:    process.env.CT_BANNER_POPULAR    || 'a637acac-6a7b-42f8-b7d8-e25361eff207', // imagem
  sc_reels_moderno:     process.env.CT_REELS_MODERNO     || 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae', // vídeo 7s
  sc_story_premium:     process.env.CT_STORY_PREMIUM     || '13008c2d-9e7e-4515-a2ac-649c9ea18409', // vídeo 13s
  sc_video_cinematico:  process.env.CT_VIDEO_CINEMATICO  || '13696443-a295-4019-802b-d504e9d3c2ac', // vídeo 19s

  // ── New Listing Story — 720×1280 (9:16) vídeo 13s ───────────────────────
  new_listing_story:    'ad9f8382-ea38-4ef6-84cc-049f1b289345',

  // ── Searchlight Reveal — vídeo 14s (efeito holofote dramático) ───────────
  searchlight_9_16:     '40e3c891-05a1-4615-b9ac-48c1c0a83778', // 720×1280
  searchlight_1_1:      '600f3e25-1e36-48a2-ace4-abeabbbfc4c9', // 1080×1080
  searchlight_4_5:      'a03e7b27-0747-497c-ae84-5b048fa31915', // 720×900
  searchlight_16_9:     '02a43447-9b52-4171-89f4-88f8b6fda0bd', // 1280×720

  // ── Photo Montage — vídeo 12s (galeria de fotos) ─────────────────────────
  photo_montage_9_16:   '7fc36174-64a6-4dbb-bb92-bb957471577e', // 720×1280
  photo_montage_1_1:    '7ab2fc77-61fb-4fed-8e0f-4241e95ee614', // 1080×1080
  photo_montage_4_5:    '8e399960-3ade-453a-b868-e7059f30c6a9', // 720×900
  photo_montage_16_9:   'd3373d35-fbd0-4579-81c9-2cc63baa9565', // 1280×720

  // ── Triple Slide Carousel — vídeo 13s (3 fotos + texto) ──────────────────
  triple_carousel_9_16: '5635ee72-d0da-4906-9a84-6e0b5f587196', // 720×1280
  triple_carousel_1_1:  'a804a0e5-c840-4dec-a64b-2d9d232d1368', // 1080×1080
  triple_carousel_4_5:  '96a25196-5a64-4f65-9b3e-c9c8b0d871f2', // 720×900
  triple_carousel_16_9: '0f07bc4d-f494-4b4b-9d84-085dfd30fec1', // 1280×720

  // ── Real Estate Card — vídeo 9s (card animado) ────────────────────────────
  real_estate_card_9_16: 'eec45c26-f11c-4f4b-998f-cf3b55ba4f35', // 720×1280
  real_estate_card_1_1:  'd9c05f91-a600-48d0-b7d4-8d0dcac62e0b', // 1080×1080
  real_estate_card_4_5:  '2b4e6dff-ee96-42f0-97e1-7956bef9dfa9', // 720×900
  real_estate_card_16_9: '622d9606-accd-4d14-af92-e3ccb8a3b5e0', // 1280×720
}

// Aliases para manter compatibilidade com env vars legadas
const ALIAS = {
  banner_luxo:      'sc_banner_luxo',
  banner_popular:   'sc_banner_popular',
  reels_moderno:    'sc_reels_moderno',
  story_premium:    'sc_story_premium',
  video_cinematico: 'sc_video_cinematico',
}

// ── Quais templates gerar por categoria ──────────────────────────────────────
//
// Critério de seleção por categoria:
//
// alto_padrao / lancamento  → templates sofisticados + máxima cobertura de formato
// medio_padrao              → templates premium + formatos essenciais
// popular_mcmv              → templates acessíveis + foco em stories e feed
// em_construcao             → templates práticos + galeria de fotos
//
const CATEGORIA_TEMPLATES = {
  alto_padrao: [
    'sc_banner_luxo',         // 9:16 imagem (stories/reels visual rico)
    'sc_story_premium',       // 9:16 vídeo (story animado completo)
    'sc_video_cinematico',    // 9:16 vídeo (vídeo longo cinematográfico)
    'sc_reels_moderno',       // 9:16 vídeo (reels dinâmico)
    'searchlight_1_1',        // 1:1  vídeo (feed quadrado dramático)
    'searchlight_16_9',       // 16:9 vídeo (YouTube / LinkedIn)
  ],
  lancamento: [
    'sc_banner_luxo',         // 9:16 imagem
    'sc_story_premium',       // 9:16 vídeo
    'sc_video_cinematico',    // 9:16 vídeo
    'sc_reels_moderno',       // 9:16 vídeo
    'new_listing_story',      // 9:16 vídeo (dados estruturados da listagem)
    'triple_carousel_1_1',    // 1:1  vídeo (3 diferenciais em destaque)
  ],
  medio_padrao: [
    'sc_banner_luxo',         // 9:16 imagem
    'sc_story_premium',       // 9:16 vídeo
    'sc_reels_moderno',       // 9:16 vídeo
    'new_listing_story',      // 9:16 vídeo
    'real_estate_card_1_1',   // 1:1  vídeo (card feed quadrado)
    'photo_montage_1_1',      // 1:1  vídeo (galeria feed quadrado)
  ],
  popular_mcmv: [
    'sc_banner_popular',      // 9:16 imagem
    'sc_story_premium',       // 9:16 vídeo
    'sc_reels_moderno',       // 9:16 vídeo
    'photo_montage_9_16',     // 9:16 vídeo (galeria stories)
    'real_estate_card_1_1',   // 1:1  vídeo (feed quadrado)
  ],
  em_construcao: [
    'sc_banner_popular',      // 9:16 imagem
    'sc_story_premium',       // 9:16 vídeo
    'new_listing_story',      // 9:16 vídeo (progresso da obra)
    'photo_montage_4_5',      // 4:5  vídeo (galeria feed retrato)
    'triple_carousel_1_1',    // 1:1  vídeo (3 fases/diferenciais)
  ],
}

// ── Helpers de formatação ─────────────────────────────────────────────────────
const fmtPreco    = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : ''
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

  // ── SC_ Templates customizados ───────────────────────────────────────────
  if (templateKey === 'sc_banner_luxo') {
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
  }

  if (templateKey === 'sc_banner_popular') {
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

  if (templateKey === 'sc_story_premium') {
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
  }

  if (templateKey === 'sc_reels_moderno') {
    return {
      'property_media_01': f(0),
      'property_media_02': f(1),
      'property_media_03': f(2),
      'headline_01':       dados.titulo || '',
      'location_text_01':  fmtLoc(dados),
    }
  }

  if (templateKey === 'sc_video_cinematico') {
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
  }

  // ── New Listing Story ─────────────────────────────────────────────────────
  // Elementos: Price, Details, Address, Photos, Title
  if (templateKey === 'new_listing_story') {
    return {
      'Photos':   f(0),
      'Title':    dados.titulo || '',
      'Price':    fmtPreco(dados.preco),
      'Details':  fmtDetalhes(dados),
      'Address':  fmtLoc(dados),
    }
  }

  // ── Searchlight Reveal ────────────────────────────────────────────────────
  // Elementos: Photo, Text-1, Text-2, Brand, Dark-Background, Searchlight-Mask
  if (templateKey.startsWith('searchlight_')) {
    return {
      'Photo':   f(0),
      'Text-1':  dados.titulo || fmtLoc(dados),
      'Text-2':  fmtPreco(dados.preco) || fmtDetalhes(dados),
      'Brand':   dados.brand_name || 'SmartCorretorAI',
    }
  }

  // ── Photo Montage ─────────────────────────────────────────────────────────
  // Elementos: Image-1, Image-2, Image-3, Image-4, Ending, Overlay
  if (templateKey.startsWith('photo_montage_')) {
    return {
      'Image-1': f(0),
      'Image-2': f(1),
      'Image-3': f(2),
      'Image-4': f(3),
    }
  }

  // ── Triple Slide Carousel ─────────────────────────────────────────────────
  // Elementos: Image-1, Image-2, Image-3, Bottom, Outro
  if (templateKey.startsWith('triple_carousel_')) {
    const difs = dados.diferenciais || []
    return {
      'Image-1': f(0),
      'Image-2': f(1),
      'Image-3': f(2),
    }
  }

  // ── Real Estate Card ──────────────────────────────────────────────────────
  // Elementos: Photo
  if (templateKey.startsWith('real_estate_card_')) {
    return {
      'Photo': f(0),
    }
  }

  return {}
}

// ── Dispara um render no Creatomate ──────────────────────────────────────────
async function dispatchRender(templateKey, dados) {
  const resolvedKey = ALIAS[templateKey] || templateKey
  const templateId  = TEMPLATE_IDS[resolvedKey]
  if (!templateId) throw new Error(`Template não mapeado: ${templateKey}`)

  const mods = buildMods(resolvedKey, dados)
  const body = { template_id: templateId, modifications: mods }

  const res = await fetch(`${BASE_URL}/renders`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Creatomate ${res.status}: ${msg}`)
  }

  const renders = await res.json()
  const render  = Array.isArray(renders) ? renders[0] : renders
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
    if (data.status === 'failed')    throw new Error(`Render falhou: ${data.error_message || 'motivo desconhecido'}`)
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

  // Salva estado inicial no DB imediatamente
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
    updated_at:     new Date().toISOString(),
  }).eq('id', campanhaId)
}

module.exports = { gerarPacoteCreatomate, CATEGORIA_TEMPLATES, TEMPLATE_IDS }

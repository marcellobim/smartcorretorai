const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SCORE_LABELS = [[90, 'Excelente'], [80, 'Muito bom'], [70, 'Bom'], [60, 'Pode melhorar'], [0, 'Precisa de atenção']]
const SECTION_WEIGHTS = {
  PROPERTY_LISTING: { title: 0.20, description: 0.30, information: 0.25, persuasion: 0.25 },
  SOCIAL_PUBLICATION: { hook: 0.20, clarity: 0.20, visual_communication: 0.20, cta: 0.20, conversion: 0.20 },
}
const OPPORTUNITY_PRODUCTS = {
  virtual_staging: ['Mostre o potencial deste ambiente', 'Conhecer Smart Space', '/virtual-staging'],
  life_in_property: ['Dê vida às suas melhores imagens', 'Conhecer Vida no Imóvel', '/virtual-staging'],
  broker_presentation: ['Apresente você mesmo este imóvel', 'Conhecer Apresentação pelo Corretor', '/virtual-staging'],
  real_estate_video: ['Transforme suas fotos em uma apresentação completa', 'Criar Vídeo Imobiliário', '/smart-tour-ai'],
  smart_carousel: ['Organize suas melhores imagens em sequência', 'Criar Smart Carrossel', '/smart-carrossel'],
  commercial_real_estate: ['Crie um comercial para este imóvel', 'Criar Comercial Imobiliário', '/studio-hero'],
  quick_banners: ['Leve a oferta para as redes sociais', 'Criar Banners Rápidos', '/nova-campanha'],
  real_estate_banner: ['Organize os diferenciais em uma peça completa', 'Criar Banner Imobiliário', '/hero'],
  text_campaign: ['Use essas informações em outros canais', 'Criar Campanha de Textos', '/campanha-de-textos'],
}
const PUBLIC_FIELD_ENUMS = {
  purpose: { rent: 'Aluguel', rental: 'Aluguel', aluguel: 'Aluguel', locacao: 'Aluguel', sale: 'Venda', venda: 'Venda' },
  propertyType: { apartment: 'Apartamento', apartamento: 'Apartamento', house: 'Casa', casa: 'Casa', studio: 'Studio', kitnet: 'Kitnet' },
  stage: { launch: 'Lançamento', lancamento: 'Lançamento', ready: 'Pronto', pronto: 'Pronto', construction: 'Em construção' },
}

export function listingXrayPublicFieldValue(key, value) {
  if (Array.isArray(value)) return value.join(', ')
  const raw = String(value ?? '').trim(); const normalized = raw.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return PUBLIC_FIELD_ENUMS[key]?.[normalized] || raw
}

export const listingXrayScoreLabel = score => SCORE_LABELS.find(([minimum]) => Number(score) >= minimum)?.[1] || 'Precisa de atenção'
const ATTRACTION_LABELS = [[90, 'Muito forte'], [80, 'Forte'], [70, 'Bom potencial'], [60, 'Há oportunidades'], [0, 'Pode ser melhor explorado']]
export const attractionPotentialScoreLabel = score => ATTRACTION_LABELS.find(([minimum]) => Number(score) >= minimum)?.[1] || 'Pode ser melhor explorado'

export function normalizeListingXraySectionScore(section) {
  if (!section || typeof section !== 'object' || section.score === null) return section
  const components = section.components && typeof section.components === 'object' ? Object.values(section.components).map(Number) : []
  const legacyFivePointScale = components.length > 0 && components.every(value => Number.isFinite(value) && value >= 0 && value <= 5)
  const score = legacyFivePointScale
    ? Math.round((components.reduce((sum, value) => sum + value, 0) / (components.length * 5)) * 100)
    : Math.max(0, Math.min(100, Math.round(Number(section.score) || 0)))
  return {
    ...section, score, label: listingXrayScoreLabel(score),
    what_works: section.what_works || section.analysis,
    what_can_improve: section.what_can_improve ?? section.suggestion ?? null,
    how_to_improve: section.how_to_improve ?? section.suggestion ?? null,
  }
}

function normalizeOpportunities(result) {
  const source = Array.isArray(result.opportunities) ? result.opportunities : []
  const unique = new Set()
  return source.filter(item => {
    if (!item || !OPPORTUNITY_PRODUCTS[item.product_id] || !['normalized_fact', 'confirmed_text', 'listing_metadata', 'model_visual_observation', 'derived_safe_signal'].includes(item.evidence_source) || unique.has(item.product_id)) return false
    if (![item.title, item.reason, item.benefit, item.evidence, item.cta_label, item.route].every(value => typeof value === 'string' && value.trim())) return false
    if (!item.route.startsWith('/') || item.route.startsWith('//')) return false
    unique.add(item.product_id); return true
  }).slice(0, 5)
}

function inferLegacyDescriptionCompleteness(result) {
  if (result.description_completeness) return result.description_completeness
  const description = result.fields?.description
  const value = description?.state === 'CONFIRMED' ? String(description.value || '').trim() : ''
  if (!value) return { state: 'NOT_FOUND', evidence: null }
  if (!/[.!?…]$/.test(value)) return { state: 'PARTIAL', evidence: 'O trecho visível termina antes da conclusão da frase.' }
  return { state: 'COMPLETE', evidence: null }
}

function normalizePublicScores(result) {
  const sections = Object.fromEntries(Object.entries(result.sections).map(([key, section]) => [key, normalizeListingXraySectionScore(section)]))
  const weights = SECTION_WEIGHTS[result.content_type]
  const evaluated = Object.entries(weights).filter(([key]) => sections[key]?.score !== null)
  const weightTotal = evaluated.reduce((sum, [, weight]) => sum + weight, 0)
  const overall = weightTotal ? Math.round(evaluated.reduce((sum, [key, weight]) => sum + Number(sections[key].score) * weight, 0) / weightTotal) : null
  const attraction = result.content_type === 'PROPERTY_LISTING' && result.attraction ? normalizeListingXraySectionScore(result.attraction) : null
  const attractionScore = attraction?.score ?? (Number.isFinite(Number(result.attraction_potential_score)) ? Math.max(0, Math.min(100, Math.round(Number(result.attraction_potential_score)))) : null)
  return {
    ...result,
    sections,
    overall_score: overall,
    overall_label: overall === null ? null : listingXrayScoreLabel(overall),
    ...(result.content_type === 'PROPERTY_LISTING' ? {
      listing_quality_score: overall, listing_quality_label: overall === null ? null : listingXrayScoreLabel(overall),
      attraction, attraction_potential_score: attractionScore, attraction_potential_label: attractionScore === null ? null : attractionPotentialScoreLabel(attractionScore),
      description_completeness: inferLegacyDescriptionCompleteness(result), opportunities: normalizeOpportunities(result),
    } : {}),
  }
}

export function listingXrayStorageKey(userId) {
  return `smartcorretorai:listing-xray:${String(userId || 'anonymous')}:active-request`
}

export function readListingXrayRecovery(storage, userId) {
  try {
    const value = storage?.getItem?.(listingXrayStorageKey(userId))
    if (!value) return null
    const parsed = JSON.parse(value)
    return UUID.test(parsed?.clientRequestId || '') ? parsed : null
  } catch { return null }
}

export function writeListingXrayRecovery(storage, userId, clientRequestId, status = 'processing') {
  if (!userId || !UUID.test(clientRequestId)) return false
  try {
    storage?.setItem?.(listingXrayStorageKey(userId), JSON.stringify({ userId, clientRequestId, status, updatedAt: Date.now() }))
    return true
  } catch { return false }
}

export function clearListingXrayRecovery(storage, userId) {
  try { storage?.removeItem?.(listingXrayStorageKey(userId)) } catch { /* optional storage */ }
}

export function normalizeListingXrayResult(value) {
  if (!value || typeof value !== 'object' || value.status !== 'completed') throw new Error('listing_xray_result_invalid')
  if (!['PROPERTY_LISTING', 'SOCIAL_PUBLICATION'].includes(value.content_type) || !value.sections || !Array.isArray(value.priorities) || !Array.isArray(value.recommendations)) throw new Error('listing_xray_result_invalid')
  const required = value.content_type === 'PROPERTY_LISTING'
    ? ['title', 'description', 'information', 'persuasion']
    : ['hook', 'clarity', 'visual_communication', 'cta', 'conversion']
  for (const key of required) if (!value.sections[key]) throw new Error('listing_xray_result_invalid')
  if ('campaign' in value) throw new Error('listing_xray_result_invalid')
  return normalizePublicScores(value)
}

export async function copyListingXrayText(value, { navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
  const text = String(value || '').trim()
  if (!text) throw new Error('copy_empty')
  if (navigatorRef?.clipboard?.writeText) { await navigatorRef.clipboard.writeText(text); return 'clipboard' }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') throw new Error('clipboard_unavailable')
  const textarea = documentRef.createElement('textarea')
  textarea.value = text; textarea.setAttribute('readonly', ''); textarea.style.position = 'fixed'; textarea.style.opacity = '0'
  documentRef.body.appendChild(textarea); textarea.select()
  const copied = documentRef.execCommand('copy'); textarea.remove()
  if (!copied) throw new Error('clipboard_failed')
  return 'fallback'
}

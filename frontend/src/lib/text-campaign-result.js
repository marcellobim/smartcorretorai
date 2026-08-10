export const TEXT_CAMPAIGN_RESULT_GROUPS = Object.freeze([
  { id: 'listing', title: 'Anúncio', pieces: ['listing_title', 'portal_description', 'short_listing'] },
  { id: 'instagram', title: 'Instagram', pieces: ['instagram_commercial', 'instagram_emotional', 'instagram_opportunity'] },
  { id: 'facebook', title: 'Facebook', pieces: ['facebook_commercial', 'facebook_emotional', 'facebook_opportunity'] },
  { id: 'whatsapp', title: 'WhatsApp', pieces: ['whatsapp_individual', 'whatsapp_list', 'whatsapp_short'] },
  { id: 'professional', title: 'E-mail e LinkedIn', pieces: ['email', 'linkedin'] },
  { id: 'extra', title: 'Conteúdo extra', pieces: ['cta', 'hashtags', 'reels_script', 'text_carousel'] },
])

export const TEXT_CAMPAIGN_RESULT_LABELS = Object.freeze({
  listing_title: 'Título do anúncio', portal_description: 'Descrição para portal', short_listing: 'Anúncio curto',
  instagram_commercial: 'Instagram — comercial', instagram_emotional: 'Instagram — emocional', instagram_opportunity: 'Instagram — curiosidade/oportunidade',
  facebook_commercial: 'Facebook — comercial', facebook_emotional: 'Facebook — emocional', facebook_opportunity: 'Facebook — curiosidade/oportunidade',
  linkedin: 'LinkedIn', whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp carteira/lista', whatsapp_short: 'WhatsApp curto',
  email: 'E-mail', cta: 'CTA', hashtags: 'Hashtags estratégicas', reels_script: 'Roteiro para Reels', text_carousel: 'Carrossel textual — 5 slides',
})

export function isCompleteTextCampaignResult(campaign) {
  if (!campaign || typeof campaign !== 'object') return false
  const ids = TEXT_CAMPAIGN_RESULT_GROUPS.flatMap(group => group.pieces)
  if (ids.length !== 18 || ids.some(id => !(id in campaign))) return false
  return Array.isArray(campaign.hashtags)
    && campaign.hashtags.length >= 12
    && campaign.hashtags.length <= 15
    && Array.isArray(campaign.text_carousel?.slides)
    && campaign.text_carousel.slides.length === 5
}

export function formatTextCampaignPiece(campaign, id) {
  const value = campaign?.[id]
  if (id === 'email') return `Assunto: ${value?.subject || ''}\n\n${value?.body || ''}`.trim()
  if (id === 'linkedin') return value?.applicable ? String(value.text || '') : `Não aplicável: ${value?.reason || 'contexto não adequado.'}`
  if (id === 'hashtags') return Array.isArray(value) ? value.join(' ') : ''
  if (id === 'text_carousel') return (value?.slides || []).map((slide, index) => `Slide ${index + 1} — ${slide.title}\n${slide.text}`).join('\n\n')
  return String(value || '')
}

export function formatCompleteTextCampaign(campaign) {
  return TEXT_CAMPAIGN_RESULT_GROUPS
    .flatMap(group => group.pieces)
    .filter(id => id !== 'linkedin' || campaign?.linkedin?.applicable)
    .map(id => `${TEXT_CAMPAIGN_RESULT_LABELS[id].toUpperCase()}\n${formatTextCampaignPiece(campaign, id)}`)
    .join('\n\n────────────────────\n\n')
}

export async function copyTextCampaignValue(value, { navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
  if (navigatorRef?.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(value)
    return 'clipboard'
  }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') throw new Error('clipboard_unavailable')
  const textarea = documentRef.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  documentRef.body.appendChild(textarea)
  textarea.select()
  const copied = documentRef.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('clipboard_failed')
  return 'fallback'
}

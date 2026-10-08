export const TEXT_CAMPAIGN_RESULT_GROUPS = Object.freeze([
  { id: 'listing', title: 'Anúncio', pieces: ['listing_title', 'portal_description', 'short_listing'] },
  { id: 'instagram', title: 'Instagram', pieces: ['instagram_commercial', 'instagram_emotional', 'instagram_opportunity'] },
  { id: 'facebook', title: 'Facebook', pieces: ['facebook_commercial', 'facebook_emotional', 'facebook_opportunity'] },
  { id: 'whatsapp', title: 'WhatsApp', pieces: ['whatsapp_individual', 'whatsapp_list', 'whatsapp_short'] },
  { id: 'professional', title: 'E-mail e LinkedIn', pieces: ['email', 'linkedin'] },
  { id: 'extra', title: 'Conteúdo extra', pieces: ['cta', 'hashtags', 'reels_script', 'text_carousel'] },
  { id: 'google-ads', title: 'Google Ads', pieces: ['google_ads'] },
])

export const TEXT_CAMPAIGN_RESULT_LABELS = Object.freeze({
  listing_title: 'Título do anúncio', portal_description: 'Descrição para portal', short_listing: 'Anúncio curto',
  instagram_commercial: 'Instagram — comercial', instagram_emotional: 'Instagram — emocional', instagram_opportunity: 'Instagram — curiosidade/oportunidade',
  facebook_commercial: 'Facebook — comercial', facebook_emotional: 'Facebook — emocional', facebook_opportunity: 'Facebook — curiosidade/oportunidade',
  linkedin: 'LinkedIn', whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp carteira/lista', whatsapp_short: 'WhatsApp curto',
  email: 'E-mail', cta: 'CTA', hashtags: 'Hashtags estratégicas', reels_script: 'Roteiro para Reels', text_carousel: 'Carrossel textual — 5 slides', google_ads: 'Google Ads',
})

export function isCompleteTextCampaignResult(campaign) {
  if (!campaign || typeof campaign !== 'object') return false
  const ids = TEXT_CAMPAIGN_RESULT_GROUPS.flatMap(group => group.pieces)
  if (ids.length !== 19 || ids.some(id => !(id in campaign))) return false
  return Array.isArray(campaign.hashtags)
    && campaign.hashtags.length >= 12
    && campaign.hashtags.length <= 15
    && Array.isArray(campaign.text_carousel?.slides)
    && campaign.text_carousel.slides.length === 5
    && Array.isArray(campaign.google_ads?.headlines)
    && campaign.google_ads.headlines.length >= 2
    && campaign.google_ads.headlines.length <= 6
    && campaign.google_ads.headlines.every(value => typeof value === 'string' && value.length > 0 && value.length <= 30)
    && typeof campaign.google_ads.long_headline === 'string'
    && campaign.google_ads.long_headline.length > 0
    && campaign.google_ads.long_headline.length <= 90
    && Array.isArray(campaign.google_ads.descriptions)
    && campaign.google_ads.descriptions.length >= 2
    && campaign.google_ads.descriptions.length <= 4
    && campaign.google_ads.descriptions.every(value => typeof value === 'string' && value.length > 0 && value.length <= 90)
    && typeof campaign.google_ads.cta === 'string'
    && campaign.google_ads.cta.length > 0
    && campaign.google_ads.cta.length <= 30
    && Array.isArray(campaign.google_ads.suggested_keywords)
    && campaign.google_ads.suggested_keywords.length >= 3
    && campaign.google_ads.suggested_keywords.length <= 8
    && campaign.google_ads.suggested_keywords.every(value => typeof value === 'string' && value.length > 0 && value.length <= 80)
}

const resultCopy = locale => locale === 'en-US'
  ? {
      subject: 'Subject', notApplicable: 'Not applicable', contextNotSuitable: 'context is not suitable.', slide: 'Slide',
      headlines: 'Headlines', longHeadline: 'Long headline', descriptions: 'Descriptions', suggestedCta: 'Suggested CTA', suggestedKeywords: 'Suggested keywords',
    }
  : {
      subject: 'Assunto', notApplicable: 'Não aplicável', contextNotSuitable: 'contexto não adequado.', slide: 'Slide',
      headlines: 'Títulos', longHeadline: 'Título longo', descriptions: 'Descrições', suggestedCta: 'CTA sugerido', suggestedKeywords: 'Palavras-chave sugeridas',
    }

export function formatTextCampaignPiece(campaign, id, locale = 'pt-BR') {
  const copy = resultCopy(locale)
  const value = campaign?.[id]
  if (id === 'email') return `${copy.subject}: ${value?.subject || ''}\n\n${value?.body || ''}`.trim()
  if (id === 'linkedin') return value?.applicable ? String(value.text || '') : `${copy.notApplicable}: ${value?.reason || copy.contextNotSuitable}`
  if (id === 'hashtags') return Array.isArray(value) ? value.join(' ') : ''
  if (id === 'text_carousel') return (value?.slides || []).map((slide, index) => `${copy.slide} ${index + 1} — ${slide.title}\n${slide.text}`).join('\n\n')
  if (id === 'google_ads') return [
    `${copy.headlines}:\n${(value?.headlines || []).map(item => `- ${item}`).join('\n')}`,
    `${copy.longHeadline}:\n${value?.long_headline || ''}`,
    `${copy.descriptions}:\n${(value?.descriptions || []).map(item => `- ${item}`).join('\n')}`,
    `${copy.suggestedCta}:\n${value?.cta || ''}`,
    `${copy.suggestedKeywords}:\n${(value?.suggested_keywords || []).map(item => `- ${item}`).join('\n')}`,
  ].join('\n\n')
  return String(value || '')
}

export function formatCompleteTextCampaign(campaign, locale = 'pt-BR') {
  return TEXT_CAMPAIGN_RESULT_GROUPS
    .flatMap(group => group.pieces)
    .filter(id => id !== 'linkedin' || campaign?.linkedin?.applicable)
    .map(id => `${textCampaignResultLabel(id, locale).toUpperCase()}\n${formatTextCampaignPiece(campaign, id, locale)}`)
    .join('\n\n────────────────────\n\n')
}

export function textCampaignResultLabel(id, locale = 'pt-BR') {
  if (locale !== 'en-US') return TEXT_CAMPAIGN_RESULT_LABELS[id]
  return ({ listing_title: 'Listing title', portal_description: 'Portal description', short_listing: 'Short listing', instagram_commercial: 'Instagram — commercial', instagram_emotional: 'Instagram — emotional', instagram_opportunity: 'Instagram — opportunity', facebook_commercial: 'Facebook — commercial', facebook_emotional: 'Facebook — emotional', facebook_opportunity: 'Facebook — opportunity', linkedin: 'LinkedIn', whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp list', whatsapp_short: 'Short WhatsApp', email: 'Email', cta: 'CTA', hashtags: 'Strategic hashtags', reels_script: 'Reels script', text_carousel: 'Text carousel — 5 slides', google_ads: 'Google Ads' })[id] || id
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

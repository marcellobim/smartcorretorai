import { formatBrazilianPhone } from '../../../../supabase/functions/_shared/product3-contract.ts'
import { validateGoogleAdsDelivery } from '../../../../supabase/functions/_shared/google-ads.ts'

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const compact = (values) => values.map(clean).filter(Boolean)

const sentence = (value) => {
  const text = clean(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
}

const lowerFirst = (value) => {
  const text = clean(value)
  return text ? `${text.charAt(0).toLocaleLowerCase('pt-BR')}${text.slice(1)}` : ''
}

const joinNatural = (values) => {
  const items = compact(values)
  if (items.length < 2) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`
}

const locationText = ({ district, city, state }) => {
  const cityState = compact([city, state]).join(' - ')
  return compact([district, cityState]).join(', ')
}

const purposeText = (purpose) => {
  const normalized = clean(purpose).toLocaleLowerCase('pt-BR')
  if (normalized === 'rental') return 'para locação'
  if (['sale', 'venda', 'vender'].includes(normalized)) return 'à venda'
  if (['rent', 'locação', 'locacao', 'aluguel', 'alugar'].includes(normalized)) return 'para locação'
  return ''
}

const factsText = ({ bedrooms, suites, parkingSpaces, area }) => {
  const plural = (value, singular, pluralLabel) => value
    ? `${value} ${String(value) === '1' ? singular : pluralLabel}`
    : ''

  return joinNatural([
    plural(bedrooms, 'dormitório', 'dormitórios'),
    plural(suites, 'suíte', 'suítes'),
    plural(parkingSpaces, 'vaga', 'vagas'),
    area ? `${area} m²` : '',
  ])
}

const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu
const REJECTED_DISCOVERY_HASHTAGS = new Set(['#fgts', '#vidasegura', '#novoscapitulos'])

const extractHashtags = (value) => String(value ?? '').match(HASHTAG_PATTERN) || []

const withoutHashtags = (value) => String(value ?? '')
  .replace(HASHTAG_PATTERN, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const normalizeHashtagBlock = (values) => {
  const hashtags = [...new Map(values
    .flatMap(extractHashtags)
    .filter((hashtag) => !REJECTED_DISCOVERY_HASHTAGS.has(hashtag.toLocaleLowerCase('pt-BR')))
    .map((hashtag) => [hashtag.toLocaleLowerCase('pt-BR'), hashtag])).values()]
  let brandIndex = hashtags.findIndex((hashtag) => hashtag.toLocaleLowerCase('pt-BR') === '#smartcorretorai')
  const brand = brandIndex >= 0 ? hashtags.splice(brandIndex, 1)[0] : '#SmartCorretorAI'
  const limited = hashtags.slice(0, 14)
  limited.splice(Math.max(1, Math.floor(limited.length / 2)), 0, brand)
  return limited.join(' ')
}

const isLinkedInApplicable = (campaign) => {
  const context = compact([
    campaign.propertyType,
    campaign.propertyStage,
    campaign.description,
    ...campaign.highlights,
  ]).join(' ').toLocaleLowerCase('pt-BR')
  return /(comercial|corporativ|lançamento|lancamento|investimento|institucional|sala|loja|galpão|galpao)/.test(context)
}

const existingTextValue = (value) => {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return clean(value)
  if (Array.isArray(value)) return value.map(existingTextValue).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    return Object.values(value).map(existingTextValue).filter(Boolean).join('\n\n')
  }
  return ''
}

const normalizeExistingTextItems = (existingTexts) => {
  if (Array.isArray(existingTexts)) {
    return existingTexts
      .map((item, index) => ({
        id: clean(item?.id) || `existing-${index}`,
        label: clean(item?.label) || `Texto ${index + 1}`,
        text: clean(item?.text),
      }))
      .filter((item) => item.text)
  }

  return Object.entries(existingTexts || {})
    .map(([id, value]) => ({
      id,
      label: clean(value?.label) || clean(id).replace(/[_-]+/g, ' '),
      text: existingTextValue(value?.text ?? value),
    }))
    .filter((item) => item.text)
}

const normalizeAiCampaigns = (campaigns) => (Array.isArray(campaigns) ? campaigns : [])
  .slice(0, 3)
  .map((campaign, index) => ({
    id: clean(campaign?.id) || `campaign-${index + 1}`,
    style: clean(campaign?.style),
    name: clean(campaign?.name),
    objective: clean(campaign?.objective),
    instagram: clean(campaign?.instagram),
    whatsapp: clean(campaign?.whatsapp),
    facebook: clean(campaign?.facebook),
    emailSubject: clean(campaign?.email?.subject),
    emailBody: clean(campaign?.email?.body),
    linkedin: clean(campaign?.linkedin),
    hashtags: Array.isArray(campaign?.hashtags) ? compact(campaign.hashtags).join(' ') : clean(campaign?.hashtags),
    cta: clean(campaign?.cta),
  }))
  .filter((campaign) => campaign.name && campaign.instagram && campaign.whatsapp && campaign.facebook)

const normalizeGoogleAds = (value, cta) => {
  if (!value) return null
  try {
    return validateGoogleAdsDelivery(value, cta ? { expectedCta: cta } : {})
  } catch {
    return null
  }
}

const buildGoogleAdsModule = (googleAds) => googleAds && ({
  id: 'google-ads',
  title: 'Google Ads',
  fields: [
    { id: 'google-ads-headlines', label: 'Títulos', text: googleAds.headlines.map(item => `- ${item}`).join('\n'), copyLabel: 'Copiar títulos' },
    { id: 'google-ads-long-headline', label: 'Título longo', text: googleAds.long_headline, copyLabel: 'Copiar título longo' },
    { id: 'google-ads-descriptions', label: 'Descrições', text: googleAds.descriptions.map(item => `- ${item}`).join('\n'), copyLabel: 'Copiar descrições' },
    { id: 'google-ads-cta', label: 'CTA', text: googleAds.cta, copyLabel: 'Copiar CTA' },
    { id: 'google-ads-keywords', label: 'Palavras-chave sugeridas', text: googleAds.suggested_keywords.map(item => `- ${item}`).join('\n'), copyLabel: 'Copiar palavras-chave' },
  ],
})

const campaignOptions = (campaigns, channel, copyLabel, format = (value) => value) => campaigns
  .map((campaign) => {
    const text = withoutHashtags(format(campaign[channel], campaign))
    return text && { text, copyLabel }
  })
  .filter(Boolean)
  .map((option, index) => ({
    ...option,
    id: `${channel}-option-${index + 1}`,
    label: `Texto ${index + 1}`,
  }))

const mergeCampaignHashtags = (campaigns) => normalizeHashtagBlock(campaigns.flatMap((campaign) => [
  campaign.hashtags,
  campaign.instagram,
  campaign.whatsapp,
  campaign.facebook,
  campaign.emailSubject,
  campaign.emailBody,
  campaign.linkedin,
]))

const buildAiCampaignModules = (campaigns) => {
  const modules = [
    { id: 'instagram', title: 'Instagram', fields: campaignOptions(campaigns, 'instagram', 'Copiar') },
    { id: 'whatsapp', title: 'WhatsApp', fields: campaignOptions(campaigns, 'whatsapp', 'Copiar') },
    { id: 'facebook', title: 'Facebook', fields: campaignOptions(campaigns, 'facebook', 'Copiar') },
    {
      id: 'email',
      title: 'Email',
      fields: campaignOptions(campaigns, 'emailBody', 'Copiar', (body, campaign) => compact([
        campaign.emailSubject ? `Assunto: ${campaign.emailSubject}` : '',
        body,
      ]).join('\n\n')),
    },
    { id: 'linkedin', title: 'LinkedIn', fields: campaignOptions(campaigns, 'linkedin', 'Copiar') },
  ].filter((module) => module.fields.length)
  const hashtags = mergeCampaignHashtags(campaigns)

  if (hashtags) {
    modules.push({ id: 'hashtags', title: 'Hashtags', text: hashtags, copyLabel: 'Copiar hashtags' })
  }

  return modules
}

const existingFields = (items, expression, copyLabel) => items
  .filter((item) => expression.test(item.label))
  .map((item) => ({
    id: item.id,
    label: item.label,
    text: withoutHashtags(item.text),
    copyLabel,
  }))
  .filter((item) => item.text)

export function normalizeCampaignPackageInput(input = {}) {
  const files = Array.isArray(input.files)
    ? input.files.filter(Boolean).map((file, index) => ({
      id: clean(file?.id || file?.piece_id || file?.render_id) || `media-${index}`,
      renderId: clean(file?.renderId || file?.render_id),
      name: clean(file?.name || file?.label || file?.template_nome || file?.format) || `Arte ${index + 1}`,
      type: clean(file?.type || file?.mediaType),
      status: clean(file?.status),
      url: clean(file?.url),
      previewUrl: clean(file?.previewUrl || file?.snapshot_url),
      downloadUrl: clean(file?.downloadUrl || file?.url),
    }))
    : []
  const highlights = Array.isArray(input.highlights) ? compact(input.highlights) : []
  const cta = clean(input.cta)
  return {
    sourceProduct: clean(input.sourceProduct),
    mediaType: input.mediaType === 'images' ? 'images' : 'video',
    files,
    previewUrl: clean(input.previewUrl),
    downloadUrl: clean(input.downloadUrl),
    downloadName: clean(input.downloadName) || 'campanha-smartcorretorai',
    purpose: clean(input.purpose),
    propertyStage: clean(input.propertyStage),
    propertyType: clean(input.propertyType),
    district: clean(input.district),
    city: clean(input.city),
    state: clean(input.state),
    bedrooms: clean(input.bedrooms),
    suites: clean(input.suites),
    parkingSpaces: clean(input.parkingSpaces),
    area: clean(input.area).replace(/\s*m²$/i, ''),
    price: clean(input.price),
    description: clean(input.description),
    highlights,
    cta,
    phone: input.contactAuthorized ? formatBrazilianPhone(input.phone) : '',
    contactAuthorized: Boolean(input.contactAuthorized && clean(input.phone)),
    existingTexts: input.existingTexts && typeof input.existingTexts === 'object' ? input.existingTexts : {},
    aiCampaigns: normalizeAiCampaigns(input.aiCampaigns),
    googleAds: normalizeGoogleAds(input.googleAds || input.google_ads, cta),
  }
}

export function buildCampaignPackage(input = {}) {
  const campaign = normalizeCampaignPackageInput(input)
  const aiCampaignModules = campaign.aiCampaigns.length === 3
    ? buildAiCampaignModules(campaign.aiCampaigns)
    : []
  if (aiCampaignModules.length) {
    const googleAdsModule = buildGoogleAdsModule(campaign.googleAds)
    return {
      ...campaign,
      modules: [...aiCampaignModules, ...(googleAdsModule ? [googleAdsModule] : [])],
      contact: [
        campaign.cta && { id: 'cta', label: 'CTA utilizado', value: campaign.cta, copyLabel: 'Copiar CTA' },
        campaign.contactAuthorized && { id: 'phone', label: 'Telefone', value: campaign.phone, copyLabel: 'Copiar telefone' },
      ].filter(Boolean),
      strategy: [
        '💡 Dica SmartCorretorAI — Sua campanha está pronta! Agora é o momento de colocá-la em ação. Baixe seus materiais para mantê-los sempre disponíveis e publique o quanto antes. Depois, aproveite este mesmo imóvel para criar novos vídeos, banners e campanhas com os outros produtos do SmartCorretorAI. Assim, você mantém suas redes sempre atualizadas com conteúdos variados e aumenta suas oportunidades de alcançar novos clientes.',
        '🚀 Continue gerando resultados — Quem publica com frequência permanece em evidência. Aproveite que todas as informações deste imóvel já estão organizadas e crie novas versões da campanha em diferentes formatos. Em poucos minutos você terá conteúdo suficiente para vários dias de divulgação, economizando tempo e fortalecendo sua presença nas redes sociais.',
        'Lembre-se: quanto mais conteúdos de qualidade você publicar, maiores serão suas oportunidades de gerar novos contatos e negócios.',
      ],
    }
  }
  const existingItems = normalizeExistingTextItems(campaign.existingTexts)
  const existingSocial = existingFields(existingItems, /instagram|facebook/i, 'Copiar texto')
  const existingWhatsapp = existingFields(existingItems, /whatsapp/i, 'Copiar mensagem')
  const existingPortal = existingFields(existingItems, /portal/i, 'Copiar descrição')
  const existingLinkedin = existingFields(existingItems, /linkedin/i, 'Copiar texto')
  const existingEmail = existingFields(existingItems, /e-?mail|assunto/i, 'Copiar')
  const location = locationText(campaign)
  const purpose = purposeText(campaign.purpose)
  const subject = compact([campaign.propertyType, purpose, location ? `em ${location}` : '']).join(' ')
  const facts = factsText(campaign)
  const highlights = joinNatural(campaign.highlights)
  const hasCampaignContext = Boolean(subject || campaign.description || highlights || campaign.cta)
  const contextText = compact([
    campaign.purpose,
    campaign.propertyStage,
    campaign.propertyType,
    campaign.description,
    ...campaign.highlights,
  ]).join(' ').toLocaleLowerCase('pt-BR')
  const hasPropertyContext = Boolean(purpose || campaign.propertyType)
  const hasInstitutionalContext = /(institucional|empresa|empresarial|marca|posicionamento|profissional)/.test(contextText)
  const hasProfessionalContext = isLinkedInApplicable(campaign) || hasInstitutionalContext
  const contactLine = campaign.contactAuthorized ? `Contato: ${campaign.phone}` : ''
  const ctaLine = compact([campaign.cta, contactLine]).join(' · ')
  const opening = subject ? sentence(subject) : ''
  const detailLines = compact([
    campaign.propertyStage ? sentence(campaign.propertyStage) : '',
    facts ? sentence(`O imóvel conta com ${facts}`) : '',
    highlights ? sentence(`Entre os destaques estão ${lowerFirst(highlights)}`) : '',
    campaign.price ? sentence(campaign.price) : '',
  ])
  const hashtags = normalizeHashtagBlock(existingItems.map((item) => item.text))

  const instagram = compact([
    opening,
    campaign.description ? sentence(campaign.description) : '',
    ...detailLines,
    ctaLine,
  ]).join('\n\n')

  const whatsapp = compact([
    'Olá! Tudo bem?',
    subject ? sentence(`Quero apresentar este ${lowerFirst(subject)}`) : '',
    facts ? sentence(facts) : '',
    highlights ? sentence(`Destaques: ${highlights}`) : '',
    campaign.price ? sentence(campaign.price) : '',
    campaign.cta,
    contactLine,
  ]).join('\n\n')

  const facebook = compact([
    opening,
    campaign.description ? sentence(campaign.description) : '',
    ...detailLines,
    ctaLine,
  ]).join('\n\n')

  const emailSubject = subject
    ? sentence(subject).replace(/[.]$/, '')
    : campaign.description
      ? sentence(campaign.description).replace(/[.]$/, '')
      : ''
  const emailBody = compact([
    'Olá,',
    opening,
    campaign.description ? sentence(campaign.description) : '',
    ...detailLines,
    campaign.cta,
    contactLine,
  ]).join('\n\n')

  const fallbackModules = [
    existingSocial.length
      ? { id: 'social', title: 'Instagram e Facebook', fields: existingSocial }
      : hasCampaignContext && instagram && { id: 'instagram', title: 'Instagram', copyLabel: 'Copiar texto', text: instagram },
    !existingSocial.length && hasCampaignContext && facebook && { id: 'facebook', title: 'Facebook', copyLabel: 'Copiar texto', text: facebook },
    existingWhatsapp.length
      ? { id: 'whatsapp', title: 'WhatsApp', fields: existingWhatsapp }
      : (hasPropertyContext || campaign.cta) && whatsapp && { id: 'whatsapp', title: 'WhatsApp', copyLabel: 'Copiar mensagem', text: whatsapp },
    existingPortal.length && { id: 'portal', title: 'Portal imobiliário', fields: existingPortal },
    existingLinkedin.length
      ? { id: 'linkedin', title: 'LinkedIn', fields: existingLinkedin }
      : hasProfessionalContext && facebook && {
      id: 'linkedin',
      title: 'LinkedIn',
      copyLabel: 'Copiar texto',
      text: compact([opening, campaign.description ? sentence(campaign.description) : '', ...detailLines, ctaLine]).join('\n\n'),
    },
    existingEmail.length
      ? { id: 'email', title: 'E-mail', fields: existingEmail }
      : (hasPropertyContext || hasProfessionalContext) && emailSubject && emailBody && {
      id: 'email',
      title: 'E-mail',
      fields: [
        { id: 'email-subject', label: 'Assunto sugerido', text: emailSubject, copyLabel: 'Copiar assunto' },
        { id: 'email-body', label: 'Mensagem', text: emailBody, copyLabel: 'Copiar mensagem' },
      ],
    },
    hashtags && { id: 'hashtags', title: 'Hashtags', copyLabel: 'Copiar hashtags', text: hashtags },
  ].filter(Boolean)
  const googleAdsModule = buildGoogleAdsModule(campaign.googleAds)
  const modules = [...fallbackModules, ...(googleAdsModule ? [googleAdsModule] : [])]

  return {
    ...campaign,
    modules,
    contact: [
      campaign.cta && { id: 'cta', label: 'CTA utilizado', value: campaign.cta, copyLabel: 'Copiar CTA' },
      campaign.contactAuthorized && { id: 'phone', label: 'Telefone', value: campaign.phone, copyLabel: 'Copiar telefone' },
    ].filter(Boolean),
    strategy: (() => {
      const moduleIds = new Set(modules.map((module) => module.id))
      const hasSocial = moduleIds.has('social') || moduleIds.has('instagram') || moduleIds.has('facebook')
      return [
        campaign.mediaType === 'images' ? 'Publique as artes no canal mais adequado.' : 'Publique o vídeo no canal mais adequado.',
        ...(hasSocial ? ['Reaproveite o conteúdo nas redes sociais compatíveis.'] : []),
        ...(moduleIds.has('whatsapp') ? ['Envie a mensagem pronta pelo WhatsApp.'] : []),
        ...(moduleIds.has('linkedin') ? ['Use o LinkedIn para ampliar o alcance profissional.'] : []),
        ...(campaign.cta ? ['Responda rapidamente aos contatos interessados.'] : []),
      ]
    })(),
  }
}

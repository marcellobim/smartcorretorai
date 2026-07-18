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

const hashtagToken = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
  .join('')

const buildHashtags = (campaign) => {
  const source = [
    campaign.purpose === 'sale' ? 'Imóvel à venda' : campaign.purpose === 'rent' ? 'Imóvel para locação' : '',
    campaign.propertyType,
    campaign.district,
    campaign.city,
    campaign.state,
    ...campaign.highlights,
  ]
  const trustedTokens = source.map(hashtagToken).filter(Boolean)
  if (!trustedTokens.length) return ''
  return [...new Set([...trustedTokens, 'SmartCorretorAI'])]
    .slice(0, 10)
    .map((item) => `#${item}`)
    .join(' ')
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

const existingFields = (items, expression, copyLabel) => items
  .filter((item) => expression.test(item.label))
  .map((item) => ({
    id: item.id,
    label: item.label,
    text: item.text,
    copyLabel,
  }))

export function normalizeCampaignPackageInput(input = {}) {
  const files = Array.isArray(input.files)
    ? input.files.filter(Boolean).map((file, index) => ({
      id: clean(file?.id || file?.piece_id || file?.render_id) || `media-${index}`,
      name: clean(file?.name || file?.label || file?.template_nome || file?.format) || `Arte ${index + 1}`,
      type: clean(file?.type || file?.mediaType),
      status: clean(file?.status),
      url: clean(file?.url),
      previewUrl: clean(file?.previewUrl || file?.snapshot_url),
      downloadUrl: clean(file?.downloadUrl || file?.url),
    }))
    : []
  const highlights = Array.isArray(input.highlights) ? compact(input.highlights) : []
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
    cta: clean(input.cta),
    phone: input.contactAuthorized ? clean(input.phone) : '',
    contactAuthorized: Boolean(input.contactAuthorized && clean(input.phone)),
    existingTexts: input.existingTexts && typeof input.existingTexts === 'object' ? input.existingTexts : {},
  }
}

export function buildCampaignPackage(input = {}) {
  const campaign = normalizeCampaignPackageInput(input)
  const existingItems = normalizeExistingTextItems(campaign.existingTexts)
  const existingSocial = existingFields(existingItems, /instagram|facebook/i, 'Copiar texto')
  const existingWhatsapp = existingFields(existingItems, /whatsapp/i, 'Copiar mensagem')
  const existingPortal = existingFields(existingItems, /portal/i, 'Copiar descrição')
  const existingHashtags = existingItems.find((item) => /hashtag/i.test(item.label))
  const location = locationText(campaign)
  const purpose = purposeText(campaign.purpose)
  const subject = compact([campaign.propertyType, purpose, location ? `em ${location}` : '']).join(' ')
  const facts = factsText(campaign)
  const highlights = joinNatural(campaign.highlights)
  const hasCampaignContext = Boolean(subject || campaign.description || highlights || campaign.cta)
  const contactLine = campaign.contactAuthorized ? `Contato: ${campaign.phone}` : ''
  const ctaLine = compact([campaign.cta, contactLine]).join(' · ')
  const opening = subject ? sentence(subject) : ''
  const detailLines = compact([
    campaign.propertyStage ? sentence(campaign.propertyStage) : '',
    facts ? sentence(`O imóvel conta com ${facts}`) : '',
    highlights ? sentence(`Entre os destaques estão ${lowerFirst(highlights)}`) : '',
    campaign.price ? sentence(campaign.price) : '',
  ])
  const hashtags = buildHashtags(campaign)

  const instagram = compact([
    opening,
    campaign.description ? sentence(campaign.description) : '',
    ...detailLines,
    ctaLine,
    hashtags,
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
    hashtags,
  ]).join('\n\n')

  const emailSubject = subject ? sentence(subject).replace(/[.]$/, '') : ''
  const emailBody = compact([
    'Olá,',
    opening,
    campaign.description ? sentence(campaign.description) : '',
    ...detailLines,
    campaign.cta,
    contactLine,
  ]).join('\n\n')

  const modules = [
    existingSocial.length
      ? { id: 'social', title: 'Instagram e Facebook', fields: existingSocial }
      : hasCampaignContext && instagram && { id: 'instagram', title: 'Instagram', copyLabel: 'Copiar texto', text: instagram },
    !existingSocial.length && hasCampaignContext && facebook && { id: 'facebook', title: 'Facebook', copyLabel: 'Copiar texto', text: facebook },
    existingWhatsapp.length
      ? { id: 'whatsapp', title: 'WhatsApp', fields: existingWhatsapp }
      : hasCampaignContext && whatsapp && { id: 'whatsapp', title: 'WhatsApp', copyLabel: 'Copiar mensagem', text: whatsapp },
    existingPortal.length && { id: 'portal', title: 'Portal imobiliário', fields: existingPortal },
    isLinkedInApplicable(campaign) && facebook && {
      id: 'linkedin',
      title: 'LinkedIn',
      copyLabel: 'Copiar texto',
      text: compact([opening, campaign.description ? sentence(campaign.description) : '', ...detailLines, ctaLine]).join('\n\n'),
    },
    emailSubject && emailBody && {
      id: 'email',
      title: 'E-mail',
      fields: [
        { id: 'email-subject', label: 'Assunto sugerido', text: emailSubject, copyLabel: 'Copiar assunto' },
        { id: 'email-body', label: 'Mensagem', text: emailBody, copyLabel: 'Copiar mensagem' },
      ],
    },
    existingHashtags
      ? { id: 'hashtags', title: 'Hashtags inteligentes', copyLabel: 'Copiar hashtags', text: existingHashtags.text }
      : hashtags && { id: 'hashtags', title: 'Hashtags inteligentes', copyLabel: 'Copiar hashtags', text: hashtags },
  ].filter(Boolean)

  return {
    ...campaign,
    modules,
    contact: [
      campaign.cta && { id: 'cta', label: 'CTA utilizado', value: campaign.cta, copyLabel: 'Copiar CTA' },
      campaign.contactAuthorized && { id: 'phone', label: 'Telefone', value: campaign.phone, copyLabel: 'Copiar telefone' },
    ].filter(Boolean),
    strategy: [
      campaign.mediaType === 'images' ? 'Publique as artes no Instagram.' : 'Publique o vídeo no Instagram.',
      'Reaproveite a publicação no Facebook.',
      'Envie a mensagem pronta pelo WhatsApp.',
      ...(isLinkedInApplicable(campaign) ? ['Use o LinkedIn para ampliar o alcance profissional.'] : []),
      'Responda rapidamente aos contatos interessados.',
    ],
  }
}

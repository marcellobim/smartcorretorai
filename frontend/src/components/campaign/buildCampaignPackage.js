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

const buildAiCampaignModules = (campaigns) => campaigns.map((campaign, index) => ({
  id: campaign.id,
  title: `Campanha ${index + 1} · ${campaign.name}`,
  fields: [
    campaign.objective && { id: `${campaign.id}-objective`, label: 'Estratégia', text: campaign.objective, copyLabel: 'Copiar estratégia' },
    campaign.instagram && { id: `${campaign.id}-instagram`, label: 'Instagram', text: campaign.instagram, copyLabel: 'Copiar texto' },
    campaign.whatsapp && { id: `${campaign.id}-whatsapp`, label: 'WhatsApp', text: campaign.whatsapp, copyLabel: 'Copiar mensagem' },
    campaign.facebook && { id: `${campaign.id}-facebook`, label: 'Facebook', text: campaign.facebook, copyLabel: 'Copiar texto' },
    campaign.emailSubject && { id: `${campaign.id}-email-subject`, label: 'Assunto do e-mail', text: campaign.emailSubject, copyLabel: 'Copiar assunto' },
    campaign.emailBody && { id: `${campaign.id}-email-body`, label: 'E-mail', text: campaign.emailBody, copyLabel: 'Copiar mensagem' },
    campaign.linkedin && { id: `${campaign.id}-linkedin`, label: 'LinkedIn', text: campaign.linkedin, copyLabel: 'Copiar texto' },
    campaign.hashtags && { id: `${campaign.id}-hashtags`, label: 'Hashtags inteligentes', text: campaign.hashtags, copyLabel: 'Copiar hashtags' },
    campaign.cta && { id: `${campaign.id}-cta`, label: 'CTA', text: campaign.cta, copyLabel: 'Copiar CTA' },
  ].filter(Boolean),
}))

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
    aiCampaigns: normalizeAiCampaigns(input.aiCampaigns),
  }
}

export function buildCampaignPackage(input = {}) {
  const campaign = normalizeCampaignPackageInput(input)
  const aiCampaignModules = campaign.aiCampaigns.length === 3
    ? buildAiCampaignModules(campaign.aiCampaigns)
    : []
  if (aiCampaignModules.length) {
    return {
      ...campaign,
      modules: aiCampaignModules,
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
  const existingHashtags = existingItems.find((item) => /hashtag/i.test(item.label))
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
    existingHashtags
      ? { id: 'hashtags', title: 'Hashtags inteligentes', copyLabel: 'Copiar hashtags', text: existingHashtags.text }
      : hashtags && { id: 'hashtags', title: 'Hashtags inteligentes', copyLabel: 'Copiar hashtags', text: hashtags },
  ].filter(Boolean)
  const modules = fallbackModules

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

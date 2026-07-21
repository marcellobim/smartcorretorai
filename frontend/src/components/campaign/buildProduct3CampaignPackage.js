const clean = (value) => String(value ?? '').trim()

const withoutHashtags = (value) => clean(value)
  .replace(/#[\p{L}\p{N}_]+/gu, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const nestedText = (value, keys = []) => {
  if (typeof value === 'string') return clean(value)
  if (!value || typeof value !== 'object') return ''
  for (const key of keys) {
    if (typeof value[key] === 'string' && clean(value[key])) return clean(value[key])
  }
  return ''
}

const appendOnce = (text, suffix) => {
  const base = withoutHashtags(text)
  const addition = clean(suffix)
  if (!addition || base.toLocaleLowerCase('pt-BR').includes(addition.toLocaleLowerCase('pt-BR'))) return base
  return [base, addition].filter(Boolean).join('\n\n')
}

const prependOnce = (text, prefix) => {
  const base = withoutHashtags(text)
  const addition = clean(prefix)
  if (!addition || base.toLocaleLowerCase('pt-BR').includes(addition.toLocaleLowerCase('pt-BR'))) return base
  return [addition, base].filter(Boolean).join('\n\n')
}

const threePresentationOptions = ({ primary, secondary, title, cta }) => {
  const base = withoutHashtags(primary || secondary || title)
  const alternate = withoutHashtags(secondary || primary || title)
  const candidates = [...new Set([
    base,
    prependOnce(alternate, title),
    appendOnce(alternate, cta),
    prependOnce(base, 'Conheça os detalhes deste imóvel.'),
    appendOnce(base, 'Fale comigo para agendar uma visita.'),
  ].filter(Boolean))]

  while (candidates.length < 3) candidates.push(`${base}\n\nOpção ${candidates.length + 1}`.trim())
  return candidates.slice(0, 3)
}

const linkedinIsApplicable = ({ generatedTexts, property }) => {
  if (nestedText(generatedTexts.linkedin, ['texto', 'legenda', 'mensagem'])) return true
  const context = [
    property.tipo,
    property.situacao,
    property.categoria,
    ...(Array.isArray(property.destaques) ? property.destaques : []),
  ].map(clean).join(' ').toLocaleLowerCase('pt-BR')
  return /(comercial|corporativ|lançamento|lancamento|investimento|institucional|sala|loja|galpão|galpao)/.test(context)
}

export function buildProduct3CampaignOptions({ generatedTexts = {}, property = {}, cta = '' } = {}) {
  const title = clean(generatedTexts.titulo_campanha)
  const portal = nestedText(generatedTexts.descricao_portal, ['texto', 'descricao'])
  const instagramFeed = nestedText(generatedTexts.instagram_feed, ['legenda', 'texto'])
  const instagramPost = nestedText(generatedTexts.post_instagram, ['legenda', 'texto'])
  const facebookText = nestedText(generatedTexts.facebook, ['texto', 'legenda'])
  const whatsappText = nestedText(generatedTexts.whatsapp, ['mensagem', 'texto'])
  const whatsappMessage = nestedText(generatedTexts.mensagem_whatsapp, ['mensagem', 'texto'])
  const linkedinText = nestedText(generatedTexts.linkedin, ['texto', 'legenda'])
  const hashtags = Array.isArray(generatedTexts.hashtags)
    ? generatedTexts.hashtags.join(' ')
    : clean(generatedTexts.hashtags)

  const instagram = threePresentationOptions({
    primary: instagramFeed || instagramPost,
    secondary: instagramPost || portal,
    title,
    cta,
  })
  const facebook = threePresentationOptions({
    primary: facebookText || instagramPost,
    secondary: portal || instagramFeed,
    title,
    cta,
  })
  const whatsapp = threePresentationOptions({
    primary: whatsappText || whatsappMessage,
    secondary: whatsappMessage || whatsappText,
    title,
    cta,
  })
  const linkedin = linkedinIsApplicable({ generatedTexts, property })
    ? threePresentationOptions({
      primary: linkedinText || portal || instagramPost,
      secondary: portal || instagramPost,
      title,
      cta,
    })
    : ['', '', '']

  return [0, 1, 2].map((index) => ({
    id: `produto-3-${index + 1}`,
    name: `Opção ${index + 1}`,
    instagram: instagram[index],
    facebook: facebook[index],
    whatsapp: whatsapp[index],
    linkedin: linkedin[index],
    hashtags,
    cta: clean(cta),
  }))
}

export function normalizeProduct3CampaignFiles(files = []) {
  return (Array.isArray(files) ? files : []).map((file, index) => {
    const url = clean(file?.download_url || file?.downloadUrl || file?.video_url || file?.videoUrl || file?.url)
    const previewUrl = clean(file?.preview_url || file?.previewUrl || file?.snapshot_url || url)
    const typeValue = clean(file?.type || file?.media_type).toLocaleLowerCase('pt-BR')
    const isVideo = typeValue.includes('video') || /\.(mp4|webm|mov)(?:$|\?)/i.test(url)
    return {
      id: file?.piece_id || file?.render_id || `produto-3-media-${index + 1}`,
      name: file?.template_nome || file?.model_name || file?.label || `Peça ${index + 1}`,
      type: isVideo ? 'video' : 'image',
      status: file?.status,
      url,
      previewUrl,
      downloadUrl: url,
    }
  })
}

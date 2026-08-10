const READY_MEDIA_STATUSES = new Set(['succeeded', 'completed', 'concluída'])

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

const inferMimeType = (url, type = '') => {
  if (/\.png(?:$|\?)/i.test(url)) return 'image/png'
  if (/\.webp(?:$|\?)/i.test(url)) return 'image/webp'
  if (/\.jpe?g(?:$|\?)/i.test(url)) return 'image/jpeg'
  if (/\.webm(?:$|\?)/i.test(url)) return 'video/webm'
  if (/\.mov(?:$|\?)/i.test(url)) return 'video/quicktime'
  if (/\.mp4(?:$|\?)/i.test(url) || type === 'video') return 'video/mp4'
  return type === 'image' ? 'image/jpeg' : ''
}

const firstModuleText = module => clean(module?.text || module?.fields?.[0]?.text)

const selectExistingShareText = modules => {
  for (const id of ['instagram', 'social', 'facebook', 'whatsapp']) {
    const text = firstModuleText(modules.find(module => module.id === id))
    if (text) return text
  }
  return ''
}

const deriveMedia = campaign => {
  if (campaign.mediaType === 'images') {
    return campaign.files.flatMap((file, index) => {
      const status = clean(file.status || 'planned').toLocaleLowerCase('pt-BR')
      const url = READY_MEDIA_STATUSES.has(status) ? clean(file.downloadUrl || file.url) : ''
      if (!url) return []
      const type = file.type === 'video' || /\.(?:mp4|webm|mov)(?:$|\?)/i.test(url) ? 'video' : 'image'
      return [{
        id: file.id || `campaign-media-${index + 1}`,
        url,
        filename: file.name || `smartcorretorai-arte-${index + 1}`,
        mimeType: inferMimeType(url, type),
        type,
        sourceFile: file,
      }]
    })
  }

  const url = clean(campaign.downloadUrl || campaign.previewUrl)
  if (!url) return []
  return [{
    id: 'campaign-video',
    url,
    filename: campaign.downloadName,
    mimeType: inferMimeType(url, 'video'),
    type: 'video',
  }]
}

const mediaUrlCandidates = (campaign, media) => [
  campaign.previewUrl,
  campaign.downloadUrl,
  ...campaign.files.flatMap(file => [file.url, file.previewUrl, file.downloadUrl]),
  ...media.flatMap(item => [item?.url, item?.downloadUrl]),
].map(clean).filter(Boolean)

export function removeCampaignMediaUrls(value, urls = []) {
  return [...new Set(urls.map(clean).filter(Boolean))]
    .reduce((text, url) => text.split(url).join(''), String(value ?? ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const removeMediaUrlsFromHashtags = (hashtags, urls) => Array.isArray(hashtags)
  ? hashtags.map(value => removeCampaignMediaUrls(value, urls)).filter(Boolean)
  : removeCampaignMediaUrls(hashtags, urls)

export function buildCampaignPackageShareProps(campaign, sharePublish) {
  if (sharePublish?.enabled !== true) return null

  const media = Array.isArray(sharePublish.media) && sharePublish.media.length
    ? sharePublish.media
    : deriveMedia(campaign)
  const blockedUrls = mediaUrlCandidates(campaign, media)
  const shareText = hasOwn(sharePublish, 'shareText')
    ? sharePublish.shareText
    : selectExistingShareText(campaign.modules)
  const hashtagsModule = campaign.modules.find(module => module.id === 'hashtags')
  const hashtags = hasOwn(sharePublish, 'hashtags')
    ? sharePublish.hashtags
    : firstModuleText(hashtagsModule)
  const baseCta = hasOwn(sharePublish, 'cta') ? sharePublish.cta : campaign.cta
  const authorizedPhone = campaign.contactAuthorized ? campaign.phone : ''
  const cta = [clean(baseCta), authorizedPhone && `Telefone: ${authorizedPhone}`].filter(Boolean).join(' · ')

  return {
    media,
    shareTitle: removeCampaignMediaUrls(sharePublish.shareTitle || campaign.sourceProduct, blockedUrls),
    shareText: removeCampaignMediaUrls(shareText, blockedUrls),
    hashtags: removeMediaUrlsFromHashtags(hashtags, blockedUrls),
    cta: removeCampaignMediaUrls(cta, blockedUrls),
    supportedNetworks: sharePublish.supportedNetworks,
    renewMediaUrl: sharePublish.renewMediaUrl,
    className: sharePublish.className || '',
  }
}

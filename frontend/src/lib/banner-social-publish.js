const PENDING_BANNER_PUBLICATION_PREFIX = 'smartcorretorai:banner-publication:v1'
const BANNER_SOCIAL_PUBLISH_FUNCTION = 'social-publish-banner'
const VALID_DESTINATIONS = new Set(['instagram', 'facebook'])

const text = value => typeof value === 'string' ? value.trim() : ''
const optionNumber = optionId => Number(text(optionId).match(/(\d+)$/)?.[1] || 0)

const pendingKey = userId => `${PENDING_BANNER_PUBLICATION_PREFIX}:${text(userId)}`

export function selectBannerMediaForOption(files, optionId) {
  const media = Array.isArray(files) ? files.filter(Boolean) : []
  const exact = media.find(file => text(file.optionId) === text(optionId))
  if (exact) return exact
  const number = optionNumber(optionId)
  return media.find(file => Number(file.optionNumber) === number) || null
}

export function buildBannerPublicationIntent({ campaign, field, optionIndex = 0 } = {}) {
  if (campaign?.sourceProduct !== 'Banner Imobiliário') throw new Error('banner_publication_product_invalid')
  const optionId = text(field?.id)
  const captionSnapshot = typeof field?.text === 'string' ? field.text : ''
  const sourceType = text(campaign?.sourceType)
  const sourceId = text(campaign?.sourceId)
  const media = selectBannerMediaForOption(campaign?.files, optionId)
  const mediaAssetId = text(media?.assetId || media?.id)
  if (!optionId || !captionSnapshot || !sourceType || !sourceId || !mediaAssetId || !media?.previewUrl) {
    throw new Error('banner_publication_identity_incomplete')
  }
  return {
    sourceType,
    sourceId,
    mediaAssetId,
    optionId,
    optionNumber: optionNumber(optionId) || optionIndex + 1,
    optionLabel: text(field?.label) || `Texto ${optionIndex + 1}`,
    captionSnapshot,
    mediaName: text(media?.name) || 'Banner Imobiliário',
    mediaPreviewUrl: media.previewUrl,
  }
}

export function toPendingBannerPublication(intent) {
  return {
    sourceType: text(intent?.sourceType),
    sourceId: text(intent?.sourceId),
    mediaAssetId: text(intent?.mediaAssetId),
    optionId: text(intent?.optionId),
    optionNumber: Number(intent?.optionNumber) || 0,
    captionSnapshot: typeof intent?.captionSnapshot === 'string' ? intent.captionSnapshot : '',
  }
}

export function preservePendingBannerPublication(storage, userId, intent) {
  if (!storage || !text(userId)) return false
  const pending = toPendingBannerPublication(intent)
  if (!pending.sourceType || !pending.sourceId || !pending.mediaAssetId || !pending.optionId || !pending.captionSnapshot) return false
  try {
    storage.setItem(pendingKey(userId), JSON.stringify(pending))
    return true
  } catch {
    return false
  }
}

export function readPendingBannerPublication(storage, userId) {
  if (!storage || !text(userId)) return null
  try {
    const pending = toPendingBannerPublication(JSON.parse(storage.getItem(pendingKey(userId)) || 'null'))
    return pending.sourceType && pending.sourceId && pending.mediaAssetId && pending.optionId && pending.captionSnapshot ? pending : null
  } catch {
    return null
  }
}

export function clearPendingBannerPublication(storage, userId) {
  if (!storage || !text(userId)) return false
  try {
    storage.removeItem(pendingKey(userId))
    return true
  } catch {
    return false
  }
}

export function restorePendingBannerPublication({ campaign, pending } = {}) {
  if (!pending || !campaign) return null
  const field = campaign.modules?.flatMap(module => module.fields || []).find(item => text(item?.id) === text(pending.optionId))
  if (!field) return null
  try {
    const restored = buildBannerPublicationIntent({ campaign, field, optionIndex: Math.max(0, Number(pending.optionNumber) - 1) })
    return restored.sourceType === pending.sourceType
      && restored.sourceId === pending.sourceId
      && restored.mediaAssetId === pending.mediaAssetId
      && restored.optionId === pending.optionId
      && restored.captionSnapshot === pending.captionSnapshot
      ? restored
      : null
  } catch {
    return null
  }
}

const normalizeDestinations = destinations => {
  const normalized = [...new Set(Array.isArray(destinations) ? destinations.map(text) : [])]
  if (!normalized.length || normalized.some(destination => !VALID_DESTINATIONS.has(destination))) {
    throw new Error('banner_publication_destinations_invalid')
  }
  return normalized
}

export function buildBannerPublicationRequest(intent, destinations, action = 'publish') {
  const normalizedDestinations = normalizeDestinations(destinations)
  if (intent?.sourceType !== BANNER_PUBLICATION_SOURCE_TYPE || !text(intent?.sourceId) || !text(intent?.mediaAssetId) || !text(intent?.optionId)) {
    throw new Error('banner_publication_identity_incomplete')
  }
  return {
    action,
    source: { type: BANNER_PUBLICATION_SOURCE_TYPE, id: text(intent.sourceId) },
    media_asset_id: text(intent.mediaAssetId),
    option_id: text(intent.optionId),
    destinations: normalizedDestinations,
  }
}

const invokeBannerPublication = async (client, intent, destinations, action) => {
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (sessionError || !accessToken) throw new Error('banner_publication_session_required')
  const { data, error } = await client.functions.invoke(BANNER_SOCIAL_PUBLISH_FUNCTION, {
    body: buildBannerPublicationRequest(intent, destinations, action),
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error || !data?.ok || !Array.isArray(data.results) || data.smart_tokens !== 0) {
    throw new Error(text(data?.code) || 'banner_publication_unavailable')
  }
  return data
}

export const publishBannerPublication = (client, intent, destinations) => invokeBannerPublication(client, intent, destinations, 'publish')
export const recoverBannerPublication = (client, intent, destinations) => invokeBannerPublication(client, intent, destinations, 'recovery')

export function getBannerConnectionDestinations(connection) {
  if (!connection?.connected || connection.status !== 'active' || connection.selectionRequired) return []
  return [
    text(connection.username) && { id: 'instagram', label: `Instagram @${text(connection.username)}` },
    text(connection.pageName) && { id: 'facebook', label: `Facebook ${text(connection.pageName)}` },
  ].filter(Boolean)
}

export const BANNER_PUBLICATION_SOURCE_TYPE = 'banner_imobiliario'

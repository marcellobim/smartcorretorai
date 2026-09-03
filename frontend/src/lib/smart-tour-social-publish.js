const PENDING_VIDEO_PUBLICATION_PREFIX = 'smartcorretorai:video-publication:v1'
const VIDEO_SOCIAL_PUBLISH_FUNCTION = 'social-publish-video'
const VALID_DESTINATIONS = new Set(['instagram', 'facebook'])
const MAX_CAPTION_LENGTH = 2200

const text = value => typeof value === 'string' ? value.trim() : ''
const caption = value => typeof value === 'string' ? value : ''
const captionLength = value => Array.from(caption(value)).length
const pendingKey = userId => `${PENDING_VIDEO_PUBLICATION_PREFIX}:${text(userId)}`

export const VIDEO_PUBLICATION_SOURCE_TYPE = 'video_imobiliario'

export function buildSmartTourPublicationIntent({ campaign, field, optionIndex = 0 } = {}) {
  const optionId = text(field?.id)
  const captionSnapshot = typeof field?.text === 'string' ? field.text : ''
  const sourceType = text(campaign?.sourceType)
  const sourceId = text(campaign?.sourceId)
  const mediaAssetId = text(campaign?.mediaAssetId)
  if (sourceType !== VIDEO_PUBLICATION_SOURCE_TYPE || !sourceId || mediaAssetId !== sourceId
      || !/^smart-tour-caption-option-[1-3]$/.test(optionId) || captionLength(captionSnapshot) > MAX_CAPTION_LENGTH || !campaign?.previewUrl) {
    throw new Error('video_publication_identity_incomplete')
  }
  return {
    sourceType,
    sourceId,
    mediaAssetId,
    optionId,
    optionNumber: optionIndex + 1,
    optionLabel: text(field?.label) || `Texto ${optionIndex + 1}`,
    captionSnapshot,
    mediaName: 'Vídeo Imobiliário',
    mediaPreviewUrl: campaign.previewUrl,
    mediaType: 'video',
  }
}

const toPending = intent => ({
  sourceType: text(intent?.sourceType),
  sourceId: text(intent?.sourceId),
  mediaAssetId: text(intent?.mediaAssetId),
  optionId: text(intent?.optionId),
  optionNumber: Number(intent?.optionNumber) || 0,
  captionSnapshot: typeof intent?.captionSnapshot === 'string' ? intent.captionSnapshot : '',
})

export function preservePendingSmartTourPublication(storage, userId, intent) {
  if (!storage || !text(userId)) return false
  const pending = toPending(intent)
  if (!pending.sourceType || !pending.sourceId || !pending.mediaAssetId || !pending.optionId || captionLength(pending.captionSnapshot) > MAX_CAPTION_LENGTH) return false
  try { storage.setItem(pendingKey(userId), JSON.stringify(pending)); return true } catch { return false }
}

export function readPendingSmartTourPublication(storage, userId) {
  if (!storage || !text(userId)) return null
  try {
    const pending = toPending(JSON.parse(storage.getItem(pendingKey(userId)) || 'null'))
    return pending.sourceType && pending.sourceId && pending.mediaAssetId && pending.optionId && captionLength(pending.captionSnapshot) <= MAX_CAPTION_LENGTH ? pending : null
  } catch { return null }
}

export function clearPendingSmartTourPublication(storage, userId) {
  if (!storage || !text(userId)) return false
  try { storage.removeItem(pendingKey(userId)); return true } catch { return false }
}

export function restorePendingSmartTourPublication({ campaign, pending } = {}) {
  if (!pending || !campaign) return null
  const field = campaign.modules?.flatMap(module => module.fields || []).find(item => text(item?.id) === text(pending.optionId))
  if (!field) return null
  try {
    const restored = buildSmartTourPublicationIntent({ campaign, field, optionIndex: Math.max(0, Number(pending.optionNumber) - 1) })
    return restored.sourceType === pending.sourceType && restored.sourceId === pending.sourceId
      && restored.mediaAssetId === pending.mediaAssetId && restored.optionId === pending.optionId
      && captionLength(pending.captionSnapshot) <= MAX_CAPTION_LENGTH ? { ...restored, captionSnapshot: pending.captionSnapshot } : null
  } catch { return null }
}

const normalizeDestinations = destinations => {
  const normalized = [...new Set(Array.isArray(destinations) ? destinations.map(text) : [])]
  if (!normalized.length || normalized.some(destination => !VALID_DESTINATIONS.has(destination))) throw new Error('video_publication_destinations_invalid')
  return normalized
}

export function buildSmartTourPublicationRequest(intent, destinations, action = 'publish') {
  const captionSnapshot = caption(intent?.captionSnapshot)
  if (intent?.sourceType !== VIDEO_PUBLICATION_SOURCE_TYPE || !text(intent?.sourceId)
      || text(intent?.mediaAssetId) !== text(intent?.sourceId) || !/^smart-tour-caption-option-[1-3]$/.test(text(intent?.optionId))
      || captionLength(captionSnapshot) > MAX_CAPTION_LENGTH) {
    throw new Error('video_publication_identity_incomplete')
  }
  return {
    action,
    source: { type: VIDEO_PUBLICATION_SOURCE_TYPE, id: text(intent.sourceId) },
    media_asset_id: text(intent.mediaAssetId),
    option_id: text(intent.optionId),
    caption_snapshot: captionSnapshot,
    destinations: normalizeDestinations(destinations),
  }
}

const invoke = async (client, intent, destinations, action) => {
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (sessionError || !accessToken) throw new Error('video_publication_session_required')
  const { data, error } = await client.functions.invoke(VIDEO_SOCIAL_PUBLISH_FUNCTION, {
    body: buildSmartTourPublicationRequest(intent, destinations, action),
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error || !data?.ok || !Array.isArray(data.results) || data.smart_tokens !== 0) throw new Error(text(data?.code) || 'video_publication_unavailable')
  return data
}

export const publishSmartTourPublication = (client, intent, destinations) => invoke(client, intent, destinations, 'publish')
export const recoverSmartTourPublication = (client, intent, destinations) => invoke(client, intent, destinations, 'recovery')

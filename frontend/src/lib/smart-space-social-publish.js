const PENDING_PREFIX = 'smartcorretorai:smart-space-publication:v1'
const FUNCTION_NAME = 'social-publish-smart-space'
const VIDEO_SOURCE_TYPE = 'smart_space_transform'
const IMAGE_SOURCE_TYPE = 'smart_space_image'
const CAMPAIGN_SOURCE_TYPES = new Set(['smart_space_life', 'smart_space_broker'])
const OPTION_ID = 'smart-space-no-caption'
const MAX_CAPTION_LENGTH = 2200
const DESTINATIONS = new Set(['instagram', 'facebook'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const text = value => typeof value === 'string' ? value.trim() : ''
const caption = value => typeof value === 'string' ? value : ''
const captionLength = value => Array.from(caption(value)).length
const pendingKey = userId => `${PENDING_PREFIX}:${text(userId)}`
const mediaAssetId = itemIndex => `${Number(itemIndex)}:transformation_video`
const imageMediaAssetId = (itemIndex, stageKind) => `${Number(itemIndex)}:${text(stageKind)}`
const validIdentity = value => (
  value?.sourceType === VIDEO_SOURCE_TYPE
    ? UUID_PATTERN.test(value.sourceId) && /^[0-4]:transformation_video$/.test(value.mediaAssetId)
    : value?.sourceType === IMAGE_SOURCE_TYPE
      ? UUID_PATTERN.test(value.sourceId) && /^[0-4]:[a-z0-9_]{1,40}$/.test(value.mediaAssetId)
      : CAMPAIGN_SOURCE_TYPES.has(value?.sourceType)
        ? UUID_PATTERN.test(value.sourceId) && value.mediaAssetId === value.sourceId
        : false
)

export function buildSmartSpaceVideoPublicationIntent({ clientRequestId, itemIndex, previewUrl } = {}) {
  const sourceId = text(clientRequestId)
  const index = Number(itemIndex)
  if (!UUID_PATTERN.test(sourceId) || !Number.isInteger(index) || index < 0 || index > 4 || !/^https:\/\//i.test(text(previewUrl))) {
    throw new Error('smart_space_publication_identity_incomplete')
  }
  return {
    sourceType: VIDEO_SOURCE_TYPE,
    sourceId,
    mediaAssetId: mediaAssetId(index),
    optionId: OPTION_ID,
    optionLabel: 'Vídeo da transformação',
    captionSnapshot: '',
    captionPlaceholder: 'Conte um pouco sobre esta transformação ou sobre o imóvel…',
    mediaName: `Vídeo da transformação ${index + 1}`,
    mediaPreviewUrl: text(previewUrl),
    mediaType: 'video',
  }
}

export function buildSmartSpaceImagePublicationIntent({ clientRequestId, itemIndex, stageKind, stageLabel, previewUrl } = {}) {
  const sourceId = text(clientRequestId)
  const index = Number(itemIndex)
  const kind = text(stageKind)
  if (!UUID_PATTERN.test(sourceId) || !Number.isInteger(index) || index < 0 || index > 4
      || !/^[a-z0-9_]{1,40}$/.test(kind) || !/^https:\/\//i.test(text(previewUrl))) {
    throw new Error('smart_space_publication_identity_incomplete')
  }
  return {
    sourceType: IMAGE_SOURCE_TYPE,
    sourceId,
    mediaAssetId: imageMediaAssetId(index, kind),
    optionId: OPTION_ID,
    optionLabel: 'Imagem Smart Space',
    captionSnapshot: '',
    captionPlaceholder: 'Conte um pouco sobre esta transformação ou sobre o imóvel…',
    mediaName: text(stageLabel) || `Resultado Smart Space ${index + 1}`,
    mediaPreviewUrl: text(previewUrl),
    mediaType: 'image',
  }
}

export function buildSmartSpaceCampaignPublicationIntent({ campaign, field } = {}) {
  const sourceType = text(campaign?.sourceType)
  const sourceId = text(campaign?.sourceId)
  const captionSnapshot = caption(field?.text)
  if (!CAMPAIGN_SOURCE_TYPES.has(sourceType) || !UUID_PATTERN.test(sourceId)
      || text(campaign?.mediaAssetId) !== sourceId || !campaign?.previewUrl || captionLength(captionSnapshot) > MAX_CAPTION_LENGTH) {
    throw new Error('smart_space_publication_identity_incomplete')
  }
  return {
    sourceType,
    sourceId,
    mediaAssetId: sourceId,
    optionId: OPTION_ID,
    optionLabel: text(field?.label) || 'Legenda sugerida',
    captionSnapshot,
    captionPlaceholder: '',
    mediaName: sourceType === 'smart_space_life' ? 'Vida no Imóvel' : 'Apresentação pelo Corretor',
    mediaPreviewUrl: campaign.previewUrl,
    mediaType: 'video',
  }
}

const toPending = intent => ({
  sourceType: text(intent?.sourceType),
  sourceId: text(intent?.sourceId),
  mediaAssetId: text(intent?.mediaAssetId),
  captionSnapshot: caption(intent?.captionSnapshot),
})

export function preservePendingSmartSpacePublication(storage, userId, intent) {
  if (!storage || !text(userId)) return false
  const pending = toPending(intent)
  if (!validIdentity(pending) || captionLength(pending.captionSnapshot) > MAX_CAPTION_LENGTH) return false
  try { storage.setItem(pendingKey(userId), JSON.stringify(pending)); return true } catch { return false }
}

export function readPendingSmartSpacePublication(storage, userId) {
  if (!storage || !text(userId)) return null
  try {
    const pending = toPending(JSON.parse(storage.getItem(pendingKey(userId)) || 'null'))
    return validIdentity(pending) && captionLength(pending.captionSnapshot) <= MAX_CAPTION_LENGTH ? pending : null
  } catch { return null }
}

export function clearPendingSmartSpacePublication(storage, userId) {
  if (!storage || !text(userId)) return false
  try { storage.removeItem(pendingKey(userId)); return true } catch { return false }
}

export function restorePendingSmartSpacePublication({ result, pending } = {}) {
  if (!pending) return null
  try {
    const [, stageKind = ''] = text(pending.mediaAssetId).split(':')
    const stage = result?.stages?.find(item => item.kind === stageKind)
    const intent = pending.sourceType === VIDEO_SOURCE_TYPE
      ? buildSmartSpaceVideoPublicationIntent({ clientRequestId: result?.clientRequestId, itemIndex: result?.originalIndex, previewUrl: result?.video?.signedUrl })
      : buildSmartSpaceImagePublicationIntent({ clientRequestId: result?.clientRequestId, itemIndex: result?.originalIndex, stageKind, stageLabel: stage?.label, previewUrl: stage?.url })
    return intent.sourceType === pending.sourceType && intent.sourceId === pending.sourceId && intent.mediaAssetId === pending.mediaAssetId
      ? { ...intent, captionSnapshot: pending.captionSnapshot } : null
  } catch { return null }
}

export function restorePendingSmartSpaceCampaignPublication({ campaign, pending } = {}) {
  if (!campaign || !pending || !CAMPAIGN_SOURCE_TYPES.has(pending.sourceType)) return null
  const field = campaign.modules?.flatMap(module => module.id === 'social' ? (module.fields || []) : [])[0]
  try {
    const intent = buildSmartSpaceCampaignPublicationIntent({ campaign, field })
    return intent.sourceType === pending.sourceType && intent.sourceId === pending.sourceId && intent.mediaAssetId === pending.mediaAssetId
      ? { ...intent, captionSnapshot: pending.captionSnapshot } : null
  } catch { return null }
}

const normalizeDestinations = destinations => {
  const normalized = [...new Set(Array.isArray(destinations) ? destinations.map(text) : [])]
  if (!normalized.length || normalized.some(destination => !DESTINATIONS.has(destination))) throw new Error('smart_space_publication_destinations_invalid')
  return normalized
}

export function buildSmartSpacePublicationRequest(intent, destinations, action = 'publish') {
  const identity = { sourceType: text(intent?.sourceType), sourceId: text(intent?.sourceId), mediaAssetId: text(intent?.mediaAssetId) }
  const captionSnapshot = caption(intent?.captionSnapshot)
  if (!validIdentity(identity) || text(intent?.optionId) !== OPTION_ID || captionLength(captionSnapshot) > MAX_CAPTION_LENGTH) {
    throw new Error('smart_space_publication_identity_incomplete')
  }
  return {
    action,
    source: { type: identity.sourceType, id: identity.sourceId },
    media_asset_id: text(intent.mediaAssetId),
    option_id: OPTION_ID,
    caption_snapshot: captionSnapshot,
    destinations: normalizeDestinations(destinations),
  }
}

const invoke = async (client, intent, destinations, action) => {
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (sessionError || !accessToken) throw new Error('smart_space_publication_session_required')
  const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
    body: buildSmartSpacePublicationRequest(intent, destinations, action),
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error || !data?.ok || !Array.isArray(data.results) || data.smart_tokens !== 0) {
    throw new Error(text(data?.code) || 'smart_space_publication_unavailable')
  }
  return data
}

export const publishSmartSpacePublication = (client, intent, destinations) => invoke(client, intent, destinations, 'publish')
export const recoverSmartSpacePublication = (client, intent, destinations) => invoke(client, intent, destinations, 'recovery')

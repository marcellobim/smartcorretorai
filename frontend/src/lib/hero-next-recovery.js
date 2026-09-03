const HERO_NEXT_RECOVERY_PREFIX = 'smartcorretorai:hero-next:recovery:v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const recoveryKey = (userId) => `${HERO_NEXT_RECOVERY_PREFIX}:${String(userId || '').trim()}`
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const asText = (value) => typeof value === 'string' ? value.trim() : ''

export function readHeroNextRecovery(storage, userId) {
  if (!storage || !userId) return null
  try {
    const parsed = JSON.parse(storage.getItem(recoveryKey(userId)) || 'null')
    if (!parsed || parsed.userId !== userId || !UUID_PATTERN.test(String(parsed.clientRequestId || ''))) return null
    return { userId, clientRequestId: parsed.clientRequestId, status: parsed.status === 'completed' ? 'completed' : 'processing' }
  } catch {
    return null
  }
}

export function writeHeroNextRecovery(storage, userId, clientRequestId, status = 'processing') {
  if (!storage || !userId || !UUID_PATTERN.test(String(clientRequestId || ''))) return false
  try {
    storage.setItem(recoveryKey(userId), JSON.stringify({
      userId,
      clientRequestId,
      status: status === 'completed' ? 'completed' : 'processing',
    }))
    return true
  } catch {
    return false
  }
}

export function clearHeroNextRecovery(storage, userId) {
  if (!storage || !userId) return
  try { storage.removeItem(recoveryKey(userId)) } catch { /* Persistence is best effort. */ }
}

export function materializeHeroNextResult(jobs, campaignCopy = [], identity = {}) {
  const normalizedJobs = Array.isArray(jobs)
    ? jobs.filter(Boolean).map((job, index) => {
      const source = asObject(job)
      return {
        ...source,
        jobId: asText(source.jobId || source.piece_id) || `hero-recovered-${index + 1}`,
        formatId: asText(source.formatId || source.format_id),
        formatLabel: asText(source.formatLabel || source.format_label) || `Arte ${index + 1}`,
        generationId: asText(source.generationId || source.generation_id) || null,
        ideaNumber: Number(source.ideaNumber || source.creation_option) || 1,
        status: asText(source.status) || 'failed',
        imageUrl: asText(source.imageUrl || source.image_url || source.previewUrl || source.preview_url || source.downloadUrl || source.download_url) || null,
        texts: asObject(source.texts),
        error: source.error || null,
      }
    })
    : []
  const firstCompleted = normalizedJobs.find((job) => job?.status === 'completed' && typeof job.imageUrl === 'string' && job.imageUrl)
  if (!firstCompleted) throw new Error('hero_next_completed_result_missing_image')
  return {
    sourceId: asText(identity.sourceId),
    jobs: normalizedJobs,
    imageUrl: firstCompleted.imageUrl,
    texts: firstCompleted.texts && typeof firstCompleted.texts === 'object' ? firstCompleted.texts : {},
    campaignCopy: Array.isArray(campaignCopy) ? campaignCopy : [],
  }
}

export function normalizeHeroNextRecoveryPayload(payload) {
  const source = asObject(payload)
  if (source.success !== true || !Array.isArray(source.items)) {
    throw new Error('hero_next_recovery_payload_invalid')
  }
  return {
    clientRequestId: asText(source.client_request_id),
    requestId: asText(source.request_id),
    status: asText(source.status) || 'unknown',
    found: source.found !== false,
    jobs: source.items.map((item) => ({ ...asObject(item) })),
  }
}

export function buildHeroNextCampaignPackageData({
  result,
  campaignCopy = [],
  context = {},
  buildGoogleAds,
  googleAdsInput,
  creationOptionLabel,
} = {}) {
  if (!result || !Array.isArray(result.jobs)) {
    return { data: null, error: 'hero_next_campaign_result_invalid', warning: '' }
  }
  const files = result.jobs
    .filter((job) => job?.status === 'completed' && asText(job?.imageUrl))
    .map((job, index) => ({
      id: asText(job.jobId) || `${asText(job.formatId) || 'hero'}-${index}`,
      name: `${asText(job.formatLabel) || `Arte ${index + 1}`}${job.ideaNumber && typeof creationOptionLabel === 'function' ? ` · ${creationOptionLabel(job.ideaNumber)}` : ''}`,
      type: 'image',
      status: 'Concluída',
      previewUrl: asText(job.imageUrl),
      downloadUrl: asText(job.imageUrl),
      assetId: asText(job.pieceId || job.jobId),
      optionId: `banner-caption-option-${Number(job.ideaNumber) || index + 1}`,
      optionNumber: Number(job.ideaNumber) || index + 1,
    }))
  if (!files.length) return { data: null, error: 'hero_next_campaign_media_missing', warning: '' }

  let googleAds = null
  let warning = ''
  if (typeof buildGoogleAds === 'function') {
    try {
      googleAds = buildGoogleAds(asObject(googleAdsInput))
    } catch (error) {
      warning = error instanceof Error ? error.message : 'hero_next_optional_copy_unavailable'
    }
  }
  const safeCopy = Array.isArray(campaignCopy) ? campaignCopy : []
  const safeContext = asObject(context)
  return {
    data: {
      sourceProduct: 'Banner Imobiliário',
      sourceType: 'banner_imobiliario',
      sourceId: asText(result.sourceId),
      mediaType: 'images',
      files,
      purpose: asText(safeContext.purpose),
      propertyType: asText(safeContext.propertyType),
      neighborhood: asText(safeContext.neighborhood),
      city: asText(safeContext.city),
      bedrooms: asText(safeContext.bedrooms),
      suites: asText(safeContext.suites),
      parking: asText(safeContext.parking),
      area: asText(safeContext.area),
      highlights: Array.isArray(safeContext.highlights) ? safeContext.highlights : [],
      cta: asText(safeContext.cta),
      contactAuthorized: Boolean(safeContext.contactAuthorized && asText(safeContext.phone)),
      phone: asText(safeContext.phone),
      existingTexts: safeCopy.map((item, index) => ({
        id: `banner-caption-option-${index + 1}`,
        label: asText(item?.label) || `Texto ${index + 1}`,
        text: asText(item?.text),
      })).filter((item) => item.text),
      googleAds,
    },
    error: null,
    warning,
  }
}

export function buildHeroNextRecoveryRequest(storedRecovery) {
  if (storedRecovery?.clientRequestId) {
    return {
      action: 'recover_batch',
      client_request_id: storedRecovery.clientRequestId,
      discovery: false,
    }
  }
  return {
    action: 'discover_recoverable_batch',
    discovery: true,
  }
}

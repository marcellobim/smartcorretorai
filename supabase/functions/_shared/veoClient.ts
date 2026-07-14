type StartVeoInput = {
  prompt: string
  image1Path?: string
  image2Path?: string
  aspectRatio: string
  durationSeconds: number
  resolution: string
  modelId?: string
  userId: string
  jobId: string
  bucket: string
  supabase: StorageDownloadClient
}

type CheckVeoResult =
  | { status: 'processing' }
  | { status: 'completed'; videoBytes: Uint8Array; contentType: string; videoUri?: string }
  | { status: 'failed'; errorMessage: string }

type StorageDownloadClient = {
  storage: {
    from(bucket: string): {
      download(path: string): Promise<{
        data: Blob | null
        error: { message?: string } | null
      }>
    }
  }
}

type PreparedVeoImage = {
  mimeType: string
  bytesBase64Encoded: string
  byteLength: number
  base64Length: number
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_VEO_MODEL = 'veo-3.1-lite-generate-preview'

function base64ToBytes(value: string) {
  const clean = value.includes(',') ? value.split(',').pop() || '' : value
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    for (const byte of chunk) binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function normalizeImageMimeType(path: string, detectedType: string) {
  const mimeType = detectedType.toLowerCase().trim()
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') return mimeType
  if (mimeType === 'image/jpg') return 'image/jpeg'

  const extension = path.split('.').pop()?.toLowerCase() || ''
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'

  if (mimeType === 'image/webp' || extension === 'webp') {
    throw new Error('veo_unsupported_image_mime:image/webp')
  }

  throw new Error(`veo_unsupported_image_mime:${mimeType || extension || 'unknown'}`)
}

async function prepareVeoImage(
  supabase: StorageDownloadClient,
  bucket: string,
  path: string,
): Promise<PreparedVeoImage> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) {
    throw new Error(`veo_image_download_failed:${error?.message || 'empty_file'}`)
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  if (!bytes.byteLength) throw new Error('veo_image_download_empty')

  const mimeType = normalizeImageMimeType(path, data.type || '')
  const bytesBase64Encoded = bytesToBase64(bytes)

  return {
    mimeType,
    bytesBase64Encoded,
    byteLength: bytes.byteLength,
    base64Length: bytesBase64Encoded.length,
  }
}

function getVeoEnvironment(options: { requireEnabled?: boolean } = {}) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const modelId = Deno.env.get('VEO_MODEL_ID') || DEFAULT_VEO_MODEL

  if (options.requireEnabled !== false && Deno.env.get('VEO_ENABLED') !== 'true') {
    throw new Error('veo_disabled')
  }
  if (!apiKey) {
    throw new Error('veo_missing_environment')
  }

  return { apiKey, modelId }
}

function withApiKey(url: string, apiKey: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`
}

function buildModelUrl(modelId: string, method: 'predictLongRunning' | 'fetchPredictOperation', apiKey: string) {
  return withApiKey(`${GEMINI_API_BASE}/models/${modelId}:${method}`, apiKey)
}

function buildOperationUrl(operationName: string, apiKey: string) {
  const clean = operationName.replace(/^\/+/, '')
  if (/^https?:\/\//i.test(clean)) return withApiKey(clean, apiKey)
  return withApiKey(`${GEMINI_API_BASE}/${clean}`, apiKey)
}

function findStringByKey(value: unknown, keys: Set<string>): string {
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys)
      if (found) return found
    }
    return ''
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key) && typeof nested === 'string' && nested.trim()) {
      return nested.trim()
    }
    const found = findStringByKey(nested, keys)
    if (found) return found
  }
  return ''
}

async function fetchVideoUri(uri: string, apiKey: string) {
  if (uri.startsWith('gs://')) {
    throw new Error('video_uri_requires_signed_download')
  }

  const response = await fetch(withApiKey(uri, apiKey), {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`video_download_failed:${response.status}:${body.slice(0, 160)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

export async function startVeoVideo(input: StartVeoInput): Promise<{ providerJobId: string }> {
  const environment = getVeoEnvironment()
  const apiKey = environment.apiKey
  const modelId = input.modelId || environment.modelId
  const [openingImage, finalImage] = await Promise.all([
    input.image1Path ? prepareVeoImage(input.supabase, input.bucket, input.image1Path) : Promise.resolve(null),
    input.image2Path ? prepareVeoImage(input.supabase, input.bucket, input.image2Path) : Promise.resolve(null),
  ])

  const endpoint = buildModelUrl(modelId, 'predictLongRunning', apiKey)
  const instance: Record<string, unknown> = {
    prompt: input.prompt,
  }
  if (openingImage) {
    instance.image = {
      mimeType: openingImage.mimeType,
      bytesBase64Encoded: openingImage.bytesBase64Encoded,
    }
  }
  if (finalImage) {
    instance.lastFrame = {
      mimeType: finalImage.mimeType,
      bytesBase64Encoded: finalImage.bytesBase64Encoded,
    }
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: input.resolution,
      sampleCount: 1,
    },
  }

  console.info('[studioHeroVideo] payload preparado', {
    endpoint: 'predictLongRunning',
    modelId,
    imageCount: [openingImage, finalImage].filter(Boolean).length,
    promptLength: input.prompt.length,
    hasOpeningImage: Boolean(openingImage),
    hasLastFrame: Boolean(finalImage),
    openingImage: openingImage ? {
      mimeType: openingImage.mimeType,
      byteLength: openingImage.byteLength,
      base64Length: openingImage.base64Length,
    } : null,
    finalImage: finalImage ? {
      mimeType: finalImage.mimeType,
      byteLength: finalImage.byteLength,
      base64Length: finalImage.base64Length,
    } : null,
    parameters: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: input.resolution,
      sampleCount: 1,
    },
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`veo_start_failed:${response.status}:${body.slice(0, 240)}`)
  }

  const data = await response.json()
  const providerJobId = typeof data.name === 'string' ? data.name : ''
  if (!providerJobId) throw new Error('veo_provider_job_empty')
  return { providerJobId }
}

export async function checkVeoVideoStatus(providerJobId: string): Promise<CheckVeoResult> {
  const { apiKey } = getVeoEnvironment({ requireEnabled: false })
  const endpoint = buildOperationUrl(providerJobId, apiKey)

  const response = await fetch(endpoint)

  if (!response.ok) {
    const body = await response.text()
    return { status: 'failed', errorMessage: `veo_status_failed:${response.status}:${body.slice(0, 160)}` }
  }

  const data = await response.json()
  if (data.done === false || (!data.done && !data.response && !data.error) || data.metadata?.state === 'PROCESSING') {
    return { status: 'processing' }
  }
  if (data.error) {
    return {
      status: 'failed',
      errorMessage: String(data.error.message || data.error.code || 'veo_job_failed').slice(0, 500),
    }
  }

  const videoBase64 = findStringByKey(data, new Set([
    'videoBytes',
    'video_bytes',
    'bytesBase64',
    'bytesBase64Encoded',
    'base64',
  ]))
  if (videoBase64) {
    return { status: 'completed', videoBytes: base64ToBytes(videoBase64), contentType: 'video/mp4' }
  }

  const videoUri = findStringByKey(data, new Set([
    'videoUri',
    'video_uri',
    'gcsUri',
    'gcs_uri',
    'uri',
  ]))
  if (videoUri) {
    const videoBytes = await fetchVideoUri(videoUri, apiKey)
    return { status: 'completed', videoBytes, contentType: 'video/mp4', videoUri }
  }

  return { status: 'failed', errorMessage: 'video_result_missing' }
}

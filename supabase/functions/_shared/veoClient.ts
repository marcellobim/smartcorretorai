type StartVeoInput = {
  prompt: string
  image1Path: string
  image2Path: string
  aspectRatio: string
  durationSeconds: number
  resolution: string
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

const textEncoder = new TextEncoder()

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

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

async function importPrivateKey(pem: string) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function getVertexEnvironment() {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || ''
  const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us-central1'
  const modelId = Deno.env.get('VEO_MODEL_ID') || 'veo-3.1-fast-generate-001'
  const serviceAccountJson =
    Deno.env.get('VERTEX_SERVICE_ACCOUNT_JSON') ||
    Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON') ||
    ''

  if (Deno.env.get('VEO_ENABLE_VERTEX_CALLS') !== 'true') {
    throw new Error('veo_not_configured')
  }
  if (!projectId || !serviceAccountJson) {
    throw new Error('veo_missing_environment')
  }

  return { projectId, location, modelId, serviceAccountJson }
}

async function getAccessToken(serviceAccountJson: string) {
  const serviceAccount = JSON.parse(serviceAccountJson)
  const clientEmail = String(serviceAccount.client_email || '')
  const privateKey = String(serviceAccount.private_key || '').replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) throw new Error('service_account_invalid')

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const unsigned = `${base64UrlEncode(textEncoder.encode(JSON.stringify(header)))}.${base64UrlEncode(textEncoder.encode(JSON.stringify(claim)))}`
  const key = await importPrivateKey(privateKey)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, textEncoder.encode(unsigned))
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`token_exchange_failed:${response.status}:${body.slice(0, 160)}`)
  }

  const data = await response.json()
  const token = typeof data.access_token === 'string' ? data.access_token : ''
  if (!token) throw new Error('token_exchange_empty')
  return token
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

async function fetchVideoUri(uri: string, accessToken: string) {
  const response = await fetch(uri, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`video_download_failed:${response.status}:${body.slice(0, 160)}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

export async function startVeoVideo(input: StartVeoInput): Promise<{ providerJobId: string }> {
  const { projectId, location, modelId, serviceAccountJson } = getVertexEnvironment()
  const [openingImage, finalImage] = await Promise.all([
    prepareVeoImage(input.supabase, input.bucket, input.image1Path),
    prepareVeoImage(input.supabase, input.bucket, input.image2Path),
  ])

  const accessToken = await getAccessToken(serviceAccountJson)
  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`
  const requestBody = {
    instances: [
      {
        prompt: input.prompt,
        image: {
          mimeType: openingImage.mimeType,
          bytesBase64Encoded: openingImage.bytesBase64Encoded,
        },
        lastFrame: {
          mimeType: finalImage.mimeType,
          bytesBase64Encoded: finalImage.bytesBase64Encoded,
        },
      },
    ],
    parameters: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: input.resolution,
      sampleCount: 1,
      task: 'imageToVideo',
      resizeMode: 'pad',
      generateAudio: true,
      enhancePrompt: true,
    },
  }

  console.info('[veoClient] estrutura do payload preparada', {
    endpoint: 'predictLongRunning',
    task: requestBody.parameters.task,
    modelId,
    imageCount: 2,
    openingImage: {
      mimeType: openingImage.mimeType,
      byteLength: openingImage.byteLength,
      base64Length: openingImage.base64Length,
    },
    finalImage: {
      mimeType: finalImage.mimeType,
      byteLength: finalImage.byteLength,
      base64Length: finalImage.base64Length,
    },
    parameters: requestBody.parameters,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  const { location, serviceAccountJson } = getVertexEnvironment()
  const accessToken = await getAccessToken(serviceAccountJson)
  const endpoint = /^https?:\/\//i.test(providerJobId)
    ? providerJobId
    : `https://${location}-aiplatform.googleapis.com/v1/${providerJobId.replace(/^\/+/, '')}`

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text()
    return { status: 'failed', errorMessage: `veo_status_failed:${response.status}:${body.slice(0, 160)}` }
  }

  const data = await response.json()
  if (data.done === false || data.metadata?.state === 'PROCESSING') {
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
    const videoBytes = await fetchVideoUri(videoUri, accessToken)
    return { status: 'completed', videoBytes, contentType: 'video/mp4', videoUri }
  }

  return { status: 'failed', errorMessage: 'video_result_missing' }
}

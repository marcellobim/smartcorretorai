type StorageClient = { storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }> } } }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
export type GeminiInlineImage = { type: 'image'; data: string; mime_type: 'image/jpeg' | 'image/png' }
type GeminiOmniAspectRatio = '9:16' | '16:9'
type StartInput = { prompt: string; images: GeminiInlineImage[]; aspectRatio?: GeminiOmniAspectRatio }
type InlineStartInput = StartInput & { fetchImpl?: FetchLike; timeoutMs?: number }
export type GeminiVideoReference = { type: 'video'; uri: string; mime_type: 'video/mp4' }
export type GeminiVideoRangeSource = {
  size: number
  mimeType: 'video/mp4'
  readRange(start: number, endInclusive: number): Promise<Uint8Array>
}
export type ShortVideoRangeOptions = {
  size: number
  mimeType: 'video/mp4'
  storageUrl: string
  storageKey: string
  fetchImpl?: FetchLike
  googleApiKey?: string
}
type ShortVideoStartInput = { prompt: string; video: GeminiVideoReference }
type CheckResult = { status: 'processing' } | { status: 'completed'; videoBytes: Uint8Array; contentType: string; delivery: 'base64' | 'uri' } | { status: 'failed'; errorMessage: string }
export type GeminiOmniErrorDiagnostic = {
  source: 'sse' | 'http'
  eventType: '' | 'error' | 'interaction.failed' | 'interaction.completed'
  code: string
  errorStatus: string
  errorType: string
  httpStatus: number | null
  message: string
  retryable: boolean
}
export type GeminiOmniStreamResult =
  | { status: 'processing'; lastEventId: string }
  | { status: 'completed'; videoUri: string; contentType: string; delivery: 'uri'; lastEventId: string }
  | { status: 'failed'; diagnostic: GeminiOmniErrorDiagnostic; lastEventId: string }
export type GeminiOmniStreamState = { interactionId: string; lastEventId: string; videoUri: string; contentType: string }

export const SMART_TOUR_GEMINI_OMNI_MODEL = 'gemini-omni-flash-preview'
export const SMART_TOUR_GEMINI_OMNI_API_VERSION = 'v1beta'
export const SMART_TOUR_GEMINI_OMNI_DURATION = '10s'
export const SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL = 'high'
export const SMART_TOUR_GEMINI_OMNI_MAX_OUTPUT_TOKENS = 65_536
export const SMART_TOUR_GEMINI_OMNI_INLINE_TIMEOUT_MS = 110_000
const API_BASE = `https://generativelanguage.googleapis.com/${SMART_TOUR_GEMINI_OMNI_API_VERSION}`
const GEMINI_OMNI_SSE_RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const GEMINI_OMNI_HTTP_RETRYABLE_STATUSES = new Set([404, 408, 409, 425, 429, 500, 502, 503, 504])
const GEMINI_OMNI_RETRYABLE_CODES = new Set([
  'deadline_exceeded',
  'internal',
  'rate_limit_exceeded',
  'request_timeout',
  'resource_exhausted',
  'service_unavailable',
  'unavailable',
])
const GEMINI_OMNI_HTTP_ERROR_BODY_MAX_LENGTH = 64 * 1024
const GEMINI_OMNI_VIDEO_ORIGIN = 'https://generativelanguage.googleapis.com'

function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary) }
function base64ToBytes(value: string) { const binary = atob(value.includes(',') ? value.split(',').at(-1) || '' : value); return Uint8Array.from(binary, character => character.charCodeAt(0)) }
async function prepareImage(supabase: StorageClient, bucket: string, path: string): Promise<GeminiInlineImage> { const { data, error } = await supabase.storage.from(bucket).download(path); if (error || !data) throw new Error('gemini_omni_image_unavailable'); const bytes = new Uint8Array(await data.arrayBuffer()); if (!bytes.length) throw new Error('gemini_omni_image_empty'); const extension = path.split('.').at(-1)?.toLowerCase(); return { type: 'image', data: bytesToBase64(bytes), mime_type: data.type === 'image/png' || extension === 'png' ? 'image/png' : 'image/jpeg' } }

export function prepareGeminiImages(supabase: StorageClient, bucket: string, imagePaths: string[]) { return Promise.all(imagePaths.map(path => prepareImage(supabase, bucket, path))) }

export function buildGeminiOmniRequestBody(prompt: string, images: Array<{ type: string; data: string; mime_type: string }>, aspectRatio?: GeminiOmniAspectRatio) {
  return { model: SMART_TOUR_GEMINI_OMNI_MODEL, input: [...images, { type: 'text', text: prompt }], response_format: { type: 'video', duration: SMART_TOUR_GEMINI_OMNI_DURATION, delivery: 'uri', ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }, generation_config: { thinking_level: SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL }, background: true, store: true }
}
export function buildGeminiOmniInlineRequestBody(prompt: string, images: Array<{ type: string; data: string; mime_type: string }>, aspectRatio?: GeminiOmniAspectRatio) {
  return {
    model: SMART_TOUR_GEMINI_OMNI_MODEL,
    input: [...images, { type: 'text', text: prompt }],
    generation_config: {
      max_output_tokens: SMART_TOUR_GEMINI_OMNI_MAX_OUTPUT_TOKENS,
      thinking_level: SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL,
    },
    response_modalities: ['video'],
    response_format: {
      type: 'video',
      duration: SMART_TOUR_GEMINI_OMNI_DURATION,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    },
  }
}
export function buildGeminiOmniShortVideoRequestBody(prompt: string, video: GeminiVideoReference) {
  return {
    model: SMART_TOUR_GEMINI_OMNI_MODEL,
    input: [video, { type: 'text', text: prompt }],
    response_format: { type: 'video', delivery: 'uri' },
    generation_config: { thinking_level: SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL, video_config: { task: 'edit' } },
    background: true,
    store: true,
  }
}
function getEnvironment() {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  if (!apiKey) throw new Error('gemini_omni_missing_environment')
  return apiKey
}

function errorRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function safeDiagnosticToken(value: unknown) {
  const token = String(value ?? '').trim()
  if (!/^[a-z0-9_.:-]{1,64}$/i.test(token)) return ''
  if (/^(?:AIza|eyJ)|(?:api[_-]?key|authorization|bearer|token)/i.test(token)) return ''
  return token
}

function safeHttpStatus(...values: unknown[]) {
  for (const value of values) {
    const status = typeof value === 'number' ? value : /^\d{3}$/.test(String(value || '')) ? Number(value) : NaN
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status
  }
  return null
}

function sanitizeGeminiOmniDiagnosticMessage(value: unknown) {
  const source = String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  if (/\b(?:prompt|briefing|phone|telefone|image|images|image_url|base64|gemini_api_key|supabase_service_role_key|service[_-]?role|api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|signed[_-]?url|credential|password|secret|token)\b["']?\s*[:=]/i.test(source)) {
    return '[provider-detail-redacted]'
  }
  return source
    .replace(/https?:\/\/[^\s"']+/gi, '[url-redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email-redacted]')
    .replace(/\bAIza[A-Za-z0-9_-]{16,}\b/g, '[secret-redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[secret-redacted]')
    .replace(/\b(?:GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|api[_-]?key|authorization|token)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [secret-redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone-redacted]')
    .replace(/(?:data:[^;,\s]+;base64,)?[A-Za-z0-9+/_=-]{80,}/g, '[data-redacted]')
    .replace(/\b(?:prompt|briefing)\s*[:=]\s*[^,;]+/gi, '[detail-redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function findGeminiOmniError(payload: Record<string, unknown>) {
  const interaction = errorRecord(payload.interaction)
  const direct = errorRecord(payload.error)
  const nested = errorRecord(interaction.error)
  const errors = Array.isArray(payload.errors) ? payload.errors : Array.isArray(interaction.errors) ? interaction.errors : []
  return Object.keys(direct).length ? direct : Object.keys(nested).length ? nested : errorRecord(errors[0])
}

function buildGeminiOmniDiagnostic(
  source: 'sse' | 'http',
  eventType: GeminiOmniErrorDiagnostic['eventType'],
  payload: Record<string, unknown>,
  explicitHttpStatus: number | null,
) {
  const interaction = errorRecord(payload.interaction)
  const error = findGeminiOmniError(payload)
  const code = safeDiagnosticToken(error.code ?? payload.code ?? interaction.code)
  const errorStatus = safeDiagnosticToken(error.status ?? payload.status ?? interaction.status)
  const errorType = safeDiagnosticToken(error.type ?? payload.type ?? interaction.type)
  const httpStatus = safeHttpStatus(
    explicitHttpStatus,
    error.http_status,
    error.status_code,
    payload.http_status,
    payload.status_code,
    error.code,
  )
  const normalizedCodes = [code, errorStatus, errorType].map(value => value.toLowerCase()).filter(Boolean)
  const retryable = eventType !== 'interaction.failed' && eventType !== 'interaction.completed' && (
    httpStatus !== null
      ? (source === 'http' ? GEMINI_OMNI_HTTP_RETRYABLE_STATUSES : GEMINI_OMNI_SSE_RETRYABLE_HTTP_STATUSES).has(httpStatus)
      : source === 'sse' && eventType === 'error' && normalizedCodes.some(value => GEMINI_OMNI_RETRYABLE_CODES.has(value))
  )
  return {
    source,
    eventType,
    code,
    errorStatus,
    errorType,
    httpStatus,
    message: sanitizeGeminiOmniDiagnosticMessage(error.message ?? payload.message ?? interaction.message),
    retryable,
  } satisfies GeminiOmniErrorDiagnostic
}

export function classifyGeminiOmniSseError(eventType: 'error' | 'interaction.failed', payload: Record<string, unknown>) {
  return buildGeminiOmniDiagnostic('sse', eventType, payload, null)
}

export function classifyGeminiOmniHttpError(httpStatus: number, body: string) {
  let payload: Record<string, unknown> = {}
  const rawBody = String(body || '')
  if (rawBody.length <= GEMINI_OMNI_HTTP_ERROR_BODY_MAX_LENGTH) {
    try { payload = errorRecord(JSON.parse(rawBody)) } catch { payload = { message: rawBody.slice(0, 180) } }
  }
  return buildGeminiOmniDiagnostic('http', '', payload, httpStatus)
}

class GeminiOmniPollingHttpError extends Error {
  readonly diagnostic: GeminiOmniErrorDiagnostic

  constructor(diagnostic: GeminiOmniErrorDiagnostic) {
    super(`gemini_omni_poll_http_error:${diagnostic.httpStatus || 'unknown'}`)
    this.name = 'GeminiOmniPollingHttpError'
    this.diagnostic = diagnostic
  }
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: { errorMode?: 'legacy' | 'polling' } = {},
) {
  const errorMode = options.errorMode || 'legacy'
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'x-goog-api-key': getEnvironment(), ...(init.headers || {}) } })
  if (!response.ok) {
    const body = await response.text()
    if (errorMode === 'polling') throw new GeminiOmniPollingHttpError(classifyGeminiOmniHttpError(response.status, body))
    const diagnostic = classifyGeminiOmniHttpError(response.status, body)
    throw new Error(`gemini_omni_api_failed:${response.status}:${diagnostic.message}`)
  }
  return response
}
async function createGeminiInteraction(body: unknown) { const response = await apiFetch('/interactions', { method: 'POST', body: JSON.stringify(body) }); return response.json() }

const GEMINI_FILE_NAME_PATTERN = /^files\/[a-z0-9-]{1,40}$/
export const GEMINI_VIDEO_DEFAULT_MAX_BYTES = 50 * 1024 * 1024
export const GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES = 250 * 1024 * 1024
export type GeminiVideoSizeProfile = 'default' | 'short-videos'
const GEMINI_FILE_PROCESSING_TIMEOUT_MS = 180_000
export const GEMINI_VIDEO_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
const GOOGLE_UPLOAD_DEFAULT_CHUNK_GRANULARITY = 256 * 1024

export function resolveGeminiVideoMaxBytes(profile: GeminiVideoSizeProfile = 'default') {
  if (profile === 'default') return GEMINI_VIDEO_DEFAULT_MAX_BYTES
  if (profile === 'short-videos') return GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES
  throw new Error('gemini_omni_video_size_profile_invalid')
}

export function validateGeminiVideoSize(size: number, profile: GeminiVideoSizeProfile = 'default') {
  if (!Number.isFinite(size) || size <= 0) throw new Error('gemini_omni_video_empty')
  if (size > resolveGeminiVideoMaxBytes(profile)) throw new Error('gemini_omni_video_too_large')
}

function parseGeminiFile(value: unknown) {
  const envelope = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const raw = envelope.file && typeof envelope.file === 'object' ? envelope.file as Record<string, unknown> : envelope
  const name = typeof raw.name === 'string' ? raw.name : ''
  const uri = typeof raw.uri === 'string' ? raw.uri : ''
  const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType : typeof raw.mime_type === 'string' ? raw.mime_type : ''
  const state = String(raw.state || '').toUpperCase()
  if (!GEMINI_FILE_NAME_PATTERN.test(name)) throw new Error('gemini_omni_video_file_invalid')
  return { name, uri, mimeType, state }
}

async function uploadGeminiVideoFile(blob: Blob) {
  const startedAt = Date.now()
  const startResponse = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': getEnvironment(),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(blob.size),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'smart-tour-short-video-input' } }),
  })
  if (!startResponse.ok) throw new Error(`gemini_omni_file_upload_failed:${startResponse.status}`)
  const uploadUrl = startResponse.headers.get('x-goog-upload-url') || ''
  if (!/^https:\/\/[^/]*googleapis\.com\//i.test(uploadUrl)) throw new Error('gemini_omni_file_upload_url_invalid')
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(blob.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': 'video/mp4',
    },
    body: blob,
  })
  if (!uploadResponse.ok) throw new Error(`gemini_omni_file_upload_failed:${uploadResponse.status}`)
  const file = parseGeminiFile(await uploadResponse.json())
  return { ...file, uploadDurationMs: Date.now() - startedAt }
}

function getGoogleUploadSessionUrl(response: Response) {
  const uploadUrl = response.headers.get('x-goog-upload-url') || ''
  if (!/^https:\/\/[^/]*googleapis\.com\//i.test(uploadUrl)) throw new Error('gemini_omni_file_upload_url_invalid')
  return uploadUrl
}

async function startGeminiVideoUpload(size: number, fetchImpl: FetchLike, apiKey: string) {
  const response = await fetchImpl('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(size),
      'X-Goog-Upload-Header-Content-Type': 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'smart-tour-short-video-input' } }),
  })
  if (!response.ok) throw new Error(`gemini_omni_file_upload_failed:${response.status}`)
  const granularity = Number(response.headers.get('x-goog-upload-chunk-granularity') || GOOGLE_UPLOAD_DEFAULT_CHUNK_GRANULARITY)
  if (!Number.isInteger(granularity) || granularity <= 0 || GEMINI_VIDEO_UPLOAD_CHUNK_BYTES % granularity !== 0) {
    throw new Error('gemini_omni_file_upload_granularity_invalid')
  }
  return { uploadUrl: getGoogleUploadSessionUrl(response), granularity }
}

export async function uploadGeminiVideoFileInChunks(
  source: GeminiVideoRangeSource,
  options: { fetchImpl?: FetchLike; apiKey?: string } = {},
) {
  validateGeminiVideoSize(source.size, 'short-videos')
  if (source.mimeType !== 'video/mp4') throw new Error('gemini_omni_video_type_invalid')
  const fetchImpl = options.fetchImpl || fetch
  const apiKey = options.apiKey || getEnvironment()
  const startedAt = Date.now()
  const { uploadUrl } = await startGeminiVideoUpload(source.size, fetchImpl, apiKey)
  let offset = 0
  let finalFile: ReturnType<typeof parseGeminiFile> | null = null

  while (offset < source.size) {
    const endInclusive = Math.min(source.size - 1, offset + GEMINI_VIDEO_UPLOAD_CHUNK_BYTES - 1)
    const expectedBytes = endInclusive - offset + 1
    const chunk = await source.readRange(offset, endInclusive)
    if (chunk.byteLength !== expectedBytes) throw new Error('gemini_omni_video_chunk_size_invalid')
    const isFinal = endInclusive + 1 === source.size
    const response = await fetchImpl(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(chunk.byteLength),
        'X-Goog-Upload-Offset': String(offset),
        'X-Goog-Upload-Command': isFinal ? 'upload, finalize' : 'upload',
        'Content-Type': 'video/mp4',
      },
      body: chunk as unknown as BodyInit,
    })
    if (!response.ok) throw new Error(`gemini_omni_file_upload_failed:${response.status}`)
    const receivedSize = response.headers.get('x-goog-upload-size-received')
    if (receivedSize && Number(receivedSize) !== endInclusive + 1) throw new Error('gemini_omni_file_upload_offset_invalid')
    if (isFinal) finalFile = parseGeminiFile(await response.json())
    offset = endInclusive + 1
  }

  if (!finalFile || offset !== source.size) throw new Error('gemini_omni_file_upload_incomplete')
  return { ...finalFile, uploadDurationMs: Date.now() - startedAt, uploadedBytes: offset }
}

function encodeStorageObjectPath(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export function createSupabaseStorageRangeSource(options: {
  storageUrl: string
  storageKey: string
  bucket: string
  path: string
  size: number
  mimeType: 'video/mp4'
  fetchImpl?: FetchLike
}): GeminiVideoRangeSource {
  validateGeminiVideoSize(options.size, 'short-videos')
  if (!options.storageKey) throw new Error('gemini_omni_storage_environment_missing')
  const baseUrl = new URL(options.storageUrl)
  if (baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
    throw new Error('gemini_omni_storage_url_invalid')
  }
  const objectUrl = new URL(`/storage/v1/object/authenticated/${encodeURIComponent(options.bucket)}/${encodeStorageObjectPath(options.path)}`, baseUrl)
  const fetchImpl = options.fetchImpl || fetch
  return {
    size: options.size,
    mimeType: options.mimeType,
    async readRange(start, endInclusive) {
      if (!Number.isInteger(start) || !Number.isInteger(endInclusive) || start < 0 || endInclusive < start || endInclusive >= options.size) {
        throw new Error('gemini_omni_video_range_invalid')
      }
      const response = await fetchImpl(objectUrl, {
        method: 'GET',
        headers: {
          apikey: options.storageKey,
          Authorization: `Bearer ${options.storageKey}`,
          Range: `bytes=${start}-${endInclusive}`,
        },
      })
      const expectedBytes = endInclusive - start + 1
      const fullObjectRequest = start === 0 && expectedBytes === options.size
      if (response.status !== 206 && !(fullObjectRequest && response.status === 200)) {
        throw new Error(`gemini_omni_storage_range_failed:${response.status}`)
      }
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
      if (contentType && contentType !== 'video/mp4' && contentType !== 'application/octet-stream') {
        throw new Error('gemini_omni_video_type_invalid')
      }
      const contentLength = Number(response.headers.get('content-length') || expectedBytes)
      if (contentLength !== expectedBytes) throw new Error('gemini_omni_storage_range_size_invalid')
      const contentRange = response.headers.get('content-range')
      if (contentRange && contentRange !== `bytes ${start}-${endInclusive}/${options.size}`) {
        throw new Error('gemini_omni_storage_range_offset_invalid')
      }
      const chunk = new Uint8Array(await response.arrayBuffer())
      if (chunk.byteLength !== expectedBytes) throw new Error('gemini_omni_storage_range_size_invalid')
      return chunk
    },
  }
}

async function waitForGeminiFile(
  input: ReturnType<typeof parseGeminiFile>,
  options: { fetchImpl?: FetchLike; apiKey?: string } = {},
) {
  const startedAt = Date.now()
  let file = input
  const deadline = Date.now() + GEMINI_FILE_PROCESSING_TIMEOUT_MS
  while (file.state !== 'ACTIVE') {
    if (file.state === 'FAILED') throw new Error('gemini_omni_video_file_processing_failed')
    if (Date.now() >= deadline) throw new Error('gemini_omni_video_file_processing_timeout')
    await new Promise(resolve => setTimeout(resolve, 3_000))
    const response = options.fetchImpl
      ? await options.fetchImpl(`${API_BASE}/${file.name}`, { method: 'GET', headers: { Accept: 'application/json', 'x-goog-api-key': options.apiKey || getEnvironment() } })
      : await apiFetch(`/${file.name}`, { method: 'GET', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`gemini_omni_api_failed:${response.status}`)
    file = parseGeminiFile(await response.json())
  }
  if (!/^https:\/\/[^/]*googleapis\.com\//i.test(file.uri) || file.mimeType !== 'video/mp4') throw new Error('gemini_omni_video_file_invalid')
  return { ...file, fileProcessingDurationMs: Date.now() - startedAt }
}

export async function prepareGeminiVideo(
  supabase: StorageClient,
  bucket: string,
  path: string,
  profile: GeminiVideoSizeProfile = 'default',
  shortVideoRange?: ShortVideoRangeOptions,
) {
  if (profile === 'short-videos') {
    if (!shortVideoRange) throw new Error('gemini_omni_video_range_source_missing')
    const source = createSupabaseStorageRangeSource({
      storageUrl: shortVideoRange.storageUrl,
      storageKey: shortVideoRange.storageKey,
      bucket,
      path,
      size: shortVideoRange.size,
      mimeType: shortVideoRange.mimeType,
      fetchImpl: shortVideoRange.fetchImpl,
    })
    const uploaded = await uploadGeminiVideoFileInChunks(source, { fetchImpl: shortVideoRange.fetchImpl, apiKey: shortVideoRange.googleApiKey })
    const active = await waitForGeminiFile(uploaded, { fetchImpl: shortVideoRange.fetchImpl, apiKey: shortVideoRange.googleApiKey })
    return {
      video: { type: 'video', uri: active.uri, mime_type: 'video/mp4' } as GeminiVideoReference,
      uploadDurationMs: uploaded.uploadDurationMs,
      fileProcessingDurationMs: active.fileProcessingDurationMs,
    }
  }
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) throw new Error('gemini_omni_video_unavailable')
  validateGeminiVideoSize(data.size, profile)
  if (data.type && data.type !== 'video/mp4') throw new Error('gemini_omni_video_type_invalid')
  const uploaded = await uploadGeminiVideoFile(data)
  const active = await waitForGeminiFile(uploaded)
  return {
    video: { type: 'video', uri: active.uri, mime_type: 'video/mp4' } as GeminiVideoReference,
    uploadDurationMs: uploaded.uploadDurationMs,
    fileProcessingDurationMs: active.fileProcessingDurationMs,
  }
}
function findVideo(value: unknown): { data?: string; uri?: string; mimeType?: string } | null { if (!value || typeof value !== 'object') return null; if (Array.isArray(value)) { for (const item of value) { const found = findVideo(item); if (found) return found } return null } const record = value as Record<string, unknown>; if (record.type === 'video') return { data: typeof record.data === 'string' ? record.data : undefined, uri: typeof record.uri === 'string' ? record.uri : undefined, mimeType: typeof record.mime_type === 'string' ? record.mime_type : 'video/mp4' }; for (const nested of Object.values(record)) { const found = findVideo(nested); if (found) return found } return null }

export function validateGeminiOmniVideoUri(value: unknown) {
  let uri: URL
  try {
    uri = new URL(String(value || ''))
  } catch {
    throw new Error('gemini_omni_video_uri_invalid')
  }
  const filePath = new RegExp(`^/${SMART_TOUR_GEMINI_OMNI_API_VERSION}/files/([a-z0-9-]{1,40}):download$`)
  const fileMatch = uri.pathname.match(filePath)
  if (
    uri.origin !== GEMINI_OMNI_VIDEO_ORIGIN ||
    uri.username ||
    uri.password ||
    uri.hash ||
    !fileMatch ||
    uri.search !== '?alt=media'
  ) {
    throw new Error('gemini_omni_video_uri_invalid')
  }
  return `${GEMINI_OMNI_VIDEO_ORIGIN}/${SMART_TOUR_GEMINI_OMNI_API_VERSION}/files/${fileMatch[1]}:download?alt=media`
}

function validateGeminiOmniVideoRedirectUri(value: string, baseUri: string) {
  let uri: URL
  try {
    uri = new URL(value, baseUri)
  } catch {
    throw new Error('gemini_omni_video_redirect_invalid')
  }
  const googleOwnedHost = uri.hostname === 'googleapis.com' ||
    uri.hostname.endsWith('.googleapis.com') ||
    uri.hostname === 'googleusercontent.com' ||
    uri.hostname.endsWith('.googleusercontent.com')
  if (uri.protocol !== 'https:' || uri.username || uri.password || uri.port || uri.hash || !googleOwnedHost) {
    throw new Error('gemini_omni_video_redirect_invalid')
  }
  return uri.toString()
}

async function downloadVideo(uri: string) {
  const safeUri = validateGeminiOmniVideoUri(uri)
  const initialResponse = await fetch(safeUri, { headers: { 'x-goog-api-key': getEnvironment() }, redirect: 'manual' })
  const response = initialResponse.status >= 300 && initialResponse.status < 400
    ? await fetch(validateGeminiOmniVideoRedirectUri(initialResponse.headers.get('location') || '', safeUri), { redirect: 'error' })
    : initialResponse
  if (!response.ok) throw new Error(`gemini_omni_video_download_failed:${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export function readGeminiOmniInteractionId(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('gemini_omni_interaction_id_missing')
  const data = value as Record<string, unknown>
  const interactionId = typeof data.id === 'string' ? data.id : ''
  if (!interactionId) throw new Error('gemini_omni_interaction_id_missing')
  if (interactionId.includes('/') || /[\u0000-\u0020\u007f]/.test(interactionId)) throw new Error('gemini_omni_interaction_id_invalid')
  return { interactionId, responseKeys: Object.keys(data).sort(), providerIdSource: 'id' as const }
}

function readGeminiOmniInlineVideo(value: unknown) {
  const interaction = errorRecord(value)
  const steps = Array.isArray(interaction.steps) ? interaction.steps : []
  let videoPart: Record<string, unknown> | null = null
  for (const rawStep of steps) {
    const step = errorRecord(rawStep)
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue
    for (const rawPart of step.content) {
      const part = errorRecord(rawPart)
      if (part.type === 'video' && typeof part.data === 'string') {
        if (videoPart) throw new Error('gemini_omni_inline_video_ambiguous')
        videoPart = part
      }
    }
  }
  if (!videoPart) throw new Error('gemini_omni_inline_video_missing')
  const contentType = String(videoPart.mime_type ?? videoPart.mimeType ?? 'video/mp4').split(';')[0].trim().toLowerCase()
  if (contentType !== 'video/mp4') throw new Error('gemini_omni_inline_video_type_invalid')
  const encoded = String(videoPart.data || '').trim()
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error('gemini_omni_inline_video_base64_invalid')
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const estimatedSize = (encoded.length / 4) * 3 - padding
  validateGeminiVideoSize(estimatedSize)
  let videoBytes: Uint8Array
  try { videoBytes = base64ToBytes(encoded) } catch { throw new Error('gemini_omni_inline_video_base64_invalid') }
  validateGeminiVideoSize(videoBytes.byteLength)
  if (
    videoBytes.byteLength < 12 ||
    videoBytes[4] !== 0x66 ||
    videoBytes[5] !== 0x74 ||
    videoBytes[6] !== 0x79 ||
    videoBytes[7] !== 0x70
  ) throw new Error('gemini_omni_inline_video_mp4_invalid')
  return { videoBytes, contentType: 'video/mp4' as const }
}

export async function generateGeminiOmniVideoInline(input: InlineStartInput): Promise<{
  interactionId: string
  videoBytes: Uint8Array
  contentType: 'video/mp4'
}> {
  const fetchImpl = input.fetchImpl || fetch
  const timeoutMs = input.timeoutMs ?? SMART_TOUR_GEMINI_OMNI_INLINE_TIMEOUT_MS
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > SMART_TOUR_GEMINI_OMNI_INLINE_TIMEOUT_MS) {
    throw new Error('gemini_omni_inline_timeout_invalid')
  }
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)
  let response: Response
  let payload: unknown
  try {
    response = await fetchImpl(`${API_BASE}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getEnvironment() },
      body: JSON.stringify(buildGeminiOmniInlineRequestBody(input.prompt, input.images, input.aspectRatio)),
      signal: abortController.signal,
    })
    if (!response.ok) {
      const diagnostic = classifyGeminiOmniHttpError(response.status, await response.text())
      throw new Error(`gemini_omni_api_failed:${response.status}:${diagnostic.message}`)
    }
    payload = await response.json()
  } catch (error) {
    if (abortController.signal.aborted) throw new Error('gemini_omni_inline_timeout')
    throw error
  } finally {
    clearTimeout(timeout)
  }
  const interaction = readGeminiOmniInteractionId(payload)
  const video = readGeminiOmniInlineVideo(payload)
  console.info('[smart-tour-generate] inline_interaction_completed', JSON.stringify({
    responseKeys: interaction.responseKeys,
    providerIdSource: interaction.providerIdSource,
    delivery: 'base64',
    outputBytes: video.videoBytes.byteLength,
  }))
  return { interactionId: interaction.interactionId, ...video }
}

export async function startGeminiOmniVideo(input: StartInput): Promise<{ interactionId: string }> {
  const created = readGeminiOmniInteractionId(await createGeminiInteraction(buildGeminiOmniRequestBody(input.prompt, input.images, input.aspectRatio)))
  console.info('[smart-tour-generate] interaction_created', JSON.stringify({
    responseKeys: created.responseKeys,
    providerIdSource: created.providerIdSource,
  }))
  return { interactionId: created.interactionId }
}

export async function startGeminiOmniShortVideo(input: ShortVideoStartInput): Promise<{ interactionId: string }> {
  const created = readGeminiOmniInteractionId(await createGeminiInteraction(buildGeminiOmniShortVideoRequestBody(input.prompt, input.video)))
  console.info('[smart-tour-generate] short_video_interaction_created', JSON.stringify({
    interactionIdMasked: created.interactionId.length >= 17 ? `${created.interactionId.slice(0,8)}…${created.interactionId.slice(-8)}` : '[masked]',
    responseKeys: created.responseKeys,
    providerIdSource: created.providerIdSource,
  }))
  return { interactionId: created.interactionId }
}

export function buildGeminiOmniInteractionGetRequest(value: string) {
  const interactionId = String(value || '')
  if (!interactionId || interactionId.includes('/') || /[\u0000-\u0020\u007f]/.test(interactionId)) throw new Error('gemini_omni_interaction_id_invalid')
  const path = `/interactions/${encodeURIComponent(interactionId)}`
  return {
    interactionId,
    path,
    url: `${API_BASE}${path}`,
    method: 'GET' as const,
    headers: { Accept: 'application/json' },
  }
}

export function buildGeminiOmniInteractionStreamRequest(value: string, lastEventId = '') {
  const request = buildGeminiOmniInteractionGetRequest(value)
  if (lastEventId && /[\u0000\r\n]/.test(lastEventId)) throw new Error('gemini_omni_event_id_invalid')
  const query = new URLSearchParams({ stream: 'true' })
  if (lastEventId) query.set('last_event_id', lastEventId)
  const path = `${request.path}?${query.toString()}`
  return {
    ...request,
    path,
    url: `${API_BASE}${path}`,
    headers: { Accept: 'text/event-stream', 'Api-Revision': '2026-05-20' },
  }
}

const GEMINI_OMNI_STREAM_STATE_PREFIX = 'gemini-sse-state:'

function validateGeminiOmniEventId(value: unknown) {
  const eventId = typeof value === 'string' ? value : ''
  if (eventId && /[\u0000\r\n]/.test(eventId)) throw new Error('gemini_omni_event_id_invalid')
  return eventId
}

function normalizeGeminiOmniStreamState(state: GeminiOmniStreamState): GeminiOmniStreamState {
  const interactionId = buildGeminiOmniInteractionGetRequest(state.interactionId).interactionId
  const lastEventId = validateGeminiOmniEventId(state.lastEventId)
  const videoUri = state.videoUri ? validateGeminiOmniVideoUri(state.videoUri) : ''
  const contentType = String(state.contentType || 'video/mp4').slice(0, 100)
  return { interactionId, lastEventId, videoUri, contentType }
}

export function encodeGeminiOmniStreamState(state: GeminiOmniStreamState) {
  const normalized = normalizeGeminiOmniStreamState(state)
  return `${GEMINI_OMNI_STREAM_STATE_PREFIX}${JSON.stringify(normalized)}`
}

export function decodeGeminiOmniStreamState(value: unknown): GeminiOmniStreamState {
  const persisted = String(value || '')
  if (!persisted.startsWith(GEMINI_OMNI_STREAM_STATE_PREFIX)) {
    return {
      interactionId: buildGeminiOmniInteractionGetRequest(persisted).interactionId,
      lastEventId: '',
      videoUri: '',
      contentType: 'video/mp4',
    }
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(persisted.slice(GEMINI_OMNI_STREAM_STATE_PREFIX.length)) as Record<string, unknown>
  } catch {
    throw new Error('gemini_omni_stream_state_invalid')
  }
  const state = normalizeGeminiOmniStreamState({
    interactionId: String(parsed.interactionId || ''),
    lastEventId: String(parsed.lastEventId || ''),
    videoUri: String(parsed.videoUri || ''),
    contentType: String(parsed.contentType || 'video/mp4'),
  })
  return state
}

export function parseGeminiOmniSseBlock(block: string) {
  let eventType = ''
  let eventId = ''
  const dataLines: string[] = []
  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(':')) continue
    const separator = rawLine.indexOf(':')
    const field = separator === -1 ? rawLine : rawLine.slice(0, separator)
    const value = separator === -1 ? '' : rawLine.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') eventType = value
    if (field === 'id') eventId = validateGeminiOmniEventId(value)
    if (field === 'data') dataLines.push(value)
  }
  if (!dataLines.length && !eventType && !eventId) return null
  const payload = dataLines.length ? JSON.parse(dataLines.join('\n')) as Record<string, unknown> : {}
  return { eventType: String(payload.event_type || eventType || ''), eventId, payload }
}

export function evaluateGeminiOmniSseEvent(
  event: { eventType: string; eventId: string; payload: Record<string, unknown> },
  currentEventId = '',
): GeminiOmniStreamResult | null {
  const lastEventId = event.eventId || currentEventId
  if (event.eventType === 'error' || event.eventType === 'interaction.failed') {
    const diagnostic = classifyGeminiOmniSseError(event.eventType, event.payload)
    return { status: 'failed', diagnostic: { ...diagnostic, retryable: false }, lastEventId }
  }
  const video = findVideo(event.payload)
  if (video?.uri) {
    return {
      status: 'completed',
      videoUri: video.uri,
      contentType: video.mimeType || 'video/mp4',
      delivery: 'uri',
      lastEventId,
    }
  }
  if (event.eventType === 'interaction.completed') {
    return {
      status: 'failed',
      diagnostic: buildGeminiOmniDiagnostic('sse', 'interaction.completed', {
        error: { code: 'video_missing', message: 'gemini_omni_video_missing' },
      }, null),
      lastEventId,
    }
  }
  return null
}

function geminiOmniContractFailure(code: string, lastEventId: string): GeminiOmniStreamResult {
  return {
    status: 'failed',
    diagnostic: buildGeminiOmniDiagnostic('sse', '', {
      error: { code, message: code },
    }, null),
    lastEventId,
  }
}

const GEMINI_OMNI_SSE_WAIT_TIMEOUT_MS = 20_000
const GEMINI_OMNI_SSE_MAX_BUFFER_BYTES = 1024 * 1024

async function readGeminiOmniSseChunk(reader: ReadableStreamDefaultReader<Uint8Array>, waitMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      reader.read(),
      new Promise<{ waitComplete: true }>(resolve => {
        timeout = setTimeout(() => resolve({ waitComplete: true }), waitMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function checkGeminiOmniVideoStream(interactionId: string, lastEventId = '', signal?: AbortSignal): Promise<GeminiOmniStreamResult> {
  if (signal?.aborted) throw new Error('smart_tour_status_timeout')
  const request = buildGeminiOmniInteractionStreamRequest(interactionId, lastEventId)
  let response: Response
  try {
    response = await apiFetch(request.path, { method: request.method, headers: request.headers, signal }, { errorMode: 'polling' })
  } catch (error) {
    if (error instanceof GeminiOmniPollingHttpError) {
      if (error.diagnostic.retryable) throw new Error(`gemini_omni_api_failed:${error.diagnostic.httpStatus || 500}:${error.diagnostic.message}`)
      return { status: 'failed', diagnostic: { ...error.diagnostic, retryable: false }, lastEventId }
    }
    throw error
  }
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    return geminiOmniContractFailure('gemini_omni_stream_content_type_invalid', lastEventId)
  }
  const reader = response.body?.getReader()
  if (!reader) return geminiOmniContractFailure('gemini_omni_stream_body_missing', lastEventId)
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEventId = lastEventId
  const deadline = Date.now() + GEMINI_OMNI_SSE_WAIT_TIMEOUT_MS
  try {
    while (true) {
      const remainingMs = deadline - Date.now()
      if (remainingMs <= 0) return { status: 'processing', lastEventId: currentEventId }
      const chunk = await readGeminiOmniSseChunk(reader, remainingMs)
      if ('waitComplete' in chunk) return { status: 'processing', lastEventId: currentEventId }
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      if (buffer.length > GEMINI_OMNI_SSE_MAX_BUFFER_BYTES) return geminiOmniContractFailure('gemini_omni_stream_buffer_exceeded', currentEventId)
      let boundary = buffer.match(/\r?\n\r?\n/)
      while (boundary?.index !== undefined) {
        const block = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        let event: ReturnType<typeof parseGeminiOmniSseBlock>
        try { event = parseGeminiOmniSseBlock(block) } catch { return geminiOmniContractFailure('gemini_omni_stream_event_invalid', currentEventId) }
        if (event) {
          if (event.eventId) currentEventId = event.eventId
          const result = evaluateGeminiOmniSseEvent(event, currentEventId)
          if (result) return result
        }
        boundary = buffer.match(/\r?\n\r?\n/)
      }
    }
    return { status: 'processing', lastEventId: currentEventId }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

export async function downloadGeminiOmniVideoFromUri(videoUri: string, contentType = 'video/mp4') {
  return { videoBytes: await downloadVideo(videoUri), contentType: String(contentType || 'video/mp4').slice(0, 100) }
}

export async function checkGeminiOmniVideo(interactionId: string): Promise<CheckResult> { const request = buildGeminiOmniInteractionGetRequest(interactionId); const response = await apiFetch(request.path, { method: request.method, headers: request.headers }); const data = await response.json(); const status = String(data.status || '').toLowerCase(); if (status === 'in_progress' || status === 'queued') return { status: 'processing' }; if (status !== 'completed') return { status: 'failed', errorMessage: String(data.error?.message || `gemini_omni_${status || 'unknown_status'}`).slice(0, 400) }; const video = findVideo(data.steps); if (video?.data) return { status: 'completed', videoBytes: base64ToBytes(video.data), contentType: video.mimeType || 'video/mp4', delivery: 'base64' }; if (video?.uri) return { status: 'completed', videoBytes: await downloadVideo(video.uri), contentType: video.mimeType || 'video/mp4', delivery: 'uri' }; return { status: 'failed', errorMessage: 'gemini_omni_video_missing' } }

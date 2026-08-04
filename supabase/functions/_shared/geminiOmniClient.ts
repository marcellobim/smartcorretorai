type StorageClient = { storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }> } } }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
export type GeminiInlineImage = { type: 'image'; data: string; mime_type: 'image/jpeg' | 'image/png' }
type GeminiOmniAspectRatio = '9:16' | '16:9'
type StartInput = { prompt: string; images: GeminiInlineImage[]; aspectRatio?: GeminiOmniAspectRatio }
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
export type GeminiOmniStreamResult =
  | { status: 'processing'; lastEventId: string }
  | { status: 'completed'; videoUri: string; contentType: string; delivery: 'uri'; lastEventId: string }
  | { status: 'failed'; errorMessage: string; lastEventId: string }
export type GeminiOmniStreamState = { interactionId: string; lastEventId: string; videoUri: string; contentType: string }

export const SMART_TOUR_GEMINI_OMNI_MODEL = 'gemini-omni-flash-preview'
export const SMART_TOUR_GEMINI_OMNI_API_VERSION = 'v1beta'
export const SMART_TOUR_GEMINI_OMNI_DURATION = '10s'
export const SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL = 'high'
const API_BASE = `https://generativelanguage.googleapis.com/${SMART_TOUR_GEMINI_OMNI_API_VERSION}`

function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary) }
function base64ToBytes(value: string) { const binary = atob(value.includes(',') ? value.split(',').at(-1) || '' : value); return Uint8Array.from(binary, character => character.charCodeAt(0)) }
async function prepareImage(supabase: StorageClient, bucket: string, path: string): Promise<GeminiInlineImage> { const { data, error } = await supabase.storage.from(bucket).download(path); if (error || !data) throw new Error('gemini_omni_image_unavailable'); const bytes = new Uint8Array(await data.arrayBuffer()); if (!bytes.length) throw new Error('gemini_omni_image_empty'); const extension = path.split('.').at(-1)?.toLowerCase(); return { type: 'image', data: bytesToBase64(bytes), mime_type: data.type === 'image/png' || extension === 'png' ? 'image/png' : 'image/jpeg' } }

export function prepareGeminiImages(supabase: StorageClient, bucket: string, imagePaths: string[]) { return Promise.all(imagePaths.map(path => prepareImage(supabase, bucket, path))) }

export function buildGeminiOmniRequestBody(prompt: string, images: Array<{ type: string; data: string; mime_type: string }>, aspectRatio?: GeminiOmniAspectRatio) {
  return { model: SMART_TOUR_GEMINI_OMNI_MODEL, input: [...images, { type: 'text', text: prompt }], response_format: { type: 'video', duration: SMART_TOUR_GEMINI_OMNI_DURATION, delivery: 'uri', ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }, generation_config: { thinking_level: SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL }, background: true, store: true }
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
function getEnvironment() { const apiKey = Deno.env.get('GEMINI_API_KEY') || ''; if (!apiKey) throw new Error('gemini_omni_missing_environment'); return apiKey }
async function apiFetch(path: string, init: RequestInit = {}) { const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'x-goog-api-key': getEnvironment(), ...(init.headers || {}) } }); if (!response.ok) { const body = await response.text(); throw new Error(`gemini_omni_api_failed:${response.status}:${body.slice(0, 180)}`) } return response }
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
      body: chunk,
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
async function downloadVideo(uri: string) { const response = await fetch(uri, { headers: { 'x-goog-api-key': getEnvironment() } }); if (!response.ok) throw new Error(`gemini_omni_video_download_failed:${response.status}`); return new Uint8Array(await response.arrayBuffer()) }

export function readGeminiOmniInteractionId(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('gemini_omni_interaction_id_missing')
  const data = value as Record<string, unknown>
  const interactionId = typeof data.id === 'string' ? data.id : ''
  if (!interactionId) throw new Error('gemini_omni_interaction_id_missing')
  if (interactionId.includes('/') || /[\u0000-\u0020\u007f]/.test(interactionId)) throw new Error('gemini_omni_interaction_id_invalid')
  return { interactionId, responseKeys: Object.keys(data).sort(), providerIdSource: 'id' as const }
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

export function encodeGeminiOmniStreamState(state: GeminiOmniStreamState) {
  const interactionId = buildGeminiOmniInteractionGetRequest(state.interactionId).interactionId
  const lastEventId = validateGeminiOmniEventId(state.lastEventId)
  const videoUri = String(state.videoUri || '')
  if (videoUri && !/^https:\/\//i.test(videoUri)) throw new Error('gemini_omni_video_uri_invalid')
  const contentType = String(state.contentType || 'video/mp4').slice(0, 100)
  return `${GEMINI_OMNI_STREAM_STATE_PREFIX}${JSON.stringify({ interactionId, lastEventId, videoUri, contentType })}`
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
  const interactionId = buildGeminiOmniInteractionGetRequest(String(parsed.interactionId || '')).interactionId
  const lastEventId = validateGeminiOmniEventId(parsed.lastEventId)
  const videoUri = String(parsed.videoUri || '')
  if (videoUri && !/^https:\/\//i.test(videoUri)) throw new Error('gemini_omni_video_uri_invalid')
  return { interactionId, lastEventId, videoUri, contentType: String(parsed.contentType || 'video/mp4').slice(0, 100) }
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

function getGeminiOmniSseError(payload: Record<string, unknown>) {
  const interaction = payload.interaction && typeof payload.interaction === 'object' ? payload.interaction as Record<string, unknown> : {}
  const error = payload.error && typeof payload.error === 'object'
    ? payload.error as Record<string, unknown>
    : interaction.error && typeof interaction.error === 'object'
      ? interaction.error as Record<string, unknown>
      : {}
  return String(error.message || payload.message || interaction.message || 'gemini_omni_stream_failed').slice(0, 400)
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

export async function checkGeminiOmniVideoStream(interactionId: string, lastEventId = ''): Promise<GeminiOmniStreamResult> {
  const request = buildGeminiOmniInteractionStreamRequest(interactionId, lastEventId)
  const response = await apiFetch(request.path, { method: request.method, headers: request.headers })
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) throw new Error('gemini_omni_stream_content_type_invalid')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('gemini_omni_stream_body_missing')
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
      if (buffer.length > GEMINI_OMNI_SSE_MAX_BUFFER_BYTES) throw new Error('gemini_omni_stream_buffer_exceeded')
      let boundary = buffer.match(/\r?\n\r?\n/)
      while (boundary?.index !== undefined) {
        const block = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const event = parseGeminiOmniSseBlock(block)
        if (event) {
          if (event.eventId) currentEventId = event.eventId
          const video = findVideo(event.payload)
          if (video?.uri) return { status: 'completed', videoUri: video.uri, contentType: video.mimeType || 'video/mp4', delivery: 'uri', lastEventId: currentEventId }
          if (event.eventType === 'error' || event.eventType === 'interaction.failed') return { status: 'failed', errorMessage: getGeminiOmniSseError(event.payload), lastEventId: currentEventId }
          if (event.eventType === 'interaction.completed') return { status: 'failed', errorMessage: 'gemini_omni_video_missing', lastEventId: currentEventId }
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
  if (!/^https:\/\//i.test(videoUri)) throw new Error('gemini_omni_video_uri_invalid')
  return { videoBytes: await downloadVideo(videoUri), contentType: String(contentType || 'video/mp4').slice(0, 100) }
}

export async function checkGeminiOmniVideo(interactionId: string): Promise<CheckResult> { const request = buildGeminiOmniInteractionGetRequest(interactionId); const response = await apiFetch(request.path, { method: request.method, headers: request.headers }); const data = await response.json(); const status = String(data.status || '').toLowerCase(); if (status === 'in_progress' || status === 'queued') return { status: 'processing' }; if (status !== 'completed') return { status: 'failed', errorMessage: String(data.error?.message || `gemini_omni_${status || 'unknown_status'}`).slice(0, 400) }; const video = findVideo(data.steps); if (video?.data) return { status: 'completed', videoBytes: base64ToBytes(video.data), contentType: video.mimeType || 'video/mp4', delivery: 'base64' }; if (video?.uri) return { status: 'completed', videoBytes: await downloadVideo(video.uri), contentType: video.mimeType || 'video/mp4', delivery: 'uri' }; return { status: 'failed', errorMessage: 'gemini_omni_video_missing' } }

type StorageClient = { storage: { from(bucket: string): { download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }> } } }
export type GeminiInlineImage = { type: 'image'; data: string; mime_type: 'image/jpeg' | 'image/png' }
type StartInput = { prompt: string; images: GeminiInlineImage[] }
type CheckResult = { status: 'processing' } | { status: 'completed'; videoBytes: Uint8Array; contentType: string } | { status: 'failed'; errorMessage: string }

export const SMART_TOUR_GEMINI_OMNI_MODEL = 'gemini-omni-flash-preview'
export const SMART_TOUR_GEMINI_OMNI_API_VERSION = 'v1beta'
export const SMART_TOUR_GEMINI_OMNI_DURATION = '10s'
export const SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL = 'high'
const API_BASE = `https://generativelanguage.googleapis.com/${SMART_TOUR_GEMINI_OMNI_API_VERSION}`

function bytesToBase64(bytes: Uint8Array) { let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary) }
function base64ToBytes(value: string) { const binary = atob(value.includes(',') ? value.split(',').at(-1) || '' : value); return Uint8Array.from(binary, character => character.charCodeAt(0)) }
async function prepareImage(supabase: StorageClient, bucket: string, path: string): Promise<GeminiInlineImage> { const { data, error } = await supabase.storage.from(bucket).download(path); if (error || !data) throw new Error('gemini_omni_image_unavailable'); const bytes = new Uint8Array(await data.arrayBuffer()); if (!bytes.length) throw new Error('gemini_omni_image_empty'); const extension = path.split('.').at(-1)?.toLowerCase(); return { type: 'image', data: bytesToBase64(bytes), mime_type: data.type === 'image/png' || extension === 'png' ? 'image/png' : 'image/jpeg' } }

export function prepareGeminiImages(supabase: StorageClient, bucket: string, imagePaths: string[]) { return Promise.all(imagePaths.map(path => prepareImage(supabase, bucket, path))) }

export function buildGeminiOmniRequestBody(prompt: string, images: Array<{ type: string; data: string; mime_type: string }>) {
  return { model: SMART_TOUR_GEMINI_OMNI_MODEL, input: [...images, { type: 'text', text: prompt }], response_format: { type: 'video', duration: SMART_TOUR_GEMINI_OMNI_DURATION, delivery: 'uri' }, generation_config: { thinking_level: SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL }, background: true, store: true }
}
function getEnvironment() { const apiKey = Deno.env.get('GEMINI_API_KEY') || ''; if (!apiKey) throw new Error('gemini_omni_missing_environment'); return apiKey }
async function apiFetch(path: string, init: RequestInit = {}) { const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), 'x-goog-api-key': getEnvironment(), ...(init.headers || {}) } }); if (!response.ok) { const body = await response.text(); throw new Error(`gemini_omni_api_failed:${response.status}:${body.slice(0, 180)}`) } return response }
async function createGeminiInteraction(body: unknown) { const response = await apiFetch('/interactions', { method: 'POST', body: JSON.stringify(body) }); return response.json() }
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
  const created = readGeminiOmniInteractionId(await createGeminiInteraction(buildGeminiOmniRequestBody(input.prompt, input.images)))
  console.info('[smart-tour-generate] interaction_created', JSON.stringify({
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

export async function checkGeminiOmniVideo(interactionId: string): Promise<CheckResult> { const request = buildGeminiOmniInteractionGetRequest(interactionId); const response = await apiFetch(request.path, { method: request.method, headers: request.headers }); const data = await response.json(); const status = String(data.status || '').toLowerCase(); if (status === 'in_progress' || status === 'queued') return { status: 'processing' }; if (status !== 'completed') return { status: 'failed', errorMessage: String(data.error?.message || `gemini_omni_${status || 'unknown_status'}`).slice(0, 400) }; const video = findVideo(data.steps); if (video?.data) return { status: 'completed', videoBytes: base64ToBytes(video.data), contentType: video.mimeType || 'video/mp4' }; if (video?.uri) return { status: 'completed', videoBytes: await downloadVideo(video.uri), contentType: video.mimeType || 'video/mp4' }; return { status: 'failed', errorMessage: 'gemini_omni_video_missing' } }

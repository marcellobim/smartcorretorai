export const SMART_TOUR_STATUS_TIMEOUT_MS = 25_000
export const SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH = 180

const RETRIABLE_HTTP_STATUSES = new Set([404, 408, 409, 425, 429, 500, 502, 503, 504])

export type SmartTourStatusStage =
  | 'job_lookup'
  | 'completed_url'
  | 'interaction_poll'
  | 'caption_render_poll'
  | 'caption_render_start'
  | 'caption_video_download'
  | 'caption_video_upload'
  | 'failed_persist'
  | 'video_upload'
  | 'completed_persist'
  | 'result_url'

export type SmartTourStatusDiagnostic = {
  stage: SmartTourStatusStage
  kind: string
  providerStatus: number | null
  retriable: boolean
  providerMessage: string
}

function extractProviderMessage(message: string) {
  const raw = message.match(/^gemini_omni_(?:api_failed|video_download_failed):\d{3}:(.*)$/s)?.[1] || ''
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown }; message?: unknown }
    const candidate = parsed?.error?.message ?? parsed?.message
    if (typeof candidate === 'string') return candidate
  } catch {
    const encodedMessage = raw.match(/"message"\s*:\s*("(?:\\.|[^"\\])*")/)?.[1]
    if (encodedMessage) {
      try { return JSON.parse(encodedMessage) as string } catch { /* use the bounded raw fallback */ }
    }
    const truncatedMessage = raw.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)/)?.[1]
    if (truncatedMessage) {
      try { return JSON.parse(`"${truncatedMessage}"`) as string } catch { return truncatedMessage }
    }
  }
  return raw
}

export function sanitizeSmartTourStatusProviderMessage(error: unknown) {
  const source = error instanceof Error ? error.message : String(error || '')
  const providerMessage = extractProviderMessage(source)
  if (!providerMessage) return ''
  return providerMessage
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/https?:\/\/[^\s"']+/gi, '[url-redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email-redacted]')
    .replace(/\bAIza[A-Za-z0-9_-]{16,}\b/g, '[secret-redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[secret-redacted]')
    .replace(/\b(?:GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [secret-redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone-redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH)
}

export function maskSmartTourInteractionId(value: unknown) {
  const interactionId = String(value || '')
  if (interactionId.length < 17) return ''
  return `${interactionId.slice(0, 8)}…${interactionId.slice(-8)}`
}

export function classifySmartTourStatusError(error: unknown, stage: SmartTourStatusStage): SmartTourStatusDiagnostic {
  const message = error instanceof Error ? error.message : String(error || '')
  const providerMatch = message.match(/gemini_omni_(?:api_failed|video_download_failed):(\d{3})/)
  const captionProviderMatch = message.match(/smart_tour_caption_(?:api|download)_failed:(\d{3})/)
  const providerStatus = providerMatch ? Number(providerMatch[1]) : captionProviderMatch ? Number(captionProviderMatch[1]) : null
  const timedOut = message === 'smart_tour_status_timeout'
  const kind = timedOut
    ? 'interaction_timeout'
    : message.startsWith('gemini_omni_api_failed:')
      ? 'interaction_api_error'
      : message.startsWith('gemini_omni_video_download_failed:')
      ? 'video_download_error'
      : message.startsWith('smart_tour_caption_api_failed:')
        ? 'caption_api_error'
        : message.startsWith('smart_tour_caption_download_failed:')
          ? 'caption_download_error'
      : message.startsWith('status_')
          ? message.split(':')[0]
          : 'unexpected_error'
  const retriableStage = stage === 'interaction_poll' || stage === 'caption_render_poll' || stage === 'caption_video_download'
  const retriable = retriableStage && (timedOut || (providerStatus !== null && RETRIABLE_HTTP_STATUSES.has(providerStatus)))

  return { stage, kind, providerStatus, retriable, providerMessage: sanitizeSmartTourStatusProviderMessage(error) }
}

export async function withSmartTourStatusTimeout<T>(operation: Promise<T>, timeoutMs = SMART_TOUR_STATUS_TIMEOUT_MS) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('smart_tour_status_timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

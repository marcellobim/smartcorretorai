export const SMART_TOUR_STATUS_TIMEOUT_MS = 25_000
export const SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH = 180
export const SHORT_VIDEO_PRE_PROVIDER_STALE_MS = 10 * 60 * 1000

const RETRIABLE_HTTP_STATUSES = new Set([404, 408, 409, 425, 429, 500, 502, 503, 504])
const RETRIABLE_SSE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const RETRIABLE_SSE_CODES = new Set(['deadline_exceeded', 'internal', 'rate_limit_exceeded', 'request_timeout', 'resource_exhausted', 'service_unavailable', 'unavailable'])

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
  eventType: string
  providerCode: string
  providerErrorStatus: string
  providerErrorType: string
  providerStatus: number | null
  retriable: boolean
  providerMessage: string
}

export type SmartTourProviderDiagnosticInput = {
  source?: unknown
  eventType?: unknown
  code?: unknown
  errorStatus?: unknown
  errorType?: unknown
  httpStatus?: unknown
  message?: unknown
  retryable?: unknown
}

export function isShortVideoPreProviderStale(
  job: { mode?: unknown; status?: unknown; provider_job_id?: unknown; created_at?: unknown },
  nowMs = Date.now(),
) {
  if (job.mode !== 'smart_tour_gemini_omni_short_video' || job.status !== 'pending' || job.provider_job_id) return false
  const createdAtMs = Date.parse(String(job.created_at || ''))
  return Number.isFinite(createdAtMs) && nowMs - createdAtMs >= SHORT_VIDEO_PRE_PROVIDER_STALE_MS
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

function sanitizeSmartTourStatusProviderText(value: unknown) {
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
    .replace(/\b(?:GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, '[secret-redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [secret-redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone-redacted]')
    .replace(/(?:data:[^;,\s]+;base64,)?[A-Za-z0-9+/_=-]{80,}/g, '[data-redacted]')
    .replace(/\b(?:prompt|briefing)\s*[:=]\s*[^,;]+/gi, '[detail-redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH)
}

export function sanitizeSmartTourStatusProviderMessage(error: unknown) {
  const source = error instanceof Error ? error.message : String(error || '')
  return sanitizeSmartTourStatusProviderText(extractProviderMessage(source))
}

function sanitizeSmartTourDiagnosticToken(value: unknown) {
  const token = String(value || '').trim()
  if (!/^[a-z0-9_.:-]{1,64}$/i.test(token)) return ''
  if (/^(?:AIza|eyJ)|(?:api[_-]?key|authorization|bearer|token)/i.test(token)) return ''
  return token
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

  return {
    stage,
    kind,
    eventType: providerMatch ? 'http.error' : '',
    providerCode: providerStatus === null ? '' : String(providerStatus),
    providerErrorStatus: '',
    providerErrorType: '',
    providerStatus,
    retriable,
    providerMessage: sanitizeSmartTourStatusProviderMessage(error),
  }
}

export function classifySmartTourProviderDiagnostic(
  value: SmartTourProviderDiagnosticInput,
  stage: SmartTourStatusStage = 'interaction_poll',
): SmartTourStatusDiagnostic {
  const eventType = sanitizeSmartTourDiagnosticToken(value.eventType)
  const source = sanitizeSmartTourDiagnosticToken(value.source)
  const providerStatus = Number.isInteger(value.httpStatus) && Number(value.httpStatus) >= 100 && Number(value.httpStatus) <= 599
    ? Number(value.httpStatus)
    : null
  const terminalInteraction = eventType === 'interaction.failed' || eventType === 'interaction.completed'
  const symbolicCodes = [value.code, value.errorStatus, value.errorType]
    .map(candidate => sanitizeSmartTourDiagnosticToken(candidate).toLowerCase())
    .filter(Boolean)
  const retriable = !terminalInteraction && (
    providerStatus !== null
      ? source === 'http'
        ? RETRIABLE_HTTP_STATUSES.has(providerStatus)
        : source === 'sse' && eventType === 'error' && RETRIABLE_SSE_STATUSES.has(providerStatus)
      : source === 'sse' && eventType === 'error' && symbolicCodes.some(candidate => RETRIABLE_SSE_CODES.has(candidate))
  )
  return {
    stage,
    kind: eventType === 'interaction.failed'
      ? 'interaction_failed'
      : eventType === 'interaction.completed'
        ? 'interaction_video_missing'
        : 'interaction_api_error',
    eventType,
    providerCode: sanitizeSmartTourDiagnosticToken(value.code),
    providerErrorStatus: sanitizeSmartTourDiagnosticToken(value.errorStatus),
    providerErrorType: sanitizeSmartTourDiagnosticToken(value.errorType),
    providerStatus,
    retriable,
    providerMessage: sanitizeSmartTourStatusProviderText(value.message),
  }
}

export function serializeSmartTourStatusDiagnostic(diagnostic: SmartTourStatusDiagnostic) {
  return JSON.stringify({
    event_type: diagnostic.eventType || null,
    code: diagnostic.providerCode || null,
    error_status: diagnostic.providerErrorStatus || null,
    error_type: diagnostic.providerErrorType || null,
    http_status: diagnostic.providerStatus,
    retryable: diagnostic.retriable,
    message: diagnostic.providerMessage.slice(0, 120) || null,
  })
}

export async function withSmartTourStatusTimeout<T>(
  operation: Promise<T>,
  timeoutMs = SMART_TOUR_STATUS_TIMEOUT_MS,
  onTimeout: () => void = () => undefined,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          try { onTimeout() } catch { /* timeout remains authoritative */ }
          reject(new Error('smart_tour_status_timeout'))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

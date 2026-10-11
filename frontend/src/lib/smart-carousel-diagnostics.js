const PHASES = new Set([
  'validation_started', 'validation_passed', 'validation_failed',
  'uploads_started', 'uploads_completed', 'upload_failed',
  'request_body_built', 'carousel_request_started',
  'carousel_request_response', 'carousel_request_failed',
])

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export function smartCarouselDiagnosticsEnabled(storage = globalThis.sessionStorage, env = import.meta.env) {
  if (env?.DEV) return true
  try {
    return storage?.getItem('snetia:smart-carousel:diagnostics:v1') === 'enabled'
  } catch {
    return false
  }
}

export function sanitizeSmartCarouselDiagnosticText(value, maximum = 180) {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  // Error bodies are untrusted: suppress common credential, URL, contact and
  // credential-value shapes rather than risking a diagnostic console leak.
  if (/bearer\s|authorization|token|cookie|https?:\/\/|@|\b(?:\+?\d[\d ()-]{6,}\d)\b|\b(?:creci|license)\b/i.test(text)) return 'redacted'
  return text.slice(0, maximum)
}

export function smartCarouselResponseDiagnostic(response, payload) {
  const status = Number.isInteger(response?.status) ? response.status : null
  const requestId = ['x-request-id', 'x-sb-request-id', 'cf-ray']
    .map(name => response?.headers?.get?.(name) || '')
    .find(value => REQUEST_ID_PATTERN.test(value)) || null
  const error = sanitizeSmartCarouselDiagnosticText(payload?.error || payload?.code || '')
  return {
    status_http: status,
    request_id: requestId,
    error_code: error ? error.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) : status ? `http_${status}` : 'request_failed',
    error_message: error || null,
  }
}

export function createSmartCarouselDiagnostic({ enabled = smartCarouselDiagnosticsEnabled(), logger = console, now = () => new Date().toISOString() } = {}) {
  return (phase, details = {}) => {
    if (!enabled || !PHASES.has(phase)) return
    const clientRequestId = REQUEST_ID_PATTERN.test(String(details.client_request_id || '')) ? details.client_request_id : null
    const status = Number.isInteger(details.status_http) && details.status_http >= 100 && details.status_http <= 599 ? details.status_http : null
    logger.info('[smart-carousel:diagnostic]', {
      timestamp: now(),
      client_request_id: clientRequestId,
      phase,
      status_http: status,
      request_id: REQUEST_ID_PATTERN.test(String(details.request_id || '')) ? details.request_id : null,
      error_code: sanitizeSmartCarouselDiagnosticText(details.error_code, 80) || null,
      error_message: sanitizeSmartCarouselDiagnosticText(details.error_message) || null,
    })
  }
}

export async function parseSmartCarouselErrorResponse(response) {
  const text = await response.text().catch(() => '')
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return { error: sanitizeSmartCarouselDiagnosticText(text) }
  }
}

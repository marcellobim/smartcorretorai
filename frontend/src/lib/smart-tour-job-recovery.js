export const ACTIVE_JOB_KEY = 'smartcorretorai:smart-tour:active-job'
export const SMART_TOUR_STARTING_RECOVERY_WINDOW_MS = 45_000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function parseSmartTourActiveJob(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) return null
  const raw = rawValue.trim()
  if (UUID_PATTERN.test(raw)) {
    return { jobId: raw, campaignPackage: {}, inputFlow: 'images', phase: 'active', updatedAt: 0, legacy: true }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed === 'string' && UUID_PATTERN.test(parsed)) {
    return { jobId: parsed, campaignPackage: {}, inputFlow: 'images', phase: 'active', updatedAt: 0, legacy: true }
  }
  if (!isRecord(parsed) || !UUID_PATTERN.test(String(parsed.jobId || ''))) return null

  return {
    jobId: String(parsed.jobId),
    campaignPackage: isRecord(parsed.campaignPackage) ? parsed.campaignPackage : {},
    inputFlow: parsed.inputFlow === 'short-videos' ? 'short-videos' : 'images',
    phase: parsed.phase === 'starting' ? 'starting' : 'active',
    updatedAt: Number.isFinite(parsed.updatedAt) && parsed.updatedAt > 0 ? parsed.updatedAt : 0,
    legacy: false,
  }
}

export function readSmartTourActiveJob(storage) {
  try {
    const raw = storage?.getItem(ACTIVE_JOB_KEY)
    if (!raw) return { record: null, invalid: false }
    const record = parseSmartTourActiveJob(raw)
    return { record, invalid: !record }
  } catch {
    return { record: null, invalid: false }
  }
}

export function writeSmartTourActiveJob(storage, record) {
  storage.setItem(ACTIVE_JOB_KEY, JSON.stringify(record))
}

export function clearSmartTourActiveJob(storage) {
  try {
    storage?.removeItem(ACTIVE_JOB_KEY)
  } catch {
    // A falha de limpeza local não deve impedir a exibição de um resultado terminal.
  }
}

export function getSmartTourStatusHttpStatus(error) {
  const value = error?.context?.status ?? error?.status ?? error?.statusCode
  const status = Number(value)
  return Number.isInteger(status) ? status : null
}

export function shouldRecoverSmartTourGenerateResponse(error, data) {
  if (!error) return !isRecord(data) || (data.ok === true && !data.jobId) || (!('ok' in data) && !('error' in data))
  const status = getSmartTourStatusHttpStatus(error)
  return status === null || status === 408 || status === 429 || status >= 500
}

export function shouldRetrySmartTourStatusResponse(error, data) {
  if (!error) return !isRecord(data) || (!('ok' in data) && !('error' in data))
  const status = getSmartTourStatusHttpStatus(error)
  return status === null || status === 408 || status === 429 || status >= 500
}

export function shouldRetryStartingJobNotFound(record, error, now = Date.now()) {
  if (getSmartTourStatusHttpStatus(error) !== 404 || record?.phase !== 'starting') return false
  if (!Number.isFinite(record.updatedAt) || record.updatedAt <= 0 || now < record.updatedAt) return false
  return now - record.updatedAt <= SMART_TOUR_STARTING_RECOVERY_WINDOW_MS
}

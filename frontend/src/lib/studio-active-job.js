export const STUDIO_ACTIVE_JOB_KEY = 'smartcorretorai:studio-ia:active-job:v1'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIVE_MODES = new Set(['dynamic_reel', 'free_ai'])
const ACTIVE_LANGUAGES = new Set(['pt-BR', 'en-US'])

export function parseStudioActiveJob(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) return null

  let parsed
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const jobId = String(parsed.jobId || '').trim()
  const mode = String(parsed.mode || '').trim()
  if (!UUID_PATTERN.test(jobId) || !ACTIVE_MODES.has(mode)) return null

  const language = ACTIVE_LANGUAGES.has(String(parsed.language || '').trim())
    ? String(parsed.language).trim()
    : 'pt-BR'
  return { jobId, mode, language }
}

export function readStudioActiveJob(storage) {
  try {
    const raw = storage?.getItem(STUDIO_ACTIVE_JOB_KEY)
    if (!raw) return { record: null, invalid: false }
    const record = parseStudioActiveJob(raw)
    return { record, invalid: !record }
  } catch {
    return { record: null, invalid: false }
  }
}

export function writeStudioActiveJob(storage, record) {
  const normalized = parseStudioActiveJob(JSON.stringify({
    jobId: record?.jobId,
    mode: record?.mode,
    language: record?.language,
  }))
  if (!normalized) throw new Error('invalid_studio_active_job')
  storage?.setItem(STUDIO_ACTIVE_JOB_KEY, JSON.stringify(normalized))
  return normalized
}

export function clearStudioActiveJob(storage, expectedJobId = '') {
  try {
    if (expectedJobId) {
      const { record } = readStudioActiveJob(storage)
      if (record && record.jobId !== expectedJobId) return false
    }
    storage?.removeItem(STUDIO_ACTIVE_JOB_KEY)
    return true
  } catch {
    return false
  }
}

export function getStudioUiMode(activeMode) {
  return activeMode === 'free_ai' ? 'free_ai' : 'cinematic'
}

export function getStudioActiveMode(uiMode) {
  return uiMode === 'free_ai' ? 'free_ai' : 'dynamic_reel'
}

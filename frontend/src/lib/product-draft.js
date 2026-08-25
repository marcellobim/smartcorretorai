export const PRODUCT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const PRODUCT_DRAFT_PREFIX = 'smartcorretorai:product-draft'

const FORBIDDEN_KEY = /(?:password|passwd|access[_-]?token|accessToken|refresh[_-]?token|refreshToken|provider[_-]?token|providerToken|captcha|secret|service[_-]?role|serviceRole|api[_-]?key|apiKey|authorization|(?:^|_)(?:data|dados|base64|blob|file|preview|signed[_-]?url)(?:$|_))/i
const FORBIDDEN_STRING = /(?:^data:[^,]*;base64,|^blob:|^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$|[?&](?:x-amz-signature|token|signature)=|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isBrowserBinary(value) {
  return (typeof File !== 'undefined' && value instanceof File)
    || (typeof Blob !== 'undefined' && value instanceof Blob)
}

export function getProductDraftStorageKey(productKey, schemaVersion) {
  const safeProductKey = String(productKey || '').trim().toLocaleLowerCase('pt-BR')
  if (!/^[a-z0-9][a-z0-9:_-]{1,79}$/.test(safeProductKey)) throw new Error('invalid_product_draft_key')
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) throw new Error('invalid_product_draft_version')
  return `${PRODUCT_DRAFT_PREFIX}:${safeProductKey}:v${schemaVersion}`
}

export function sanitizeProductDraftValue(value, depth = 0) {
  if (depth > 8 || isBrowserBinary(value)) return undefined
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    if (value.length > 10000 || FORBIDDEN_STRING.test(value)) return undefined
    return value
  }
  if (Array.isArray(value)) {
    if (value.length > 200) return undefined
    const sanitized = value.map(item => sanitizeProductDraftValue(item, depth + 1))
    return sanitized.some(item => item === undefined) ? undefined : sanitized
  }
  if (!isPlainObject(value)) return undefined

  const entries = Object.entries(value)
  if (entries.length > 200) return undefined
  const result = {}
  for (const [key, nestedValue] of entries) {
    if (FORBIDDEN_KEY.test(key)) return undefined
    const sanitized = sanitizeProductDraftValue(nestedValue, depth + 1)
    if (sanitized === undefined) return undefined
    result[key] = sanitized
  }
  return result
}

export function readProductDraft(storage, { productKey, schemaVersion, userId, now = Date.now() }) {
  if (!storage || !userId) return null
  const key = getProductDraftStorageKey(productKey, schemaVersion)
  let parsed
  try {
    parsed = JSON.parse(storage.getItem(key) || 'null')
  } catch {
    try { storage.removeItem(key) } catch { /* optional storage */ }
    return null
  }

  const invalid = !isPlainObject(parsed)
    || parsed.schemaVersion !== schemaVersion
    || parsed.userId !== userId
    || !Number.isFinite(parsed.updatedAt)
    || parsed.updatedAt <= 0
    || now - parsed.updatedAt > PRODUCT_DRAFT_TTL_MS
    || sanitizeProductDraftValue(parsed.data) === undefined

  if (invalid) {
    try { storage.removeItem(key) } catch { /* optional storage */ }
    return null
  }
  return sanitizeProductDraftValue(parsed.data)
}

export function writeProductDraft(storage, { productKey, schemaVersion, userId, data, now = Date.now() }) {
  if (!storage || !userId) return false
  const sanitized = sanitizeProductDraftValue(data)
  if (sanitized === undefined || !isPlainObject(sanitized)) return false
  const key = getProductDraftStorageKey(productKey, schemaVersion)
  try {
    storage.setItem(key, JSON.stringify({ schemaVersion, userId, updatedAt: now, data: sanitized }))
    return true
  } catch {
    return false
  }
}

export function clearProductDraft(storage, { productKey, schemaVersion }) {
  if (!storage) return
  try { storage.removeItem(getProductDraftStorageKey(productKey, schemaVersion)) } catch { /* optional storage */ }
}

export function toFileMetadata(file, order = 0) {
  if (!file) return null
  const metadata = {
    name: String(file.name || '').slice(0, 255),
    size: Number(file.size) || 0,
    type: String(file.type || '').slice(0, 120),
    lastModified: Number(file.lastModified) || 0,
    order: Number(order) || 0,
  }
  return metadata.name && metadata.size > 0 ? metadata : null
}

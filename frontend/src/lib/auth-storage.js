const PROVIDER_TOKEN_FIELDS = ['provider_token', 'provider_refresh_token']
const fallbackStorage = new Map()

function browserStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function stripProviderTokens(value) {
  if (!value || typeof value !== 'object') return value

  const sanitized = Array.isArray(value) ? [...value] : { ...value }
  for (const field of PROVIDER_TOKEN_FIELDS) delete sanitized[field]

  for (const [key, nested] of Object.entries(sanitized)) {
    if (nested && typeof nested === 'object') sanitized[key] = stripProviderTokens(nested)
  }
  return sanitized
}

function sanitizeStoredValue(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.stringify(stripProviderTokens(JSON.parse(value)))
  } catch {
    return value
  }
}

export const providerTokenSafeStorage = {
  getItem(key) {
    const storage = browserStorage()
    const stored = storage ? storage.getItem(key) : (fallbackStorage.get(key) ?? null)
    if (stored === null) return null
    const sanitized = sanitizeStoredValue(stored)
    if (sanitized !== stored) {
      if (storage) storage.setItem(key, sanitized)
      else fallbackStorage.set(key, sanitized)
    }
    return sanitized
  },
  setItem(key, value) {
    const sanitized = sanitizeStoredValue(value)
    const storage = browserStorage()
    if (storage) storage.setItem(key, sanitized)
    else fallbackStorage.set(key, sanitized)
  },
  removeItem(key) {
    const storage = browserStorage()
    if (storage) storage.removeItem(key)
    else fallbackStorage.delete(key)
  },
}

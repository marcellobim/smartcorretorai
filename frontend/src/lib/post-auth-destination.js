// Only symbolic, product-owned destinations may survive an authentication
// round-trip. Never persist or redirect to an arbitrary path or URL.
export const POST_AUTH_DESTINATIONS = Object.freeze({
  home: '/dashboard',
  real_estate_banner: '/hero',
  virtual_staging: '/virtual-staging',
})

export const POST_AUTH_RETURN_KEY = 'snetia:post-auth-destination:v1'

export function normalizePostAuthDestination(value) {
  const key = String(value || '').trim()
  return Object.prototype.hasOwnProperty.call(POST_AUTH_DESTINATIONS, key) ? key : 'home'
}

export function postAuthPath(value) {
  return POST_AUTH_DESTINATIONS[normalizePostAuthDestination(value)]
}

export function authEntryPath(route, destination = 'home') {
  const target = normalizePostAuthDestination(destination)
  return `${route}?next=${encodeURIComponent(target)}`
}

export function readPostAuthDestination(search = '') {
  try {
    return normalizePostAuthDestination(new URLSearchParams(search).get('next'))
  } catch {
    return 'home'
  }
}

export function preservePostAuthDestination(destination, storage = globalThis.sessionStorage) {
  const target = normalizePostAuthDestination(destination)
  try { storage?.setItem(POST_AUTH_RETURN_KEY, target) } catch { /* storage is optional */ }
  return target
}

export function capturePostAuthDestination(search = '', storage = globalThis.sessionStorage) {
  return preservePostAuthDestination(readPostAuthDestination(search), storage)
}

export function takePostAuthDestination(storage = globalThis.sessionStorage) {
  try {
    const target = storage?.getItem(POST_AUTH_RETURN_KEY)
    storage?.removeItem(POST_AUTH_RETURN_KEY)
    return target ? postAuthPath(target) : null
  } catch {
    return null
  }
}

export function peekPostAuthDestination(storage = globalThis.sessionStorage) {
  try {
    const target = storage?.getItem(POST_AUTH_RETURN_KEY)
    return target ? postAuthPath(target) : null
  } catch {
    return null
  }
}

export function authCallbackUrl(destination = 'home', origin = globalThis.location?.origin) {
  const safeOrigin = String(origin || '').trim()
  if (!safeOrigin) throw new Error('auth_origin_missing')
  return `${safeOrigin}/auth/callback?next=${encodeURIComponent(normalizePostAuthDestination(destination))}`
}

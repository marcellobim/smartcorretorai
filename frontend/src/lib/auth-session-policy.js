export const AUTH_SESSION_TRANSITION = Object.freeze({
  INITIAL: 'initial',
  SILENT_REFRESH: 'silent_refresh',
  SAME_USER: 'same_user',
  SIGNED_OUT: 'signed_out',
  IDENTITY_CHANGE: 'identity_change',
})

export function classifyAuthSessionTransition({ event, initialResolved, currentUserId, nextUserId }) {
  if (!initialResolved) return AUTH_SESSION_TRANSITION.INITIAL
  if (!nextUserId) return AUTH_SESSION_TRANSITION.SIGNED_OUT
  if (!currentUserId || currentUserId !== nextUserId) return AUTH_SESSION_TRANSITION.IDENTITY_CHANGE
  if (event === 'TOKEN_REFRESHED') return AUTH_SESSION_TRANSITION.SILENT_REFRESH
  return AUTH_SESSION_TRANSITION.SAME_USER
}

export function blocksAuthenticatedTree(transition) {
  return transition === AUTH_SESSION_TRANSITION.INITIAL
    || transition === AUTH_SESSION_TRANSITION.IDENTITY_CHANGE
}

export function readJwtAssuranceLevel(accessToken) {
  if (typeof accessToken !== 'string') return null
  const payload = accessToken.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = JSON.parse(globalThis.atob(padded))
    return typeof decoded?.aal === 'string' ? decoded.aal : null
  } catch {
    return null
  }
}

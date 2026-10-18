export const VIRTUAL_STAGING_TRIAL_QUERY_KEY = 'trial'
export const VIRTUAL_STAGING_TRIAL_QUERY_VALUE = 'landing-virtual-staging'
export const VIRTUAL_STAGING_TRIAL_RETURN_KEY = 'snetia:virtual-staging-trial:return:v1'

export const virtualStagingTrialPath = () => `/virtual-staging?${VIRTUAL_STAGING_TRIAL_QUERY_KEY}=${VIRTUAL_STAGING_TRIAL_QUERY_VALUE}`

export function isVirtualStagingTrialSearch(search = '') {
  try {
    return new URLSearchParams(search).get(VIRTUAL_STAGING_TRIAL_QUERY_KEY) === VIRTUAL_STAGING_TRIAL_QUERY_VALUE
  } catch {
    return false
  }
}

// The pending marker contains no identity, briefing, media or entitlement. Server-side
// credit rules remain the authority for eligibility and one-use enforcement.
export function preserveVirtualStagingTrialReturn(storage = globalThis.sessionStorage) {
  try { storage?.setItem(VIRTUAL_STAGING_TRIAL_RETURN_KEY, 'pending') } catch { /* storage is optional */ }
}

export function takeVirtualStagingTrialReturn(storage = globalThis.sessionStorage) {
  try {
    if (storage?.getItem(VIRTUAL_STAGING_TRIAL_RETURN_KEY) !== 'pending') return null
    storage.removeItem(VIRTUAL_STAGING_TRIAL_RETURN_KEY)
    return virtualStagingTrialPath()
  } catch {
    return null
  }
}

export function hasVirtualStagingTrialReturn(storage = globalThis.sessionStorage) {
  try { return storage?.getItem(VIRTUAL_STAGING_TRIAL_RETURN_KEY) === 'pending' } catch { return false }
}

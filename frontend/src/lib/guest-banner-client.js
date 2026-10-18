import { supabase } from './supabase'

export const GUEST_CLAIM_PENDING = 'smartcorretorai:guest:claim-pending'

// Transport code exposes stable error codes only. The active UI catalog owns
// the customer-facing wording, so a persisted market selection is respected.
export function guestBannerErrorCode(value) {
  return typeof value === 'string' && value ? value : 'guest_unavailable'
}

export async function guestBannerRequest(action, payload = {}) {
  const headers = {'Content-Type':'application/json'}
  if(action==='claim') {
    const {data}=await supabase.auth.getSession()
    if(!data.session?.access_token) {
      const error = Error('authentication_required')
      error.code = 'authentication_required'
      throw error
    }
    headers.Authorization=`Bearer ${data.session.access_token}`
  }
  const response=await fetch('/api/guest-banner',{method:'POST',credentials:'same-origin',headers,
    body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(55000)})
  const result=await response.json()
  if(!response.ok || result.error) {
    const error=Error(guestBannerErrorCode(result.error))
    error.code=guestBannerErrorCode(result.error)
    throw error
  }
  return result
}

export function guestResultForBanner(result, destination = {}) {
  const job={jobId:'guest-banner',formatId:destination.id || 'instagram_feed',formatLabel:destination.label || 'Banner Imobiliário',
    ideaNumber:1,generationId:result.requestId,status:'completed',imageUrl:result.imageUrl,texts:result.texts || {}}
  return {sourceId:result.requestId,jobs:[job],imageUrl:result.imageUrl,texts:result.texts || {}}
}

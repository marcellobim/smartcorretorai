import { supabase } from './supabase'

export const GUEST_CLAIM_PENDING = 'smartcorretorai:guest:claim-pending'
export async function guestBannerRequest(action, payload = {}) {
  const headers = {'Content-Type':'application/json'}
  if(action==='claim') {
    const {data}=await supabase.auth.getSession()
    if(!data.session?.access_token)throw Error('Entre na sua conta para continuar.')
    headers.Authorization=`Bearer ${data.session.access_token}`
  }
  const response=await fetch('/api/guest-banner',{method:'POST',credentials:'same-origin',headers,
    body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(55000)})
  const result=await response.json()
  if(!response.ok || result.error) {
    const error=Error(result.error==='promotion_used'
      ? 'Seu teste grátis já foi utilizado. Crie sua conta para continuar criando.'
      : result.error==='promotion_capacity'
        ? 'O teste grátis está temporariamente indisponível por limite de capacidade. Crie sua conta ou entre para continuar.'
        : 'Não foi possível concluir. Tente novamente.')
    error.code=result.error
    throw error
  }
  return result
}

export function guestResultForBanner(result, destination = {}) {
  const job={jobId:'guest-banner',formatId:destination.id || 'instagram_feed',formatLabel:destination.label || 'Banner Imobiliário',
    ideaNumber:1,generationId:result.requestId,status:'completed',imageUrl:result.imageUrl,texts:result.texts || {}}
  return {sourceId:result.requestId,jobs:[job],imageUrl:result.imageUrl,texts:result.texts || {}}
}

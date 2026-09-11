// Guest uses the official Banner renderer supplied by index.ts. No ST routines.
import { startGuestPromotion } from '../../../server/guest-banner/promotion.mjs'
import { claimGuestResult } from '../../../server/guest-banner/result.mjs'

const HASH = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f-]{36}$/i
const BUCKET = 'smartcorretor-assets'
type RecordValue = Record<string, any>

export async function handleGuestBanner(payload: RecordValue, db: any, renderer: any) {
  const sessionHash = payload.sessionHash
  if (!HASH.test(sessionHash || '')) throw Error('invalid_session')
  // This read is denied to anon/authenticated by existing guest table grants.
  // Thus the service credential must be valid before any provider or storage I/O.
  const { data: session, error } = await db.from('guest_banner_sessions').select('id,expires_at')
    .eq('token_hash', sessionHash).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error || !session) throw Error('session_required')
  const rpc = async (name: string, args: RecordValue) => {
    const result = await db.rpc(name, args)
    if (result.error) throw Error('guest_storage_unavailable')
    return result.data
  }
  const storage = db.storage.from(BUCKET)
  const path = (id: string, name: string) => `guest-banner/${id}/${name}`
  const write = async (id: string, data: RecordValue, name = 'state.json') => {
    const result = await storage.upload(path(id,name),new Blob([JSON.stringify(data)],{type:'application/json'}),{upsert:true,contentType:'application/json'})
    if(result.error)throw Error('guest_storage_unavailable')
  }
  const read = async (id: string) => {
    const result=await storage.download(path(id,'state.json'))
    if(result.error)throw Error('guest_storage_unavailable')
    return JSON.parse(await result.data.text())
  }
  if (payload.action === 'guest_generate') {
    if (!HASH.test(payload.networkHash || '') || !HASH.test(payload.claimHash || '') || !UUID.test(payload.clientRequestId || '')) throw Error('invalid_request')
    // Individual eligibility precedes rate/capacity checks and preparation.
    const existing = await db.from('guest_banner_requests').select('id,status,client_request_id')
      .eq('session_id',session.id).in('status',['reserved','dispatching','unknown','completed']).maybeSingle()
    if(existing.error)throw Error('guest_storage_unavailable')
    if(existing.data) return existing.data.status === 'completed' && existing.data.client_request_id !== payload.clientRequestId
      ? {error:'promotion_used'}
      : {requestId:existing.data.id,status:existing.data.status,replayed:true}
    let stored: RecordValue
    return await startGuestPromotion(payload, {
      rpc,
      prepare: renderer.prepare,
      persistPrepared: async (id: string, prepared: RecordValue) => {
        stored = { briefing: prepared.storedBriefing, size:prepared.size, claimHash:payload.claimHash, expiresAt:session.expires_at }
        await write(id,stored)
      },
      dispatch: renderer.dispatch,
      persistDispatched: async(id: string, response: RecordValue) => write(id,{...stored,...response}),
    })
  }
  const query = await db.from('guest_banner_requests').select('id,status').eq('session_id',session.id)
    .neq('status','cancelled').order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(query.error)throw Error('guest_storage_unavailable')
  if(!query.data)return {status:'available'}
  const request=query.data
  if(!['dispatching','completed'].includes(request.status))return {status:request.status,requestId:request.id}
  const state=await read(request.id)
  if(!state.responseId)return {status:'unknown',requestId:request.id}
  // Status polling only reads an existing provider response. It never dispatches.
  if(request.status==='dispatching') {
    const response=await renderer.poll(state.responseId)
    if(['queued','in_progress','pending'].includes(response.status))return {status:'processing',requestId:request.id}
    if(response.status!=='completed') {
      await rpc('guest_banner_finish',{p_request_id:request.id,p_status:'failed',p_artifact_ref:null,p_claim_hash:null,p_cost_microusd:null})
      return {status:'failed',requestId:request.id}
    }
    let artifact
    try { artifact=renderer.result(response,state.briefing) } catch {
      await rpc('guest_banner_finish',{p_request_id:request.id,p_status:'failed',p_artifact_ref:null,p_claim_hash:null,p_cost_microusd:null})
      return {status:'failed',requestId:request.id}
    }
    const image=await storage.upload(path(request.id,'banner.jpg'),artifact.image,{upsert:true,contentType:'image/jpeg'})
    if(image.error)throw Error('guest_storage_unavailable')
    // Provider usage is separate from ST. Unknown invoice amounts remain NULL,
    // never a fabricated zero cost. All known usage is retained with the artifact.
    const costMicrousd=artifact.costMicrousd ?? null
    if(costMicrousd!==null && (!Number.isSafeInteger(costMicrousd) || costMicrousd<0))throw Error('invalid_provider_cost')
    await write(request.id,{...state,texts:artifact.texts,usage:artifact.usage,costMicrousd,costBasis:costMicrousd===null?'pending_invoice':'reported'})
    await rpc('guest_banner_finish',{p_request_id:request.id,p_status:'completed',p_artifact_ref:request.id,p_claim_hash:state.claimHash,p_cost_microusd:costMicrousd})
    state.texts=artifact.texts
  }
  if(payload.action==='guest_claim') {
    const auth = renderer.authClient(payload.accessToken)
    const claimed=await claimGuestResult({sessionHash,claimHash:payload.claimHash,accessToken:payload.accessToken},{
      getUser:async(token: string)=>{
        const result=await auth.auth.getUser(token)
        return result.error?null:result.data?.user
      },
      claim:async()=>{
        const result=await auth.rpc('guest_banner_claim',{p_session_hash:sessionHash,p_claim_hash:payload.claimHash})
        if(result.error)throw Error('claim_unavailable')
        return result.data
      },
      readOwnedResult:async(id: string,userId: string)=>{
        const result=await db.from('guest_banner_results').select('artifact_ref,owner_id').eq('id',id).eq('owner_id',userId).single()
        if(result.error || result.data.artifact_ref!==request.id)throw Error('claim_unavailable')
        return result.data
      },
      attachExistingArtifact:async(_artifact: string,userId: string)=>{
    const destination=`${userId}/hero-ia-next/${request.id}/hero-principal.jpg`
    const image=await storage.download(path(request.id,'banner.jpg'))
    if(image.error)throw Error('guest_storage_unavailable')
    const saved=await storage.upload(destination,image.data,{upsert:true,contentType:'image/jpeg'})
    if(saved.error)throw Error('guest_storage_unavailable')
    const inserted=await db.from('hero_generations').upsert({id:request.id,user_id:userId,status:'completed',
      prompt_briefing:state.briefing,texts:state.texts,image_storage_path:destination,
      credit_amount:0,provider:'openai',provider_model:state.model,openai_response_id:state.responseId,
      destination:state.briefing?.choices?.primary_destination || {},expires_at:state.expiresAt,
      completed_at:new Date().toISOString()}, {onConflict:'id',ignoreDuplicates:true})
    if(inserted.error)throw Error('guest_claim_delivery_unavailable')
    const signed=await storage.createSignedUrl(destination,300)
    if(signed.error)throw Error('guest_storage_unavailable')
    return {status:'completed',requestId:request.id,imageUrl:signed.data.signedUrl,texts:state.texts,expiresAt:state.expiresAt}
      },
    })
    if(claimed.error)throw Error(claimed.error)
    return {...claimed.generation,claimed:true}
  }
  const signed=await storage.createSignedUrl(path(request.id,'banner.jpg'),300)
  if(signed.error)throw Error('guest_storage_unavailable')
  return {status:'completed',requestId:request.id,imageUrl:signed.data.signedUrl,texts:state.texts,expiresAt:state.expiresAt}
}

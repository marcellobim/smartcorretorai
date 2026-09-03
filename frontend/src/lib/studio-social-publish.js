const PREFIX = 'smartcorretorai:studio-publication:v1'
const FUNCTION_NAME = 'social-publish-video'
const DESTINATIONS = new Set(['instagram', 'facebook'])
const SOURCE_TYPES = new Set(['studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel'])
const text = value => typeof value === 'string' ? value.trim() : ''
const key = userId => `${PREFIX}:${text(userId)}`

export function buildStudioPublicationIntent({ campaign, field, optionIndex = 0 } = {}) {
  const sourceType = text(campaign?.sourceType)
  const sourceId = text(campaign?.sourceId)
  const optionId = `studio-caption-option-${optionIndex + 1}`
  const captionSnapshot = typeof field?.text === 'string' ? field.text : ''
  if (!SOURCE_TYPES.has(sourceType) || !sourceId || text(campaign?.mediaAssetId) !== sourceId
      || !captionSnapshot || !campaign?.previewUrl || optionIndex < 0 || optionIndex > 2) {
    throw new Error('studio_publication_identity_incomplete')
  }
  return { sourceType, sourceId, mediaAssetId: sourceId, optionId, optionNumber: optionIndex + 1,
    optionLabel: text(field?.label) || `Texto ${optionIndex + 1}`, captionSnapshot,
    mediaName: text(campaign?.sourceProduct) || 'Studio IA', mediaPreviewUrl: campaign.previewUrl, mediaType: 'video' }
}

const pending = intent => ({ sourceType:text(intent?.sourceType), sourceId:text(intent?.sourceId), mediaAssetId:text(intent?.mediaAssetId),
  optionId:text(intent?.optionId), optionNumber:Number(intent?.optionNumber)||0, captionSnapshot:typeof intent?.captionSnapshot === 'string' ? intent.captionSnapshot : '' })
export function preservePendingStudioPublication(storage, userId, intent) { if(!storage||!text(userId))return false; const value=pending(intent); if(!value.sourceType||!value.sourceId||!value.optionId||!value.captionSnapshot)return false; try{storage.setItem(key(userId),JSON.stringify(value));return true}catch{return false} }
export function readPendingStudioPublication(storage, userId) { if(!storage||!text(userId))return null; try{const value=pending(JSON.parse(storage.getItem(key(userId))||'null'));return value.sourceType&&value.sourceId&&value.optionId&&value.captionSnapshot?value:null}catch{return null} }
export function clearPendingStudioPublication(storage, userId) { if(!storage||!text(userId))return false; try{storage.removeItem(key(userId));return true}catch{return false} }
export function restorePendingStudioPublication({ campaign, pending: saved } = {}) { if(!campaign||!saved)return null; const fields=campaign.modules?.flatMap(module=>module.id==='social'?(module.fields||[]):[])||[]; const index=Number(saved.optionNumber)-1; const field=fields[index]; if(!field)return null; try{const value=buildStudioPublicationIntent({campaign,field,optionIndex:index});return value.sourceType===saved.sourceType&&value.sourceId===saved.sourceId&&value.optionId===saved.optionId&&value.captionSnapshot===saved.captionSnapshot?value:null}catch{return null} }

const normalizeDestinations = values => { const result=[...new Set(Array.isArray(values)?values.map(text):[])]; if(!result.length||result.some(value=>!DESTINATIONS.has(value)))throw new Error('studio_publication_destinations_invalid'); return result }
export function buildStudioPublicationRequest(intent, destinations, action='publish') { if(!SOURCE_TYPES.has(intent?.sourceType)||!text(intent?.sourceId)||text(intent?.mediaAssetId)!==text(intent?.sourceId)||!/^studio-caption-option-[1-3]$/.test(text(intent?.optionId))||!intent?.captionSnapshot)throw new Error('studio_publication_identity_incomplete'); return {action,source:{type:intent.sourceType,id:text(intent.sourceId)},media_asset_id:text(intent.mediaAssetId),option_id:text(intent.optionId),caption_snapshot:intent.captionSnapshot,destinations:normalizeDestinations(destinations)} }
const invoke = async (client,intent,destinations,action) => { const {data:sessionData,error:sessionError}=await client.auth.getSession(); const accessToken=sessionData?.session?.access_token; if(sessionError||!accessToken)throw new Error('studio_publication_session_required'); const {data,error}=await client.functions.invoke(FUNCTION_NAME,{body:buildStudioPublicationRequest(intent,destinations,action),headers:{Authorization:`Bearer ${accessToken}`}}); if(error||!data?.ok||!Array.isArray(data.results)||data.smart_tokens!==0)throw new Error(text(data?.code)||'studio_publication_unavailable'); return data }
export const publishStudioPublication=(client,intent,destinations)=>invoke(client,intent,destinations,'publish')
export const recoverStudioPublication=(client,intent,destinations)=>invoke(client,intent,destinations,'recovery')

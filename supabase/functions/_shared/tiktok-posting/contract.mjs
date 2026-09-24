import { requireAuthorizedAdmin, requireAdminAal2 } from '../admin-authorization.ts'
export const MAX_BYTES = 50 * 1024 * 1024
export const PRODUCT = 'studio_ia_commercial'
export const STATES = Object.freeze({
 awaiting_confirmation:['queued','blocked'], queued:['initializing','blocked'],
 initializing:['uploading','failed','reconciliation_required'],
 uploading:['processing','failed','reconciliation_required'],
 processing:['processing','published','failed','reconciliation_required'],
 reconciliation_required:['processing','published','failed'], published:[], blocked:[], failed:[],
})
export const fail = code => { throw new Error(code) }
export const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const strictKeys = (o,keys) => {
 if (!o || typeof o!=='object' || Array.isArray(o) || Object.keys(o).some(k=>!keys.includes(k)) || keys.some(k=>!(k in o))) fail('posting_input_invalid')
}
export function parseIntent(input) {
 strictKeys(input,['creation_id','connection_id','idempotency_key','confirmed_options'])
 if (![input.creation_id,input.connection_id,input.idempotency_key].every(uuid)) fail('posting_input_invalid')
 return input
}
export async function authorizeControl({jwt,auth,admin,environment,appId}) {
 if (!jwt || environment!=='sandbox' || !/^[0-9a-f]{64}$/.test(appId)) fail('posting_unauthorized')
 let result
 try { result=await auth.auth.getUser(jwt) } catch { fail('posting_unauthorized') }
 if (result.error || !uuid(result.data?.user?.id)) fail('posting_unauthorized')
 await requireAuthorizedAdmin(admin,result.data.user.id)
 await requireAdminAal2(auth,jwt)
 return {userId:result.data.user.id,environment,appId}
}
export function validateOptions(options,creator,durationMs) {
 const flags=['disable_comment','disable_duet','disable_stitch','brand_content_toggle','brand_organic_toggle','is_aigc']
 strictKeys(options,['title','privacy_level',...flags])
 strictKeys(creator,['privacy_level_options','comment_disabled','duet_disabled','stitch_disabled','max_video_post_duration_sec'])
 const levels=['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY']
 if (typeof options.title!=='string' || options.title.length>2200 || !levels.includes(options.privacy_level) ||
 !Array.isArray(creator.privacy_level_options) || creator.privacy_level_options.some(x=>!levels.includes(x)) ||
 !creator.privacy_level_options.includes(options.privacy_level) || flags.some(k=>typeof options[k]!=='boolean') || options.is_aigc!==true ||
 !Number.isFinite(creator.max_video_post_duration_sec) || creator.max_video_post_duration_sec<=0 ||
 durationMs>creator.max_video_post_duration_sec*1000) fail('posting_options_invalid')
 for (const kind of ['comment','duet','stitch']) {
  if (typeof creator[kind+'_disabled']!=='boolean' || (creator[kind+'_disabled'] && !options['disable_'+kind])) fail('posting_options_invalid')
 }
 if (options.brand_content_toggle && options.privacy_level==='SELF_ONLY') fail('posting_options_invalid')
 return structuredClone(options)
}
export function validateTransition(job,next,{revision,claim,now=Date.now(),providerStatus}={}) {
 if (job.revision!==revision || !claim || job.claim_token!==claim || !Number.isFinite(Date.parse(job.claim_expires_at)) || Date.parse(job.claim_expires_at)<=now) fail('posting_cas_conflict')
 if (!STATES[job.status]?.includes(next) || (job.status==='reconciliation_required' && !job.publish_id)) fail('posting_transition_invalid')
 if(next==='initializing' && job.init_attempts!==0) fail('posting_transition_invalid')
 if(next==='published' && providerStatus!=='PUBLISH_COMPLETE') fail('posting_provider_incomplete')
 if(next==='failed' && providerStatus!=='FAILED') fail('posting_failure_unconfirmed')
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value
export async function fingerprint(value) { return sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))) }
export async function prepareJob({input,identity,readCreation,readConnection,inspectObject,probe,creator,creatorCheckedAt,now=Date.now()}) {
 const intent=parseIntent(input)
 if(identity.environment!=='sandbox' || !uuid(identity.userId) || !/^[0-9a-f]{64}$/.test(identity.appId)) fail('posting_identity_invalid')
 const creation=await readCreation(intent.creation_id)
 const objectPath=identity.userId+'/'+intent.creation_id+'/video.mp4'
 if(!creation || creation.id!==intent.creation_id || creation.user_id!==identity.userId || creation.status!=='completed' ||
 creation.mode!=='dynamic_reel' || creation.output_video_path!==objectPath) fail('posting_creation_invalid')
 // source_type is a server-derived product mapping, not a column presumed to exist on video_jobs.
 const connection=await readConnection(intent.connection_id)
 if(!connection || connection.id!==intent.connection_id || connection.user_id!==identity.userId || connection.environment!=='sandbox' ||
 connection.app_id!==identity.appId || connection.connection_status!=='active' || !connection.open_id) fail('posting_connection_invalid')
 const media=await inspectObject({bucket:'studio-videos',objectPath})
 if(!media || media.contentType!=='video/mp4' || !Number.isSafeInteger(media.size) || media.size<=0 || media.size>MAX_BYTES) fail('posting_media_invalid')
 // Probe must inspect actual bytes in a trusted server process; no generation-parameter fallback.
 const info=await probe({bucket:'studio-videos',objectPath,etag:media.etag,version:media.version,size:media.size})
 if(!info || info.container!=='mp4' || !['h264','hevc'].includes(info.codec) ||
 ![info.width,info.height].every(x=>Number.isSafeInteger(x)&&x>=360&&x<=4096) ||
 !Number.isSafeInteger(info.durationMs) || info.durationMs<=0 || info.durationMs>600000 ||
 !Number.isFinite(info.fps) || info.fps<23 || info.fps>60 ||
 info.size!==media.size || info.etag!==media.etag || info.version!==media.version ||
 !/^[0-9a-f]{64}$/.test(info.sha256)) fail('posting_probe_invalid')
 const checked=Date.parse(creatorCheckedAt)
 if(!Number.isFinite(checked) || checked>now || now-checked>300000) fail('posting_consent_stale')
 const options=validateOptions(intent.confirmed_options,creator,info.durationMs)
 const job={
 user_id:identity.userId,connection_id:connection.id,environment:'sandbox',app_id:identity.appId,connection_open_id:connection.open_id,
 creation_id:creation.id,product:PRODUCT,bucket:'studio-videos',object_path:objectPath,object_etag:media.etag??null,object_version:media.version??null,
 content_sha256:info.sha256,content_type:'video/mp4',content_length:media.size,width:info.width,height:info.height,duration_ms:info.durationMs,codec:info.codec,
 idempotency_key:intent.idempotency_key,confirmed_options:options,creator_info_snapshot:structuredClone(creator),
 creator_info_checked_at:creatorCheckedAt,confirmed_at:new Date(now).toISOString(),consent_version:'tiktok-commercial-v1',
 }
 // Stable across retries; timestamps/creator snapshot revalidation are not user intent.
 job.request_fingerprint=await fingerprint({user:job.user_id,connection:job.connection_id,environment:job.environment,app:job.app_id,
 creation:job.creation_id,product:job.product,media:job.content_sha256,options,consent:job.consent_version})
 return job
}
export async function createJobFromControl(deps) {
 const identity=await authorizeControl(deps)
 const job=await prepareJob({...deps,identity})
 return deps.repository.create(job)
}
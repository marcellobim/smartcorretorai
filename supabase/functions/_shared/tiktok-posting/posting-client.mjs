import {parseCreatorInfo,confirmedPostInfo} from './posting-options.mjs'

// Backend-only, mandatory injected transport. Never mounted as a public endpoint.
// Limits are per client instance: future multi-worker admission must be coordinated.
export const POSTING_LIMITS=Object.freeze({creator:20,init:6,status:30,windowMs:60000})
const PATHS=Object.freeze({creator:'creator_info/query/',init:'video/init/',status:'status/fetch/'})
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_.~:-]{1,64}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const providerCode=v=>typeof v==='string'&&/^[a-z0-9_.-]{1,64}$/i.test(v)?v:null
const providerMessage=v=>{
 if(typeof v!=='string')return null
 const message=v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()
 return message&&message.length<=240&&/^[\p{L}\p{N} .,:;()'"!?_-]+$/u.test(message)&&!/(bearer|\baccess\b|refresh|token|authorization|https?:\/\/|upload_url|open_id)/i.test(message)?message:null
}
const providerLogId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)?v:null
const groups={
 auth_scope:['access_token_invalid','scope_not_authorized','token_not_authorized_for_specified_publish_id','auth_removed'],
 creator_restriction:['spam_risk_too_many_posts','spam_risk_user_banned_from_posting','reached_active_user_cap','unaudited_client_can_only_post_to_private_accounts'],
 invalid_media:['file_format_check_failed','duration_check_failed','frame_rate_check_failed','picture_size_check_failed'],
 invalid_options:['invalid_param','privacy_level_option_mismatch','spam_risk_text'],
 provider_temporary:['internal','internal_error','video_pull_failed','photo_pull_failed'],
 provider_permanent:['invalid_publish_id','publish_cancelled','spam_risk','url_ownership_unverified'],
}
export function classifyPostingError(code,httpStatus=0){
 if(httpStatus===401||httpStatus===403&&groups.auth_scope.includes(code))return 'auth_scope'
 if(httpStatus===429||code==='rate_limit_exceeded')return 'rate_limit'
 if(httpStatus>=500)return 'provider_temporary'
 for(const [category,codes] of Object.entries(groups))if(codes.includes(code))return category
 return 'unknown_ambiguous'
}
function error(category,operation,ambiguous=false,extra={}){
 return {ok:false,error:{category,operation,ambiguous,retry_automatically:false,...extra}}
}
// Keep int64 post IDs exact without a dependency; quoted JSON strings are untouched.
function losslessJson(raw){
 return JSON.parse(raw.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
  token=>token[0]!=='"'&&/^-?\d+$/.test(token)&&!Number.isSafeInteger(Number(token))?JSON.stringify(token):token))
}
async function readPayload(response){
 if(!response.body)throw Error('missing_body')
 const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',size=0
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength
   if(size>131072)throw Error('response_limit');raw+=decoder.decode(value,{stream:true})}
  raw+=decoder.decode();return losslessJson(raw)
 } finally {try{await reader.cancel()}catch{}}
}
export function parsePostingStatus(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return error('unknown_ambiguous','status')
 const s=data.status
 const map={PROCESSING_UPLOAD:'processing',PROCESSING_DOWNLOAD:'processing',PUBLISH_COMPLETE:'published',FAILED:'failed'}
 if(!Object.hasOwn(map,s)){
  // Known but incompatible transports cannot enter Phase A's FILE_UPLOAD workflow.
  const known=['SEND_TO_USER_INBOX'].includes(s)?s:null
  return error('unknown_ambiguous','status',true,{provider_status:known})
 }
 const output={provider_status:s,status:map[s],provider_post_ids:[]}
 if(data.publicaly_available_post_id!==undefined){
  const ids=data.publicaly_available_post_id
  if(!Array.isArray(ids)||ids.length>100||ids.some(v=>!(typeof v==='string'&&/^[0-9]{1,20}$/.test(v)||Number.isSafeInteger(v)&&v>0)))
   return error('unknown_ambiguous','status',true,{provider_status:s})
  output.provider_post_ids=ids.map(String)
 }
 if(s==='FAILED'){
  // Never copy an arbitrary fail_reason, message, log_id or raw provider response.
  output.error_category=classifyPostingError(data.fail_reason)
 }
 return {ok:true,data:output}
}
export function createPostingClient({fetcher,now=Date.now,timeoutMs=20000,pullOrigin}={}){
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>20000||typeof pullOrigin!=='string')
  throw Error('posting_client_configuration')
 let allowedPullOrigin
 try{allowedPullOrigin=new URL(pullOrigin).origin;if(allowedPullOrigin!==pullOrigin||!allowedPullOrigin.startsWith('https://'))throw Error()}catch{throw Error('posting_client_configuration')}
 const history={creator:[],init:[],status:[]}
 async function request(operation,accessToken,body){
  if(typeof accessToken!=='string'||!accessToken.trim()||/[\r\n]/.test(accessToken))return error('auth_scope',operation)
  const time=now()
  if(!Number.isFinite(time))return error('unknown_ambiguous',operation)
  history[operation]=history[operation].filter(t=>time-t<POSTING_LIMITS.windowMs)
  if(history[operation].length>=POSTING_LIMITS[operation])
   return error('rate_limit',operation,false,{retry_after_ms:Math.max(0,history[operation][0]+POSTING_LIMITS.windowMs-time)})
  history[operation].push(time)
  const controller=new AbortController()
  let timer
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'))},timeoutMs)})
  try{
   const work=(async()=>{
    const r=await fetcher('https://open.tiktokapis.com/v2/post/publish/'+PATHS[operation],{
     method:'POST',redirect:'error',signal:controller.signal,
     headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json; charset=UTF-8'},
     body:JSON.stringify(body)})
    let payload
    try{payload=await readPayload(r)}catch{
     return error(classifyPostingError(null,r.status),operation,operation==='init')
    }
    if(!r.ok||payload?.error?.code!=='ok'){
     const code=providerCode(payload?.error?.code),category=classifyPostingError(code,r.status)
     const diagnostic=operation==='init'&&code&&code!=='ok'?{httpStatus:r.status,providerCode:code,providerMessage:providerMessage(payload?.error?.message),providerLogId:providerLogId(payload?.error?.log_id??payload?.error?.logid)}:{}
     return error(category,operation,operation==='init'&&['provider_temporary','unknown_ambiguous'].includes(category),diagnostic)
    }
    return {ok:true,data:payload.data}
   })()
   return await Promise.race([work,deadline])
  }catch{return error('unknown_ambiguous',operation,operation==='init')}
  finally{clearTimeout(timer)}
 }
 return Object.freeze({
  async creatorInfo({accessToken}){
   const r=await request('creator',accessToken,{})
   if(!r.ok)return r
   try{return {ok:true,data:parseCreatorInfo(r.data)}}catch(e){
    return error(e.message==='creator_restriction'?'creator_restriction':'unknown_ambiguous','creator')
   }
  },
  async init({accessToken,postInfo,videoUrl}){
   let payload
   try{const url=new URL(videoUrl);if(url.origin!==allowedPullOrigin||url.pathname!=='/api/tiktok-video'||!uuid(url.searchParams.get('j'))||!url.searchParams.get('e')||!url.searchParams.get('s')||[...url.searchParams.keys()].some(k=>!['j','e','s'].includes(k)))throw Error();payload={post_info:postInfo,source_info:{source:'PULL_FROM_URL',video_url:url.toString()}}}catch{return error('invalid_media','init')}
   const r=await request('init',accessToken,payload)
   if(!r.ok)return r
   if(!id(r.data?.publish_id))return error('unknown_ambiguous','init',true)
   return Object.freeze({ok:true,publishId:r.data.publish_id})
  },
  async status({accessToken,publishId}){
   if(!id(publishId))return error('invalid_options','status')
   const r=await request('status',accessToken,{publish_id:publishId})
   return r.ok?parsePostingStatus(r.data):r
  },
 })
}

import {createClient} from 'npm:@supabase/supabase-js@2'
import {loadTikTokConfiguration} from '../_shared/tiktok/environment.ts'
import {loadTikTokTokenKeyringFromEnvironment,decryptTikTokToken} from '../_shared/tiktok/token-crypto.ts'
import {authorizeControl,MAX_BYTES} from '../_shared/tiktok-posting/contract.mjs'
import {probeMp4} from '../_shared/tiktok-posting/mp4-probe.ts'
import {createPostingClient} from '../_shared/tiktok-posting/posting-client.mjs'
import {postingRepository} from '../_shared/tiktok-posting/repository.mjs'
import {createPostingService} from './service.mjs'
import {createDraftService} from './draft-service.mjs'
import {createPostingHandler} from './handler.mjs'
const config=await loadTikTokConfiguration(n=>Deno.env.get(n))
const url=Deno.env.get('SUPABASE_URL')!,credential=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(url,credential,{auth:{persistSession:false}})
const ring=await loadTikTokTokenKeyringFromEnvironment(n=>Deno.env.get(n))
const signing=await crypto.subtle.importKey('raw',new TextEncoder().encode(credential),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
const enc=new TextEncoder(),dec=new TextDecoder()
const b64=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
const pullOrigin=String(Deno.env.get('TIKTOK_PULL_PUBLIC_ORIGIN')||'').replace(/\/$/,'')
if(!/^https:\/\/[a-z0-9.-]+$/i.test(pullOrigin))throw Error('tiktok_pull_origin_required')
const pullSignature=async(jobId:string,expires:number)=>b64(new Uint8Array(await crypto.subtle.sign('HMAC',signing,enc.encode(`tiktok-pull-v1:${jobId}:${expires}`))))
const unb64=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
const scope=(q:any,i:any)=>q.eq('user_id',i.userId).eq('environment','sandbox').eq('app_id',i.appId)
const one=async(q:any)=>{const {data,error}=await q;if(error)throw Error('posting_unavailable');return data}
const client=createPostingClient({fetcher:fetch,pullOrigin})
let initTimes:number[]=[]
const deployment=Deno.env.get('DENO_DEPLOYMENT_ID')||''
const functionVersion=/_(\d+)$/.exec(deployment)?.[1]||'unknown'
const telemetry=(event:any)=>console.log(JSON.stringify({...event,function_version:functionVersion}))
const service=createPostingService({
 repository:postingRepository(admin),client,probe:probeMp4,initTelemetry:telemetry,
 pullUrl:async(job:any)=>{const expires=Math.floor(Date.now()/1000)+21600;return `${pullOrigin}/api/tiktok-video?j=${job.id}&e=${expires}&s=${await pullSignature(job.id,expires)}`},
 creation:(id:string,user:string)=>one(admin.from('video_jobs').select('id,user_id,status,mode,output_video_path').eq('id',id).eq('user_id',user).maybeSingle()),
 connection:(i:any)=>one(scope(admin.from('tiktok_connections').select('*'),i).eq('connection_status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle()),
 latest:(i:any,id:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('creation_id',id).or('status.neq.failed,publish_id.not.is.null,upload_attempts.gt.0').order('created_at',{ascending:false}).limit(1).maybeSingle()),
 byKey:(i:any,key:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('idempotency_key',key).maybeSingle()),
 job:(i:any,id:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('id',id).maybeSingle()),
 async preview(path:string){
  const {data,error}=await admin.storage.from('studio-videos').createSignedUrl(path,300)
  if(error||!data?.signedUrl)throw Error('invalid_media')
  return data.signedUrl
 },
 async bytes(path:string){
  // Path is derived and ownership-checked by the service, never supplied by HTTP.
  const endpoint=new URL('/storage/v1/object/authenticated/studio-videos/'+path.split('/').map(encodeURIComponent).join('/'),url)
  const r=await fetch(endpoint,{headers:{Authorization:'Bearer '+credential,apikey:credential},redirect:'error',signal:AbortSignal.timeout(30000)})
  if(!r.ok||!r.body||Number(r.headers.get('content-length'))>MAX_BYTES||!(r.headers.get('content-type')||'').startsWith('video/mp4'))throw Error('invalid_media')
  const reader=r.body.getReader(),parts:Uint8Array[]=[];let length=0
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES)throw Error('invalid_media');parts.push(value)}}finally{await reader.cancel()}
  const out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out
 },
 access:(c:any,i:any)=>decryptTikTokToken({algorithm:'AES-256-GCM',ciphertext:c.access_token_ciphertext,nonce:c.access_token_nonce,authTag:c.access_token_auth_tag,keyVersion:c.key_version},ring,{environment:'sandbox',appId:i.appId,userId:i.userId,openId:c.open_id,kind:'access'}),
 async seal(payload:any){const body=b64(enc.encode(JSON.stringify(payload)));return body+'.'+b64(new Uint8Array(await crypto.subtle.sign('HMAC',signing,enc.encode('tiktok-prepare-v1:'+body))))},
 async unseal(value:string){try{const parts=value.split('.');if(parts.length!==2||!await crypto.subtle.verify('HMAC',signing,unb64(parts[1]),enc.encode('tiktok-prepare-v1:'+parts[0])))throw Error();return JSON.parse(dec.decode(unb64(parts[0])))}catch{throw Error('preparation_expired')}},
 async uploadFetch(target:any,options:any){
  if(options.method==='POST'){const time=Date.now();initTimes=initTimes.filter(t=>time-t<60000);if(initTimes.length>=6)throw Error('rate_limit');initTimes.push(time)}
  return fetch(target,options)
 }
})
Object.assign(service,createDraftService({
 repository:postingRepository(admin),client,probe:probeMp4,initTelemetry:telemetry,
 creation:(id:string,user:string)=>one(admin.from('video_jobs').select('id,user_id,status,mode,output_video_path').eq('id',id).eq('user_id',user).maybeSingle()),
 connection:(i:any)=>one(scope(admin.from('tiktok_connections').select('*'),i).eq('connection_status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle()),
 latest:(i:any,id:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('creation_id',id).or('status.neq.failed,publish_id.not.is.null,upload_attempts.gt.0').order('created_at',{ascending:false}).limit(1).maybeSingle()),
 byKey:(i:any,key:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('idempotency_key',key).maybeSingle()),job:(i:any,id:string)=>one(scope(admin.from('tiktok_publish_jobs').select('*'),i).eq('id',id).maybeSingle()),
 async preview(path:string){const {data,error}=await admin.storage.from('studio-videos').createSignedUrl(path,300);if(error||!data?.signedUrl)throw Error('invalid_media');return data.signedUrl},
 async bytes(path:string){const endpoint=new URL('/storage/v1/object/authenticated/studio-videos/'+path.split('/').map(encodeURIComponent).join('/'),url);const r=await fetch(endpoint,{headers:{Authorization:'Bearer '+credential,apikey:credential},redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok||!r.body||Number(r.headers.get('content-length'))>MAX_BYTES||!(r.headers.get('content-type')||'').startsWith('video/mp4'))throw Error('invalid_media');const reader=r.body.getReader(),parts:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES)throw Error('invalid_media');parts.push(value)}}finally{await reader.cancel()};const out=new Uint8Array(length);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out},
 access:(c:any,i:any)=>decryptTikTokToken({algorithm:'AES-256-GCM',ciphertext:c.access_token_ciphertext,nonce:c.access_token_nonce,authTag:c.access_token_auth_tag,keyVersion:c.key_version},ring,{environment:'sandbox',appId:i.appId,userId:i.userId,openId:c.open_id,kind:'access'}),
 async seal(payload:any){const body=b64(enc.encode(JSON.stringify(payload)));return body+'.'+b64(new Uint8Array(await crypto.subtle.sign('HMAC',signing,enc.encode('tiktok-prepare-v1:'+body))))},
 async unseal(value:string){try{const parts=value.split('.');if(parts.length!==2||!await crypto.subtle.verify('HMAC',signing,unb64(parts[1]),enc.encode('tiktok-prepare-v1:'+parts[0])))throw Error();return JSON.parse(dec.decode(unb64(parts[0])))}catch{throw Error('preparation_expired')}},
 async uploadFetch(target:any,options:any){if(options.method==='POST'){const time=Date.now();initTimes=initTimes.filter(t=>time-t<60000);if(initTimes.length>=6)throw Error('rate_limit');initTimes.push(time)}return fetch(target,options)},
}))
Deno.serve(createPostingHandler({origin:config.frontendOrigin,service,telemetry,authorize:(jwt:string)=>authorizeControl({jwt,auth:admin,admin,environment:config.environment,appId:config.appId})}))

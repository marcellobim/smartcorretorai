import {useEffect,useRef,useState} from 'react'
import {Music2} from 'lucide-react'
import {useAuth} from '../../lib/auth-context'
import {supabase} from '../../lib/supabase'
import {TIKTOK_LOGIN_KIT_ENABLED} from '../../config/tiktok'
import {prepareTikTokPosting} from './tiktok-posting-payload'
import {readJwtAssuranceLevel} from '../../lib/auth-session-policy'
import {getTikTokCapabilities,getTikTokConnectionStatus} from '../../lib/tiktok-oauth-connection'
import {callTikTokPosting,nextTikTokRecovery,parseTikTokJob,parseTikTokPreparation,postingConfirmation,readTikTokRecovery,writeTikTokRecovery,TIKTOK_JOB_LABELS,TIKTOK_VIDEO_PRODUCT} from '../../lib/tiktok-content-posting'
const settings='/configuracoes/integracoes/tiktok'
const browserStorage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)}
const privacy={PUBLIC_TO_EVERYONE:'Todos',MUTUAL_FOLLOW_FRIENDS:'Amigos',FOLLOWER_OF_CREATOR:'Seguidores',SELF_ONLY:'Somente eu'}
const terminal=new Set(['inbox_delivered','published','failed','blocked'])
const field='mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm'
const button='min-h-12 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50'

// Mounted only in the common real-estate social modal. Meta selection stays independent.
export default function TikTokPublish({intent,caption='',client=supabase}) {
 const {isAdmin,user,accessToken}=useAuth()
 const [verified,setVerified]=useState(null)
 const eligible=TIKTOK_LOGIN_KIT_ENABLED && isAdmin && user?.id && readJwtAssuranceLevel(accessToken)==='aal2'
 useEffect(()=>{
  let active=true;setVerified(null)
  if(eligible)client.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
   .then(({data,error})=>{if(active&&!error&&data?.currentLevel==='aal2')setVerified(accessToken)}).catch(()=>{})
  return()=>{active=false}
 },[eligible,accessToken,client])
 if(!eligible||verified!==accessToken||intent.sourceType!==TIKTOK_VIDEO_PRODUCT||intent.mediaAssetId!==intent.sourceId)return null
 return <TikTokDestination key={user.id+':'+intent.sourceId} creationId={intent.sourceId} caption={caption} userId={user.id} client={client}/>
}
export function TikTokDestination({creationId,caption,userId,client=supabase,storage=browserStorage}) {
 const [connection,setConnection]=useState({loading:true}),[selected,setSelected]=useState(false)
 const [prepared,setPrepared]=useState(null),[job,setJob]=useState(null),[recovery,setRecovery]=useState(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[diagnostic,setDiagnostic]=useState(null),[recoveryError,setRecoveryError]=useState(false),[pendingUncertain,setPendingUncertain]=useState(false)
 const [options,setOptions]=useState({title:caption,privacy_level:'',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false})
 const [commercial,setCommercial]=useState(false),[music,setMusic]=useState(false),[branded,setBranded]=useState(false),[confirmed,setConfirmed]=useState(false)
 const inflight=useRef(false),live=useRef(true)
 const save=value=>{writeTikTokRecovery(storage,userId,creationId,value);if(live.current)setRecovery(value)}
 const clearRecovery=()=>{writeTikTokRecovery(storage,userId,creationId,null);if(live.current){setRecovery(null);setJob(null)}}
 const loadStatus=async saved=>{
  const result=parseTikTokJob(await callTikTokPosting(client,{action:'status',job_id:saved.job_id},userId),creationId)
  const next=nextTikTokRecovery(saved,result)
  if(!next){clearRecovery();return result}
  save(next);if(live.current)setJob(result)
  return result
 }
 const resolvePending=async saved=>{
  const result=await callTikTokPosting(client,{action:'resolve_pending',creation_id:creationId,idempotency_key:saved.idempotency_key},userId)
  if(result?.pending===true){if(live.current)setPendingUncertain(true);return null}
  const jobResult=parseTikTokJob(result,creationId)
  const next=nextTikTokRecovery(saved,jobResult)
  if(!next){clearRecovery();if(live.current)setMessage('O TikTok rejeitou a tentativa anterior antes de aceitar o envio. Você pode preparar uma nova publicação.');return jobResult}
  save(next);if(live.current)setJob(jobResult)
  return jobResult
 }
 useEffect(()=>{
  live.current=true
  try {
   const saved=readTikTokRecovery(storage,userId,creationId)
    if(saved) {
    setRecovery(saved)
    if(saved.job_id) {
     setJob({job_id:saved.job_id,status:saved.status||'reconciliation_required'})
     void loadStatus(saved).catch(e=>{if(live.current)setMessage(e.message)})
    } else void resolvePending(saved).catch(e=>{if(live.current)setMessage(e.message)})
   }
  } catch(e) {setRecoveryError(true);setMessage(e.message)}
  getTikTokConnectionStatus(client).then(async status=>{
   const caps=status.connected?await getTikTokCapabilities(client):null
   if(live.current)setConnection({...status,direct:caps?.direct_post===true,inbox:caps?.inbox_upload===true,loading:false})
  }).catch(()=>{if(live.current)setConnection({loading:false,error:true})})
  return()=>{live.current=false}
 },[creationId,userId,client,storage])
 const checkStatus=async()=>{
  if(!recovery?.job_id||inflight.current)return
  inflight.current=true;setBusy(true)
  try {await loadStatus(recovery);if(live.current)setMessage('')}
  catch(e){if(live.current)setMessage(e.message)}
  finally {inflight.current=false;if(live.current)setBusy(false)}
 }
 useEffect(()=>{
  if(!recovery?.job_id||terminal.has(job?.status))return
  const timer=setInterval(()=>void checkStatus(),15000)
  return()=>clearInterval(timer)
 },[recovery?.job_id,job?.status])
 const prepare=async()=>{
  if(inflight.current||job||recovery||recoveryError)return
  inflight.current=true;setBusy(true);setMessage('');setDiagnostic(null)
  try {
   const response=await callTikTokPosting(client,{action:'draft_prepare',creation_id:creationId},userId)
   // PREPARE can legitimately discover an authorized in-progress submission.
   // It is a job only when it satisfies the strict job contract; otherwise it
   // must satisfy the preparation contract before options are displayed.
   if(response?.job_id){if(live.current)setJob(parseTikTokJob(response,creationId));return}
   const data=parseTikTokPreparation(response,creationId)
   if(live.current)setPrepared(data)
  } catch(e){if(live.current){setMessage(e.message);setDiagnostic(e.tiktokDiagnostic||null)}}
  finally {inflight.current=false;if(live.current)setBusy(false)}
 }
 useEffect(()=>{
  if(selected&&connection.inbox&&!prepared&&!job&&!recovery&&!recoveryError)void prepare()
 },[selected,connection.inbox,prepared,job,recovery,recoveryError])
 const toggle=()=>{
  setSelected(value=>!value)
 }
 const set=(name,value)=>setOptions(o=>({...o,[name]:value}))
  const valid=connection.inbox?Boolean(prepared):prepared&&options.privacy_level&&music&&confirmed&&
  (!commercial||options.brand_content_toggle||options.brand_organic_toggle)&&
  (!options.brand_content_toggle||branded&&['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(options.privacy_level))
 const publish=async()=>{
  if(inflight.current||job||recoveryError||!connection.inbox||(!recovery&&!valid))return
  inflight.current=true;setBusy(true);setMessage('')
  try {
   // Re-read immediately before sending to honor another modal/tab's durable intent.
   const existing=readTikTokRecovery(storage,userId,creationId)
   if(existing?.job_id) {await loadStatus(existing);return}
   if(existing) {await resolvePending(existing);return}
   const pending=existing || recovery || {action:'draft_confirm',creation_id:creationId,idempotency_key:crypto.randomUUID(),preparation:prepared.preparation,product_type:TIKTOK_VIDEO_PRODUCT,status:'reconciliation_required'}
   // Store the key and exact consent/options BEFORE confirm. Failure blocks network.
   save(pending)
   const response=await callTikTokPosting(client,{action:'draft_confirm',creation_id:creationId,idempotency_key:pending.idempotency_key,preparation:pending.preparation},userId)
   const result=parseTikTokJob(response,creationId)
   const next=nextTikTokRecovery(pending,result)
   if(!next)clearRecovery()
   else {save(next);if(live.current)setJob(result)}
  } catch(e){if(live.current)setMessage(e.message)}
  finally {inflight.current=false;if(live.current)setBusy(false)}
 }
 return <div className="mt-3 min-w-0">
  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm font-bold text-slate-800">
   <input type="checkbox" checked={selected} disabled={connection.loading||busy} onChange={toggle} className="h-4 w-4 shrink-0 accent-emerald-600"/>
   <Music2 className="h-5 w-5 shrink-0 text-emerald-700"/><span className="min-w-0 break-words">TikTok {connection.account?.display_name||''}</span>
  </label>
  {selected&&<section aria-label="Opções TikTok" className="mt-3 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
   {connection.loading&&<p role="status">Consultando TikTok…</p>}
   {!connection.loading&&!connection.inbox&&<div><p className="text-sm">{connection.connected?'TikTok conectado. Upload ainda não autorizado.':connection.error?'Não foi possível consultar a conexão TikTok.':'Conecte sua conta TikTok nas Configurações.'}</p><a href={settings} className="mt-3 inline-flex min-h-11 font-bold underline">{connection.connected?'Autorizar envio ao TikTok':'Abrir Configurações → TikTok'}</a></div>}
   {busy&&<p role="status" className="text-sm font-semibold">{recovery?'Verificando publicação…':'Preparando opções TikTok…'}</p>}
   {message&&<p role="alert" className="break-words text-sm text-red-700">{message}</p>}{diagnostic&&<p className="text-xs text-slate-600">Diagnóstico: {diagnostic.stage} / {diagnostic.error}</p>}
   {job?<div><p role="status" className="font-bold">{job.provider_status==='SEND_TO_USER_INBOX'?'Vídeo enviado ao TikTok. Abra a notificação no aplicativo para revisar e publicar.':TIKTOK_JOB_LABELS[job.status]||'Verificar'}</p><p className="mt-2 text-sm">Esta criação já tem um envio registrado. O resultado é recuperado ao reabrir este navegador.</p>{job.failure_stage==='init'&&<p className="mt-2 break-words text-xs text-slate-600">Diagnóstico TikTok: INIT / HTTP {job.provider_http_status} / {job.provider_error_code}{job.provider_error_message?` / ${job.provider_error_message}`:''}{job.provider_log_id?` / log ${job.provider_log_id}`:''}</p>}{!terminal.has(job.status)&&<button type="button" disabled={busy} onClick={checkStatus} className="mt-2 min-h-11 font-bold underline">Atualizar status TikTok</button>}</div>
    :recovery?<div><p role="status" className="font-bold">Verificar</p><p className="mt-2 text-sm">{pendingUncertain?'A confirmação anterior ainda está sendo localizada. Ela não será reenviada automaticamente.':'Verificando a confirmação anterior sem reenviar a publicação.'}</p><button type="button" disabled={busy||!connection.direct} onClick={()=>void resolvePending(recovery).catch(e=>setMessage(e.message))} className={button+' mt-3'}>Localizar envio</button></div>
    :prepared&&connection.inbox?<div className="space-y-4"><video src={prepared.preview_url} controls playsInline preload="metadata" aria-label="Preview TikTok" className="max-h-72 w-full rounded-xl bg-slate-950"/><p className="text-sm">O vídeo será enviado ao seu TikTok. Você receberá uma notificação no aplicativo para revisar, adicionar música e publicar.</p><button type="button" disabled={busy} onClick={publish} className={button+' w-full'}>Enviar ao TikTok</button></div>
    :prepared&&connection.direct?<div className="space-y-4">
     <p className="break-words text-sm">Conta TikTok: <strong>{prepared.creator.creator_nickname}</strong> (@{prepared.creator.creator_username})</p>
     <video src={prepared.preview_url} controls playsInline preload="metadata" aria-label="Preview TikTok" className="max-h-72 w-full rounded-xl bg-slate-950"/>
     <label className="block text-sm font-bold">Legenda TikTok<textarea aria-label="Legenda TikTok" maxLength={2200} value={options.title} onChange={e=>set('title',e.target.value)} className={field+' min-h-28'}/></label>
     <label className="block text-sm font-bold">Privacidade TikTok<select aria-label="Privacidade TikTok" value={options.privacy_level} onChange={e=>set('privacy_level',e.target.value)} className={field}><option value="">Selecione a privacidade</option>{prepared.creator.privacy_level_options.map(level=><option key={level} value={level} disabled={options.brand_content_toggle&&!['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(level)}>{privacy[level]}</option>)}</select></label>
     {['comment','duet','stitch'].map((kind,index)=><label key={kind} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={busy||prepared.creator[kind+'_disabled']} checked={!options['disable_'+kind]} onChange={e=>set('disable_'+kind,!e.target.checked)}/><span>Permitir {['comentários','Duet','Stitch'][index]}{prepared.creator[kind+'_disabled']?' (indisponível nesta conta)':''}</span></label>)}
     <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={commercial} onChange={e=>{setCommercial(e.target.checked);if(!e.target.checked)setOptions(o=>({...o,brand_content_toggle:false,brand_organic_toggle:false}))}}/><span>Este conteúdo promove uma marca, produto ou serviço</span></label>
     {commercial&&<div className="space-y-3 border-l-2 border-slate-200 pl-3">
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={options.brand_organic_toggle} onChange={e=>set('brand_organic_toggle',e.target.checked)}/><span>Minha marca — Conteúdo promocional</span></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={options.brand_content_toggle} disabled={!!options.privacy_level&&!['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(options.privacy_level)} onChange={e=>set('brand_content_toggle',e.target.checked)}/><span>Marca de terceiros — Parceria paga (Todos ou Amigos)</span></label>
     </div>}
     <p className="text-sm">Conteúdo gerado por IA: o TikTok receberá a identificação automática de IA.</p>
     <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={music} onChange={e=>setMusic(e.target.checked)}/><span>Concordo com a <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline">Confirmação de uso de música do TikTok</a>.</span></label>
     {options.brand_content_toggle&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={branded} onChange={e=>setBranded(e.target.checked)}/><span>Concordo com a <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="underline">Política de conteúdo de marca</a>.</span></label>}
     <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Revisei o vídeo, as opções e a identificação de IA e autorizo esta publicação.</span></label>
     <button type="button" disabled={!valid||busy} onClick={publish} className={button+' w-full'}>Publicar no TikTok</button>
    </div>:connection.inbox&&!busy&&!recoveryError&&<button type="button" onClick={prepare} className="min-h-11 font-bold underline">Preparar envio ao TikTok</button>}
  </section>}
 </div>
}

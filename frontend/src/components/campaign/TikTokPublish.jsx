import {useEffect,useRef,useState} from 'react'
import {useAuth} from '../../lib/auth-context'
import {supabase} from '../../lib/supabase'
import {TIKTOK_LOGIN_KIT_ENABLED} from '../../config/tiktok'
const labels={awaiting_confirmation:'Precisa verificar',queued:'Publicando',initializing:'Publicando',uploading:'Publicando',processing:'Processando',published:'Publicado',failed:'Falhou',blocked:'Precisa verificar',reconciliation_required:'Precisa verificar'}
const privacy={PUBLIC_TO_EVERYONE:'Todos',MUTUAL_FOLLOW_FRIENDS:'Amigos',FOLLOWER_OF_CREATOR:'Seguidores',SELF_ONLY:'Somente eu'}
const errors={reauthorization_required:'Autorize novamente a publicação em Configurações → TikTok.',admin_mfa_required:'Confirme a autenticação multifator em Configurações → TikTok.',rate_limit:'Limite temporário do TikTok. Aguarde antes de consultar novamente.',media_changed:'O vídeo mudou. Feche e revise novamente.',preparation_expired:'A revisão expirou. Feche e abra novamente.',creator_restriction:'O TikTok não permite publicar nesta conta agora.'}
export async function callTikTokPosting(client,body){
 const {data,error}=await client.functions.invoke('tiktok-content-posting',{body})
 if(error){let code;try{code=(await error.context.json()).error}catch{}throw Error(errors[code]||'Não foi possível concluir. Reabra para verificar o estado antes de tentar novamente.')}
 if(data?.error)throw Error(errors[data.error]||'Não foi possível concluir a operação.')
 return data
}
export default function TikTokPublish({creationId,previewUrl,caption=''}) {
 const {isAdmin,user}=useAuth()
 const [aal2,setAal2]=useState(false),[open,setOpen]=useState(false)
 useEffect(()=>{let live=true;setAal2(false);if(isAdmin&&TIKTOK_LOGIN_KIT_ENABLED)void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({data,error})=>{if(live)setAal2(!error&&data?.currentLevel==='aal2')}).catch(()=>{});return()=>{live=false}},[isAdmin,user?.id])
 if(!TIKTOK_LOGIN_KIT_ENABLED||!isAdmin||!creationId)return null
 return <div className="rounded-2xl border border-slate-200 bg-white p-4">
  <button type="button" disabled={!aal2} onClick={()=>setOpen(true)} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">TikTok</button>
  {!aal2&&<a className="ml-3 text-sm underline" href="/configuracoes/integracoes/tiktok">Confirmar MFA para publicar</a>}
  {open&&<TikTokPublishDialog key={creationId} creationId={creationId} previewUrl={previewUrl} caption={caption} onClose={()=>setOpen(false)} />}
 </div>
}
export function TikTokPublishDialog({creationId,previewUrl,caption='',onClose,client=supabase}) {
 const [prepared,setPrepared]=useState(null),[job,setJob]=useState(null),[busy,setBusy]=useState(true),[message,setMessage]=useState('')
 const [options,setOptions]=useState({title:caption,privacy_level:'',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false,is_aigc:true})
 const [commercial,setCommercial]=useState(false),[music,setMusic]=useState(false),[branded,setBranded]=useState(false),[confirmed,setConfirmed]=useState(false)
 const key=useRef(crypto.randomUUID()),inflight=useRef(false)
 useEffect(()=>{let live=true;callTikTokPosting(client,{action:'prepare',creation_id:creationId}).then(data=>{if(live){if(data.job)setJob(data.job);else setPrepared(data)}}).catch(e=>{if(live)setMessage(e.message)}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[client,creationId])
 const checkStatus=async()=>{if(!job||inflight.current)return;inflight.current=true;try{const data=await callTikTokPosting(client,{action:'status',job_id:job.job_id});setJob(data.job);setMessage('')}catch(e){setMessage(e.message)}finally{inflight.current=false}}
 useEffect(()=>{if(!job||['published','failed','blocked'].includes(job.status))return;const timer=setInterval(()=>void checkStatus(),15000);return()=>clearInterval(timer)},[job?.job_id,job?.status])
 const set=(name,value)=>setOptions(o=>({...o,[name]:value}))
 const valid=prepared&&options.privacy_level&&music&&confirmed&&(!commercial||options.brand_content_toggle||options.brand_organic_toggle)&&(!options.brand_content_toggle||branded&&['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(options.privacy_level))
 const publish=async()=>{
  if(!valid||inflight.current)return
  inflight.current=true;setBusy(true);setMessage('')
  try{const result=await callTikTokPosting(client,{action:'confirm',creation_id:creationId,idempotency_key:key.current,preparation:prepared.preparation,options,consent:{confirmed,commercial_disclosure:commercial,music_usage_confirmed:music,branded_content_policy_confirmed:branded}});setJob(result.job)}
  catch(e){setMessage(e.message);setPrepared(null)}finally{inflight.current=false;setBusy(false)}
 }
 return <div role="dialog" aria-modal="true" aria-label="Publicar no TikTok" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
 <section className="mx-auto my-6 max-w-xl space-y-4 rounded-2xl bg-white p-5 text-slate-950">
 <div className="flex justify-between"><h2 className="text-xl font-black">Publicar no TikTok</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar">Fechar</button></div>
 {busy&&<p role="status">{prepared?'Publicando…':'Consultando TikTok…'}</p>}
 {message&&<p role="alert" className="text-red-700">{message}</p>}
 {job?<div><p role="status" className="font-bold">{labels[job.status]||'Precisa verificar'}</p><p className="mt-2 text-sm">O vídeo pode levar alguns minutos para aparecer no perfil. Não envie outra publicação enquanto este resultado estiver pendente.</p>{!['published','failed','blocked'].includes(job.status)&&<button type="button" className="mt-3 underline" onClick={checkStatus}>Atualizar status</button>}</div>:prepared&&<>
 <p>Conta: <strong>{prepared.account.display_name}</strong></p>
 <video src={previewUrl} controls preload="metadata" className="max-h-72 w-full rounded-xl" />
 <label className="block">Legenda<textarea aria-label="Legenda" maxLength={2200} value={options.title} onChange={e=>set('title',e.target.value)} className="mt-1 w-full rounded border p-2"/></label>
 <label className="block">Privacidade<select aria-label="Privacidade" value={options.privacy_level} onChange={e=>set('privacy_level',e.target.value)} className="ml-2 rounded border p-2"><option value="">Selecione</option>{prepared.creator.privacy_level_options.map(p=><option key={p} value={p} disabled={options.brand_content_toggle&&!['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(p)}>{privacy[p]}</option>)}</select></label>
 {['comment','duet','stitch'].map((kind,index)=><label key={kind} className="block"><input type="checkbox" disabled={prepared.creator[kind+'_disabled']} checked={!options['disable_'+kind]} onChange={e=>set('disable_'+kind,!e.target.checked)}/> Permitir {['comentários','Duet','Stitch'][index]}{prepared.creator[kind+'_disabled']?' (indisponível nesta conta)':''}</label>)}
 <label className="block"><input type="checkbox" checked={commercial} onChange={e=>{setCommercial(e.target.checked);if(!e.target.checked)setOptions(o=>({...o,brand_content_toggle:false,brand_organic_toggle:false}))}}/> Este conteúdo promove uma marca, produto ou serviço</label>
 {commercial&&<div className="space-y-2 pl-4"><label className="block"><input type="checkbox" checked={options.brand_organic_toggle} onChange={e=>set('brand_organic_toggle',e.target.checked)}/> Minha marca — rótulo “Conteúdo promocional”</label><label className="block"><input type="checkbox" disabled={options.privacy_level!==''&&!['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS'].includes(options.privacy_level)} checked={options.brand_content_toggle} onChange={e=>set('brand_content_toggle',e.target.checked)}/> Marca de terceiros — rótulo “Parceria paga” (visibilidade pública/amigos)</label></div>}
 <p className="text-sm">Conteúdo gerado por IA: identificado automaticamente nesta publicação.</p>
 <label className="block"><input type="checkbox" checked={music} onChange={e=>setMusic(e.target.checked)}/> Ao publicar, concordo com a <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="underline">Confirmação de uso de música do TikTok</a>.</label>
 {options.brand_content_toggle&&<label className="block"><input type="checkbox" checked={branded} onChange={e=>setBranded(e.target.checked)}/> Concordo com a <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="underline">Política de conteúdo de marca</a>.</label>}
 <label className="block"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Revisei o vídeo e as opções e autorizo esta publicação.</label>
 <button type="button" disabled={!valid||busy} onClick={publish} className="w-full rounded-xl bg-slate-950 p-3 font-bold text-white disabled:opacity-50">Publicar no TikTok</button>
 </>}
 </section></div>
}

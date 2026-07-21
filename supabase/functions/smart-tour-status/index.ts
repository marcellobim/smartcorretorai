import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkGeminiOmniVideo } from '../_shared/geminiOmniClient.ts'
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!key) return json({ok:false,error:'Configuração indisponível.'},500)
  const supabase=createClient(url,key,{auth:{persistSession:false}}),token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
  const {data:{user}}=await supabase.auth.getUser(token); if(!user) return json({ok:false,error:'Sua sessão expirou.'},401)
  const body=await req.json().catch(()=>({})),jobId=String(body.jobId||'')
  if(!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ok:false,error:'Criação inválida.'},400)
  const {data:job}=await supabase.from('video_jobs').select('id,status,provider_job_id,output_video_path,error_message').eq('id',jobId).eq('user_id',user.id).maybeSingle()
  if(!job) return json({ok:false,error:'Criação não encontrada.'},404)
  if(job.status==='failed') return json({ok:true,status:'failed',error:'Não foi possível concluir sua apresentação.'})
  if(job.status==='completed'&&job.output_video_path){const {data}=await supabase.storage.from('studio-videos').createSignedUrl(job.output_video_path,3600);return json({ok:true,status:'completed',jobId,signedVideoUrl:data?.signedUrl||''})}
  if(!job.provider_job_id) return json({ok:true,status:'generating',jobId,message:'Preparando sua apresentação...'})
  try{
    const remote=await checkGeminiOmniVideo(job.provider_job_id)
    if(remote.status==='processing') return json({ok:true,status:'generating',jobId,message:'A IA está criando sua apresentação...'})
    if(remote.status==='failed'){await supabase.from('video_jobs').update({status:'failed',error_message:String(remote.errorMessage).slice(0,400)}).eq('id',jobId).eq('user_id',user.id);return json({ok:true,status:'failed',error:'Não foi possível concluir sua apresentação.'})}
    const path=`${user.id}/${jobId}/smart-tour.mp4`
    const {error}=await supabase.storage.from('studio-videos').upload(path,remote.videoBytes,{contentType:remote.contentType||'video/mp4',upsert:true});if(error) throw error
    await supabase.from('video_jobs').update({status:'completed',output_video_path:path,completed_at:new Date().toISOString(),error_message:null}).eq('id',jobId).eq('user_id',user.id)
    const {data}=await supabase.storage.from('studio-videos').createSignedUrl(path,3600)
    return json({ok:true,status:'completed',jobId,signedVideoUrl:data?.signedUrl||''})
  }catch(error){console.warn('[smart-tour-status]',error instanceof Error?error.message:'status_error');return json({ok:false,error:'Não foi possível consultar sua apresentação.'},502)}
})


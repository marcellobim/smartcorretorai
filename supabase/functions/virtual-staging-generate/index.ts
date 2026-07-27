import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { prepareGeminiImages, SMART_TOUR_GEMINI_OMNI_MODEL, startGeminiOmniVideo } from '../_shared/geminiOmniClient.ts'
import { buildSmartTourStructuredBriefing, buildSmartTourVideoPrompt, resolveSmartTourProfessionalPhone, validateSmartTourRequest } from '../_shared/virtual-staging/index.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
const safeError = (error: unknown) => error instanceof Error ? error.message.replace(/AIza[\w-]+/g,'[redacted]').slice(0,240) : 'unknown_error'

serve(withCors(async req => {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ok:false,error:'Configuração indisponível.'},500)
  const supabase = createClient(url,key,{auth:{persistSession:false}})
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'')
  const {data:{user}} = await supabase.auth.getUser(token)
  if (!user) return json({ok:false,error:'Sua sessão expirou.'},401)
  try {
    const input = validateSmartTourRequest(await req.json())
    if (!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)) throw new Error('invalid_request_id')
    if (input.imagePaths.some(path => !path.startsWith(`${user.id}/virtual-staging/${input.clientRequestId}/`) || !/\.(jpg|jpeg|png)$/i.test(path))) throw new Error('invalid_image_owner')
    const {data:objects,error:objectsError} = await supabase.storage.from('studio-videos').list(`${user.id}/virtual-staging/${input.clientRequestId}`,{limit:10})
    const available = new Set((objects || []).map(item => `${user.id}/virtual-staging/${input.clientRequestId}/${item.name}`))
    if (objectsError || input.imagePaths.some(path => !available.has(path))) throw new Error('image_unavailable')
    const {data:existing} = await supabase.from('video_jobs').select('id,status').eq('id',input.clientRequestId).eq('user_id',user.id).maybeSingle()
    if (existing) return json({ok:true,jobId:existing.id,status:existing.status,idempotent:true})
    const {data:profile} = await supabase.from('profiles').select('whatsapp, telefone').eq('id',user.id).maybeSingle()
    const phone = resolveSmartTourProfessionalPhone(input.includeProfessionalPhone, profile?.whatsapp, profile?.telefone)
    const briefing = buildSmartTourStructuredBriefing({generation:input.generation,property:input.property,selectedCta:input.selectedCta,phone,imagePaths:input.imagePaths,language:input.language})
    const prompt = buildSmartTourVideoPrompt(briefing)
    const {error:insertError} = await supabase.from('video_jobs').insert({id:input.clientRequestId,user_id:user.id,status:'pending',mode:'virtual_staging_gemini_omni',style:input.generation.mode,model:SMART_TOUR_GEMINI_OMNI_MODEL,prompt_final:prompt,input_image_1_path:input.imagePaths[0],input_image_2_path:input.imagePaths.at(-1),tokens_reserved:0})
    if (insertError) throw new Error('job_create_failed')
    try {
      const images = await prepareGeminiImages(supabase,'studio-videos',input.imagePaths)
      const started = await startGeminiOmniVideo({prompt,images})
      const { error: providerIdError } = await supabase.from('video_jobs').update({status:'generating',provider_job_id:started.interactionId}).eq('id',input.clientRequestId).eq('user_id',user.id)
      if (providerIdError) throw new Error('provider_id_persist_failed')
      console.info('[virtual-staging-generate] provider_id_persisted', JSON.stringify({ providerIdSource: 'id' }))
      return json({ok:true,jobId:input.clientRequestId,status:'generating'})
    } catch (error) {
      await supabase.from('video_jobs').update({status:'failed',error_message:safeError(error)}).eq('id',input.clientRequestId).eq('user_id',user.id)
      throw error
    }
  } catch (error) {
    console.warn('[virtual-staging-generate]',safeError(error))
    const code = safeError(error)
    const messages: Record<string,string> = {invalid_image_count:'Envie de 1 a 5 imagens válidas.',invalid_image_order:'A ordem das imagens é inválida.',invalid_image_owner:'Uma imagem não pertence à sua conta.',image_unavailable:'Uma das imagens não está disponível.',gemini_omni_missing_environment:'A criação de vídeos está temporariamente indisponível.'}
    return json({ok:false,error:messages[code] || 'Não foi possível iniciar sua apresentação.'},400)
  }
}))

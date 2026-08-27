import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { generateGeminiOmniVideoInline, prepareGeminiImages, SMART_TOUR_GEMINI_OMNI_MODEL, startGeminiOmniVideo } from '../_shared/geminiOmniClient.ts'
import { buildSmartTourStructuredBriefing, buildSmartTourVideoPrompt, encodeSmartTourCaptionRenderId, hasDeterministicSmartTourText, resolveSmartTourProfessionalPhone, startSmartTourCaptionRender, validateSmartTourRequest } from '../_shared/virtual-staging/index.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
import { generateStrategicHashtags } from '../_shared/strategic-hashtags.ts'
import { buildOfficialHashtags } from '../_shared/official-hashtags.ts'
import { persistVirtualSpaceInlineVideo, resolveVirtualSpaceInlineProviderTimeout } from './inline-video-runtime.ts'
import { claimGeminiVideoEconomy, insufficientGeminiVideoTokensResponse, settleGeminiVideoEconomy, updateGeminiVideoEconomyTelemetry } from '../_shared/gemini-video-economy.ts'
import { resolveVirtualStagingVideoProductCode } from './economy.ts'
const safeError = (error: unknown) => error instanceof Error ? error.message.replace(/AIza[\w-]+/g,'[redacted]').slice(0,240) : 'unknown_error'

serve(withCors(async req => {
  const requestStartedAt = Date.now()
  const url = Deno.env.get('SUPABASE_URL'), key = resolveSupabaseAdminCredential().key
  if (!url || !key) return json({ok:false,error:'Configuração indisponível.'},500)
  const supabase = createClient(url,key,{auth:{persistSession:false}})
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'')
  const {data:{user}} = await supabase.auth.getUser(token)
  if (!user) return json({ok:false,error:'Sua sessão expirou.'},401)
  try {
    const input = validateSmartTourRequest(await req.json())
    if (!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)) throw new Error('invalid_request_id')
    const presenterReferencePath = input.presenter_reference?.image_path
    const productCode = resolveVirtualStagingVideoProductCode(input.journeyId)
    const isLifeInProperty = input.generation.mode === 'narrated_tour' && Boolean(input.generation.life_scene)
    const isBrokerPresentation = input.module === 'broker-presentation'
    const activeVerticalVideo = isLifeInProperty || isBrokerPresentation
    if ((productCode === 'life_in_property') !== isLifeInProperty || (productCode === 'broker_presentation') !== isBrokerPresentation) throw new Error('invalid_economic_product')
    if (isLifeInProperty && (input.generation.mode !== 'narrated_tour' || !input.generation.life_scene)) throw new Error('invalid_life_scene')
    if (isBrokerPresentation && (input.module !== 'broker-presentation' || !presenterReferencePath)) throw new Error('invalid_presenter_reference')
    const requestedPaths = presenterReferencePath ? [presenterReferencePath, ...input.imagePaths] : input.imagePaths
    if (requestedPaths.some(path => !path.startsWith(`${user.id}/virtual-staging/${input.clientRequestId}/`) || !/\.(jpg|jpeg|png)$/i.test(path))) throw new Error('invalid_image_owner')
    const {data:objects,error:objectsError} = await supabase.storage.from('studio-videos').list(`${user.id}/virtual-staging/${input.clientRequestId}`,{limit:10})
    const available = new Set((objects || []).map(item => `${user.id}/virtual-staging/${input.clientRequestId}/${item.name}`))
    if (objectsError || requestedPaths.some(path => !available.has(path))) throw new Error('image_unavailable')
    const {data:existing} = await supabase.from('video_jobs').select('id,status,marketing_hashtags').eq('id',input.clientRequestId).eq('user_id',user.id).maybeSingle()
    if (existing) {
      if (existing.status === 'completed' || existing.status === 'failed') await settleGeminiVideoEconomy(supabase,{userId:user.id,clientRequestId:input.clientRequestId,status:existing.status})
      return json({ok:true,jobId:existing.id,status:existing.status,hashtags:existing.marketing_hashtags || [],idempotent:true})
    }
    const {data:profile} = await supabase.from('profiles').select('whatsapp, telefone').eq('id',user.id).maybeSingle()
    const phone = resolveSmartTourProfessionalPhone(input.includeProfessionalPhone, profile?.whatsapp, profile?.telefone)
    const hashtagContext = {purpose:input.property.purpose,propertyType:input.property.type,propertyStage:input.property.stage,city:input.property.city,district:input.property.district,state:input.property.state,bedrooms:input.property.bedrooms,suites:input.property.suites,parkingSpaces:input.property.parkingSpaces,highlights:input.property.highlights,cta:input.selectedCta}
    const fallbackHashtags = activeVerticalVideo ? buildOfficialHashtags(hashtagContext) : []
    const briefing = buildSmartTourStructuredBriefing({generation:input.generation,property:input.property,selectedCta:input.selectedCta,phone,imagePaths:input.imagePaths,language:input.language,presenterReference:input.presenter_reference})
    const prompt = buildSmartTourVideoPrompt(briefing)
    const {error:insertError} = await supabase.from('video_jobs').insert({id:input.clientRequestId,user_id:user.id,status:'pending',mode:'virtual_staging_gemini_omni',style:input.generation.mode,model:SMART_TOUR_GEMINI_OMNI_MODEL,prompt_final:prompt,input_image_1_path:input.imagePaths[0],input_image_2_path:input.imagePaths.at(-1),marketing_hashtags:fallbackHashtags,tokens_reserved:0})
    if (insertError) throw new Error('job_create_failed')
    const economy = await claimGeminiVideoEconomy(supabase,{userId:user.id,clientRequestId:input.clientRequestId,productCode,metadata:{image_count:input.imagePaths.length + (presenterReferencePath ? 1 : 0),output_duration_seconds:10,resolution:'720x1280',fps:24,audio:true,presenter_reference:Boolean(presenterReferencePath)}})
    if (!economy.executionClaimed) {
      if (economy.status === 'insufficient') {
        await supabase.from('video_jobs').update({status:'failed',error_message:'INSUFFICIENT_SMART_TOKENS'}).eq('id',input.clientRequestId).eq('user_id',user.id)
        return json(insufficientGeminiVideoTokensResponse(economy),402)
      }
      return json({ok:true,jobId:input.clientRequestId,status:economy.status,idempotent:true})
    }
    await supabase.from('video_jobs').update({tokens_reserved:325}).eq('id',input.clientRequestId).eq('user_id',user.id)
    let hashtags: string[] = []
    let deliveryPersisted = false
    try {
      hashtags = activeVerticalVideo ? await generateStrategicHashtags({apiKey:Deno.env.get('OPENAI_API_KEY') || '',variationKey:input.clientRequestId,context:hashtagContext}) : []
      if (hashtags.length) await supabase.from('video_jobs').update({marketing_hashtags:hashtags}).eq('id',input.clientRequestId).eq('user_id',user.id)
      const images = await prepareGeminiImages(supabase,'studio-videos',input.imagePaths)
      const presenterImages = presenterReferencePath ? await prepareGeminiImages(supabase,'studio-videos',[presenterReferencePath]) : []
      if (activeVerticalVideo) {
        const generated = await generateGeminiOmniVideoInline({
          prompt,
          images:[...presenterImages,...images],
          aspectRatio:'9:16',
          timeoutMs:resolveVirtualSpaceInlineProviderTimeout(Date.now() - requestStartedAt,110_000),
        })
        const creatomateKey = Deno.env.get('CREATOMATE_API_KEY') || ''
        const persisted = await persistVirtualSpaceInlineVideo({
          userId:user.id,
          jobId:input.clientRequestId,
          ...generated,
          requiresCaptionRender:hasDeterministicSmartTourText(briefing),
        },{
          upload: async (path,videoBytes,contentType) => {
            const {error} = await supabase.storage.from('studio-videos').upload(path,videoBytes,{contentType,upsert:true})
            if (error) throw new Error('video_upload_failed')
          },
          createSignedUrl: async (path,expiresInSeconds) => {
            const {data,error} = await supabase.storage.from('studio-videos').createSignedUrl(path,expiresInSeconds)
            if (error || !data?.signedUrl) throw new Error('result_url_failed')
            return data.signedUrl
          },
          startCaptionRender: async videoUrl => encodeSmartTourCaptionRenderId((await startSmartTourCaptionRender(creatomateKey,videoUrl,briefing)).renderId),
          persistCaptionRender: async providerJobId => {
            const {error} = await supabase.from('video_jobs').update({status:'generating',provider_job_id:providerJobId,error_message:null}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (error) throw new Error('caption_render_persist_failed')
            await updateGeminiVideoEconomyTelemetry(supabase,{userId:user.id,clientRequestId:input.clientRequestId,providerJobId,model:SMART_TOUR_GEMINI_OMNI_MODEL}).catch(() => console.warn('[virtual-staging-generate] economy_telemetry_deferred'))
          },
          persistCompleted: async ({interactionId,outputPath,completedAt}) => {
            const {error} = await supabase.from('video_jobs').update({status:'completed',provider_job_id:interactionId,output_video_path:outputPath,completed_at:completedAt,error_message:null}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (error) throw new Error('job_completed_persist_failed')
            deliveryPersisted = true
          },
        })
        console.info('[virtual-staging-generate] inline_video_completed', JSON.stringify({delivery:'base64',outputBytes:generated.videoBytes.byteLength,captionRenderStarted:persisted.status === 'generating'}))
        if (persisted.status === 'completed') await settleGeminiVideoEconomy(supabase,{userId:user.id,clientRequestId:input.clientRequestId,status:'completed',result:{output_video_path:`${user.id}/${input.clientRequestId}/virtual-staging.mp4`},telemetry:{output_bytes:generated.videoBytes.byteLength}})
        return persisted.status === 'completed'
          ? json({ok:true,jobId:input.clientRequestId,status:'completed',signedVideoUrl:persisted.signedVideoUrl,hashtags})
          : json({ok:true,jobId:input.clientRequestId,status:'generating',hashtags})
      }
      const started = await startGeminiOmniVideo({prompt,images:[...presenterImages,...images],...(activeVerticalVideo ? {aspectRatio:'9:16' as const} : {})})
      const { error: providerIdError } = await supabase.from('video_jobs').update({status:'generating',provider_job_id:started.interactionId}).eq('id',input.clientRequestId).eq('user_id',user.id)
      if (providerIdError) throw new Error('provider_id_persist_failed')
      await updateGeminiVideoEconomyTelemetry(supabase,{userId:user.id,clientRequestId:input.clientRequestId,providerJobId:started.interactionId,model:SMART_TOUR_GEMINI_OMNI_MODEL}).catch(() => console.warn('[virtual-staging-generate] economy_telemetry_deferred'))
      console.info('[virtual-staging-generate] provider_id_persisted', JSON.stringify({ providerIdSource: 'id' }))
      return json({ok:true,jobId:input.clientRequestId,status:'generating',hashtags})
    } catch (error) {
      if (!deliveryPersisted) {
        await supabase.from('video_jobs').update({status:'failed',error_message:safeError(error)}).eq('id',input.clientRequestId).eq('user_id',user.id)
        await settleGeminiVideoEconomy(supabase,{userId:user.id,clientRequestId:input.clientRequestId,status:'failed',reason:safeError(error)})
      }
      throw error
    }
  } catch (error) {
    console.warn('[virtual-staging-generate]',safeError(error))
    const code = safeError(error)
    const messages: Record<string,string> = {invalid_image_count:'Envie de 1 a 5 imagens válidas.',invalid_image_order:'A ordem das imagens é inválida.',invalid_image_owner:'Uma imagem não pertence à sua conta.',image_unavailable:'Uma das imagens não está disponível.',invalid_economic_product:'Esta modalidade não possui configuração econômica válida.',invalid_life_scene:'A opção de Vida no Imóvel é inválida.',invalid_presenter_reference:'Envie exatamente uma foto válida do apresentador.',invalid_property_images:'As fotos do imóvel são inválidas.',invalid_module:'O módulo informado é inválido.',gemini_omni_missing_environment:'A criação de vídeos está temporariamente indisponível.'}
    return json({ok:false,error:messages[code] || 'Não foi possível iniciar sua apresentação.'},400)
  }
}))

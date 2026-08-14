import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES, generateGeminiOmniVideoInline, prepareGeminiImages, SMART_TOUR_GEMINI_OMNI_MODEL } from '../_shared/geminiOmniClient.ts'
import { prepareGeminiVideo, startGeminiOmniShortVideo } from '../_shared/geminiOmniClient.ts'
import { buildSmartTourStructuredBriefing, buildSmartTourVideoPrompt, resolveSmartTourProfessionalPhone, validateSmartTourRequest } from '../_shared/smart-tour/index.ts'
import { applySmartTourDynamicNarration, generateSmartTourDynamicNarration } from '../_shared/smart-tour/index.ts'
import { buildShortVideosCleanGeminiPrompt, buildShortVideosStructuredBriefing, validateShortVideosRequest } from '../_shared/smart-tour/index.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
import { generateStrategicHashtags } from '../_shared/strategic-hashtags.ts'
import { buildOfficialHashtags } from '../_shared/official-hashtags.ts'
import { runShortVideoPipeline } from './short-video-runtime.ts'
import { persistSmartTourInlineVideo, resolveSmartTourInlineProviderTimeout } from './inline-video-runtime.ts'
const safeError = (error: unknown) => error instanceof Error
  ? error.message
    .replace(/AIza[\w-]+/g,'[secret-redacted]')
    .replace(/https?:\/\/[^\s"']+/gi,'[url-redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email-redacted]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g,'[phone-redacted]')
    .slice(0,240)
  : 'unknown_error'
const maskIdentifier = (value: unknown) => { const id = String(value || ''); return id.length >= 17 ? `${id.slice(0,8)}…${id.slice(-8)}` : '[masked]' }
const SHORT_VIDEOS_INPUT_BUCKET = 'short-videos-inputs'

serve(withCors(async req => {
  const requestStartedAt = Date.now()
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ok:false,error:'Configuração indisponível.'},500)
  const supabase = createClient(url,key,{auth:{persistSession:false}})
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'')
  const {data:{user}} = await supabase.auth.getUser(token)
  if (!user) return json({ok:false,error:'Sua sessão expirou.'},401)
  try {
    const rawInput = await req.json()
    if (rawInput?.inputFlow === 'short-videos') {
      const input = validateShortVideosRequest(rawInput)
      if (!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)) throw new Error('invalid_request_id')
      const expectedPath = `${user.id}/short-videos/${input.clientRequestId}/input.mp4`
      if (input.videoPath !== expectedPath) throw new Error('invalid_video_owner')
      const {data:objects,error:objectsError} = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET).list(`${user.id}/short-videos/${input.clientRequestId}`,{limit:2})
      const videoObject = (objects || []).find(item => item.name === 'input.mp4')
      const videoSize = Number(videoObject?.metadata?.size || 0)
      const videoMimeType = String(videoObject?.metadata?.mimetype || videoObject?.metadata?.contentType || '')
      if (objectsError || !videoObject) throw new Error('video_unavailable')
      if (!videoSize || videoSize > GEMINI_VIDEO_SHORT_VIDEOS_MAX_BYTES) throw new Error('invalid_video_size')
      if (videoMimeType && videoMimeType !== 'video/mp4') throw new Error('invalid_video_type')
      const {data:existing} = await supabase.from('video_jobs').select('id,status,marketing_hashtags').eq('id',input.clientRequestId).eq('user_id',user.id).maybeSingle()
      if (existing) return json({ok:true,jobId:existing.id,status:existing.status,hashtags:existing.marketing_hashtags || [],idempotent:true})
      const {data:profile} = await supabase.from('profiles').select('whatsapp, telefone').eq('id',user.id).maybeSingle()
      const phone = resolveSmartTourProfessionalPhone(input.includeProfessionalPhone, profile?.whatsapp, profile?.telefone)
      const hashtagContext = {purpose:input.property.purpose,propertyType:input.property.type,propertyStage:input.property.stage,city:input.property.city,district:input.property.district,state:input.property.state,bedrooms:input.property.bedrooms,suites:input.property.suites,parkingSpaces:input.property.parkingSpaces,highlights:input.property.highlights,cta:input.selectedCta}
      const fallbackHashtags = buildOfficialHashtags(hashtagContext)
      const fallbackBriefing = buildShortVideosStructuredBriefing({generation:input.generation,property:input.property,selectedCta:input.selectedCta,phone,videoPath:input.videoPath,language:input.language})
      const fallbackPrompt = JSON.stringify(fallbackBriefing)
      const {error:insertError} = await supabase.from('video_jobs').insert({id:input.clientRequestId,user_id:user.id,status:'pending',mode:'smart_tour_gemini_omni_short_video',style:'short-videos',model:SMART_TOUR_GEMINI_OMNI_MODEL,prompt_final:fallbackPrompt,input_image_1_path:input.videoPath,input_image_2_path:null,marketing_hashtags:fallbackHashtags,tokens_reserved:0,error_message:'stage:storage_validated'})
      if (insertError) throw new Error('job_create_failed')
      console.info('[smart-tour-generate] short_video_job_created', JSON.stringify({jobIdMasked:maskIdentifier(input.clientRequestId),inputBytes:videoSize,sourceDurationSeconds:input.videoMetadata.durationSeconds}))
      const pipeline = await runShortVideoPipeline({
          persistStage: async stage => {
            const {error} = await supabase.from('video_jobs').update({error_message:`stage:${stage}`}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (error) throw new Error('job_stage_persist_failed')
          },
          prepareVideo: async () => {
            const prepared = await prepareGeminiVideo(supabase,SHORT_VIDEOS_INPUT_BUCKET,input.videoPath,'short-videos',{
              size:videoSize,
              mimeType:'video/mp4',
              storageUrl:url,
              storageKey:key,
            })
            console.info('[smart-tour-generate] short_video_file_active', JSON.stringify({inputBytes:videoSize,sourceDurationSeconds:input.videoMetadata.durationSeconds,uploadDurationMs:prepared.uploadDurationMs,fileProcessingDurationMs:prepared.fileProcessingDurationMs,inputKind:'video/mp4',fileState:'ACTIVE'}))
            return prepared
          },
          cleanupInput: async () => {
            const {error} = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET).remove([input.videoPath])
            if (error) throw new Error('short_video_input_cleanup_failed')
          },
          prepareOpenAi: async () => {
            const dynamicNarration = input.generation.narration === 'enabled'
              ? await generateSmartTourDynamicNarration({apiKey:Deno.env.get('OPENAI_API_KEY') || '',property:input.property,selectedCta:input.selectedCta})
              : null
            const briefing = dynamicNarration ? applySmartTourDynamicNarration(fallbackBriefing,dynamicNarration) : fallbackBriefing
            const prompt = JSON.stringify(briefing)
            const hashtags = await generateStrategicHashtags({apiKey:Deno.env.get('OPENAI_API_KEY') || '',variationKey:input.clientRequestId,context:hashtagContext})
            return {prompt,geminiPrompt:buildShortVideosCleanGeminiPrompt(briefing),hashtags}
          },
          persistBriefing: async ({prompt,hashtags}) => {
            const {error} = await supabase.from('video_jobs').update({prompt_final:prompt,marketing_hashtags:hashtags,error_message:'stage:openai_ready'}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (error) throw new Error('job_briefing_persist_failed')
          },
          startGemini: (prepared,{geminiPrompt}) => startGeminiOmniShortVideo({prompt:geminiPrompt,video:prepared.video}),
          persistProvider: async started => {
            const {error} = await supabase.from('video_jobs').update({status:'generating',provider_job_id:started.interactionId,error_message:null}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (error) throw new Error('provider_id_persist_failed')
          },
          persistFailure: async (stage,error) => {
            const {error:persistError} = await supabase.from('video_jobs').update({status:'failed',error_message:`stage:${stage};${safeError(error)}`.slice(0,240)}).eq('id',input.clientRequestId).eq('user_id',user.id)
            if (persistError) throw new Error('job_failure_persist_failed')
          },
          onCleanupError: stage => console.warn('[smart-tour-generate] short_video_input_cleanup_failed', JSON.stringify({stage})),
          onFailurePersistError: stage => console.error('[smart-tour-generate] short_video_failure_persist_failed', JSON.stringify({stage})),
      })
      return json({ok:true,jobId:input.clientRequestId,status:'generating',hashtags:pipeline.briefing.hashtags})
    }
    const input = validateSmartTourRequest(rawInput)
    if (!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)) throw new Error('invalid_request_id')
    if (input.imagePaths.some(path => !path.startsWith(`${user.id}/smart-tour/${input.clientRequestId}/`) || !/\.(jpg|jpeg|png)$/i.test(path))) throw new Error('invalid_image_owner')
    const {data:objects,error:objectsError} = await supabase.storage.from('studio-videos').list(`${user.id}/smart-tour/${input.clientRequestId}`,{limit:10})
    const available = new Set((objects || []).map(item => `${user.id}/smart-tour/${input.clientRequestId}/${item.name}`))
    if (objectsError || input.imagePaths.some(path => !available.has(path))) throw new Error('image_unavailable')
    const {data:existing} = await supabase.from('video_jobs').select('id,status,marketing_hashtags').eq('id',input.clientRequestId).eq('user_id',user.id).maybeSingle()
    if (existing) return json({ok:true,jobId:existing.id,status:existing.status,hashtags:existing.marketing_hashtags || [],idempotent:true})
    const {data:profile} = await supabase.from('profiles').select('whatsapp, telefone').eq('id',user.id).maybeSingle()
    const phone = resolveSmartTourProfessionalPhone(input.includeProfessionalPhone, profile?.whatsapp, profile?.telefone)
    const hashtagContext = {purpose:input.property.purpose,propertyType:input.property.type,propertyStage:input.property.stage,city:input.property.city,district:input.property.district,state:input.property.state,bedrooms:input.property.bedrooms,suites:input.property.suites,parkingSpaces:input.property.parkingSpaces,highlights:input.property.highlights,cta:input.selectedCta}
    const fallbackHashtags = buildOfficialHashtags(hashtagContext)
    const fallbackBriefing = buildSmartTourStructuredBriefing({generation:input.generation,property:input.property,selectedCta:input.selectedCta,phone,imagePaths:input.imagePaths,language:input.language})
    const fallbackPrompt = buildSmartTourVideoPrompt(fallbackBriefing)
    const {error:insertError} = await supabase.from('video_jobs').insert({id:input.clientRequestId,user_id:user.id,status:'pending',mode:'smart_tour_gemini_omni',style:input.generation.mode,model:SMART_TOUR_GEMINI_OMNI_MODEL,prompt_final:fallbackPrompt,input_image_1_path:input.imagePaths[0],input_image_2_path:input.imagePaths.at(-1),marketing_hashtags:fallbackHashtags,tokens_reserved:0})
    if (insertError) throw new Error('job_create_failed')
    try {
      const dynamicNarration = input.generation.narration === 'enabled'
        ? await generateSmartTourDynamicNarration({apiKey:Deno.env.get('OPENAI_API_KEY') || '',property:input.property,selectedCta:input.selectedCta})
        : null
      const briefing = dynamicNarration ? applySmartTourDynamicNarration(fallbackBriefing,dynamicNarration) : fallbackBriefing
      const prompt = buildSmartTourVideoPrompt(briefing)
      const hashtags = await generateStrategicHashtags({apiKey:Deno.env.get('OPENAI_API_KEY') || '',variationKey:input.clientRequestId,context:hashtagContext})
      const {error:briefingUpdateError} = await supabase.from('video_jobs').update({prompt_final:prompt,marketing_hashtags:hashtags}).eq('id',input.clientRequestId).eq('user_id',user.id)
      if (briefingUpdateError) throw new Error('job_briefing_persist_failed')
      const images = await prepareGeminiImages(supabase,'studio-videos',input.imagePaths)
      const generated = await generateGeminiOmniVideoInline({
        prompt,
        images,
        timeoutMs:resolveSmartTourInlineProviderTimeout(Date.now() - requestStartedAt,110_000),
      })
      const persisted = await persistSmartTourInlineVideo({userId:user.id,jobId:input.clientRequestId,...generated},{
        upload: async (path,videoBytes,contentType) => {
          const {error} = await supabase.storage.from('studio-videos').upload(path,videoBytes,{contentType,upsert:true})
          if (error) throw new Error('video_upload_failed')
        },
        createSignedUrl: async (path,expiresInSeconds) => {
          const {data,error} = await supabase.storage.from('studio-videos').createSignedUrl(path,expiresInSeconds)
          if (error || !data?.signedUrl) throw new Error('result_url_failed')
          return data.signedUrl
        },
        persistCompleted: async ({interactionId,outputPath,completedAt}) => {
          const {error} = await supabase.from('video_jobs').update({status:'completed',provider_job_id:interactionId,output_video_path:outputPath,completed_at:completedAt,error_message:null}).eq('id',input.clientRequestId).eq('user_id',user.id)
          if (error) throw new Error('job_completed_persist_failed')
        },
      })
      console.info('[smart-tour-generate] inline_video_completed', JSON.stringify({delivery:'base64',outputBytes:generated.videoBytes.byteLength}))
      return json({ok:true,jobId:input.clientRequestId,status:'completed',signedVideoUrl:persisted.signedVideoUrl,hashtags})
    } catch (error) {
      await supabase.from('video_jobs').update({status:'failed',error_message:safeError(error)}).eq('id',input.clientRequestId).eq('user_id',user.id)
      throw error
    }
  } catch (error) {
    console.warn('[smart-tour-generate]',safeError(error))
    const code = safeError(error)
    const messages: Record<string,string> = {invalid_image_count:'Envie de 1 a 5 imagens válidas.',invalid_image_order:'A ordem das imagens é inválida.',invalid_image_owner:'Uma imagem não pertence à sua conta.',image_unavailable:'Uma das imagens não está disponível.',gemini_omni_missing_environment:'A criação de vídeos está temporariamente indisponível.'}
    Object.assign(messages, {
      invalid_video_path: 'Envie um vídeo MP4 válido.',
      invalid_video_owner: 'O vídeo não pertence à sua conta.',
      video_unavailable: 'O vídeo enviado não está disponível.',
      invalid_video_size: 'O vídeo deve ter no máximo 250 MB.',
      invalid_video_duration: 'O vídeo deve ter no máximo 5 minutos.',
      invalid_video_type: 'Envie um vídeo MP4 válido.',
    })
    return json({ok:false,error:messages[code] || 'Não foi possível iniciar sua apresentação.'},400)
  }
}))

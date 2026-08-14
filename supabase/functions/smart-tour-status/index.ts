import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  checkGeminiOmniVideoStream,
  decodeGeminiOmniStreamState,
  downloadGeminiOmniVideoFromUri,
  encodeGeminiOmniStreamState,
} from '../_shared/geminiOmniClient.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
import {
  checkSmartTourCaptionRender,
  buildShortVideosCaptionPlan,
  decodeSmartTourCaptionRenderId,
  downloadSmartTourCaptionRender,
  encodeSmartTourCaptionRenderId,
  parseSmartTourStructuredBriefing,
  startSmartTourCaptionRender,
  validateShortVideosFinalMp4,
} from '../_shared/smart-tour/index.ts'
import {
  SMART_TOUR_STATUS_TIMEOUT_MS,
  classifySmartTourStatusError,
  classifySmartTourProviderDiagnostic,
  isShortVideoPreProviderStale,
  maskSmartTourInteractionId,
  serializeSmartTourStatusDiagnostic,
  type SmartTourStatusStage,
  withSmartTourStatusTimeout,
} from './status-runtime.ts'

serve(withCors(async req => {
  const traceId = crypto.randomUUID().slice(0, 8)
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info('[smart-tour-status]', JSON.stringify({ traceId, event, ...details }))
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const creatomateKey = Deno.env.get('CREATOMATE_API_KEY') || ''
  if (!url || !key) return json({ ok: false, error: 'Configuração indisponível.' }, 500)

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ ok: false, error: 'Sua sessão expirou.' }, 401)

  const body = await req.json().catch(() => ({}))
  const jobId = String(body.jobId || '')
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, error: 'Criação inválida.' }, 400)

  let stage: SmartTourStatusStage = 'job_lookup'
  let interactionIdMasked = ''
  let isShortVideoJob = false
  try {
    log('job_lookup_started')
    const { data: job, error: jobError } = await supabase
      .from('video_jobs')
      .select('id,user_id,status,provider_job_id,output_video_path,error_message,prompt_final,mode,created_at,completed_at,marketing_hashtags,input_image_1_path')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (jobError) throw new Error('status_job_lookup_failed')
    if (!job) return json({ ok: false, error: 'Criação não encontrada.' }, 404)
    const isShortVideos = job.mode === 'smart_tour_gemini_omni_short_video'
    isShortVideoJob = isShortVideos
    const shortVideoRawPath = `${user.id}/${jobId}/smart-tour-gemini.mp4`
    const cleanupShortVideoRaw = async () => {
      if (!isShortVideos) return
      const { error } = await supabase.storage.from('studio-videos').remove([shortVideoRawPath])
      if (error) console.warn('[smart-tour-status] short_video_intermediate_cleanup_failed')
    }
    log('job_lookup_completed', { jobStatus: job.status, providerIdPresent: Boolean(job.provider_job_id) })

    if (job.status === 'failed') return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })

    if (job.status === 'completed' && job.output_video_path) {
      stage = 'completed_url'
      log('completed_url_started')
      const { data, error } = await supabase.storage.from('studio-videos').createSignedUrl(job.output_video_path, 3600)
      if (error) throw new Error('status_completed_url_failed')
      log('completed_url_completed', { isShortVideos: job.mode === 'smart_tour_gemini_omni_short_video', totalProcessingDurationMs: Math.max(0, Date.now() - Date.parse(job.created_at)) })
      return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [] })
    }

    if (!job.provider_job_id) {
      if (isShortVideoPreProviderStale(job)) {
        const { error: staleError } = await supabase
          .from('video_jobs')
          .update({ status: 'failed', error_message: 'short_video_stale_before_provider' })
          .eq('id', jobId)
          .eq('user_id', user.id)
        if (staleError) throw new Error('status_failed_persist_failed')
        const expectedInputPath = `${user.id}/short-videos/${jobId}/input.mp4`
        if (job.input_image_1_path === expectedInputPath) {
          const { error: cleanupError } = await supabase.storage.from('short-videos-inputs').remove([expectedInputPath])
          if (cleanupError) console.warn('[smart-tour-status] short_video_stale_cleanup_failed')
        }
        return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
      }
      return json({ ok: true, status: 'generating', jobId, message: 'Preparando sua apresentação...' })
    }

    const captionRenderId = decodeSmartTourCaptionRenderId(job.provider_job_id)
    if (captionRenderId) {
      stage = 'caption_render_poll'
      const captionRender = await withSmartTourStatusTimeout(checkSmartTourCaptionRender(creatomateKey, captionRenderId))
      log('caption_render_poll_completed', { remoteStatus: captionRender.status })
      if (captionRender.status === 'processing') {
        return json({ ok: true, status: 'generating', jobId, message: 'Finalizando as legendas da sua apresentação...' })
      }
      if (captionRender.status === 'failed') {
        stage = 'failed_persist'
        const { error } = await supabase
          .from('video_jobs')
          .update({ status: 'failed', error_message: captionRender.errorMessage })
          .eq('id', jobId)
          .eq('user_id', user.id)
        if (error) throw new Error('status_failed_persist_failed')
        await cleanupShortVideoRaw()
        return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
      }

      stage = 'caption_video_download'
      const rendered = await withSmartTourStatusTimeout(downloadSmartTourCaptionRender(captionRender.url))
      if (isShortVideos) {
        try {
          const validated = validateShortVideosFinalMp4(rendered.videoBytes, rendered.contentType)
          log('short_video_final_validation_completed', { width: validated.width, height: validated.height, fps: Math.round(validated.fps), durationSeconds: Number(validated.durationSeconds.toFixed(2)), audioPresent: Boolean(validated.audioCodec) })
        } catch (validationError) {
          const code = validationError instanceof Error ? validationError.message.slice(0, 160) : 'short_video_final_mp4_invalid'
          const { error } = await supabase.from('video_jobs').update({ status: 'failed', error_message: code }).eq('id', jobId).eq('user_id', user.id)
          if (error) throw new Error('status_failed_persist_failed')
          await cleanupShortVideoRaw()
          return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
        }
      }
      stage = 'caption_video_upload'
      const outputPath = `${user.id}/${jobId}/smart-tour.mp4`
      const { error: uploadError } = await supabase.storage
        .from('studio-videos')
        .upload(outputPath, rendered.videoBytes, { contentType: rendered.contentType, upsert: true })
      if (uploadError) throw new Error('status_caption_video_upload_failed')

      stage = 'completed_persist'
      const completedAt = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('video_jobs')
        .update({ status: 'completed', output_video_path: outputPath, completed_at: completedAt, error_message: null })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (updateError) throw new Error('status_completed_persist_failed')
      await cleanupShortVideoRaw()
      const { data, error: signedUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(outputPath, 3600)
      if (signedUrlError) throw new Error('status_result_url_failed')
      return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [] })
    }

    stage = 'interaction_poll'
    const streamState = decodeGeminiOmniStreamState(job.provider_job_id)
    const interactionId = streamState.interactionId
    interactionIdMasked = maskSmartTourInteractionId(interactionId)
    console.info('[smart-tour-status] interaction_request', JSON.stringify({
      interactionIdLength: interactionId.length,
      interactionIdMasked,
      cursorPresent: Boolean(streamState.lastEventId),
      outputUriPresent: Boolean(streamState.videoUri),
    }))
    const pollAbortController = new AbortController()
    const remote = streamState.videoUri
      ? { status: 'completed' as const, videoUri: streamState.videoUri, contentType: streamState.contentType, delivery: 'uri' as const, lastEventId: streamState.lastEventId }
      : await withSmartTourStatusTimeout(
          checkGeminiOmniVideoStream(interactionId, streamState.lastEventId, pollAbortController.signal),
          SMART_TOUR_STATUS_TIMEOUT_MS,
          () => pollAbortController.abort(),
        )
    log('interaction_poll_completed', { remoteStatus: remote.status, pollAttempts: streamState.videoUri ? 0 : 1, isShortVideos, ...(remote.status === 'completed' ? { resultFormat: remote.delivery } : {}) })
    if (isShortVideos && remote.status === 'failed' && !remote.diagnostic.eventType) {
      const legacyDiagnostic = classifySmartTourProviderDiagnostic(remote.diagnostic)
      log('short_video_interaction_poll_error', {
        providerStatus: legacyDiagnostic.providerStatus,
        providerMessage: legacyDiagnostic.providerMessage,
        retriable: false,
      })
      return json({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
    }
    if (remote.status === 'processing') {
      if (remote.lastEventId && remote.lastEventId !== streamState.lastEventId) {
        const cursorState = encodeGeminiOmniStreamState({ ...streamState, lastEventId: remote.lastEventId })
        const { error: cursorError } = await supabase
          .from('video_jobs')
          .update({ provider_job_id: cursorState, error_message: null })
          .eq('id', jobId)
          .eq('user_id', user.id)
        if (cursorError) throw new Error('status_cursor_persist_failed')
        log('interaction_cursor_persisted', { cursorPresent: true })
      }
      return json({ ok: true, status: 'generating', jobId, message: 'A IA está criando sua apresentação...' })
    }

    if (remote.status === 'failed') {
      stage = 'failed_persist'
      const classifiedDiagnostic = classifySmartTourProviderDiagnostic(remote.diagnostic)
      const diagnostic = remote.diagnostic.source === 'sse' && remote.diagnostic.eventType === 'error'
        ? { ...classifiedDiagnostic, retriable: false }
        : classifiedDiagnostic
      log('failed_persist_started', {
        eventType: diagnostic.eventType,
        providerCode: diagnostic.providerCode,
        providerErrorStatus: diagnostic.providerErrorStatus,
        providerErrorType: diagnostic.providerErrorType,
        providerStatus: diagnostic.providerStatus,
        providerMessage: diagnostic.providerMessage,
        retriable: diagnostic.retriable,
      })
      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'failed', error_message: serializeSmartTourStatusDiagnostic(diagnostic) })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (error) throw new Error('status_failed_persist_failed')
      log('failed_persist_completed')
      return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
    }

    const completedStreamState = encodeGeminiOmniStreamState({
      interactionId,
      lastEventId: remote.lastEventId,
      videoUri: remote.videoUri,
      contentType: remote.contentType,
    })
    if (job.provider_job_id !== completedStreamState) {
      const { error: outputUriPersistError } = await supabase
        .from('video_jobs')
        .update({ provider_job_id: completedStreamState, error_message: null })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (outputUriPersistError) throw new Error('status_output_uri_persist_failed')
      log('interaction_output_uri_persisted', { cursorPresent: Boolean(remote.lastEventId) })
    }
    const completedVideo = await withSmartTourStatusTimeout(downloadGeminiOmniVideoFromUri(remote.videoUri, remote.contentType))

    if (isShortVideos) {
      stage = 'caption_render_start'
      try {
        log('short_video_intermediate_upload_started', { byteLength: completedVideo.videoBytes.byteLength, contentType: completedVideo.contentType || 'video/mp4' })
        const { error: intermediateUploadError } = await supabase.storage
          .from('studio-videos')
          .upload(shortVideoRawPath, completedVideo.videoBytes, { contentType: completedVideo.contentType || 'video/mp4', upsert: true })
        if (intermediateUploadError) throw new Error('status_short_video_intermediate_upload_failed')
        const { data: rawUrl, error: rawUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(shortVideoRawPath, 600)
        if (rawUrlError || !rawUrl?.signedUrl) throw new Error('status_short_video_intermediate_url_failed')
        const briefing = parseSmartTourStructuredBriefing(job.prompt_final)
        if (briefing.versao !== 'short-videos-structured-briefing-v1') throw new Error('status_short_video_briefing_invalid')
        const captionPlan = buildShortVideosCaptionPlan(briefing)
        const startedRender = await withSmartTourStatusTimeout(startSmartTourCaptionRender(creatomateKey, rawUrl.signedUrl, briefing, captionPlan))
        const { error: renderPersistError } = await supabase.from('video_jobs')
          .update({ provider_job_id: encodeSmartTourCaptionRenderId(startedRender.renderId), error_message: null })
          .eq('id', jobId)
          .eq('user_id', user.id)
        if (renderPersistError) throw new Error('status_caption_render_persist_failed')
        log('caption_render_started', { informationBlocks: captionPlan.blocks.filter(block => !block.isClosing).length, finalCtaPresent: captionPlan.blocks.some(block => block.isClosing) })
        return json({ ok: true, status: 'generating', jobId, message: 'Finalizando os textos da sua apresentação...' })
      } catch (compositionError) {
        const code = compositionError instanceof Error ? compositionError.message.slice(0, 160) : 'short_video_composition_failed'
        const { error } = await supabase.from('video_jobs').update({ status: 'failed', error_message: code }).eq('id', jobId).eq('user_id', user.id)
        if (error) throw new Error('status_failed_persist_failed')
        await cleanupShortVideoRaw()
        return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
      }
    }

    stage = 'video_upload'
    log('video_upload_started', { byteLength: completedVideo.videoBytes.byteLength, contentType: completedVideo.contentType || 'video/mp4' })
    const outputPath = `${user.id}/${jobId}/smart-tour.mp4`
    const { error: uploadError } = await supabase.storage
      .from('studio-videos')
      .upload(outputPath, completedVideo.videoBytes, { contentType: completedVideo.contentType || 'video/mp4', upsert: true })
    if (uploadError) throw new Error('status_video_upload_failed')
    log('video_upload_completed')

    stage = 'completed_persist'
    log('completed_persist_started')
    const completedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('video_jobs')
      .update({ status: 'completed', output_video_path: outputPath, completed_at: completedAt, error_message: null })
      .eq('id', jobId)
      .eq('user_id', user.id)
    if (updateError) throw new Error('status_completed_persist_failed')
    log('completed_persist_completed')
    stage = 'result_url'
    log('result_url_started')
    const { data, error: signedUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(outputPath, 3600)
    if (signedUrlError) throw new Error('status_result_url_failed')
    log('result_url_completed', { isShortVideos: job.mode === 'smart_tour_gemini_omni_short_video', totalProcessingDurationMs: Math.max(0, Date.now() - Date.parse(job.created_at)), resultFormat: remote.delivery })
    return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [] })
  } catch (error) {
    const diagnostic = classifySmartTourStatusError(error, stage)
    const logger = diagnostic.retriable ? console.warn : console.error
    logger('[smart-tour-status] status_error', JSON.stringify({
      stage: diagnostic.stage,
      kind: diagnostic.kind,
      eventType: diagnostic.eventType,
      providerCode: diagnostic.providerCode,
      providerErrorStatus: diagnostic.providerErrorStatus,
      providerErrorType: diagnostic.providerErrorType,
      providerStatus: diagnostic.providerStatus,
      retriable: diagnostic.retriable,
      providerMessage: diagnostic.providerMessage,
      ...(interactionIdMasked ? { interactionIdMasked } : {}),
    }))
    if (diagnostic.retriable) {
      return json({ ok: true, status: 'generating', jobId, message: 'A IA ainda está processando sua apresentação...' })
    }
    if (isShortVideoJob && ['caption_render_start', 'caption_render_poll', 'caption_video_download', 'caption_video_upload'].includes(stage)) {
      const { error: failedError } = await supabase.from('video_jobs')
        .update({ status: 'failed', error_message: `short_video_composition_${diagnostic.kind}`.slice(0, 160) })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (!failedError) {
        const intermediatePath = `${user.id}/${jobId}/smart-tour-gemini.mp4`
        const failedOutputPath = `${user.id}/${jobId}/smart-tour.mp4`
        const { error: cleanupError } = await supabase.storage.from('studio-videos').remove([intermediatePath, failedOutputPath])
        if (cleanupError) console.warn('[smart-tour-status] short_video_intermediate_cleanup_failed')
        return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
      }
    }
    return json({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
  }
}))

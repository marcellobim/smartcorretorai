import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { buildGeminiOmniInteractionGetRequest, checkGeminiOmniVideo } from '../_shared/geminiOmniClient.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
import {
  checkSmartTourCaptionRender,
  decodeSmartTourCaptionRenderId,
  downloadSmartTourCaptionRender,
  encodeSmartTourCaptionRenderId,
  hasDeterministicSmartTourText,
  parseSmartTourStructuredBriefing,
  startSmartTourCaptionRender,
} from '../_shared/virtual-staging/index.ts'
import {
  classifySmartTourStatusError,
  maskSmartTourInteractionId,
  type SmartTourStatusStage,
  withSmartTourStatusTimeout,
} from './status-runtime.ts'
import { recordGeminiVideoJobTelemetry, settleGeminiVideoJobEconomy } from '../_shared/gemini-video-economy.ts'

const recoveryMetadata = (prompt: unknown) => {
  try {
    const briefing = parseSmartTourStructuredBriefing(String(prompt || ''))
    const language = briefing.configuracoes?.idioma === 'en-US' ? 'en-US' : 'pt-BR'
    const journeyId = briefing.vidaNoImovel ? 'life-in-property' : briefing.referenciaApresentador ? 'broker-presentation' : ''
    if (!journeyId) return null
    const property = briefing.imovel || {}
    return {
      journeyId,
      language,
      property: { purpose: property.finalidade === 'Locação' ? 'rent' : property.finalidade === 'Venda' ? 'sale' : '', type: property.tipo || '', stage: property.estadoDoImovel || '', state: property.localizacao?.estado || '', city: property.localizacao?.cidade || '', district: property.localizacao?.bairro || '', bedrooms: property.dormitorios || '', suites: property.suites || '', parkingSpaces: property.vagas || '', area: property.area || '', price: property.preco || '', description: property.descricao || '', highlights: property.destaques || [] },
      cta: briefing.cta?.titulo || '',
      phone: briefing.cta?.telefone || '',
      lifeScene: briefing.vidaNoImovel?.life_scene || '',
      presenterSpeechMode: (briefing as any).configuracoes?.presenterSpeechMode || '',
      presenterCustomSpeech: (briefing as any).configuracoes?.presenterCustomSpeech || '',
    }
  } catch { return null }
}

serve(withCors(async req => {
  const traceId = crypto.randomUUID().slice(0, 8)
  const log = (event: string, details: Record<string, unknown> = {}) => {
    console.info('[virtual-staging-status]', JSON.stringify({ traceId, event, ...details }))
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = resolveSupabaseAdminCredential().key
  const creatomateKey = Deno.env.get('CREATOMATE_API_KEY') || ''
  if (!url || !key) return json({ ok: false, error: 'Configuração indisponível.' }, 500)

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ ok: false, error: 'Sua sessão expirou.' }, 401)

  const body = await req.json().catch(() => ({}))
  if (body?.action === 'discover_latest') {
    const style = body.style === 'narrated_tour' || body.style === 'guided_tour' ? body.style : ''
    const journeyId = body.journeyId === 'life-in-property' || body.journeyId === 'broker-presentation' ? body.journeyId : ''
    if (!style || !journeyId) return json({ ok: false, error: 'Criação inválida.' }, 400)
    const { data: jobs, error } = await supabase.from('video_jobs')
      .select('id,status,output_video_path,marketing_hashtags,prompt_final,created_at')
      .eq('user_id', user.id).eq('mode', 'virtual_staging_gemini_omni').eq('style', style)
      .order('created_at', { ascending: false }).limit(20)
    if (error) throw new Error('discover_latest_failed')
    const job = (jobs || []).map(item => ({ item, recovery: recoveryMetadata(item.prompt_final) })).find(entry => entry.recovery?.journeyId === journeyId)
    if (!job) return json({ ok: true, status: 'none' })
    const signedVideoUrl = job.item.status === 'completed' && job.item.output_video_path
      ? (await supabase.storage.from('studio-videos').createSignedUrl(job.item.output_video_path, 3600)).data?.signedUrl || '' : ''
    return json({ ok: true, jobId: job.item.id, clientRequestId: job.item.id, status: job.item.status, signedVideoUrl, hashtags: job.item.marketing_hashtags || [], recovery: job.recovery })
  }
  const jobId = String(body.jobId || '')
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, error: 'Criação inválida.' }, 400)

  let stage: SmartTourStatusStage = 'job_lookup'
  let interactionIdMasked = ''
  try {
    log('job_lookup_started')
    const { data: job, error: jobError } = await supabase
      .from('video_jobs')
      .select('id,status,provider_job_id,output_video_path,error_message,prompt_final,marketing_hashtags,created_at')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .eq('mode', 'virtual_staging_gemini_omni')
      .maybeSingle()
    if (jobError) throw new Error('status_job_lookup_failed')
    if (!job) return json({ ok: false, error: 'Criação não encontrada.' }, 404)
    const economyIdentity = [user.id, jobId] as const
    const settleEconomy = (status: 'completed' | 'failed', details: { outputPath?: string; reason?: string; telemetry?: Record<string, unknown> } = {}) => settleGeminiVideoJobEconomy(supabase, economyIdentity, status, details)
    const recovery = recoveryMetadata(job.prompt_final)
    log('job_lookup_completed', { jobStatus: job.status, providerIdPresent: Boolean(job.provider_job_id) })

    if (job.status === 'failed') { await settleEconomy('failed', { reason: job.error_message || 'video_job_failed' }); return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' }) }

    if (job.status === 'completed' && job.output_video_path) {
      await settleEconomy('completed', { outputPath: job.output_video_path })
      stage = 'completed_url'
      log('completed_url_started')
      const { data, error } = await supabase.storage.from('studio-videos').createSignedUrl(job.output_video_path, 3600)
      if (error) throw new Error('status_completed_url_failed')
      log('completed_url_completed')
      return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [], recovery })
    }

    if (!job.provider_job_id) {
      if (Date.now() - Date.parse(job.created_at) > 300_000) {
        const { error: staleError } = await supabase.from('video_jobs').update({ status: 'failed', error_message: 'video_stale_before_provider' }).eq('id', jobId).eq('user_id', user.id)
        if (staleError) throw new Error('status_failed_persist_failed')
        await settleEconomy('failed', { reason: 'video_stale_before_provider' })
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
        await settleEconomy('failed', { reason: captionRender.errorMessage })
        return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
      }

      stage = 'caption_video_download'
      const rendered = await withSmartTourStatusTimeout(downloadSmartTourCaptionRender(captionRender.url))
      stage = 'caption_video_upload'
      const outputPath = `${user.id}/${jobId}/virtual-staging.mp4`
      const { error: uploadError } = await supabase.storage
        .from('studio-videos')
        .upload(outputPath, rendered.videoBytes, { contentType: rendered.contentType, upsert: true })
      if (uploadError) throw new Error('status_caption_video_upload_failed')

      stage = 'completed_persist'
      const { error: updateError } = await supabase
        .from('video_jobs')
        .update({ status: 'completed', output_video_path: outputPath, completed_at: new Date().toISOString(), error_message: null })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (updateError) throw new Error('status_completed_persist_failed')
      await settleEconomy('completed', { outputPath, telemetry: { resolution: '720x1280', fps: 24, output_duration_seconds: 10, audio: true, output_bytes: rendered.videoBytes.byteLength } })
      const { data, error: signedUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(outputPath, 3600)
      if (signedUrlError) throw new Error('status_result_url_failed')
      return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [] })
    }

    stage = 'interaction_poll'
    const interactionRequest = buildGeminiOmniInteractionGetRequest(job.provider_job_id)
    interactionIdMasked = maskSmartTourInteractionId(interactionRequest.interactionId)
    console.info('[virtual-staging-status] interaction_request', JSON.stringify({
      interactionIdLength: interactionRequest.interactionId.length,
      interactionIdMasked,
    }))
    const remote = await withSmartTourStatusTimeout(checkGeminiOmniVideo(interactionRequest.interactionId))
    log('interaction_poll_completed', { remoteStatus: remote.status })

    if (remote.status === 'processing') {
      return json({ ok: true, status: 'generating', jobId, message: 'A IA está criando sua apresentação...' })
    }

    if (remote.status === 'failed') {
      stage = 'failed_persist'
      log('failed_persist_started')
      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'failed', error_message: String(remote.errorMessage).slice(0, 400) })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (error) throw new Error('status_failed_persist_failed')
      await settleEconomy('failed', { reason: String(remote.errorMessage).slice(0, 240) })
      log('failed_persist_completed')
      return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
    }

    let briefing = null
    try {
      briefing = parseSmartTourStructuredBriefing(job.prompt_final)
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'smart_tour_caption_briefing_invalid') throw error
    }
    if (briefing && hasDeterministicSmartTourText(briefing)) {
      stage = 'video_upload'
      const rawPath = `${user.id}/${jobId}/virtual-staging-gemini.mp4`
      const { error: rawUploadError } = await supabase.storage
        .from('studio-videos')
        .upload(rawPath, remote.videoBytes, { contentType: remote.contentType || 'video/mp4', upsert: true })
      if (rawUploadError) throw new Error('status_video_upload_failed')
      const { data: rawUrl, error: rawUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(rawPath, 21_600)
      if (rawUrlError || !rawUrl?.signedUrl) throw new Error('status_raw_video_url_failed')

      stage = 'caption_render_start'
      const captionRender = await withSmartTourStatusTimeout(startSmartTourCaptionRender(creatomateKey, rawUrl.signedUrl, briefing))
      const { error: renderPersistError } = await supabase
        .from('video_jobs')
        .update({ provider_job_id: encodeSmartTourCaptionRenderId(captionRender.renderId), error_message: null })
        .eq('id', jobId)
        .eq('user_id', user.id)
      if (renderPersistError) throw new Error('status_caption_render_persist_failed')
      return json({ ok: true, status: 'generating', jobId, message: 'Finalizando as legendas da sua apresentação...' })
    }

    stage = 'video_upload'
    log('video_upload_started', { byteLength: remote.videoBytes.byteLength, contentType: remote.contentType || 'video/mp4' })
    const outputPath = `${user.id}/${jobId}/virtual-staging.mp4`
    const { error: uploadError } = await supabase.storage
      .from('studio-videos')
      .upload(outputPath, remote.videoBytes, { contentType: remote.contentType || 'video/mp4', upsert: true })
    if (uploadError) throw new Error('status_video_upload_failed')
    log('video_upload_completed')

    stage = 'completed_persist'
    log('completed_persist_started')
    const { error: updateError } = await supabase
      .from('video_jobs')
      .update({ status: 'completed', output_video_path: outputPath, completed_at: new Date().toISOString(), error_message: null })
      .eq('id', jobId)
      .eq('user_id', user.id)
    if (updateError) throw new Error('status_completed_persist_failed')
    await recordGeminiVideoJobTelemetry(supabase,economyIdentity,interactionRequest.interactionId,{output_bytes:remote.videoBytes.byteLength}).catch(() => console.warn('[virtual-staging-status] economy_telemetry_deferred'))
    await settleEconomy('completed', { outputPath, telemetry: { output_bytes: remote.videoBytes.byteLength, resolution: '720x1280', fps: 24, output_duration_seconds: 10, audio: true } })
    log('completed_persist_completed')

    stage = 'result_url'
    log('result_url_started')
    const { data, error: signedUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(outputPath, 3600)
    if (signedUrlError) throw new Error('status_result_url_failed')
    log('result_url_completed')
    return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '', hashtags: job.marketing_hashtags || [] })
  } catch (error) {
    const diagnostic = classifySmartTourStatusError(error, stage)
    const logger = diagnostic.retriable ? console.warn : console.error
    logger('[virtual-staging-status] status_error', JSON.stringify({
      stage: diagnostic.stage,
      kind: diagnostic.kind,
      providerStatus: diagnostic.providerStatus,
      retriable: diagnostic.retriable,
      providerMessage: diagnostic.providerMessage,
      ...(interactionIdMasked ? { interactionIdMasked } : {}),
    }))
    if (diagnostic.retriable) {
      return json({ ok: true, status: 'generating', jobId, message: 'A IA ainda está processando sua apresentação...' })
    }
    return json({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
  }
}))

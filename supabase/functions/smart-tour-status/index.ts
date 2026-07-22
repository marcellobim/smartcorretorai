import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildGeminiOmniInteractionGetRequest, checkGeminiOmniVideo } from '../_shared/geminiOmniClient.ts'
import { jsonResponse as json, withCors } from '../_shared/cors.ts'
import {
  classifySmartTourStatusError,
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
  if (!url || !key) return json({ ok: false, error: 'Configuração indisponível.' }, 500)

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ ok: false, error: 'Sua sessão expirou.' }, 401)

  const body = await req.json().catch(() => ({}))
  const jobId = String(body.jobId || '')
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, error: 'Criação inválida.' }, 400)

  let stage: SmartTourStatusStage = 'job_lookup'
  try {
    log('job_lookup_started')
    const { data: job, error: jobError } = await supabase
      .from('video_jobs')
      .select('id,status,provider_job_id,output_video_path,error_message')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (jobError) throw new Error('status_job_lookup_failed')
    if (!job) return json({ ok: false, error: 'Criação não encontrada.' }, 404)
    log('job_lookup_completed', { jobStatus: job.status, providerIdPresent: Boolean(job.provider_job_id) })

    if (job.status === 'failed') return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })

    if (job.status === 'completed' && job.output_video_path) {
      stage = 'completed_url'
      log('completed_url_started')
      const { data, error } = await supabase.storage.from('studio-videos').createSignedUrl(job.output_video_path, 3600)
      if (error) throw new Error('status_completed_url_failed')
      log('completed_url_completed')
      return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '' })
    }

    if (!job.provider_job_id) return json({ ok: true, status: 'generating', jobId, message: 'Preparando sua apresentação...' })

    stage = 'interaction_poll'
    const interactionRequest = buildGeminiOmniInteractionGetRequest(job.provider_job_id)
    console.info('[smart-tour-status] interaction_request', JSON.stringify({
      interactionIdLength: interactionRequest.interactionId.length,
      interactionIdFirst8: interactionRequest.interactionId.slice(0, 8),
      interactionIdLast8: interactionRequest.interactionId.slice(-8),
      interactionUrl: interactionRequest.url,
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
      log('failed_persist_completed')
      return json({ ok: true, status: 'failed', error: 'Não foi possível concluir sua apresentação.' })
    }

    stage = 'video_upload'
    log('video_upload_started', { byteLength: remote.videoBytes.byteLength, contentType: remote.contentType || 'video/mp4' })
    const outputPath = `${user.id}/${jobId}/smart-tour.mp4`
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
    log('completed_persist_completed')

    stage = 'result_url'
    log('result_url_started')
    const { data, error: signedUrlError } = await supabase.storage.from('studio-videos').createSignedUrl(outputPath, 3600)
    if (signedUrlError) throw new Error('status_result_url_failed')
    log('result_url_completed')
    return json({ ok: true, status: 'completed', jobId, signedVideoUrl: data?.signedUrl || '' })
  } catch (error) {
    const diagnostic = classifySmartTourStatusError(error, stage)
    const logger = diagnostic.retriable ? console.warn : console.error
    logger('[smart-tour-status]', JSON.stringify({ traceId, event: 'status_error', ...diagnostic }))
    if (diagnostic.retriable) {
      return json({ ok: true, status: 'generating', jobId, message: 'A IA ainda está processando sua apresentação...' })
    }
    return json({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
  }
}))

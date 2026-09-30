import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { checkVeoVideoStatus } from '../_shared/veoClient.ts'
import { isAuthorizedAdmin } from '../_shared/admin-authorization.ts'
import { settleVeoVideoEconomy, updateVeoVideoEconomyTelemetry } from '../_shared/veo-video-economy.ts'
import { createSupabaseCreationStore } from '../_shared/creations.ts'
import { registerStudioCreation, type StudioCreationJob } from './creation-runtime.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const VIDEO_BUCKET = 'studio-videos'

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

function sanitizeDebugText(value: unknown, maxLength = 500) {
  return String(value || '')
    .replace(/key=[A-Za-z0-9._~-]+/gi, 'key=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_api_key]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function getStudioJobLanguage(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'pt-BR'
  return (metadata as JsonRecord).language === 'en-US' ? 'en-US' : 'pt-BR'
}

function buildFailedJobDebug(job: {
  id?: unknown
  status?: unknown
  model?: unknown
  provider_job_id?: unknown
  error_message?: unknown
}) {
  return {
    jobId: String(job.id || ''),
    status: String(job.status || ''),
    providerModel: sanitizeDebugText(job.model, 160),
    providerJobId: sanitizeDebugText(job.provider_job_id, 240),
    errorMessage: sanitizeDebugText(job.error_message, 500),
  }
}

async function cancelLegacyCredits(supabase: any, userId: string, idempotencyKey: string, reason: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('cancel_credit_reservation', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  })
  if (error) console.warn('[get-video-job-status] falha ao cancelar reserva:', error.message)
}

async function consumeLegacyCredits(supabase: any, userId: string, idempotencyKey: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('consume_reserved_credits', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_observacao: 'Studio Hero - video IA concluido',
    p_metadata: { product: 'studio_hero' },
  })
  if (error) throw new Error(error.message || 'credit_consume_failed')
}

async function createSignedVideoUrl(supabase: any, path: string) {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error('video_signed_url_failed')
  return data.signedUrl
}

async function settleJobEconomy(
  supabase: any,
  input: {
    userId: string
    jobId: string
    finalStatus: 'completed' | 'failed'
    isAdminBypass: boolean
    legacyIdempotencyKey: string
    outputPath?: string
    reason?: string
    telemetry?: Record<string, unknown>
  },
) {
  const handled = await settleVeoVideoEconomy(supabase, {
    userId: input.userId,
    clientRequestId: input.jobId,
    status: input.finalStatus,
    result: input.outputPath ? { output_video_path: input.outputPath } : {},
    telemetry: input.telemetry || {},
    reason: input.reason,
  })
  if (handled || !input.legacyIdempotencyKey) return
  if (input.finalStatus === 'completed' && !input.isAdminBypass) {
    await consumeLegacyCredits(supabase, input.userId, input.legacyIdempotencyKey)
  } else {
    await cancelLegacyCredits(supabase, input.userId, input.legacyIdempotencyKey, input.reason || 'studio_hero_failed')
  }
}

async function ensureStudioCreation(supabase: any, job: StudioCreationJob) {
  await registerStudioCreation(createSupabaseCreationStore(supabase), job)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const reqId = crypto.randomUUID().slice(0, 8)

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Metodo nao permitido.' }, 405)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = resolveSupabaseAdminCredential().key
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ ok: false, error: 'Configuracao indisponivel.' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ ok: false, error: 'Sessao invalida.' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) {
      console.warn(`[${reqId}] jwt invalido:`, authError?.message)
      return jsonResponse({ ok: false, error: 'Sessao invalida.' }, 401)
    }

    const isAdminBypass = await isAuthorizedAdmin(supabase, user.id)

    const body = await req.json().catch(() => ({})) as JsonRecord | string
    const rawJobId = typeof body === 'string'
      ? body
      : body?.jobId ?? body?.job_id
    const jobId = String(rawJobId || '').trim()
    if (!isUuid(jobId)) {
      return jsonResponse({ ok: false, error: 'Job invalido.' }, 400)
    }

    const { data: job, error: jobError } = await supabase
      .from('video_jobs')
      .select('id, user_id, status, mode, provider_job_id, output_video_path, credit_idempotency_key, error_message, model, publication_options, output_media_metadata, completed_at, created_at')
      .eq('user_id', user.id)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return jsonResponse({ ok: false, error: 'Job nao encontrado.' }, 404)
    }

    const language = getStudioJobLanguage(job.output_media_metadata)

    if (job.status === 'completed') {
      const outputPath = String(job.output_video_path || '')
      if (!outputPath) {
        const { error: missingOutputUpdateError } = await supabase.from('video_jobs').update({
          status: 'failed', error_message: 'completed_video_output_missing',
        }).eq('id', job.id).eq('user_id', user.id)
        if (missingOutputUpdateError) throw new Error('video_failed_persist_failed')
        await settleJobEconomy(supabase, {
          userId: user.id, jobId: job.id, finalStatus: 'failed', isAdminBypass,
          legacyIdempotencyKey: String(job.credit_idempotency_key || ''), reason: 'completed_video_output_missing',
        })
        return jsonResponse({ ok: true, status: 'failed', jobId: job.id, language, error: 'Nao foi possivel recuperar o video.' })
      }
      await settleJobEconomy(supabase, {
        userId: user.id, jobId: job.id, finalStatus: 'completed', isAdminBypass,
        legacyIdempotencyKey: String(job.credit_idempotency_key || ''), outputPath,
        telemetry: { delivery_recovered_from_completed_job: true },
      })
      await ensureStudioCreation(supabase, job as StudioCreationJob)
      const signedVideoUrl = await createSignedVideoUrl(supabase, outputPath)
      return jsonResponse({
        ok: true,
        status: 'completed',
        jobId: job.id,
        language,
        signedVideoUrl,
        publicationOptions: job.publication_options,
      })
    }

    if (job.status === 'failed') {
      await settleJobEconomy(supabase, {
        userId: user.id, jobId: job.id, finalStatus: 'failed', isAdminBypass,
        legacyIdempotencyKey: String(job.credit_idempotency_key || ''),
        reason: String(job.error_message || 'veo_video_failed'),
      })
      const errorMessage = sanitizeDebugText(job.error_message, 500)
      return jsonResponse({
        ok: true,
        status: 'failed',
        jobId: job.id,
        language,
        error: 'Nao foi possivel gerar o video neste momento.',
        errorMessage,
        debug: buildFailedJobDebug(job),
      })
    }

    const existingOutputPath = String(job.output_video_path || '')
    if (existingOutputPath) {
      const completedAt = new Date().toISOString()
      const { error: completedUpdateError } = await supabase
        .from('video_jobs')
        .update({
          status: 'completed',
          completed_at: completedAt,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)
      if (completedUpdateError) throw new Error('video_completed_persist_failed')

      await settleJobEconomy(supabase, {
        userId: user.id, jobId: job.id, finalStatus: 'completed', isAdminBypass,
        legacyIdempotencyKey: String(job.credit_idempotency_key || ''), outputPath: existingOutputPath,
        telemetry: { delivery_recovered_from_persisted_output: true },
      })
      await ensureStudioCreation(supabase, {
        ...job,
        status: 'completed',
        output_video_path: existingOutputPath,
        completed_at: completedAt,
      } as StudioCreationJob)

      const signedVideoUrl = await createSignedVideoUrl(supabase, existingOutputPath)
      return jsonResponse({
        ok: true,
        status: 'completed',
        jobId: job.id,
        language,
        signedVideoUrl,
        publicationOptions: job.publication_options,
      })
    }

    let providerJobId = String(job.provider_job_id || '')
    if (!providerJobId) {
      const { data: economyRequest } = await supabase.from('veo_video_economy_requests')
        .select('provider_job_id, model').eq('user_id', user.id).eq('client_request_id', job.id).maybeSingle()
      providerJobId = String(economyRequest?.provider_job_id || '')
      if (providerJobId) {
        await supabase.from('video_jobs').update({ status: 'generating', provider_job_id: providerJobId })
          .eq('id', job.id).eq('user_id', user.id)
      }
    }
    if (!providerJobId) {
      const createdAt = Date.parse(String(job.created_at || ''))
      if (Number.isFinite(createdAt) && Date.now() - createdAt > 15 * 60 * 1000) {
        const { error: staleUpdateError } = await supabase.from('video_jobs').update({
          status: 'failed', error_message: 'veo_video_start_timeout',
        }).eq('id', job.id).eq('user_id', user.id)
        if (staleUpdateError) throw new Error('video_failed_persist_failed')
        await settleJobEconomy(supabase, {
          userId: user.id, jobId: job.id, finalStatus: 'failed', isAdminBypass,
          legacyIdempotencyKey: String(job.credit_idempotency_key || ''), reason: 'veo_video_start_timeout',
        })
        return jsonResponse({ ok: true, status: 'failed', jobId: job.id, language, error: 'Nao foi possivel gerar o video neste momento.' })
      }
      return jsonResponse({
        ok: true,
        status: 'generating',
        jobId: job.id,
        language,
        message: 'Preparando seu video.',
      })
    }

    const providerStatus = await checkVeoVideoStatus(providerJobId)
    if (providerStatus.status === 'processing') {
      return jsonResponse({
        ok: true,
        status: 'generating',
        jobId: job.id,
        language,
        message: 'Gerando seu video.',
      })
    }

    if (providerStatus.status === 'failed') {
      const providerErrorMessage = sanitizeDebugText(providerStatus.errorMessage, 500)
      const { error: failedUpdateError } = await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: providerErrorMessage,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)
      if (failedUpdateError) throw new Error('video_failed_persist_failed')
      await settleJobEconomy(supabase, {
        userId: user.id, jobId: job.id, finalStatus: 'failed', isAdminBypass,
        legacyIdempotencyKey: String(job.credit_idempotency_key || ''),
        reason: 'veo_video_provider_failed', telemetry: { provider_terminal_status: 'failed' },
      })

      return jsonResponse({
        ok: true,
        status: 'failed',
        jobId: job.id,
        language,
        error: 'Nao foi possivel gerar o video neste momento.',
        errorMessage: providerErrorMessage,
        debug: buildFailedJobDebug({
          ...job,
          status: 'failed',
          error_message: providerErrorMessage,
        }),
      })
    }

    const outputPath = `${user.id}/${job.id}/video.mp4`
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(outputPath, providerStatus.videoBytes, {
        contentType: providerStatus.contentType || 'video/mp4',
        upsert: true,
      })
    if (uploadError) throw new Error(`video_upload_failed:${uploadError.message}`)

    const completedAt = new Date().toISOString()
    const { error: completedUpdateError } = await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        output_video_path: outputPath,
        completed_at: completedAt,
      })
      .eq('id', job.id)
      .eq('user_id', user.id)
    if (completedUpdateError) throw new Error('video_completed_persist_failed')

    await updateVeoVideoEconomyTelemetry(supabase, {
      userId: user.id, clientRequestId: job.id, providerJobId, model: String(job.model || ''),
      telemetry: {
        provider_terminal_status: 'completed',
        output_content_type: providerStatus.contentType || 'video/mp4',
        output_bytes: providerStatus.videoBytes.byteLength,
      },
    })
    await settleJobEconomy(supabase, {
      userId: user.id, jobId: job.id, finalStatus: 'completed', isAdminBypass,
      legacyIdempotencyKey: String(job.credit_idempotency_key || ''), outputPath,
      telemetry: { delivery_persisted_before_consumption: true },
    })
    await ensureStudioCreation(supabase, {
      ...job,
      status: 'completed',
      output_video_path: outputPath,
      completed_at: completedAt,
    } as StudioCreationJob)

    const signedVideoUrl = await createSignedVideoUrl(supabase, outputPath)
    return jsonResponse({
      ok: true,
      status: 'completed',
      jobId: job.id,
      language,
      signedVideoUrl,
      publicationOptions: job.publication_options,
    })
  } catch (error) {
    console.error(`[${reqId}] get-video-job-status erro:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ ok: false, error: 'Erro ao consultar o video.' }, 500)
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkVeoVideoStatus } from '../_shared/veoClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const VIDEO_BUCKET = 'studio-videos'

type JsonRecord = Record<string, unknown>
type ProfileRow = {
  email?: string | null
  role?: string | null
}

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

function isAdminBypassUser(profile: ProfileRow | null, user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const role = String(profile?.role || user.user_metadata?.role || '').toLowerCase()
  const email = String(profile?.email || user.email || '').toLowerCase()
  return role === 'admin' || email === 'riccieri68@gmail.com'
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

async function cancelCredits(supabase: ReturnType<typeof createClient>, userId: string, idempotencyKey: string, reason: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('cancel_credit_reservation', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  })
  if (error) console.warn('[get-video-job-status] falha ao cancelar reserva:', error.message)
}

async function consumeCredits(supabase: ReturnType<typeof createClient>, userId: string, idempotencyKey: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('consume_reserved_credits', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_observacao: 'Studio Hero - video IA concluido',
    p_metadata: { product: 'studio_hero' },
  })
  if (error) throw new Error(error.message || 'credit_consume_failed')
}

async function createSignedVideoUrl(supabase: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error('video_signed_url_failed')
  return data.signedUrl
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
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
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

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.warn(`[${reqId}] perfil nao carregado para bypass admin:`, profileError.message)
    }

    const isAdminBypass = isAdminBypassUser((profileRow as ProfileRow | null) || null, user)

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
      .select('id, user_id, status, mode, provider_job_id, output_video_path, credit_idempotency_key, error_message, model')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return jsonResponse({ ok: false, error: 'Job nao encontrado.' }, 404)
    }

    if (job.status === 'completed') {
      const outputPath = String(job.output_video_path || '')
      if (outputPath && !outputPath.startsWith(`${user.id}/`)) {
        return jsonResponse({ ok: false, error: 'Arquivo de video invalido.' }, 403)
      }
      const signedVideoUrl = outputPath ? await createSignedVideoUrl(supabase, outputPath) : ''
      return jsonResponse({
        ok: true,
        status: 'completed',
        jobId: job.id,
        signedVideoUrl,
      })
    }

    if (job.status === 'failed') {
      const errorMessage = sanitizeDebugText(job.error_message, 500)
      return jsonResponse({
        ok: true,
        status: 'failed',
        jobId: job.id,
        error: 'Nao foi possivel gerar o video neste momento.',
        errorMessage,
        debug: buildFailedJobDebug(job),
      })
    }

    if (job.mode === 'smart_video' && ['queued', 'processing', 'rendering'].includes(job.status)) {
      const messages: Record<string, string> = {
        queued: 'Video na fila de processamento.',
        processing: 'Preparando o video original.',
        rendering: 'Finalizando o Smart Video.',
      }
      return jsonResponse({
        ok: true,
        status: job.status,
        jobId: job.id,
        message: messages[job.status] || 'Preparando seu video.',
      })
    }

    const existingOutputPath = String(job.output_video_path || '')
    if (existingOutputPath) {
      if (!existingOutputPath.startsWith(`${user.id}/`)) {
        return jsonResponse({ ok: false, error: 'Arquivo de video invalido.' }, 403)
      }
      await supabase
        .from('video_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      const signedVideoUrl = await createSignedVideoUrl(supabase, existingOutputPath)
      return jsonResponse({
        ok: true,
        status: 'completed',
        jobId: job.id,
        signedVideoUrl,
      })
    }

    const providerJobId = String(job.provider_job_id || '')
    if (!providerJobId) {
      return jsonResponse({
        ok: true,
        status: 'generating',
        jobId: job.id,
        message: 'Preparando seu video.',
      })
    }

    const providerStatus = await checkVeoVideoStatus(providerJobId)
    if (providerStatus.status === 'processing') {
      return jsonResponse({
        ok: true,
        status: 'generating',
        jobId: job.id,
        message: 'Gerando seu video.',
      })
    }

    if (providerStatus.status === 'failed') {
      const providerErrorMessage = sanitizeDebugText(providerStatus.errorMessage, 500)
      await cancelCredits(supabase, user.id, String(job.credit_idempotency_key || ''), 'studio_hero_provider_failed')
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: providerErrorMessage,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      return jsonResponse({
        ok: true,
        status: 'failed',
        jobId: job.id,
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

    if (isAdminBypass) {
      await cancelCredits(supabase, user.id, String(job.credit_idempotency_key || ''), 'studio_hero_admin_bypass')
    } else {
      await consumeCredits(supabase, user.id, String(job.credit_idempotency_key || ''))
    }

    await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        output_video_path: outputPath,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('user_id', user.id)

    const signedVideoUrl = await createSignedVideoUrl(supabase, outputPath)
    return jsonResponse({
      ok: true,
      status: 'completed',
      jobId: job.id,
      signedVideoUrl,
    })
  } catch (error) {
    console.error(`[${reqId}] get-video-job-status erro:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ ok: false, error: 'Erro ao consultar o video.' }, 500)
  }
})

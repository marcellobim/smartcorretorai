import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startVeoVideo } from '../_shared/veoClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const DEFAULT_MODEL = 'veo-3.1-fast-generate-001'
const DEFAULT_TOKEN_COST = 500
const VIDEO_BUCKET = 'studio-videos'

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: unknown, maxLength = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeStoragePath(value: unknown, userId: string) {
  const path = normalizeText(value, 700)
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
  if (!path || !path.startsWith(`${userId}/`)) return ''
  return path
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function buildPromptFinal({ bairro, caracteristica, oferta, cta }: {
  bairro: string
  caracteristica: string
  oferta: string
  cta: string
}) {
  return `Create an ultra realistic luxury real estate commercial.

Vertical format 9:16.

Duration 8 seconds.

Use the first uploaded image as the opening scene.

Use the second uploaded image as the final scene.

Preserve the uploaded property and maintain realism.

Do not invent amenities, pools, penthouses, luxury features or architectural elements that do not exist in the uploaded images.

Luxury real estate marketing style.

Golden hour lighting.

Elegant cinematic sound design.

Subtle bells.

Luxury atmosphere.

No people.

No logos.

No watermark.

No interface elements.

SCENE 1 - OPENING

Begin with the first property image.

Create a cinematic luxury reveal.

Slow camera movement.

Depth.

Light rays.

Subtle floating particles.

Create curiosity and anticipation.

Reveal:

"${bairro}"

SCENE 2 - DEVELOPING

Maintain the first image or create a smooth transition within it.

Enhance the luxury atmosphere.

Reveal:

"${caracteristica}"

SCENE 3 - TRANSITION

Create a smooth cinematic transition to the second property image.

Stronger reveal.

Luxury atmosphere.

Reveal:

"${oferta}"

SCENE 4 - FINAL CTA

Keep the second image visible.

Reveal:

"${cta}"

Hold the final frame.

Do not create any additional scenes.

Do not transition away from the final frame.

The video must end on the final call to action.

The final frame should remain visible until the video ends.

Create a premium luxury real estate trailer designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.`
}

function getTokenCost() {
  const configured = Number(Deno.env.get('STUDIO_HERO_TOKEN_COST') || '')
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_TOKEN_COST
}

async function reserveCredits(supabase: ReturnType<typeof createClient>, userId: string, jobId: string, amount: number) {
  const idempotencyKey = `studio-hero:${jobId}`
  const { data, error } = await supabase.rpc('reserve_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_campaign_id: null,
    p_reason: 'studio-hero-video',
    p_metadata: {
      product: 'studio_hero',
      mode: 'dynamic_reel',
      job_id: jobId,
    },
  })

  if (error) throw new Error(error.message || 'credit_reservation_failed')
  const [reservation] = Array.isArray(data) ? data : []
  if (!reservation?.idempotency_key) throw new Error('credit_reservation_empty')
  return {
    id: reservation.id as string | undefined,
    idempotencyKey: reservation.idempotency_key as string,
    amount: Number(reservation.amount || amount),
    status: String(reservation.status || 'reserved'),
  }
}

async function cancelCredits(supabase: ReturnType<typeof createClient>, userId: string, idempotencyKey: string, reason: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('cancel_credit_reservation', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  })
  if (error) console.warn('[criar-video-ia] falha ao cancelar reserva:', error.message)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const reqId = crypto.randomUUID().slice(0, 8)

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ success: false, error: 'Configuracao indisponivel.' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) {
      console.warn(`[${reqId}] jwt invalido:`, authError?.message)
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const body = await req.json().catch(() => ({})) as JsonRecord
    const style = normalizeText(body.style, 40) || 'alto_padrao'
    const bairro = normalizeText(body.bairro, 40).toUpperCase() || 'MOEMA'
    const caracteristica = normalizeText(body.caracteristica, 50).toUpperCase() || '4 SUITES'
    const oferta = normalizeText(body.oferta, 40).toUpperCase() || 'A VENDA'
    const cta = normalizeText(body.cta, 60).toUpperCase() || 'AGENDE SUA VISITA'
    const inputImage1Path = normalizeStoragePath(body.inputImage1Path, user.id)
    const inputImage2Path = normalizeStoragePath(body.inputImage2Path, user.id)
    const requestedJobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()

    if (!inputImage1Path || !inputImage2Path) {
      return jsonResponse({
        success: false,
        error: 'Envie as duas imagens do video antes de gerar.',
      }, 400)
    }

    const expectedPrefix = `${user.id}/${requestedJobId}/`
    if (!inputImage1Path.startsWith(expectedPrefix) || !inputImage2Path.startsWith(expectedPrefix)) {
      return jsonResponse({
        success: false,
        error: 'Nao foi possivel validar as imagens enviadas.',
      }, 400)
    }

    const promptFinal = buildPromptFinal({ bairro, caracteristica, oferta, cta })
    const model = Deno.env.get('VEO_MODEL_ID') || DEFAULT_MODEL
    const veoEnabled = Deno.env.get('VEO_ENABLE_VERTEX_CALLS') === 'true'

    const { data: job, error: insertError } = await supabase
      .from('video_jobs')
      .insert({
        id: requestedJobId,
        user_id: user.id,
        status: 'pending',
        mode: 'dynamic_reel',
        style,
        model,
        prompt_final: promptFinal,
        input_image_1_path: inputImage1Path,
        input_image_2_path: inputImage2Path,
        tokens_reserved: 0,
      })
      .select('id')
      .single()

    if (insertError || !job?.id) {
      console.warn(`[${reqId}] video_jobs insert falhou:`, insertError?.message)
      return jsonResponse({ success: false, error: 'Nao foi possivel iniciar o video.' }, 500)
    }

    if (!veoEnabled) {
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: 'veo_disabled',
          tokens_reserved: 0,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      console.warn(`[${reqId}] Studio Hero em modo teste: Veo desligado.`)
      return jsonResponse({
        success: false,
        job_id: job.id,
        jobId: job.id,
        status: 'disabled',
        error: 'A geracao real de video ainda esta desligada neste ambiente.',
      }, 503)
    }

    const tokenCost = getTokenCost()
    let creditIdempotencyKey = ''

    try {
      const reservation = await reserveCredits(supabase, user.id, job.id, tokenCost)
      creditIdempotencyKey = reservation.idempotencyKey

      await supabase
        .from('video_jobs')
        .update({
          status: 'generating',
          tokens_reserved: reservation.amount,
          credit_reservation_id: reservation.id || null,
          credit_idempotency_key: reservation.idempotencyKey,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      const veoResult = await startVeoVideo({
        prompt: promptFinal,
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        userId: user.id,
        jobId: job.id,
        bucket: VIDEO_BUCKET,
        supabase,
      })

      await supabase
        .from('video_jobs')
        .update({
          status: 'generating',
          provider_job_id: veoResult.providerJobId,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      return jsonResponse({
        ok: true,
        success: true,
        jobId: job.id,
        job_id: job.id,
        status: 'generating',
        message: 'Video em criacao.',
      })
    } catch (error) {
      await cancelCredits(supabase, user.id, creditIdempotencyKey, 'studio_hero_failed')
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      console.warn(`[${reqId}] Studio Hero falhou:`, error instanceof Error ? error.message : String(error))
      return jsonResponse({
        success: false,
        job_id: job.id,
        status: 'failed',
        error: 'Nao foi possivel gerar o video neste momento.',
      })
    }
  } catch (error) {
    console.error(`[${reqId}] criar-video-ia erro inesperado:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ success: false, error: 'Erro inesperado ao preparar o video.' }, 500)
  }
})

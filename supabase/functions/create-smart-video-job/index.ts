import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VIDEO_BUCKET = 'studio-videos'
const MAX_DURATION_SECONDS = 195
const MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply({ ok: false, error: 'Metodo nao permitido.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return reply({ ok: false, error: 'Configuracao indisponivel.' }, 500)

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) return reply({ ok: false, error: 'Sessao invalida.' }, 401)

    const contract = await req.json().catch(() => null) as Record<string, any> | null
    const video = contract?.video
    if (contract?.schemaVersion !== 'smart_video_input_v1' || !video) {
      return reply({ ok: false, error: 'Contrato do Smart Video invalido.' }, 400)
    }
    if (video.storageBucket !== VIDEO_BUCKET) return reply({ ok: false, error: 'Bucket invalido.' }, 400)
    if (typeof video.storagePath !== 'string' || !video.storagePath.startsWith(`${user.id}/smart-video/`)) return reply({ ok: false, error: 'Arquivo nao pertence ao usuario.' }, 403)
    if (!MIME_TYPES.has(String(video.mimeType || '').toLowerCase())) return reply({ ok: false, error: 'Formato de video invalido.' }, 400)
    const duration = Number(video.durationSeconds)
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) return reply({ ok: false, error: 'Este video ultrapassa o limite aceito. Envie uma versao com aproximadamente 3 minutos.' }, 400)

    const { data: sourceFile, error: sourceError } = await supabase.storage.from(VIDEO_BUCKET).download(video.storagePath)
    if (sourceError || !sourceFile || sourceFile.size < 1) return reply({ ok: false, error: 'Arquivo original nao encontrado.' }, 400)

    const jobId = crypto.randomUUID()
    const { data: job, error: insertError } = await supabase.from('video_jobs').insert({
      id: jobId,
      user_id: user.id,
      status: 'queued',
      mode: 'smart_video',
      style: 'smart_video_v1',
      model: 'smart-motion-engine',
      prompt_final: JSON.stringify(contract),
      input_image_1_path: video.storagePath,
      tokens_reserved: 0,
    }).select('id, status').single()

    if (insertError || !job) return reply({ ok: false, error: 'Nao foi possivel criar o job.' }, 500)
    return reply({ ok: true, jobId: job.id, status: 'queued', tokens: { status: 'not_configured', reserved: 0 } }, 202)
  } catch (error) {
    console.error('[create-smart-video-job]', error)
    return reply({ ok: false, error: 'Nao foi possivel preparar o Smart Video.' }, 500)
  }
})

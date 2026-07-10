import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VIDEO_BUCKET = 'studio-videos'
const MAX_DURATION_SECONDS = 195
const MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
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
    const isCarousel = contract?.schemaVersion === 'smart_carousel_input_v1'
    const video = contract?.video
    const images = Array.isArray(contract?.images) ? contract.images : []
    if (!isCarousel && (contract?.schemaVersion !== 'smart_video_input_v1' || !video)) {
      return reply({ ok: false, error: 'Contrato de midia invalido.' }, 400)
    }

    const sourcePaths: string[] = []
    if (isCarousel) {
      if (contract?.mode !== 'smart_carousel') return reply({ ok: false, error: 'Modo do Super Carrossel invalido.' }, 400)
      if (contract?.storageBucket !== VIDEO_BUCKET) return reply({ ok: false, error: 'Bucket invalido.' }, 400)
      if (images.length < 1 || images.length > 20 || Number(contract?.totalImages) !== images.length) {
        return reply({ ok: false, error: 'Envie de 1 a 20 imagens.' }, 400)
      }
      for (const [index, image] of images.entries()) {
        if (image.storageBucket !== VIDEO_BUCKET) return reply({ ok: false, error: 'Bucket invalido.' }, 400)
        if (typeof image.storagePath !== 'string' || !image.storagePath.startsWith(`${user.id}/super-carrossel/`)) {
          return reply({ ok: false, error: 'Imagem nao pertence ao usuario.' }, 403)
        }
        if (!IMAGE_MIME_TYPES.has(String(image.mimeType || '').toLowerCase())) return reply({ ok: false, error: 'Formato de imagem invalido.' }, 400)
        if (Number(image.order) !== index) return reply({ ok: false, error: 'Ordem das imagens invalida.' }, 400)
        if ((index === 0) !== (image.isCover === true)) return reply({ ok: false, error: 'A primeira imagem deve ser a capa.' }, 400)
        sourcePaths.push(image.storagePath)
      }
    } else {
      if (video.storageBucket !== VIDEO_BUCKET) return reply({ ok: false, error: 'Bucket invalido.' }, 400)
      if (typeof video.storagePath !== 'string' || !video.storagePath.startsWith(`${user.id}/smart-video/`)) return reply({ ok: false, error: 'Arquivo nao pertence ao usuario.' }, 403)
      if (!MIME_TYPES.has(String(video.mimeType || '').toLowerCase())) return reply({ ok: false, error: 'Formato de video invalido.' }, 400)
      const duration = Number(video.durationSeconds)
      if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) return reply({ ok: false, error: 'Este video ultrapassa o limite aceito. Envie uma versao com aproximadamente 3 minutos.' }, 400)
      sourcePaths.push(video.storagePath)
    }

    for (const storagePath of sourcePaths) {
      const { data: sourceFile, error: sourceError } = await supabase.storage.from(VIDEO_BUCKET).download(storagePath)
      if (sourceError || !sourceFile || sourceFile.size < 1) return reply({ ok: false, error: 'Arquivo original nao encontrado.' }, 400)
    }

    const jobId = crypto.randomUUID()
    const { data: job, error: insertError } = await supabase.from('video_jobs').insert({
      id: jobId,
      user_id: user.id,
      status: 'queued',
      mode: isCarousel ? 'smart_carousel' : 'smart_video',
      style: isCarousel ? 'smart_carousel_v1' : 'smart_video_v1',
      model: 'smart-motion-engine',
      prompt_final: JSON.stringify(contract),
      input_image_1_path: sourcePaths[0],
      tokens_reserved: 0,
    }).select('id, status').single()

    if (insertError || !job) return reply({ ok: false, error: 'Nao foi possivel criar o job.' }, 500)
    return reply({ ok: true, jobId: job.id, status: 'queued', tokens: { status: 'not_configured', reserved: 0 } }, 202)
  } catch (error) {
    console.error('[create-smart-video-job]', error)
    return reply({ ok: false, error: 'Nao foi possivel preparar o Smart Video.' }, 500)
  }
})

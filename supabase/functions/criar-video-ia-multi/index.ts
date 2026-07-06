import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const VIDEO_BUCKET = 'studio-videos'
const MAX_IMAGES = 5
const MIN_IMAGES = 2
const SUPPORTED_IMAGE_PATH = /\.(jpe?g|png)$/i
const SAFE_TEXT_PATTERN = /[^A-Z0-9\s/-]/g

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: unknown, maxLength = 80) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SAFE_TEXT_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function normalizeStoragePath(value: unknown, userId: string, jobId: string) {
  const raw = String(value || '').trim().replace(/^\/+/, '')
  if (!raw || raw.includes('..') || raw.includes('\\')) return ''
  if (!raw.startsWith(`${userId}/${jobId}/`)) return ''
  if (!SUPPORTED_IMAGE_PATH.test(raw)) return ''
  return raw
}

function normalizeImagePaths(value: unknown, userId: string, jobId: string) {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const item of value) {
    const path = normalizeStoragePath(item, userId, jobId)
    if (path) unique.add(path)
  }
  return Array.from(unique).slice(0, MAX_IMAGES)
}

function buildFinalFrameDescriptor(options: { userId: string; jobId: string; variant: string; cta: string }) {
  if (options.variant === 'clean') {
    return {
      type: 'neutral_blank_frame',
      path: `${options.userId}/${options.jobId}/system-neutral-final-frame.png`,
      hasText: false,
      description: 'Frame neutro sem texto, logo ou marca.',
    }
  }

  return {
    type: 'cta_frame',
    path: `${options.userId}/${options.jobId}/system-cta-final-frame.png`,
    hasText: true,
    text: options.cta || 'SAIBA MAIS',
    description: 'Frame final com chamada comercial sanitizada.',
  }
}

function buildPairs(imagePaths: string[], finalFramePath: string) {
  const pairs = []
  for (let index = 0; index < imagePaths.length - 1; index += 1) {
    pairs.push({
      index: index + 1,
      from: imagePaths[index],
      to: imagePaths[index + 1],
      role: 'image_to_image',
    })
  }
  pairs.push({
    index: imagePaths.length,
    from: imagePaths[imagePaths.length - 1],
    to: finalFramePath,
    role: 'final_frame',
  })
  return pairs
}

function buildBasePrompt(input: { variant: string; objective: string; cta: string }) {
  const textPolicy = input.variant === 'clean'
    ? 'Do not add visible text, logos, marks, captions, phone numbers or watermarks.'
    : `Use the commercial intent naturally and finish with the provided final call to action: ${input.cta || 'SAIBA MAIS'}.`

  return [
    'Create a vertical cinematic real estate video segment in Brazilian advertising style.',
    'Preserve the real property identity, architecture, materials and proportions from the input frames.',
    'Use smooth premium camera movement, elegant lighting, realistic depth and tasteful motion.',
    'Avoid slideshow feeling, warped geometry, duplicated objects, random text and hallucinated property facts.',
    input.objective ? `Commercial objective: ${input.objective}.` : '',
    textPolicy,
  ].filter(Boolean).join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
    }

    if (String(Deno.env.get('STUDIO_HERO_MULTI_IMAGE_ENABLED') || '').toLowerCase() !== 'true') {
      return jsonResponse({ success: false, error: 'Este modo ainda nao esta ativo neste ambiente.' }, 404)
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
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const body = await req.json().catch(() => ({})) as JsonRecord
    const jobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()
    const variant = normalizeText(body.variant, 24) === 'CLEAN' ? 'clean' : 'with_texts'
    const imagePaths = normalizeImagePaths(body.imagePaths, user.id, jobId)
    const objective = normalizeText(body.objective, 80)
    const cta = normalizeText(body.cta, 32) || 'SAIBA MAIS'

    if (imagePaths.length < MIN_IMAGES) {
      return jsonResponse({ success: false, error: 'Envie pelo menos duas imagens JPG ou PNG.' }, 400)
    }

    if (variant === 'with_texts' && !objective) {
      return jsonResponse({ success: false, error: 'Informe o objetivo do tour.' }, 400)
    }

    for (const path of imagePaths) {
      const { data, error } = await supabase.storage.from(VIDEO_BUCKET).download(path)
      if (error || !data) {
        return jsonResponse({ success: false, error: 'Nao foi possivel validar uma das imagens enviadas.' }, 400)
      }
    }

    const finalFrame = buildFinalFrameDescriptor({ userId: user.id, jobId, variant, cta })
    const pairs = buildPairs(imagePaths, finalFrame.path)
    const prompt = buildBasePrompt({ variant, objective, cta })

    return jsonResponse({
      ok: true,
      success: true,
      jobId,
      job_id: jobId,
      status: 'planned',
      message: 'Seu tour foi preparado para processamento.',
      renderReady: false,
      bucket: VIDEO_BUCKET,
      imagePaths,
      finalFrame,
      pairs,
      prompt,
      warnings: [
        'A funcao valida entradas e monta os pares automaticamente.',
        'A etapa de geracao dos clipes e montagem final deve ser ligada no worker/renderizador antes de entrega real.',
      ],
    })
  } catch (error) {
    console.error('[criar-video-ia-multi] erro inesperado:', error)
    return jsonResponse({ success: false, error: 'Nao foi possivel preparar este tour.' }, 500)
  }
})

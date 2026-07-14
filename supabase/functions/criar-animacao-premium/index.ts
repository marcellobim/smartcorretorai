import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VIDEO_BUCKET = 'studio-videos'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': [
    'authorization',
    'Authorization',
    'x-client-info',
    'X-Client-Info',
    'apikey',
    'ApiKey',
    'content-type',
    'Content-Type',
    'prefer',
    'Prefer',
    'x-supabase-api-version',
    'X-Supabase-Api-Version',
    'x-supabase-authorization',
    'X-Supabase-Authorization',
    'accept',
    'Accept',
  ].join(', '),
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
  'Access-Control-Max-Age': '86400',
}

const ANIMATION_TEMPLATES = {
  with_texts: {
    1: 'ccd30b12-7ad7-4f87-8a49-ff987dc82a7f',
    2: 'fcc1a05e-cef5-4d8c-9d07-4e21f8378f3a',
    3: '2bfa8b93-89f0-437d-9678-de225ab7c079',
    4: '356174ea-7990-4e72-9d4d-3a641ff593fe',
  },
  clean: {
    1: 'd1a56979-bd9b-42f2-84a7-462926573af4',
    2: '1d7ab7ec-2571-4265-97e5-7230d524179e',
    3: 'f0caa027-7857-4112-a54a-b7ad6edd7c31',
    4: '7a0d03f5-6394-4e91-8afa-95b7165b16f2',
  },
}

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: unknown, maxLength = 80) {
  return String(value ?? '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizeMultilineText(value: unknown, maxLength = 160) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, maxLength)
}

function normalizeNumber(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 4)
}

function buildPropertyDetails(fields: JsonRecord) {
  const dormitorios = normalizeNumber(fields.dormitorios ?? fields.bedrooms)
  const suites = normalizeNumber(fields.suites)
  const vagas = normalizeNumber(fields.vagas ?? fields.parking)
  const area = normalizeNumber(fields.area)

  return [
    dormitorios ? `${dormitorios} dorms` : '',
    suites ? `${suites} suíte${suites === '1' ? '' : 's'}` : '',
    vagas ? `${vagas} vaga${vagas === '1' ? '' : 's'}` : '',
    area ? `${area} m²` : '',
  ].filter(Boolean).join(' • ')
}

function buildDescription(fields: JsonRecord, localizacao: string) {
  const provided = normalizeMultilineText(fields.description ?? fields.descricao, 160)
  if (provided) return provided
  return normalizeMultilineText([
    localizacao,
    buildPropertyDetails(fields),
  ].filter(Boolean).join('\n'), 160)
}

function normalizeStoragePath(value: unknown, userId: string, jobId: string) {
  const path = String(value ?? '').replace(/^\/+/, '').trim()
  if (!path) return ''
  if (path.includes('..')) return ''
  if (!path.startsWith(`${userId}/${jobId}/`)) return ''
  if (!/\.(jpe?g|png)$/i.test(path)) return ''
  return path
}

function normalizeVariant(value: unknown) {
  const variant = String(value || '').trim().toLowerCase()
  return variant === 'clean' ? 'clean' : 'with_texts'
}

function resolveTemplateId(variant: string, imageCount: number) {
  const templates = ANIMATION_TEMPLATES[variant as keyof typeof ANIMATION_TEMPLATES]
  return templates?.[imageCount as keyof typeof templates] || ''
}

function normalizeProviderStatus(value: unknown) {
  return String(value || 'planned').trim().toLowerCase()
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function getCreatomateVideoUrl(item: Record<string, unknown>) {
  const output = item.output && typeof item.output === 'object' ? item.output as Record<string, unknown> : null
  const render = item.render && typeof item.render === 'object' ? item.render as Record<string, unknown> : null
  const result = item.result && typeof item.result === 'object' ? item.result as Record<string, unknown> : null
  return (
    getStringValue(item.url)
    || getStringValue(item.output_url)
    || getStringValue(output?.url)
    || getStringValue(render?.url)
    || getStringValue(result?.url)
  )
}

function isMp4Url(value: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) && /\.mp4$/i.test(url.pathname)
  } catch {
    return false
  }
}

function getSafeProviderUrlLog(value: string) {
  if (!value) return { has_url: false, is_mp4_url: false }
  try {
    const url = new URL(value)
    return {
      has_url: true,
      is_mp4_url: isMp4Url(value),
      url_host: url.host,
      url_path_ending: url.pathname.slice(-32),
    }
  } catch {
    return { has_url: true, is_mp4_url: false, url_host: 'invalid-url' }
  }
}

function getImagePaths(body: JsonRecord, userId: string, jobId: string) {
  const rawPaths = Array.isArray(body.imagePaths)
    ? body.imagePaths
    : Array.isArray(body.image_paths)
      ? body.image_paths
      : []

  return rawPaths
    .map((path) => normalizeStoragePath(path, userId, jobId))
    .filter(Boolean)
    .slice(0, 4)
}

async function createSignedImageUrls(
  supabase: ReturnType<typeof createClient>,
  imagePaths: string[],
) {
  const urls: string[] = []
  for (const path of imagePaths) {
    const { data, error } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24)

    if (error || !data?.signedUrl) {
      throw new Error(`image_signed_url_failed:${path}`)
    }
    urls.push(data.signedUrl)
  }
  return urls
}

function addTextModification(
  modifications: Record<string, unknown>,
  name: string,
  value: string,
  hideWhenEmpty = false,
) {
  modifications[`${name}.text`] = value
  if (hideWhenEmpty && !value) {
    modifications[`${name}.track`] = false
  }
}

function buildModifications(variant: string, imageUrls: string[], fields: JsonRecord) {
  const modifications: Record<string, unknown> = {}

  imageUrls.forEach((url, index) => {
    modifications[`Video-${index + 1}`] = url
  })

  if (variant === 'with_texts') {
    const finalidade = normalizeText(fields.finalidade, 40)
    const status = normalizeText(fields.status, 40)
    const localizacao = normalizeText(fields.localizacao ?? fields.location, 40)
    const description = buildDescription(fields, localizacao)
    const cta = normalizeText(fields.cta, 40)
    const telefone = normalizeText(fields.telefone ?? fields.phone, 40)

    addTextModification(modifications, 'Text', status)
    addTextModification(modifications, 'Subtext', finalidade)
    addTextModification(modifications, 'Description', description)
    addTextModification(modifications, 'Name', cta)
    addTextModification(modifications, 'Phone-Number', telefone, true)
  }

  return modifications
}

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CREATOMATE_API_KEY) {
      return jsonResponse({ error: 'Configuracao de animacao indisponivel.' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization header ausente ou invalido' }, 401)
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (!user || authError) {
      console.warn(`[${reqId}] token invalido:`, authError?.message)
      return jsonResponse({ error: 'Nao autorizado' }, 401)
    }

    const body = await req.json().catch(() => ({})) as JsonRecord
    const jobId = normalizeText(body.jobId, 80) || crypto.randomUUID()
    const variant = normalizeVariant(body.variant)
    const fields = body.fields && typeof body.fields === 'object' ? body.fields as JsonRecord : {}
    const imagePaths = getImagePaths(body, user.id, jobId)
    const requestedImageCount = Number(body.imageCount || body.image_count || imagePaths.length)

    if (!Number.isFinite(requestedImageCount) || requestedImageCount < 1 || requestedImageCount > 4) {
      return jsonResponse({ error: 'Selecione de 1 a 4 imagens.' }, 400)
    }

    if (imagePaths.length !== requestedImageCount) {
      return jsonResponse({ error: 'Quantidade de imagens enviada nao corresponde ao fluxo escolhido.' }, 400)
    }

    const templateId = resolveTemplateId(variant, requestedImageCount)
    if (!templateId) {
      return jsonResponse({ error: 'Template de animacao nao encontrado para esta quantidade de imagens.' }, 400)
    }

    if (variant === 'with_texts') {
      const missing = ['finalidade', 'status', 'localizacao', 'cta']
        .filter((key) => !normalizeText(fields[key]))
      if (missing.length > 0) {
        return jsonResponse({ error: `Campos obrigatorios ausentes: ${missing.join(', ')}` }, 400)
      }
    }

    const imageUrls = await createSignedImageUrls(supabase, imagePaths)
    const modifications = buildModifications(variant, imageUrls, fields)

    console.log(`[${reqId}] criar-animacao-premium`, {
      user_id: user.id,
      variant,
      template_selection: 'variant_and_image_count',
      template_id: templateId,
      requested_image_count: requestedImageCount,
      signed_image_count: imageUrls.length,
      signed_urls_generated: imageUrls.length === requestedImageCount,
      modification_keys: Object.keys(modifications),
    })

    const createRes = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CREATOMATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!createRes.ok) {
      const errorBody = await createRes.text()
      console.error(`[${reqId}] Creatomate ${createRes.status}:`, errorBody.slice(0, 500))
      return jsonResponse({
        ok: false,
        error: `Creatomate retornou ${createRes.status}`,
        provider_error: errorBody.slice(0, 500),
      }, 502)
    }

    const responseBody = await createRes.json()
    const item = Array.isArray(responseBody) ? responseBody[0] : responseBody
    if (!item?.id) {
      return jsonResponse({ ok: false, error: 'Creatomate nao retornou render_id.' }, 502)
    }
    const providerStatus = normalizeProviderStatus(item.status)
    const providerVideoUrl = getCreatomateVideoUrl(item)
    const providerUrlIsMp4 = isMp4Url(providerVideoUrl)
    const urlReady = ['succeeded', 'completed'].includes(providerStatus) && providerUrlIsMp4

    console.log(`[${reqId}] Creatomate render criado`, {
      render_id: item.id,
      status: providerStatus,
      ...getSafeProviderUrlLog(providerVideoUrl),
      response_keys: Object.keys(item).slice(0, 20),
    })

    return jsonResponse({
      ok: true,
      success: true,
      render_id: item.id,
      template_id: templateId,
      status: providerStatus,
      url: urlReady ? providerVideoUrl : null,
      provider_url_present: Boolean(providerVideoUrl),
      provider_url_is_mp4: providerUrlIsMp4,
      snapshot_url: item.snapshot_url || null,
    }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

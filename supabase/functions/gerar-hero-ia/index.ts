import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const IMAGE_MODES = new Set(['main_photo', 'reference_photos', 'new_image'])
const DELIVERY_KEYS = new Set([
  'hero_image',
  'instagram_text',
  'hashtags',
  'cta',
  'whatsapp',
  'portal_description',
])

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeText(value: unknown, maxLength = 180) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeId(value: unknown, allowed?: Set<string>) {
  const normalized = normalizeText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  if (!normalized) return ''
  if (allowed && !allowed.has(normalized)) return ''
  return normalized
}

function normalizeTextArray(value: unknown, maxItems = 12, maxLength = 120) {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    const normalized = normalizeText(item, maxLength)
    if (normalized && !items.includes(normalized)) items.push(normalized)
    if (items.length >= maxItems) break
  }
  return items
}

function parseMasterProperty(description: unknown) {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return {}

  try {
    const parsed = JSON.parse(raw.slice(markerIndex + MASTER_MARKER.length).trim())
    return parsed && typeof parsed === 'object' ? parsed as JsonRecord : {}
  } catch {
    return {}
  }
}

function normalizeDeliverables(input: unknown) {
  const source = input && typeof input === 'object' ? input as JsonRecord : {}
  const deliverables: Record<string, boolean> = {}
  for (const key of DELIVERY_KEYS) {
    deliverables[key] = source[key] !== false
  }
  deliverables.hero_image = true
  return deliverables
}

function normalizeValueCondition(input: unknown) {
  const source = input && typeof input === 'object' ? input as JsonRecord : {}
  const mode = normalizeId(source.mode)
  return {
    mode: mode || 'hide_values',
    details: normalizeText(source.details, 280),
  }
}

function buildPromptBriefing(property: JsonRecord, masterProperty: JsonRecord, payload: JsonRecord) {
  const photos = Array.isArray(property.fotos) ? property.fotos : []
  const selectedHighlights = normalizeTextArray(payload.highlights, 12, 120)
  const masterHighlights = normalizeTextArray(
    masterProperty.destaques_selecionados ?? masterProperty.destaques,
    20,
    120,
  )

  return {
    schema_version: 'hero_prompt_briefing_v1',
    source: 'hero_ia_smart_prompt_engine',
    property: {
      id: property.id,
      title: normalizeText(property.titulo, 160),
      type: normalizeText(property.tipo, 80),
      purpose: 'venda',
      price: property.preco ?? null,
      area: property.area ?? null,
      bedrooms: property.quartos ?? null,
      suites: masterProperty.suites ?? null,
      bathrooms: property.banheiros ?? null,
      parking_spaces: property.vagas ?? null,
      neighborhood: normalizeText(property.bairro, 100),
      city: normalizeText(property.cidade, 100),
      state: normalizeText(property.estado, 2),
      photo_count: photos.length,
      master_profile: normalizeText(masterProperty.perfil_imovel, 120),
      master_property_state: normalizeText(masterProperty.estado_imovel, 120),
      master_highlights: masterHighlights,
    },
    choices: {
      image_mode: normalizeId(payload.image_mode, IMAGE_MODES),
      audience: normalizeId(payload.audience),
      subcategory: normalizeText(payload.subcategory, 120),
      property_state: normalizeText(payload.property_state || masterProperty.estado_imovel, 120),
      highlights: selectedHighlights,
      cta: normalizeText(payload.cta, 120),
      value_condition: normalizeValueCondition(payload.value_condition),
      additional_info: normalizeText(payload.additional_info, 400),
    },
  }
}

async function resolveRetentionDays(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[gerar-hero-ia] subscription lookup failed:', error.message)
    return 1
  }

  return data ? 15 : 1
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

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Configuracao indisponivel.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ error: 'Nao autorizado' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.warn(`[${reqId}] invalid jwt:`, authError?.message)
      return jsonResponse({ error: 'Nao autorizado' }, 401)
    }

    const payload = await req.json().catch(() => ({})) as JsonRecord
    const propertyId = typeof payload.property_id === 'string' ? payload.property_id : ''
    if (!isUuid(propertyId)) {
      return jsonResponse({ error: 'property_id obrigatorio' }, 400)
    }

    const imageMode = normalizeId(payload.image_mode, IMAGE_MODES)
    if (!imageMode) {
      return jsonResponse({ error: 'image_mode invalido' }, 400)
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, user_id, titulo, tipo, finalidade, preco, area, quartos, banheiros, vagas, bairro, cidade, estado, descricao, fotos')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (propertyError) {
      console.warn(`[${reqId}] property lookup failed:`, propertyError.message)
      return jsonResponse({ error: 'Falha ao validar imovel' }, 500)
    }

    if (!property) {
      return jsonResponse({ error: 'Imovel nao encontrado' }, 404)
    }

    const masterProperty = parseMasterProperty(property.descricao)
    const promptBriefing = buildPromptBriefing(property as JsonRecord, masterProperty, payload)
    const deliverables = normalizeDeliverables(payload.deliverables)
    const retentionDays = await resolveRetentionDays(supabase, user.id)
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: generation, error: insertError } = await supabase
      .from('hero_generations')
      .insert({
        user_id: user.id,
        property_id: property.id,
        status: 'pending',
        prompt_briefing: promptBriefing,
        deliverables,
        texts: {},
        credit_amount: 0,
        credit_status: 'not_required',
        expires_at: expiresAt,
      })
      .select('id, status, expires_at')
      .single()

    if (insertError || !generation) {
      console.warn(`[${reqId}] hero generation insert failed:`, insertError?.message)
      return jsonResponse({ error: 'Falha ao preparar Hero IA' }, 500)
    }

    console.log(`[${reqId}] hero generation prepared`)

    return jsonResponse({
      success: true,
      generation_id: generation.id,
      status: generation.status,
      expires_at: generation.expires_at,
    })
  } catch (error) {
    console.error(`[${reqId}] gerar-hero-ia failed:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ error: 'Falha ao preparar Hero IA' }, 500)
  }
})

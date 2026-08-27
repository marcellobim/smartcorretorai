import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { jsonResponse, withCors } from '../_shared/cors.ts'
import { ECONOMIC_CATALOG_VERSION, quoteEconomicSku } from '../_shared/economic-catalog.ts'
import {
  VIRTUAL_STAGING_OPENAI_TIMEOUT_MS,
  VIRTUAL_STAGING_OUTPUT_MIME,
} from './contract.ts'
import {
  handleVirtualStagingImageTest,
  type ImageEditRequest,
  type SafeUsage,
} from './runtime.ts'

const STORAGE_BUCKET = 'studio-videos'
const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits'

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function normalizeUsage(value: unknown): SafeUsage | undefined {
  if (!value || typeof value !== 'object') return undefined
  const usage = value as Record<string, unknown>
  const normalized: SafeUsage = {}
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens'] as const) {
    if (Number.isFinite(usage[key]) && Number(usage[key]) >= 0) normalized[key] = Number(usage[key])
  }
  if (usage.input_tokens_details && typeof usage.input_tokens_details === 'object') {
    const source = usage.input_tokens_details as Record<string, unknown>
    const details: NonNullable<SafeUsage['input_tokens_details']> = {}
    for (const key of ['image_tokens', 'text_tokens'] as const) {
      if (Number.isFinite(source[key]) && Number(source[key]) >= 0) details[key] = Number(source[key])
    }
    if (Object.keys(details).length) normalized.input_tokens_details = details
  }
  return Object.keys(normalized).length ? normalized : undefined
}

function inputFilename(contentType: string) {
  if (contentType === 'image/png') return 'input.png'
  if (contentType === 'image/webp') return 'input.webp'
  return 'input.jpg'
}

async function editImageWithOpenAI(input: ImageEditRequest) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('openai_configuration_missing')

  const form = new FormData()
  form.append('model', input.model)
  form.append('image[]', new File([input.bytes], inputFilename(input.inputMimeType), { type: input.inputMimeType }))
  form.append('prompt', input.prompt)
  form.append('n', String(input.count))
  form.append('quality', input.quality)
  form.append('size', input.size)
  form.append('output_format', input.outputFormat)
  form.append('background', input.background)

  const openAIResponse = await fetch(OPENAI_IMAGE_EDIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(VIRTUAL_STAGING_OPENAI_TIMEOUT_MS),
  })

  if (!openAIResponse.ok) {
    const errorData = await openAIResponse.json().catch(() => null) as { error?: { code?: unknown } } | null
    const code = String(errorData?.error?.code || 'unknown').replace(/[^a-z0-9_-]/gi, '').slice(0, 80)
    throw new Error(`openai_http_${openAIResponse.status}_${code}`)
  }

  const data = await openAIResponse.json().catch(() => null) as {
    data?: Array<{ b64_json?: unknown }>
    usage?: unknown
  } | null
  if (data?.data?.length !== 1 || typeof data.data[0]?.b64_json !== 'string') {
    throw new Error('openai_invalid_image_response')
  }

  return {
    bytes: base64ToBytes(data.data[0].b64_json),
    usage: normalizeUsage(data.usage),
  }
}

serve(withCors(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = resolveSupabaseAdminCredential().key
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Configuração indisponível.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  return handleVirtualStagingImageTest(request, {
    authenticate: async (currentRequest) => {
      const token = (currentRequest.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      if (!token) return null
      const { data: { user }, error } = await supabase.auth.getUser(token)
      return error || !user ? null : { id: user.id }
    },
    download: async (inputPath) => {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(inputPath)
      if (error || !data) throw new Error('storage_download_failed')
      return {
        bytes: new Uint8Array(await data.arrayBuffer()),
        contentType: data.type || '',
      }
    },
    openAI: { editImage: editImageWithOpenAI },
    upload: async (outputPath, bytes) => {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(outputPath, bytes, {
        contentType: VIRTUAL_STAGING_OUTPUT_MIME,
        upsert: false,
      })
      if (error) throw new Error('storage_upload_failed')
    },
    now: () => Date.now(),
    prepareEconomy: async ({ userId, clientRequestId, imageCount }) => {
      const sku = quoteEconomicSku('virtual_staging', 'image')
      if (sku.smartTokenCost !== 30) throw new Error('virtual_staging_catalog_mismatch')
      const { data, error } = await supabase.rpc('prepare_virtual_staging_image_request', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_image_count: imageCount, p_catalog_version: ECONOMIC_CATALOG_VERSION,
      })
      if (error) throw new Error(error.message)
      return Array.isArray(data) ? data[0] : data
    },
    claimEconomy: async ({ userId, clientRequestId, itemIndex }) => {
      const { data, error } = await supabase.rpc('claim_virtual_staging_image_item', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
      })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return { item: row?.returned_item ?? {}, claimed: row?.claimed === true }
    },
    finalizeEconomy: async ({ userId, clientRequestId, itemIndex, status, result, usage, outputSize, estimatedCostUsdMicros, failureReason }) => {
      const { error } = await supabase.rpc('finalize_virtual_staging_image_item', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex, p_final_status: status,
        p_result: result ?? {}, p_usage: usage ?? {}, p_output_size: outputSize ?? null,
        p_estimated_cost_usd_micros: estimatedCostUsdMicros ?? null, p_failure_reason: failureReason ?? null,
      })
      if (error) throw new Error(error.message)
    },
    log: (event, details) => console.info('[virtual-staging-image-test]', JSON.stringify({ event, ...details })),
  })
}))

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
import { SMART_SPACE_VIDEO_MIME } from './video-runtime.ts'

const STORAGE_BUCKET = 'studio-videos'
const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits'
const CREATOMATE_RENDER_URL = 'https://api.creatomate.com/v2/renders'

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
    prepareEconomy: async ({ userId, clientRequestId, imageCount, transformationType, decorationStyle }) => {
      const sku = quoteEconomicSku('virtual_staging', 'image')
      if (sku.smartTokenCost !== 30) throw new Error('virtual_staging_catalog_mismatch')
      const { data, error } = await supabase.rpc('prepare_smart_space_request', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_image_count: imageCount,
        p_transformation_type: transformationType, p_decoration_style: decorationStyle,
        p_catalog_version: ECONOMIC_CATALOG_VERSION,
      })
      if (error) throw new Error(error.message)
      return Array.isArray(data) ? data[0] : data
    },
    recoverEconomy: async ({ userId, clientRequestId }) => {
      const requestFields = 'id,client_request_id,status,image_count,completed_count,failed_count,transformation_type,decoration_style,unit_cost'
      let { data: requestRow, error: requestError } = await supabase
        .from('virtual_staging_image_requests')
        .select(requestFields)
        .eq('user_id', userId)
        .or(`client_request_id.eq.${clientRequestId},id.eq.${clientRequestId}`)
        .maybeSingle()
      if (requestError) throw new Error(requestError.message)
      if (!requestRow) {
        const { data: itemIdentity, error: itemIdentityError } = await supabase
          .from('virtual_staging_image_items')
          .select('request_id')
          .eq('id', clientRequestId)
          .maybeSingle()
        if (itemIdentityError) throw new Error(itemIdentityError.message)
        if (itemIdentity?.request_id) {
          const resolved = await supabase
            .from('virtual_staging_image_requests')
            .select(requestFields)
            .eq('id', itemIdentity.request_id)
            .eq('user_id', userId)
            .maybeSingle()
          if (resolved.error) throw new Error(resolved.error.message)
          requestRow = resolved.data
        }
      }
      if (!requestRow) return { request: null, items: [] }
      const { data: items, error: itemsError } = await supabase
        .from('virtual_staging_image_items')
        .select('id,item_index,status,stage_state,result,failure_reason,stage1_usage,provider_usage,video_state,video_renderer,video_render_id,video_output_path,video_failure_reason,video_claim_token')
        .eq('request_id', requestRow.id)
        .order('item_index', { ascending: true })
      if (itemsError) throw new Error(itemsError.message)
      return { request: requestRow, items: items ?? [] }
    },
    claimStage: async ({ userId, clientRequestId, itemIndex, stage }) => {
      const { data, error } = await supabase.rpc('claim_smart_space_stage', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex, p_stage: stage,
      })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return { item: row?.returned_item ?? {}, claimed: row?.claimed === true, claimToken: row?.claim_token ?? null }
    },
    checkpointEconomy: async ({ userId, clientRequestId, itemIndex, claimToken, result, usage, outputSize, estimatedCostUsdMicros }) => {
      const { error } = await supabase.rpc('checkpoint_smart_space_free_space', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
        p_claim_token: claimToken, p_result: result, p_usage: usage ?? {}, p_output_size: outputSize ?? null,
        p_estimated_cost_usd_micros: estimatedCostUsdMicros ?? null,
      })
      if (error) throw new Error(error.message)
    },
    checkpointFinalEconomy: async ({ userId, clientRequestId, itemIndex, claimToken, result, usage, outputSize, estimatedCostUsdMicros }) => {
      const { error } = await supabase.rpc('checkpoint_smart_space_redecoration_output', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
        p_claim_token: claimToken, p_result: result, p_usage: usage ?? {}, p_output_size: outputSize ?? null,
        p_estimated_cost_usd_micros: estimatedCostUsdMicros ?? null,
      })
      if (error) throw new Error(error.message)
    },
    reconcileFinalEconomy: async ({ userId, clientRequestId, itemIndex }) => {
      const { data, error } = await supabase.rpc('reconcile_smart_space_redecoration_output', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
      })
      if (error) throw new Error(error.message)
      return (Array.isArray(data) ? data[0] : data) ?? {}
    },
    finalizeEconomy: async ({ userId, clientRequestId, itemIndex, stage, claimToken, outcome, result, usage, outputSize, estimatedCostUsdMicros, failureReason }) => {
      const { error } = await supabase.rpc('finalize_smart_space_item', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
        p_stage: stage, p_claim_token: claimToken, p_outcome: outcome,
        p_result: result ?? {}, p_usage: usage ?? {}, p_output_size: outputSize ?? null,
        p_estimated_cost_usd_micros: estimatedCostUsdMicros ?? null, p_failure_reason: failureReason ?? null,
      })
      if (error) throw new Error(error.message)
    },
    failBeforeProvider: async ({ userId, clientRequestId, itemIndex, failureReason }) => {
      const { error } = await supabase.rpc('fail_smart_space_item_before_provider', {
        p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex, p_failure_reason: failureReason,
      })
      if (error) throw new Error(error.message)
    },
    video: {
      recoverItem: async ({ userId, clientRequestId, itemIndex }) => {
        const { data, error } = await supabase
          .from('virtual_staging_image_items')
          .select('id,item_index,status,stage_state,result,video_state,video_renderer,video_render_id,video_output_path,video_failure_reason,video_claim_token,virtual_staging_image_requests!inner(user_id,client_request_id)')
          .eq('virtual_staging_image_requests.user_id', userId)
          .eq('virtual_staging_image_requests.client_request_id', clientRequestId)
          .eq('item_index', itemIndex)
          .maybeSingle()
        if (error) throw new Error(error.message)
        return data
      },
      claimVideo: async ({ userId, clientRequestId, itemIndex, idempotencyKey }) => {
        const { data, error } = await supabase.rpc('claim_smart_space_video_render', {
          p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
          p_idempotency_key: idempotencyKey,
        })
        if (error) throw new Error(error.message)
        const row = Array.isArray(data) ? data[0] : data
        return { item: row?.returned_item ?? {}, claimed: row?.claimed === true, claimToken: row?.claim_token ?? null }
      },
      registerVideo: async ({ userId, clientRequestId, itemIndex, claimToken, renderId }) => {
        const { error } = await supabase.rpc('register_smart_space_video_render', {
          p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
          p_claim_token: claimToken, p_render_id: renderId,
        })
        if (error) throw new Error(error.message)
      },
      completeVideo: async ({ userId, clientRequestId, itemIndex, claimToken, outputPath }) => {
        const { error } = await supabase.rpc('complete_smart_space_video_render', {
          p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
          p_claim_token: claimToken, p_output_path: outputPath,
        })
        if (error) throw new Error(error.message)
      },
      failVideo: async ({ userId, clientRequestId, itemIndex, claimToken, reason, retryable }) => {
        const { error } = await supabase.rpc('fail_smart_space_video_render', {
          p_user_id: userId, p_client_request_id: clientRequestId, p_item_index: itemIndex,
          p_claim_token: claimToken, p_reason: reason, p_retryable: retryable,
        })
        if (error) throw new Error(error.message)
      },
      signSources: async (paths) => {
        const urls: string[] = []
        for (const path of paths) {
          const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 15 * 60)
          if (error || !data?.signedUrl) throw new Error('smart_space_video_source_unavailable')
          urls.push(data.signedUrl)
        }
        return urls
      },
      startRender: async (source, metadata) => {
        const apiKey = Deno.env.get('CREATOMATE_API_KEY')
        if (!apiKey) throw new Error('creatomate_configuration_missing')
        const renderResponse = await fetch(CREATOMATE_RENDER_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...source, metadata }),
          signal: AbortSignal.timeout(30_000),
        })
        const body = await renderResponse.json().catch(() => null) as Record<string, unknown> | Record<string, unknown>[] | null
        if (!renderResponse.ok) throw new Error(`creatomate_start_http_${renderResponse.status}`)
        const render = (Array.isArray(body) ? body[0] : body) as Record<string, unknown> | null
        return { id: String(render?.id || ''), status: String(render?.status || 'planned'), url: typeof render?.url === 'string' ? render.url : null }
      },
      getRender: async (renderId) => {
        const apiKey = Deno.env.get('CREATOMATE_API_KEY')
        if (!apiKey) throw new Error('creatomate_configuration_missing')
        const renderResponse = await fetch(`${CREATOMATE_RENDER_URL}/${encodeURIComponent(renderId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
        })
        const render = await renderResponse.json().catch(() => null) as Record<string, unknown> | null
        if (!renderResponse.ok || !render) throw new Error(`creatomate_status_http_${renderResponse.status}`)
        return { id: String(render.id || renderId), status: String(render.status || ''), url: typeof render.url === 'string' ? render.url : null }
      },
      downloadRender: async (url) => {
        if (!/^https:\/\//i.test(url)) throw new Error('creatomate_output_url_invalid')
        const renderResponse = await fetch(url, { signal: AbortSignal.timeout(60_000) })
        if (!renderResponse.ok) throw new Error(`creatomate_output_http_${renderResponse.status}`)
        const contentLength = Number(renderResponse.headers.get('content-length') || 0)
        if (contentLength > 30 * 1024 * 1024) throw new Error('creatomate_output_too_large')
        const bytes = new Uint8Array(await renderResponse.arrayBuffer())
        if (bytes.length > 30 * 1024 * 1024) throw new Error('creatomate_output_too_large')
        return bytes
      },
      uploadVideo: async (path, bytes) => {
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
          contentType: SMART_SPACE_VIDEO_MIME, upsert: true,
        })
        if (error) throw new Error('smart_space_video_storage_upload_failed')
      },
      signVideo: async (path) => {
        const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60)
        if (error || !data?.signedUrl) throw new Error('smart_space_video_sign_failed')
        return data.signedUrl
      },
      log: (event, details) => console.info('[virtual-staging-image-test:video]', JSON.stringify({ event, ...details })),
    },
    log: (event, details) => console.info('[virtual-staging-image-test]', JSON.stringify({ event, ...details })),
  })
}))

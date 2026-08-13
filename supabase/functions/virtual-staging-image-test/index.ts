import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, withCors } from '../_shared/cors.ts'
import { createSupabaseCreationStore } from '../_shared/creations.ts'
import {
  VIRTUAL_STAGING_OPENAI_TIMEOUT_MS,
  VIRTUAL_STAGING_OUTPUT_MIME,
} from './contract.ts'
import {
  handleVirtualStagingImageTest,
  type ImageEditRequest,
  type SafeUsage,
} from './runtime.ts'
import {
  createSupabaseVirtualStagingSessionOutputStore,
  finalizeVirtualStagingSession,
  recordVirtualStagingSessionOutput,
} from './creation-runtime.ts'

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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Configuração indisponível.' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const creationStore = createSupabaseCreationStore(supabase)
  const sessionOutputStore = createSupabaseVirtualStagingSessionOutputStore(supabase)
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
    recordSessionOutput: async input => {
      await recordVirtualStagingSessionOutput(sessionOutputStore, input)
    },
    finalizeSession: async input => {
      const registration = await finalizeVirtualStagingSession(creationStore, sessionOutputStore, input)
      return {
        id: registration.creation.id,
        deliveryKind: input.expectedCount === 1 ? 'file' : 'bundle',
        fileCount: input.expectedCount,
        created: registration.created,
      }
    },
    createJobId: () => crypto.randomUUID(),
    now: () => Date.now(),
    log: (event, details) => console.info('[virtual-staging-image-test]', JSON.stringify({ event, ...details })),
  })
}))

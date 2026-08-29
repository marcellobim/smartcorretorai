import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'
import { requireAdminAal2, requireAuthorizedAdmin } from '../_shared/admin-authorization.ts'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import {
  buildListingXrayImageRequest, buildListingXrayUrlRequest, LISTING_XRAY_OPENAI_TIMEOUT_MS, normalizeListingXrayUsage,
} from './contract.ts'
import { handleListingXray } from './runtime.ts'
import { secureFetchListingHtml } from './secure-fetch.ts'
import { createListingXrayStore } from './store.ts'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'

function outputText(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const output = (value as { output?: unknown }).output
  if (!Array.isArray(output)) return null
  for (const item of output) {
    const content = item && typeof item === 'object' ? (item as { content?: unknown }).content : null
    if (!Array.isArray(content)) continue
    for (const part of content) if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'output_text' && typeof (part as { text?: unknown }).text === 'string') return (part as { text: string }).text
  }
  return null
}

serve(withCors(async request => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const openAIKey = Deno.env.get('OPENAI_API_KEY')
  let serviceRoleKey = ''
  try { serviceRoleKey = resolveSupabaseAdminCredential().key } catch { /* handled below */ }
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAIKey) return new Response(JSON.stringify({ ok: false, error: 'Configuração indisponível.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const store = createListingXrayStore(serviceClient)
  return handleListingXray(request, {
    authenticate: async token => {
      const { data: { user }, error } = await authClient.auth.getUser(token)
      return error || !user ? null : { id: user.id }
    },
    authorizeAcquireOnly: async ({ userId, token }) => {
      await requireAuthorizedAdmin(serviceClient as unknown as Parameters<typeof requireAuthorizedAdmin>[0], userId)
      await requireAdminAal2(serviceClient as unknown as Parameters<typeof requireAdminAal2>[0], token)
      return true
    },
    ...store,
    fetchHtml: url => secureFetchListingHtml(url),
    generate: async input => {
      const requestBody = input.inputKind === 'url' && input.listing
        ? buildListingXrayUrlRequest(input.listing)
        : buildListingXrayImageRequest(input.images, input.contentTypeHint)
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(LISTING_XRAY_OPENAI_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`openai_http_${response.status}`)
      const payload = await response.json().catch(() => null) as { usage?: unknown } | null
      const content = outputText(payload)
      if (!content) throw new Error('openai_output_missing')
      const usage = normalizeListingXrayUsage(payload?.usage || {})
      let output: unknown = null
      try { output = JSON.parse(content) } catch { /* runtime classifies the invalid result and preserves usage */ }
      return { output, usage, model: requestBody.model }
    },
    log: (event, details) => console.info('[raio-x-anuncio]', JSON.stringify({ event, ...details })),
  })
}))

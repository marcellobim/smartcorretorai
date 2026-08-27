import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { withCors } from '../_shared/cors.ts'
import { generateStrategicHashtags } from '../_shared/strategic-hashtags.ts'
import {
  buildTextCampaignHashtagContext,
  buildTextCampaignOpenAIRequest,
  TEXT_CAMPAIGN_MODEL,
  TEXT_CAMPAIGN_TIMEOUT_MS,
  type SafeUsage,
  validateTextCampaignResult,
} from './contract.ts'
import { handleGenerateTextCampaign } from './runtime.ts'
import { createTextCampaignEconomy } from './economy.ts'
import { createTextCampaignDeliveryStore } from './delivery.ts'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'

function normalizeUsage(value: unknown): SafeUsage | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const usage: SafeUsage = {}
  const mapping = { input_tokens: raw.prompt_tokens ?? raw.input_tokens, output_tokens: raw.completion_tokens ?? raw.output_tokens, total_tokens: raw.total_tokens }
  for (const [key, amount] of Object.entries(mapping) as Array<[keyof SafeUsage, unknown]>) {
    const normalized = Number(amount)
    if (Number.isFinite(normalized) && normalized >= 0) usage[key] = normalized
  }
  return Object.keys(usage).length ? usage : undefined
}

serve(withCors(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = resolveSupabaseAdminCredential().key
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAIApiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Configuração indisponível.' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const economy = createTextCampaignEconomy(serviceClient)
  const delivery = createTextCampaignDeliveryStore(serviceClient)
  return handleGenerateTextCampaign(request, {
    authenticate: async (token) => {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      return error || !user ? null : { id: user.id }
    },
    generate: async (briefing) => {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAIApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTextCampaignOpenAIRequest(briefing)),
        signal: AbortSignal.timeout(TEXT_CAMPAIGN_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error('openai_request_failed')
      const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }>; usage?: unknown } | null
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string') throw new Error('openai_response_missing')
      const parsed = JSON.parse(content)
      return { campaign: validateTextCampaignResult(parsed), usage: normalizeUsage(data?.usage) }
    },
    generateHashtags: async (briefing) => generateStrategicHashtags({
      apiKey: openAIApiKey,
      context: buildTextCampaignHashtagContext(briefing),
      variationKey: crypto.randomUUID(),
      model: TEXT_CAMPAIGN_MODEL,
    }),
    ...economy,
    ...delivery,
    log: (event, details) => console.info('[generate-text-campaign]', JSON.stringify({ event, ...details })),
  })
}))

import { buildOfficialHashtags, normalizeOfficialHashtags } from '../_shared/official-hashtags.ts'
import { jsonResponse } from '../_shared/cors.ts'
import {
  applyFinalTextCampaignRules,
  buildTextCampaignHashtagContext,
  TEXT_CAMPAIGN_MODEL,
  TextCampaignValidationError,
  type SafeUsage,
  type TextCampaignBriefing,
  type TextCampaignResult,
  validateTextCampaignRequest,
} from './contract.ts'
import type { RegisterCompletedCreationInput } from '../_shared/creations.ts'

type AuthUser = { id: string }
type GeneratedCampaign = { campaign: TextCampaignResult; usage?: SafeUsage }

export type TextCampaignRuntimeDependencies = {
  authenticate: (token: string) => Promise<AuthUser | null>
  generate: (briefing: TextCampaignBriefing) => Promise<GeneratedCampaign>
  generateHashtags: (briefing: TextCampaignBriefing) => Promise<string[]>
  registerCreation: (input: RegisterCompletedCreationInput) => Promise<void>
  log?: (event: string, details: Record<string, unknown>) => void
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '').trim() : ''
}

const safeUsage = (usage: SafeUsage | undefined) => {
  if (!usage) return undefined
  const normalized: SafeUsage = {}
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens'] as const) {
    const value = Number(usage[key])
    if (Number.isFinite(value) && value >= 0) normalized[key] = value
  }
  return Object.keys(normalized).length ? normalized : undefined
}

const sanitizeFilePart = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80)

export function buildTextCampaignCreationTitle(briefing: TextCampaignBriefing) {
  const location = briefing.district || briefing.city
  return location ? `${briefing.property_type} em ${location}` : briefing.property_type
}

async function buildTextCampaignSourceRef(userId: string, campaign: TextCampaignResult) {
  const serialized = JSON.stringify({ user_id: userId, campaign })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `text-campaign:${hash}`
}

export async function handleGenerateTextCampaign(request: Request, dependencies: TextCampaignRuntimeDependencies) {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)

  const token = bearerToken(request)
  if (!token) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return jsonResponse({ ok: false, error: 'Sua sessão expirou.' }, 401)

  let briefing: TextCampaignBriefing
  try {
    briefing = validateTextCampaignRequest(await request.json())
  } catch (error) {
    if (error instanceof TextCampaignValidationError || error instanceof SyntaxError) {
      return jsonResponse({ ok: false, error: 'Revise os dados do imóvel antes de continuar.' }, 400)
    }
    return jsonResponse({ ok: false, error: 'Não foi possível validar sua solicitação.' }, 400)
  }

  try {
    const generated = await dependencies.generate(briefing)
    const hashtagContext = buildTextCampaignHashtagContext(briefing)
    let hashtags: string[]
    try {
      hashtags = normalizeOfficialHashtags(await dependencies.generateHashtags(briefing), hashtagContext)
    } catch {
      hashtags = buildOfficialHashtags(hashtagContext)
      dependencies.log?.('hashtags_fallback', { model: TEXT_CAMPAIGN_MODEL })
    }
    const campaign = applyFinalTextCampaignRules(generated.campaign, briefing, hashtags)
    const title = buildTextCampaignCreationTitle(briefing)
    try {
      await dependencies.registerCreation({
        user_id: user.id,
        product_key: 'campanha_textos',
        source_ref: await buildTextCampaignSourceRef(user.id, campaign),
        title,
        delivery_kind: 'text',
        result_manifest: {
          version: 1,
          content: { campaign },
          download_name: `campanha-de-textos-${sanitizeFilePart(title) || 'imovel'}.txt`,
        },
        completed_at: new Date(),
      })
      dependencies.log?.('creation_registered', { product: 'campanha_textos' })
    } catch {
      dependencies.log?.('creation_registration_failed', { product: 'campanha_textos' })
    }
    dependencies.log?.('generation_completed', { model: TEXT_CAMPAIGN_MODEL, usage: safeUsage(generated.usage) })
    return jsonResponse({ ok: true, campaign })
  } catch {
    dependencies.log?.('generation_failed', { model: TEXT_CAMPAIGN_MODEL })
    return jsonResponse({ ok: false, error: 'Não foi possível criar a campanha agora. Tente novamente.' }, 502)
  }
}

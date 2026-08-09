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

type AuthUser = { id: string }
type GeneratedCampaign = { campaign: TextCampaignResult; usage?: SafeUsage }

export type TextCampaignRuntimeDependencies = {
  authenticate: (token: string) => Promise<AuthUser | null>
  generate: (briefing: TextCampaignBriefing) => Promise<GeneratedCampaign>
  generateHashtags: (briefing: TextCampaignBriefing) => Promise<string[]>
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
    dependencies.log?.('generation_completed', { model: TEXT_CAMPAIGN_MODEL, usage: safeUsage(generated.usage) })
    return jsonResponse({ ok: true, campaign })
  } catch {
    dependencies.log?.('generation_failed', { model: TEXT_CAMPAIGN_MODEL })
    return jsonResponse({ ok: false, error: 'Não foi possível criar a campanha agora. Tente novamente.' }, 502)
  }
}

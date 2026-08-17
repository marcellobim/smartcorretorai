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
  validateTextCampaignResult,
} from './contract.ts'
import type { DeliveryClaim } from './delivery.ts'
type AuthUser = { id: string }
type GeneratedCampaign = { campaign: TextCampaignResult; usage?: SafeUsage }
type EconomicQuote = {
  productCode: string
  variant: string
  smartTokenCost: number
  providerCategory: string
  catalogVersion: string
}
type EconomicReservation = { id: string; status: 'reserved' | 'consumed' | 'cancelled'; amount: number }
type EconomicEventStatus = 'started' | 'delivered' | 'failed' | 'refunded'

export type TextCampaignRuntimeDependencies = {
  authenticate: (token: string) => Promise<AuthUser | null>
  generate: (briefing: TextCampaignBriefing) => Promise<GeneratedCampaign>
  generateHashtags: (briefing: TextCampaignBriefing) => Promise<string[]>
  quote: () => EconomicQuote
  getAvailableBalance: (userId: string) => Promise<number>
  reserve: (input: { userId: string; amount: number; idempotencyKey: string; quote: EconomicQuote }) => Promise<EconomicReservation>
  cleanupDeliveries?: () => Promise<void>
  claimDelivery: (input: { userId: string; clientRequestId: string; smartTokenCost: number; catalogVersion: string }) => Promise<DeliveryClaim>
  attachReservation: (input: { userId: string; clientRequestId: string; claimToken: string; reservationId: string }) => Promise<DeliveryClaim>
  completeDelivery: (input: { userId: string; clientRequestId: string; claimToken: string; result: TextCampaignResult; usage?: SafeUsage }) => Promise<DeliveryClaim>
  failDelivery: (input: { userId: string; clientRequestId: string; claimToken: string; reason: string }) => Promise<DeliveryClaim>
  recordEvent?: (input: { userId: string; reservationId: string; idempotencyKey: string; quote: EconomicQuote; status: EconomicEventStatus; usage?: SafeUsage }) => Promise<void>
  log?: (event: string, details: Record<string, unknown>) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const parseRequest = (value: unknown) => {
  if (!isRecord(value) || Object.keys(value).some(key => !['briefing', 'client_request_id'].includes(key))) {
    throw new TextCampaignValidationError('invalid_payload')
  }
  const clientRequestId = typeof value.client_request_id === 'string' ? value.client_request_id.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clientRequestId)) {
    throw new TextCampaignValidationError('invalid_client_request_id')
  }
  return {
    briefing: validateTextCampaignRequest({ briefing: value.briefing }),
    clientRequestId,
  }
}

const economicResponse = (requiredTokens: number, availableTokens: number) => jsonResponse({
  ok: false,
  error: 'Smart Tokens insuficientes para criar esta campanha.',
  code: 'INSUFFICIENT_SMART_TOKENS',
  required_tokens: requiredTokens,
  available_tokens: Math.max(0, availableTokens),
}, 402)

const safeEvent = async (
  dependencies: TextCampaignRuntimeDependencies,
  input: Parameters<NonNullable<TextCampaignRuntimeDependencies['recordEvent']>>[0],
) => {
  try {
    await dependencies.recordEvent?.(input)
  } catch {
    dependencies.log?.('economic_telemetry_failed', { product_code: input.quote.productCode, status: input.status })
  }
}

const completedResponse = (claim: DeliveryClaim) => {
  if (!claim.result) return jsonResponse({ ok: false, error: 'Resultado concluído indisponível.' }, 500)
  try {
    return jsonResponse({ ok: true, campaign: validateTextCampaignResult(claim.result) })
  } catch {
    return jsonResponse({ ok: false, error: 'Resultado concluído inválido.' }, 500)
  }
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
  let clientRequestId = ''
  try {
    const parsed = parseRequest(await request.json())
    briefing = parsed.briefing
    clientRequestId = parsed.clientRequestId
  } catch (error) {
    if (error instanceof TextCampaignValidationError || error instanceof SyntaxError) {
      return jsonResponse({ ok: false, error: 'Revise os dados do imóvel antes de continuar.' }, 400)
    }
    return jsonResponse({ ok: false, error: 'Não foi possível validar sua solicitação.' }, 400)
  }

  let quote: EconomicQuote
  try {
    quote = dependencies.quote()
  } catch {
    return jsonResponse({ ok: false, error: 'Catálogo econômico indisponível para este produto.' }, 503)
  }
  const idempotencyKey = `${quote.productCode}:${quote.variant}:${user.id}:${clientRequestId}`
  await dependencies.cleanupDeliveries?.().catch(() => {
    dependencies.log?.('delivery_cleanup_failed', { product_code: quote.productCode })
  })

  let claim: DeliveryClaim
  try {
    claim = await dependencies.claimDelivery({
      userId: user.id,
      clientRequestId,
      smartTokenCost: quote.smartTokenCost,
      catalogVersion: quote.catalogVersion,
    })
  } catch {
    return jsonResponse({ ok: false, error: 'Não foi possível iniciar esta solicitação agora. Tente novamente.' }, 503)
  }
  if (claim.smartTokenCost !== quote.smartTokenCost) {
    return jsonResponse({ ok: false, error: 'A solicitação existente não corresponde ao catálogo atual.', code: 'REQUEST_CATALOG_MISMATCH' }, 409)
  }
  if (claim.status === 'completed') return completedResponse(claim)
  if (claim.status === 'processing' && !claim.claimed) {
    return jsonResponse({ ok: false, error: 'Esta campanha ainda está sendo processada.', code: 'REQUEST_PROCESSING', retry_after_seconds: 2 }, 202)
  }
  if (claim.status === 'failed') {
    return jsonResponse({ ok: false, error: 'Esta tentativa falhou. Inicie uma nova tentativa.', code: 'REQUEST_FAILED' }, 409)
  }
  if (claim.status === 'expired' || !claim.claimToken) {
    return jsonResponse({ ok: false, error: 'Esta solicitação expirou. Inicie uma nova tentativa.', code: 'REQUEST_EXPIRED' }, 409)
  }

  const failClaim = async (reason: string) => dependencies.failDelivery({
    userId: user.id,
    clientRequestId,
    claimToken: claim.claimToken as string,
    reason,
  }).catch(() => null)

  let availableTokens: number
  try {
    availableTokens = await dependencies.getAvailableBalance(user.id)
  } catch {
    await failClaim('text_campaign_balance_failed')
    return jsonResponse({ ok: false, error: 'Não foi possível consultar seu saldo agora. Tente novamente.' }, 503)
  }
  if (availableTokens < quote.smartTokenCost) {
    await failClaim('text_campaign_insufficient_tokens')
    return economicResponse(quote.smartTokenCost, availableTokens)
  }

  let reservation: EconomicReservation
  try {
    reservation = await dependencies.reserve({ userId: user.id, amount: quote.smartTokenCost, idempotencyKey, quote })
  } catch {
    const currentBalance = await dependencies.getAvailableBalance(user.id).catch(() => null)
    await failClaim('text_campaign_reservation_failed')
    if (currentBalance !== null && currentBalance < quote.smartTokenCost) {
      return economicResponse(quote.smartTokenCost, currentBalance)
    }
    return jsonResponse({ ok: false, error: 'Não foi possível reservar Smart Tokens agora. Tente novamente.' }, 503)
  }
  if (reservation.status === 'consumed') {
    await failClaim('text_campaign_reservation_already_consumed')
    return jsonResponse({ ok: false, error: 'Esta solicitação já foi concluída.', code: 'REQUEST_ALREADY_COMPLETED' }, 409)
  }
  if (reservation.status === 'cancelled') {
    await failClaim('text_campaign_reservation_already_cancelled')
    return jsonResponse({ ok: false, error: 'Esta tentativa foi encerrada. Inicie uma nova tentativa.', code: 'REQUEST_ALREADY_CANCELLED' }, 409)
  }
  if (reservation.amount !== quote.smartTokenCost) {
    await failClaim('text_campaign_reservation_catalog_mismatch')
    return jsonResponse({ ok: false, error: 'A reserva existente não corresponde ao catálogo atual.', code: 'RESERVATION_CATALOG_MISMATCH' }, 409)
  }

  try {
    claim = await dependencies.attachReservation({
      userId: user.id,
      clientRequestId,
      claimToken: claim.claimToken,
      reservationId: reservation.id,
    })
  } catch {
    await failClaim('text_campaign_reservation_attach_failed')
    return jsonResponse({ ok: false, error: 'Não foi possível confirmar a reserva agora. Tente novamente.' }, 503)
  }

  const event = { userId: user.id, reservationId: reservation.id, idempotencyKey, quote }
  await safeEvent(dependencies, { ...event, status: 'started' })

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
    const completed = await dependencies.completeDelivery({
      userId: user.id,
      clientRequestId,
      claimToken: claim.claimToken as string,
      result: campaign,
      usage: safeUsage(generated.usage),
    })
    await safeEvent(dependencies, { ...event, status: 'delivered', usage: safeUsage(generated.usage) })
    dependencies.log?.('generation_completed', { model: TEXT_CAMPAIGN_MODEL, usage: safeUsage(generated.usage) })
    return completedResponse(completed)
  } catch {
    const failed = await failClaim('text_campaign_generation_failed')
    if (failed?.status === 'completed') return completedResponse(failed)
    if (!failed) {
      dependencies.log?.('reservation_cancel_failed', { product_code: quote.productCode })
    }
    await safeEvent(dependencies, { ...event, status: failed?.status === 'failed' ? 'refunded' : 'failed' })
    dependencies.log?.('generation_failed', { model: TEXT_CAMPAIGN_MODEL })
    return jsonResponse({ ok: false, error: 'Não foi possível criar a campanha agora. Tente novamente.' }, 502)
  }
}

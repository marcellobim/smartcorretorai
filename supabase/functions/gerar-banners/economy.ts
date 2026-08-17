import { quoteEconomicSku, type EconomicSku } from '../_shared/economic-catalog.ts'

export const QUICK_BANNERS_PRODUCT_CODE = 'quick_banners'
export const QUICK_BANNERS_UNIT_VARIANT = 'item'
export const QUICK_BANNERS_MIN_ITEMS = 1
export const QUICK_BANNERS_MAX_ITEMS = 5

export type QuickBannerTerminalStatus = 'completed' | 'failed'

export function calculateQuickBannerSettlement(statuses: readonly QuickBannerTerminalStatus[]) {
  const completedCount = statuses.filter(status => status === 'completed').length
  const failedCount = statuses.length - completedCount
  return Object.freeze({
    completedCount,
    failedCount,
    reservedTokens: statuses.length * 45,
    consumedTokens: completedCount * 45,
    refundedTokens: failedCount * 45,
  })
}

export function allocateQuickBannerItemsFefo(
  lots: readonly Readonly<{ lotId: string; available: number }>[] ,
  itemCount: number,
) {
  const remaining = lots.map(lot => ({ ...lot }))
  const slices: Array<Readonly<{ itemIndex: number; lotId: string; amount: number }>> = []
  for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
    let needed = 45
    for (const lot of remaining) {
      if (needed === 0) break
      const amount = Math.min(needed, lot.available)
      if (amount > 0) slices.push(Object.freeze({ itemIndex, lotId: lot.lotId, amount }))
      lot.available -= amount
      needed -= amount
    }
    if (needed !== 0) throw new QuickBannerEconomyValidationError('INSUFFICIENT_SMART_TOKENS')
  }
  return Object.freeze(slices)
}

export type QuickBannerMediaClass = 'static' | 'video'

export type QuickBannerQuotedItem = Readonly<{
  pieceId: string
  templateId: string
  mediaClass: QuickBannerMediaClass
  retryOfItemId: string | null
  unitCost: number
}>

export type QuickBannerQuote = Readonly<{
  sku: EconomicSku
  itemCount: number
  unitCost: number
  totalCost: number
  items: readonly QuickBannerQuotedItem[]
}>

type TemplateEconomicMeta = Readonly<{ templateId: string; mediaClass: QuickBannerMediaClass }>

export class QuickBannerEconomyValidationError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'QuickBannerEconomyValidationError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeClientRequestId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!UUID_PATTERN.test(normalized)) throw new QuickBannerEconomyValidationError('INVALID_CLIENT_REQUEST_ID')
  return normalized
}

export function quoteQuickBannerItems(
  rawItems: unknown,
  templates: ReadonlyMap<string, TemplateEconomicMeta>,
): QuickBannerQuote {
  if (!Array.isArray(rawItems)) throw new QuickBannerEconomyValidationError('INVALID_SELECTION')
  if (rawItems.length < QUICK_BANNERS_MIN_ITEMS || rawItems.length > QUICK_BANNERS_MAX_ITEMS) {
    throw new QuickBannerEconomyValidationError('INVALID_ITEM_COUNT')
  }

  const sku = quoteEconomicSku(QUICK_BANNERS_PRODUCT_CODE, QUICK_BANNERS_UNIT_VARIANT)
  const seenPieceIds = new Set<string>()
  const items = rawItems.map((rawItem, index): QuickBannerQuotedItem => {
    const record = rawItem && typeof rawItem === 'object' ? rawItem as Record<string, unknown> : {}
    const templateId = typeof rawItem === 'string'
      ? rawItem.trim()
      : typeof record.template_id === 'string'
        ? record.template_id.trim()
        : typeof record.templateId === 'string'
          ? record.templateId.trim()
          : ''
    const template = templates.get(templateId)
    if (!template) throw new QuickBannerEconomyValidationError('INVALID_TEMPLATE_ID')

    const suppliedPieceId = typeof record.piece_id === 'string'
      ? record.piece_id.trim()
      : typeof record.pieceId === 'string'
        ? record.pieceId.trim()
        : ''
    const pieceId = suppliedPieceId || `template:${templateId}:index:${index}`
    if (!pieceId || pieceId.length > 240 || seenPieceIds.has(pieceId)) {
      throw new QuickBannerEconomyValidationError('INVALID_PIECE_ID')
    }
    seenPieceIds.add(pieceId)

    const retryRaw = typeof record.retry_of_item_id === 'string'
      ? record.retry_of_item_id.trim().toLowerCase()
      : typeof record.retryOfItemId === 'string'
        ? record.retryOfItemId.trim().toLowerCase()
        : ''
    if (retryRaw && !UUID_PATTERN.test(retryRaw)) {
      throw new QuickBannerEconomyValidationError('INVALID_RETRY_ITEM_ID')
    }
    return Object.freeze({
      pieceId,
      templateId,
      mediaClass: template.mediaClass,
      retryOfItemId: retryRaw || null,
      unitCost: sku.smartTokenCost,
    })
  })

  return Object.freeze({
    sku,
    itemCount: items.length,
    unitCost: sku.smartTokenCost,
    totalCost: items.length * sku.smartTokenCost,
    items: Object.freeze(items),
  })
}

const firstRow = (value: unknown) => (
  Array.isArray(value) ? value[0] : value
) as Record<string, unknown> | undefined

export type QuickBannerClaim = Readonly<{
  requestId: string
  status: string
  claimToken: string | null
  reservationId: string | null
  itemCount: number
  quotedTokens: number
  reservedTokens: number
  claimed: boolean
  items: readonly Record<string, unknown>[]
}>

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

const parseClaim = (value: unknown): QuickBannerClaim => {
  const result = firstRow(value)
  if (!result || typeof result.request_id !== 'string' || typeof result.request_status !== 'string') {
    throw new Error('invalid_quick_banner_claim')
  }
  return Object.freeze({
    requestId: result.request_id,
    status: result.request_status,
    claimToken: typeof result.returned_claim_token === 'string' ? result.returned_claim_token : null,
    reservationId: typeof result.returned_reservation_id === 'string' ? result.returned_reservation_id : null,
    itemCount: Number(result.returned_item_count),
    quotedTokens: Number(result.returned_quoted_tokens),
    reservedTokens: Number(result.returned_reserved_tokens),
    claimed: result.claimed === true,
    items: Array.isArray(result.returned_items) ? result.returned_items as Record<string, unknown>[] : [],
  })
}

export function createQuickBannerEconomy(client: RpcClient) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args)
    if (error) {
      const wrapped = new Error(error.message || name) as Error & { code?: string }
      wrapped.code = error.code
      throw wrapped
    }
    return data
  }
  return {
    async claim(input: { userId: string; clientRequestId: string; quote: QuickBannerQuote; adminBypass: boolean }) {
      return parseClaim(await rpc('claim_quick_banner_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_catalog_version: input.quote.sku.catalogVersion,
        p_items: input.quote.items.map(item => ({
          piece_id: item.pieceId,
          template_id: item.templateId,
          media_class: item.mediaClass,
          retry_of_item_id: item.retryOfItemId,
          unit_cost: item.unitCost,
        })),
        p_admin_bypass: input.adminBypass,
      }))
    },
    async getAvailableBalance(userId: string) {
      const result = firstRow(await rpc('get_credit_lot_balance', { p_user_id: userId }))
      const balance = Number(result?.visible_balance ?? 0)
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('invalid_credit_lot_balance')
      return balance
    },
    async reserve(input: { userId: string; quote: QuickBannerQuote; clientRequestId: string; campaignId?: string | null }) {
      const idempotencyKey = `${QUICK_BANNERS_PRODUCT_CODE}:${input.userId}:${input.clientRequestId}`
      const result = firstRow(await rpc('reserve_credits_from_lots', {
        p_user_id: input.userId,
        p_amount: input.quote.totalCost,
        p_idempotency_key: idempotencyKey,
        p_campaign_id: input.campaignId || null,
        p_reason: `${QUICK_BANNERS_PRODUCT_CODE}:batch`,
        p_metadata: {
          product_code: QUICK_BANNERS_PRODUCT_CODE,
          variant: QUICK_BANNERS_UNIT_VARIANT,
          item_count: input.quote.itemCount,
          unit_cost: input.quote.unitCost,
          smart_token_cost: input.quote.totalCost,
          catalog_version: input.quote.sku.catalogVersion,
          client_request_id: input.clientRequestId,
        },
      }))
      if (!result || typeof result.id !== 'string') throw new Error('invalid_quick_banner_reservation')
      return { id: result.id, amount: Number(result.amount), status: String(result.status || '') }
    },
    async attachReservation(input: { userId: string; clientRequestId: string; claimToken: string; reservationId: string }) {
      return firstRow(await rpc('attach_quick_banner_reservation', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_reservation_id: input.reservationId,
      }))
    },
    async beginExecution(input: { userId: string; clientRequestId: string; claimToken: string }) {
      return parseClaim(await rpc('begin_quick_banner_execution', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
      }))
    },
    async failPrepared(input: { userId: string; clientRequestId: string; claimToken: string; reason: string }) {
      return parseClaim(await rpc('fail_quick_banner_prepared_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_reason: input.reason,
      }))
    },
    async markRendering(input: { userId: string; clientRequestId: string; claimToken: string; itemId: string; renderId: string; metadata?: Record<string, unknown> }) {
      return firstRow(await rpc('mark_quick_banner_item_rendering', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_item_id: input.itemId,
        p_render_id: input.renderId,
        p_provider_metadata: input.metadata || {},
      }))
    },
    async finalizeItem(input: { userId: string; itemId: string; status: string; result?: Record<string, unknown> }) {
      return firstRow(await rpc('finalize_quick_banner_item', {
        p_user_id: input.userId,
        p_item_id: input.itemId,
        p_render_status: input.status,
        p_result: input.result || {},
      }))
    },
    async settle(input: { userId: string; clientRequestId: string }) {
      return firstRow(await rpc('settle_quick_banner_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
      }))
    },
  }
}

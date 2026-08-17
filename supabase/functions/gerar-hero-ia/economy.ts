import { quoteEconomicSku, type EconomicSku } from '../_shared/economic-catalog.ts'

export const REAL_ESTATE_BANNER_PRODUCT_CODE = 'real_estate_banner'
export const REAL_ESTATE_BANNER_UNIT_VARIANT = 'item'
export const REAL_ESTATE_BANNER_UNIT_COST = 75
export const REAL_ESTATE_BANNER_MAX_ITEMS = 6
export const REAL_ESTATE_BANNER_MAX_REFERENCES = 4

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FORMAT_IDS = new Set([
  'instagram_feed', 'story_reels', 'whatsapp', 'facebook',
  'google_ads', 'landing_page', 'portal',
])
const FORMAT_GROUPS = new Set(['square_feed', 'vertical', 'landscape'])
const RESOLUTIONS = new Set(['1024x1024', '1024x1536', '1536x1024'])

export class RealEstateBannerEconomyValidationError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'RealEstateBannerEconomyValidationError'
  }
}

export function normalizeBannerClientRequestId(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!UUID_PATTERN.test(normalized)) throw new RealEstateBannerEconomyValidationError('INVALID_CLIENT_REQUEST_ID')
  return normalized
}

export type RealEstateBannerQuotedItem = Readonly<{
  pieceId: string
  formatId: string
  formatGroup: string
  creationOption: number
  resolution: string
  referenceCount: number
  retryOfItemId: string | null
  unitCost: number
}>

export type RealEstateBannerQuote = Readonly<{
  sku: EconomicSku
  selectedFormatCount: number
  creationOptions: number
  itemCount: number
  unitCost: number
  totalCost: number
  items: readonly RealEstateBannerQuotedItem[]
}>

function integer(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) ? parsed : NaN
}

export function quoteRealEstateBannerBatch(input: {
  selectedFormatCount: unknown
  creationOptions: unknown
  items: unknown
}): RealEstateBannerQuote {
  const selectedFormatCount = integer(input.selectedFormatCount)
  const creationOptions = integer(input.creationOptions)
  if (selectedFormatCount < 1 || selectedFormatCount > REAL_ESTATE_BANNER_MAX_ITEMS) {
    throw new RealEstateBannerEconomyValidationError('INVALID_SELECTED_FORMAT_COUNT')
  }
  if (creationOptions < 1 || creationOptions > 3) {
    throw new RealEstateBannerEconomyValidationError('INVALID_CREATION_OPTIONS')
  }
  const itemCount = selectedFormatCount * creationOptions
  if (itemCount < 1 || itemCount > REAL_ESTATE_BANNER_MAX_ITEMS) {
    throw new RealEstateBannerEconomyValidationError('INVALID_TOTAL_GENERATIONS')
  }
  if (!Array.isArray(input.items) || input.items.length !== itemCount) {
    throw new RealEstateBannerEconomyValidationError('INVALID_ITEMS')
  }

  const sku = quoteEconomicSku(REAL_ESTATE_BANNER_PRODUCT_CODE, REAL_ESTATE_BANNER_UNIT_VARIANT)
  if (sku.smartTokenCost !== REAL_ESTATE_BANNER_UNIT_COST) {
    throw new RealEstateBannerEconomyValidationError('INVALID_SERVER_CATALOG_PRICE')
  }
  const seenPieces = new Set<string>()
  const seenCombinations = new Set<string>()
  const formatIds = new Set<string>()
  const rawRetryCount = input.items.filter((raw) => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    return typeof item.retry_of_item_id === 'string' && item.retry_of_item_id.trim() !== ''
  }).length
  const isRetry = rawRetryCount === 1 && itemCount === 1
  if (rawRetryCount > 0 && !isRetry) throw new RealEstateBannerEconomyValidationError('INVALID_RETRY_BATCH')
  const items = input.items.map((raw): RealEstateBannerQuotedItem => {
    const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const pieceId = typeof item.piece_id === 'string' ? item.piece_id.trim() : ''
    const formatId = typeof item.format_id === 'string' ? item.format_id.trim() : ''
    const formatGroup = typeof item.format_group === 'string' ? item.format_group.trim() : ''
    const creationOption = integer(item.creation_option)
    const resolution = typeof item.resolution === 'string' ? item.resolution.trim() : ''
    const referenceCount = integer(item.reference_count)
    const retryOfItemId = typeof item.retry_of_item_id === 'string' ? item.retry_of_item_id.trim().toLowerCase() : ''
    const combination = `${formatId}:${creationOption}`

    if (!pieceId || pieceId.length > 240 || seenPieces.has(pieceId)) {
      throw new RealEstateBannerEconomyValidationError('INVALID_PIECE_ID')
    }
    if (!FORMAT_IDS.has(formatId)) throw new RealEstateBannerEconomyValidationError('INVALID_FORMAT_ID')
    if (!FORMAT_GROUPS.has(formatGroup)) throw new RealEstateBannerEconomyValidationError('INVALID_FORMAT_GROUP')
    if (creationOption < 1 || creationOption > (isRetry ? 3 : creationOptions)) {
      throw new RealEstateBannerEconomyValidationError('INVALID_CREATION_OPTION')
    }
    if (!RESOLUTIONS.has(resolution)) throw new RealEstateBannerEconomyValidationError('INVALID_RESOLUTION')
    if (referenceCount < 0 || referenceCount > REAL_ESTATE_BANNER_MAX_REFERENCES) {
      throw new RealEstateBannerEconomyValidationError('INVALID_REFERENCE_COUNT')
    }
    if (retryOfItemId && !UUID_PATTERN.test(retryOfItemId)) {
      throw new RealEstateBannerEconomyValidationError('INVALID_RETRY_ITEM_ID')
    }
    if (seenCombinations.has(combination)) {
      throw new RealEstateBannerEconomyValidationError('DUPLICATE_FORMAT_OPTION')
    }
    seenPieces.add(pieceId)
    seenCombinations.add(combination)
    formatIds.add(formatId)
    return Object.freeze({
      pieceId, formatId, formatGroup, creationOption, resolution,
      referenceCount, retryOfItemId: retryOfItemId || null, unitCost: sku.smartTokenCost,
    })
  })
  if (formatIds.size !== selectedFormatCount) {
    throw new RealEstateBannerEconomyValidationError('FORMAT_COUNT_MISMATCH')
  }
  if (!isRetry) {
    for (const formatId of formatIds) {
      for (let option = 1; option <= creationOptions; option++) {
        if (!seenCombinations.has(`${formatId}:${option}`)) {
          throw new RealEstateBannerEconomyValidationError('INCOMPLETE_FORMAT_OPTION_MATRIX')
        }
      }
    }
  }
  return Object.freeze({
    sku, selectedFormatCount, creationOptions, itemCount,
    unitCost: sku.smartTokenCost,
    totalCost: itemCount * sku.smartTokenCost,
    items: Object.freeze(items),
  })
}

export function calculateRealEstateBannerSettlement(statuses: readonly ('completed' | 'failed')[]) {
  if (statuses.length < 1 || statuses.length > REAL_ESTATE_BANNER_MAX_ITEMS) {
    throw new RealEstateBannerEconomyValidationError('INVALID_ITEM_COUNT')
  }
  const completedCount = statuses.filter(status => status === 'completed').length
  const failedCount = statuses.length - completedCount
  return Object.freeze({
    completedCount,
    failedCount,
    reservedTokens: statuses.length * REAL_ESTATE_BANNER_UNIT_COST,
    consumedTokens: completedCount * REAL_ESTATE_BANNER_UNIT_COST,
    refundedTokens: failedCount * REAL_ESTATE_BANNER_UNIT_COST,
  })
}

export function allocateRealEstateBannerItemsFefo(
  lots: readonly Readonly<{ lotId: string; available: number }>[],
  itemCount: number,
) {
  const remaining = lots.map(lot => ({ ...lot }))
  const slices: Array<Readonly<{ itemIndex: number; lotId: string; amount: number }>> = []
  for (let itemIndex = 0; itemIndex < itemCount; itemIndex++) {
    let needed = REAL_ESTATE_BANNER_UNIT_COST
    for (const lot of remaining) {
      if (needed === 0) break
      const amount = Math.min(needed, lot.available)
      if (amount > 0) slices.push(Object.freeze({ itemIndex, lotId: lot.lotId, amount }))
      lot.available -= amount
      needed -= amount
    }
    if (needed !== 0) throw new RealEstateBannerEconomyValidationError('INSUFFICIENT_SMART_TOKENS')
  }
  return Object.freeze(slices)
}

const firstRow = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

export type RealEstateBannerClaim = Readonly<{
  requestId: string
  status: string
  claimToken: string
  reservationId: string | null
  itemCount: number
  quotedTokens: number
  reservedTokens: number
  items: readonly Record<string, unknown>[]
}>

const parseClaim = (value: unknown): RealEstateBannerClaim => {
  const row = firstRow(value)
  if (!row || typeof row.request_id !== 'string' || typeof row.request_status !== 'string' || typeof row.returned_claim_token !== 'string') {
    throw new Error('invalid_real_estate_banner_claim')
  }
  return Object.freeze({
    requestId: row.request_id,
    status: row.request_status,
    claimToken: row.returned_claim_token,
    reservationId: typeof row.returned_reservation_id === 'string' ? row.returned_reservation_id : null,
    itemCount: Number(row.returned_item_count),
    quotedTokens: Number(row.returned_quoted_tokens),
    reservedTokens: Number(row.returned_reserved_tokens),
    items: Array.isArray(row.returned_items) ? row.returned_items as Record<string, unknown>[] : [],
  })
}

export function createRealEstateBannerEconomy(client: RpcClient) {
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
    async claim(input: { userId: string; clientRequestId: string; quote: RealEstateBannerQuote }) {
      return parseClaim(await rpc('claim_real_estate_banner_request', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_catalog_version: input.quote.sku.catalogVersion,
        p_selected_format_count: input.quote.selectedFormatCount,
        p_creation_options: input.quote.creationOptions,
        p_items: input.quote.items.map(item => ({
          piece_id: item.pieceId,
          format_id: item.formatId,
          format_group: item.formatGroup,
          creation_option: item.creationOption,
          resolution: item.resolution,
          reference_count: item.referenceCount,
          retry_of_item_id: item.retryOfItemId,
          unit_cost: item.unitCost,
        })),
      }))
    },
    async getAvailableBalance(userId: string) {
      const row = firstRow(await rpc('get_credit_lot_balance', { p_user_id: userId }))
      const balance = Number(row?.visible_balance ?? 0)
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('invalid_credit_lot_balance')
      return balance
    },
    async reserve(input: { userId: string; clientRequestId: string; quote: RealEstateBannerQuote }) {
      const row = firstRow(await rpc('reserve_credits_from_lots', {
        p_user_id: input.userId,
        p_amount: input.quote.totalCost,
        p_idempotency_key: `${REAL_ESTATE_BANNER_PRODUCT_CODE}:${input.userId}:${input.clientRequestId}`,
        p_campaign_id: null,
        p_reason: `${REAL_ESTATE_BANNER_PRODUCT_CODE}:batch`,
        p_metadata: {
          product_code: REAL_ESTATE_BANNER_PRODUCT_CODE,
          variant: REAL_ESTATE_BANNER_UNIT_VARIANT,
          item_count: input.quote.itemCount,
          unit_cost: input.quote.unitCost,
          smart_token_cost: input.quote.totalCost,
          catalog_version: input.quote.sku.catalogVersion,
          client_request_id: input.clientRequestId,
        },
      }))
      if (!row || typeof row.id !== 'string') throw new Error('invalid_real_estate_banner_reservation')
      return { id: row.id, amount: Number(row.amount), status: String(row.status || '') }
    },
    async attachReservation(input: { userId: string; clientRequestId: string; claimToken: string; reservationId: string }) {
      return firstRow(await rpc('attach_real_estate_banner_reservation', {
        p_user_id: input.userId, p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken, p_reservation_id: input.reservationId,
      }))
    },
    async begin(input: { userId: string; clientRequestId: string; claimToken: string }) {
      return parseClaim(await rpc('begin_real_estate_banner_request', {
        p_user_id: input.userId, p_client_request_id: input.clientRequestId, p_claim_token: input.claimToken,
      }))
    },
    async claimItem(input: { userId: string; clientRequestId: string; claimToken: string; itemId: string }) {
      return firstRow(await rpc('claim_real_estate_banner_item', {
        p_user_id: input.userId, p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken, p_item_id: input.itemId,
      }))
    },
    async bindGeneration(input: { userId: string; itemId: string; generationId: string }) {
      return firstRow(await rpc('bind_real_estate_banner_generation', {
        p_user_id: input.userId, p_item_id: input.itemId, p_generation_id: input.generationId,
      }))
    },
    async updateProvider(input: { userId: string; itemId: string; responseId: string; model: string; usage?: Record<string, unknown> }) {
      return firstRow(await rpc('update_real_estate_banner_provider', {
        p_user_id: input.userId, p_item_id: input.itemId, p_response_id: input.responseId,
        p_model: input.model, p_usage: input.usage || {},
      }))
    },
    async finalizeItem(input: { userId: string; itemId: string; status: 'completed' | 'failed'; result?: Record<string, unknown>; usage?: Record<string, unknown> }) {
      return firstRow(await rpc('finalize_real_estate_banner_item', {
        p_user_id: input.userId, p_item_id: input.itemId, p_final_status: input.status,
        p_result: input.result || {}, p_usage: input.usage || {},
      }))
    },
    async settle(input: { userId: string; clientRequestId: string }) {
      return firstRow(await rpc('settle_real_estate_banner_request', {
        p_user_id: input.userId, p_client_request_id: input.clientRequestId,
      }))
    },
    async failPrepared(input: { userId: string; clientRequestId: string; claimToken: string; reason: string }) {
      return parseClaim(await rpc('fail_real_estate_banner_prepared_request', {
        p_user_id: input.userId, p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken, p_reason: input.reason,
      }))
    },
  }
}

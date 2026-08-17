import { quoteEconomicSku } from './economic-catalog.ts'

export const SMART_CAROUSEL_PRODUCT_CODE = 'smart_carousel'
export const SMART_CAROUSEL_MIN_IMAGES = 5
export const SMART_CAROUSEL_MAX_IMAGES = 20

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

type SmartCarouselClaim = Readonly<{
  requestId: string
  status: string
  executionClaimed: boolean
  requiredTokens: number
  availableTokens: number
  reservationId: string
  idempotencyKey: string
}>

export type SmartCarouselRecovery = Readonly<{
  found: boolean
  status: string
  renderId: string
  receipt: string
  campaignPackage: Record<string, unknown>
  videoUrl: string
  providerStartedAt: string
}>

const firstRow = (data: unknown): Record<string, unknown> => {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') throw new Error('smart_carousel_economy_invalid_response')
  return row as Record<string, unknown>
}

export function quoteSmartCarousel(imageCount: number) {
  if (!Number.isInteger(imageCount) || imageCount < SMART_CAROUSEL_MIN_IMAGES || imageCount > SMART_CAROUSEL_MAX_IMAGES) {
    throw new Error('invalid_smart_carousel_image_count')
  }
  const sku = quoteEconomicSku(SMART_CAROUSEL_PRODUCT_CODE, 'standard')
  if (!sku.enabled || sku.smartTokenCost !== 100) throw new Error('smart_carousel_catalog_invalid')
  return sku
}

export async function claimSmartCarouselEconomy(
  client: RpcClient,
  input: { userId: string; clientRequestId: string; imageCount: number; metadata?: Record<string, unknown> },
): Promise<SmartCarouselClaim> {
  const sku = quoteSmartCarousel(input.imageCount)
  const { data, error } = await client.rpc('claim_smart_carousel_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_image_count: input.imageCount,
    p_catalog_version: sku.catalogVersion,
    p_metadata: input.metadata || {},
  })
  if (error) throw new Error(error.message || 'smart_carousel_economy_claim_failed')
  const row = firstRow(data)
  return Object.freeze({
    requestId: String(row.request_id || ''),
    status: String(row.request_status || ''),
    executionClaimed: row.execution_claimed === true,
    requiredTokens: Number(row.required_tokens ?? sku.smartTokenCost),
    availableTokens: Math.max(0, Number(row.available_tokens || 0)),
    reservationId: String(row.reservation_id || ''),
    idempotencyKey: String(row.idempotency_key || ''),
  })
}

export async function recoverSmartCarouselEconomy(
  client: RpcClient,
  input: { userId: string; clientRequestId: string },
): Promise<SmartCarouselRecovery> {
  const { data, error } = await client.rpc('get_smart_carousel_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
  })
  if (error) throw new Error(error.message || 'smart_carousel_economy_recovery_failed')
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return Object.freeze({
    found: false, status: '', renderId: '', receipt: '', campaignPackage: {}, videoUrl: '', providerStartedAt: '',
  })
  const record = row as Record<string, unknown>
  return Object.freeze({
    found: true,
    status: String(record.request_status || ''),
    renderId: String(record.render_id || ''),
    receipt: String(record.receipt || ''),
    campaignPackage: record.campaign_package && typeof record.campaign_package === 'object'
      ? record.campaign_package as Record<string, unknown> : {},
    videoUrl: String(record.video_url || ''),
    providerStartedAt: String(record.provider_started_at || ''),
  })
}

export async function recordSmartCarouselProvider(
  client: RpcClient,
  input: {
    userId: string; clientRequestId: string; renderId: string; receipt: string
    campaignPackage: Record<string, unknown>; telemetry?: Record<string, unknown>
  },
) {
  const { error } = await client.rpc('record_smart_carousel_provider_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_render_id: input.renderId,
    p_receipt: input.receipt,
    p_campaign_package: input.campaignPackage,
    p_telemetry: input.telemetry || {},
  })
  if (error) throw new Error(error.message || 'smart_carousel_provider_persist_failed')
}

export async function settleSmartCarouselEconomy(
  client: RpcClient,
  input: {
    userId: string; clientRequestId: string; status: 'succeeded' | 'failed'
    videoUrl?: string; reason?: string; telemetry?: Record<string, unknown>
  },
) {
  const { error } = await client.rpc('settle_smart_carousel_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_final_status: input.status,
    p_video_url: input.videoUrl || null,
    p_reason: input.reason || null,
    p_telemetry: input.telemetry || {},
  })
  if (error) throw new Error(error.message || 'smart_carousel_economy_settlement_failed')
}

export const insufficientSmartCarouselTokensResponse = (claim: SmartCarouselClaim) => ({
  ok: false,
  code: 'INSUFFICIENT_SMART_TOKENS',
  error: 'Saldo de Smart Tokens insuficiente.',
  required_tokens: claim.requiredTokens,
  available_tokens: claim.availableTokens,
})

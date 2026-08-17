import { quoteEconomicSku } from './economic-catalog.ts'

export const VEO_VIDEO_PRODUCT_CODES = ['real_estate_commercial', 'creative_video'] as const
export type VeoVideoProductCode = typeof VEO_VIDEO_PRODUCT_CODES[number]

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export type VeoVideoEconomyClaim = Readonly<{
  requestId: string
  status: string
  executionClaimed: boolean
  requiredTokens: number
  availableTokens: number
  reservationId: string
  idempotencyKey: string
  adminBypass: boolean
  catalogVersion: string
}>

const firstRow = (data: unknown): Record<string, unknown> => {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') throw new Error('veo_video_economy_invalid_response')
  return row as Record<string, unknown>
}

export function productCodeForVeoMode(mode: unknown): VeoVideoProductCode {
  return String(mode || '').trim() === 'free_ai' ? 'creative_video' : 'real_estate_commercial'
}

export function quoteVeoVideoGeneration(productCode: VeoVideoProductCode) {
  const sku = quoteEconomicSku(productCode, 'standard')
  if (sku.smartTokenCost !== 120 || !sku.enabled) throw new Error('veo_video_economy_catalog_invalid')
  return sku
}

export async function claimVeoVideoEconomy(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    productCode: VeoVideoProductCode
    jobId: string
    adminBypass: boolean
    metadata?: Record<string, unknown>
  },
): Promise<VeoVideoEconomyClaim> {
  const sku = quoteVeoVideoGeneration(input.productCode)
  const { data, error } = await client.rpc('claim_veo_video_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_product_code: sku.productCode,
    p_job_id: input.jobId,
    p_catalog_version: sku.catalogVersion,
    p_admin_bypass: input.adminBypass,
    p_metadata: input.metadata || {},
  })
  if (error) throw new Error(error.message || 'veo_video_economy_claim_failed')
  const row = firstRow(data)
  return Object.freeze({
    requestId: String(row.request_id || ''),
    status: String(row.request_status || ''),
    executionClaimed: row.execution_claimed === true,
    requiredTokens: Number(row.required_tokens ?? sku.smartTokenCost),
    availableTokens: Math.max(0, Number(row.available_tokens || 0)),
    reservationId: String(row.reservation_id || ''),
    idempotencyKey: String(row.idempotency_key || ''),
    adminBypass: row.admin_bypass === true,
    catalogVersion: sku.catalogVersion,
  })
}

export async function updateVeoVideoEconomyTelemetry(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    providerJobId?: string
    model?: string
    telemetry?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await client.rpc('update_veo_video_economy_telemetry', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_provider_job_id: input.providerJobId || null,
    p_model: input.model || null,
    p_telemetry: input.telemetry || {},
  })
  if (error) throw new Error(error.message || 'veo_video_economy_telemetry_failed')
}

export async function settleVeoVideoEconomy(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    status: 'completed' | 'failed'
    result?: Record<string, unknown>
    telemetry?: Record<string, unknown>
    reason?: string
  },
): Promise<boolean> {
  const { data, error } = await client.rpc('settle_veo_video_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_final_status: input.status,
    p_result: input.result || {},
    p_telemetry: input.telemetry || {},
    p_reason: input.reason || null,
  })
  if (error) throw new Error(error.message || 'veo_video_economy_settlement_failed')
  return data === true
}

export const insufficientVeoVideoTokensResponse = (claim: VeoVideoEconomyClaim) => ({
  success: false,
  ok: false,
  code: 'INSUFFICIENT_SMART_TOKENS',
  error: 'Saldo de Smart Tokens insuficiente.',
  required_tokens: claim.requiredTokens,
  available_tokens: claim.availableTokens,
})

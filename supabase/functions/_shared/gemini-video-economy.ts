import { quoteEconomicSku } from './economic-catalog.ts'

export const GEMINI_VIDEO_PRODUCT_CODES = [
  'real_estate_video',
  'short_videos',
  'life_in_property',
  'broker_presentation',
] as const

export type GeminiVideoProductCode = typeof GEMINI_VIDEO_PRODUCT_CODES[number]

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

export type GeminiVideoEconomyClaim = Readonly<{
  requestId: string
  status: string
  executionClaimed: boolean
  requiredTokens: number
  availableTokens: number
  catalogVersion: string
}>

const firstRow = (data: unknown): Record<string, unknown> => {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') throw new Error('gemini_video_economy_invalid_response')
  return row as Record<string, unknown>
}

export function quoteGeminiVideoGeneration(productCode: GeminiVideoProductCode) {
  const sku = quoteEconomicSku(productCode, 'standard')
  if (sku.smartTokenCost !== 325 || !sku.enabled) throw new Error('gemini_video_economy_catalog_invalid')
  return sku
}

export async function claimGeminiVideoEconomy(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    productCode: GeminiVideoProductCode
    metadata?: Record<string, unknown>
  },
): Promise<GeminiVideoEconomyClaim> {
  const sku = quoteGeminiVideoGeneration(input.productCode)
  const { data, error } = await client.rpc('claim_gemini_video_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_product_code: sku.productCode,
    p_catalog_version: sku.catalogVersion,
    p_metadata: input.metadata || {},
  })
  if (error) throw new Error(error.message || 'gemini_video_economy_claim_failed')
  const row = firstRow(data)
  return Object.freeze({
    requestId: String(row.request_id || ''),
    status: String(row.request_status || ''),
    executionClaimed: row.execution_claimed === true,
    requiredTokens: Number(row.required_tokens || sku.smartTokenCost),
    availableTokens: Math.max(0, Number(row.available_tokens || 0)),
    catalogVersion: sku.catalogVersion,
  })
}

export async function updateGeminiVideoEconomyTelemetry(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    providerJobId?: string
    model?: string
    telemetry?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await client.rpc('update_gemini_video_economy_telemetry', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_provider_job_id: input.providerJobId || null,
    p_model: input.model || null,
    p_telemetry: input.telemetry || {},
  })
  if (error) throw new Error(error.message || 'gemini_video_economy_telemetry_failed')
}

export async function settleGeminiVideoEconomy(
  client: RpcClient,
  input: {
    userId: string
    clientRequestId: string
    status: 'completed' | 'failed'
    result?: Record<string, unknown>
    telemetry?: Record<string, unknown>
    reason?: string
  },
): Promise<void> {
  const { error } = await client.rpc('settle_gemini_video_economy_request', {
    p_user_id: input.userId,
    p_client_request_id: input.clientRequestId,
    p_final_status: input.status,
    p_result: input.result || {},
    p_telemetry: input.telemetry || {},
    p_reason: input.reason || null,
  })
  if (error) throw new Error(error.message || 'gemini_video_economy_settlement_failed')
}

export const settleGeminiVideoJobEconomy = (
  client: RpcClient,
  identity: readonly [string, string],
  status: 'completed' | 'failed',
  details: { outputPath?: string; telemetry?: Record<string, unknown>; reason?: string } = {},
) => settleGeminiVideoEconomy(client, {
  userId: identity[0], clientRequestId: identity[1], status,
  result: details.outputPath ? { output_video_path: details.outputPath } : {},
  telemetry: details.telemetry || {}, reason: details.reason,
})

export const recordGeminiVideoJobTelemetry = (
  client: RpcClient,
  identity: readonly [string, string],
  providerInteraction: string,
  telemetry: Record<string, unknown> = {},
) => updateGeminiVideoEconomyTelemetry(client, {
  userId: identity[0], clientRequestId: identity[1], providerJobId: providerInteraction, telemetry,
})

export const insufficientGeminiVideoTokensResponse = (claim: GeminiVideoEconomyClaim) => ({
  ok: false,
  code: 'INSUFFICIENT_SMART_TOKENS',
  error: 'Saldo de Smart Tokens insuficiente.',
  required_tokens: claim.requiredTokens,
  available_tokens: claim.availableTokens,
})

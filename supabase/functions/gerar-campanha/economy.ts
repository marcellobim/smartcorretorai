export type QuickBannerCampaignGateClaim = Readonly<{
  status: string
  executionClaimed: boolean
  result: Record<string, unknown> | null
}>

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const firstRow = (value: unknown) => (
  Array.isArray(value) ? value[0] : value
) as Record<string, unknown> | undefined

export function normalizeQuickBannerCampaignGateIdentity(clientRequestId: unknown, claimToken: unknown) {
  const normalizedRequestId = typeof clientRequestId === 'string' ? clientRequestId.trim().toLowerCase() : ''
  const normalizedClaimToken = typeof claimToken === 'string' ? claimToken.trim().toLowerCase() : ''
  if (!UUID_PATTERN.test(normalizedRequestId)) throw new Error('INVALID_CLIENT_REQUEST_ID')
  if (!UUID_PATTERN.test(normalizedClaimToken)) throw new Error('INVALID_ECONOMIC_CLAIM')
  return Object.freeze({ clientRequestId: normalizedRequestId, claimToken: normalizedClaimToken })
}

const parseClaim = (value: unknown): QuickBannerCampaignGateClaim => {
  const row = firstRow(value)
  if (!row || typeof row.generation_status !== 'string') throw new Error('invalid_quick_banner_campaign_gate')
  const result = row.generation_result && typeof row.generation_result === 'object'
    ? row.generation_result as Record<string, unknown>
    : null
  return Object.freeze({
    status: row.generation_status,
    executionClaimed: row.execution_claimed === true,
    result,
  })
}

export function createQuickBannerCampaignGate(client: RpcClient) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new Error(error.message || name)
    return data
  }
  return {
    async claim(input: { userId: string; clientRequestId: string; claimToken: string }) {
      return parseClaim(await rpc('claim_quick_banner_campaign_generation', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
      }))
    },
    async complete(input: { userId: string; clientRequestId: string; claimToken: string; result: Record<string, unknown> }) {
      return parseClaim(await rpc('complete_quick_banner_campaign_generation', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_result: input.result,
      }))
    },
    async fail(input: { userId: string; clientRequestId: string; claimToken: string; reason: string }) {
      await rpc('fail_quick_banner_prepared_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_reason: input.reason,
      })
    },
  }
}

export async function callProviderOnlyAfterEconomicClaim<T>(
  claim: QuickBannerCampaignGateClaim,
  provider: () => Promise<T>,
) {
  if (!claim.executionClaimed) return null
  return provider()
}

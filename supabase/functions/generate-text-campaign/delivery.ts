import type { SafeUsage, TextCampaignResult } from './contract.ts'

type SupabaseClientLike = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> }
      }
    }
  }
}

export type DeliveryClaim = {
  id: string
  status: 'processing' | 'completed' | 'failed' | 'expired'
  claimed: boolean
  claimToken: string | null
  reservationId: string | null
  result: TextCampaignResult | null
  expiresAt: string
  smartTokenCost: number
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined

const delivery = (value: unknown): DeliveryClaim => {
  const item = first(value)
  if (!item || typeof item.request_id !== 'string' || !['processing', 'completed', 'failed', 'expired'].includes(String(item.request_status))) {
    throw new Error('invalid_text_campaign_delivery')
  }
  return {
    id: item.request_id,
    status: item.request_status as DeliveryClaim['status'],
    claimed: item.claimed === true,
    claimToken: typeof item.returned_claim_token === 'string' ? item.returned_claim_token : null,
    reservationId: typeof item.returned_reservation_id === 'string' ? item.returned_reservation_id : null,
    result: item.returned_result && typeof item.returned_result === 'object' ? item.returned_result as TextCampaignResult : null,
    expiresAt: String(item.returned_expires_at ?? ''),
    smartTokenCost: Number(item.returned_smart_token_cost),
  }
}

const storedDelivery = (value: unknown): DeliveryClaim => {
  const item = first(value)
  if (!item) throw new Error('invalid_text_campaign_delivery')
  return delivery({
    request_id: item.id,
    request_status: item.status,
    returned_claim_token: item.claim_token,
    returned_reservation_id: item.reservation_id,
    returned_result: item.result,
    returned_expires_at: item.expires_at,
    returned_smart_token_cost: item.smart_token_cost,
    claimed: false,
  })
}

export function createTextCampaignDeliveryStore(client: SupabaseClientLike) {
  return {
    async recoverDelivery(input: { userId: string; clientRequestId: string }) {
      const { data, error } = await client
        .from('text_campaign_delivery_requests')
        .select('id,status,reservation_id,result,expires_at,smart_token_cost')
        .eq('user_id', input.userId)
        .eq('client_request_id', input.clientRequestId)
        .maybeSingle()
      if (error) throw new Error('text_campaign_delivery_recovery_failed')
      return data ? storedDelivery(data) : null
    },
    async cleanupDeliveries() {
      const { error } = await client.rpc('cleanup_text_campaign_deliveries')
      if (error) throw new Error('text_campaign_delivery_cleanup_failed')
    },
    async claimDelivery(input: { userId: string; clientRequestId: string; smartTokenCost: number; catalogVersion: string }) {
      const { data, error } = await client.rpc('claim_text_campaign_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_smart_token_cost: input.smartTokenCost,
        p_catalog_version: input.catalogVersion,
      })
      if (error) throw new Error('text_campaign_delivery_claim_failed')
      return delivery(data)
    },
    async attachReservation(input: { userId: string; clientRequestId: string; claimToken: string; reservationId: string }) {
      const { data, error } = await client.rpc('attach_text_campaign_reservation', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_reservation_id: input.reservationId,
      })
      if (error) throw new Error('text_campaign_reservation_attach_failed')
      return storedDelivery(data)
    },
    async completeDelivery(input: { userId: string; clientRequestId: string; claimToken: string; result: TextCampaignResult; usage?: SafeUsage }) {
      const { data, error } = await client.rpc('complete_text_campaign_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_result: input.result,
        p_usage: input.usage ?? {},
      })
      if (error) throw new Error('text_campaign_delivery_complete_failed')
      return storedDelivery(data)
    },
    async failDelivery(input: { userId: string; clientRequestId: string; claimToken: string; reason: string }) {
      const { data, error } = await client.rpc('fail_text_campaign_delivery', {
        p_user_id: input.userId,
        p_client_request_id: input.clientRequestId,
        p_claim_token: input.claimToken,
        p_reason: input.reason,
      })
      if (error) throw new Error('text_campaign_delivery_fail_failed')
      return storedDelivery(data)
    },
  }
}

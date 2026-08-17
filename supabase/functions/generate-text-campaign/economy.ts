import { quoteEconomicSku, type EconomicSku } from '../_shared/economic-catalog.ts'
import type { SafeUsage } from './contract.ts'

type SupabaseClientLike = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
  from(table: string): { upsert(value: Record<string, unknown>, options: Record<string, unknown>): PromiseLike<{ error: unknown }> }
}

type Reservation = { id: string; status: 'reserved' | 'consumed' | 'cancelled'; amount: number }

const row = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined
const reservation = (value: unknown): Reservation => {
  const result = row(value)
  if (!result || typeof result.id !== 'string' || !['reserved', 'consumed', 'cancelled'].includes(String(result.status))) {
    throw new Error('invalid_economic_reservation')
  }
  return { id: result.id, status: result.status as Reservation['status'], amount: Number(result.amount) }
}

export const getTextCampaignQuote = () => quoteEconomicSku('text_campaign', 'standard')

export function createTextCampaignEconomy(client: SupabaseClientLike) {
  return {
    quote: getTextCampaignQuote,
    async getAvailableBalance(userId: string) {
      const { data, error } = await client.rpc('get_credit_lot_balance', { p_user_id: userId })
      if (error) throw new Error('credit_lot_balance_failed')
      const balance = Number(row(data)?.visible_balance ?? 0)
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('invalid_credit_lot_balance')
      return balance
    },
    async reserve(input: { userId: string; amount: number; idempotencyKey: string; quote: EconomicSku }) {
      const { data, error } = await client.rpc('reserve_credits_from_lots', {
        p_user_id: input.userId,
        p_amount: input.amount,
        p_idempotency_key: input.idempotencyKey,
        p_campaign_id: null,
        p_reason: `${input.quote.productCode}:${input.quote.variant}`,
        p_metadata: { product_code: input.quote.productCode, variant: input.quote.variant, smart_token_cost: input.quote.smartTokenCost, catalog_version: input.quote.catalogVersion },
      })
      if (error) throw new Error('reserve_credits_from_lots_failed')
      return reservation(data)
    },
    async recordEvent(input: { userId: string; reservationId: string; idempotencyKey: string; quote: EconomicSku; status: string; usage?: SafeUsage }) {
      const { error } = await client.from('economic_generation_events').upsert({
        user_id: input.userId,
        reservation_id: input.reservationId,
        product_code: input.quote.productCode,
        variant: input.quote.variant,
        provider: 'openai',
        model: 'gpt-4.1',
        usage: input.usage ?? {},
        catalog_version: input.quote.catalogVersion,
        status: input.status,
        idempotency_key: input.idempotencyKey,
        metadata: { smart_token_cost: input.quote.smartTokenCost, idempotency_reference: input.idempotencyKey },
      }, { onConflict: 'idempotency_key' })
      if (error) throw new Error('economic_generation_event_failed')
    },
  }
}

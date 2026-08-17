import test from 'node:test'
import assert from 'node:assert/strict'
import { createTextCampaignEconomy, getTextCampaignQuote } from './economy.ts'

test('resolves the canonical backend-only 25 Smart Token quote', () => {
  const quote = getTextCampaignQuote()
  assert.equal(quote.productCode, 'text_campaign')
  assert.equal(quote.variant, 'standard')
  assert.equal(quote.smartTokenCost, 25)
  assert.equal(quote.enabled, true)
})

test('maps the lot RPC contract without accepting a frontend amount', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      if (name === 'get_credit_lot_balance') return { data: [{ visible_balance: 500 }], error: null }
      return { data: [{ id: 'reservation-id', status: name.startsWith('consume') ? 'consumed' : name.startsWith('cancel') ? 'cancelled' : 'reserved', amount: 25 }], error: null }
    },
    from() { return { upsert: async () => ({ error: null }) } },
  }
  const economy = createTextCampaignEconomy(client)
  const quote = economy.quote()
  assert.equal(await economy.getAvailableBalance('user-a'), 500)
  await economy.reserve({ userId: 'user-a', amount: quote.smartTokenCost, idempotencyKey: 'request-a', quote })

  assert.deepEqual(calls.map(call => call.name), [
    'get_credit_lot_balance',
    'reserve_credits_from_lots',
  ])
  assert.equal(calls[1].args.p_amount, 25)
  assert.equal(calls[1].args.p_user_id, 'user-a')
  assert.equal(calls[1].args.p_idempotency_key, 'request-a')
  assert.equal((calls[1].args.p_metadata as Record<string, unknown>).smart_token_cost, 25)
})

test('prepares private economic telemetry without provider cost or secrets', async () => {
  let table = ''
  let event: Record<string, unknown> = {}
  const client = {
    async rpc() { return { data: [], error: null } },
    from(name: string) {
      table = name
      return { upsert: async (value: Record<string, unknown>) => { event = value; return { error: null } } }
    },
  }
  const economy = createTextCampaignEconomy(client)
  const quote = economy.quote()
  await economy.recordEvent({ userId: 'user-a', reservationId: 'reservation-a', idempotencyKey: 'request-a', quote, status: 'delivered' })
  assert.equal(table, 'economic_generation_events')
  assert.equal(event.product_code, 'text_campaign')
  assert.equal(event.variant, 'standard')
  assert.equal(event.provider, 'openai')
  assert.equal(event.model, 'gpt-4.1')
  assert.equal(event.catalog_version, quote.catalogVersion)
  assert.equal(event.status, 'delivered')
  assert.equal((event.metadata as Record<string, unknown>).smart_token_cost, 25)
  assert.equal(JSON.stringify(event).includes('estimated_cost'), false)
  assert.equal(JSON.stringify(event).includes('secret'), false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createTextCampaignDeliveryStore } from './delivery.ts'

const rpcRow = (overrides: Record<string, unknown> = {}) => ({
  request_id: 'delivery-id', request_status: 'processing', returned_claim_token: 'claim-token',
  returned_reservation_id: null, returned_result: null, returned_expires_at: '2026-08-17T12:15:00.000Z',
  returned_smart_token_cost: 25, claimed: true, ...overrides,
})

test('maps claim ownership and keeps user identity server supplied', async () => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = []
  const store = createTextCampaignDeliveryStore({
    async rpc(name, args) { calls.push({ name, args }); return { data: [rpcRow()], error: null } },
  })
  const claim = await store.claimDelivery({ userId: 'user-a', clientRequestId: 'request-a', smartTokenCost: 25, catalogVersion: 'catalog-v1' })
  assert.equal(claim.claimed, true)
  assert.equal(claim.claimToken, 'claim-token')
  assert.deepEqual(calls[0], { name: 'claim_text_campaign_delivery', args: {
    p_user_id: 'user-a', p_client_request_id: 'request-a', p_smart_token_cost: 25, p_catalog_version: 'catalog-v1',
  } })
})

test('maps processing, completed recovery, reservation attachment and failure RPCs', async () => {
  const names: string[] = []
  const result = { listing_title: 'Mesmo resultado' } as never
  const store = createTextCampaignDeliveryStore({
    async rpc(name) {
      names.push(name)
      if (name === 'claim_text_campaign_delivery') return { data: [rpcRow({ claimed: false, returned_claim_token: null })], error: null }
      const status = name === 'complete_text_campaign_delivery' ? 'completed' : name === 'fail_text_campaign_delivery' ? 'failed' : 'processing'
      return { data: [{
        id: 'delivery-id', status, claim_token: 'claim-token', reservation_id: 'reservation-id',
        result: status === 'completed' ? result : null, expires_at: '2026-08-18T12:00:00.000Z', smart_token_cost: 25,
      }], error: null }
    },
  })
  assert.equal((await store.claimDelivery({ userId: 'user-a', clientRequestId: 'request-a', smartTokenCost: 25, catalogVersion: 'v1' })).claimed, false)
  assert.equal((await store.attachReservation({ userId: 'user-a', clientRequestId: 'request-a', claimToken: 'claim-token', reservationId: 'reservation-id' })).status, 'processing')
  assert.deepEqual((await store.completeDelivery({ userId: 'user-a', clientRequestId: 'request-a', claimToken: 'claim-token', result })).result, result)
  assert.equal((await store.failDelivery({ userId: 'user-a', clientRequestId: 'request-b', claimToken: 'claim-b', reason: 'failed' })).status, 'failed')
  await store.cleanupDeliveries()
  assert.deepEqual(names, [
    'claim_text_campaign_delivery', 'attach_text_campaign_reservation', 'complete_text_campaign_delivery',
    'fail_text_campaign_delivery', 'cleanup_text_campaign_deliveries',
  ])
})

test('fails closed on malformed or failed RPC responses', async () => {
  const failed = createTextCampaignDeliveryStore({ async rpc() { return { data: null, error: { message: 'private' } } } })
  await assert.rejects(() => failed.claimDelivery({ userId: 'user-a', clientRequestId: 'request-a', smartTokenCost: 25, catalogVersion: 'v1' }), /claim_failed/)
  const malformed = createTextCampaignDeliveryStore({ async rpc() { return { data: [{}], error: null } } })
  await assert.rejects(() => malformed.claimDelivery({ userId: 'user-a', clientRequestId: 'request-a', smartTokenCost: 25, catalogVersion: 'v1' }), /invalid_text_campaign_delivery/)
})

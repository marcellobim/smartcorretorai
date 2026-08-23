import test from 'node:test'
import assert from 'node:assert/strict'
import {
  callProviderOnlyAfterEconomicClaim,
  createQuickBannerCampaignGate,
  normalizeQuickBannerCampaignGateIdentity,
} from './economy.ts'

const userId = '00000000-0000-4000-8000-000000000001'
const clientRequestId = '00000000-0000-4000-8000-000000000002'
const claimToken = '00000000-0000-4000-8000-000000000003'

test('requires UUID request and economic claim identities', () => {
  assert.deepEqual(normalizeQuickBannerCampaignGateIdentity(clientRequestId, claimToken), { clientRequestId, claimToken })
  assert.throws(() => normalizeQuickBannerCampaignGateIdentity('', claimToken), /INVALID_CLIENT_REQUEST_ID/)
  assert.throws(() => normalizeQuickBannerCampaignGateIdentity(clientRequestId, 'price=1'), /INVALID_ECONOMIC_CLAIM/)
})

test('NO ECONOMIC CLAIM means NO PROVIDER CALL', async () => {
  let providerCalls = 0
  const result = await callProviderOnlyAfterEconomicClaim({ status: 'processing', executionClaimed: false, result: null }, async () => {
    providerCalls += 1
    return 'paid-output'
  })
  assert.equal(result, null)
  assert.equal(providerCalls, 0)
})

test('provider is reachable only after the persistent claim says execution_claimed', async () => {
  let providerCalls = 0
  const result = await callProviderOnlyAfterEconomicClaim({ status: 'processing', executionClaimed: true, result: null }, async () => {
    providerCalls += 1
    return 'paid-output'
  })
  assert.equal(result, 'paid-output')
  assert.equal(providerCalls, 1)
})

test('gate delegates claim, completion and cancellation without accepting price or user payload cost', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const gate = createQuickBannerCampaignGate({ rpc: async (name, args) => {
    calls.push({ name, args })
    if (name === 'claim_quick_banner_campaign_generation') {
      return { data: [{ generation_status: 'processing', execution_claimed: true, generation_result: null }], error: null }
    }
    if (name === 'complete_quick_banner_campaign_generation') {
      return { data: [{ generation_status: 'completed', execution_claimed: false, generation_result: args.p_result }], error: null }
    }
    return { data: [{ request_status: 'failed' }], error: null }
  } })
  const claim = await gate.claim({ userId, clientRequestId, claimToken })
  assert.equal(claim.executionClaimed, true)
  await gate.complete({ userId, clientRequestId, claimToken, result: { status: 200, body: { ok: true } } })
  await gate.fail({ userId, clientRequestId, claimToken, reason: 'provider_failed' })
  assert.deepEqual(calls.map(call => call.name), [
    'claim_quick_banner_campaign_generation',
    'complete_quick_banner_campaign_generation',
    'fail_quick_banner_prepared_delivery',
  ])
  for (const call of calls) {
    assert.equal('price' in call.args, false)
    assert.equal('amount' in call.args, false)
    assert.equal('smart_token_cost' in call.args, false)
  }
})

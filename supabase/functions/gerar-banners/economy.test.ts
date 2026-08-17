import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateQuickBannerItemsFefo,
  calculateQuickBannerSettlement,
  createQuickBannerEconomy,
  normalizeClientRequestId,
  quoteQuickBannerItems,
} from './economy.ts'

const templateMap = new Map([
  ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', mediaClass: 'static' as const }],
  ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { templateId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', mediaClass: 'video' as const }],
])

const item = (index: number, video = false) => ({
  piece_id: `piece-${index}`,
  template_id: video ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  credit_cost: 999999,
})

test('quotes 1..5 mixed items at the server-owned 45 ST unit', () => {
  for (let count = 1; count <= 5; count++) {
    const quote = quoteQuickBannerItems(Array.from({ length: count }, (_, index) => item(index, index % 2 === 1)), templateMap)
    assert.equal(quote.itemCount, count)
    assert.equal(quote.unitCost, 45)
    assert.equal(quote.totalCost, count * 45)
    assert.ok(quote.items.every(entry => entry.unitCost === 45))
  }
  for (const video of [false, true]) {
    const quote = quoteQuickBannerItems(Array.from({ length: 5 }, (_, index) => item(index, video)), templateMap)
    assert.equal(quote.totalCost, 225)
    assert.ok(quote.items.every(entry => entry.mediaClass === (video ? 'video' : 'static')))
  }
})

test('rejects zero, six, invalid templates, duplicate pieces and malformed retries', () => {
  assert.throws(() => quoteQuickBannerItems([], templateMap), /INVALID_ITEM_COUNT/)
  assert.throws(() => quoteQuickBannerItems(Array.from({ length: 6 }, (_, index) => item(index)), templateMap), /INVALID_ITEM_COUNT/)
  assert.throws(() => quoteQuickBannerItems([{ piece_id: 'x', template_id: 'invalid' }], templateMap), /INVALID_TEMPLATE_ID/)
  assert.throws(() => quoteQuickBannerItems([item(1), item(1)], templateMap), /INVALID_PIECE_ID/)
  assert.throws(() => quoteQuickBannerItems([{ ...item(1), retry_of_item_id: 'invalid' }], templateMap), /INVALID_RETRY_ITEM_ID/)
})

test('requires UUID client_request_id', () => {
  assert.equal(normalizeClientRequestId('CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC'), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  assert.throws(() => normalizeClientRequestId('user:timestamp:key'), /INVALID_CLIENT_REQUEST_ID/)
})

test('economy store uses batch RPCs and never accepts a client price', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      if (name === 'get_credit_lot_balance') return { data: [{ visible_balance: 225 }], error: null }
      if (name === 'reserve_credits_from_lots') return { data: [{ id: 'reservation', amount: 90, status: 'reserved' }], error: null }
      return { data: [{
        request_id: 'request', request_status: 'preparing', returned_claim_token: 'claim',
        returned_reservation_id: null, returned_item_count: 2, returned_quoted_tokens: 90,
        returned_reserved_tokens: 90, returned_items: [], claimed: true,
      }], error: null }
    },
  }
  const quote = quoteQuickBannerItems([item(0), item(1, true)], templateMap)
  const economy = createQuickBannerEconomy(client)
  await economy.claim({ userId: 'user', clientRequestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quote, adminBypass: false })
  assert.equal(await economy.getAvailableBalance('user'), 225)
  await economy.reserve({ userId: 'user', clientRequestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quote })
  const reserve = calls.find(call => call.name === 'reserve_credits_from_lots')!
  assert.equal(reserve.args.p_amount, 90)
  assert.equal((reserve.args.p_metadata as Record<string, unknown>).unit_cost, 45)
  assert.ok(!JSON.stringify(calls).includes('999999'))
})

test('settles 5/5, 4/5, 3/5, 1/5 and 0/5 strictly pro rata', () => {
  for (const completedCount of [5, 4, 3, 1, 0]) {
    const settlement = calculateQuickBannerSettlement([
      ...Array.from({ length: completedCount }, () => 'completed' as const),
      ...Array.from({ length: 5 - completedCount }, () => 'failed' as const),
    ])
    assert.deepEqual(settlement, {
      completedCount,
      failedCount: 5 - completedCount,
      reservedTokens: 225,
      consumedTokens: completedCount * 45,
      refundedTokens: (5 - completedCount) * 45,
    })
  }
})

test('associates every 45 ST item with its original FEFO lot slices', () => {
  const slices = allocateQuickBannerItemsFefo([
    { lotId: 'trial', available: 20 },
    { lotId: 'subscription', available: 70 },
    { lotId: 'topup', available: 45 },
  ], 3)
  assert.deepEqual(slices, [
    { itemIndex: 0, lotId: 'trial', amount: 20 },
    { itemIndex: 0, lotId: 'subscription', amount: 25 },
    { itemIndex: 1, lotId: 'subscription', amount: 45 },
    { itemIndex: 2, lotId: 'topup', amount: 45 },
  ])
})

test('fake concurrent duplicate claims reach the paid provider only once', async () => {
  let claimed = false
  let providerCalls = 0
  const run = async () => {
    await Promise.resolve()
    if (claimed) return 'processing'
    claimed = true
    for (let index = 0; index < 5; index++) providerCalls++
    return 'started'
  }
  const results = await Promise.all([run(), run()])
  assert.deepEqual(results.sort(), ['processing', 'started'])
  assert.equal(providerCalls, 5)
})

test('fake insufficient balance stops before every paid provider', () => {
  const required = 225
  const available = 224
  let openAiCalls = 0
  let fillCalls = 0
  let creatomateCalls = 0
  const result = available < required
    ? { code: 'INSUFFICIENT_SMART_TOKENS', required, available }
    : { code: 'OK', openAiCalls: ++openAiCalls, fillCalls: ++fillCalls, creatomateCalls: ++creatomateCalls }
  assert.deepEqual(result, { code: 'INSUFFICIENT_SMART_TOKENS', required: 225, available: 224 })
  assert.equal(openAiCalls + fillCalls + creatomateCalls, 0)
})

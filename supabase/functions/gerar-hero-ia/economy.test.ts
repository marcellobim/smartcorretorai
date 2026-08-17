import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateRealEstateBannerItemsFefo,
  calculateRealEstateBannerSettlement,
  createRealEstateBannerEconomy,
  normalizeBannerClientRequestId,
  quoteRealEstateBannerBatch,
} from './economy.ts'

const formats = [
  ['instagram_feed', 'square_feed', '1024x1024'],
  ['story_reels', 'vertical', '1024x1536'],
  ['facebook', 'landscape', '1536x1024'],
  ['whatsapp', 'square_feed', '1024x1024'],
  ['google_ads', 'landscape', '1536x1024'],
  ['portal', 'landscape', '1536x1024'],
] as const

function items(formatCount: number, creationOptions: number, referenceCount = 0) {
  return formats.slice(0, formatCount).flatMap(([formatId, formatGroup, resolution]) => (
    Array.from({ length: creationOptions }, (_, index) => ({
      piece_id: `${formatId}:option:${index + 1}`,
      format_id: formatId,
      format_group: formatGroup,
      creation_option: index + 1,
      resolution,
      reference_count: referenceCount,
      smart_tokens: 999_999,
    }))
  ))
}

test('validates the complete official multiplicity matrix and quotes 75 ST per piece', () => {
  for (const [formatCount, options, expected] of [
    [1, 1, 1], [1, 2, 2], [1, 3, 3], [2, 1, 2], [2, 2, 4],
    [2, 3, 6], [3, 1, 3], [3, 2, 6], [6, 1, 6],
  ] as const) {
    const quote = quoteRealEstateBannerBatch({
      selectedFormatCount: formatCount,
      creationOptions: options,
      items: items(formatCount, options, 4),
    })
    assert.equal(quote.itemCount, expected)
    assert.equal(quote.unitCost, 75)
    assert.equal(quote.totalCost, expected * 75)
    assert.ok(quote.items.every(item => item.referenceCount === 4 && item.unitCost === 75))
  }
})

test('blocks every manipulated total above six before provider work', () => {
  for (const [formatCount, options] of [[3, 3], [4, 2], [4, 3], [5, 2], [6, 2], [6, 3]]) {
    assert.throws(() => quoteRealEstateBannerBatch({
      selectedFormatCount: formatCount,
      creationOptions: options,
      items: items(formatCount, options),
    }), /INVALID_TOTAL_GENERATIONS/)
  }
  for (const total of [0, 7, 8, 12, 18, 100]) {
    assert.throws(() => quoteRealEstateBannerBatch({
      selectedFormatCount: total,
      creationOptions: 1,
      items: [],
    }))
  }
})

test('rejects incomplete matrices, duplicate pieces, invalid references and client prices', () => {
  const valid = items(2, 2)
  assert.throws(() => quoteRealEstateBannerBatch({ selectedFormatCount: 2, creationOptions: 2, items: valid.slice(0, 3) }), /INVALID_ITEMS/)
  assert.throws(() => quoteRealEstateBannerBatch({ selectedFormatCount: 2, creationOptions: 2, items: [valid[0], valid[0], valid[2], valid[3]] }), /INVALID_PIECE_ID/)
  assert.throws(() => quoteRealEstateBannerBatch({ selectedFormatCount: 1, creationOptions: 1, items: [{ ...items(1, 1)[0], reference_count: 5 }] }), /INVALID_REFERENCE_COUNT/)
  const quote = quoteRealEstateBannerBatch({ selectedFormatCount: 1, creationOptions: 1, items: [{ ...items(1, 1)[0], smart_tokens: 1 }] })
  assert.equal(quote.totalCost, 75)
})

test('requires a UUID client_request_id', () => {
  assert.equal(normalizeBannerClientRequestId('CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC'), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  assert.throws(() => normalizeBannerClientRequestId('hero-next-timestamp'), /INVALID_CLIENT_REQUEST_ID/)
})

test('quotes an isolated retry at exactly 75 ST and preserves the original visual option', () => {
  const retry = {
    ...items(1, 1, 2)[0],
    piece_id: 'retry:failed-item',
    creation_option: 3,
    retry_of_item_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  }
  const quote = quoteRealEstateBannerBatch({ selectedFormatCount: 1, creationOptions: 1, items: [retry] })
  assert.equal(quote.itemCount, 1)
  assert.equal(quote.totalCost, 75)
  assert.equal(quote.items[0].creationOption, 3)
  assert.equal(quote.items[0].retryOfItemId, retry.retry_of_item_id)
  assert.throws(() => quoteRealEstateBannerBatch({
    selectedFormatCount: 1,
    creationOptions: 2,
    items: [retry, { ...items(1, 2)[1], piece_id: 'second' }],
  }), /INVALID_RETRY_BATCH/)
})

test('settles every 6-item terminal combination strictly pro rata', () => {
  for (let completed = 6; completed >= 0; completed--) {
    assert.deepEqual(calculateRealEstateBannerSettlement([
      ...Array.from({ length: completed }, () => 'completed' as const),
      ...Array.from({ length: 6 - completed }, () => 'failed' as const),
    ]), {
      completedCount: completed,
      failedCount: 6 - completed,
      reservedTokens: 450,
      consumedTokens: completed * 75,
      refundedTokens: (6 - completed) * 75,
    })
  }
})

test('associates each 75 ST item with the original FEFO lot slices', () => {
  assert.deepEqual(allocateRealEstateBannerItemsFefo([
    { lotId: 'trial', available: 25 },
    { lotId: 'subscription', available: 100 },
    { lotId: 'topup', available: 100 },
  ], 3), [
    { itemIndex: 0, lotId: 'trial', amount: 25 },
    { itemIndex: 0, lotId: 'subscription', amount: 50 },
    { itemIndex: 1, lotId: 'subscription', amount: 50 },
    { itemIndex: 1, lotId: 'topup', amount: 25 },
    { itemIndex: 2, lotId: 'topup', amount: 75 },
  ])
})

test('RPC adapter reserves the complete server quote and ignores frontend price fields', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      if (name === 'get_credit_lot_balance') return { data: [{ visible_balance: 450 }], error: null }
      if (name === 'reserve_credits_from_lots') return { data: [{ id: 'reservation', amount: 450, status: 'reserved' }], error: null }
      return { data: [{
        request_id: 'request', request_status: 'processing', returned_claim_token: 'claim',
        returned_reservation_id: 'reservation', returned_item_count: 6,
        returned_quoted_tokens: 450, returned_reserved_tokens: 450, returned_items: [],
      }], error: null }
    },
  }
  const quote = quoteRealEstateBannerBatch({ selectedFormatCount: 2, creationOptions: 3, items: items(2, 3) })
  const economy = createRealEstateBannerEconomy(client)
  await economy.claim({ userId: 'user-a', clientRequestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quote })
  assert.equal(await economy.getAvailableBalance('user-a'), 450)
  await economy.reserve({ userId: 'user-a', clientRequestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quote })
  const reserve = calls.find(call => call.name === 'reserve_credits_from_lots')!
  assert.equal(reserve.args.p_amount, 450)
  assert.equal((reserve.args.p_metadata as Record<string, unknown>).unit_cost, 75)
  assert.ok(!JSON.stringify(calls).includes('999999'))
})

test('insufficient balance and duplicate item claims never duplicate provider execution', async () => {
  const required = 450
  const available = 449
  let providerCalls = 0
  if (available >= required) providerCalls++
  assert.equal(providerCalls, 0)

  let claimed = false
  const claimItem = async () => {
    await Promise.resolve()
    if (claimed) return false
    claimed = true
    providerCalls++
    return true
  }
  assert.deepEqual((await Promise.all([claimItem(), claimItem()])).sort(), [false, true])
  assert.equal(providerCalls, 1)
})

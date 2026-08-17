import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateLotsFefo,
  restoreCancelledAllocation,
  sortLotsFefo,
  visibleCreditBalance,
  type CreditLotModel,
} from '../credit-lots-model.ts'

const NOW = new Date('2026-08-16T12:00:00.000Z')
const lot = (overrides: Partial<CreditLotModel> & Pick<CreditLotModel, 'id'>): CreditLotModel => ({
  id: overrides.id,
  remainingAmount: 500,
  expiresAt: '2026-09-15T12:00:00.000Z',
  createdAt: '2026-08-16T12:00:00.000Z',
  status: 'active',
  hiddenFromUi: false,
  ...overrides,
})
test('FEFO sorts expiration, creation time and id with null expiration last', () => {
  const sorted = sortLotsFefo([
    lot({ id: 'd', expiresAt: null }),
    lot({ id: 'c', expiresAt: '2026-08-20T00:00:00.000Z', createdAt: '2026-08-15T00:00:00.000Z' }),
    lot({ id: 'b', expiresAt: '2026-08-20T00:00:00.000Z', createdAt: '2026-08-14T00:00:00.000Z' }),
    lot({ id: 'a', expiresAt: '2026-08-18T00:00:00.000Z' }),
  ])
  assert.deepEqual(sorted.map(item => item.id), ['a', 'b', 'c', 'd'])
})

test('a reservation can allocate multiple lots by FEFO', () => {
  const result = allocateLotsFefo([
    lot({ id: 'subscription', remainingAmount: 550, expiresAt: '2026-09-05T00:00:00.000Z' }),
    lot({ id: 'purchase', remainingAmount: 250, expiresAt: '2026-08-21T00:00:00.000Z' }),
  ], 800, NOW)
  assert.deepEqual(result.allocations, [
    { lotId: 'purchase', amount: 250 },
    { lotId: 'subscription', amount: 550 },
  ])
  assert.deepEqual(result.remainingLots.map(item => [item.id, item.remainingAmount, item.status]), [
    ['subscription', 0, 'exhausted'],
    ['purchase', 0, 'exhausted'],
  ])
})

test('expired, hidden and revoked lots are unavailable to a normal reservation', () => {
  const lots = [
    lot({ id: 'expired', expiresAt: '2026-08-15T00:00:00.000Z' }),
    lot({ id: 'trial', hiddenFromUi: true }),
    lot({ id: 'revoked', status: 'revoked' }),
    lot({ id: 'paid', remainingAmount: 100 }),
  ]
  assert.equal(visibleCreditBalance(lots, NOW), 100)
  assert.throws(() => allocateLotsFefo(lots, 101, NOW), /insufficient_credits/)
  assert.deepEqual(allocateLotsFefo(lots, 100, NOW).allocations, [{ lotId: 'paid', amount: 100 }])
})

test('trial balance can be allocated only through an explicit hidden-lot path', () => {
  const lots = [lot({ id: 'trial', remainingAmount: 200, hiddenFromUi: true })]
  assert.equal(visibleCreditBalance(lots, NOW), 0)
  assert.throws(() => allocateLotsFefo(lots, 100, NOW), /insufficient_credits/)
  assert.deepEqual(
    allocateLotsFefo(lots, 100, NOW, { includeHidden: true }).allocations,
    [{ lotId: 'trial', amount: 100 }],
  )
})

test('cancellation restores the original valid lot but never revives an expired lot', () => {
  const valid = restoreCancelledAllocation(lot({ id: 'valid', remainingAmount: 200 }), 100, NOW)
  assert.equal(valid.restored, true)
  assert.equal(valid.lot.remainingAmount, 300)

  const expired = restoreCancelledAllocation(
    lot({ id: 'expired', remainingAmount: 0, status: 'exhausted', expiresAt: '2026-08-15T00:00:00.000Z' }),
    100,
    NOW,
  )
  assert.equal(expired.restored, false)
  assert.equal(expired.lot.remainingAmount, 0)
  assert.equal(expired.lot.status, 'expired')
})

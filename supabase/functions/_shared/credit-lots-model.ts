export type CreditLotModel = Readonly<{
  id: string
  remainingAmount: number
  expiresAt: string | null
  createdAt: string
  status: 'active' | 'exhausted' | 'expired' | 'revoked'
  hiddenFromUi?: boolean
}>

export type CreditLotAllocation = Readonly<{ lotId: string; amount: number }>

const timestamp = (value: string | null) => value === null ? Number.POSITIVE_INFINITY : Date.parse(value)

export function sortLotsFefo(lots: readonly CreditLotModel[]): CreditLotModel[] {
  return [...lots].sort((left, right) => (
    timestamp(left.expiresAt) - timestamp(right.expiresAt)
    || Date.parse(left.createdAt) - Date.parse(right.createdAt)
    || left.id.localeCompare(right.id)
  ))
}
export function allocateLotsFefo(
  lots: readonly CreditLotModel[],
  requestedAmount: number,
  now = new Date(),
  options: { includeHidden?: boolean } = {},
): { allocations: CreditLotAllocation[]; remainingLots: CreditLotModel[] } {
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount <= 0) throw new Error('invalid_credit_amount')

  const nowMs = now.getTime()
  const eligible = sortLotsFefo(lots).filter(lot => (
    lot.status === 'active'
    && lot.remainingAmount > 0
    && (lot.expiresAt === null || timestamp(lot.expiresAt) > nowMs)
    && (options.includeHidden === true || lot.hiddenFromUi !== true)
  ))
  const available = eligible.reduce((sum, lot) => sum + lot.remainingAmount, 0)
  if (available < requestedAmount) throw new Error('insufficient_credits')

  let missing = requestedAmount
  const allocations: CreditLotAllocation[] = []
  const debits = new Map<string, number>()
  for (const lot of eligible) {
    if (missing === 0) break
    const amount = Math.min(lot.remainingAmount, missing)
    allocations.push(Object.freeze({ lotId: lot.id, amount }))
    debits.set(lot.id, amount)
    missing -= amount
  }

  const remainingLots = lots.map(lot => {
    const debit = debits.get(lot.id) ?? 0
    if (debit === 0) return lot
    const remainingAmount = lot.remainingAmount - debit
    return Object.freeze({ ...lot, remainingAmount, status: remainingAmount === 0 ? 'exhausted' as const : 'active' as const })
  })
  return { allocations, remainingLots }
}

export function visibleCreditBalance(lots: readonly CreditLotModel[], now = new Date()): number {
  const nowMs = now.getTime()
  return lots.reduce((sum, lot) => (
    lot.status === 'active'
    && lot.hiddenFromUi !== true
    && lot.remainingAmount > 0
    && (lot.expiresAt === null || timestamp(lot.expiresAt) > nowMs)
      ? sum + lot.remainingAmount
      : sum
  ), 0)
}

export function restoreCancelledAllocation(
  lot: CreditLotModel,
  amount: number,
  now = new Date(),
): { lot: CreditLotModel; restored: boolean } {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('invalid_credit_amount')
  if (lot.expiresAt !== null && timestamp(lot.expiresAt) <= now.getTime()) {
    return { lot: Object.freeze({ ...lot, status: 'expired', remainingAmount: 0 }), restored: false }
  }
  if (lot.status === 'revoked') return { lot, restored: false }
  return {
    lot: Object.freeze({ ...lot, remainingAmount: lot.remainingAmount + amount, status: 'active' }),
    restored: true,
  }
}

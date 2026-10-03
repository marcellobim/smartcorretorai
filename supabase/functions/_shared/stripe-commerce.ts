import {
  ECONOMIC_CATALOG_VERSION,
  MONTHLY_PLAN_GRANTS,
  PURCHASE_GRANTS,
} from './economic-catalog.ts'

export const STRIPE_CHECKOUT_ITEMS = Object.freeze({
  start_promotional: Object.freeze({
    key: 'start_promotional',
    kind: 'subscription',
    market: 'BR',
    priceEnv: 'STRIPE_PRICE_START_PROMOTIONAL',
    grant: MONTHLY_PLAN_GRANTS.start_promotional,
  }),
  start: Object.freeze({
    key: 'start',
    kind: 'subscription',
    market: 'BR',
    priceEnv: 'STRIPE_PRICE_START',
    grant: MONTHLY_PLAN_GRANTS.start,
  }),
  pro: Object.freeze({
    key: 'pro',
    kind: 'subscription',
    market: 'BR',
    priceEnv: 'STRIPE_PRICE_PRO',
    grant: MONTHLY_PLAN_GRANTS.pro,
  }),
  elite: Object.freeze({
    key: 'elite',
    kind: 'subscription',
    market: 'BR',
    priceEnv: 'STRIPE_PRICE_ELITE',
    grant: MONTHLY_PLAN_GRANTS.elite,
  }),
  brl_49_90: Object.freeze({
    key: 'brl_49_90', kind: 'payment', market: 'BR', priceEnv: 'STRIPE_PRICE_RECHARGE_BRL_49_90', grant: PURCHASE_GRANTS.brl_49_90,
  }),
  brl_97_90: Object.freeze({
    key: 'brl_97_90', kind: 'payment', market: 'BR', priceEnv: 'STRIPE_PRICE_RECHARGE_BRL_97_90', grant: PURCHASE_GRANTS.brl_97_90,
  }),
  usd_start: Object.freeze({
    key: 'usd_start', kind: 'subscription', market: 'US', priceEnv: 'STRIPE_PRICE_USD_START', grant: MONTHLY_PLAN_GRANTS.usd_start,
  }),
  usd_pro: Object.freeze({
    key: 'usd_pro', kind: 'subscription', market: 'US', priceEnv: 'STRIPE_PRICE_USD_PRO', grant: MONTHLY_PLAN_GRANTS.usd_pro,
  }),
  usd_elite: Object.freeze({
    key: 'usd_elite', kind: 'subscription', market: 'US', priceEnv: 'STRIPE_PRICE_USD_ELITE', grant: MONTHLY_PLAN_GRANTS.usd_elite,
  }),
  usd_9_90: Object.freeze({
    key: 'usd_9_90', kind: 'payment', market: 'US', priceEnv: 'STRIPE_PRICE_RECHARGE_USD_9_90', grant: PURCHASE_GRANTS.usd_9_90,
  }),
  usd_19_90: Object.freeze({
    key: 'usd_19_90', kind: 'payment', market: 'US', priceEnv: 'STRIPE_PRICE_RECHARGE_USD_19_90', grant: PURCHASE_GRANTS.usd_19_90,
  }),
})

export type StripeEconomicKey = keyof typeof STRIPE_CHECKOUT_ITEMS
export type StripePurchaseKind = 'subscription' | 'payment'
export type StripeMarket = 'BR' | 'US'
export type EnvReader = (name: string) => string | undefined

export type ResolvedStripeCheckoutItem = (typeof STRIPE_CHECKOUT_ITEMS)[StripeEconomicKey] & {
  priceId: string
}

export function isStripeEconomicKey(value: unknown): value is StripeEconomicKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STRIPE_CHECKOUT_ITEMS, value)
}

export function resolveStripeCheckoutItem(value: unknown, readEnv: EnvReader, market: StripeMarket = 'BR'): ResolvedStripeCheckoutItem {
  if (!isStripeEconomicKey(value)) throw new Error('invalid_economic_key')
  const item = STRIPE_CHECKOUT_ITEMS[value]
  if (item.market !== market) throw new Error('stripe_market_item_mismatch')
  const priceId = String(readEnv(item.priceEnv) ?? '').trim()
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) throw new Error('stripe_price_not_configured')
  return { ...item, priceId }
}

export function checkoutMetadata(userId: string, item: Pick<ResolvedStripeCheckoutItem, 'key' | 'kind' | 'market'>) {
  return Object.freeze({
    user_id: userId,
    economic_key: item.key,
    purchase_type: item.kind,
    market: item.market,
    catalog_version: ECONOMIC_CATALOG_VERSION,
  })
}

export function buildStripeCheckoutParams(input: {
  userId: string
  customerId?: string | null
  item: ResolvedStripeCheckoutItem
  successUrl: string
  cancelUrl: string
}) {
  const metadata = checkoutMetadata(input.userId, input.item)
  const params = new URLSearchParams({
    mode: input.item.kind,
    'adaptive_pricing[enabled]': 'false',
    'line_items[0][price]': input.item.priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: input.userId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  })
  if (input.customerId) params.set('customer', input.customerId)
  for (const [key, value] of Object.entries(metadata)) params.set(`metadata[${key}]`, value)
  if (input.item.kind === 'subscription') {
    params.set('allow_promotion_codes', 'true')
    for (const [key, value] of Object.entries(metadata)) params.set(`subscription_data[metadata][${key}]`, value)
  } else {
    for (const [key, value] of Object.entries(metadata)) params.set(`payment_intent_data[metadata][${key}]`, value)
  }
  return params
}

export type StripeMetadata = Record<string, string | undefined>

export function requireTrustedMetadata(metadata: unknown, expectedKind: StripePurchaseKind) {
  const raw = metadata && typeof metadata === 'object' ? metadata as StripeMetadata : {}
  const userId = String(raw.user_id ?? '')
  const economicKey = String(raw.economic_key ?? '')
  const purchaseType = String(raw.purchase_type ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('invalid_stripe_user_metadata')
  }
  if (!isStripeEconomicKey(economicKey)) throw new Error('invalid_stripe_economic_metadata')
  const item = STRIPE_CHECKOUT_ITEMS[economicKey]
  const metadataMarket = String(raw.market ?? '')
  // Legacy BR subscriptions predate the market field. They remain valid; every
  // new checkout receives explicit market metadata and USD never accepts a gap.
  if (purchaseType !== expectedKind || item.kind !== expectedKind || (metadataMarket && metadataMarket !== item.market) || (!metadataMarket && item.market !== 'BR')) {
    throw new Error('invalid_stripe_purchase_type')
  }
  return { userId, economicKey, item }
}

function decodeHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
) {
  if (!signatureHeader || !webhookSecret) return false
  const parts = signatureHeader.split(',').map(part => part.trim().split('=', 2))
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds || signatures.length === 0) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`)))
  return signatures.some(signature => {
    const candidate = decodeHex(signature)
    return candidate ? constantTimeEqual(expected, candidate) : false
  })
}

export type FinancialGrantRequest = Readonly<{
  userId: string
  economicKey: StripeEconomicKey
  source: 'subscription' | 'purchase'
  smartTokens: number
  expiresAt: string
  idempotencyKey: string
  stripeInvoiceId?: string
  stripeCheckoutSessionId?: string
  catalogVersion: string
}>

export type StripeFinancialRpcClient = {
  rpc(name: string, parameters: Record<string, unknown>): Promise<{
    data: unknown
    error: { message?: string } | null
  }>
}

export async function grantFinancialLot(
  request: FinancialGrantRequest,
  client: StripeFinancialRpcClient,
): Promise<'created' | 'already_processed'> {
  const expectedKey = request.source === 'subscription'
    ? `stripe:invoice:${request.stripeInvoiceId ?? ''}`
    : `stripe:checkout:${request.stripeCheckoutSessionId ?? ''}`
  if (request.idempotencyKey !== expectedKey) throw new Error('invalid_financial_idempotency_key')
  const { data, error } = await client.rpc('grant_stripe_credit_lot', {
    p_user_id: request.userId,
    p_amount: request.smartTokens,
    p_source: request.source,
    p_expires_at: request.expiresAt,
    p_catalog_version: request.catalogVersion,
    p_stripe_invoice_id: request.stripeInvoiceId ?? null,
    p_stripe_checkout_session_id: request.stripeCheckoutSessionId ?? null,
    p_metadata: { economic_key: request.economicKey },
  })
  if (error) throw new Error('stripe_credit_grant_rpc_failed')
  const row = Array.isArray(data) ? data[0] : data
  const result = row && typeof row === 'object' ? (row as Record<string, unknown>).result : undefined
  if (result !== 'created' && result !== 'already_processed') {
    throw new Error('stripe_credit_grant_rpc_invalid_response')
  }
  return result
}

export function subscriptionGrantRequest(
  invoiceId: string,
  metadata: unknown,
  currentPeriodEnd: string | null,
): FinancialGrantRequest {
  if (!invoiceId) throw new Error('stripe_invoice_id_missing')
  if (!currentPeriodEnd || !Number.isFinite(Date.parse(currentPeriodEnd))) throw new Error('stripe_subscription_period_end_missing')
  const trusted = requireTrustedMetadata(metadata, 'subscription')
  return Object.freeze({
    userId: trusted.userId,
    economicKey: trusted.economicKey,
    source: 'subscription',
    smartTokens: trusted.item.grant.smartTokens,
    expiresAt: currentPeriodEnd,
    idempotencyKey: `stripe:invoice:${invoiceId}`,
    stripeInvoiceId: invoiceId,
    catalogVersion: ECONOMIC_CATALOG_VERSION,
  })
}

export function purchaseGrantRequest(
  checkoutSessionId: string,
  metadata: unknown,
  nowMilliseconds = Date.now(),
): FinancialGrantRequest {
  if (!checkoutSessionId) throw new Error('stripe_checkout_session_id_missing')
  const trusted = requireTrustedMetadata(metadata, 'payment')
  const validityDays = 'validityDays' in trusted.item.grant ? trusted.item.grant.validityDays : 0
  if (!Number.isSafeInteger(validityDays) || validityDays <= 0) throw new Error('purchase_validity_missing')
  return Object.freeze({
    userId: trusted.userId,
    economicKey: trusted.economicKey,
    source: 'purchase',
    smartTokens: trusted.item.grant.smartTokens,
    expiresAt: new Date(nowMilliseconds + validityDays * 86_400_000).toISOString(),
    idempotencyKey: `stripe:checkout:${checkoutSessionId}`,
    stripeCheckoutSessionId: checkoutSessionId,
    catalogVersion: ECONOMIC_CATALOG_VERSION,
  })
}

export function mapStripeSubscriptionStatus(status: unknown): 'ativo' | 'cancelado' | 'pausado' {
  if (status === 'active' || status === 'trialing') return 'ativo'
  if (status === 'canceled') return 'cancelado'
  return 'pausado'
}

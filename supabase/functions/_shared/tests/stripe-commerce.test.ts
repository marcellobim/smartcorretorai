import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  STRIPE_CHECKOUT_ITEMS,
  buildStripeCheckoutParams,
  grantFinancialLot,
  purchaseGrantRequest,
  resolveStripeCheckoutItem,
  subscriptionGrantRequest,
  verifyStripeSignature,
} from '../stripe-commerce.ts'
import { handleStripeCheckout } from '../../stripe-checkout/runtime.ts'
import { handleStripeCustomerPortal } from '../../stripe-customer-portal/runtime.ts'
import {
  handleStripeWebhook,
  normalizeStripeSubscription,
  processStripeEvent,
  subscriptionPersistence,
  type StripeWebhookDependencies,
} from '../../stripe-webhook/runtime.ts'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const PERIOD_END = new Date(1_802_592_000 * 1000).toISOString()
const webhookIndex = readFileSync(new URL('../../stripe-webhook/index.ts', import.meta.url), 'utf8')
const webhookRuntime = readFileSync(new URL('../../stripe-webhook/runtime.ts', import.meta.url), 'utf8')
const portalIndex = readFileSync(new URL('../../stripe-customer-portal/index.ts', import.meta.url), 'utf8')
const portalRuntime = readFileSync(new URL('../../stripe-customer-portal/runtime.ts', import.meta.url), 'utf8')
const env = new Map([
  ['STRIPE_PRICE_START', 'price_teststart'],
  ['STRIPE_PRICE_PRO', 'price_testpro'],
  ['STRIPE_PRICE_ELITE', 'price_testelite'],
  ['STRIPE_PRICE_RECHARGE_BRL_49_90', 'price_testrecharge'],
  ['STRIPE_PRICE_RECHARGE_BRL_97_90', 'price_testrechargelarge'],
  ['STRIPE_CHECKOUT_SUCCESS_URL', 'https://smartcorretor.example/planos?checkout=success'],
  ['STRIPE_CHECKOUT_CANCEL_URL', 'https://smartcorretor.example/planos?checkout=cancel'],
])
const readEnv = (name: string) => env.get(name)

test('Stripe catalog rejects arbitrary keys and resolves prices only through server env names', () => {
  assert.throws(() => resolveStripeCheckoutItem('arbitrary', readEnv), /invalid_economic_key/)
  for (const legacyKey of ['brl_30', 'brl_50', 'brl_100', 'brl_250', 'brl_500']) {
    assert.throws(() => resolveStripeCheckoutItem(legacyKey, readEnv), /invalid_economic_key/)
  }
  assert.equal(STRIPE_CHECKOUT_ITEMS.start.priceEnv, 'STRIPE_PRICE_START')
  assert.equal(resolveStripeCheckoutItem('start', readEnv).priceId, 'price_teststart')
  assert.throws(() => resolveStripeCheckoutItem('start_promotional', readEnv), /stripe_price_not_configured/)
  const purchases = Object.values(STRIPE_CHECKOUT_ITEMS).filter(item => item.kind === 'payment')
  assert.deepEqual(purchases.map(item => item.key), ['brl_49_90', 'brl_97_90'])
  assert.deepEqual(purchases.map(item => item.priceEnv), [
    'STRIPE_PRICE_RECHARGE_BRL_49_90',
    'STRIPE_PRICE_RECHARGE_BRL_97_90',
  ])
})

test('checkout keeps server prices and original currency by disabling Adaptive Pricing for every item', () => {
  const expected = [
    ['start', 'subscription', 'price_teststart'],
    ['pro', 'subscription', 'price_testpro'],
    ['elite', 'subscription', 'price_testelite'],
    ['brl_49_90', 'payment', 'price_testrecharge'],
    ['brl_97_90', 'payment', 'price_testrechargelarge'],
  ] as const

  for (const [economicKey, mode, priceId] of expected) {
    const params = buildStripeCheckoutParams({
      userId: USER_ID,
      item: resolveStripeCheckoutItem(economicKey, readEnv),
      successUrl: readEnv('STRIPE_CHECKOUT_SUCCESS_URL')!,
      cancelUrl: readEnv('STRIPE_CHECKOUT_CANCEL_URL')!,
    })
    assert.equal(params.get('mode'), mode)
    assert.equal(params.get('adaptive_pricing[enabled]'), 'false')
    assert.equal(params.get('line_items[0][price]'), priceId)
    assert.equal(params.has('currency'), false)
    assert.equal(params.get('success_url'), readEnv('STRIPE_CHECKOUT_SUCCESS_URL'))
    assert.equal(params.get('cancel_url'), readEnv('STRIPE_CHECKOUT_CANCEL_URL'))
    assert.doesNotMatch(params.toString(), /smart.?tokens|validity|amount/i)
  }
})

test('checkout endpoint accepts exactly one internal economic key', async () => {
  let captured: URLSearchParams | null = null
  const dependencies = {
    readEnv,
    authenticate: async () => ({ id: USER_ID }),
    findStripeCustomerId: async () => null,
    createCheckoutSession: async (params: URLSearchParams) => {
      captured = params
      return { id: 'cs_test', url: 'https://checkout.stripe.com/c/pay/test' }
    },
  }
  const invalid = await handleStripeCheckout(new Request('https://local/checkout', {
    method: 'POST',
    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
    body: JSON.stringify({ economicKey: 'start', smartTokens: 999999 }),
  }), dependencies)
  assert.equal(invalid.status, 400)

  const valid = await handleStripeCheckout(new Request('https://local/checkout', {
    method: 'POST',
    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
    body: JSON.stringify({ economicKey: 'start' }),
  }), dependencies)
  assert.equal(valid.status, 200)
  assert.equal(captured?.get('mode'), 'subscription')
})

test('customer portal authenticates the user and resolves the active Stripe customer only server-side', async () => {
  let captured: URLSearchParams | null = null
  const dependencies = {
    returnUrl: 'https://www.smartcorretorai.com/planos',
    authenticate: async (token: string) => token === 'valid' ? { id: USER_ID } : null,
    findActiveStripeCustomerId: async (userId: string) => userId === USER_ID ? 'cus_server_only' : null,
    createPortalSession: async (params: URLSearchParams) => {
      captured = params
      return { url: 'https://billing.stripe.com/p/session/test' }
    },
  }

  const unauthenticated = await handleStripeCustomerPortal(new Request('https://local/portal', { method: 'POST' }), dependencies)
  assert.equal(unauthenticated.status, 401)

  const arbitraryCustomer = await handleStripeCustomerPortal(new Request('https://local/portal', {
    method: 'POST',
    headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
    body: JSON.stringify({ customer_id: 'cus_attacker_controlled' }),
  }), dependencies)
  assert.equal(arbitraryCustomer.status, 400)

  const valid = await handleStripeCustomerPortal(new Request('https://local/portal', {
    method: 'POST',
    headers: { authorization: 'Bearer valid' },
  }), dependencies)
  assert.equal(valid.status, 200)
  assert.equal(captured?.get('customer'), 'cus_server_only')
  assert.equal(captured?.get('return_url'), 'https://www.smartcorretorai.com/planos')
})

test('customer portal requires an active subscription and accepts only Stripe Billing Portal URLs', async () => {
  const base = {
    returnUrl: 'https://www.smartcorretorai.com/planos',
    authenticate: async () => ({ id: USER_ID }),
  }
  const noSubscription = await handleStripeCustomerPortal(new Request('https://local/portal', {
    method: 'POST', headers: { authorization: 'Bearer valid' },
  }), {
    ...base,
    findActiveStripeCustomerId: async () => null,
    createPortalSession: async () => ({ url: 'https://billing.stripe.com/p/session/unused' }),
  })
  assert.equal(noSubscription.status, 403)

  const invalidUrl = await handleStripeCustomerPortal(new Request('https://local/portal', {
    method: 'POST', headers: { authorization: 'Bearer valid' },
  }), {
    ...base,
    findActiveStripeCustomerId: async () => 'cus_server_only',
    createPortalSession: async () => ({ url: 'https://example.com/not-stripe' }),
  })
  assert.equal(invalidUrl.status, 502)
  assert.match(portalIndex, /from\('subscriptions'\)[\s\S]*?eq\('user_id', userId\)[\s\S]*?eq\('status', 'ativo'\)/)
  assert.doesNotMatch(`${portalIndex}\n${portalRuntime}`, /add_credits|creditos_avulsos|grant_stripe_credit_lot/)
})

async function stripeSignature(rawBody: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`)))
  const digest = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},v1=${digest}`
}

test('webhook requires a valid Stripe signature over the raw body', async () => {
  const secret = 'whsec_test_only'
  const timestamp = 1_800_000_000
  const rawBody = JSON.stringify({ id: 'evt_test', type: 'ignored', data: { object: {} } })
  assert.equal(await verifyStripeSignature(rawBody, await stripeSignature(rawBody, secret, timestamp), secret, timestamp), true)
  assert.equal(await verifyStripeSignature(`${rawBody} `, await stripeSignature(rawBody, secret, timestamp), secret, timestamp), false)

  const response = await handleStripeWebhook(new Request('https://local/webhook', { method: 'POST', body: rawBody }), {
    webhookSecret: secret,
    nowSeconds: timestamp,
    retrieveSubscription: async () => ({}),
    syncSubscription: async () => undefined,
    grant: async () => undefined,
  })
  assert.equal(response.status, 400)
})

const subscription = {
  id: 'sub_test',
  customer: 'cus_test',
  status: 'active',
  current_period_start: 1_800_000_000,
  current_period_end: 1_802_592_000,
  metadata: { user_id: USER_ID, economic_key: 'start', purchase_type: 'subscription' },
}

function webhookDependencies(grants: unknown[], syncs: unknown[]): StripeWebhookDependencies {
  return {
    webhookSecret: 'unused',
    retrieveSubscription: async () => subscription,
    syncSubscription: async record => { syncs.push(record) },
    grant: async request => { grants.push(request) },
  }
}

test('subscription checkout only links subscription; invoice.paid is monthly grant authority', async () => {
  const grants: unknown[] = []
  const syncs: unknown[] = []
  const dependencies = webhookDependencies(grants, syncs)
  await processStripeEvent({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_subscription', mode: 'subscription', subscription: 'sub_test', client_reference_id: USER_ID } },
  }, dependencies)
  assert.equal(syncs.length, 1)
  assert.equal(grants.length, 0)

  await processStripeEvent({
    type: 'invoice.paid',
    data: { object: { id: 'in_test_cycle', subscription: 'sub_test' } },
  }, dependencies)
  assert.equal(grants.length, 1)
  assert.deepEqual(grants[0], subscriptionGrantRequest('in_test_cycle', subscription.metadata, PERIOD_END))
})

test('subscription persistence uses only the remote schema and maps START, PRO and ELITE profiles', () => {
  const expected = [
    ['start', 'start', 'start'],
    ['pro', 'pro', 'pro'],
    ['elite', 'elite', 'imobiliaria'],
  ] as const

  for (const [economicKey, subscriptionPlan, profilePlan] of expected) {
    const record = normalizeStripeSubscription({
      ...subscription,
      metadata: { ...subscription.metadata, economic_key: economicKey },
    })
    const persistence = subscriptionPersistence(record)
    assert.equal(persistence.subscription.plano, subscriptionPlan)
    assert.equal(persistence.profile.plano, profilePlan)
    assert.deepEqual(Object.keys(persistence.subscription).sort(), [
      'current_period_end',
      'plano',
      'status',
      'stripe_customer_id',
      'stripe_subscription_id',
      'user_id',
    ])
  }
})

test('invoice.paid preserves monthly grants and invoice idempotency for START, PRO and ELITE', async () => {
  const expected = [
    ['start', 6_350],
    ['pro', 10_850],
    ['elite', 26_350],
  ] as const

  for (const [economicKey, smartTokens] of expected) {
    const grants: any[] = []
    const planSubscription = {
      ...subscription,
      metadata: { ...subscription.metadata, economic_key: economicKey },
    }
    const dependencies: StripeWebhookDependencies = {
      webhookSecret: 'unused',
      retrieveSubscription: async () => planSubscription,
      syncSubscription: async () => undefined,
      grant: async request => { grants.push(request) },
    }
    const invoice = { type: 'invoice.paid', data: { object: { id: `in_${economicKey}`, subscription: 'sub_test' } } }
    await processStripeEvent(invoice, dependencies)
    await processStripeEvent(invoice, dependencies)
    assert.equal(grants[0].smartTokens, smartTokens)
    assert.equal(grants[0].stripeInvoiceId, `in_${economicKey}`)
    assert.equal(new Set(grants.map(grant => grant.idempotencyKey)).size, 1)
  }
})

test('subscription persistence references no nonexistent columns or legacy credit mutation', () => {
  assert.doesNotMatch(`${webhookIndex}\n${webhookRuntime}`, /\bplan_id\b|\bcurrent_period_start\b/)
  assert.doesNotMatch(`${webhookIndex}\n${webhookRuntime}`, /add_credits|creditos_avulsos|saldo_creditos/)
  assert.match(webhookIndex, /upsert\(persistence\.subscription, \{ onConflict: 'user_id' \}\)/)
})

test('purchase and subscription grants use different Stripe idempotency references', async () => {
  const purchase = purchaseGrantRequest('cs_purchase', {
    user_id: USER_ID,
    economic_key: 'brl_49_90',
    purchase_type: 'payment',
  }, 1_800_000_000_000)
  const recurring = subscriptionGrantRequest('in_cycle', subscription.metadata, PERIOD_END)
  assert.equal(purchase.stripeCheckoutSessionId, 'cs_purchase')
  assert.equal(purchase.idempotencyKey, 'stripe:checkout:cs_purchase')
  assert.equal(recurring.stripeInvoiceId, 'in_cycle')
  assert.equal(recurring.idempotencyKey, 'stripe:invoice:in_cycle')
  assert.notEqual(purchase.idempotencyKey, recurring.idempotencyKey)
  const repurchase = purchaseGrantRequest('cs_purchase_again', {
    user_id: USER_ID,
    economic_key: 'brl_49_90',
    purchase_type: 'payment',
  }, 1_800_000_000_000)
  assert.equal(repurchase.economicKey, purchase.economicKey)
  assert.notEqual(repurchase.idempotencyKey, purchase.idempotencyKey)
})

test('financial grant calls only the canonical RPC and recognizes created and replay results', async () => {
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> = []
  const results = ['created', 'already_processed', 'created', 'already_processed']
  const client = {
    rpc: async (name: string, parameters: Record<string, unknown>) => {
      calls.push({ name, parameters })
      return { data: [{ result: results.shift() }], error: null }
    },
  }
  const subscriptionRequest = subscriptionGrantRequest('in_new', subscription.metadata, PERIOD_END)
  const purchaseRequest = purchaseGrantRequest('cs_new', {
    user_id: USER_ID, economic_key: 'brl_49_90', purchase_type: 'payment',
  }, 1_800_000_000_000)
  assert.equal(await grantFinancialLot(subscriptionRequest, client), 'created')
  assert.equal(await grantFinancialLot(subscriptionRequest, client), 'already_processed')
  assert.equal(await grantFinancialLot(purchaseRequest, client), 'created')
  assert.equal(await grantFinancialLot(purchaseRequest, client), 'already_processed')
  assert.deepEqual(calls.map(call => call.name), Array(4).fill('grant_stripe_credit_lot'))
  assert.equal(calls[0].parameters.p_stripe_invoice_id, 'in_new')
  assert.equal(calls[0].parameters.p_stripe_checkout_session_id, null)
  assert.equal(calls[2].parameters.p_stripe_invoice_id, null)
  assert.equal(calls[2].parameters.p_stripe_checkout_session_id, 'cs_new')
})

test('financial RPC errors and invalid responses are never treated as success', async () => {
  const request = subscriptionGrantRequest('in_error', subscription.metadata, PERIOD_END)
  await assert.rejects(
    () => grantFinancialLot(request, { rpc: async () => ({ data: null, error: { message: 'database failure' } }) }),
    /stripe_credit_grant_rpc_failed/,
  )
  await assert.rejects(
    () => grantFinancialLot(request, { rpc: async () => ({ data: [], error: null }) }),
    /stripe_credit_grant_rpc_invalid_response/,
  )
})

test('payment failure pauses and subscription deletion cancels without granting tokens', async () => {
  const grants: unknown[] = []
  const syncs: any[] = []
  const dependencies = webhookDependencies(grants, syncs)
  await processStripeEvent({
    type: 'invoice.payment_failed',
    data: { object: { id: 'in_failed', subscription: 'sub_test' } },
  }, dependencies)
  await processStripeEvent({
    type: 'customer.subscription.deleted',
    data: { object: subscription },
  }, dependencies)
  assert.equal(syncs[0].status, 'pausado')
  assert.equal(syncs[1].status, 'cancelado')
  assert.equal(subscriptionPersistence(syncs[0]).profile.plano, 'free')
  assert.equal(subscriptionPersistence(syncs[1]).profile.plano, 'free')
  assert.equal(Object.hasOwn(subscriptionPersistence(syncs[0]).profile, 'saldo_creditos'), false)
  assert.equal(grants.length, 0)
})

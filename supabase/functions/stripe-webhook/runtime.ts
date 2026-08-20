import {
  mapStripeSubscriptionStatus,
  purchaseGrantRequest,
  requireTrustedMetadata,
  subscriptionGrantRequest,
  verifyStripeSignature,
  type FinancialGrantRequest,
} from '../_shared/stripe-commerce.ts'

type StripeObject = Record<string, any>

export type SubscriptionSyncRecord = Readonly<{
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string | null
  subscriptionPlan: 'start' | 'pro' | 'elite'
  profilePlan: 'start' | 'pro' | 'imobiliaria'
  status: 'ativo' | 'cancelado' | 'pausado'
  currentPeriodEnd: string | null
}>

export type SubscriptionPersistence = Readonly<{
  subscription: Readonly<{
    user_id: string
    stripe_customer_id: string | null
    stripe_subscription_id: string
    plano: 'start' | 'pro' | 'elite'
    status: 'ativo' | 'cancelado' | 'pausado'
    current_period_end: string | null
  }>
  profile: Readonly<{
    plano: 'start' | 'pro' | 'imobiliaria' | 'free'
    stripe_customer_id?: string
  }>
}>

export type StripeWebhookDependencies = {
  webhookSecret: string
  retrieveSubscription(id: string): Promise<StripeObject>
  syncSubscription(record: SubscriptionSyncRecord): Promise<void>
  grant(request: FinancialGrantRequest): Promise<unknown>
  nowSeconds?: number
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const stripeId = (value: unknown) => typeof value === 'string'
  ? value
  : value && typeof value === 'object' && typeof (value as StripeObject).id === 'string'
    ? (value as StripeObject).id
    : ''

function invoiceSubscriptionId(invoice: StripeObject) {
  return stripeId(invoice.subscription) || stripeId(invoice.parent?.subscription_details?.subscription)
}

function unixDate(value: unknown) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null
}

function subscriptionPeriodEnd(subscription: StripeObject) {
  const items = Array.isArray(subscription.items?.data) ? subscription.items.data : []
  const ends = items.map((item: StripeObject) => Number(item.current_period_end)).filter(Number.isFinite)
  return subscription.current_period_end ?? (ends.length ? Math.max(...ends) : null)
}

function subscriptionPlans(economicKey: string) {
  if (economicKey === 'start' || economicKey === 'start_promotional') {
    return { subscriptionPlan: 'start', profilePlan: 'start' } as const
  }
  if (economicKey === 'pro') return { subscriptionPlan: 'pro', profilePlan: 'pro' } as const
  if (economicKey === 'elite') return { subscriptionPlan: 'elite', profilePlan: 'imobiliaria' } as const
  throw new Error('stripe_subscription_plan_invalid')
}

export function normalizeStripeSubscription(
  subscription: StripeObject,
  statusOverride?: 'ativo' | 'cancelado' | 'pausado',
): SubscriptionSyncRecord {
  const trusted = requireTrustedMetadata(subscription.metadata, 'subscription')
  const subscriptionId = stripeId(subscription.id)
  if (!subscriptionId) throw new Error('stripe_subscription_id_missing')
  const plans = subscriptionPlans(trusted.economicKey)
  return Object.freeze({
    userId: trusted.userId,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: stripeId(subscription.customer) || null,
    ...plans,
    status: statusOverride ?? mapStripeSubscriptionStatus(subscription.status),
    currentPeriodEnd: unixDate(subscriptionPeriodEnd(subscription)),
  })
}

export function subscriptionPersistence(record: SubscriptionSyncRecord): SubscriptionPersistence {
  const profile = record.stripeCustomerId
    ? { plano: record.status === 'ativo' ? record.profilePlan : 'free', stripe_customer_id: record.stripeCustomerId }
    : { plano: record.status === 'ativo' ? record.profilePlan : 'free' }
  return Object.freeze({
    subscription: Object.freeze({
      user_id: record.userId,
      stripe_customer_id: record.stripeCustomerId,
      stripe_subscription_id: record.stripeSubscriptionId,
      plano: record.subscriptionPlan,
      status: record.status,
      current_period_end: record.currentPeriodEnd,
    }),
    profile: Object.freeze(profile),
  }) as SubscriptionPersistence
}

async function syncRetrievedSubscription(
  subscriptionId: string,
  dependencies: StripeWebhookDependencies,
  statusOverride?: 'ativo' | 'cancelado' | 'pausado',
) {
  if (!subscriptionId) throw new Error('stripe_subscription_id_missing')
  const subscription = await dependencies.retrieveSubscription(subscriptionId)
  const record = normalizeStripeSubscription(subscription, statusOverride)
  await dependencies.syncSubscription(record)
  return { subscription, record }
}

export async function processStripeEvent(event: StripeObject, dependencies: StripeWebhookDependencies) {
  const object = event?.data?.object as StripeObject | undefined
  if (!object) throw new Error('stripe_event_object_missing')

  switch (event.type) {
    case 'checkout.session.completed': {
      if (object.mode === 'subscription') {
        const { subscription } = await syncRetrievedSubscription(stripeId(object.subscription), dependencies)
        const trusted = requireTrustedMetadata(subscription.metadata, 'subscription')
        if (object.client_reference_id && object.client_reference_id !== trusted.userId) {
          throw new Error('stripe_checkout_user_mismatch')
        }
        return 'subscription_linked'
      }
      if (object.mode === 'payment' && object.payment_status === 'paid') {
        const nowMilliseconds = (dependencies.nowSeconds ?? Math.floor(Date.now() / 1000)) * 1000
        await dependencies.grant(purchaseGrantRequest(stripeId(object.id), object.metadata, nowMilliseconds))
        return 'purchase_granted'
      }
      return 'checkout_ignored'
    }
    case 'invoice.paid': {
      const subscriptionId = invoiceSubscriptionId(object)
      if (!subscriptionId) return 'invoice_ignored'
      const { subscription, record } = await syncRetrievedSubscription(subscriptionId, dependencies)
      await dependencies.grant(subscriptionGrantRequest(stripeId(object.id), subscription.metadata, record.currentPeriodEnd))
      return 'subscription_granted'
    }
    case 'invoice.payment_failed': {
      const subscriptionId = invoiceSubscriptionId(object)
      if (!subscriptionId) return 'invoice_ignored'
      await syncRetrievedSubscription(subscriptionId, dependencies, 'pausado')
      return 'subscription_paused'
    }
    case 'customer.subscription.updated':
      await dependencies.syncSubscription(normalizeStripeSubscription(object))
      return 'subscription_updated'
    case 'customer.subscription.deleted':
      await dependencies.syncSubscription(normalizeStripeSubscription(object, 'cancelado'))
      return 'subscription_cancelled'
    default:
      return 'event_ignored'
  }
}

export async function handleStripeWebhook(request: Request, dependencies: StripeWebhookDependencies) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405)
  const rawBody = await request.text()
  const validSignature = await verifyStripeSignature(
    rawBody,
    request.headers.get('stripe-signature'),
    dependencies.webhookSecret,
    dependencies.nowSeconds,
  )
  if (!validSignature) return json({ ok: false, error: 'Assinatura Stripe inválida.' }, 400)

  let event: StripeObject
  try {
    event = JSON.parse(rawBody)
  } catch {
    return json({ ok: false, error: 'Payload inválido.' }, 400)
  }

  const outcome = await processStripeEvent(event, dependencies)
  return json({ ok: true, outcome }, 200)
}

import {
  buildStripeCheckoutParams,
  resolveStripeCheckoutItem,
  type EnvReader,
  type ResolvedStripeCheckoutItem,
} from '../_shared/stripe-commerce.ts'

export type CheckoutDependencies = {
  authenticate(token: string): Promise<{ id: string } | null>
  findStripeCustomerId(userId: string): Promise<string | null>
  createCheckoutSession(params: URLSearchParams): Promise<{ id: string; url: string | null }>
  readEnv: EnvReader
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

export async function handleStripeCheckout(request: Request, dependencies: CheckoutDependencies) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405)
  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+/i.test(authorization)) return json({ ok: false, error: 'Sessão inválida.' }, 401)
  const user = await dependencies.authenticate(authorization.replace(/^Bearer\s+/i, '').trim())
  if (!user) return json({ ok: false, error: 'Sessão inválida.' }, 401)

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || Object.keys(body).length !== 1 || !Object.prototype.hasOwnProperty.call(body, 'economicKey')) {
    return json({ ok: false, error: 'Item de checkout inválido.' }, 400)
  }

  let item: ResolvedStripeCheckoutItem
  try {
    item = resolveStripeCheckoutItem(body.economicKey, dependencies.readEnv)
  } catch {
    return json({ ok: false, error: 'Item de checkout indisponível.' }, 400)
  }

  const successUrl = String(dependencies.readEnv('STRIPE_CHECKOUT_SUCCESS_URL') ?? '').trim()
  const cancelUrl = String(dependencies.readEnv('STRIPE_CHECKOUT_CANCEL_URL') ?? '').trim()
  if (!/^https:\/\//i.test(successUrl) || !/^https:\/\//i.test(cancelUrl)) {
    return json({ ok: false, error: 'Checkout indisponível.' }, 500)
  }

  const customerId = await dependencies.findStripeCustomerId(user.id)
  const session = await dependencies.createCheckoutSession(buildStripeCheckoutParams({
    userId: user.id,
    customerId,
    item,
    successUrl,
    cancelUrl,
  }))
  if (!session.url || !/^https:\/\/checkout\.stripe\.com\//i.test(session.url)) {
    return json({ ok: false, error: 'Checkout indisponível.' }, 502)
  }
  return json({ ok: true, url: session.url }, 200)
}

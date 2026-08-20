export type CustomerPortalDependencies = {
  authenticate(token: string): Promise<{ id: string } | null>
  findActiveStripeCustomerId(userId: string): Promise<string | null>
  createPortalSession(params: URLSearchParams): Promise<{ url: string | null }>
  returnUrl: string
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

export async function handleStripeCustomerPortal(request: Request, dependencies: CustomerPortalDependencies) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405)

  const authorization = request.headers.get('authorization') || ''
  if (!/^Bearer\s+/i.test(authorization)) return json({ ok: false, error: 'Sessão inválida.' }, 401)
  const user = await dependencies.authenticate(authorization.replace(/^Bearer\s+/i, '').trim())
  if (!user) return json({ ok: false, error: 'Sessão inválida.' }, 401)

  const rawBody = await request.text()
  if (rawBody.trim()) {
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return json({ ok: false, error: 'Solicitação inválida.' }, 400)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
      return json({ ok: false, error: 'Solicitação inválida.' }, 400)
    }
  }

  if (!/^https:\/\//i.test(dependencies.returnUrl)) {
    return json({ ok: false, error: 'Portal indisponível.' }, 500)
  }

  const customerId = await dependencies.findActiveStripeCustomerId(user.id)
  if (!customerId) return json({ ok: false, error: 'Assinatura ativa não encontrada.' }, 403)

  const params = new URLSearchParams({ customer: customerId, return_url: dependencies.returnUrl })
  const session = await dependencies.createPortalSession(params)
  if (!session.url) return json({ ok: false, error: 'Portal indisponível.' }, 502)

  let portalUrl: URL
  try {
    portalUrl = new URL(session.url)
  } catch {
    return json({ ok: false, error: 'Portal indisponível.' }, 502)
  }
  if (portalUrl.protocol !== 'https:' || portalUrl.hostname !== 'billing.stripe.com') {
    return json({ ok: false, error: 'Portal indisponível.' }, 502)
  }

  return json({ ok: true, url: portalUrl.toString() }, 200)
}

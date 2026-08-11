export type InstagramCallbackDependencies = {
  completeConnection: (code: string, state: string) => Promise<void>
  connectedRedirect: string
  errorRedirect: string
  log?: (event: string, details: Record<string, unknown>) => void
}

export async function handleInstagramCallback(request: Request, dependencies: InstagramCallbackDependencies) {
  if (request.method !== 'GET') return new Response('Método não permitido.', { status: 405, headers: { Allow: 'GET' } })
  const url = new URL(request.url)
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  if (!code || !state || url.searchParams.has('error')) {
    dependencies.log?.('instagram_oauth_rejected', { reason: 'invalid_callback' })
    return Response.redirect(dependencies.errorRedirect, 303)
  }

  try {
    await dependencies.completeConnection(code, state)
    dependencies.log?.('instagram_oauth_completed', { connected: true })
    return Response.redirect(dependencies.connectedRedirect, 303)
  } catch {
    dependencies.log?.('instagram_oauth_failed', { connected: false })
    return Response.redirect(dependencies.errorRedirect, 303)
  }
}

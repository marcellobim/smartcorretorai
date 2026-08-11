import {
  createInstagramOAuthTelemetryEvent,
  getInstagramOAuthFailure,
  type InstagramOAuthTelemetryEvent,
} from '../_shared/instagram/telemetry.ts'

export type InstagramCallbackDependencies = {
  completeConnection: (code: string, state: string) => Promise<void>
  connectedRedirect: string
  errorRedirect: string
  log?: (event: InstagramOAuthTelemetryEvent) => void
}

export async function handleInstagramCallback(request: Request, dependencies: InstagramCallbackDependencies) {
  if (request.method !== 'GET') return new Response('Método não permitido.', { status: 405, headers: { Allow: 'GET' } })
  const url = new URL(request.url)
  const code = url.searchParams.get('code') || ''
  const state = url.searchParams.get('state') || ''
  if (!code || !state || url.searchParams.has('error')) {
    dependencies.log?.(createInstagramOAuthTelemetryEvent({ stage: 'state' }))
    return Response.redirect(dependencies.errorRedirect, 303)
  }

  try {
    await dependencies.completeConnection(code, state)
    dependencies.log?.(createInstagramOAuthTelemetryEvent({ stage: 'success' }))
    return Response.redirect(dependencies.connectedRedirect, 303)
  } catch (error) {
    dependencies.log?.(getInstagramOAuthFailure(error))
    return Response.redirect(dependencies.errorRedirect, 303)
  }
}

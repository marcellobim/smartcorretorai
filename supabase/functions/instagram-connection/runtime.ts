const connectionCorsHeaders = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, Authorization, apikey, ApiKey, content-type, Content-Type, x-client-info, X-Client-Info',
  'Access-Control-Max-Age': '86400',
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...connectionCorsHeaders, 'Content-Type': 'application/json' },
})

type AuthUser = { id: string }
type StoredConnection = { ig_username?: string | null; token_expires_at?: string | null } | null

export type InstagramConnectionDependencies = {
  authenticate: (token: string) => Promise<AuthUser | null>
  createAuthorizationUrl: (userId: string) => Promise<string>
  getConnection: (userId: string) => Promise<StoredConnection>
  deleteConnection: (userId: string) => Promise<void>
  now?: () => number
  log?: (event: string, details: Record<string, unknown>) => void
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  return /^Bearer\s+\S+$/i.test(authorization) ? authorization.replace(/^Bearer\s+/i, '').trim() : ''
}

export async function handleInstagramConnection(request: Request, dependencies: InstagramConnectionDependencies) {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: connectionCorsHeaders })
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return json({ ok: false, error: 'Método não permitido.' }, 405)

  const token = bearerToken(request)
  if (!token) return json({ ok: false, error: 'Sua sessão expirou.' }, 401)
  const user = await dependencies.authenticate(token).catch(() => null)
  if (!user) return json({ ok: false, error: 'Sua sessão expirou.' }, 401)

  try {
    if (request.method === 'POST') {
      const authorizationUrl = await dependencies.createAuthorizationUrl(user.id)
      dependencies.log?.('instagram_oauth_started', { authenticated: true })
      return json({ ok: true, authorization_url: authorizationUrl })
    }

    if (request.method === 'DELETE') {
      await dependencies.deleteConnection(user.id)
      dependencies.log?.('instagram_connection_deleted', { authenticated: true })
      return json({ ok: true, connected: false, status: 'disconnected' })
    }

    const connection = await dependencies.getConnection(user.id)
    if (!connection) return json({ ok: true, connected: false, instagram_username: null, token_expires_at: null, status: 'disconnected' })
    const expiresAt = connection.token_expires_at || null
    const expired = Boolean(expiresAt && Date.parse(expiresAt) <= (dependencies.now?.() ?? Date.now()))
    return json({
      ok: true,
      connected: !expired,
      instagram_username: connection.ig_username || null,
      token_expires_at: expiresAt,
      status: expired ? 'expired' : 'connected',
    })
  } catch {
    return json({ ok: false, error: 'Não foi possível processar a conexão com o Instagram.' }, 502)
  }
}

import { deriveTikTokCapabilities } from '../_shared/tiktok/capabilities.ts'
import { validateTikTokIdentity, type TikTokIdentity } from '../_shared/tiktok/environment.ts'
import {
  buildTikTokAuthorizationUrl,
  createTikTokOAuthState,
  fingerprintTikTokAppId,
} from '../_shared/tiktok/oauth.ts'
import { logTikTokOAuthEvent } from '../_shared/tiktok/telemetry.ts'
import type { TikTokOAuthStateRepository } from '../_shared/tiktok/types.ts'

const TIKTOK_CALLBACK_PATH = '/functions/v1/tiktok-callback'

export type TikTokConnectionStatusRecord = Readonly<{
  id: string
  userId: string
  environment: string
  appId: string
  connectionStatus: string
  accessTokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  scopes: readonly string[]
  updatedAt: string
}>

export type TikTokAccountStatusRecord = Readonly<{
  tiktokConnectionId: string
  userId: string
  environment: string
  appId: string
  accountStatus: string
  displayName: string | null
}>

export type TikTokConnectionStatusRepository = Readonly<{
  listConnections: (userId: string) => Promise<readonly TikTokConnectionStatusRecord[]>
  listAccounts: (
    userId: string,
    connectionIds: readonly string[],
  ) => Promise<readonly TikTokAccountStatusRecord[]>
}>

export type TikTokConnectionDependencies = Readonly<{
  identity: TikTokIdentity
  authenticate: (accessToken: string) => Promise<{ userId: string } | null>
  stateRepository: TikTokOAuthStateRepository
  statusRepository: TikTokConnectionStatusRepository
  clientKey: string
  redirectUri: string
  frontendOrigin: string
  now?: () => number
  authorizeUpgrade?: (userId: string, jwt: string) => Promise<void>
  startUpgrade?: (userId: string) => Promise<string>
  randomBytes?: (length: number) => Uint8Array
  log?: (message: string) => void
}>

const corsHeaders = (configuredOrigin: string, requestOrigin: string | null) => ({
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  ...(requestOrigin === configuredOrigin ? { 'Access-Control-Allow-Origin': configuredOrigin } : {}),
  Vary: 'Origin',
})

const jsonHeaders = (configuredOrigin: string, requestOrigin: string | null) => ({
  ...corsHeaders(configuredOrigin, requestOrigin),
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
})

const json = (origin: string, requestOrigin: string | null, status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: jsonHeaders(origin, requestOrigin) },
)

export const validateTikTokFrontendOrigin = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_frontend_origin')
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_frontend_origin')
  return url.origin
}

export const validateTikTokConfiguredRedirectUri = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_redirect_uri')
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== TIKTOK_CALLBACK_PATH
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_redirect_uri')
  return url.toString()
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

export function createTikTokConnectionHandler(dependencies: TikTokConnectionDependencies) {
  const identity = validateTikTokIdentity(dependencies.identity)
  const frontendOrigin = validateTikTokFrontendOrigin(dependencies.frontendOrigin)
  const redirectUri = validateTikTokConfiguredRedirectUri(dependencies.redirectUri)
  const log = dependencies.log ?? (() => undefined)

  return async (request: Request): Promise<Response> => {
    const requestOrigin = request.headers.get('origin')
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(frontendOrigin, requestOrigin) })
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json(frontendOrigin, requestOrigin, 405, { error: 'method_not_allowed' })
    }

    const token = bearerToken(request)
    if (!token) return json(frontendOrigin, requestOrigin, 401, { error: 'authentication_required' })

    let authenticated: { userId: string } | null
    try {
      authenticated = await dependencies.authenticate(token)
    } catch {
      authenticated = null
    }
    if (!authenticated) return json(frontendOrigin, requestOrigin, 401, { error: 'invalid_session' })

    if (request.method === 'GET') {
      try {
        const connections = await dependencies.statusRepository.listConnections(authenticated.userId)
        const usableConnections = connections
          .filter(connection => (
            connection.userId === authenticated.userId
            && connection.environment === identity.environment
            && connection.appId === identity.appId
            && connection.connectionStatus !== 'revoked'
          ))
          .sort((left, right) => {
            const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
            return updatedDifference || left.id.localeCompare(right.id)
          })

        if (usableConnections.length === 0) {
          return json(frontendOrigin, requestOrigin, 200, { connected: false, status: 'disconnected' })
        }

        const connectionIds = usableConnections.map(connection => connection.id)
        const accounts = await dependencies.statusRepository.listAccounts(
          authenticated.userId,
          connectionIds,
        )
        const activeAccounts = new Map(
          accounts
            .filter(account => (
              account.userId === authenticated.userId
              && account.environment === identity.environment
              && account.appId === identity.appId
              && account.accountStatus === 'active'
              && connectionIds.includes(account.tiktokConnectionId)
            ))
            .map(account => [account.tiktokConnectionId, account]),
        )
        const selected = usableConnections.find(connection => activeAccounts.has(connection.id))
        if (!selected) return json(frontendOrigin, requestOrigin, 200, { connected: false, status: 'disconnected' })

        const now = dependencies.now?.() ?? Date.now()
        if (!Number.isFinite(now)) throw new Error('invalid_tiktok_status_time')
        const validUntil = (value: string | null) => value !== null && Date.parse(value) > now
        if (selected.connectionStatus !== 'active' || !selected.scopes.includes('user.info.basic') || !validUntil(selected.refreshTokenExpiresAt)) {
          return json(frontendOrigin, requestOrigin, 200, { connected: false, status: 'reconnect_required' })
        }
        if (!validUntil(selected.accessTokenExpiresAt)) {
          return json(frontendOrigin, requestOrigin, 200, { connected: false, status: 'access_token_expired' })
        }
        return json(frontendOrigin, requestOrigin, 200, {
          connected: true, status: 'connected',
          ...(new URL(request.url).searchParams.get('view') === 'capabilities' ? {
            capabilities: deriveTikTokCapabilities(selected.scopes),
            capability_status: deriveTikTokCapabilities(selected.scopes).direct_post ? 'direct_post_authorized' : 'connected_basic',
          } : {}),
          account: { display_name: activeAccounts.get(selected.id)?.displayName ?? null },
        })
      } catch {
        return json(frontendOrigin, requestOrigin, 503, { error: 'tiktok_connection_status_unavailable' })
      }
    }

    let action: unknown
    let body: Record<string, unknown> = {}
    try {
      const raw = await request.text()
      if(raw.length > 2048) return json(frontendOrigin, requestOrigin, 400, {error:'invalid_action'})
      if(raw) { const parsed = JSON.parse(raw); if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw Error(); body=parsed }
      action=body.action
    } catch { return json(frontendOrigin, requestOrigin, 400, {error:'invalid_action'}) }
    if(action !== undefined && action !== 'login_basic' && action !== 'direct_post_upgrade')
      return json(frontendOrigin, requestOrigin, 400, {error:'invalid_action'})
    if(action === 'direct_post_upgrade') {
      if(Object.keys(body).some(k=>k!=='action')) return json(frontendOrigin, requestOrigin, 400, {error:'invalid_action'})
      if(identity.environment !== 'sandbox' || !dependencies.authorizeUpgrade || !dependencies.startUpgrade)
        return json(frontendOrigin, requestOrigin, 403, {error:'tiktok_upgrade_not_allowed'})
      try { await dependencies.authorizeUpgrade(authenticated.userId,token) }
      catch { return json(frontendOrigin, requestOrigin, 403, {error:'tiktok_upgrade_not_allowed'}) }
      try { return json(frontendOrigin, requestOrigin, 200, {authorization_url:await dependencies.startUpgrade(authenticated.userId)}) }
      catch { return json(frontendOrigin, requestOrigin, 503, {error:'tiktok_upgrade_unavailable'}) }
    }

    try {
      const challenge = await createTikTokOAuthState({
        userId: authenticated.userId,
        redirectUri,
        identity,
        randomBytes: dependencies.randomBytes,
      }, dependencies.stateRepository)
      const authorizationUrl = buildTikTokAuthorizationUrl({
        clientKey: dependencies.clientKey,
        redirectUri,
        state: challenge.state,
      })
      logTikTokOAuthEvent(log, { stage: 'authorization', http_status: 200 })
      log(JSON.stringify({
        event: 'tiktok_oauth_state_correlation',
        created_state_fp: challenge.stateFingerprint,
        sent_state_fp: challenge.stateFingerprint,
        environment: identity.environment,
        app_id_fp: await fingerprintTikTokAppId(identity.appId),
      }))
      return json(frontendOrigin, requestOrigin, 200, { authorization_url: authorizationUrl })
    } catch {
      logTikTokOAuthEvent(log, { stage: 'authorization', http_status: 503 })
      return json(frontendOrigin, requestOrigin, 503, { error: 'tiktok_connection_unavailable' })
    }
  }
}

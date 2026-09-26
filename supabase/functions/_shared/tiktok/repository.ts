import { validateTikTokIdentity, type TikTokIdentity } from './environment.ts'
import type { TikTokOAuthStateRepository } from './types.ts'
import type { TikTokLoginPersistenceInput } from '../../tiktok-callback/handler.ts'
import type { TikTokConnectionStatusRepository } from '../../tiktok-connection/handler.ts'

type Result = { data: unknown; error: unknown }
type Query = PromiseLike<Result> & { eq: (key: string, value: string) => Query; in: (key: string, values: string[]) => Query }
export type TikTokDatabaseClient = {
  rpc: (name: string, parameters: Record<string, unknown>) => PromiseLike<Result>
  from: (table: string) => { select: (columns: string) => Query }
}
const rows = (data: unknown): Record<string, unknown>[] => Array.isArray(data) ? data : []
const text = (value: unknown) => typeof value === 'string' ? value : ''
const nullableText = (value: unknown) => typeof value === 'string' ? value : null

export function createTikTokRepositories(admin: TikTokDatabaseClient, configuredIdentity: TikTokIdentity) {
  const identity = validateTikTokIdentity(configuredIdentity)
  const assertIdentity = (input: TikTokIdentity) => {
    if (input.environment !== identity.environment || input.appId !== identity.appId) throw new Error('tiktok_identity_mismatch')
  }
  const stateRepository: TikTokOAuthStateRepository = {
    async persistChallenge(record) {
      assertIdentity(record)
      const { error } = await admin.rpc('register_tiktok_oauth_state', {
        p_state_hash: record.stateHash, p_user_id: record.userId, p_redirect_uri_hash: record.redirectUriHash,
        p_environment: identity.environment, p_app_id: identity.appId,
      })
      if (error) throw new Error('tiktok_state_persistence_failed')
    },
    async inspectChallenge(input) {
      const { data, error } = await admin.from('tiktok_oauth_states')
        .select('state_hash,environment,app_id,expires_at,consumed_at')
        .eq('state_hash', input.stateHash)
      if (error) throw new Error('tiktok_state_inspection_failed')
      const record = rows(data)[0]
      if (!record) return null
      const stateHash = text(record.state_hash)
      const environment = text(record.environment)
      const appId = text(record.app_id)
      const expiresAt = text(record.expires_at)
      const consumedAt = nullableText(record.consumed_at)
      if (!/^[0-9a-f]{64}$/.test(stateHash)
          || !['sandbox', 'production'].includes(environment)
          || !/^[0-9a-f]{64}$/.test(appId)
          || !Number.isFinite(Date.parse(expiresAt))) return null
      return { stateHash, environment: environment as TikTokIdentity['environment'], appId, expiresAt, consumedAt }
    },
    async consumeChallenge(input) {
      assertIdentity(input)
      const { data, error } = await admin.rpc('consume_tiktok_oauth_state', {
        p_state_hash: input.stateHash, p_redirect_uri_hash: input.redirectUriHash,
        p_environment: identity.environment, p_app_id: identity.appId,
      })
      if (error) throw new Error('tiktok_state_consumption_failed')
      return typeof data === 'string' ? { userId: data } : null
    },
  }
  const statusRepository: TikTokConnectionStatusRepository = {
    async listConnections(userId) {
      const { data, error } = await admin.from('tiktok_connections')
        .select('id,user_id,environment,app_id,connection_status,access_token_expires_at,refresh_token_expires_at,scopes,updated_at')
        .eq('user_id', userId).eq('environment', identity.environment).eq('app_id', identity.appId)
      if (error) throw new Error('tiktok_connection_status_query_failed')
      return rows(data).map(record => ({
        id: text(record.id), userId: text(record.user_id), environment: text(record.environment), appId: text(record.app_id),
        connectionStatus: text(record.connection_status), accessTokenExpiresAt: nullableText(record.access_token_expires_at),
        refreshTokenExpiresAt: nullableText(record.refresh_token_expires_at),
        scopes: Array.isArray(record.scopes) ? record.scopes.filter((v): v is string => typeof v === 'string') : [],
        updatedAt: text(record.updated_at),
      }))
    },
    async listAccounts(userId, connectionIds) {
      if (!connectionIds.length) return []
      const { data, error } = await admin.from('tiktok_accounts')
        .select('tiktok_connection_id,user_id,environment,app_id,account_status,display_name')
        .eq('user_id', userId).eq('environment', identity.environment).eq('app_id', identity.appId)
        .in('tiktok_connection_id', [...connectionIds])
      if (error) throw new Error('tiktok_account_status_query_failed')
      return rows(data).map(record => ({
        tiktokConnectionId: text(record.tiktok_connection_id), userId: text(record.user_id),
        environment: text(record.environment), appId: text(record.app_id),
        accountStatus: text(record.account_status), displayName: nullableText(record.display_name),
      }))
    },
  }
  const persistLogin = async (input: TikTokLoginPersistenceInput) => {
    assertIdentity(input)
    // No table writes here: connection + account belong to one database transaction.
    const { data, error } = await admin.rpc('persist_tiktok_login', {
      p_environment: identity.environment, p_app_id: identity.appId, p_login: input,
    })
    if (error || typeof data !== 'string' || !/^[0-9a-f-]{36}$/i.test(data)) throw new Error('tiktok_login_persistence_failed')
  }
  return { stateRepository, statusRepository, persistLogin }
}

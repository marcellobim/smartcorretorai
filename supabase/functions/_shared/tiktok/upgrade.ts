import { buildTikTokAuthorizationUrl, validateTikTokRedirectUri } from './oauth.ts'
import { validateTikTokIdentity, type TikTokIdentity } from './environment.ts'
import { DIRECT_POST_SCOPES, INBOX_UPLOAD_SCOPES } from './capabilities.ts'
import type { TikTokDatabaseClient } from './repository.ts'
import type { TikTokLoginPersistenceInput } from '../../tiktok-callback/handler.ts'
const PATTERN = /^(?:dp|du)\.[A-Za-z0-9_-]{43}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('')
export type UpgradeBinding = { userId: string; connectionId: string; tokenVersion: number }
export function createTikTokUpgradeRepository(admin: TikTokDatabaseClient, configured: TikTokIdentity) {
  const identity = validateTikTokIdentity(configured)
  const ensureSandbox = () => { if(identity.environment !== 'sandbox') throw new Error('tiktok_upgrade_sandbox_only') }
  return {
    async start(userId: string, redirectUri: string, clientKey: string, capability: 'direct_post'|'inbox_upload'='direct_post') {
      ensureSandbox()
      if(!UUID.test(userId)) throw new Error('tiktok_upgrade_user_invalid')
      const redirect = validateTikTokRedirectUri(redirectUri)
      let binary=''; for(const n of crypto.getRandomValues(new Uint8Array(32))) binary+=String.fromCharCode(n)
      const raw=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')
      const state=(capability==='inbox_upload'?'du.':'dp.')+raw
      const url=new URL(buildTikTokAuthorizationUrl({clientKey,redirectUri:redirect,state:raw}))
      url.searchParams.set('state',state);url.searchParams.set('scope',(capability==='inbox_upload'?INBOX_UPLOAD_SCOPES:DIRECT_POST_SCOPES).join(','))
      const {error}=await admin.rpc('register_tiktok_direct_post_state',{
        p_state_hash:await hash(state),p_user_id:userId,p_redirect_uri_hash:await hash(redirect),
        p_environment:identity.environment,p_app_id:identity.appId,
      })
      if(error)throw new Error('tiktok_upgrade_state_failed')
      return url.toString()
    },
    async consume(state: string, redirectUri: string): Promise<UpgradeBinding> {
      ensureSandbox()
      if(!PATTERN.test(state))throw new Error('tiktok_upgrade_state_invalid')
      const {data,error}=await admin.rpc('consume_tiktok_direct_post_state',{
        p_state_hash:await hash(state),p_redirect_uri_hash:await hash(validateTikTokRedirectUri(redirectUri)),
        p_environment:identity.environment,p_app_id:identity.appId,
      })
      const row=data as UpgradeBinding | null
      if(error||!row||!UUID.test(row.userId)||!UUID.test(row.connectionId)||!Number.isSafeInteger(row.tokenVersion)||row.tokenVersion<1)
        throw new Error('tiktok_upgrade_state_invalid')
      return row
    },
    async persist(input: TikTokLoginPersistenceInput, binding: UpgradeBinding) {
      ensureSandbox()
      if(input.userId!==binding.userId||input.environment!==identity.environment||input.appId!==identity.appId)
        throw new Error('tiktok_upgrade_identity_mismatch')
      const {data,error}=await admin.rpc('persist_tiktok_direct_post_upgrade',{
        p_environment:identity.environment,p_app_id:identity.appId,p_login:input,
        p_connection_id:binding.connectionId,p_expected_version:binding.tokenVersion,
      })
      if(error||data!==binding.connectionId)throw new Error('tiktok_upgrade_persistence_failed')
    },
  }
}

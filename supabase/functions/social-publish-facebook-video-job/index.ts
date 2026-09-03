import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { publishFacebookPageVideo } from '../_shared/facebook/publish-client.ts'
import { auditExistingFacebookPublishCapability } from '../_shared/instagram/meta-facebook-publish-audit.ts'
import { decryptMetaToken, loadMetaTokenKeyringFromEnvironment } from '../_shared/instagram/meta-token-crypto.ts'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { handleFacebookJobPublish } from '../social-publish-facebook-job/runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const hashCapability = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const fetchWithTimeout: typeof fetch = (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })
const VIDEO_SOURCE_TYPES = ['video_imobiliario', 'studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel', 'smart_space_transform', 'smart_space_life', 'smart_space_broker']

serve(request => {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const client = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })
  const graphVersion = requiredEnv('META_GRAPH_API_VERSION')
  return handleFacebookJobPublish(request, {
    expectedContentTypes: ['video/mp4'],
    getJob: async (jobId, claimToken) => {
      const { data, error } = await client.from('social_publish_jobs')
        .select('id,user_id,social_connection_id,social_account_id,platform,caption_snapshot,claim_token,claim_expires_at,status,external_publish_started_at,external_post_id,source_type')
        .eq('id', jobId).eq('claim_token', claimToken).eq('platform', 'facebook')
        .in('source_type', VIDEO_SOURCE_TYPES).eq('status', 'processing').maybeSingle()
      if (error || !data || !data.social_account_id || data.external_publish_started_at || data.external_post_id || Date.parse(data.claim_expires_at) <= Date.now()) return null
      return { id: data.id, userId: data.user_id, connectionId: data.social_connection_id, socialAccountId: data.social_account_id, platform: 'facebook' as const, caption: data.caption_snapshot || '', claimToken: data.claim_token }
    },
    getLease: async jobId => {
      const { data, error } = await client.from('social_media_leases')
        .select('id,job_id,opaque_token_hash,expires_at,content_type,content_length,status')
        .eq('job_id', jobId).eq('status', 'active').maybeSingle()
      return error || !data ? null : { id: data.id, jobId: data.job_id, capabilityHash: data.opaque_token_hash, expiresAt: data.expires_at, contentType: data.content_type, contentLength: Number(data.content_length) }
    },
    hashCapability,
    buildLeaseUrl: capability => `${supabaseUrl}/functions/v1/social-media-lease/${capability}`,
    validateLeaseUrl: async (capability, contentType, contentLength) => {
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/social-media-lease/${capability}`, { method: 'HEAD' })
      return response.ok && response.headers.get('content-type') === contentType && Number(response.headers.get('content-length')) === contentLength
    },
    getActiveAccount: async job => {
      const { data: connection, error: connectionError } = await client.from('social_connections')
        .select('id,user_id,connection_status,expires_at,access_token_ciphertext,access_token_nonce,access_token_auth_tag,key_version')
        .eq('id', job.connectionId).eq('user_id', job.userId).eq('provider', 'meta').eq('connection_status', 'active').maybeSingle()
      if (connectionError || !connection?.access_token_ciphertext || !connection.access_token_nonce || !connection.access_token_auth_tag || !connection.key_version || Date.parse(connection.expires_at) <= Date.now()) return null
      const { data: page, error: pageError } = await client.from('social_accounts')
        .select('id,external_account_id,display_name,credential_ciphertext,credential_nonce,credential_auth_tag,key_version')
        .eq('id', job.socialAccountId).eq('social_connection_id', job.connectionId).eq('user_id', job.userId)
        .eq('provider', 'meta').eq('platform', 'facebook').eq('account_status', 'active').maybeSingle()
      if (pageError || !page?.credential_ciphertext || !page.credential_nonce || !page.credential_auth_tag || !page.key_version) return null
      const keyring = await loadMetaTokenKeyringFromEnvironment(name => Deno.env.get(name))
      const [userAccessToken, pageAccessToken] = await Promise.all([
        decryptMetaToken({ algorithm: 'AES-256-GCM', ciphertext: connection.access_token_ciphertext, nonce: connection.access_token_nonce, authTag: connection.access_token_auth_tag, keyVersion: connection.key_version }, keyring),
        decryptMetaToken({ algorithm: 'AES-256-GCM', ciphertext: page.credential_ciphertext, nonce: page.credential_nonce, authTag: page.credential_auth_tag, keyVersion: page.key_version }, keyring),
      ])
      return { socialAccountId: page.id, pageId: page.external_account_id, pageName: page.display_name || '', pageAccessToken, userAccessToken }
    },
    validateCapability: async account => (await auditExistingFacebookPublishCapability({ appId: requiredEnv('META_APP_ID'), appSecret: requiredEnv('META_APP_SECRET'), graphApiVersion: graphVersion, userToken: account.userAccessToken, pageId: account.pageId, fetcher: fetchWithTimeout })).ready,
    recordConnectionValidation: async job => {
      const { data: connection } = await client.from('social_connections').select('expires_at').eq('id', job.connectionId).eq('user_id', job.userId).maybeSingle()
      const { data, error } = await client.rpc('record_social_connection_validation', { p_connection_id: job.connectionId, p_expected_status: 'active', p_validation_status: 'active', p_expires_at: connection?.expires_at })
      return !error && data === true
    },
    beginExternalPublish: async input => {
      const { data, error } = await client.rpc('start_facebook_photo_publish', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_media_lease_id: input.leaseId, p_min_remaining_lease_seconds: 300 })
      return !error && Array.isArray(data) && data.length === 1
    },
    publishPhoto: input => publishFacebookPageVideo({ pageId: input.pageId, pageAccessToken: input.pageAccessToken, videoUrl: input.imageUrl, caption: input.caption, graphApiVersion: graphVersion, fetcher: fetchWithTimeout }),
    completeJob: async input => {
      const { data, error } = await client.rpc('complete_facebook_photo_publish', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_external_post_id: input.postId, p_external_post_url: input.permalink })
      return !error && Array.isArray(data) && data.length === 1
    },
    markReconciliationRequired: async input => {
      const { data, error } = await client.rpc('transition_claimed_social_publish_job', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_expected_status: 'publishing', p_next_status: 'reconciliation_required' })
      return !error && Array.isArray(data) && data.length === 1
    },
    log: stage => console.info(JSON.stringify({ event: 'social_publish_facebook_video_job', stage })),
  })
})

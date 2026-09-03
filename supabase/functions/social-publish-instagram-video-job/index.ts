import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { createInstagramVideoContainer, publishInstagramContainer } from '../_shared/instagram/publish-client.ts'
import { decryptMetaToken, loadMetaTokenKeyringFromEnvironment } from '../_shared/instagram/meta-token-crypto.ts'
import { inspectMetaCapability } from '../_shared/instagram/meta-capabilities.ts'
import { handleInstagramJobPublish, type InstagramContainerStatus } from '../social-publish-instagram-job/runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const hashCapability = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const fetchWithTimeout: typeof fetch = (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })
const VIDEO_SOURCE_TYPES = ['video_imobiliario', 'studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel', 'smart_space_transform', 'smart_space_life', 'smart_space_broker']
const graphJson = async (url: URL, token: string) => {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== 'object' || 'error' in payload) throw new Error('meta_request_failed')
  return payload as Record<string, unknown>
}

serve(request => {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const client = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })
  const graphVersion = requiredEnv('META_GRAPH_API_VERSION')
  return handleInstagramJobPublish(request, {
    expectedContentType: 'video/mp4',
    expectedInstagramUsername: null,
    getJob: async (jobId, claimToken) => {
      const { data, error } = await client.from('social_publish_jobs')
        .select('id,user_id,social_connection_id,caption_snapshot,claim_token,claim_expires_at,status,external_container_id,external_post_id,platform,source_type')
        .eq('id', jobId).eq('claim_token', claimToken).eq('platform', 'instagram')
        .in('source_type', VIDEO_SOURCE_TYPES).eq('status', 'processing').maybeSingle()
      if (error || !data || data.external_container_id || data.external_post_id || Date.parse(data.claim_expires_at) <= Date.now()) return null
      return { id: data.id, userId: data.user_id, connectionId: data.social_connection_id, caption: data.caption_snapshot || '', claimToken: data.claim_token }
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
        .select('id,user_id,connection_status,expires_at').eq('id', job.connectionId).eq('user_id', job.userId)
        .eq('provider', 'meta').eq('connection_status', 'active').maybeSingle()
      if (connectionError || !connection || Date.parse(connection.expires_at) <= Date.now()) return null
      const { data: instagram, error: instagramError } = await client.from('social_accounts')
        .select('external_account_id,parent_external_account_id,username').eq('social_connection_id', job.connectionId)
        .eq('user_id', job.userId).eq('platform', 'instagram').eq('account_status', 'active')
      if (instagramError || instagram?.length !== 1 || !instagram[0].parent_external_account_id) return null
      const { data: page, error: pageError } = await client.from('social_accounts')
        .select('external_account_id,display_name,credential_ciphertext,credential_nonce,credential_auth_tag,key_version')
        .eq('social_connection_id', job.connectionId).eq('user_id', job.userId).eq('platform', 'facebook')
        .eq('account_status', 'active').eq('external_account_id', instagram[0].parent_external_account_id).maybeSingle()
      if (pageError || !page?.credential_ciphertext || !page.credential_nonce || !page.credential_auth_tag || !page.key_version) return null
      const keyring = await loadMetaTokenKeyringFromEnvironment(name => Deno.env.get(name))
      const pageAccessToken = await decryptMetaToken({ algorithm: 'AES-256-GCM', ciphertext: page.credential_ciphertext, nonce: page.credential_nonce, authTag: page.credential_auth_tag, keyVersion: page.key_version }, keyring)
      return { instagramUserId: instagram[0].external_account_id, instagramUsername: instagram[0].username || '', pageName: page.display_name || '', pageAccessToken }
    },
    validateConnection: async account => {
      const appId = requiredEnv('META_APP_ID')
      const url = new URL(`https://graph.facebook.com/${graphVersion}/debug_token`)
      url.searchParams.set('input_token', account.pageAccessToken)
      const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${appId}|${requiredEnv('META_APP_SECRET')}` } })
      const payload = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null
      const data = payload?.data
      const scopes = new Set(Array.isArray(data?.scopes) ? data.scopes.filter((item): item is string => typeof item === 'string') : [])
      const expiresAt = typeof data?.expires_at === 'number' ? data.expires_at : 0
      return response.ok && data?.is_valid === true && data?.app_id === appId && (!expiresAt || expiresAt * 1000 > Date.now())
        && inspectMetaCapability(scopes, 'instagram_video_publish').ready
    },
    recordConnectionValidation: async job => {
      const { data: connection } = await client.from('social_connections').select('expires_at').eq('id', job.connectionId).maybeSingle()
      const { data, error } = await client.rpc('record_social_connection_validation', { p_connection_id: job.connectionId, p_expected_status: 'active', p_validation_status: 'active', p_expires_at: connection?.expires_at })
      return !error && data === true
    },
    createContainer: input => createInstagramVideoContainer({ instagramUserId: input.instagramUserId, pageAccessToken: input.pageAccessToken, videoUrl: input.imageUrl, caption: input.caption, graphApiVersion: graphVersion, fetcher: fetchWithTimeout }),
    startContainerPolling: async input => {
      const { data, error } = await client.rpc('start_social_publish_job_container_polling', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_external_container_id: input.containerId, p_next_poll_at: new Date(Date.now() + 2000).toISOString(), p_media_lease_id: input.leaseId, p_min_remaining_lease_seconds: 3600 })
      return !error && Array.isArray(data) && data.length === 1
    },
    getContainerStatus: async input => {
      const url = new URL(`https://graph.facebook.com/${graphVersion}/${input.containerId}`)
      url.searchParams.set('fields', 'status_code,status')
      const payload = await graphJson(url, input.pageAccessToken)
      const status = payload.status_code
      if (!['IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED'].includes(String(status))) throw new Error('invalid_container_status')
      return status as InstagramContainerStatus
    },
    recordPoll: async input => {
      const { data, error } = await client.rpc('record_social_publish_job_poll_result', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_expected_status: 'publishing', p_external_container_id: input.containerId, p_external_status: input.status, p_next_poll_at: input.nextPollAt || null })
      return !error && Array.isArray(data) && data.length === 1
    },
    deferPollTimeout: async input => {
      const { data, error } = await client.rpc('defer_social_publish_job_poll_timeout', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_expected_status: 'publishing', p_external_container_id: input.containerId, p_next_poll_at: input.nextPollAt })
      return !error && Array.isArray(data) && data.length === 1
    },
    publishContainer: input => publishInstagramContainer({ instagramUserId: input.instagramUserId, pageAccessToken: input.pageAccessToken, creationId: input.containerId, graphApiVersion: graphVersion, fetcher: fetchWithTimeout }),
    markReconciliationRequired: async input => {
      const { data, error } = await client.rpc('transition_claimed_social_publish_job', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_expected_status: 'publishing', p_next_status: 'reconciliation_required' })
      return !error && Array.isArray(data) && data.length === 1
    },
    getPostDetail: async input => {
      const url = new URL(`https://graph.facebook.com/${graphVersion}/${input.postId}`)
      url.searchParams.set('fields', 'id,permalink,caption,media_type,username')
      const payload = await graphJson(url, input.pageAccessToken)
      return { id: typeof payload.id === 'string' ? payload.id : '', permalink: typeof payload.permalink === 'string' ? payload.permalink : null, caption: typeof payload.caption === 'string' ? payload.caption : null, username: typeof payload.username === 'string' ? payload.username : null }
    },
    completeJob: async input => {
      const { data, error } = await client.rpc('complete_social_publish_job', { p_job_id: input.jobId, p_claim_token: input.claimToken, p_expected_status: 'publishing', p_external_container_id: input.containerId, p_external_post_id: input.postId, p_external_post_url: input.permalink })
      return !error && Array.isArray(data) && data.length === 1
    },
    log: (stage, details = {}) => console.info(JSON.stringify({ event: 'social_publish_instagram_video_job', stage, ...(typeof details.visible === 'boolean' ? { visible: details.visible } : {}) })),
  })
})

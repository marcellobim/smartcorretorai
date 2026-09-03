import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { publishFacebookPagePhoto, publishFacebookPageVideo } from '../_shared/facebook/publish-client.ts'
import {
  createInstagramImageContainer,
  createInstagramVideoContainer,
  publishInstagramContainer,
} from '../_shared/instagram/publish-client.ts'
import { decryptMetaToken, loadMetaTokenKeyringFromEnvironment } from '../_shared/instagram/meta-token-crypto.ts'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import {
  runSocialPublishWorker,
  type AutonomousSocialJob,
  type ExternalContainerStatus,
  type PublishedMatch,
} from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}
const graphVersion = () => requiredEnv('META_GRAPH_API_VERSION')
const fetchWithTimeout: typeof fetch = (input, init = {}) => fetch(input, {
  ...init,
  signal: AbortSignal.timeout(15_000),
})
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

type JobDetails = {
  id: string
  user_id: string
  social_connection_id: string
  social_account_id: string | null
  media_lease_id: string | null
  external_publish_started_at: string | null
  created_at: string
}
type ActiveAccount = {
  instagramUserId: string
  instagramUsername: string
  pageId: string
  pageName: string
  pageAccessToken: string
}

const normalize = (value: unknown) => typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : ''
const VIDEO_SOURCE_TYPES = new Set(['video_imobiliario', 'studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel', 'smart_space_transform', 'smart_space_life', 'smart_space_broker'])
const isVideo = (job: AutonomousSocialJob) => VIDEO_SOURCE_TYPES.has(job.sourceType)

serve(async request => {
  if (request.method !== 'POST') return json({ ok: false }, 405)
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const client = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })
  const workerKey = request.headers.get('x-social-worker-key') || ''
  const { data: authorized, error: authorizationError } = await client.rpc('authorize_social_publish_worker', { p_key: workerKey })
  if (authorizationError || authorized !== true) return json({ ok: false }, 401)

  const detailsCache = new Map<string, JobDetails>()
  const accountCache = new Map<string, ActiveAccount>()
  const mediaUrlCache = new Map<string, string>()

  const details = async (job: AutonomousSocialJob) => {
    const cached = detailsCache.get(job.id)
    if (cached) return cached
    const { data, error } = await client.from('social_publish_jobs')
      .select('id,user_id,social_connection_id,social_account_id,media_lease_id,external_publish_started_at,created_at')
      .eq('id', job.id).eq('claim_token', job.claimToken).maybeSingle()
    if (error || !data) throw new Error('job_unavailable')
    detailsCache.set(job.id, data as JobDetails)
    return data as JobDetails
  }

  const account = async (job: AutonomousSocialJob) => {
    const info = await details(job)
    const cached = accountCache.get(info.social_connection_id)
    if (cached) return cached
    const { data: connection, error: connectionError } = await client.from('social_connections')
      .select('id,user_id,connection_status,expires_at')
      .eq('id', info.social_connection_id).eq('user_id', info.user_id)
      .eq('provider', 'meta').eq('connection_status', 'active').maybeSingle()
    if (connectionError || !connection || Date.parse(connection.expires_at) <= Date.now()) throw new Error('social_reconnect_required')

    const { data: instagramRows, error: instagramError } = await client.from('social_accounts')
      .select('external_account_id,parent_external_account_id,username')
      .eq('social_connection_id', info.social_connection_id).eq('user_id', info.user_id)
      .eq('platform', 'instagram').eq('account_status', 'active')
    if (instagramError || instagramRows?.length !== 1 || !instagramRows[0].parent_external_account_id) throw new Error('social_account_not_connected')

    let pageQuery = client.from('social_accounts')
      .select('id,external_account_id,display_name,credential_ciphertext,credential_nonce,credential_auth_tag,key_version')
      .eq('social_connection_id', info.social_connection_id).eq('user_id', info.user_id)
      .eq('platform', 'facebook').eq('account_status', 'active')
      .eq('external_account_id', instagramRows[0].parent_external_account_id)
    if (job.platform === 'facebook' && info.social_account_id) pageQuery = pageQuery.eq('id', info.social_account_id)
    const { data: page, error: pageError } = await pageQuery.maybeSingle()
    if (pageError || !page?.credential_ciphertext || !page.credential_nonce || !page.credential_auth_tag || !page.key_version) {
      throw new Error('social_account_not_connected')
    }
    const keyring = await loadMetaTokenKeyringFromEnvironment(name => Deno.env.get(name))
    const pageAccessToken = await decryptMetaToken({
      algorithm: 'AES-256-GCM', ciphertext: page.credential_ciphertext, nonce: page.credential_nonce,
      authTag: page.credential_auth_tag, keyVersion: page.key_version,
    }, keyring)
    const resolved = {
      instagramUserId: instagramRows[0].external_account_id,
      instagramUsername: instagramRows[0].username || '',
      pageId: page.external_account_id,
      pageName: page.display_name || '',
      pageAccessToken,
    }
    accountCache.set(info.social_connection_id, resolved)
    return resolved
  }

  const mediaUrl = async (job: AutonomousSocialJob) => {
    const cached = mediaUrlCache.get(job.id)
    if (cached) return cached
    const info = await details(job)
    if (!info.media_lease_id) throw new Error('invalid_media_source')
    const { data: lease, error } = await client.from('social_media_leases')
      .select('bucket_id,object_path,content_type,content_length,status,expires_at')
      .eq('id', info.media_lease_id).eq('job_id', job.id).maybeSingle()
    if (error || !lease || !['active', 'expired'].includes(lease.status)) throw new Error('invalid_media_source')
    const expected = isVideo(job) ? 'video/mp4' : 'image/jpeg'
    if (lease.content_type !== expected || Number(lease.content_length) <= 0) throw new Error('invalid_media_source')
    const { data: signed, error: signedError } = await client.storage.from(lease.bucket_id).createSignedUrl(lease.object_path, 3600)
    if (signedError || !signed?.signedUrl) throw new Error('invalid_media_source')
    mediaUrlCache.set(job.id, signed.signedUrl)
    return signed.signedUrl
  }

  const graphGet = async (url: URL, token: string) => {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || typeof payload !== 'object' || 'error' in payload) throw new Error('meta_request_failed')
    return payload as Record<string, unknown>
  }

  const uniqueMatch = (rows: unknown[], caption: string, captionField: string, timeField: string, earliestMs: number): PublishedMatch | null => {
    const matches = rows.filter(item => {
      if (!item || typeof item !== 'object') return false
      const row = item as Record<string, unknown>
      const observedAt = Date.parse(String(row[timeField] || ''))
      return normalize(row[captionField]) === normalize(caption) && typeof row.id === 'string'
        && Number.isFinite(observedAt) && observedAt >= earliestMs
    }) as Record<string, unknown>[]
    if (matches.length !== 1) return null
    const row = matches[0]
    const permalink = typeof row.permalink === 'string' ? row.permalink
      : typeof row.permalink_url === 'string' ? row.permalink_url : null
    return { id: String(row.id), permalink }
  }

  const summary = await runSocialPublishWorker({
    claimDueJobs: async limit => {
      const { data, error } = await client.rpc('claim_due_social_publish_jobs', { p_limit: limit, p_claim_ttl_seconds: 50 })
      if (error || !Array.isArray(data)) throw new Error('claim_failed')
      return data.map(row => ({
        id: row.job_id,
        claimToken: row.worker_claim_token,
        platform: row.platform,
        sourceType: row.source_type,
        caption: row.caption_snapshot || '',
        status: row.job_status,
        containerId: row.external_container_id,
        containerStatus: row.external_container_status,
        commitStartedAt: row.external_commit_started_at,
      }))
    },
    mediaKind: job => isVideo(job) ? 'video' : 'image',
    prepareNewPublish: async job => {
      try {
        const [target, url] = await Promise.all([account(job), mediaUrl(job)])
        if (job.platform === 'instagram') {
          const containerId = isVideo(job)
            ? await createInstagramVideoContainer({ instagramUserId: target.instagramUserId, pageAccessToken: target.pageAccessToken, videoUrl: url, caption: job.caption, graphApiVersion: graphVersion(), fetcher: fetchWithTimeout })
            : await createInstagramImageContainer({ instagramUserId: target.instagramUserId, pageAccessToken: target.pageAccessToken, imageUrl: url, caption: job.caption, graphApiVersion: graphVersion(), fetcher: fetchWithTimeout })
          const { data, error } = await client.rpc('start_autonomous_instagram_container', { p_job_id: job.id, p_claim_token: job.claimToken, p_external_container_id: containerId })
          if (error || data !== true) throw new Error('container_persist_failed')
        } else {
          const { data, error } = await client.rpc('begin_autonomous_social_publish', { p_job_id: job.id, p_claim_token: job.claimToken, p_external_container_id: null })
          if (error || data !== true) throw new Error('external_guard_failed')
        }
        return 'prepared'
      } catch (error) {
        const code = error instanceof Error && ['social_reconnect_required', 'social_account_not_connected', 'invalid_media_source'].includes(error.message)
          ? error.message : 'social_publish_failed'
        await client.rpc('fail_autonomous_social_publish_job', { p_job_id: job.id, p_claim_token: job.claimToken, p_error_code: code })
        return 'terminal_failure'
      }
    },
    getContainerStatus: async job => {
      if (!job.containerId) throw new Error('container_missing')
      const target = await account(job)
      const url = new URL(`https://graph.facebook.com/${graphVersion()}/${job.containerId}`)
      url.searchParams.set('fields', 'status_code,status')
      const payload = await graphGet(url, target.pageAccessToken)
      const status = String(payload.status_code)
      if (!['IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED'].includes(status)) throw new Error('invalid_container_status')
      return status as ExternalContainerStatus
    },
    recordContainerStatus: async (job, status) => {
      const { data, error } = await client.rpc('record_autonomous_social_container_status', { p_job_id: job.id, p_claim_token: job.claimToken, p_external_status: status })
      return !error && data === true
    },
    beginInstagramCommit: async job => {
      const { data, error } = await client.rpc('begin_autonomous_social_publish', { p_job_id: job.id, p_claim_token: job.claimToken, p_external_container_id: job.containerId })
      return !error && data === true
    },
    publishInstagram: async job => {
      if (!job.containerId) throw new Error('container_missing')
      const target = await account(job)
      const postId = await publishInstagramContainer({ instagramUserId: target.instagramUserId, pageAccessToken: target.pageAccessToken, creationId: job.containerId, graphApiVersion: graphVersion(), fetcher: fetchWithTimeout })
      const detailUrl = new URL(`https://graph.facebook.com/${graphVersion()}/${postId}`)
      detailUrl.searchParams.set('fields', 'id,permalink')
      const post = await graphGet(detailUrl, target.pageAccessToken)
      return { id: postId, permalink: typeof post.permalink === 'string' ? post.permalink : null }
    },
    publishFacebook: async job => {
      const [target, url] = await Promise.all([account(job), mediaUrl(job)])
      const result = isVideo(job)
        ? await publishFacebookPageVideo({ pageId: target.pageId, pageAccessToken: target.pageAccessToken, videoUrl: url, caption: job.caption, graphApiVersion: graphVersion(), fetcher: fetchWithTimeout })
        : await publishFacebookPagePhoto({ pageId: target.pageId, pageAccessToken: target.pageAccessToken, imageUrl: url, caption: job.caption, graphApiVersion: graphVersion(), fetcher: fetchWithTimeout })
      return { id: result.postId, permalink: result.permalink }
    },
    findPublished: async job => {
      const [target, info] = await Promise.all([account(job), details(job)])
      const since = Math.floor((Date.parse(info.external_publish_started_at || info.created_at) - 120_000) / 1000)
      if (job.platform === 'instagram') {
        const url = new URL(`https://graph.facebook.com/${graphVersion()}/${target.instagramUserId}/media`)
        url.searchParams.set('fields', 'id,permalink,caption,timestamp,media_type')
        url.searchParams.set('limit', '50')
        const payload = await graphGet(url, target.pageAccessToken)
        const rows = Array.isArray(payload.data) ? payload.data.filter(item => {
          const type = item && typeof item === 'object' ? String((item as Record<string, unknown>).media_type || '') : ''
          return isVideo(job) ? type === 'VIDEO' : type === 'IMAGE' || type === 'CAROUSEL_ALBUM'
        }) : []
        return uniqueMatch(rows, job.caption, 'caption', 'timestamp', since * 1000)
      }
      const edge = isVideo(job) ? 'videos' : 'published_posts'
      const url = new URL(`https://graph.facebook.com/${graphVersion()}/${target.pageId}/${edge}`)
      url.searchParams.set('fields', isVideo(job) ? 'id,permalink_url,description,created_time' : 'id,permalink_url,message,created_time')
      url.searchParams.set('since', String(since))
      url.searchParams.set('limit', '50')
      const payload = await graphGet(url, target.pageAccessToken)
      return uniqueMatch(Array.isArray(payload.data) ? payload.data : [], job.caption, isVideo(job) ? 'description' : 'message', 'created_time', since * 1000)
    },
    complete: async (job, match) => {
      const { data, error } = await client.rpc('complete_autonomous_social_publish_job', {
        p_job_id: job.id, p_claim_token: job.claimToken, p_external_post_id: match.id, p_external_post_url: match.permalink,
      })
      return !error && data === true
    },
    defer: async job => {
      const { data, error } = await client.rpc('defer_autonomous_social_publish_job', { p_job_id: job.id, p_claim_token: job.claimToken, p_reconciliation_required: true })
      return !error && data === true
    },
    fail: async (job, code) => {
      const { data, error } = await client.rpc('fail_autonomous_social_publish_job', { p_job_id: job.id, p_claim_token: job.claimToken, p_error_code: code })
      return !error && data === true
    },
    log: (event, value = {}) => console.info(JSON.stringify({ event: `social_publish_worker_${event}`, ...value })),
  }, 4)

  return json({ ok: true, ...summary, smart_tokens: 0 })
})

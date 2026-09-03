import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizePersistedSmartTourPublicationOptions } from '../_shared/smart-tour/publication-options.ts'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { handleVideoSocialPublish, type VideoDestination, type VideoIntent, type VideoRecovery } from './runtime.ts'

const BUCKET = 'studio-videos' as const
const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const sha256 = async (value: string) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const uuidFromDigest = async (value: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const valueHex = hex(bytes)
  return `${valueHex.slice(0, 8)}-${valueHex.slice(8, 12)}-${valueHex.slice(12, 16)}-${valueHex.slice(16, 20)}-${valueHex.slice(20)}`
}
const capability = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const publicError = (value: unknown) => {
  const code = typeof value === 'string' ? value : ''
  if (['social_account_not_connected', 'social_reconnect_required', 'invalid_media_source', 'publish_timeout', 'external_container_expired'].includes(code)) return code
  return code ? 'social_publish_failed' : null
}
const STUDIO_VIDEO_MODES: Record<string, string> = {
  studio_ia_commercial: 'dynamic_reel',
  studio_ia_creative: 'free_ai',
}
const persistedOption = (value: unknown, optionId: string) => (Array.isArray(value) ? value : [])
  .find(option => option && typeof option === 'object' && String((option as Record<string, unknown>).id || '') === optionId) as Record<string, unknown> | undefined
const storageMedia = async (admin: any, prefix: string, name: string) => {
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 2, search: name })
  const media = data?.filter((object: { name?: string }) => object.name === name) || []
  const metadata = media[0]?.metadata as Record<string, unknown> | undefined
  const contentType = String(metadata?.mimetype || metadata?.contentType || '')
  const contentLength = Number(metadata?.size || 0)
  return error || media.length !== 1 || contentType !== 'video/mp4' || !Number.isSafeInteger(contentLength) || contentLength <= 0
    ? null : { contentType: 'video/mp4' as const, contentLength }
}

serve(request => {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const admin = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })
  const findJob = async (userId: string, idempotencyKey: string, destination: VideoDestination): Promise<VideoRecovery | null> => {
    const { data, error } = await admin.from('social_publish_jobs')
      .select('id,platform,status,external_post_id,external_post_url,error_code,caption_snapshot')
      .eq('user_id', userId).eq('idempotency_key', idempotencyKey).eq('platform', destination).maybeSingle()
    if (error || !data) return null
    return { jobId: data.id, destination, status: data.status, externalPostId: data.status === 'published' ? data.external_post_id : null, externalPostLink: data.status === 'published' ? data.external_post_url : null, publicErrorCode: data.status === 'failed' ? publicError(data.error_code) : null, captionSnapshot: typeof data.caption_snapshot === 'string' ? data.caption_snapshot : '' }
  }

  return handleVideoSocialPublish(request, {
    authenticate: async token => {
      const { data, error } = await admin.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },
    resolveIntent: async (userId, input) => {
      if (input.mediaAssetId !== input.sourceId) return null
      if (input.sourceType === 'studio_ia_carousel') {
        const { data: request, error } = await admin.from('smart_carousel_economy_requests')
          .select('client_request_id,user_id,status,campaign_package,video_url')
          .eq('client_request_id', input.sourceId).eq('user_id', userId).eq('status', 'succeeded').maybeSingle()
        const option = persistedOption(request?.campaign_package?.publication_options, input.optionId)
        if (error || !request || typeof option?.text !== 'string') return null
        const objectPath = `${userId}/smart-carousel/${input.sourceId}/social.mp4`
        let media = await storageMedia(admin, `${userId}/smart-carousel/${input.sourceId}`, 'social.mp4')
        if (!media) {
          const sourceUrl = String(request.video_url || '')
          if (!/^https:\/\//i.test(sourceUrl)) return null
          const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) }).catch(() => null)
          if (!response?.ok) return null
          const bytes = new Uint8Array(await response.arrayBuffer())
          if (!bytes.length || bytes.length > 52_428_800) return null
          const { error: uploadError } = await admin.storage.from(BUCKET).upload(objectPath, bytes, { contentType: 'video/mp4', upsert: false })
          if (uploadError && !/already exists|duplicate/i.test(uploadError.message || '')) return null
          media = await storageMedia(admin, `${userId}/smart-carousel/${input.sourceId}`, 'social.mp4')
        }
        if (!media) return null
        const { data: connections, error: connectionError } = await admin.from('social_connections')
          .select('id').eq('user_id', userId).eq('provider', 'meta').eq('connection_status', 'active')
        if (connectionError || connections?.length !== 1) return null
        return { sourceType: input.sourceType, sourceId: input.sourceId, mediaAssetId: input.mediaAssetId, optionId: input.optionId, captionSnapshot: input.captionSnapshot ?? option.text, connectionId: connections[0].id, bucket: BUCKET, objectPath, ...media } satisfies VideoIntent
      }

      const studioMode = STUDIO_VIDEO_MODES[input.sourceType]
      if (studioMode) {
        const expectedPath = `${userId}/${input.sourceId}/video.mp4`
        const { data: job, error: jobError } = await admin.from('video_jobs')
          .select('id,user_id,status,mode,output_video_path,publication_options')
          .eq('id', input.sourceId).eq('user_id', userId).eq('status', 'completed')
          .eq('mode', studioMode).eq('output_video_path', expectedPath).maybeSingle()
        const option = persistedOption(job?.publication_options, input.optionId)
        const media = await storageMedia(admin, `${userId}/${input.sourceId}`, 'video.mp4')
        if (jobError || !job || !media || typeof option?.text !== 'string') return null
        const { data: connections, error: connectionError } = await admin.from('social_connections')
          .select('id').eq('user_id', userId).eq('provider', 'meta').eq('connection_status', 'active')
        if (connectionError || connections?.length !== 1) return null
        return { sourceType: input.sourceType, sourceId: input.sourceId, mediaAssetId: input.mediaAssetId, optionId: input.optionId, captionSnapshot: input.captionSnapshot ?? option.text, connectionId: connections[0].id, bucket: BUCKET, objectPath: expectedPath, ...media } satisfies VideoIntent
      }

      if (input.sourceType !== 'video_imobiliario') return null
      const expectedPath = `${userId}/${input.sourceId}/smart-tour.mp4`
      const { data: job, error: jobError } = await admin.from('video_jobs')
        .select('id,user_id,status,mode,output_video_path,publication_options,output_media_metadata')
        .eq('id', input.sourceId).eq('user_id', userId).eq('status', 'completed')
        .eq('mode', 'smart_tour_gemini_omni').eq('output_video_path', expectedPath).maybeSingle()
      if (jobError || !job || job.output_media_metadata?.mime_type !== 'video/mp4') return null
      const selectedOption = normalizePersistedSmartTourPublicationOptions(job.publication_options).find(option => option.id === input.optionId)
      if (!selectedOption?.text) return null

      const { data: objects, error: objectError } = await admin.storage.from(BUCKET).list(`${userId}/${input.sourceId}`, { limit: 2, search: 'smart-tour.mp4' })
      const media = objects?.filter(object => object.name === 'smart-tour.mp4') || []
      const metadata = media[0]?.metadata as Record<string, unknown> | undefined
      const contentType = String(metadata?.mimetype || metadata?.contentType || '')
      const contentLength = Number(metadata?.size || 0)
      if (objectError || media.length !== 1 || contentType !== 'video/mp4' || !Number.isSafeInteger(contentLength) || contentLength <= 0) return null
      const { data: connections, error: connectionError } = await admin.from('social_connections')
        .select('id').eq('user_id', userId).eq('provider', 'meta').eq('connection_status', 'active')
      if (connectionError || connections?.length !== 1) return null
      return { sourceType: input.sourceType, sourceId: input.sourceId, mediaAssetId: input.mediaAssetId, optionId: input.optionId, captionSnapshot: input.captionSnapshot ?? selectedOption.text, connectionId: connections[0].id, bucket: BUCKET, objectPath: expectedPath, contentType: 'video/mp4', contentLength } satisfies VideoIntent
    },
    deriveIdempotencyKey: (userId, intent, destination) => uuidFromDigest(JSON.stringify({ v: 1, userId, destination, sourceType: intent.sourceType, sourceId: intent.sourceId, mediaAssetId: intent.mediaAssetId, optionId: intent.optionId })),
    createOrReuseJob: async ({ userId, intent, destination, idempotencyKey }) => {
      const rpc = intent.sourceType === 'video_imobiliario' ? 'create_or_reuse_video_social_publish_job' : 'create_or_reuse_studio_social_publish_job'
      const args = { p_user_id: userId, p_social_connection_id: intent.connectionId, p_platform: destination, p_idempotency_key: idempotencyKey, p_source_id: intent.sourceId, p_media_asset_id: intent.mediaAssetId, p_option_id: intent.optionId, p_caption: intent.captionSnapshot, ...(intent.sourceType === 'video_imobiliario' ? {} : { p_source_type: intent.sourceType }) }
      const { data, error } = await admin.rpc(rpc, args)
      const row = Array.isArray(data) ? data[0] : null
      return error || !row ? null : { id: row.job_id, status: row.job_status, reused: row.reused === true }
    },
    findJob,
    claimJob: async jobId => {
      const { data, error } = await admin.rpc('claim_social_publish_job', { p_job_id: jobId, p_claim_ttl_seconds: 900 })
      const row = Array.isArray(data) ? data[0] : null
      return error || !row ? null : { jobId: row.job_id, claimToken: row.worker_claim_token }
    },
    createLease: async ({ jobId, intent, capabilityHash }) => {
      const { data, error } = await admin.rpc('create_or_reuse_social_media_lease', { p_job_id: jobId, p_bucket_id: intent.bucket, p_object_path: intent.objectPath, p_content_type: intent.contentType, p_content_length: intent.contentLength, p_opaque_token_hash: capabilityHash, p_ttl_seconds: 86400, p_required_external_window_seconds: 7200 })
      return !error && Array.isArray(data) && data.length === 1
    },
    hashCapability: sha256,
    randomCapability: capability,
    invokeWorker: async ({ destination, jobId, claimToken, capability: leaseCapability }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/social-publish-${destination}-video-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, claim_token: claimToken, lease_capability: leaseCapability }), signal: AbortSignal.timeout(60_000) })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      return { ok: response.ok && payload?.ok === true, code: typeof payload?.code === 'string' ? payload.code : undefined }
    },
    log: (stage, details = {}) => console.info(JSON.stringify({ event: 'social_publish_video', stage, destination: details.destination || null })),
  })
})

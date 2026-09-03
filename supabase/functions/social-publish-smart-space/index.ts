import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { handleSmartSpacePublish, type SmartSpaceDestination, type SmartSpaceIntent, type SmartSpaceRecovery } from './runtime.ts'

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
  const digest = hex(bytes)
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`
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
const storageMedia = async (admin: any, objectPath: string, expectedType: 'image/jpeg' | 'video/mp4') => {
  const separator = objectPath.lastIndexOf('/')
  const prefix = objectPath.slice(0, separator)
  const name = objectPath.slice(separator + 1)
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 2, search: name })
  const media = data?.filter((object: { name?: string }) => object.name === name) || []
  const metadata = media[0]?.metadata as Record<string, unknown> | undefined
  const contentType = String(metadata?.mimetype || metadata?.contentType || '')
  const contentLength = Number(metadata?.size || 0)
  return error || media.length !== 1 || contentType !== expectedType || !Number.isSafeInteger(contentLength) || contentLength <= 0
    ? null : { contentType: expectedType, contentLength }
}

serve(request => {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const admin = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })
  const findJob = async (userId: string, idempotencyKey: string, destination: SmartSpaceDestination): Promise<SmartSpaceRecovery | null> => {
    const { data, error } = await admin.from('social_publish_jobs')
      .select('id,platform,status,external_post_id,external_post_url,error_code,caption_snapshot')
      .eq('user_id', userId).eq('idempotency_key', idempotencyKey).eq('platform', destination).maybeSingle()
    if (error || !data) return null
    return { jobId: data.id, destination, status: data.status, externalPostId: data.status === 'published' ? data.external_post_id : null, externalPostLink: data.status === 'published' ? data.external_post_url : null, publicErrorCode: data.status === 'failed' ? publicError(data.error_code) : null, captionSnapshot: typeof data.caption_snapshot === 'string' ? data.caption_snapshot : '' }
  }

  return handleSmartSpacePublish(request, {
    authenticate: async token => {
      const { data, error } = await admin.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },
    resolveIntent: async (userId, input) => {
      let objectPath = ''
      let contentType: 'image/jpeg' | 'video/mp4'
      if (input.sourceType === 'smart_space_image') {
        const [itemIndex, stageKind] = input.mediaAssetId.split(':')
        const { data: requestRow, error: requestError } = await admin.from('virtual_staging_image_requests')
          .select('id').eq('user_id', userId).eq('client_request_id', input.sourceId).eq('status', 'completed').maybeSingle()
        if (requestError || !requestRow) throw new Error('smart_space_image_request_invalid')
        const { data: item, error: itemError } = await admin.from('virtual_staging_image_items')
          .select('id,status,result').eq('item_index', Number(itemIndex)).eq('request_id', requestRow.id).eq('status', 'completed').maybeSingle()
        const stages = Array.isArray(item?.result?.stages) ? item.result.stages : []
        const stage = stages.find((entry: Record<string, unknown>) => String(entry?.kind || '') === stageKind)
        objectPath = String(stage?.output_path || '')
        if (itemError || !item || !objectPath.startsWith(`${userId}/virtual-staging-images/results/${item.id}/`)) throw new Error('smart_space_image_item_invalid')
        contentType = 'image/jpeg'
      } else if (input.sourceType === 'smart_space_transform') {
        const itemIndex = Number(input.mediaAssetId.split(':')[0])
        const { data: requestRow, error: requestError } = await admin.from('virtual_staging_image_requests')
          .select('id').eq('user_id', userId).eq('client_request_id', input.sourceId).eq('status', 'completed').maybeSingle()
        if (requestError || !requestRow) throw new Error('smart_space_transform_request_invalid')
        const expectedPath = `${userId}/virtual-staging-images/outputs/${input.sourceId}/${String(itemIndex + 1).padStart(2, '0')}-transformation.mp4`
        const { data: item, error: itemError } = await admin.from('virtual_staging_image_items')
          .select('id,video_state,video_output_path').eq('item_index', itemIndex).eq('request_id', requestRow.id)
          .eq('status', 'completed').eq('video_state', 'completed').maybeSingle()
        objectPath = String(item?.video_output_path || '')
        if (itemError || !item || objectPath !== expectedPath) throw new Error('smart_space_transform_item_invalid')
        contentType = 'video/mp4'
      } else {
        const productCode = input.sourceType === 'smart_space_life' ? 'life_in_property' : 'broker_presentation'
        const expectedPath = `${userId}/${input.sourceId}/virtual-staging.mp4`
        const { data: economy, error: economyError } = await admin.from('gemini_video_economy_requests')
          .select('client_request_id').eq('user_id', userId).eq('client_request_id', input.sourceId)
          .eq('product_code', productCode).eq('status', 'completed').maybeSingle()
        const { data: job, error: jobError } = await admin.from('video_jobs')
          .select('id').eq('id', input.sourceId).eq('user_id', userId).eq('status', 'completed')
          .eq('mode', 'virtual_staging_gemini_omni').eq('output_video_path', expectedPath).maybeSingle()
        if (economyError || !economy) throw new Error('smart_space_video_economy_invalid')
        if (jobError || !job) throw new Error('smart_space_video_job_invalid')
        objectPath = expectedPath
        contentType = 'video/mp4'
      }
      const media = await storageMedia(admin, objectPath, contentType)
      if (!media) throw new Error('smart_space_media_storage_invalid')
      const { data: connections, error: connectionError } = await admin.from('social_connections')
        .select('id').eq('user_id', userId).eq('provider', 'meta').eq('connection_status', 'active')
      if (connectionError || connections?.length !== 1) throw new Error('smart_space_social_connection_invalid')
      return { ...input, connectionId: connections[0].id, bucket: BUCKET, objectPath, ...media } satisfies SmartSpaceIntent
    },
    deriveIdempotencyKey: (userId, intent, destination) => uuidFromDigest(JSON.stringify({ v: 1, userId, destination, sourceType: intent.sourceType, sourceId: intent.sourceId, mediaAssetId: intent.mediaAssetId, optionId: intent.optionId })),
    createOrReuseJob: async ({ userId, intent, destination, idempotencyKey }) => {
      const { data, error } = await admin.rpc('create_or_reuse_smart_space_social_publish_job_v2', {
        p_user_id: userId, p_social_connection_id: intent.connectionId, p_platform: destination,
        p_idempotency_key: idempotencyKey, p_source_type: intent.sourceType, p_source_id: intent.sourceId,
        p_media_asset_id: intent.mediaAssetId, p_option_id: intent.optionId, p_caption: intent.captionSnapshot,
      })
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
    invokeWorker: async ({ destination, intent, jobId, claimToken, capability: leaseCapability }) => {
      const videoSegment = intent.contentType === 'video/mp4' ? '-video' : ''
      const response = await fetch(`${supabaseUrl}/functions/v1/social-publish-${destination}${videoSegment}-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId, claim_token: claimToken, lease_capability: leaseCapability }), signal: AbortSignal.timeout(60_000) })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      return { ok: response.ok && payload?.ok === true, code: typeof payload?.code === 'string' ? payload.code : undefined }
    },
    log: (stage, details = {}) => console.info(JSON.stringify({ event: 'social_publish_smart_space', stage, destination: details.destination || null, media: details.media || null })),
  })
})

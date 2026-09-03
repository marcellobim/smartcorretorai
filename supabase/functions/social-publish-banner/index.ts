import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildPersistedBannerPublicationOptions } from '../_shared/banner-publication-options.ts'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { handleBannerSocialPublish, type BannerDestination, type BannerIntent, type BannerRecovery } from './runtime.ts'

const BUCKET = 'smartcorretor-assets'

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

serve(request => {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '')
  const admin = createClient(supabaseUrl, resolveSupabaseAdminCredential().key, { auth: { persistSession: false } })

  const findJob = async (userId: string, idempotencyKey: string, destination: BannerDestination): Promise<BannerRecovery | null> => {
    const { data, error } = await admin.from('social_publish_jobs')
      .select('id,platform,status,external_post_id,external_post_url,error_code,caption_snapshot')
      .eq('user_id', userId).eq('idempotency_key', idempotencyKey).eq('platform', destination).maybeSingle()
    if (error || !data) return null
    return {
      jobId: data.id,
      destination,
      status: data.status,
      externalPostId: data.status === 'published' ? data.external_post_id : null,
      externalPostLink: data.status === 'published' ? data.external_post_url : null,
      publicErrorCode: data.status === 'failed' ? publicError(data.error_code) : null,
      captionSnapshot: typeof data.caption_snapshot === 'string' ? data.caption_snapshot : '',
    }
  }

  return handleBannerSocialPublish(request, {
    authenticate: async token => {
      const { data, error } = await admin.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },
    resolveIntent: async (userId, input) => {
      const optionNumber = Number(input.optionId.match(/([1-3])$/)?.[1] || 0)
      const { data: requestRow, error: requestError } = await admin.from('real_estate_banner_requests')
        .select('id').eq('user_id', userId).eq('client_request_id', input.sourceId)
        .eq('product_code', 'real_estate_banner').maybeSingle()
      if (requestError || !requestRow) return null

      const { data: item, error: itemError } = await admin.from('real_estate_banner_items')
        .select('generation_id,piece_id,creation_option,status').eq('request_id', requestRow.id)
        .eq('piece_id', input.mediaAssetId).eq('creation_option', optionNumber).eq('status', 'completed').maybeSingle()
      if (itemError || !item?.generation_id) return null

      const expectedPath = `${userId}/hero-ia-next/${item.generation_id}/hero-principal.jpg`
      const { data: generation, error: generationError } = await admin.from('hero_generations')
        .select('id,user_id,status,image_storage_path,prompt_briefing').eq('id', item.generation_id)
        .eq('user_id', userId).eq('status', 'completed').eq('image_storage_path', expectedPath).maybeSingle()
      if (generationError || !generation) return null
      const selectedOption = buildPersistedBannerPublicationOptions(generation.prompt_briefing)
        .find(option => option.id === input.optionId)
      if (!selectedOption?.text) return null

      const folder = `${userId}/hero-ia-next/${item.generation_id}`
      const { data: objects, error: objectError } = await admin.storage.from(BUCKET).list(folder, {
        limit: 2, search: 'hero-principal.jpg',
      })
      const media = objects?.filter(object => object.name === 'hero-principal.jpg') || []
      const metadata = media[0]?.metadata as Record<string, unknown> | undefined
      const contentType = String(metadata?.mimetype || metadata?.contentType || '')
      const contentLength = Number(metadata?.size || 0)
      if (objectError || media.length !== 1 || contentType !== 'image/jpeg' || !Number.isSafeInteger(contentLength) || contentLength <= 0) return null

      const { data: connections, error: connectionError } = await admin.from('social_connections')
        .select('id').eq('user_id', userId).eq('provider', 'meta').eq('connection_status', 'active')
      if (connectionError || connections?.length !== 1) return null
      return {
        sourceId: input.sourceId,
        mediaAssetId: input.mediaAssetId,
        optionId: input.optionId,
        captionSnapshot: input.captionSnapshot ?? selectedOption.text,
        connectionId: connections[0].id,
        bucket: BUCKET,
        objectPath: expectedPath,
        contentType: 'image/jpeg',
        contentLength,
      } satisfies BannerIntent
    },
    deriveIdempotencyKey: (userId, intent, destination) => uuidFromDigest(JSON.stringify({
      v: 1, userId, destination, sourceId: intent.sourceId, mediaAssetId: intent.mediaAssetId,
      optionId: intent.optionId,
    })),
    createOrReuseJob: async ({ userId, intent, destination, idempotencyKey }) => {
      const { data, error } = await admin.rpc('create_or_reuse_banner_social_publish_job', {
        p_user_id: userId,
        p_social_connection_id: intent.connectionId,
        p_platform: destination,
        p_idempotency_key: idempotencyKey,
        p_source_id: intent.sourceId,
        p_media_asset_id: intent.mediaAssetId,
        p_option_id: intent.optionId,
        p_caption: intent.captionSnapshot,
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
      const { data, error } = await admin.rpc('create_or_reuse_social_media_lease', {
        p_job_id: jobId,
        p_bucket_id: intent.bucket,
        p_object_path: intent.objectPath,
        p_content_type: intent.contentType,
        p_content_length: intent.contentLength,
        p_opaque_token_hash: capabilityHash,
        p_ttl_seconds: 86400,
        p_required_external_window_seconds: 7200,
      })
      return !error && Array.isArray(data) && data.length === 1
    },
    hashCapability: sha256,
    randomCapability: capability,
    invokeWorker: async ({ destination, jobId, claimToken, capability: leaseCapability }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/social-publish-${destination}-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, claim_token: claimToken, lease_capability: leaseCapability }),
        signal: AbortSignal.timeout(60_000),
      })
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null
      return { ok: response.ok && payload?.ok === true, code: typeof payload?.code === 'string' ? payload.code : undefined }
    },
    log: (stage, details = {}) => console.info(JSON.stringify({ event: 'social_publish_banner', stage, destination: details.destination || null })),
  })
})

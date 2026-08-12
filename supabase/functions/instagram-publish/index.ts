import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  createInstagramImageContainer,
  publishInstagramContainer,
} from '../_shared/instagram/publish-client.ts'
import { handleInstagramPublish, type InstagramPublishRuntimeDependencies } from './runtime.ts'

const HERO_BUCKET = 'smartcorretor-assets'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

const normalizeMimeType = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object') return ''
  const record = metadata as Record<string, unknown>
  const value = record.mimetype ?? record.contentType
  return typeof value === 'string' ? value.toLowerCase().split(';')[0].trim() : ''
}

const safeLog = (
  stage: Parameters<NonNullable<InstagramPublishRuntimeDependencies['log']>>[0],
  details: Record<string, unknown> = {},
) => {
  const allowed: Record<string, unknown> = { event: 'instagram_publish', stage }
  if (typeof details.caption_present === 'boolean') allowed.caption_present = details.caption_present
  for (const key of ['http_status', 'meta_code', 'meta_subcode'] as const) {
    if (Number.isInteger(details[key])) allowed[key] = details[key]
  }
  console.info(JSON.stringify(allowed))
}

serve(request => {
  const client = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  const graphApiVersion = requiredEnv('META_GRAPH_API_VERSION')

  return handleInstagramPublish(request, {
    authenticate: async token => {
      const { data, error } = await client.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },
    getConnection: async userId => {
      const { data, error } = await client
        .from('social_connections')
        .select('page_access_token,ig_user_id,token_expires_at')
        .eq('user_id', userId)
        .eq('platform', 'instagram')
        .maybeSingle()
      if (error || !data) return null
      const expiresAt = typeof data.token_expires_at === 'string' ? Date.parse(data.token_expires_at) : Number.NaN
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return { instagramUserId: '', pageAccessToken: '', reconnectRequired: true }
      }
      if (typeof data.ig_user_id !== 'string' || typeof data.page_access_token !== 'string') return null
      return { instagramUserId: data.ig_user_id, pageAccessToken: data.page_access_token }
    },
    resolveMedia: async (userId, sourceId) => {
      const { data, error } = await client
        .from('hero_generations')
        .select('id,user_id,status,image_storage_path')
        .eq('id', sourceId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error || !data || data.status !== 'completed' || typeof data.image_storage_path !== 'string') return null

      const escapedUser = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedSource = sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const expectedPath = new RegExp(`^${escapedUser}/hero-ia-next/${escapedSource}/hero-principal\\.(?:jpe?g|png)$`, 'i')
      if (!expectedPath.test(data.image_storage_path)) return null

      const separator = data.image_storage_path.lastIndexOf('/')
      const folder = data.image_storage_path.slice(0, separator)
      const filename = data.image_storage_path.slice(separator + 1)
      const { data: objects, error: storageError } = await client.storage.from(HERO_BUCKET).list(folder, {
        limit: 10,
        search: filename,
      })
      if (storageError) return null
      const object = objects?.find(item => item.name === filename)
      const mimeType = normalizeMimeType(object?.metadata)
      if (!['image/jpeg', 'image/png'].includes(mimeType)) return null
      return { bucket: HERO_BUCKET, path: data.image_storage_path, mimeType }
    },
    createSignedUrl: async (bucket, path, expiresInSeconds) => {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
      if (error || !data?.signedUrl) throw new Error('signed_url_failed')
      return data.signedUrl
    },
    claimPublication: async input => {
      const { data, error } = await client
        .from('instagram_publications')
        .insert({
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          source_type: 'hero_generation',
          source_id: input.sourceId,
          status: 'processing',
        })
        .select('id')
        .single()
      if (!error && data?.id) return { kind: 'created' as const, publicationId: data.id }
      if (error?.code !== '23505') throw new Error('publication_claim_failed')
      const { data: existing, error: existingError } = await client
        .from('instagram_publications')
        .select('status,error_code,source_id')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.idempotencyKey)
        .single()
      if (existingError || !existing) throw new Error('publication_claim_failed')
      return { kind: 'existing' as const, status: existing.status, sourceId: existing.source_id, errorCode: existing.error_code }
    },
    markPublishing: async (userId, publicationId, containerId) => {
      const { data, error } = await client
        .from('instagram_publications')
        .update({ status: 'publishing', instagram_container_id: containerId, error_code: null })
        .eq('id', publicationId)
        .eq('user_id', userId)
        .eq('status', 'processing')
        .select('id')
        .single()
      if (error || !data) throw new Error('publication_update_failed')
    },
    markPublished: async (userId, publicationId, postId) => {
      const { data, error } = await client
        .from('instagram_publications')
        .update({ status: 'published', instagram_post_id: postId, error_code: null })
        .eq('id', publicationId)
        .eq('user_id', userId)
        .eq('status', 'publishing')
        .select('id')
        .single()
      if (error || !data) throw new Error('publication_update_failed')
    },
    markFailed: async (userId, publicationId, errorCode) => {
      const { data, error } = await client
        .from('instagram_publications')
        .update({ status: 'failed', error_code: errorCode })
        .eq('id', publicationId)
        .eq('user_id', userId)
        .eq('status', 'processing')
        .select('id')
        .single()
      if (error || !data) throw new Error('publication_update_failed')
    },
    createContainer: input => createInstagramImageContainer({ ...input, graphApiVersion }),
    publishContainer: input => publishInstagramContainer({ ...input, graphApiVersion }),
    log: safeLog,
  })
})

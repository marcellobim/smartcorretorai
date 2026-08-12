import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withCors } from '../_shared/cors.ts'
import { handleCreationDownload } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

serve(withCors(request => {
  const client = createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  return handleCreationDownload(request, {
    authenticate: async token => {
      const { data, error } = await client.auth.getUser(token)
      return error || !data.user ? null : { id: data.user.id }
    },
    getCreation: async (creationId, userId) => {
      const { data, error } = await client
        .from('creations')
        .select('id,user_id,delivery_kind,result_manifest,expires_at,downloaded_at,deleted_at')
        .eq('id', creationId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw new Error('creation_lookup_failed')
      return data
    },
    createSignedUrl: async (bucket, path, expiresInSeconds) => {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
      if (error || !data?.signedUrl) throw new Error('creation_sign_failed')
      return data.signedUrl
    },
    confirmCreation: async (creationId, userId, downloadedAt) => {
      const { data, error } = await client
        .from('creations')
        .update({ downloaded_at: downloadedAt })
        .eq('id', creationId)
        .eq('user_id', userId)
        .is('downloaded_at', null)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw new Error('creation_confirm_failed')
      if (data) return 'confirmed'

      const { data: existing, error: existingError } = await client
        .from('creations')
        .select('downloaded_at,deleted_at')
        .eq('id', creationId)
        .eq('user_id', userId)
        .maybeSingle()
      if (existingError) throw new Error('creation_confirm_lookup_failed')
      return existing?.downloaded_at && !existing.deleted_at ? 'already_confirmed' : 'unavailable'
    },
    log: (_event, details) => console.info(JSON.stringify({ event: 'creation_download', ...details })),
  })
}))

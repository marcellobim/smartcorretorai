import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { handleSocialMediaLease } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

serve(request => {
  const client = createClient(
    requiredEnv('SUPABASE_URL'),
    resolveSupabaseAdminCredential().key,
    { auth: { persistSession: false } },
  )

  return handleSocialMediaLease(request, {
    findLeaseByHash: async hash => {
      const { data, error } = await client
        .from('social_media_leases')
        .select('id,job_id,user_id,bucket_id,object_path,content_type,content_length,opaque_token_hash,status,created_at,expires_at')
        .eq('opaque_token_hash', hash)
        .maybeSingle()
      if (error) throw new Error('lease_lookup_failed')
      return data
    },
    findJob: async jobId => {
      const { data, error } = await client
        .from('social_publish_jobs')
        .select('id,user_id,status,media_lease_id')
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw new Error('job_lookup_failed')
      return data
    },
    getBucket: async bucketId => {
      const { data, error } = await client.storage.getBucket(bucketId)
      if (error || !data) return null
      return { id: data.id, public: Boolean(data.public) }
    },
    downloadObject: async (bucketId, objectPath) => {
      const { data, error } = await client.storage.from(bucketId).download(objectPath)
      return error || !data ? null : data
    },
    log: (_event, details) => console.info(JSON.stringify({ event: 'social_media_lease', ...details })),
  })
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authorizeSupabaseAdminRequest,
  resolveSupabaseAdminCredential,
} from '../_shared/supabase-admin-credential.ts'
import {
  parseShortVideoInputPath,
  runShortVideoOrphanCleanup,
  SHORT_VIDEOS_INPUT_BUCKET,
  type ShortVideoInputObject,
} from '../_shared/smart-tour/short-video-orphan-cleanup.ts'

const MAX_OBJECTS_PER_RUN = 500
const PAGE_SIZE = 100

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

serve(async req => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)
  let credential
  try {
    credential = resolveSupabaseAdminCredential()
  } catch {
    return json({ ok: false, error: 'configuration_unavailable' }, 500)
  }
  const authorizedSource = authorizeSupabaseAdminRequest(req.headers, credential)
  if (!authorizedSource) {
    return json({ ok: false, error: 'forbidden' }, 403)
  }
  if (new URL(req.url).searchParams.get('probe') === 'credential') {
    return json({ ok: true, credentialSource: authorizedSource })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = credential.key
  if (!url || !key) return json({ ok: false, error: 'configuration_unavailable' }, 500)

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  async function listAll(prefix: string) {
    const entries: Array<{ name: string; created_at?: string }> = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET)
        .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw new Error('storage_list_failed')
      entries.push(...(data || []))
      if (!data || data.length < PAGE_SIZE) break
    }
    return entries
  }

  try {
    const candidates: ShortVideoInputObject[] = []
    const userFolders = await listAll('')
    for (const userFolder of userFolders) {
      const userId = userFolder.name
      const requestFolders = await listAll(`${userId}/short-videos`)
      for (const requestFolder of requestFolders) {
        const requestId = requestFolder.name
        const prefix = `${userId}/short-videos/${requestId}`
        const files = await listAll(prefix)
        const input = files.find(file => file.name === 'input.mp4')
        const name = `${prefix}/input.mp4`
        if (!input?.created_at || !parseShortVideoInputPath(name)) continue
        candidates.push({ bucketId: SHORT_VIDEOS_INPUT_BUCKET, name, createdAt: input.created_at })
        if (candidates.length >= MAX_OBJECTS_PER_RUN) break
      }
      if (candidates.length >= MAX_OBJECTS_PER_RUN) break
    }

    const summary = await runShortVideoOrphanCleanup({
      objects: candidates,
      getJob: async ({ userId, requestId }) => {
        const { data, error } = await supabase.from('video_jobs')
          .select('status')
          .eq('id', requestId)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw new Error('video_job_lookup_failed')
        return data ? { status: String(data.status || '') } : null
      },
      removeObject: async name => {
        const { error } = await supabase.storage.from(SHORT_VIDEOS_INPUT_BUCKET).remove([name])
        if (error) throw new Error('storage_remove_failed')
      },
      log: event => console.warn('[short-videos-cleanup]', event),
    })

    console.info('[short-videos-cleanup] completed', JSON.stringify(summary))
    return json({ ok: true, ...summary })
  } catch {
    console.error('[short-videos-cleanup] run_failed')
    return json({ ok: false, error: 'cleanup_failed' }, 500)
  }
})

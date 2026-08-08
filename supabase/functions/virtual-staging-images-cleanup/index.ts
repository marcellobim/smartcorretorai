import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isVirtualStagingImageUuid,
  parseVirtualStagingImagePath,
  runVirtualStagingImageCleanup,
  VIRTUAL_STAGING_IMAGE_BUCKET,
  VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES,
  VIRTUAL_STAGING_IMAGE_NAMESPACE,
  type VirtualStagingImageObject,
} from '../_shared/virtual-staging/image-storage-cleanup.ts'

const PAGE_SIZE = 100
const MAX_LIST_CALLS_PER_RUN = 2_000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function readJwtRole(authorization: string | null) {
  try {
    const token = String(authorization || '').replace(/^Bearer\s+/i, '')
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return ''
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')
    return String(JSON.parse(atob(normalized))?.role || '')
  } catch {
    return ''
  }
}

serve(async req => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)
  if (readJwtRole(req.headers.get('authorization')) !== 'service_role') {
    return json({ ok: false, error: 'forbidden' }, 403)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ ok: false, error: 'configuration_unavailable' }, 500)

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  let listCalls = 0

  async function listAll(prefix: string) {
    const entries: Array<{ name: string; created_at?: string }> = []
    for (let offset = 0; listCalls < MAX_LIST_CALLS_PER_RUN; offset += PAGE_SIZE) {
      listCalls += 1
      const { data, error } = await supabase.storage.from(VIRTUAL_STAGING_IMAGE_BUCKET)
        .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw new Error('storage_list_failed')
      entries.push(...(data || []))
      if (!data || data.length < PAGE_SIZE) break
    }
    if (listCalls >= MAX_LIST_CALLS_PER_RUN) throw new Error('storage_scan_limit_reached')
    return entries
  }

  const summary = await runVirtualStagingImageCleanup({
    listObjects: async () => {
      const candidates: VirtualStagingImageObject[] = []
      const userFolders = await listAll('')

      for (const userFolder of userFolders) {
        const userId = userFolder.name
        if (!isVirtualStagingImageUuid(userId)) continue

        for (const kind of ['inputs', 'results'] as const) {
          const kindPrefix = `${userId}/${VIRTUAL_STAGING_IMAGE_NAMESPACE}/${kind}`
          const objectFolders = await listAll(kindPrefix)
          for (const objectFolder of objectFolders) {
            if (!isVirtualStagingImageUuid(objectFolder.name)) continue
            const objectPrefix = `${kindPrefix}/${objectFolder.name}`
            const files = await listAll(objectPrefix)
            for (const file of files) {
              if (!file.created_at) continue
              const name = `${objectPrefix}/${file.name}`
              if (!parseVirtualStagingImagePath(name)) continue
              candidates.push({ bucketId: VIRTUAL_STAGING_IMAGE_BUCKET, name, createdAt: file.created_at })
              if (candidates.length >= VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES) return candidates
            }
          }
        }
      }

      return candidates
    },
    removeObject: async name => {
      const { error } = await supabase.storage.from(VIRTUAL_STAGING_IMAGE_BUCKET).remove([name])
      if (error) throw new Error('storage_remove_failed')
    },
    log: event => console.warn('[virtual-staging-images-cleanup]', event),
  })

  if (summary.listingFailed) {
    console.error('[virtual-staging-images-cleanup] run_failed')
    return json({ ok: false, error: 'cleanup_failed' }, 500)
  }

  console.info('[virtual-staging-images-cleanup] completed', JSON.stringify(summary))
  return json({ ok: true, ...summary })
})

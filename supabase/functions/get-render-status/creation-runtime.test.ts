import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  BannersRapidosCreationError,
  buildBannersRapidosTitle,
  fetchCompletedBanner,
  registerBannersRapidosCreation,
} from './creation-runtime.ts'

const functionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const indexSource = readFileSync(path.join(functionRoot, 'index.ts'), 'utf8')
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const campaignId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const creationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const completedAt = '2026-08-13T14:30:00.000Z'
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

function response(bytes = jpeg, contentType = 'image/jpeg', status = 200) {
  return new Response(bytes, {
    status,
    headers: { 'content-type': contentType, 'content-length': String(bytes.byteLength) },
  })
}

function completedRender(overrides: Record<string, unknown> = {}) {
  return {
    render_id: 'render_12345678',
    status: 'succeeded',
    url: 'https://f002.backblazeb2.com/file/creatomate-c8xg3hsxdu/test.jpg',
    ...overrides,
  }
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: campaignId,
    dados_imovel: {
      schema_version: 'campaign_property_input_v1',
      tipo: 'Apartamento',
      bairro: 'Vila Mariana',
      cidade: 'São Paulo',
    },
    ...overrides,
  }
}

class FakeSupabase {
  record: any = null
  insertions = 0
  uploads: Array<Record<string, unknown>> = []
  uploadError: unknown = null

  storage = {
    from: (bucket: string) => ({
      upload: async (storagePath: string, bytes: Uint8Array, options: Record<string, unknown>) => {
        this.uploads.push({ bucket, path: storagePath, bytes, options })
        return { error: this.uploadError }
      },
    }),
  }

  from(table: string) {
    assert.equal(table, 'creations')
    return {
      select: () => {
        const chain: any = {
          eq: () => chain,
          maybeSingle: async () => ({ data: this.record, error: null }),
        }
        return chain
      },
      insert: (input: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            this.insertions += 1
            this.record = {
              ...input,
              id: creationId,
              expires_at: '2026-08-14T14:30:00.000Z',
              downloaded_at: null,
              deleted_at: null,
            }
            return { data: this.record, error: null }
          },
        }),
      }),
    }
  }
}

test('builds a trusted Banners Rápidos title from persisted property input', () => {
  assert.equal(buildBannersRapidosTitle(campaign()), 'Apartamento em Vila Mariana')
  assert.equal(buildBannersRapidosTitle(campaign({ dados_imovel: { schema_version: 'campaign_property_input_v1', tipo: 'Casa', cidade: 'Recife' } })), 'Casa em Recife')
  assert.equal(buildBannersRapidosTitle(campaign({ dados_imovel: { schema_version: 'legacy', tipo: 'Casa' } })), null)
})

test('downloads only completed HTTPS Creatomate assets and validates JPEG bytes', async () => {
  let requestedUrl = ''
  const result = await fetchCompletedBanner(completedRender(), async input => {
    requestedUrl = String(input)
    return response()
  })
  assert.match(requestedUrl, /^https:\/\/f002\.backblazeb2\.com\//)
  assert.equal(result.mimeType, 'image/jpeg')
  assert.equal(result.extension, 'jpg')
  assert.equal(result.sizeBytes, jpeg.byteLength)
})

test('rejects pending/failed renders and untrusted provider URLs before fetching', async () => {
  let calls = 0
  const fetcher = async () => { calls += 1; return response() }
  await assert.rejects(() => fetchCompletedBanner(completedRender({ status: 'rendering' }), fetcher as typeof fetch), (error: any) => error.code === 'render_not_completed')
  await assert.rejects(() => fetchCompletedBanner(completedRender({ status: 'failed' }), fetcher as typeof fetch), (error: any) => error.code === 'render_not_completed')
  await assert.rejects(() => fetchCompletedBanner(completedRender({ url: 'https://example.com/banner.jpg' }), fetcher as typeof fetch), (error: any) => error.code === 'invalid_provider_url')
  assert.equal(calls, 0)
})

test('rejects non-200, unsupported MIME, empty, oversized and forged files', async () => {
  await assert.rejects(() => fetchCompletedBanner(completedRender(), async () => response(jpeg, 'image/jpeg', 404)), (error: any) => error.code === 'provider_download_failed')
  await assert.rejects(() => fetchCompletedBanner(completedRender(), async () => response(jpeg, 'application/octet-stream')), (error: any) => error.code === 'provider_mime_not_allowed')
  await assert.rejects(() => fetchCompletedBanner(completedRender(), async () => response(new Uint8Array(), 'image/jpeg')), (error: any) => error.code === 'provider_file_empty')
  await assert.rejects(() => fetchCompletedBanner(completedRender(), async () => response(new Uint8Array([1, 2, 3]), 'image/jpeg')), (error: any) => error.code === 'provider_file_signature_invalid')
  const headers = new Headers({ 'content-type': 'image/jpeg', 'content-length': String(5 * 1024 * 1024 + 1) })
  await assert.rejects(() => fetchCompletedBanner(completedRender(), async () => new Response(jpeg, { status: 200, headers })), (error: any) => error.code === 'provider_file_too_large')
})

test('copies one canonical file to private owner Storage and registers one file creation', async () => {
  const supabase = new FakeSupabase()
  const result = await registerBannersRapidosCreation({
    supabase: supabase as any,
    userId,
    campaign: campaign(),
    render: completedRender(),
    completedAt,
    fetchImpl: async () => response(),
  })
  assert.equal(result.created, true)
  assert.equal(result.creation.id, creationId)
  assert.equal(supabase.uploads.length, 1)
  assert.equal(supabase.uploads[0].bucket, 'smartcorretor-assets')
  assert.equal(supabase.uploads[0].path, `${userId}/creations/banners-rapidos/${campaignId}/banner.jpg`)
  assert.equal((supabase.uploads[0].options as any).upsert, false)
  assert.equal(supabase.record.product_key, 'banners_rapidos')
  assert.equal(supabase.record.delivery_kind, 'file')
  assert.equal(supabase.record.source_ref, campaignId)
  assert.equal(supabase.record.completed_at, completedAt)
  assert.deepEqual(supabase.record.result_manifest.files[0], {
    bucket: 'smartcorretor-assets',
    path: `${userId}/creations/banners-rapidos/${campaignId}/banner.jpg`,
    name: 'smartcorretorai-banners-rapidos.jpg',
    mime_type: 'image/jpeg',
    size_bytes: jpeg.byteLength,
  })
})

test('polling is idempotent and never refetches, reuploads or reactivates an existing creation', async () => {
  const supabase = new FakeSupabase()
  supabase.record = {
    id: creationId,
    user_id: userId,
    product_key: 'banners_rapidos',
    source_ref: campaignId,
    title: 'Apartamento em Vila Mariana',
    delivery_kind: 'file',
    result_manifest: { version: 1, files: [] },
    completed_at: completedAt,
    expires_at: '2026-08-14T14:30:00.000Z',
    downloaded_at: '2026-08-13T15:00:00.000Z',
    deleted_at: null,
  }
  let fetches = 0
  const result = await registerBannersRapidosCreation({
    supabase: supabase as any,
    userId,
    campaign: campaign(),
    render: completedRender(),
    fetchImpl: async () => { fetches += 1; return response() },
  })
  assert.equal(result.created, false)
  assert.equal(result.creation.downloaded_at, '2026-08-13T15:00:00.000Z')
  assert.equal(fetches, 0)
  assert.equal(supabase.uploads.length, 0)
  assert.equal(supabase.insertions, 0)
})

test('duplicate owner-path upload can resume registration, while other Storage errors stop it', async () => {
  const duplicate = new FakeSupabase()
  duplicate.uploadError = { statusCode: 409, message: 'The resource already exists' }
  const resumed = await registerBannersRapidosCreation({
    supabase: duplicate as any,
    userId,
    campaign: campaign(),
    render: completedRender(),
    completedAt,
    fetchImpl: async () => response(),
  })
  assert.equal(resumed.created, true)

  const failed = new FakeSupabase()
  failed.uploadError = { statusCode: 500, message: 'storage unavailable' }
  await assert.rejects(() => registerBannersRapidosCreation({
    supabase: failed as any,
    userId,
    campaign: campaign(),
    render: completedRender(),
    completedAt,
    fetchImpl: async () => response(),
  }), (error: unknown) => error instanceof BannersRapidosCreationError && error.code === 'creation_storage_upload_failed')
  assert.equal(failed.insertions, 0)
})

test('get-render-status preserves the Creatomate result without copying or registering a creation', () => {
  assert.match(indexSource, /select\('id, titulo, dados_imovel, banners'\)/)
  assert.match(indexSource, /campaignBanners\.length > 0 \? campaignBanners : payloadRenders/)
  assert.match(indexSource, /update \? \{ \.\.\.item, \.\.\.update \} : item/)
  assert.doesNotMatch(indexSource, /registerBannersRapidosCreation|creation_id|creations\/banners-rapidos/)
})

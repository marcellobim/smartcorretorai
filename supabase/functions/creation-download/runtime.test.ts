import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  CREATION_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
  handleCreationDownload,
  type CreationDownloadDependencies,
  type DownloadCreation,
} from './runtime.ts'

const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER_USER_ID = '323e4567-e89b-42d3-a456-426614174000'
const CREATION_ID = '223e4567-e89b-42d3-a456-426614174000'
const NOW = Date.parse('2026-08-12T18:00:00.000Z')
const TOKEN = 'authenticated-test-token'

const storedFile = (overrides: Partial<DownloadCreation> = {}): DownloadCreation => ({
  id: CREATION_ID,
  user_id: USER_ID,
  delivery_kind: 'file',
  result_manifest: {
    version: 1,
    files: [{
      bucket: 'studio-videos',
      path: `${USER_ID}/jobs/job-1/video.mp4`,
      name: 'video.mp4',
      mime_type: 'video/mp4',
      size_bytes: 1024,
    }],
  },
  expires_at: '2026-08-13T18:00:00.000Z',
  downloaded_at: null,
  deleted_at: null,
  ...overrides,
})

const request = (action: 'prepare' | 'confirm', body: Record<string, unknown> = {}, token = TOKEN) =>
  new Request('https://local/creation-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, creation_id: CREATION_ID, ...body }),
  })

const json = async (response: Response) => response.json() as Promise<Record<string, any>>

function setup(initial: DownloadCreation | null = storedFile()) {
  let creation = initial
  const signed: Array<{ bucket: string; path: string; ttl: number }> = []
  const confirmations: string[] = []
  const dependencies: CreationDownloadDependencies = {
    authenticate: async token => token === TOKEN ? { id: USER_ID } : null,
    getCreation: async (creationId, userId) =>
      creation?.id === creationId && creation.user_id === userId ? creation : null,
    createSignedUrl: async (bucket, storagePath, ttl) => {
      signed.push({ bucket, path: storagePath, ttl })
      return `https://signed.local/${encodeURIComponent(storagePath)}`
    },
    confirmCreation: async (_creationId, userId, downloadedAt) => {
      confirmations.push(downloadedAt)
      if (!creation || creation.user_id !== userId || creation.deleted_at) return 'unavailable'
      if (creation.downloaded_at) return 'already_confirmed'
      creation = { ...creation, downloaded_at: downloadedAt }
      return 'confirmed'
    },
    now: () => NOW,
  }
  return { dependencies, signed, confirmations, creation: () => creation }
}

test('prepare requires a valid Supabase Bearer user', async () => {
  assert.equal((await handleCreationDownload(request('prepare', {}, ''), setup().dependencies)).status, 401)
  assert.equal((await handleCreationDownload(request('prepare', {}, 'invalid'), setup().dependencies)).status, 401)
})

test('prepare hides missing and foreign creations behind the same safe response', async () => {
  const missing = await handleCreationDownload(request('prepare'), setup(null).dependencies)
  const foreign = await handleCreationDownload(request('prepare'), setup(storedFile({ user_id: OTHER_USER_ID })).dependencies)
  assert.equal(missing.status, 404)
  assert.equal(foreign.status, 404)
  assert.deepEqual(await json(missing), await json(foreign))
})

test('prepare rejects expired, downloaded and deleted creations', async () => {
  const cases = [
    storedFile({ expires_at: new Date(NOW).toISOString() }),
    storedFile({ downloaded_at: '2026-08-12T17:00:00.000Z' }),
    storedFile({ deleted_at: '2026-08-12T17:00:00.000Z' }),
  ]
  for (const creation of cases) {
    assert.equal((await handleCreationDownload(request('prepare'), setup(creation).dependencies)).status, 410)
  }
})

test('prepare returns one short signed file descriptor without marking download', async () => {
  const state = setup()
  const response = await handleCreationDownload(request('prepare'), state.dependencies)
  const body = await json(response)
  assert.equal(response.status, 200)
  assert.equal(body.delivery_kind, 'file')
  assert.equal(body.expires_in, 300)
  assert.equal(body.download.name, 'video.mp4')
  assert.match(body.download.url, /^https:\/\/signed\.local\//)
  assert.deepEqual(state.signed, [{
    bucket: 'studio-videos', path: `${USER_ID}/jobs/job-1/video.mp4`, ttl: CREATION_DOWNLOAD_SIGNED_URL_TTL_SECONDS,
  }])
  assert.equal(state.creation()?.downloaded_at, null)
  assert.equal(state.confirmations.length, 0)
  assert.equal('bucket' in body.download, false)
  assert.equal('path' in body.download, false)
})

test('prepare returns only the temporary structured text delivery', async () => {
  const state = setup(storedFile({
    delivery_kind: 'text',
    result_manifest: {
      version: 1,
      content: { titulo: 'Apartamento à venda', instagram: 'Conheça o imóvel.' },
      download_name: 'campanha.txt',
    },
  }))
  const response = await handleCreationDownload(request('prepare'), state.dependencies)
  const body = await json(response)
  assert.equal(response.status, 200)
  assert.equal(body.download.name, 'campanha.txt')
  assert.deepEqual(body.download.content, { titulo: 'Apartamento à venda', instagram: 'Conheça o imóvel.' })
  assert.equal(state.signed.length, 0)
  assert.equal('result_manifest' in body, false)
})

test('prepare returns minimal signed descriptors for a bundle without creating ZIP', async () => {
  const state = setup(storedFile({
    delivery_kind: 'bundle',
    result_manifest: {
      version: 1,
      files: [
        { bucket: 'smartcorretor-assets', path: `${USER_ID}/creations/one.jpg`, name: 'one.jpg', mime_type: 'image/jpeg' },
        { bucket: 'smartcorretor-assets', path: `${USER_ID}/creations/two.jpg`, name: 'two.jpg', mime_type: 'image/jpeg' },
      ],
    },
  }))
  const body = await json(await handleCreationDownload(request('prepare'), state.dependencies))
  assert.equal(body.delivery_kind, 'bundle')
  assert.equal(body.files.length, 2)
  assert.equal(state.signed.length, 2)
  assert.equal('zip' in body, false)
})

test('prepare fails closed for malformed manifests, buckets and paths without leaking content', async () => {
  const cases = [
    storedFile({ result_manifest: { version: 1, files: [] } }),
    storedFile({ result_manifest: { version: 1, files: [{ ...storedFile().result_manifest.files![0], bucket: 'public-assets' as never }] } }),
    storedFile({ result_manifest: { version: 1, files: [{ ...storedFile().result_manifest.files![0], path: `${OTHER_USER_ID}/video.mp4` }] } }),
  ]
  for (const creation of cases) {
    const state = setup(creation)
    const response = await handleCreationDownload(request('prepare'), state.dependencies)
    const serialized = JSON.stringify(await json(response))
    assert.equal(response.status, 404)
    assert.doesNotMatch(serialized, /result_manifest|public-assets|other-user|video\.mp4/i)
    assert.equal(state.signed.length, 0)
  }
})

test('confirm requires authentication and ownership', async () => {
  assert.equal((await handleCreationDownload(request('confirm', {}, ''), setup().dependencies)).status, 401)
  assert.equal((await handleCreationDownload(request('confirm'), setup(storedFile({ user_id: OTHER_USER_ID })).dependencies)).status, 404)
})

test('confirm fills downloaded_at once and preserves deleted_at', async () => {
  const state = setup()
  const response = await handleCreationDownload(request('confirm'), state.dependencies)
  const body = await json(response)
  assert.equal(response.status, 200)
  assert.equal(body.confirmed, true)
  assert.equal(body.already_confirmed, false)
  assert.equal(state.creation()?.downloaded_at, '2026-08-12T18:00:00.000Z')
  assert.equal(state.creation()?.deleted_at, null)
  assert.equal(state.signed.length, 0)
})

test('confirm is idempotent and never reactivates a consumed creation', async () => {
  const state = setup()
  await handleCreationDownload(request('confirm'), state.dependencies)
  const firstTimestamp = state.creation()?.downloaded_at
  const repeated = await json(await handleCreationDownload(request('confirm'), state.dependencies))
  assert.equal(repeated.already_confirmed, true)
  assert.equal(state.creation()?.downloaded_at, firstTimestamp)
  assert.equal(state.confirmations.length, 1)
})

test('confirm never changes or reactivates a deleted creation', async () => {
  const deletedAt = '2026-08-12T17:00:00.000Z'
  const state = setup(storedFile({ deleted_at: deletedAt }))
  assert.equal((await handleCreationDownload(request('confirm'), state.dependencies)).status, 410)
  assert.equal(state.creation()?.deleted_at, deletedAt)
  assert.equal(state.creation()?.downloaded_at, null)
  assert.equal(state.confirmations.length, 0)
})

test('rejects every client-controlled ownership, storage or lifecycle field', async () => {
  for (const field of ['user_id', 'bucket', 'path', 'url', 'result_manifest', 'expires_at']) {
    const response = await handleCreationDownload(request('prepare', { [field]: 'attacker-controlled' }), setup().dependencies)
    assert.equal(response.status, 400)
  }
})

test('responses and errors never echo the Bearer token, service role or complete manifest', async () => {
  const sensitive = 'sensitive-text-that-must-not-leak'
  const state = setup(storedFile({
    result_manifest: { version: 1, files: [{ ...storedFile().result_manifest.files![0], url: sensitive } as never] },
  }))
  const response = await handleCreationDownload(request('prepare'), state.dependencies)
  const serialized = JSON.stringify(await json(response))
  assert.doesNotMatch(serialized, new RegExp(`${TOKEN}|${sensitive}|service.role|SUPABASE`, 'i'))
})

test('Edge entrypoint keeps service credentials backend-only and performs no physical delete', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url))
  const source = readFileSync(path.join(directory, 'index.ts'), 'utf8')
  const config = readFileSync(path.join(directory, '../../config.toml'), 'utf8')
  assert.match(source, /Deno\.env\.get\(name\)/)
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(source, /auth\.getUser\(token\)/)
  assert.match(source, /createSignedUrl\(path, expiresInSeconds\)/)
  assert.doesNotMatch(source, /storage[\s\S]*\.remove\(/)
  assert.doesNotMatch(source, /console\.(?:info|warn|error)\([^\n]*(?:token|result_manifest|content)/i)
  assert.match(config, /\[functions\.creation-download\]\s+verify_jwt = false/)
})

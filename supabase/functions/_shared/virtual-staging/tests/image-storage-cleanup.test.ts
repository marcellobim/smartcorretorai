import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pathModule from 'node:path'
import {
  parseVirtualStagingImagePath,
  runVirtualStagingImageCleanup,
  VIRTUAL_STAGING_IMAGE_BUCKET,
  VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES,
  VIRTUAL_STAGING_IMAGE_RETENTION_MS,
  type VirtualStagingImageObject,
} from '../image-storage-cleanup.ts'

const nowMs = Date.parse('2026-08-08T18:00:00.000Z')
const userId = '123e4567-e89b-42d3-a456-426614174000'
const secondUserId = '323e4567-e89b-42d3-a456-426614174000'
const requestId = '223e4567-e89b-42d3-a456-426614174000'
const jobId = '423e4567-e89b-42d3-a456-426614174000'
const inputPath = `${userId}/virtual-staging-images/inputs/${requestId}/01.jpg`
const resultPath = `${userId}/virtual-staging-images/results/${jobId}/generated-01.jpg`
const old = new Date(nowMs - VIRTUAL_STAGING_IMAGE_RETENTION_MS - 1).toISOString()
const recent = new Date(nowMs - VIRTUAL_STAGING_IMAGE_RETENTION_MS + 1).toISOString()
const exactLimit = new Date(nowMs - VIRTUAL_STAGING_IMAGE_RETENTION_MS).toISOString()
const testDirectory = pathModule.dirname(fileURLToPath(import.meta.url))

function object(name = inputPath, overrides: Partial<VirtualStagingImageObject> = {}): VirtualStagingImageObject {
  return { bucketId: VIRTUAL_STAGING_IMAGE_BUCKET, name, createdAt: old, ...overrides }
}

async function execute(objects: VirtualStagingImageObject[], options: {
  listError?: boolean
  removeError?: string
} = {}) {
  const removed: string[] = []
  const logs: string[] = []
  const summary = await runVirtualStagingImageCleanup({
    nowMs,
    listObjects: async () => {
      if (options.listError) throw new Error('storage unavailable')
      return objects
    },
    removeObject: async name => {
      if (options.removeError === name) throw new Error('storage unavailable')
      removed.push(name)
    },
    log: event => logs.push(event),
  })
  return { removed, logs, summary }
}

test('preserves a recent valid input', async () => {
  const result = await execute([object(inputPath, { createdAt: recent })])
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.preserved, 1)
})

test('preserves a recent valid result', async () => {
  const result = await execute([object(resultPath, { createdAt: recent })])
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.preserved, 1)
})

test('removes an input strictly older than six hours', async () => {
  const result = await execute([object(inputPath)])
  assert.deepEqual(result.removed, [inputPath])
})

test('removes a result strictly older than six hours', async () => {
  const result = await execute([object(resultPath)])
  assert.deepEqual(result.removed, [resultPath])
})

test('preserves an object exactly six hours old', async () => {
  const result = await execute([object(inputPath, { createdAt: exactLimit })])
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.preserved, 1)
})

for (const [label, path] of [
  ['legacy namespace', `${userId}/virtual-staging/${requestId}/01.jpg`],
  ['generic legacy result', `${userId}/${jobId}/generated-01.jpg`],
  ['Studio object', `${userId}/${jobId}/video.mp4`],
] as const) {
  test(`preserves ${label}`, async () => {
    const result = await execute([object(path)])
    assert.deepEqual(result.removed, [])
    assert.equal(result.summary.ignored, 1)
  })
}

for (const [label, path] of [
  ['invalid input request id', `${userId}/virtual-staging-images/inputs/not-a-uuid/01.jpg`],
  ['invalid result job id', `${userId}/virtual-staging-images/results/not-a-uuid/generated-01.jpg`],
  ['input index 06', `${userId}/virtual-staging-images/inputs/${requestId}/06.jpg`],
  ['invalid extension', `${userId}/virtual-staging-images/inputs/${requestId}/01.webp`],
  ['traversal', `${userId}/virtual-staging-images/inputs/${requestId}/../01.jpg`],
  ['malformed result filename', `${userId}/virtual-staging-images/results/${jobId}/generated-02.jpg`],
] as const) {
  test(`preserves ${label}`, async () => {
    assert.equal(parseVirtualStagingImagePath(path), null)
    const result = await execute([object(path)])
    assert.deepEqual(result.removed, [])
  })
}

test('does not remove anything when listing fails', async () => {
  const result = await execute([object(inputPath)], { listError: true })
  assert.deepEqual(result.removed, [])
  assert.deepEqual(result.logs, ['storage_list_failed'])
  assert.equal(result.summary.listingFailed, true)
  assert.equal(result.summary.scanned, 0)
})

test('continues after an individual removal failure without logging identities', async () => {
  const result = await execute([object(inputPath), object(resultPath)], { removeError: inputPath })
  assert.deepEqual(result.removed, [resultPath])
  assert.deepEqual(result.logs, ['storage_remove_failed'])
  assert.equal(result.summary.failed, 1)
  assert.equal(result.summary.removed, 1)
})

test('processes valid paths for multiple users independently', async () => {
  const secondPath = `${secondUserId}/virtual-staging-images/inputs/${requestId}/02.png`
  const result = await execute([object(inputPath), object(secondPath)])
  assert.deepEqual(result.removed, [inputPath, secondPath])
})

test('limits each run to at most 500 candidates', async () => {
  const objects = Array.from({ length: VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES + 1 }, (_, index) => {
    const id = `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`
    return object(`${userId}/virtual-staging-images/inputs/${id}/01.jpg`)
  })
  const result = await execute(objects)
  assert.equal(result.summary.scanned, VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES)
  assert.equal(result.summary.removed, VIRTUAL_STAGING_IMAGE_MAX_CANDIDATES)
  assert.equal(result.summary.limited, 1)
})

test('never touches an object from another bucket', async () => {
  const result = await execute([object(inputPath, { bucketId: 'short-videos-inputs' })])
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.ignored, 1)
})

test('keeps the endpoint service-role-only, path-independent and restricted to Storage API', () => {
  const functionSource = readFileSync(pathModule.resolve(testDirectory, '../../../virtual-staging-images-cleanup/index.ts'), 'utf8')
  const configSource = readFileSync(pathModule.resolve(testDirectory, '../../../../config.toml'), 'utf8')
  assert.match(functionSource, /req\.method !== 'POST'/)
  assert.match(functionSource, /readJwtRole\(req\.headers\.get\('authorization'\)\) !== 'service_role'/)
  assert.match(functionSource, /from\(VIRTUAL_STAGING_IMAGE_BUCKET\)\.remove\(\[name\]\)/)
  assert.doesNotMatch(functionSource, /req\.json\(/)
  assert.doesNotMatch(functionSource, /storage\.objects|from\(['"]objects['"]\)/)
  assert.match(configSource, /\[functions\.virtual-staging-images-cleanup\]\s+verify_jwt = true/)
})

test('schedules the function hourly at minute 27 using only Vault credentials', () => {
  const migration = readFileSync(pathModule.resolve(testDirectory, '../../../../migrations/20260808020000_schedule_virtual_staging_image_cleanup.sql'), 'utf8')
  assert.match(migration, /'27 \* \* \* \*'/)
  assert.match(migration, /vault\.decrypted_secrets/)
  assert.match(migration, /WHERE name = 'project_url'/)
  assert.match(migration, /WHERE name = 'service_role_key'/)
  assert.match(migration, /\/functions\/v1\/virtual-staging-images-cleanup/)
  assert.doesNotMatch(migration, /https:\/\/[^']+\.supabase\.co|eyJ[A-Za-z0-9_-]{20,}/)
})

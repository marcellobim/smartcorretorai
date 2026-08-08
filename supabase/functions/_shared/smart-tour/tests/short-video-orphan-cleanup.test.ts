import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pathModule from 'node:path'
import {
  runShortVideoOrphanCleanup,
  SHORT_VIDEO_ORPHAN_MIN_AGE_MS,
  SHORT_VIDEOS_INPUT_BUCKET,
  type ShortVideoInputObject,
} from '../short-video-orphan-cleanup.ts'

const nowMs = Date.parse('2026-08-08T12:00:00.000Z')
const userId = '123e4567-e89b-42d3-a456-426614174000'
const requestId = '223e4567-e89b-42d3-a456-426614174000'
const path = `${userId}/short-videos/${requestId}/input.mp4`
const old = new Date(nowMs - SHORT_VIDEO_ORPHAN_MIN_AGE_MS - 1).toISOString()
const recent = new Date(nowMs - SHORT_VIDEO_ORPHAN_MIN_AGE_MS + 1).toISOString()
const testDirectory = pathModule.dirname(fileURLToPath(import.meta.url))

function object(overrides: Partial<ShortVideoInputObject> = {}): ShortVideoInputObject {
  return { bucketId: SHORT_VIDEOS_INPUT_BUCKET, name: path, createdAt: old, ...overrides }
}

async function execute(objects: ShortVideoInputObject[], jobs: Record<string, { status: string } | null>, options: {
  lookupError?: string
  removeError?: string
} = {}) {
  const removed: string[] = []
  const logs: string[] = []
  const summary = await runShortVideoOrphanCleanup({
    objects,
    nowMs,
    getJob: async ({ requestId: id }) => {
      if (options.lookupError === id) throw new Error('database unavailable')
      return jobs[id] ?? null
    },
    removeObject: async name => {
      if (options.removeError === name) throw new Error('storage unavailable')
      removed.push(name)
    },
    log: event => logs.push(event),
  })
  return { removed, logs, summary }
}

test('preserves a recent object without consulting jobs', async () => {
  const result = await execute([object({ createdAt: recent })], {})
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.ignored, 1)
})

for (const status of ['pending', 'generating', 'processing']) {
  test(`preserves an old object associated with an active ${status} job`, async () => {
    const result = await execute([object()], { [requestId]: { status } })
    assert.deepEqual(result.removed, [])
    assert.equal(result.summary.preserved, 1)
  })
}

for (const status of ['completed', 'failed']) {
  test(`removes an old residual object associated with a ${status} job`, async () => {
    const result = await execute([object()], { [requestId]: { status } })
    assert.deepEqual(result.removed, [path])
  })
}

test('removes an old object when no corresponding job exists', async () => {
  const result = await execute([object()], {})
  assert.deepEqual(result.removed, [path])
})

test('ignores an invalid path safely', async () => {
  const result = await execute([object({ name: `${userId}/outro/${requestId}/input.mp4` })], {})
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.ignored, 1)
})

test('never touches an object from another bucket', async () => {
  const result = await execute([object({ bucketId: 'studio-videos' })], {})
  assert.deepEqual(result.removed, [])
  assert.equal(result.summary.ignored, 1)
})

test('preserves the object when the database lookup fails', async () => {
  const result = await execute([object()], {}, { lookupError: requestId })
  assert.deepEqual(result.removed, [])
  assert.deepEqual(result.logs, ['database_lookup_failed'])
})

test('records a removal failure and continues processing other objects', async () => {
  const secondRequestId = '323e4567-e89b-42d3-a456-426614174000'
  const secondPath = `${userId}/short-videos/${secondRequestId}/input.mp4`
  const result = await execute(
    [object(), object({ name: secondPath })],
    {},
    { removeError: path },
  )
  assert.deepEqual(result.removed, [secondPath])
  assert.deepEqual(result.logs, ['storage_remove_failed'])
  assert.deepEqual(result.summary, { scanned: 2, removed: 1, preserved: 0, ignored: 0, failed: 1 })
})

test('keeps the scheduled endpoint service-role-only and path-independent', () => {
  const functionSource = readFileSync(pathModule.resolve(testDirectory, '../../../short-videos-cleanup/index.ts'), 'utf8')
  const configSource = readFileSync(pathModule.resolve(testDirectory, '../../../../config.toml'), 'utf8')
  assert.match(functionSource, /readJwtRole\(req\.headers\.get\('authorization'\)\) !== 'service_role'/)
  assert.match(functionSource, /from\(SHORT_VIDEOS_INPUT_BUCKET\)\.remove\(\[name\]\)/)
  assert.doesNotMatch(functionSource, /req\.json\(/)
  assert.match(configSource, /\[functions\.short-videos-cleanup\]\s+verify_jwt = true/)
})

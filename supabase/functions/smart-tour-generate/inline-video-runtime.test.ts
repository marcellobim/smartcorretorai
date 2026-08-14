import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SMART_TOUR_INLINE_MIN_PROVIDER_TIMEOUT_MS,
  SMART_TOUR_INLINE_REQUEST_BUDGET_MS,
  persistSmartTourInlineVideo,
  resolveSmartTourInlineProviderTimeout,
} from './inline-video-runtime.ts'

const userId = '653b5a06-9b7a-4009-9a8c-6e3ea701460c'
const jobId = '6285d877-15a2-4281-ad66-df0ff5584c2c'

test('reserves 30 seconds of the Edge response limit and refuses a doomed provider call', () => {
  assert.equal(SMART_TOUR_INLINE_REQUEST_BUDGET_MS, 120_000)
  assert.equal(SMART_TOUR_INLINE_MIN_PROVIDER_TIMEOUT_MS, 60_000)
  assert.equal(resolveSmartTourInlineProviderTimeout(0, 110_000), 110_000)
  assert.equal(resolveSmartTourInlineProviderTimeout(10_000, 110_000), 110_000)
  assert.equal(resolveSmartTourInlineProviderTimeout(60_000, 110_000), 60_000)
  assert.throws(() => resolveSmartTourInlineProviderTimeout(60_001, 110_000), /inline_video_timeout_budget_exhausted/)
})

test('uploads, signs and persists one inline MP4 in the original product path', async () => {
  const calls: string[] = []
  let persisted: Record<string, string> | null = null
  const result = await persistSmartTourInlineVideo({
    userId,
    jobId,
    interactionId: 'v1_inline_fixture',
    videoBytes: Uint8Array.from([0, 1, 2, 3]),
    contentType: 'video/mp4',
  }, {
    upload: async (path, bytes, contentType) => {
      calls.push('upload')
      assert.equal(path, `${userId}/${jobId}/smart-tour.mp4`)
      assert.deepEqual(bytes, Uint8Array.from([0, 1, 2, 3]))
      assert.equal(contentType, 'video/mp4')
    },
    createSignedUrl: async (path, expiresInSeconds) => {
      calls.push('sign')
      assert.equal(path, `${userId}/${jobId}/smart-tour.mp4`)
      assert.equal(expiresInSeconds, 3600)
      return 'https://signed.invalid/fixture'
    },
    persistCompleted: async input => {
      calls.push('persist')
      persisted = input
    },
    now: () => new Date('2026-08-14T20:00:00.000Z'),
  })
  assert.deepEqual(calls, ['upload', 'sign', 'persist'])
  assert.deepEqual(persisted, {
    interactionId: 'v1_inline_fixture',
    outputPath: `${userId}/${jobId}/smart-tour.mp4`,
    completedAt: '2026-08-14T20:00:00.000Z',
  })
  assert.deepEqual(result, {
    outputPath: `${userId}/${jobId}/smart-tour.mp4`,
    completedAt: '2026-08-14T20:00:00.000Z',
    signedVideoUrl: 'https://signed.invalid/fixture',
  })
})

test('never signs or marks the job completed when the MP4 upload fails', async () => {
  const calls: string[] = []
  await assert.rejects(
    persistSmartTourInlineVideo({
      userId,
      jobId,
      interactionId: 'v1_inline_fixture',
      videoBytes: Uint8Array.from([0, 1, 2, 3]),
      contentType: 'video/mp4',
    }, {
      upload: async () => { calls.push('upload'); throw new Error('video_upload_failed') },
      createSignedUrl: async () => { calls.push('sign'); return 'https://signed.invalid/fixture' },
      persistCompleted: async () => { calls.push('persist') },
    }),
    /video_upload_failed/,
  )
  assert.deepEqual(calls, ['upload'])
})

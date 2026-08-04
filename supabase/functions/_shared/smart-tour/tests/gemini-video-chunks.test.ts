import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GEMINI_VIDEO_UPLOAD_CHUNK_BYTES,
  prepareGeminiVideo,
} from '../../geminiOmniClient.ts'

test('Short Videos transfers private Storage ranges to Google in bounded sequential chunks', async () => {
  const totalBytes = GEMINI_VIDEO_UPLOAD_CHUNK_BYTES + 37
  const storageRanges: string[] = []
  const googleOffsets: string[] = []
  const googleCommands: string[] = []
  const uploadUrl = 'https://upload.googleapis.com/resumable/mock-session'
  let legacyDownloadCalls = 0

  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    const headers = new Headers(init.headers)
    if (url.includes('/storage/v1/object/authenticated/')) {
      const range = headers.get('range') || ''
      storageRanges.push(range)
      const match = range.match(/^bytes=(\d+)-(\d+)$/)
      assert.ok(match)
      const length = Number(match[2]) - Number(match[1]) + 1
      return new Response(new Uint8Array(length), {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'content-length': String(length) },
      })
    }
    if (url === 'https://generativelanguage.googleapis.com/upload/v1beta/files') {
      return new Response('{}', {
        status: 200,
        headers: {
          'x-goog-upload-url': uploadUrl,
          'x-goog-upload-chunk-granularity': String(256 * 1024),
        },
      })
    }
    if (url === uploadUrl) {
      googleOffsets.push(headers.get('x-goog-upload-offset') || '')
      googleCommands.push(headers.get('x-goog-upload-command') || '')
      const isFinal = headers.get('x-goog-upload-command') === 'upload, finalize'
      return new Response(isFinal
        ? JSON.stringify({ file: { name: 'files/mock-video', uri: 'https://generativelanguage.googleapis.com/v1beta/files/mock-video', mimeType: 'video/mp4', state: 'ACTIVE' } })
        : '{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error(`unexpected mock request: ${url}`)
  }

  const supabase = {
    storage: {
      from: () => ({
        download: async () => {
          legacyDownloadCalls += 1
          throw new Error('legacy Blob download must not run')
        },
      }),
    },
  }
  const result = await prepareGeminiVideo(supabase as never, 'short-videos-inputs', 'user/short-videos/request/input.mp4', 'short-videos', {
    size: totalBytes,
    mimeType: 'video/mp4',
    storageUrl: 'https://project.supabase.co',
    storageKey: 'test-storage-key',
    googleApiKey: 'test-google-key',
    fetchImpl,
  })

  assert.equal(legacyDownloadCalls, 0)
  assert.deepEqual(storageRanges, [
    `bytes=0-${GEMINI_VIDEO_UPLOAD_CHUNK_BYTES - 1}`,
    `bytes=${GEMINI_VIDEO_UPLOAD_CHUNK_BYTES}-${totalBytes - 1}`,
  ])
  assert.deepEqual(googleOffsets, ['0', String(GEMINI_VIDEO_UPLOAD_CHUNK_BYTES)])
  assert.deepEqual(googleCommands, ['upload', 'upload, finalize'])
  assert.equal(result.video.uri, 'https://generativelanguage.googleapis.com/v1beta/files/mock-video')
})

test('Short Videos rejects a Storage server that ignores a partial Range before reading the full body', async () => {
  let fullBodyRead = false
  const oversizedResponse = {
    status: 200,
    headers: new Headers({ 'content-type': 'video/mp4', 'content-length': String(20 * 1024 * 1024) }),
    arrayBuffer: async () => {
      fullBodyRead = true
      return new ArrayBuffer(20 * 1024 * 1024)
    },
  } as Response
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/upload/v1beta/files')) return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': 'https://upload.googleapis.com/resumable/mock-session' } })
    if (url.includes('/storage/v1/object/authenticated/')) return oversizedResponse
    throw new Error('unexpected mock request')
  }
  const supabase = { storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) } }
  await assert.rejects(() => prepareGeminiVideo(supabase as never, 'short-videos-inputs', 'user/short-videos/request/input.mp4', 'short-videos', {
    size: 20 * 1024 * 1024,
    mimeType: 'video/mp4',
    storageUrl: 'https://project.supabase.co',
    storageKey: 'test-storage-key',
    googleApiKey: 'test-google-key',
    fetchImpl,
  }), /gemini_omni_storage_range_failed:200/)
  assert.equal(fullBodyRead, false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  persistVirtualSpaceInlineVideo,
  resolveVirtualSpaceInlineProviderTimeout,
  VIRTUAL_SPACE_INLINE_POST_PROVIDER_RESERVE_MS,
  VIRTUAL_SPACE_INLINE_REQUEST_BUDGET_MS,
} from './inline-video-runtime.ts'

const userId = '00000000-0000-4000-8000-000000000001'
const jobId = '00000000-0000-4000-8000-000000000002'
const videoBytes = new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70])

test('reserva o mesmo orçamento inline homologado sem ampliar o timeout do provider', () => {
  assert.equal(VIRTUAL_SPACE_INLINE_REQUEST_BUDGET_MS, 120_000)
  assert.equal(VIRTUAL_SPACE_INLINE_POST_PROVIDER_RESERVE_MS, 10_000)
  assert.equal(resolveVirtualSpaceInlineProviderTimeout(0, 110_000), 110_000)
  assert.equal(resolveVirtualSpaceInlineProviderTimeout(10_000, 110_000), 100_000)
  assert.equal(resolveVirtualSpaceInlineProviderTimeout(50_000, 110_000), 60_000)
  assert.throws(() => resolveVirtualSpaceInlineProviderTimeout(50_001, 110_000), /virtual_space_inline_timeout_budget_exhausted/)
})

test('persiste o MP4 inline diretamente no path final quando não há composição', async () => {
  const events: string[] = []
  const result = await persistVirtualSpaceInlineVideo({
    userId,
    jobId,
    interactionId: 'interaction-inline',
    videoBytes,
    contentType: 'video/mp4',
    requiresCaptionRender: false,
  }, {
    upload: async (path, bytes, contentType) => {
      assert.equal(path, `${userId}/${jobId}/virtual-staging.mp4`)
      assert.equal(bytes, videoBytes)
      assert.equal(contentType, 'video/mp4')
      events.push('upload')
    },
    createSignedUrl: async (path, expiresInSeconds) => {
      assert.equal(path, `${userId}/${jobId}/virtual-staging.mp4`)
      assert.equal(expiresInSeconds, 3600)
      events.push('sign')
      return 'https://storage.example.test/result'
    },
    startCaptionRender: async () => { throw new Error('caption_render_must_not_start') },
    persistCaptionRender: async () => { throw new Error('caption_render_must_not_persist') },
    persistCompleted: async input => {
      assert.deepEqual(input, {
        interactionId: 'interaction-inline',
        outputPath: `${userId}/${jobId}/virtual-staging.mp4`,
        completedAt: '2026-08-14T12:00:00.000Z',
      })
      events.push('completed')
    },
    now: () => new Date('2026-08-14T12:00:00.000Z'),
  })
  assert.equal(result.status, 'completed')
  assert.deepEqual(events, ['upload', 'sign', 'completed'])
})

test('preserva a composição posterior usando somente o MP4 inline temporário', async () => {
  const events: string[] = []
  const result = await persistVirtualSpaceInlineVideo({
    userId,
    jobId,
    interactionId: 'interaction-inline',
    videoBytes,
    contentType: 'video/mp4',
    requiresCaptionRender: true,
  }, {
    upload: async path => {
      assert.equal(path, `${userId}/${jobId}/virtual-staging-gemini.mp4`)
      events.push('upload-raw')
    },
    createSignedUrl: async (path, expiresInSeconds) => {
      assert.equal(path, `${userId}/${jobId}/virtual-staging-gemini.mp4`)
      assert.equal(expiresInSeconds, 21_600)
      events.push('sign-raw')
      return 'https://storage.example.test/raw'
    },
    startCaptionRender: async videoUrl => {
      assert.equal(videoUrl, 'https://storage.example.test/raw')
      events.push('start-caption')
      return 'creatomate:00000000-0000-4000-8000-000000000003'
    },
    persistCaptionRender: async providerJobId => {
      assert.equal(providerJobId, 'creatomate:00000000-0000-4000-8000-000000000003')
      events.push('persist-caption')
    },
    persistCompleted: async () => { throw new Error('completed_must_wait_for_caption_render') },
  })
  assert.equal(result.status, 'generating')
  assert.deepEqual(events, ['upload-raw', 'sign-raw', 'start-caption', 'persist-caption'])
})

test('conecta inline somente a Vida no Imóvel e Apresentação pelo Corretor', () => {
  const generator = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
  const status = readFileSync(new URL('../virtual-staging-status/index.ts', import.meta.url), 'utf8')
  const smartTourGenerator = readFileSync(new URL('../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  const imageRuntime = readFileSync(new URL('../virtual-staging-image-test/runtime.ts', import.meta.url), 'utf8')

  assert.match(generator, /const isLifeInProperty = input\.generation\.mode === 'narrated_tour' && Boolean\(input\.generation\.life_scene\)/)
  assert.match(generator, /const isBrokerPresentation = input\.module === 'broker-presentation'/)
  assert.match(generator, /if \(activeVerticalVideo\) \{[\s\S]*generateGeminiOmniVideoInline\(\{[\s\S]*images:\[\.\.\.presenterImages,\.\.\.images\],[\s\S]*aspectRatio:'9:16'/)
  assert.match(generator, /requiresCaptionRender:hasDeterministicSmartTourText\(briefing\)/)
  assert.match(generator, /startGeminiOmniVideo\(\{prompt,images:\[\.\.\.presenterImages,\.\.\.images\]/)
  assert.match(status, /job\.status === 'completed' && job\.output_video_path[\s\S]*createSignedUrl\(job\.output_video_path, 3600\)/)
  assert.match(smartTourGenerator, /generateGeminiOmniVideoInline/)
  assert.match(smartTourGenerator, /startGeminiOmniShortVideo/)
  assert.doesNotMatch(imageRuntime, /generateGeminiOmniVideoInline|startGeminiOmniVideo/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { runShortVideoPipeline } from '../../../smart-tour-generate/short-video-runtime.ts'

function createPipeline(overrides: Record<string, unknown> = {}) {
  const events: string[] = []
  const calls = { prepareVideo: 0, openAi: 0, gemini: 0, cleanup: 0, failed: 0 }
  const dependencies = {
    persistStage: async (stage: string) => { events.push(`stage:${stage}`) },
    prepareVideo: async () => { calls.prepareVideo += 1; events.push('video:active'); return { video: 'active' } },
    cleanupInput: async () => { calls.cleanup += 1; events.push('cleanup') },
    prepareOpenAi: async () => { calls.openAi += 1; events.push('openai'); return { prompt: 'safe', hashtags: [] } },
    persistBriefing: async () => { events.push('briefing:persisted') },
    startGemini: async () => { calls.gemini += 1; events.push('gemini'); return { interactionId: 'masked' } },
    persistProvider: async () => { events.push('provider:persisted') },
    persistFailure: async (stage: string) => { calls.failed += 1; events.push(`failed:${stage}`) },
    onCleanupError: (stage: string) => { events.push(`cleanup-error:${stage}`) },
    ...overrides,
  }
  return { dependencies, events, calls }
}

test('pipeline accepts the Google file before OpenAI and Gemini and cleans the raw input once', async () => {
  const { dependencies, events, calls } = createPipeline()
  await runShortVideoPipeline(dependencies as never)
  assert.deepEqual(events, [
    'stage:google_file_upload', 'video:active', 'stage:google_file_active', 'cleanup',
    'openai', 'briefing:persisted', 'gemini', 'provider:persisted',
  ])
  assert.deepEqual(calls, { prepareVideo: 1, openAi: 1, gemini: 1, cleanup: 1, failed: 0 })
})

test('failure before ACTIVE makes zero OpenAI and Gemini calls, marks failed and removes the raw input', async () => {
  const { dependencies, events, calls } = createPipeline()
  dependencies.prepareVideo = async () => { calls.prepareVideo += 1; throw new Error('transfer_failed') }
  await assert.rejects(() => runShortVideoPipeline(dependencies as never), /transfer_failed/)
  assert.equal(calls.openAi, 0)
  assert.equal(calls.gemini, 0)
  assert.equal(calls.failed, 1)
  assert.equal(calls.cleanup, 1)
  assert.deepEqual(events, ['stage:google_file_upload', 'failed:google_file_upload', 'cleanup'])
})

test('cleanup failure is logged once and never retries or blocks generation', async () => {
  const { dependencies, events, calls } = createPipeline()
  dependencies.cleanupInput = async () => { calls.cleanup += 1; throw new Error('cleanup_failed') }
  await runShortVideoPipeline(dependencies as never)
  assert.equal(calls.cleanup, 1)
  assert.equal(calls.prepareVideo, 1)
  assert.equal(calls.openAi, 1)
  assert.equal(calls.gemini, 1)
  assert.equal(events.filter(event => event.startsWith('cleanup-error:')).length, 1)
})

test('handled Gemini failure keeps one generation attempt and persists its safe stage', async () => {
  const { dependencies, calls, events } = createPipeline()
  dependencies.startGemini = async () => { calls.gemini += 1; throw new Error('gemini_failed') }
  await assert.rejects(() => runShortVideoPipeline(dependencies as never), /gemini_failed/)
  assert.equal(calls.prepareVideo, 1)
  assert.equal(calls.openAi, 1)
  assert.equal(calls.gemini, 1)
  assert.equal(calls.cleanup, 1)
  assert.ok(events.includes('failed:gemini_interaction'))
})

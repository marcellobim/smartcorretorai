import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import {
  SMART_TOUR_GEMINI_OMNI_INLINE_TIMEOUT_MS,
  SMART_TOUR_GEMINI_OMNI_MAX_OUTPUT_TOKENS,
  buildGeminiOmniInlineRequestBody,
  generateGeminiOmniVideoInline,
} from '../../geminiOmniClient.ts'

const validMp4 = Uint8Array.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
])

function inlineResponse(options: { data?: string; mimeType?: string; extraVideo?: boolean } = {}) {
  const video = {
    type: 'video',
    mime_type: options.mimeType ?? 'video/mp4',
    data: options.data ?? Buffer.from(validMp4).toString('base64'),
  }
  return {
    id: 'v1_inline_fixture',
    status: 'completed',
    steps: [{
      type: 'model_output',
      content: options.extraVideo ? [video, { ...video }] : [{ type: 'text', text: 'done' }, video],
    }],
  }
}

async function withGeminiEnvironment<T>(callback: () => Promise<T>) {
  const previousDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: (name: string) => name === 'GEMINI_API_KEY' ? 'primary-test-key' : '' } },
  })
  try { return await callback() } finally {
    if (previousDeno === undefined) delete (globalThis as typeof globalThis & { Deno?: unknown }).Deno
    else Object.defineProperty(globalThis, 'Deno', { configurable: true, value: previousDeno })
  }
}

test('builds the synchronous inline contract for one to five ordered images', () => {
  const images = Array.from({ length: 5 }, (_, index) => ({
    type: 'image',
    data: `image-${index + 1}`,
    mime_type: index === 1 ? 'image/png' : 'image/jpeg',
  }))
  const body = buildGeminiOmniInlineRequestBody('structured briefing', images)
  assert.equal(body.model, 'gemini-omni-flash-preview')
  assert.deepEqual(body.input.slice(0, 5), images)
  assert.deepEqual(body.input.at(-1), { type: 'text', text: 'structured briefing' })
  assert.deepEqual(body.generation_config, {
    max_output_tokens: 65_536,
    thinking_level: 'high',
  })
  assert.equal(SMART_TOUR_GEMINI_OMNI_MAX_OUTPUT_TOKENS, 65_536)
  assert.equal(SMART_TOUR_GEMINI_OMNI_INLINE_TIMEOUT_MS, 110_000)
  assert.deepEqual(body.response_modalities, ['video'])
  assert.deepEqual(body.response_format, { type: 'video', duration: '10s' })
  assert.deepEqual(Object.keys(body).sort(), ['generation_config', 'input', 'model', 'response_format', 'response_modalities'])
  assert.doesNotMatch(JSON.stringify(body), /background|store|delivery|video_config|task/)
})

test('waits for and decodes exactly one inline MP4 without polling', async () => {
  await withGeminiEnvironment(async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const generated = await generateGeminiOmniVideoInline({
      prompt: 'safe fixture',
      images: [{ type: 'image', data: 'fixture', mime_type: 'image/jpeg' }],
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(JSON.stringify(inlineResponse()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
    assert.equal(requests[0].init?.method, 'POST')
    assert.equal(new Headers(requests[0].init?.headers).get('x-goog-api-key'), 'primary-test-key')
    const body = JSON.parse(String(requests[0].init?.body))
    assert.deepEqual(body.response_modalities, ['video'])
    assert.equal(body.response_format.delivery, undefined)
    assert.equal(generated.interactionId, 'v1_inline_fixture')
    assert.equal(generated.contentType, 'video/mp4')
    assert.deepEqual(generated.videoBytes, validMp4)
  })
})

test('fails closed for missing, ambiguous, malformed or non-MP4 inline output', async () => {
  await withGeminiEnvironment(async () => {
    const invoke = (payload: unknown) => generateGeminiOmniVideoInline({
      prompt: 'safe fixture',
      images: [{ type: 'image', data: 'fixture', mime_type: 'image/jpeg' }],
      fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200 }),
    })
    await assert.rejects(invoke({ id: 'v1_missing', steps: [] }), /gemini_omni_inline_video_missing/)
    await assert.rejects(invoke(inlineResponse({ extraVideo: true })), /gemini_omni_inline_video_ambiguous/)
    await assert.rejects(invoke(inlineResponse({ mimeType: 'video/webm' })), /gemini_omni_inline_video_type_invalid/)
    await assert.rejects(invoke(inlineResponse({ data: 'not base64' })), /gemini_omni_inline_video_base64_invalid/)
    await assert.rejects(
      invoke(inlineResponse({ data: Buffer.from('not an mp4').toString('base64') })),
      /gemini_omni_inline_video_mp4_invalid/,
    )
  })
})

test('sanitizes an inline provider error without exposing the prompt or credential', async () => {
  await withGeminiEnvironment(async () => {
    await assert.rejects(
      generateGeminiOmniVideoInline({
        prompt: 'PRIVATE_PROPERTY_ADDRESS',
        images: [{ type: 'image', data: 'PRIVATE_BASE64_IMAGE', mime_type: 'image/jpeg' }],
        fetchImpl: async () => new Response(JSON.stringify({
          error: { code: 400, message: 'prompt=PRIVATE_PROPERTY_ADDRESS; GEMINI_API_KEY=PRIVATE_CREDENTIAL' },
        }), { status: 400 }),
      }),
      error => {
        assert.match(String(error), /gemini_omni_api_failed:400:\[provider-detail-redacted\]/)
        assert.doesNotMatch(String(error), /PRIVATE_PROPERTY_ADDRESS|PRIVATE_CREDENTIAL|PRIVATE_BASE64_IMAGE/)
        return true
      },
    )
  })
})

test('aborts the single synchronous provider request at the bounded local timeout', async () => {
  await withGeminiEnvironment(async () => {
    let requestCount = 0
    await assert.rejects(
      generateGeminiOmniVideoInline({
        prompt: 'safe fixture',
        images: [{ type: 'image', data: 'fixture', mime_type: 'image/jpeg' }],
        timeoutMs: 5,
        fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
          requestCount += 1
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
        }),
      }),
      /gemini_omni_inline_timeout/,
    )
    assert.equal(requestCount, 1)
  })
})

test('connects inline completion only to Video Imobiliario and preserves the original result path', () => {
  const generator = readFileSync(new URL('../../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  const status = readFileSync(new URL('../../../smart-tour-status/index.ts', import.meta.url), 'utf8')
  assert.equal((generator.match(/generateGeminiOmniVideoInline\(\{/g) || []).length, 1)
  assert.match(generator, /timeoutMs:resolveSmartTourInlineProviderTimeout\(Date\.now\(\) - requestStartedAt,110_000\)/)
  assert.match(generator, /startGeminiOmniShortVideo\(\{prompt:geminiPrompt,video:prepared\.video\}\)/)
  assert.match(generator, /persistSmartTourInlineVideo\(\{userId:user\.id,jobId:input\.clientRequestId,\.\.\.generated\}/)
  assert.match(generator, /status:'completed',provider_job_id:interactionId,output_video_path:outputPath,completed_at:completedAt/)
  assert.doesNotMatch(generator, /registerCompletedCreation|creationId|prepare\/confirm/)
  assert.match(status, /checkGeminiOmniVideoStream/)
})

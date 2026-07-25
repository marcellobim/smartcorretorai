import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH,
  classifySmartTourStatusError,
  maskSmartTourInteractionId,
  sanitizeSmartTourStatusProviderMessage,
  withSmartTourStatusTimeout,
} from '../../../smart-tour-status/status-runtime.ts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const statusSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-status/index.ts'), 'utf8')

test('keeps processing when the Interactions API is briefly not ready', () => {
  for (const status of [404, 408, 409, 425, 429, 500, 502, 503, 504]) {
    const diagnostic = classifySmartTourStatusError(new Error(`gemini_omni_api_failed:${status}:temporary`), 'interaction_poll')
    assert.equal(diagnostic.retriable, true, String(status))
    assert.equal(diagnostic.providerStatus, status)
    assert.equal(diagnostic.kind, 'interaction_api_error')
    assert.equal(diagnostic.providerMessage, 'temporary')
  }
})

test('keeps processing when interaction polling reaches its local timeout', () => {
  const diagnostic = classifySmartTourStatusError(new Error('smart_tour_status_timeout'), 'interaction_poll')
  assert.deepEqual(diagnostic, {
    stage: 'interaction_poll',
    kind: 'interaction_timeout',
    providerStatus: null,
    retriable: true,
    providerMessage: '',
  })
})

test('keeps processing when deterministic caption polling is briefly unavailable', () => {
  const diagnostic = classifySmartTourStatusError(new Error('smart_tour_caption_api_failed:503'), 'caption_render_poll')
  assert.equal(diagnostic.retriable, true)
  assert.equal(diagnostic.providerStatus, 503)
  assert.equal(diagnostic.kind, 'caption_api_error')
})

test('does not hide permanent authentication errors from the Interactions API', () => {
  for (const status of [400, 401, 403]) {
    const diagnostic = classifySmartTourStatusError(new Error(`gemini_omni_api_failed:${status}:permanent`), 'interaction_poll')
    assert.equal(diagnostic.retriable, false, String(status))
  }
})

test('makes only a sanitized and bounded Gemini message available to internal logs', () => {
  const sensitive = [
    'Request rejected at https://private.example/path',
    'GEMINI_API_KEY=AIza1234567890abcdefghijklmnop',
    'SUPABASE_SERVICE_ROLE_KEY=eyJabcdefghij.abcdefghij.abcdefghij',
    'Authorization=private-token',
    'Bearer another-private-token',
    'contato corretor@example.com',
    'telefone (11) 98765-4321',
    'x'.repeat(240),
  ].join(' ')
  const error = new Error(`gemini_omni_api_failed:400:${JSON.stringify({ error: { message: sensitive } })}`)
  const message = sanitizeSmartTourStatusProviderMessage(error)

  assert.ok(message.length <= SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH)
  assert.match(message, /^Request rejected at \[url-redacted\]/)
  assert.doesNotMatch(message, /private\.example|AIza|eyJabcdefghij|private-token|corretor@example\.com|98765-4321/)
  assert.deepEqual(classifySmartTourStatusError(error, 'interaction_poll'), {
    stage: 'interaction_poll',
    kind: 'interaction_api_error',
    providerStatus: 400,
    retriable: false,
    providerMessage: message,
  })
})

test('extracts a Gemini message from the client bounded truncated JSON fallback', () => {
  const error = new Error('gemini_omni_api_failed:400:{"error":{"code":400,"message":"Invalid interaction state for completed video')
  const message = sanitizeSmartTourStatusProviderMessage(error)
  assert.equal(message, 'Invalid interaction state for completed video')
})

test('masks interaction ids without exposing short or complete values', () => {
  const interactionId = 'v1_ChdpaFJrYXFXcEhxT2NfdU1QdTlfam1BWRIXaWhSa2FxV3BIcU9jX3VNUHU5X2ptQVk'
  const masked = maskSmartTourInteractionId(interactionId)
  assert.equal(masked, 'v1_Chdpa…5X2ptQVk')
  assert.doesNotMatch(masked, new RegExp(interactionId))
  assert.equal(maskSmartTourInteractionId('short-id'), '')
})

test('does not treat storage or database failures as interaction processing', () => {
  for (const [message, stage] of [
    ['status_video_upload_failed', 'video_upload'],
    ['status_completed_persist_failed', 'completed_persist'],
    ['status_result_url_failed', 'result_url'],
  ] as const) {
    const diagnostic = classifySmartTourStatusError(new Error(message), stage)
    assert.equal(diagnostic.retriable, false)
    assert.equal(diagnostic.kind, message)
  }
})

test('timeout wrapper returns completed operations and rejects stalled ones', async () => {
  assert.equal(await withSmartTourStatusTimeout(Promise.resolve('completed'), 50), 'completed')
  await assert.rejects(
    withSmartTourStatusTimeout(new Promise(() => undefined), 5),
    /smart_tour_status_timeout/,
  )
})

test('status function logs every external boundary without exposing complete identifiers', () => {
  for (const event of [
    'job_lookup_started',
    'interaction_request',
    'interaction_poll_completed',
    'video_upload_started',
    'completed_persist_started',
    'result_url_started',
    'status_error',
  ]) assert.ok(statusSource.includes(event), event)

  assert.doesNotMatch(statusSource, /providerJobId:|interactionId:|userId:|jobId:/)
  assert.doesNotMatch(statusSource, /interactionUrl:|interactionIdFirst8:|interactionIdLast8:/)
  assert.doesNotMatch(statusSource, /console\.(?:info|warn|error)\([^\n]*(?:token|prompt|signedVideoUrl)/i)
  assert.match(statusSource, /providerMessage: diagnostic\.providerMessage/)
  assert.match(statusSource, /interactionIdMasked/)
})

test('status function preserves the existing frontend response contract', () => {
  assert.match(statusSource, /status: 'generating', jobId, message:/)
  assert.match(statusSource, /status: 'completed', jobId, signedVideoUrl:/)
  assert.match(statusSource, /status: 'failed', error:/)
  assert.match(statusSource, /Não foi possível consultar sua apresentação\.' \}, 502/)
  assert.doesNotMatch(statusSource, /error: diagnostic\.providerMessage|message: diagnostic\.providerMessage/)
})

test('status function routes active captions through deterministic composition before completion', () => {
  assert.match(statusSource, /hasDeterministicSmartTourText\(briefing\)/)
  assert.match(statusSource, /startSmartTourCaptionRender/)
  assert.match(statusSource, /checkSmartTourCaptionRender/)
  assert.match(statusSource, /downloadSmartTourCaptionRender/)
  assert.match(statusSource, /smart-tour-gemini\.mp4/)
})

test('polling classification rules remain byte-for-byte unchanged', () => {
  const runtimeSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-status/status-runtime.ts'), 'utf8')
  assert.match(runtimeSource, /new Set\(\[404, 408, 409, 425, 429, 500, 502, 503, 504\]\)/)
  assert.doesNotMatch(runtimeSource, /new Set\(\[[^\]]*400/)
})

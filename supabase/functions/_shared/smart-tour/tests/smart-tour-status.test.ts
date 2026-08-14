import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  SMART_TOUR_STATUS_LOG_MESSAGE_MAX_LENGTH,
  SMART_TOUR_STATUS_TIMEOUT_MS,
  SHORT_VIDEO_PRE_PROVIDER_STALE_MS,
  classifySmartTourProviderDiagnostic,
  classifySmartTourStatusError,
  isShortVideoPreProviderStale,
  maskSmartTourInteractionId,
  sanitizeSmartTourStatusProviderMessage,
  serializeSmartTourStatusDiagnostic,
  withSmartTourStatusTimeout,
} from '../../../smart-tour-status/status-runtime.ts'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const statusSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-status/index.ts'), 'utf8')
const generateSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-generate/index.ts'), 'utf8')
const geminiClientSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/_shared/geminiOmniClient.ts'), 'utf8')

test('Video Imobiliario uses the original single-credential start contract', () => {
  assert.match(geminiClientSource, /Deno\.env\.get\('GEMINI_API_KEY'\)/)
  assert.doesNotMatch(geminiClientSource, /GEMINI_API_KEY_2|GeminiOmniCredentialProfile|credentialProfile|HMAC/)
  assert.match(generateSource, /startGeminiOmniVideo\(\{prompt,images\}\)/)
  assert.match(generateSource, /provider_job_id:started\.interactionId/)
  assert.doesNotMatch(generateSource, /GEMINI_API_KEY_2|video-imobiliario|credentialProfile|encodeGeminiOmniStreamState/)
})

test('status returns completed and failed Video Imobiliário jobs without an active Creations hook', () => {
  assert.match(statusSource, /status: 'completed', jobId, signedVideoUrl:/)
  assert.match(statusSource, /status: 'failed', error:/)
  assert.doesNotMatch(statusSource, /_shared\/creations|registerCompletedCreation|buildVideoImobiliarioCreationInput|creationId|product_key:\s*'video_imobiliario'/)
})

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
    eventType: '',
    providerCode: '',
    providerErrorStatus: '',
    providerErrorType: '',
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
  assert.equal(message, '[provider-detail-redacted]')
  assert.doesNotMatch(message, /private\.example|AIza|secondary-test-key|eyJabcdefghij|private-token|corretor@example\.com|98765-4321/)
  assert.deepEqual(classifySmartTourStatusError(error, 'interaction_poll'), {
    stage: 'interaction_poll',
    kind: 'interaction_api_error',
    eventType: 'http.error',
    providerCode: '400',
    providerErrorStatus: '',
    providerErrorType: '',
    providerStatus: 400,
    retriable: false,
    providerMessage: message,
  })
})

test('preserves only the structured allowlisted provider diagnostic', () => {
  const diagnostic = classifySmartTourProviderDiagnostic({
    source: 'sse',
    eventType: 'error',
    code: 'permission_denied',
    errorStatus: 'PERMISSION_DENIED',
    errorType: 'invalid_request',
    httpStatus: 403,
    retryable: false,
    message: `prompt=private property; https://private.example/file?token=secret Bearer private-token telefone (11) 98765-4321 ${'A'.repeat(120)}`,
  })
  const { providerMessage, ...allowlistedFields } = diagnostic
  assert.deepEqual(allowlistedFields, {
    stage: 'interaction_poll',
    kind: 'interaction_api_error',
    eventType: 'error',
    providerCode: 'permission_denied',
    providerErrorStatus: 'PERMISSION_DENIED',
    providerErrorType: 'invalid_request',
    providerStatus: 403,
    retriable: false,
  })
  assert.equal(providerMessage, '[provider-detail-redacted]')
  const serialized = serializeSmartTourStatusDiagnostic(diagnostic)
  assert.match(serialized, /"event_type":"error"/)
  assert.match(serialized, /"code":"permission_denied"/)
  assert.doesNotMatch(serialized, /private property|private\.example|private-token|98765|AAAAA|prompt=/)
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
  let timeoutCallbackCalled = false
  await assert.rejects(
    withSmartTourStatusTimeout(new Promise(() => undefined), 5, () => { timeoutCallbackCalled = true }),
    /smart_tour_status_timeout/,
  )
  assert.equal(timeoutCallbackCalled, true)
})

test('only stale Short Videos pending jobs without a provider are failed by status recovery', () => {
  const now = Date.parse('2026-08-04T22:00:00.000Z')
  const staleCreatedAt = new Date(now - SHORT_VIDEO_PRE_PROVIDER_STALE_MS).toISOString()
  const recentCreatedAt = new Date(now - SHORT_VIDEO_PRE_PROVIDER_STALE_MS + 1).toISOString()
  assert.equal(isShortVideoPreProviderStale({ mode: 'smart_tour_gemini_omni_short_video', status: 'pending', provider_job_id: null, created_at: staleCreatedAt }, now), true)
  assert.equal(isShortVideoPreProviderStale({ mode: 'smart_tour_gemini_omni_short_video', status: 'pending', provider_job_id: null, created_at: recentCreatedAt }, now), false)
  assert.equal(isShortVideoPreProviderStale({ mode: 'smart_tour_gemini_omni', status: 'pending', provider_job_id: null, created_at: staleCreatedAt }, now), false)
  assert.equal(isShortVideoPreProviderStale({ mode: 'smart_tour_gemini_omni_short_video', status: 'generating', provider_job_id: 'provider', created_at: staleCreatedAt }, now), false)
})

test('stale Short Videos recovery persists failure and removes only the exact owned raw path', () => {
  assert.match(statusSource, /isShortVideoPreProviderStale\(job\)/)
  assert.match(statusSource, /error_message: 'short_video_stale_before_provider'/)
  assert.match(statusSource, /expectedInputPath = `\$\{user\.id\}\/short-videos\/\$\{jobId\}\/input\.mp4`/)
  assert.match(statusSource, /from\('short-videos-inputs'\)\.remove\(\[expectedInputPath\]\)/)
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

test('status performs one resumable SSE query per invocation for images and Short Videos', () => {
  assert.match(statusSource, /job\.mode === 'smart_tour_gemini_omni_short_video'/)
  assert.match(statusSource, /SMART_TOUR_STATUS_TIMEOUT_MS,[\s\S]*pollAbortController\.abort\(\)/)
  assert.match(statusSource, /decodeGeminiOmniStreamState\(job\.provider_job_id\)/)
  assert.match(statusSource, /checkGeminiOmniVideoStream\(interactionId, streamState\.lastEventId, pollAbortController\.signal\)/)
  assert.equal((statusSource.match(/checkGeminiOmniVideoStream\(/g) || []).length, 1)
  assert.match(statusSource, /interaction_cursor_persisted/)
  assert.match(statusSource, /interaction_output_uri_persisted/)
  assert.match(statusSource, /downloadGeminiOmniVideoFromUri\(remote\.videoUri, remote\.contentType\)/)
  assert.doesNotMatch(statusSource, /checkGeminiOmniVideo\(/)
  assert.doesNotMatch(statusSource, /Accept:\s*'application\/json'/)
  assert.doesNotMatch(statusSource, /pollSmartTourInteractionWithRetry|retryable_error|credentialProfile|GEMINI_API_KEY_2|HMAC/)
})

test('status polling never starts a new interaction or reserves tokens', () => {
  assert.doesNotMatch(statusSource, /startGeminiOmni(?:ShortVideo|Video)\(/)
  assert.doesNotMatch(statusSource, /POST\s+\/v1beta\/interactions|createGeminiInteraction|tokens_reserved|smart_tokens|reserve|decrement/i)
})

test('keeps the legacy Short Videos terminal polling and composition behavior', () => {
  assert.match(statusSource, /isShortVideos && remote\.status === 'failed' && !remote\.diagnostic\.eventType/)
  assert.match(statusSource, /short_video_interaction_poll_error/)
  assert.match(statusSource, /return json\(\{ ok: false, error: 'Não foi possível consultar sua apresentação\.' \}, 502\)/)
})

test('only reaches download and completed persistence after a completed MP4 result', () => {
  const failedBranch = statusSource.indexOf("if (remote.status === 'failed')")
  const completedBranch = statusSource.indexOf('const completedStreamState = encodeGeminiOmniStreamState', failedBranch)
  const download = statusSource.indexOf('downloadGeminiOmniVideoFromUri(remote.videoUri', completedBranch)
  const upload = statusSource.indexOf(".upload(outputPath, completedVideo.videoBytes", download)
  const completedPersist = statusSource.indexOf(".update({ status: 'completed', output_video_path: outputPath", upload)
  const resultUrl = statusSource.indexOf("stage = 'result_url'", completedPersist)
  assert.ok(failedBranch >= 0)
  assert.ok(failedBranch < completedBranch)
  assert.ok(completedBranch < download)
  assert.ok(download < upload)
  assert.ok(upload < completedPersist)
  assert.ok(completedPersist < resultUrl)
  assert.match(statusSource, /if \(job\.status === 'completed' && job\.output_video_path\) \{[\s\S]*createSignedUrl\(job\.output_video_path, 3600\)/)
  assert.doesNotMatch(statusSource, /registerVideoImobiliarioCreation|creationId/)
})

test('status function composes only Short Videos and never delivers its raw Gemini video', () => {
  assert.match(statusSource, /if \(isShortVideos\) \{/)
  assert.match(statusSource, /startSmartTourCaptionRender/)
  assert.match(statusSource, /smart-tour-gemini\.mp4/)
  assert.match(statusSource, /const briefing = parseSmartTourStructuredBriefing\(job\.prompt_final\)/)
  assert.match(statusSource, /validateShortVideosFinalMp4/)
  assert.match(statusSource, /encodeSmartTourCaptionRenderId/)
  assert.match(statusSource, /cleanupShortVideoRaw/)
  assert.match(statusSource, /return json\(\{ ok: true, status: 'generating'/)
  assert.doesNotMatch(statusSource, /output_video_path: shortVideoRawPath/)
  assert.match(statusSource, /upload\(outputPath, completedVideo\.videoBytes/)
  assert.doesNotMatch(statusSource, /startGeminiOmni(?:ShortVideo|Video)\(/)
  assert.doesNotMatch(statusSource, /tokens_reserved|smart_tokens|decrement/i)
  assert.match(statusSource, /short_video_composition_\$\{diagnostic\.kind\}/)
  assert.match(statusSource, /update\(\{ status: 'failed', error_message: code \}\)/)
})

test('status function only keeps deterministic composition recovery for legacy jobs already in progress', () => {
  assert.match(statusSource, /checkSmartTourCaptionRender/)
  assert.match(statusSource, /downloadSmartTourCaptionRender/)
  assert.match(statusSource, /decodeSmartTourCaptionRenderId\(job\.provider_job_id\)/)
})

test('polling classification rules remain byte-for-byte unchanged', () => {
  const runtimeSource = readFileSync(path.join(repositoryRoot, 'supabase/functions/smart-tour-status/status-runtime.ts'), 'utf8')
  assert.match(runtimeSource, /new Set\(\[404, 408, 409, 425, 429, 500, 502, 503, 504\]\)/)
  assert.doesNotMatch(runtimeSource, /new Set\(\[[^\]]*400/)
})

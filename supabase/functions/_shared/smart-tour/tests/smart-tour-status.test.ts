import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  classifySmartTourStatusError,
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
  }
})

test('keeps processing when interaction polling reaches its local timeout', () => {
  const diagnostic = classifySmartTourStatusError(new Error('smart_tour_status_timeout'), 'interaction_poll')
  assert.deepEqual(diagnostic, {
    stage: 'interaction_poll',
    kind: 'interaction_timeout',
    providerStatus: null,
    retriable: true,
  })
})

test('does not hide permanent authentication errors from the Interactions API', () => {
  for (const status of [400, 401, 403]) {
    const diagnostic = classifySmartTourStatusError(new Error(`gemini_omni_api_failed:${status}:permanent`), 'interaction_poll')
    assert.equal(diagnostic.retriable, false, String(status))
  }
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
  assert.doesNotMatch(statusSource, /console\.(?:info|warn|error)\([^\n]*(?:token|prompt|signedVideoUrl)/i)
})

test('status function preserves the existing frontend response contract', () => {
  assert.match(statusSource, /status: 'generating', jobId, message:/)
  assert.match(statusSource, /status: 'completed', jobId, signedVideoUrl:/)
  assert.match(statusSource, /status: 'failed', error:/)
  assert.match(statusSource, /Não foi possível consultar sua apresentação\.' \}, 502/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SMART_TOUR_GEMINI_OMNI_DURATION,
  SMART_TOUR_GEMINI_OMNI_MODEL,
  SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL,
  buildGeminiOmniInteractionGetRequest,
  buildGeminiOmniRequestBody,
} from '../../geminiOmniClient.ts'

test('uses the approved Gemini Omni model and documented video contract', () => {
  const images = [
    { type: 'image', data: 'first', mime_type: 'image/jpeg' },
    { type: 'image', data: 'second', mime_type: 'image/png' },
  ]
  const body = buildGeminiOmniRequestBody('prompt', images)
  assert.equal(SMART_TOUR_GEMINI_OMNI_MODEL, 'gemini-omni-flash-preview')
  assert.equal(SMART_TOUR_GEMINI_OMNI_DURATION, '10s')
  assert.equal(SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL, 'high')
  assert.equal(body.model, 'gemini-omni-flash-preview')
  assert.deepEqual(body.input.slice(0, 2), images)
  assert.deepEqual(body.input.at(-1), { type: 'text', text: 'prompt' })
  assert.deepEqual(body.response_format, { type: 'video', duration: '10s', delivery: 'uri' })
  assert.deepEqual(body.generation_config, { thinking_level: 'high', video_config: { task: 'reference_to_video' } })
  assert.equal(body.background, true)
  assert.equal(body.store, true)
  assert.equal('aspect_ratio' in body.response_format, false)
  assert.equal('resolution' in body.response_format, false)
  assert.equal('fps' in body.response_format, false)
})

test('builds the current official Interactions GET contract', () => {
  const rawId = 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/interactions/${rawId}`
  for (const value of [
    rawId,
    `interactions/${rawId}`,
    `/v1beta/interactions/${rawId}`,
    expectedUrl,
    encodeURIComponent(`interactions/${rawId}`),
  ]) {
    const request = buildGeminiOmniInteractionGetRequest(value)
    assert.equal(request.interactionId, rawId)
    assert.equal(request.path, `/interactions/${rawId}`)
    assert.equal(request.url, expectedUrl)
    assert.equal(request.method, 'GET')
    assert.deepEqual(request.headers, { Accept: 'application/json' })
    assert.equal(request.url.includes('key='), false)
  }
})

test('rejects malformed interaction identifiers before calling Google', () => {
  for (const value of ['', 'interactions/', 'bad id', 'https://example.com/interactions/id']) {
    assert.throws(() => buildGeminiOmniInteractionGetRequest(value), /gemini_omni_interaction_id_invalid/)
  }
})

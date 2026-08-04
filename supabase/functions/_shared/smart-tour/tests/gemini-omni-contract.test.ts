import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SMART_TOUR_GEMINI_OMNI_DURATION,
  SMART_TOUR_GEMINI_OMNI_MODEL,
  SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL,
  buildGeminiOmniInteractionGetRequest,
  buildGeminiOmniInteractionStreamRequest,
  buildGeminiOmniRequestBody,
  decodeGeminiOmniStreamState,
  encodeGeminiOmniStreamState,
  parseGeminiOmniSseBlock,
  readGeminiOmniInteractionId,
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
  assert.deepEqual(body.generation_config, { thinking_level: 'high' })
  assert.equal('video_config' in body.generation_config, false)
  assert.doesNotMatch(JSON.stringify(body), /"task"\s*:/)
  assert.equal(body.background, true)
  assert.equal(body.store, true)
  assert.deepEqual(Object.keys(body).sort(), ['background', 'generation_config', 'input', 'model', 'response_format', 'store'])
  assert.equal('aspect_ratio' in body.response_format, false)
  assert.equal('resolution' in body.response_format, false)
  assert.equal('fps' in body.response_format, false)
})

test('adds an optional aspect ratio without changing the default request', () => {
  const images = [{ type: 'image', data: 'first', mime_type: 'image/jpeg' }]
  const current = buildGeminiOmniRequestBody('prompt', images)
  const vertical = buildGeminiOmniRequestBody('prompt', images, '9:16')

  assert.deepEqual(current.response_format, { type: 'video', duration: '10s', delivery: 'uri' })
  assert.deepEqual(vertical.response_format, { type: 'video', duration: '10s', delivery: 'uri', aspect_ratio: '9:16' })
  assert.deepEqual({ ...vertical, response_format: current.response_format }, current)
})

test('sends exactly five distinct images to Gemini in the supplied order', () => {
  const images = Array.from({ length: 5 }, (_, index) => ({ type: 'image', data: `image-${index + 1}`, mime_type: 'image/jpeg' }))
  const body = buildGeminiOmniRequestBody('prompt', images)
  assert.equal(body.input.length, 6)
  assert.deepEqual(body.input.slice(0, 5), images)
  assert.deepEqual(body.input.map(item => item.type), ['image','image','image','image','image','text'])
})

test('builds the current official Interactions GET contract', () => {
  const rawId = 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/interactions/${rawId}`
  const request = buildGeminiOmniInteractionGetRequest(rawId)
  assert.equal(request.interactionId, rawId)
  assert.equal(request.path, `/interactions/${rawId}`)
  assert.equal(request.url, expectedUrl)
  assert.equal(request.method, 'GET')
  assert.deepEqual(request.headers, { Accept: 'application/json' })
  assert.equal(request.url.includes('key='), false)
})

test('builds the official resumable Interactions SSE contract without requesting inline JSON', () => {
  const rawId = 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
  const request = buildGeminiOmniInteractionStreamRequest(rawId, 'event-42')
  assert.equal(request.path, `/interactions/${rawId}?stream=true&last_event_id=event-42`)
  assert.equal(request.method, 'GET')
  assert.deepEqual(request.headers, { Accept: 'text/event-stream', 'Api-Revision': '2026-05-20' })
  assert.equal(request.url.includes('key='), false)
  assert.throws(() => buildGeminiOmniInteractionStreamRequest(rawId, 'bad\nevent'), /gemini_omni_event_id_invalid/)
})

test('parses Gemini SSE cursor and video URI without decoding inline media', () => {
  const video = parseGeminiOmniSseBlock([
    'id: event-43',
    'event: step.delta',
    'data: {"event_type":"step.delta","delta":{"type":"video","mime_type":"video/mp4","uri":"https://generativelanguage.googleapis.com/v1beta/files/output"}}',
  ].join('\n'))
  assert.equal(video?.eventType, 'step.delta')
  assert.equal(video?.eventId, 'event-43')
  assert.deepEqual(video?.payload, {
    event_type: 'step.delta',
    delta: { type: 'video', mime_type: 'video/mp4', uri: 'https://generativelanguage.googleapis.com/v1beta/files/output' },
  })
  assert.equal(parseGeminiOmniSseBlock(': keep-alive'), null)
})

test('persists and restores the SSE cursor and final URI without changing the interaction id', () => {
  const state = {
    interactionId: 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
    lastEventId: 'event-43',
    videoUri: 'https://generativelanguage.googleapis.com/v1beta/files/output',
    contentType: 'video/mp4',
  }
  const persisted = encodeGeminiOmniStreamState(state)
  assert.match(persisted, /^gemini-sse-state:/)
  assert.deepEqual(decodeGeminiOmniStreamState(persisted), state)
  assert.deepEqual(decodeGeminiOmniStreamState(state.interactionId), {
    interactionId: state.interactionId,
    lastEventId: '',
    videoUri: '',
    contentType: 'video/mp4',
  })
})

test('persists exactly Interaction.id from the create response', () => {
  const created = readGeminiOmniInteractionId({
    status: 'in_progress',
    id: 'v1_ExactInteractionId',
    object: 'interaction',
  })
  assert.equal(created.interactionId, 'v1_ExactInteractionId')
  assert.equal(created.providerIdSource, 'id')
  assert.deepEqual(created.responseKeys, ['id', 'object', 'status'])
  assert.equal(readGeminiOmniInteractionId({ id: 'v1_Id-With=Opaque:Characters' }).interactionId, 'v1_Id-With=Opaque:Characters')
})

test('rejects resource names and malformed identifiers instead of normalizing them', () => {
  for (const value of ['', 'interactions/id', '/v1beta/interactions/id', 'bad id', 'https://generativelanguage.googleapis.com/v1beta/interactions/id']) {
    assert.throws(() => buildGeminiOmniInteractionGetRequest(value), /gemini_omni_interaction_id_invalid/)
  }
  assert.throws(() => readGeminiOmniInteractionId({ name: 'interactions/id' }), /gemini_omni_interaction_id_missing/)
})

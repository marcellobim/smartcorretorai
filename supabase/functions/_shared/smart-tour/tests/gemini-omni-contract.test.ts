import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SMART_TOUR_GEMINI_OMNI_DURATION,
  SMART_TOUR_GEMINI_OMNI_MODEL,
  SMART_TOUR_GEMINI_OMNI_THINKING_LEVEL,
  buildGeminiOmniInteractionGetRequest,
  buildGeminiOmniInteractionStreamRequest,
  buildGeminiOmniRequestBody,
  classifyGeminiOmniHttpError,
  classifyGeminiOmniSseError,
  decodeGeminiOmniStreamState,
  downloadGeminiOmniVideoFromUri,
  encodeGeminiOmniStreamState,
  evaluateGeminiOmniSseEvent,
  parseGeminiOmniSseBlock,
  readGeminiOmniInteractionId,
  startGeminiOmniVideo,
  validateGeminiOmniVideoUri,
} from '../../geminiOmniClient.ts'

test('starts Video Imobiliario with the original Gemini environment only', async () => {
  const previousFetch = globalThis.fetch
  const previousDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno
  const requestedEnvironmentNames: string[] = []
  let apiKeyHeader = ''
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: (name: string) => {
      requestedEnvironmentNames.push(name)
      return name === 'GEMINI_API_KEY' ? 'primary-test-key' : ''
    } } },
  })
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    apiKeyHeader = new Headers(init?.headers).get('x-goog-api-key') || ''
    return new Response(JSON.stringify({ id: 'v1_original_contract', status: 'in_progress' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  try {
    const started = await startGeminiOmniVideo({
      prompt: 'safe fixture',
      images: [{ type: 'image', data: 'fixture', mime_type: 'image/jpeg' }],
    })
    assert.equal(started.interactionId, 'v1_original_contract')
    assert.deepEqual(requestedEnvironmentNames, ['GEMINI_API_KEY'])
    assert.equal(apiKeyHeader, 'primary-test-key')
  } finally {
    globalThis.fetch = previousFetch
    if (previousDeno === undefined) delete (globalThis as typeof globalThis & { Deno?: unknown }).Deno
    else Object.defineProperty(globalThis, 'Deno', { configurable: true, value: previousDeno })
  }
})

test('never exposes an echoed prompt when the original start request fails', async () => {
  const previousFetch = globalThis.fetch
  const previousDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: (name: string) => name === 'GEMINI_API_KEY' ? 'primary-test-key' : '' } },
  })
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: { code: 400, message: 'prompt=PRIVATE_PROPERTY_ADDRESS' },
  }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch
  try {
    await assert.rejects(
      startGeminiOmniVideo({
        prompt: 'safe fixture',
        images: [{ type: 'image', data: 'fixture', mime_type: 'image/jpeg' }],
      }),
      error => {
        assert.doesNotMatch(String(error), /PRIVATE_PROPERTY_ADDRESS/)
        assert.match(String(error), /provider-detail-redacted/)
        return true
      },
    )
  } finally {
    globalThis.fetch = previousFetch
    if (previousDeno === undefined) delete (globalThis as typeof globalThis & { Deno?: unknown }).Deno
    else Object.defineProperty(globalThis, 'Deno', { configurable: true, value: previousDeno })
  }
})

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
    'data: {"event_type":"step.delta","delta":{"type":"video","mime_type":"video/mp4","uri":"https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media"}}',
  ].join('\n'))
  assert.equal(video?.eventType, 'step.delta')
  assert.equal(video?.eventId, 'event-43')
  assert.deepEqual(video?.payload, {
    event_type: 'step.delta',
    delta: { type: 'video', mime_type: 'video/mp4', uri: 'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media' },
  })
  assert.equal(parseGeminiOmniSseBlock(': keep-alive'), null)
})

test('treats interaction.failed as terminal before any residual video URI', () => {
  const result = evaluateGeminiOmniSseEvent({
    eventType: 'interaction.failed',
    eventId: 'event-failed',
    payload: {
      event_type: 'interaction.failed',
      error: { code: 503, status: 'UNAVAILABLE', type: 'api_error', message: 'Provider failed safely.' },
      output: { type: 'video', mime_type: 'video/mp4', uri: 'https://example.invalid/residual.mp4' },
    },
  })
  assert.equal(result?.status, 'failed')
  if (result?.status !== 'failed') throw new Error('expected_terminal_failure')
  assert.deepEqual(result.diagnostic, {
    source: 'sse',
    eventType: 'interaction.failed',
    code: '503',
    errorStatus: 'UNAVAILABLE',
    errorType: 'api_error',
    httpStatus: 503,
    message: 'Provider failed safely.',
    retryable: false,
  })
  assert.equal(result.lastEventId, 'event-failed')
})

test('keeps SSE error events terminal while preserving their safe diagnostic', () => {
  for (const httpStatus of [408, 429, 500, 502, 503, 504]) {
    const diagnostic = classifyGeminiOmniSseError('error', { error: { code: httpStatus, message: 'Temporary provider error.' } })
    assert.equal(diagnostic.httpStatus, httpStatus)
    assert.equal(diagnostic.retryable, true, String(httpStatus))
    const result = evaluateGeminiOmniSseEvent({ eventType: 'error', eventId: `event-${httpStatus}`, payload: { error: { code: httpStatus } } })
    assert.equal(result?.status, 'failed', String(httpStatus))
    if (result?.status !== 'failed') throw new Error('expected_terminal_failure')
    assert.equal(result.diagnostic.retryable, false)
  }
})

test('fails closed for permanent SSE and HTTP polling errors', () => {
  for (const httpStatus of [400, 401, 403]) {
    const sse = classifyGeminiOmniSseError('error', { error: { code: httpStatus, message: 'Permanent provider error.' } })
    const http = classifyGeminiOmniHttpError(httpStatus, JSON.stringify({ error: { code: httpStatus, message: 'Permanent provider error.' } }))
    assert.equal(sse.retryable, false, `sse:${httpStatus}`)
    assert.equal(http.retryable, false, `http:${httpStatus}`)
    const result = evaluateGeminiOmniSseEvent({ eventType: 'error', eventId: '', payload: { error: { code: httpStatus } } })
    assert.equal(result?.status, 'failed', String(httpStatus))
  }
  assert.equal(classifyGeminiOmniHttpError(503, '{"error":{"message":"temporary"}}').retryable, true)
  assert.equal(classifyGeminiOmniSseError('error', { error: { code: 'api_error', status_code: 400 } }).retryable, false)
  assert.equal(classifyGeminiOmniSseError('error', { error: { code: 'resource_exhausted', http_status: 403 } }).retryable, false)
})

test('keeps only allowlisted sanitized provider diagnostics', () => {
  const diagnostic = classifyGeminiOmniSseError('error', {
    error: {
      code: 'permission_denied',
      status: 'PERMISSION_DENIED',
      type: 'invalid_request',
      message: `prompt=private property; https://private.example/path Bearer private-token telefone (11) 98765-4321 ${'A'.repeat(120)}`,
      details: [{ reason: 'safe-reason', metadata: { briefing: 'private-briefing' } }],
    },
    prompt: 'private-prompt',
    base64: 'private-base64',
  })
  const serialized = JSON.stringify(diagnostic)
  assert.equal(diagnostic.eventType, 'error')
  assert.equal(diagnostic.code, 'permission_denied')
  assert.equal(diagnostic.errorStatus, 'PERMISSION_DENIED')
  assert.equal(diagnostic.errorType, 'invalid_request')
  assert.equal(diagnostic.retryable, false)
  assert.doesNotMatch(serialized, /private property|private\.example|private-token|98765|private-briefing|private-prompt|private-base64|AAAAA/)
  assert.equal(diagnostic.message, '[provider-detail-redacted]')
})

test('fails closed when provider messages echo quoted JSON secrets or partial prompt values', () => {
  for (const message of [
    'Request payload {"prompt":"SECRET_ADDRESS, SECRET_CITY","briefing":"SECRET_BRIEFING"}',
    'Request payload {"api_key":"short-secret"}',
    'GEMINI_API_KEY=primary-test-key',
    'prompt=SECRET_ADDRESS, trailing SECRET_CITY',
    'Request payload {"access_token":"short-token","phone":"11987654321"}',
  ]) {
    const diagnostic = classifyGeminiOmniSseError('error', { error: { code: 400, message } })
    assert.equal(diagnostic.message, '[provider-detail-redacted]')
    assert.doesNotMatch(JSON.stringify(diagnostic), /SECRET|short-secret|short-token|11987654321/)
  }
})

test('parses a bounded complete HTTP error before extracting only safe fields', () => {
  const diagnostic = classifyGeminiOmniHttpError(429, JSON.stringify({
    error: { code: 429, status: 'RESOURCE_EXHAUSTED', type: 'quota', message: 'Temporary quota limit.' },
    ignored: 'x'.repeat(8_000),
  }))
  assert.equal(diagnostic.eventType, '')
  assert.equal(diagnostic.code, '429')
  assert.equal(diagnostic.errorStatus, 'RESOURCE_EXHAUSTED')
  assert.equal(diagnostic.httpStatus, 429)
  assert.equal(diagnostic.retryable, true)
  assert.doesNotMatch(JSON.stringify(diagnostic), /"ignored"|xxxxxxxx/)
})

test('persists the resumable SSE state without profiles or signatures', () => {
  const state = {
    interactionId: 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
    lastEventId: 'event-43',
    videoUri: 'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media',
    contentType: 'video/mp4',
  }
  const persisted = encodeGeminiOmniStreamState(state)
  assert.match(persisted, /^gemini-sse-state:/)
  assert.doesNotMatch(persisted, /credentialProfile|signature|HMAC/i)
  assert.deepEqual(decodeGeminiOmniStreamState(persisted), state)
  assert.deepEqual(decodeGeminiOmniStreamState(state.interactionId), {
    interactionId: state.interactionId,
    lastEventId: '',
    videoUri: '',
    contentType: 'video/mp4',
  })
})

test('allows credentials only on the official Gemini file download origin', async () => {
  const officialUri = 'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media'
  assert.equal(validateGeminiOmniVideoUri(officialUri), officialUri)
  for (const unsafeUri of [
    'https://attacker.example/video.mp4',
    'https://generativelanguage.googleapis.com.attacker.example/v1beta/files/output-id:download?alt=media',
    'https://generativelanguage.googleapis.com/v1beta/interactions/output-id:download?alt=media',
    'https://generativelanguage.googleapis.com/v1beta/files/output-id?alt=media',
    'https://generativelanguage.googleapis.com/v1beta/files/output-id:download',
    'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media&key=fixture',
    'https://user@generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media',
    'http://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media',
    'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media#fragment',
    'not-a-url',
  ]) {
    assert.throws(() => validateGeminiOmniVideoUri(unsafeUri), /gemini_omni_video_uri_invalid/)
    assert.throws(
      () => encodeGeminiOmniStreamState({
        interactionId: 'v1_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
        lastEventId: '',
        videoUri: unsafeUri,
        contentType: 'video/mp4',
      }),
      /gemini_omni_video_uri_invalid/,
    )
  }
})

test('rejects an untrusted video URI before reading a credential or starting fetch', async () => {
  await assert.rejects(
    downloadGeminiOmniVideoFromUri('https://attacker.example/video.mp4', 'video/mp4'),
    /gemini_omni_video_uri_invalid/,
  )
})

test('never forwards the Gemini credential to a validated Google download redirect', async () => {
  const previousFetch = globalThis.fetch
  const previousDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno
  const requests: Array<{ url: string; apiKey: string }> = []
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: (name: string) => name === 'GEMINI_API_KEY' ? 'primary-test-key' : '' } },
  })
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    requests.push({ url: String(input), apiKey: headers.get('x-goog-api-key') || '' })
    if (requests.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://storage.googleapis.com/provider-output/video.mp4' },
      })
    }
    return new Response(new Uint8Array([0, 1, 2]), { status: 200 })
  }) as typeof fetch
  try {
    const downloaded = await downloadGeminiOmniVideoFromUri(
      'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media',
      'video/mp4',
    )
    assert.deepEqual([...downloaded.videoBytes], [0, 1, 2])
    assert.equal(requests.length, 2)
    assert.equal(requests[0].apiKey, 'primary-test-key')
    assert.equal(requests[1].apiKey, '')
    assert.match(requests[1].url, /^https:\/\/storage\.googleapis\.com\//)
  } finally {
    globalThis.fetch = previousFetch
    if (previousDeno === undefined) delete (globalThis as typeof globalThis & { Deno?: unknown }).Deno
    else Object.defineProperty(globalThis, 'Deno', { configurable: true, value: previousDeno })
  }
})

test('blocks an untrusted redirect before a second request can start', async () => {
  const previousFetch = globalThis.fetch
  const previousDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno
  let requestCount = 0
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: (name: string) => name === 'GEMINI_API_KEY' ? 'primary-test-key' : '' } },
  })
  globalThis.fetch = (async () => {
    requestCount += 1
    return new Response(null, {
      status: 302,
      headers: { location: 'https://attacker.example/video.mp4' },
    })
  }) as typeof fetch
  try {
    await assert.rejects(
      downloadGeminiOmniVideoFromUri(
        'https://generativelanguage.googleapis.com/v1beta/files/output-id:download?alt=media',
        'video/mp4',
      ),
      /gemini_omni_video_redirect_invalid/,
    )
    assert.equal(requestCount, 1)
  } finally {
    globalThis.fetch = previousFetch
    if (previousDeno === undefined) delete (globalThis as typeof globalThis & { Deno?: unknown }).Deno
    else Object.defineProperty(globalThis, 'Deno', { configurable: true, value: previousDeno })
  }
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

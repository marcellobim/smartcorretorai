import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSmartCarouselDiagnostic,
  parseSmartCarouselErrorResponse,
  sanitizeSmartCarouselDiagnosticText,
  smartCarouselResponseDiagnostic,
} from '../src/lib/smart-carousel-diagnostics.js'

const clientRequestId = 'a0f65a23-5b7a-4ad0-a304-426730e20abc'

function capture() {
  const events = []
  return {
    events,
    diagnostic: createSmartCarouselDiagnostic({
      enabled: true,
      now: () => '2026-10-11T20:59:00.000Z',
      logger: { info: (_label, entry) => events.push(entry) },
    }),
  }
}

function mockedResponse(status, body, requestId = 'req_abc123') {
  return {
    status,
    headers: { get: name => name === 'x-request-id' ? requestId : null },
    text: async () => JSON.stringify(body),
  }
}

test('records a mocked backend 400 without retaining response-sensitive content', async () => {
  const { events, diagnostic } = capture()
  const response = mockedResponse(400, { error: 'professional_identity_invalid' })
  const body = await parseSmartCarouselErrorResponse(response)
  diagnostic('carousel_request_started', { client_request_id: clientRequestId })
  diagnostic('carousel_request_response', { client_request_id: clientRequestId, ...smartCarouselResponseDiagnostic(response, body) })
  diagnostic('carousel_request_failed', { client_request_id: clientRequestId, ...smartCarouselResponseDiagnostic(response, body) })
  assert.deepEqual(events.map(event => event.phase), ['carousel_request_started', 'carousel_request_response', 'carousel_request_failed'])
  assert.equal(events.at(-1).status_http, 400)
  assert.equal(events.at(-1).request_id, 'req_abc123')
  assert.equal(events.at(-1).error_code, 'professional_identity_invalid')
})

test('records a mocked backend 500 with its status and safe server code', async () => {
  const { events, diagnostic } = capture()
  const response = mockedResponse(500, { code: 'marketing_schema_invalid' })
  const body = await parseSmartCarouselErrorResponse(response)
  diagnostic('carousel_request_response', { client_request_id: clientRequestId, ...smartCarouselResponseDiagnostic(response, body) })
  diagnostic('carousel_request_failed', { client_request_id: clientRequestId, ...smartCarouselResponseDiagnostic(response, body) })
  assert.equal(events.at(-1).status_http, 500)
  assert.equal(events.at(-1).error_code, 'marketing_schema_invalid')
})

test('records client-side validation and upload failures before a request is possible', () => {
  const { events, diagnostic } = capture()
  diagnostic('validation_started', { client_request_id: clientRequestId })
  diagnostic('validation_failed', { client_request_id: clientRequestId, error_code: 'incomplete_questions' })
  diagnostic('validation_started', { client_request_id: clientRequestId })
  diagnostic('validation_passed', { client_request_id: clientRequestId })
  diagnostic('uploads_started', { client_request_id: clientRequestId })
  diagnostic('upload_failed', { client_request_id: clientRequestId, error_code: 'upload_failed' })
  assert.deepEqual(events.map(event => event.phase), ['validation_started', 'validation_failed', 'validation_started', 'validation_passed', 'uploads_started', 'upload_failed'])
  assert.equal(events.some(event => event.phase === 'carousel_request_started'), false)
})

test('records a mocked successful request after validation, upload and body construction', () => {
  const { events, diagnostic } = capture()
  diagnostic('validation_started', { client_request_id: clientRequestId })
  diagnostic('validation_passed', { client_request_id: clientRequestId })
  diagnostic('uploads_started', { client_request_id: clientRequestId })
  diagnostic('uploads_completed', { client_request_id: clientRequestId })
  diagnostic('request_body_built', { client_request_id: clientRequestId })
  diagnostic('carousel_request_started', { client_request_id: clientRequestId })
  diagnostic('carousel_request_response', { client_request_id: clientRequestId, status_http: 200, request_id: 'req_ok' })
  assert.deepEqual(events.map(event => event.phase), ['validation_started', 'validation_passed', 'uploads_started', 'uploads_completed', 'request_body_built', 'carousel_request_started', 'carousel_request_response'])
})

test('redacts values shaped like credentials, contacts, URLs and tokens', () => {
  for (const sensitive of ['Bearer abc.def.ghi', 'https://signed.example/path', 'person@example.com', '+1 (212) 555-0199', 'License #123456 · SP']) {
    assert.equal(sanitizeSmartCarouselDiagnosticText(sensitive), 'redacted')
  }
})

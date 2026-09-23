import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTikTokOAuthTelemetryEvent,
  getTikTokOAuthFailure,
  logTikTokOAuthEvent,
  TikTokOAuthTelemetryError,
} from '../telemetry.ts'

const SENSITIVE = {
  code: 'fake-authorization-code',
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  client_secret: 'fake-client-secret',
}

test('telemetry emits only allowlisted scalar metadata', () => {
  const event = createTikTokOAuthTelemetryEvent({
    stage: 'token_exchange', http_status: 200, provider_code: 'ok', scope_count: 1,
    state_consumed: true, token_rotated: false, account_resolved: true,
    ...SENSITIVE,
  } as never)
  assert.deepEqual(event, {
    event: 'tiktok_oauth', stage: 'token_exchange', http_status: 200, provider_code: 'ok', scope_count: 1,
    state_consumed: true, token_rotated: false, account_resolved: true,
  })
  assert.doesNotMatch(JSON.stringify(event), /fake-|access_token|refresh_token|client_secret|"code"/)
})

test('unsafe provider and database codes are discarded', () => {
  const event = createTikTokOAuthTelemetryEvent({
    stage: 'database', provider_code: 'contains token value', supabase_code: 'bad\nvalue', http_status: 999,
  })
  assert.deepEqual(event, { event: 'tiktok_oauth', stage: 'database' })
})

test('logger serializes the sanitized event only', () => {
  const messages: string[] = []
  logTikTokOAuthEvent(message => messages.push(message), {
    stage: 'success', account_resolved: true, ...SENSITIVE,
  } as never)
  assert.equal(messages.length, 1)
  assert.doesNotMatch(messages[0], /fake-|access_token|refresh_token|client_secret|"code"/)
})

test('telemetry errors expose stable errors and sanitized failure metadata', () => {
  const error = new TikTokOAuthTelemetryError({ stage: 'token_refresh', http_status: 401, provider_code: 'access_denied' })
  assert.equal(error.message, 'tiktok_oauth_failed')
  assert.deepEqual(getTikTokOAuthFailure(error), {
    event: 'tiktok_oauth', stage: 'token_refresh', http_status: 401, provider_code: 'access_denied',
  })
  assert.deepEqual(getTikTokOAuthFailure(new Error('secret provider message'), 'state'), {
    event: 'tiktok_oauth', stage: 'state',
  })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260820010000_create_stripe_transactional_email_idempotency.sql', import.meta.url), 'utf8')

test('transactional email idempotency is durable and restricted to service_role', () => {
  assert.match(sql, /CREATE TABLE public\.stripe_transactional_email_deliveries/i)
  assert.match(sql, /idempotency_key TEXT PRIMARY KEY/i)
  assert.match(sql, /UNIQUE \(stripe_event_id, template\)/i)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*?PUBLIC, anon, authenticated/i)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/i)
})

test('claim prevents sent and concurrent duplicate deliveries but permits failed retries', () => {
  assert.match(sql, /v_delivery\.status = 'sent'/i)
  assert.match(sql, /v_delivery\.status = 'sending'[\s\S]*?INTERVAL '15 minutes'/i)
  assert.match(sql, /SET status = 'sending',[\s\S]*?attempts = attempts \+ 1/i)
  assert.match(sql, /CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END/i)
})

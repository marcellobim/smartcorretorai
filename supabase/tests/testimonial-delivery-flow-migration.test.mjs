import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260822020000_create_testimonial_delivery_flow.sql', import.meta.url), 'utf8')

test('submission idempotency is scoped to the authenticated account', () => {
  assert.match(sql, /ADD COLUMN submission_idempotency_key UUID NULL/)
  assert.match(sql, /CREATE UNIQUE INDEX testimonials_user_submission_idempotency_idx[\s\S]*ON public\.testimonials\(user_id, submission_idempotency_key\)[\s\S]*WHERE submission_idempotency_key IS NOT NULL/)
})

test('testimonial delivery table has a constrained per-template state machine', () => {
  assert.match(sql, /CREATE TABLE public\.testimonial_email_deliveries/)
  assert.match(sql, /PRIMARY KEY \(testimonial_id, template\)/)
  assert.match(sql, /template IN \('received', 'bonus_granted'\)/)
  assert.match(sql, /status IN \('sending', 'sent', 'failed'\)/)
  assert.match(sql, /attempts >= 0/)
  assert.match(sql, /REFERENCES public\.testimonials\(id\) ON DELETE CASCADE/)
})

test('delivery rows are private and mutations are exposed only through service-role RPCs', () => {
  assert.match(sql, /ALTER TABLE public\.testimonial_email_deliveries ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.testimonial_email_deliveries[\s\S]*FROM PUBLIC, anon, authenticated, service_role/)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.claim_testimonial_email\(UUID, TEXT\)[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_testimonial_email\(UUID, TEXT\) TO service_role/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.complete_testimonial_email\(UUID, TEXT, BOOLEAN, TEXT, TEXT\) TO service_role/)
})

test('claim prevents duplicates while permitting failed and stale retries', () => {
  assert.match(sql, /v_delivery\.status = 'sent'/)
  assert.match(sql, /v_delivery\.status = 'sending'[\s\S]*INTERVAL '15 minutes'/)
  assert.match(sql, /attempts = d\.attempts \+ 1/)
  assert.match(sql, /SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END/)
  assert.match(sql, /last_error_code = CASE WHEN p_succeeded THEN NULL ELSE pg_catalog\.left\(p_error_code, 100\) END/)
})

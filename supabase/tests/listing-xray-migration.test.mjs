import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sql = await readFile(new URL('../migrations/20260830010000_create_listing_xray_requests.sql', import.meta.url), 'utf8')

test('migration é isolada, owner-scoped e inacessível ao browser', () => {
  assert.match(sql, /CREATE TABLE public\.listing_xray_requests/)
  assert.match(sql, /UNIQUE \(user_id, product_code, client_request_id\)/)
  assert.match(sql, /WHERE r\.user_id=p_user_id AND r\.client_request_id=p_client_request_id/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.listing_xray_requests FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /smart_tokens_quoted BIGINT NOT NULL DEFAULT 10/)
})

test('migration cobre reserva, settlement e release atômicos de exatamente 10 ST', () => {
  assert.match(sql, /reserve_credits_from_lots\(p_user_id,10/)
  assert.match(sql, /consume_reserved_credits_from_lots/)
  assert.match(sql, /cancel_credit_reservation_from_lots/)
  assert.match(sql, /smart_tokens_consumed=10/)
  assert.match(sql, /smart_tokens_refunded=smart_tokens_reserved/)
  assert.match(sql, /listing_xray_economy_key_unique UNIQUE \(user_id, idempotency_key\)/)
})

test('migration cobre captura adicional, recovery, TTL de 24h e limpeza', () => {
  assert.match(sql, /status='awaiting_input'/)
  assert.match(sql, /INTERVAL '30 minutes'/)
  assert.match(sql, /IF v_request\.status='completed' THEN RETURN NEXT v_request/)
  assert.match(sql, /expires_at=pg_catalog\.now\(\)\+INTERVAL '24 hours'/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.cleanup_listing_xray_requests/)
  assert.match(sql, /result=NULL,normalized_facts=NULL/)
})

test('telemetria não contém PII e separa custo OpenAI de Smart Tokens', () => {
  assert.match(sql, /economic_generation_events/)
  assert.match(sql, /estimated_cost_micros/)
  assert.match(sql, /'input_kind',v_request\.input_kind/)
  assert.doesNotMatch(sql, /source_url_sanitized.*economic_generation_events/)
})

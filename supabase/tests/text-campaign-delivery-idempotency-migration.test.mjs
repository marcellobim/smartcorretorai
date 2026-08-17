import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260817010000_create_text_campaign_delivery_idempotency.sql', import.meta.url), 'utf8')

test('creates a small private product-specific delivery table with technical retention', () => {
  assert.match(sql, /CREATE TABLE public\.text_campaign_delivery_requests/)
  assert.match(sql, /UNIQUE \(user_id, product_code, client_request_id\)/)
  assert.match(sql, /status IN \('processing', 'completed', 'failed', 'expired'\)/)
  assert.match(sql, /INTERVAL '15 minutes'/)
  assert.match(sql, /INTERVAL '24 hours'/)
  assert.match(sql, /INTERVAL '30 days'/)
  assert.doesNotMatch(sql, /economic_generation_events[\s\S]*result/i)
})

test('browser roles have no table or function access and every RPC checks service_role', () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.text_campaign_delivery_requests FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(sql, /CREATE POLICY/)
  for (const fn of ['claim_text_campaign_delivery', 'attach_text_campaign_reservation', 'complete_text_campaign_delivery', 'fail_text_campaign_delivery', 'cleanup_text_campaign_deliveries']) {
    const start = sql.indexOf(`FUNCTION public.${fn}`)
    assert.ok(start >= 0, fn)
    const section = sql.slice(start, sql.indexOf('$$;', start) + 3)
    assert.match(section, /SECURITY DEFINER/)
    assert.match(section, /SET search_path = ''/)
    assert.match(section, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
    assert.match(sql, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\(`))
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^;]+ TO service_role`))
  }
})

test('claim is atomic and only the inserted caller receives the claim token', () => {
  assert.match(sql, /ON CONFLICT \(user_id, product_code, client_request_id\) DO NOTHING/)
  assert.match(sql, /IF FOUND THEN[\s\S]*v_request\.claim_token[\s\S]*TRUE/)
  assert.match(sql, /RETURN QUERY SELECT v_request\.id, v_request\.status, NULL::UUID[\s\S]*FALSE/)
})

test('result and consumption are committed atomically in the required order', () => {
  const resultWrite = sql.indexOf('SET result = p_result')
  const consume = sql.indexOf('consume_reserved_credits_from_lots', resultWrite)
  const completed = sql.indexOf("SET status = 'completed'", consume)
  assert.ok(resultWrite >= 0 && resultWrite < consume && consume < completed)
  assert.match(sql, /IF v_reservation\.status <> 'consumed' THEN RAISE EXCEPTION/)
})

test('failure and stale cleanup cancel the exact lot reservation before terminal state', () => {
  const failure = sql.indexOf('FUNCTION public.fail_text_campaign_delivery')
  const failureEnd = sql.indexOf('$$;', failure)
  const section = sql.slice(failure, failureEnd)
  assert.ok(section.indexOf('cancel_credit_reservation_from_lots') < section.indexOf("SET status = 'failed'"))
  assert.match(sql, /status = 'processing' AND t\.expires_at <= pg_catalog\.now\(\)/)
  assert.match(sql, /v_request\.expires_at <= pg_catalog\.now\(\) AND v_request\.status = 'processing'[\s\S]*text_campaign_claim_expired[\s\S]*SET status = 'expired'/)
  assert.match(sql, /text_campaign_claim_expired/)
  assert.match(sql, /SET status = 'expired', result = NULL/)
})

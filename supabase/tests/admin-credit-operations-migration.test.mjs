import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260820020000_create_admin_credit_operations.sql', import.meta.url), 'utf8')

test('admin adjustments are private, audited and use canonical credit lots', () => {
  assert.match(sql, /CREATE TABLE public\.admin_credit_adjustments/)
  assert.match(sql, /source, original_amount[\s\S]*'admin', p_amount/)
  assert.match(sql, /admin_user_id UUID NOT NULL/)
  assert.match(sql, /reason TEXT NOT NULL/)
  assert.match(sql, /amount BIGINT NOT NULL CHECK \(amount BETWEEN 1 AND 10000\)/)
  assert.match(sql, /p_amount NOT BETWEEN 1 AND 10000/)
  assert.match(sql, /idempotency_key UUID NOT NULL UNIQUE/)
  assert.match(sql, /p_user_id, 'admin', p_amount, p_amount, NULL, 'active'/)
  assert.match(sql, /sync_credit_balance_cache_from_lots\(p_user_id\)/)
  assert.match(sql, /ALTER TABLE public\.admin_credit_adjustments ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON TABLE public\.admin_credit_adjustments FROM PUBLIC, anon, authenticated/)
})

test('grant RPC is service-role only, verifies the admin and is idempotent', () => {
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /FROM public\.admin_users au WHERE au\.user_id = p_admin_user_id/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /already_processed/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.grant_admin_credit_lot[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.grant_admin_credit_lot[\s\S]*TO service_role/)
})

test('aggregate RPCs use current lot ledger and persisted product activity', () => {
  assert.match(sql, /admin_credit_overview/)
  assert.match(sql, /credit_reservation_allocations/)
  assert.match(sql, /admin_client_credit_metrics/)
  assert.match(sql, /admin_client_activity_metrics/)
  assert.match(sql, /admin_generation_activity_overview/)
  assert.match(sql, /quick_banner_delivery_items/)
  assert.match(sql, /real_estate_banner_items/)
  assert.doesNotMatch(sql, /creditos_avulsos|add_credits/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260817020000_create_quick_banner_delivery_economy.sql', import.meta.url), 'utf8')

test('creates private parent, item and per-lot item allocation tables', () => {
  for (const table of ['quick_banner_delivery_requests', 'quick_banner_delivery_items', 'quick_banner_item_allocations']) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}`))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`))
  }
  assert.match(sql, /UNIQUE \(user_id, product_code, client_request_id\)/)
  assert.match(sql, /unit_cost BIGINT NOT NULL DEFAULT 45 CHECK \(unit_cost = 45\)/)
})

test('all economic RPCs are service-role-only and have hardened search paths', () => {
  for (const fn of [
    'claim_quick_banner_delivery', 'attach_quick_banner_reservation', 'begin_quick_banner_execution',
    'mark_quick_banner_item_rendering', 'finalize_quick_banner_item', 'settle_quick_banner_delivery',
    'fail_quick_banner_prepared_delivery',
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`))
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([\\s\\S]*?TO service_role`))
  }
  assert.equal((sql.match(/SECURITY DEFINER SET search_path = ''/g) || []).length, 7)
  assert.equal((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g) || []).length, 7)
})

test('claim is atomic, validates 1..5 and protects retry ownership', () => {
  assert.match(sql, /v_count < 1 OR v_count > 5/)
  assert.match(sql, /ON CONFLICT \(user_id, product_code, client_request_id\) DO NOTHING/)
  assert.match(sql, /v_original\.status <> 'failed'/)
  assert.match(sql, /v_original\.retry_request_id IS NOT NULL/)
  assert.match(sql, /r\.id = v_original\.request_id AND r\.user_id = p_user_id/)
})

test('every item mutation is scoped to the authenticated owner passed by the service runtime', () => {
  assert.match(sql, /r\.user_id=p_user_id AND r\.client_request_id=p_client_request_id AND r\.claim_token=p_claim_token/)
  assert.match(sql, /WHERE i\.id=p_item_id AND r\.user_id=p_user_id/)
  assert.match(sql, /WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE/)
})

test('one total reservation is split into 45 ST item slices in FEFO order', () => {
  const attach = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.attach_quick_banner_reservation'), sql.indexOf('CREATE OR REPLACE FUNCTION public.begin_quick_banner_execution'))
  assert.match(attach, /v_reservation\.amount <> v_request\.smart_tokens_quoted/)
  assert.match(attach, /smart_tokens_reserved = smart_tokens_quoted/)
  assert.match(attach, /v_missing := v_item\.unit_cost/)
  assert.match(attach, /ORDER BY cl\.expires_at ASC NULLS LAST, cl\.created_at, cl\.id/)
  assert.match(attach, /quick_banner_item_allocations\(item_id, lot_id, amount\)/)
})

test('settlement consumes completed slices, refunds failures and is terminally idempotent', () => {
  const settle = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.settle_quick_banner_delivery'), sql.indexOf('CREATE OR REPLACE FUNCTION public.fail_quick_banner_prepared_delivery'))
  assert.match(settle, /IF v_request\.status IN \('completed','failed'\) THEN RETURN NEXT v_request/)
  assert.match(settle, /v_consumed := CASE WHEN v_request\.admin_bypass THEN 0 ELSE v_completed\*45 END/)
  assert.match(settle, /v_refunded := CASE WHEN v_request\.admin_bypass THEN 0 ELSE v_failed\*45 END/)
  assert.match(settle, /SET remaining_amount=remaining_amount\+v_slice\.amount/)
  assert.match(settle, /smart_tokens_consumed.*smart_tokens_refunded/)
})

test('migration contains no secrets and records safe economic telemetry', () => {
  assert.doesNotMatch(sql, /CREATOMATE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/)
  assert.match(sql, /economic_generation_events/)
  assert.match(sql, /'provider','creatomate'/)
  assert.match(sql, /'quick_banners','item','creatomate'/)
  assert.match(sql, /'lot_slices'/)
  assert.match(sql, /CASE WHEN v_request\.admin_bypass THEN 0 ELSE i\.unit_cost END/)
})

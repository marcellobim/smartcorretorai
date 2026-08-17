import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const foundation = readFileSync(new URL('../migrations/20260816010000_create_credit_lots_foundation.sql', import.meta.url), 'utf8')
const baseline = readFileSync(new URL('../migrations/20260816020000_backfill_credit_lots_shadow.sql', import.meta.url), 'utf8')

const lotFunctions = [
  ['sync_credit_balance_cache_from_lots', 'UUID'],
  ['expire_credit_lots_for_user', 'UUID'],
  ['get_credit_lot_balance', 'UUID'],
  ['reserve_credits_from_lots', 'UUID, BIGINT, TEXT, UUID, TEXT, JSONB'],
  ['consume_reserved_credits_from_lots', 'UUID, TEXT, TEXT, JSONB'],
  ['cancel_credit_reservation_from_lots', 'UUID, TEXT, TEXT'],
]

const functionSection = (name) => {
  const start = foundation.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  const next = foundation.indexOf('CREATE OR REPLACE FUNCTION public.', start + 1)
  return foundation.slice(start, next === -1 ? foundation.indexOf('REVOKE EXECUTE ON FUNCTION', start) : next)
}

test('A-B: every new SECURITY DEFINER uses an empty search_path and qualified objects', () => {
  const securityDefiners = [...foundation.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)[\s\S]*?SECURITY DEFINER[\s\S]*?\$\$;/g)]
  assert.equal(securityDefiners.length, lotFunctions.length)
  for (const [name] of lotFunctions) {
    const sql = functionSection(name)
    assert.match(sql, /SECURITY DEFINER/)
    assert.match(sql, /SET search_path = ''/)
    assert.doesNotMatch(sql, /SET search_path = public/)
  }
  assert.doesNotMatch(foundation, /(?<!pg_catalog\.)\b(?:now|sum|min|jsonb_build_object|gen_random_uuid|length|trim)\s*\(/i)
  assert.match(foundation, /auth\.role\(\)/)
  assert.match(foundation, /FROM public\.credit_lots/)
})

test('C-F: lot functions revoke every client role and grant only service_role', () => {
  for (const [name, signature] of lotFunctions) {
    const escapedSignature = signature.replace(/[()]/g, '\\$&')
    const revoke = new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}\\(${escapedSignature}\\) FROM PUBLIC, anon, authenticated;`)
    const grant = new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\(${escapedSignature}\\) TO service_role;`)
    assert.match(foundation, revoke)
    assert.match(foundation, grant)
  }
  assert.doesNotMatch(foundation, /GRANT EXECUTE ON FUNCTION public\.[a-z_]*_from_lots\([^;]+ TO (?:PUBLIC|anon|authenticated)/i)
  assert.match(foundation, /REVOKE EXECUTE ON FUNCTION public\.set_credit_lot_updated_at\(\) FROM PUBLIC, anon, authenticated;/)
})

test('G: every financial lot function has a service_role guard with SQLSTATE 42501', () => {
  for (const [name] of lotFunctions) {
    const sql = functionSection(name)
    assert.match(sql, /IF auth\.role\(\) IS DISTINCT FROM 'service_role' THEN/)
    assert.match(sql, /USING ERRCODE = '42501'/)
  }
})

test('H-I: trial lots are structurally forced to remain hidden', () => {
  assert.match(foundation, /CONSTRAINT credit_lots_trial_hidden_check CHECK \(source <> 'trial' OR hidden_from_ui = TRUE\)/)
  const permitsLot = (source, hiddenFromUi) => source !== 'trial' || hiddenFromUi === true
  assert.equal(permitsLot('trial', false), false)
  assert.equal(permitsLot('trial', true), true)
  assert.equal(permitsLot('purchase', false), true)
})

test('J-K: reservations remain user-serialized, multi-lot and FEFO without SKIP LOCKED', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(reserve, /FROM public\.profiles p[\s\S]*?WHERE p\.id = p_user_id[\s\S]*?FOR UPDATE/)
  assert.match(reserve, /FOR v_lot IN[\s\S]*?LOOP[\s\S]*?v_missing := v_missing - v_take/)
  assert.match(reserve, /ORDER BY cl\.expires_at ASC NULLS LAST, cl\.created_at ASC, cl\.id ASC/)
  assert.match(reserve, /INSERT INTO public\.credit_reservation_allocations/)
  assert.doesNotMatch(reserve, /SKIP LOCKED/i)
})

test('L-M: cancellation restores the allocated lot and never resurrects an expired lot', () => {
  const cancel = functionSection('cancel_credit_reservation_from_lots')
  assert.match(cancel, /WHERE cl\.id = v_allocation\.lot_id FOR UPDATE/)
  assert.match(cancel, /v_lot\.expires_at <= pg_catalog\.now\(\)/)
  assert.match(cancel, /SET remaining_amount = 0, status = 'expired'/)
  assert.match(cancel, /remaining_amount = remaining_amount \+ v_allocation\.amount/)
  assert.match(cancel, /remaining_amount \+ v_allocation\.amount > v_lot\.original_amount/)
})

test('N: reservation and lot issuance idempotency remain explicit', () => {
  const reserve = functionSection('reserve_credits_from_lots')
  assert.match(foundation, /CONSTRAINT credit_lots_user_idempotency_unique UNIQUE \(user_id, idempotency_key\)/)
  assert.match(reserve, /cr\.user_id = p_user_id AND cr\.idempotency_key = p_idempotency_key[\s\S]*?FOR UPDATE/g)
  assert.match(reserve, /IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;/)
})

test('consume confirms allocations without a second lot debit and is retry-safe', () => {
  const consume = functionSection('consume_reserved_credits_from_lots')
  assert.match(consume, /status = 'consumed' THEN RETURN NEXT v_reservation/)
  assert.match(consume, /UPDATE public\.credit_reservation_allocations/)
  assert.match(consume, /INSERT INTO public\.credit_transactions/)
  assert.doesNotMatch(consume, /remaining_amount\s*=/)
})

test('visible aggregate excludes hidden and expired lots', () => {
  const balance = functionSection('get_credit_lot_balance')
  assert.match(balance, /cl\.hidden_from_ui = FALSE/)
  assert.match(balance, /cl\.expires_at IS NULL OR cl\.expires_at > pg_catalog\.now\(\)/)
  assert.match(balance, /hidden_balance BIGINT/)
})

test('O-W: clean baseline never manufactures lots or replays closed history', () => {
  assert.doesNotMatch(baseline, /INSERT INTO public\.credit_lots/i)
  assert.doesNotMatch(baseline, /INSERT INTO public\.credit_reservation_allocations/i)
  assert.doesNotMatch(baseline, /credit_transactions/i)
  assert.doesNotMatch(baseline, /source\s*=\s*'migration'|'migration:profile:'/i)
  assert.match(baseline, /COALESCE\(p\.saldo_creditos, 0\) <> 0[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /COALESCE\(p\.creditos_avulsos, 0\) <> 0[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /p\.trial_ends_at IS NOT NULL[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /p\.stripe_customer_id IS NOT NULL[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /s\.stripe_subscription_id IS NOT NULL[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /FROM public\.subscriptions[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /cr\.status = 'reserved'[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /FROM public\.credit_lots;[\s\S]*?RAISE EXCEPTION/)
  assert.doesNotMatch(baseline, /cr\.status\s*(?:<>|!=|=)\s*'(?:consumed|cancelled|expired)'/)
})

test('baseline also fails closed on legacy expirations and keeps reconciliation private', () => {
  assert.match(baseline, /p\.creditos_expiram_em IS NOT NULL[\s\S]*?RAISE EXCEPTION/)
  assert.match(baseline, /credit_lot_shadow_reconciliation/)
  assert.match(baseline, /WITH \(security_invoker = true\)/)
  assert.match(baseline, /profile_cached_balance <> r\.lot_visible_balance/)
  assert.match(baseline, /open_reservation_balance <> r\.lot_reserved_balance/)
  assert.match(baseline, /REVOKE ALL ON TABLE public\.credit_lot_shadow_reconciliation FROM PUBLIC, anon, authenticated/)
  assert.match(baseline, /GRANT SELECT ON TABLE public\.credit_lot_shadow_reconciliation TO service_role/)
})

test('P0 financial RPCs remain untouched and parallel lot names are preserved', () => {
  const migrations = `${foundation}\n${baseline}`
  for (const currentName of [
    'add_credits',
    'consume_credits',
    'reserve_credits',
    'consume_reserved_credits',
    'cancel_credit_reservation',
    'get_credit_balance',
    'expire_user_credits',
  ]) {
    assert.doesNotMatch(migrations, new RegExp(`(?:CREATE|ALTER|DROP|GRANT|REVOKE)[^;]*FUNCTION public\\.${currentName}\\s*\\(`, 'i'))
  }
  assert.match(foundation, /FUNCTION public\.reserve_credits_from_lots\s*\(/)
})

test('P0 Admin authority, grants and profile role remain untouched', () => {
  const migrations = `${foundation}\n${baseline}`
  assert.doesNotMatch(migrations, /admin_users|is_authorized_admin|profiles\.role|\brole\s*=\s*'admin'/i)
  assert.doesNotMatch(migrations, /GRANT[^;]*(?:admin|authenticated)[^;]*ON (?:TABLE|FUNCTION) public\.(?:admin_users|is_authorized_admin)/i)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20260818010000_grant_stripe_credit_lot.sql', import.meta.url), 'utf8')

test('grant_stripe_credit_lot has the canonical security boundary', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.grant_stripe_credit_lot\(/)
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.grant_stripe_credit_lot\([\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.grant_stripe_credit_lot\([\s\S]*TO service_role/)
})

test('RPC validates amount, source, expiration and mutually exclusive Stripe references', () => {
  assert.match(migration, /p_amount IS NULL OR p_amount <= 0/)
  assert.match(migration, /p_source NOT IN \('subscription', 'purchase'\)/)
  assert.match(migration, /p_expires_at IS NULL/)
  assert.match(migration, /WHERE p_expires_at > pg_catalog\.now\(\)\s+ON CONFLICT DO NOTHING/)
  assert.match(migration, /p_expires_at <= pg_catalog\.now\(\)[\s\S]*expires_at deve estar no futuro para nova concessao/)
  assert.match(migration, /subscription exige somente stripe_invoice_id/)
  assert.match(migration, /purchase exige somente stripe_checkout_session_id/)
  assert.match(migration, /p_stripe_checkout_session_id IS NOT NULL/)
  assert.match(migration, /p_stripe_invoice_id IS NOT NULL/)
})

test('new subscription and purchase grants insert canonical credit lots', () => {
  assert.match(migration, /INSERT INTO public\.credit_lots \([\s\S]*original_amount,[\s\S]*remaining_amount,[\s\S]*expires_at/)
  assert.match(migration, /CASE WHEN p_source = 'subscription' THEN v_financial_reference ELSE NULL END/)
  assert.match(migration, /CASE WHEN p_source = 'purchase' THEN v_financial_reference ELSE NULL END/)
  assert.match(migration, /v_idempotency_key := 'stripe:invoice:' \|\| v_financial_reference/)
  assert.match(migration, /v_idempotency_key := 'stripe:checkout:' \|\| v_financial_reference/)
})

test('replays do not create or refresh balance twice', () => {
  assert.match(migration, /ON CONFLICT DO NOTHING\s+RETURNING id INTO v_inserted_id/)
  assert.match(migration, /IF v_inserted_id IS NOT NULL THEN\s+v_balance := public\.sync_credit_balance_cache_from_lots\(p_user_id\)/)
  assert.match(migration, /RETURN QUERY SELECT 'created'::TEXT/)
  assert.match(migration, /RETURN QUERY SELECT 'already_processed'::TEXT/)
  const syncCalls = migration.match(/sync_credit_balance_cache_from_lots/g) || []
  assert.equal(syncCalls.length, 1)
})

test('migration adds no table or legacy credit path', () => {
  assert.doesNotMatch(migration, /CREATE\s+TABLE/i)
  assert.doesNotMatch(migration, /add_credits/i)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = relativePath => readFileSync(path.join(root, relativePath), 'utf8')
const migration = read('supabase/migrations/20260824010000_create_admin_catalog_courtesy_access.sql')
const adminApi = read('supabase/functions/admin-api/index.ts')
const runtime = read('supabase/functions/admin-api/runtime.ts')
const adminUi = read('frontend/src/pages/AdminDashboard.jsx')

test('courtesy audit is append-only, private and server-timestamped', () => {
  assert.match(migration, /CREATE TABLE public\.admin_catalog_access_events/)
  assert.match(migration, /action TEXT NOT NULL CHECK \(action IN \('granted', 'revoked'\)\)/)
  assert.match(migration, /idempotency_key UUID NOT NULL UNIQUE/)
  assert.match(migration, /created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog\.now\(\)/)
  assert.match(migration, /REFERENCES auth\.users\(id\) ON DELETE RESTRICT/g)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.admin_catalog_access_events FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT SELECT, INSERT ON TABLE public\.admin_catalog_access_events TO service_role/)
  assert.doesNotMatch(migration, /GRANT (?:UPDATE|DELETE)[\s\S]*admin_catalog_access_events/i)
})

test('courtesy mutation is service-role only, verifies Admin and serializes replay', () => {
  const rpc = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.set_admin_catalog_courtesy'))
  assert.match(rpc, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(rpc, /public\.admin_users au WHERE au\.user_id = p_admin_user_id/)
  assert.match(rpc, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_idempotency_key::TEXT, 0\)\)/)
  assert.match(rpc, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(p_user_id::TEXT, 1\)\)/)
  assert.match(rpc, /Conflito de idempotencia administrativa/)
  assert.match(rpc, /'already_active'|'already_inactive'/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.set_admin_catalog_courtesy[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.set_admin_catalog_courtesy[\s\S]*TO service_role/)
})

test('catalog gate requires paid evidence or active courtesy outside exact trial allowlist', () => {
  const reserve = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.reserve_credits_from_lots'))
  assert.match(reserve, /source = 'subscription' AND cl\.stripe_invoice_id IS NOT NULL/)
  assert.match(reserve, /source = 'purchase' AND cl\.stripe_checkout_session_id IS NOT NULL/)
  assert.match(reserve, /ace\.action = 'granted'[\s\S]*ORDER BY ace\.created_at DESC, ace\.id DESC/)
  assert.match(reserve, /v_full_catalog_access := v_paid_account OR v_courtesy_active/)
  assert.match(reserve, /IF NOT v_full_catalog_access AND NOT v_trial_allowed THEN[\s\S]*TRIAL_PRODUCT_NOT_ALLOWED/)
  assert.match(reserve, /cl\.source = 'trial' AND \(v_full_catalog_access OR v_trial_allowed\)/)
  assert.doesNotMatch(reserve, /source = 'admin'.*v_full_catalog_access/)
})

test('Admin API keeps AAL2 before dispatch and exposes only the protected courtesy action', () => {
  const aal2 = adminApi.indexOf('await requireAdminAal2(supabase, token)')
  const dispatch = adminApi.indexOf("action === 'set_catalog_courtesy'")
  assert.ok(aal2 > 0 && dispatch > aal2)
  assert.match(adminApi, /validateAdminCourtesyInput\(input\)/)
  assert.match(adminApi, /rpc\('set_admin_catalog_courtesy'/)
  assert.match(runtime, /typeof active !== 'boolean'/)
  assert.doesNotMatch(adminApi, /from\('subscriptions'\).*insert|stripe.*courtesy|plano.*courtesy/i)
})

test('Admin UI separates catalog access from Smart Tokens and requires confirmation', () => {
  assert.match(adminUi, /Acesso aos produtos/)
  assert.match(adminUi, /Completo por cortesia/)
  assert.match(adminUi, /Liberar acesso completo/)
  assert.match(adminUi, /Revogar acesso completo/)
  assert.match(adminUi, /não altera plano, assinatura, Stripe ou saldo de Smart Tokens/)
  assert.match(adminUi, /window\.confirm\(/)
  assert.match(adminUi, /adminRequest\('set_catalog_courtesy'/)
  assert.match(adminUi, /ACESSO COMPLETO LIBERADO/)
  assert.match(adminUi, /ACESSO COMPLETO REVOGADO/)
})

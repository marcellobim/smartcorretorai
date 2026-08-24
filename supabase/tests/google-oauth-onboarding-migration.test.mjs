import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20260824020000_prepare_google_oauth_onboarding.sql', import.meta.url), 'utf8')

test('OAuth acceptance is server-owned, idempotent and restricted to authenticated Google sessions', () => {
  assert.match(migration, /acceptance_context IN \('signup', 'oauth_onboarding'\)/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.accept_current_legal_documents\(\)/)
  assert.match(migration, /auth\.uid\(\)/)
  assert.match(migration, /'2026-08', '2026-08', pg_catalog\.now\(\), 'oauth_onboarding'/)
  assert.match(migration, /ON CONFLICT ON CONSTRAINT user_legal_acceptances_version_unique DO NOTHING/)
  assert.match(migration, /current_session_uses_google_oauth\(\)/)
  assert.doesNotMatch(migration, /p_terms|p_privacy|p_accepted_at/)
})

test('credit reservation gate fails closed for Google identities without current acceptance', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.assert_user_may_consume_smart_tokens/)
  assert.match(migration, /FROM auth\.identities ai[\s\S]*ai\.provider = 'google'/)
  assert.match(migration, /OAUTH_LEGAL_ACCEPTANCE_REQUIRED/)
  assert.match(migration, /BEFORE INSERT ON public\.credit_reservations/)
  assert.doesNotMatch(migration, /UPDATE public\.credit_lots|DELETE FROM public\.credit_lots|original_amount|remaining_amount/)
})

test('Admin Google identity linking is blocked server-side without changing password or AAL2 authorization', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.block_admin_google_identity/)
  assert.match(migration, /NEW\.provider = 'google'/)
  assert.match(migration, /FROM public\.admin_users au WHERE au\.user_id = NEW\.user_id/)
  assert.match(migration, /BEFORE INSERT OR UPDATE OF provider, user_id ON auth\.identities/)
  assert.doesNotMatch(migration, /DELETE FROM public\.admin_users|UPDATE public\.admin_users|profiles\.role\s*=/)
})

test('profile trigger is OAuth-safe, audited and does not invent a password', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/)
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = ''/)
  assert.match(migration, /raw_user_meta_data ->> 'full_name'[\s\S]*raw_user_meta_data ->> 'name'/)
  assert.match(migration, /ALTER COLUMN senha_hash DROP NOT NULL/)
  assert.doesNotMatch(migration, /senha_hash[\s\S]*VALUES[\s\S]*(?:crypt|password|random)/i)
})

test('migration does not modify the trial grant, prices, Stripe or provider configuration', () => {
  assert.doesNotMatch(migration, /grant_confirmed_email_trial|stripe|price_id|200, 200|auth\.external\.google/)
})

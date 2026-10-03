import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const register = read('src/pages/RegisterPage.jsx')
const auth = read('src/lib/auth-context.jsx')
const app = read('src/App.jsx')
const legalOnboarding = read('src/pages/LegalOnboardingPage.jsx')
const versions = read('src/config/legalDocuments.js')
const terms = read('src/pages/TermosDeUso.jsx')
const privacy = read('src/pages/Privacidade.jsx')
const historicalMigration = read('../supabase/migrations/20260823050000_create_user_legal_acceptances.sql')
const currentMigration = read('../supabase/migrations/20261003010000_bump_legal_documents_to_2026_10.sql')

test('signup keeps checkbox and Turnstile mandatory before sending legal versions', () => {
  assert.match(register, /if \(!data\.termos\)[\s\S]*return/)
  assert.match(register, /register\('termos', \{ required:/)
  assert.match(register, /if \(!captchaToken\)[\s\S]*return/)
  assert.match(register, /disabled=\{!captchaToken\}/)
  assert.match(auth, /if \(!captchaToken\) throw new Error\('captcha_required'\)/)
  assert.match(auth, /options: \{[\s\S]*data: metadata,[\s\S]*captchaToken,[\s\S]*emailRedirectTo:/)
})

test('frontend sends the exact published versions without client timestamps or user ids', () => {
  assert.match(versions, /terms: '2026-10'/)
  assert.match(versions, /privacy: '2026-10'/)
  assert.match(register, /legal_acceptance: \{[\s\S]*accepted: true/)
  assert.match(register, /terms_version: LEGAL_DOCUMENT_VERSIONS\.terms/)
  assert.match(register, /privacy_version: LEGAL_DOCUMENT_VERSIONS\.privacy/)
  assert.doesNotMatch(register, /legal_acceptance: \{[\s\S]*accepted_at:/)
  assert.doesNotMatch(register, /legal_acceptance: \{[\s\S]*user_id:/)
})

test('database binds evidence to NEW.id and supplies accepted_at itself', () => {
  assert.match(historicalMigration, /user_id UUID NOT NULL REFERENCES auth\.users\(id\)/)
  assert.match(historicalMigration, /accepted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog\.now\(\)/)
  assert.match(currentMigration, /NEW\.id, '2026-10', '2026-10', pg_catalog\.now\(\), 'signup'/)
  assert.doesNotMatch(currentMigration, /v_acceptance ->> 'user_id'/)
  assert.doesNotMatch(currentMigration, /v_acceptance ->> 'accepted_at'/)
})

test('the public legal documents correspond to the current October 2026 version', () => {
  for (const document of [terms, privacy]) assert.match(document, /Outubro de 2026/)
  assert.match(versions, /terms: '2026-10'/)
  assert.match(versions, /privacy: '2026-10'/)
})

test('backend validates both versions and preserves append-only version history', () => {
  assert.match(historicalMigration, /'2026-08'/)
  assert.match(historicalMigration, /UNIQUE \(user_id, terms_version, privacy_version\)/)
  assert.match(currentMigration, /terms_version' IS DISTINCT FROM '2026-10'/)
  assert.match(currentMigration, /privacy_version' IS DISTINCT FROM '2026-10'/)
  assert.match(currentMigration, /ON CONFLICT \(user_id, terms_version, privacy_version\) DO NOTHING/)
  assert.doesNotMatch(currentMigration, /\bUPDATE\s+(?:public\.)?user_legal_acceptances\b/i)
  assert.doesNotMatch(currentMigration, /ON CONFLICT[\s\S]*DO UPDATE/)
})

test('RLS permits only own reads and exposes no client mutation path', () => {
  assert.match(historicalMigration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(historicalMigration, /GRANT SELECT ON TABLE public\.user_legal_acceptances TO authenticated/)
  assert.match(historicalMigration, /USING \(\(SELECT auth\.uid\(\)\) = user_id\)/)
  assert.match(historicalMigration, /REVOKE ALL ON TABLE public\.user_legal_acceptances FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(currentMigration, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[\s\S]*TO authenticated/)
  assert.match(currentMigration, /REVOKE ALL ON FUNCTION public\.record_signup_legal_acceptance\(\) FROM PUBLIC, anon, authenticated/)
})

test('missing acceptance creates no fabricated record while invalid declared versions fail signup', () => {
  assert.match(currentMigration, /IF v_acceptance IS NULL THEN[\s\S]*RETURN NEW/)
  assert.match(currentMigration, /RAISE EXCEPTION 'Invalid legal acceptance declaration\.'/)
  assert.match(historicalMigration, /AFTER INSERT ON auth\.users/)
  assert.match(historicalMigration, /FROM auth\.users u[\s\S]*terms_version' = '2026-08'[\s\S]*privacy_version' = '2026-08'/)
})

test('the shared backend gate sends any stale authenticated session to a new append-only acceptance', () => {
  assert.match(currentMigration, /CREATE OR REPLACE FUNCTION public\.has_current_legal_acceptance/)
  assert.match(currentMigration, /ula\.terms_version = '2026-10'/)
  assert.match(currentMigration, /ula\.privacy_version = '2026-10'/)
  assert.match(currentMigration, /CREATE OR REPLACE FUNCTION public\.get_auth_onboarding_state\(\)/)
  assert.match(currentMigration, /IF public\.has_current_legal_acceptance\(v_user_id\) THEN[\s\S]*RETURN 'accepted'/)
  assert.match(currentMigration, /RETURN 'needs_acceptance'/)
  assert.doesNotMatch(currentMigration, /RETURN 'not_google'/)
  assert.match(currentMigration, /CHECK \(acceptance_context IN \('signup', 'oauth_onboarding', 'reauthentication'\)\)/)
  assert.match(currentMigration, /ELSE 'reauthentication'/)
  assert.match(currentMigration, /WHEN public\.current_session_uses_google_oauth\(\) THEN 'oauth_onboarding'/)
  assert.match(currentMigration, /v_user_id, '2026-10', '2026-10', pg_catalog\.now\(\), v_acceptance_context/)
  assert.match(auth, /rpc\('accept_current_legal_documents'\)/)
  assert.match(auth, /const acceptLegalDocuments = async/)
  assert.match(app, /if \(onboardingState === 'needs_acceptance'\) return <Navigate to="\/aceite-legal" replace \/>/)
})

test('legal acceptance route is exempt from its own private-route redirect and preserves the session', () => {
  assert.match(app, /<Route path="\/aceite-legal" element=\{<LegalOnboardingPage \/>\} \/>/)
  assert.match(legalOnboarding, /if \(onboardingState === 'accepted'\) return <Navigate to="\/dashboard" replace \/>/)
  assert.doesNotMatch(legalOnboarding, /Navigate to="\/aceite-legal"/)
  const acceptFunction = auth.match(/const acceptLegalDocuments = async \(\) => \{([\s\S]*?)const signOut/)
  assert.ok(acceptFunction)
  assert.doesNotMatch(acceptFunction[1], /signOut|setSession\(null\)|setAuthUser\(null\)/)
})

test('the 2026-10 migration leaves historic evidence untouched', () => {
  assert.match(historicalMigration, /'2026-08'/)
  assert.doesNotMatch(currentMigration, /\bUPDATE\s+(?:public\.)?user_legal_acceptances\b/i)
  assert.doesNotMatch(currentMigration, /\bDELETE\s+FROM\s+(?:public\.)?user_legal_acceptances\b/i)
})

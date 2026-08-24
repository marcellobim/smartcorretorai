import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const register = read('src/pages/RegisterPage.jsx')
const auth = read('src/lib/auth-context.jsx')
const versions = read('src/config/legalDocuments.js')
const migration = read('../supabase/migrations/20260823050000_create_user_legal_acceptances.sql')

test('signup keeps checkbox and Turnstile mandatory before sending legal versions', () => {
  assert.match(register, /if \(!data\.termos\)[\s\S]*return/)
  assert.match(register, /register\('termos', \{ required:/)
  assert.match(register, /if \(!captchaToken\)[\s\S]*return/)
  assert.match(register, /disabled=\{!captchaToken\}/)
  assert.match(auth, /if \(!captchaToken\) throw new Error\('captcha_required'\)/)
  assert.match(auth, /options: \{ data: metadata, captchaToken \}/)
})

test('frontend sends the exact published versions without client timestamps or user ids', () => {
  assert.match(versions, /terms: '2026-08'/)
  assert.match(versions, /privacy: '2026-08'/)
  assert.match(register, /legal_acceptance: \{[\s\S]*accepted: true/)
  assert.match(register, /terms_version: LEGAL_DOCUMENT_VERSIONS\.terms/)
  assert.match(register, /privacy_version: LEGAL_DOCUMENT_VERSIONS\.privacy/)
  assert.doesNotMatch(register, /legal_acceptance: \{[\s\S]*accepted_at:/)
  assert.doesNotMatch(register, /legal_acceptance: \{[\s\S]*user_id:/)
})

test('database binds evidence to NEW.id and supplies accepted_at itself', () => {
  assert.match(migration, /user_id UUID NOT NULL REFERENCES auth\.users\(id\)/)
  assert.match(migration, /accepted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog\.now\(\)/)
  assert.match(migration, /NEW\.id,[\s\S]*'2026-08',[\s\S]*pg_catalog\.now\(\)/)
  assert.doesNotMatch(migration, /v_acceptance ->> 'user_id'/)
  assert.doesNotMatch(migration, /v_acceptance ->> 'accepted_at'/)
})

test('backend validates both versions and preserves append-only version history', () => {
  assert.match(migration, /terms_version' IS DISTINCT FROM '2026-08'/)
  assert.match(migration, /privacy_version' IS DISTINCT FROM '2026-08'/)
  assert.match(migration, /UNIQUE \(user_id, terms_version, privacy_version\)/)
  assert.match(migration, /ON CONFLICT \(user_id, terms_version, privacy_version\) DO NOTHING/)
  assert.doesNotMatch(migration, /ON CONFLICT[\s\S]*DO UPDATE/)
})

test('RLS permits only own reads and exposes no client mutation path', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /GRANT SELECT ON TABLE public\.user_legal_acceptances TO authenticated/)
  assert.match(migration, /USING \(\(SELECT auth\.uid\(\)\) = user_id\)/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.user_legal_acceptances FROM PUBLIC, anon, authenticated/)
  assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[\s\S]*TO authenticated/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.record_signup_legal_acceptance\(\) FROM PUBLIC, anon, authenticated/)
})

test('missing acceptance creates no fabricated record while invalid declared versions fail signup', () => {
  assert.match(migration, /IF v_acceptance IS NULL THEN[\s\S]*RETURN NEW/)
  assert.match(migration, /RAISE EXCEPTION 'Invalid legal acceptance declaration\.'/)
  assert.match(migration, /AFTER INSERT ON auth\.users/)
  assert.match(migration, /SELECT[\s\S]*u\.created_at,[\s\S]*FROM auth\.users u/)
  assert.match(migration, /FROM auth\.users u[\s\S]*terms_version' = '2026-08'[\s\S]*privacy_version' = '2026-08'/)
})

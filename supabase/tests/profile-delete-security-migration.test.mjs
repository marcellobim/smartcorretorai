import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const forwardFix = readFileSync(
  new URL('../migrations/20260817070000_revoke_direct_profile_delete.sql', import.meta.url),
  'utf8',
)
const adminP0 = readFileSync(
  new URL('../migrations/20260816030000_harden_admin_authorization.sql', import.meta.url),
  'utf8',
)
const initialSchema = readFileSync(
  new URL('../migrations/001_initial_schema.sql', import.meta.url),
  'utf8',
)
const profileRls = readFileSync(
  new URL('../migrations/20260517_rls_policies.sql', import.meta.url),
  'utf8',
)

test('browser roles lose direct profile DELETE while service_role remains protected', () => {
  assert.match(
    forwardFix,
    /REVOKE DELETE ON TABLE public\.profiles FROM PUBLIC, anon, authenticated;/,
  )
  assert.match(
    forwardFix,
    /has_table_privilege\('anon', 'public\.profiles', 'DELETE'\)[\s\S]*?RAISE EXCEPTION/,
  )
  assert.match(
    forwardFix,
    /has_table_privilege\('authenticated', 'public\.profiles', 'DELETE'\)[\s\S]*?RAISE EXCEPTION/,
  )
  assert.match(
    forwardFix,
    /IF NOT pg_catalog\.has_table_privilege\('service_role', 'public\.profiles', 'DELETE'\)/,
  )
  assert.doesNotMatch(forwardFix, /REVOKE[^;]*service_role/i)
})

test('forward-fix changes no profile privilege except DELETE', () => {
  const privilegeStatements = forwardFix.match(/(?:GRANT|REVOKE)[\s\S]*?;/gi) || []
  assert.equal(privilegeStatements.length, 1)
  assert.doesNotMatch(forwardFix, /\b(?:GRANT|REVOKE)\s+(?:SELECT|INSERT|UPDATE)\b/i)
  assert.doesNotMatch(forwardFix, /CREATE POLICY|DROP POLICY|ALTER POLICY/i)
  assert.doesNotMatch(forwardFix, /ALTER TABLE|ENABLE ROW LEVEL SECURITY|DISABLE ROW LEVEL SECURITY/i)
  assert.doesNotMatch(forwardFix, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM)\b/im)
})

test('authenticated profile INSERT and UPDATE stay scoped to Configuracoes columns', () => {
  const updateGrant = adminP0.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.profiles TO authenticated/)?.[1] || ''
  const insertGrant = adminP0.match(/GRANT INSERT \(([\s\S]*?)\) ON public\.profiles TO authenticated/)?.[1] || ''
  const allowed = ['nome', 'email', 'creci', 'estado', 'telefone', 'whatsapp', 'imobiliaria', 'avatar_url', 'logo_url']
  const privileged = [
    'role', 'plano', 'saldo_creditos', 'creditos_expiram_em', 'creditos_avulsos',
    'trial_ends_at', 'stripe_customer_id', 'enterprise_owner_id',
  ]

  assert.match(adminP0, /REVOKE INSERT, UPDATE ON TABLE public\.profiles[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(insertGrant, /\bid\b/)
  for (const column of allowed) {
    assert.match(updateGrant, new RegExp(`\\b${column}\\b`), column)
    assert.match(insertGrant, new RegExp(`\\b${column}\\b`), column)
  }
  for (const column of privileged) {
    assert.doesNotMatch(updateGrant, new RegExp(`\\b${column}\\b`), column)
    assert.doesNotMatch(insertGrant, new RegExp(`\\b${column}\\b`), column)
  }
})

test('current ownership and RLS contract remains untouched', () => {
  assert.match(initialSchema, /ALTER TABLE profiles\s+ENABLE ROW LEVEL SECURITY/)
  assert.match(initialSchema, /ON profiles FOR ALL USING \(auth\.uid\(\) = id\)/)
  assert.match(profileRls, /ON public\.profiles FOR SELECT\s+USING \(auth\.uid\(\) = id\)/)
  assert.match(profileRls, /ON public\.profiles FOR UPDATE\s+USING \(auth\.uid\(\) = id\)/)
  assert.match(adminP0, /GRANT INSERT \([\s\S]*?\) ON public\.profiles TO authenticated/)
  assert.match(adminP0, /GRANT UPDATE \([\s\S]*?\) ON public\.profiles TO authenticated/)
  assert.doesNotMatch(forwardFix, /profiles_self|auth\.uid\(\)|CREATE POLICY|DROP POLICY/i)
})

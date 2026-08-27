import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizeSupabaseAdminRequest,
  resolveSupabaseAdminCredential,
} from '../supabase-admin-credential.ts'

const modern = 'sb_secret_modern-test-value'
const legacy = 'legacy-test-value'

function environment(values: Record<string, string | undefined>) {
  return (name: string) => values[name]
}

test('prefers the named modern secret and logs only its source', () => {
  const logs: string[] = []
  const credential = resolveSupabaseAdminCredential(environment({
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: modern }),
    SUPABASE_SERVICE_ROLE_KEY: legacy,
  }), source => logs.push(JSON.stringify({ source })))

  assert.deepEqual(credential, { key: modern, source: 'modern' })
  assert.deepEqual(logs, ['{"source":"modern"}'])
  assert.doesNotMatch(logs.join(''), /modern-test-value|legacy-test-value/)
})

test('uses the temporary legacy fallback only when modern secrets are absent', () => {
  const sources: string[] = []
  const credential = resolveSupabaseAdminCredential(
    environment({ SUPABASE_SERVICE_ROLE_KEY: legacy }),
    source => sources.push(source),
  )
  assert.deepEqual(credential, { key: legacy, source: 'legacy' })
  assert.deepEqual(sources, ['legacy'])
})

test('fails closed when no administrative credential exists', () => {
  assert.throws(
    () => resolveSupabaseAdminCredential(environment({}), () => undefined),
    /supabase_admin_credential_missing/,
  )
})

test('fails closed instead of falling back when the modern structure is malformed', () => {
  assert.throws(
    () => resolveSupabaseAdminCredential(environment({
      SUPABASE_SECRET_KEYS: '{invalid',
      SUPABASE_SERVICE_ROLE_KEY: legacy,
    }), () => undefined),
    /supabase_secret_keys_invalid/,
  )
  assert.throws(
    () => resolveSupabaseAdminCredential(environment({
      SUPABASE_SECRET_KEYS: JSON.stringify({ another: modern }),
      SUPABASE_SERVICE_ROLE_KEY: legacy,
    }), () => undefined),
    /supabase_default_secret_missing/,
  )
})

test('cleanup authorization accepts modern apikey and the transitional legacy bearer only', () => {
  const modernCredential = { key: modern, source: 'modern' as const }
  assert.equal(
    authorizeSupabaseAdminRequest(new Headers({ apikey: modern }), modernCredential, environment({ SUPABASE_SERVICE_ROLE_KEY: legacy })),
    'modern',
  )
  assert.equal(
    authorizeSupabaseAdminRequest(new Headers({ authorization: `Bearer ${legacy}` }), modernCredential, environment({ SUPABASE_SERVICE_ROLE_KEY: legacy })),
    'legacy',
  )
  assert.equal(
    authorizeSupabaseAdminRequest(new Headers({ apikey: 'wrong' }), modernCredential, environment({ SUPABASE_SERVICE_ROLE_KEY: legacy })),
    null,
  )
})

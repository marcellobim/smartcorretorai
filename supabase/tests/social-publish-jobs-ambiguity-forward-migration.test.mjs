import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20260830060000_fix_social_publish_job_lease_job_id_ambiguity.sql', import.meta.url), 'utf8')

const functions = [
  'record_social_publish_job_poll_result',
  'transition_claimed_social_publish_job',
  'cancel_social_publish_job',
]

const section = name => {
  const start = migration.indexOf(`FUNCTION public.${name}`)
  const next = migration.indexOf('CREATE OR REPLACE FUNCTION public.', start + 1)
  return migration.slice(start, next === -1 ? migration.length : next)
}

test('forward migration replaces exactly the three affected functions', () => {
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION public\./g) || []).length, 3)
  for (const name of functions) assert.match(migration, new RegExp(`FUNCTION public\\.${name}\\(`))
  assert.doesNotMatch(migration, /CREATE TABLE|ALTER TABLE|CREATE INDEX|DROP FUNCTION/i)
})

test('all lease columns use an explicit alias and cannot collide with output job_id', () => {
  assert.equal((migration.match(/UPDATE public\.social_media_leases AS l/g) || []).length, 3)
  assert.equal((migration.match(/l\.id = v_job\.media_lease_id AND l\.job_id = v_job\.id AND l\.status = 'active'/g) || []).length, 3)
  assert.doesNotMatch(migration, /WHERE id = v_job\.media_lease_id AND job_id = v_job\.id/)
})

test('poll result remains scoped to job, claim, expected publishing state and container', () => {
  const sql = section(functions[0])
  for (const guard of [
    /j\.id = p_job_id/, /j\.claim_token = p_claim_token/, /j\.status = p_expected_status/,
    /j\.claim_expires_at > v_now/, /j\.external_container_id = p_external_container_id/,
  ]) assert.match(sql, guard)
})

test('worker transition remains scoped to job, claim, expected state and active claim', () => {
  const sql = section(functions[1])
  for (const guard of [
    /j\.id = p_job_id/, /j\.claim_token = p_claim_token/, /j\.status = p_expected_status/,
    /j\.claim_expires_at > v_now/, /p_next_status <> 'published'.*j\.external_container_status = 'FINISHED'/,
  ]) assert.match(sql, guard)
})

test('cancellation remains owner-scoped and pre-irreversible only', () => {
  const sql = section(functions[2])
  assert.match(sql, /j\.id = p_job_id/)
  assert.match(sql, /j\.user_id = auth\.uid\(\)/)
  assert.match(sql, /j\.status = p_expected_status/)
  assert.match(sql, /j\.external_publish_started_at IS NULL/)
})

test('signatures, SECURITY DEFINER, fixed search_path and grants remain unchanged', () => {
  assert.equal((migration.match(/SECURITY DEFINER/g) || []).length, 3)
  assert.equal((migration.match(/SET search_path = ''/g) || []).length, 3)
  assert.match(migration, /record_social_publish_job_poll_result\(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ\)[\s\S]*TO service_role/)
  assert.match(migration, /transition_claimed_social_publish_job\(UUID, UUID, TEXT, TEXT\)[\s\S]*TO service_role/)
  assert.match(migration, /cancel_social_publish_job\(UUID, TEXT\)[\s\S]*FROM PUBLIC, anon;[\s\S]*TO authenticated/)
  assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon)/)
})

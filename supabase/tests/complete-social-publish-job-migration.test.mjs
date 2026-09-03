import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260830070000_complete_social_publish_job.sql', import.meta.url), 'utf8')

test('completion is guarded by job, claim, expected state, container and FINISHED', () => {
  for (const guard of [
    /j\.id = p_job_id/,
    /j\.claim_token = p_claim_token/,
    /j\.status = p_expected_status/,
    /j\.claim_expires_at > v_now/,
    /j\.external_container_id = p_external_container_id/,
    /j\.external_container_status = 'FINISHED'/,
  ]) assert.match(sql, guard)
})
test('completion persists post identity, releases claim and closes only its active lease', () => {
  assert.match(sql, /external_post_id = p_external_post_id/)
  assert.match(sql, /external_post_url = p_external_post_url/)
  assert.match(sql, /claim_token = NULL/)
  assert.match(sql, /l\.id = v_job\.media_lease_id[\s\S]*l\.job_id = v_job\.id[\s\S]*l\.status = 'active'/)
})

test('completion remains service-only SECURITY DEFINER with fixed search_path', () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
})

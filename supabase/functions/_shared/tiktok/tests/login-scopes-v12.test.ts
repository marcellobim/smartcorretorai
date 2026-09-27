import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../../../../migrations/20260926020000_tiktok_login_v12_scopes.sql', import.meta.url), 'utf8')
const allowed = (scopes: readonly string[]) => JSON.stringify(scopes) === '["user.info.basic"]'
  || JSON.stringify(scopes) === '["user.info.basic","video.publish"]'

test('V12 persistence scope contract accepts only the known Login Kit grants', () => {
  assert.equal(allowed(['user.info.basic']), true)
  assert.equal(allowed(['user.info.basic', 'video.publish']), true)
  for (const scopes of [[], ['video.publish'], ['user.info.basic', 'video.upload'], ['user.info.basic', 'unknown'], ['video.publish', 'user.info.basic']]) {
    assert.equal(allowed(scopes), false, JSON.stringify(scopes))
  }
  assert.match(sql, /p_login->'scopes' IS DISTINCT FROM '\["user\.info\.basic"\]'::JSONB/)
  assert.match(sql, /AND p_login->'scopes' IS DISTINCT FROM '\["user\.info\.basic","video\.publish"\]'::JSONB/)
  assert.match(sql, /THEN ARRAY\['user\.info\.basic','video\.publish'\]::TEXT\[\]/)
  assert.doesNotMatch(sql, /video\.upload/)
})

test('V12 persistence replacement retains service-only invoker protections', () => {
  assert.match(sql, /SET search_path = ''/)
  assert.doesNotMatch(sql, /SECURITY DEFINER/)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /environment, app_id, open_id/)
})

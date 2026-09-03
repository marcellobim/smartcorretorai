import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(path.join(root, 'migrations/20260901060000_requeue_unstarted_social_video_jobs.sql'), 'utf8')

test('requeue preserves the same job and requires proof that no external action started', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.requeue_unstarted_social_publish_job/)
  assert.match(sql, /v_job\.status <> 'failed'/)
  assert.match(sql, /external_publish_started_at IS NOT NULL/)
  assert.match(sql, /external_commit_started_at IS NOT NULL/)
  assert.match(sql, /external_container_id IS NOT NULL/)
  assert.match(sql, /external_post_id IS NOT NULL/)
  assert.doesNotMatch(sql, /INSERT INTO public\.social_publish_jobs|DELETE FROM|reserve|consume|smart_tokens/i)
})

test('requeue attaches only the existing owner-scoped active lease and stays service-role only', () => {
  assert.match(sql, /lease\.job_id = v_job\.id/)
  assert.match(sql, /lease\.user_id = v_job\.user_id/)
  assert.match(sql, /lease\.status = 'active'/)
  assert.match(sql, /media_lease_id = v_lease\.id/)
  assert.match(sql, /status = 'retry_scheduled'/)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /REVOKE ALL[\s\S]*PUBLIC, anon, authenticated/)
})

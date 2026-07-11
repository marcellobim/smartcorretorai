import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..', '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('container is non-root, healthchecked and includes FFmpeg/ffprobe', () => {
  const dockerfile = read('Dockerfile.smart-media-worker')
  assert.match(dockerfile, /apt-get install[^\n]*ffmpeg/)
  assert.match(dockerfile, /USER node/)
  assert.match(dockerfile, /HEALTHCHECK/)
  assert.match(dockerfile, /FFPROBE_PATH=\/usr\/bin\/ffprobe/)
})

test('queue migration has atomic claim, lease recovery, heartbeat and bounded retry', () => {
  const migration = read('supabase/migrations/20260710230000_add_video_job_worker_leases.sql')
  assert.match(migration, /FOR UPDATE SKIP LOCKED/)
  assert.match(migration, /lease_expires_at < now\(\)/)
  assert.match(migration, /heartbeat_video_job/)
  assert.match(migration, /attempt_count < max_attempts/)
  assert.match(migration, /TO service_role/)
})

test('production keeps the local bridge disabled and requires project isolation', () => {
  const worker = read('core/smart-motion-engine/cli/process-smart-video-jobs.ts')
  assert.match(worker, /process\.env\.NODE_ENV !== 'production'/)
  assert.match(worker, /smart_media_local_bridge_not_allowed_in_production/)
  assert.match(worker, /SMART_MEDIA_EXPECTED_PROJECT_REF_mismatch/)
  assert.doesNotMatch(read('.env.smart-media.example'), /SUPABASE_SERVICE_ROLE_KEY=ey/)
})

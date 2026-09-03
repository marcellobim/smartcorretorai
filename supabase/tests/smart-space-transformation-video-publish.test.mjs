import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(new URL('../migrations/20260902020000_enable_smart_space_transformation_video_publish.sql', import.meta.url), 'utf8')
const edge = fs.readFileSync(new URL('../functions/social-publish-smart-space/index.ts', import.meta.url), 'utf8')

test('publicação aceita somente MP4 de transformação concluído e owner-scoped', () => {
  assert.match(migration, /source_type = 'smart_space_transform'/)
  assert.match(migration, /media_asset_id ~ '\^\[0-4\]:transformation_video\$'/)
  assert.match(migration, /request\.user_id = p_user_id/)
  assert.match(migration, /request\.client_request_id = p_source_id/)
  assert.match(migration, /item\.video_state = 'completed'/)
  assert.match(migration, /item\.video_output_path = p_user_id::TEXT/)
  assert.match(edge, /\.eq\('video_state', 'completed'\)/)
  assert.match(edge, /objectPath !== expectedPath/)
})

test('migração e endpoint não geram mídia, não debitam ST e não criam publicação automaticamente', () => {
  assert.doesNotMatch(migration, /UPDATE\s+public\.profiles|smart_tokens_balance|INSERT\s+INTO\s+public\.smart_token_transactions|graph\.facebook\.com|media_publish/i)
  assert.match(migration, /ON CONFLICT DO NOTHING/)
  assert.match(migration, /TO service_role/)
  assert.match(edge, /create_or_reuse_smart_space_social_publish_job_v2/)
})

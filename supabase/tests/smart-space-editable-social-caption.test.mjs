import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(new URL('../migrations/20260902030000_enable_smart_space_editable_social_caption.sql', import.meta.url), 'utf8')
const edge = fs.readFileSync(new URL('../functions/social-publish-smart-space/index.ts', import.meta.url), 'utf8')

test('snapshot opcional é congelado igualmente nos jobs por destino', () => {
  assert.match(migration, /pg_catalog\.length\(p_caption\) > 2200/)
  assert.match(migration, /media_asset_id, caption_snapshot, status[\s\S]*v_media_asset_id, p_caption, 'queued'/)
  assert.match(migration, /v_job\.caption_snapshot IS DISTINCT FROM p_caption/)
  assert.match(edge, /p_caption: intent\.captionSnapshot/)
  assert.match(edge, /caption_snapshot/)
})
test('RPC v2 preserva os quatro tipos Smart Space, segurança e economia', () => {
  for (const sourceType of ['smart_space_image', 'smart_space_transform', 'smart_space_life', 'smart_space_broker']) assert.match(migration, new RegExp(sourceType))
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(migration, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.doesNotMatch(migration, /UPDATE\s+public\.profiles|smart_tokens_balance|INSERT\s+INTO\s+public\.smart_token_transactions/i)
})

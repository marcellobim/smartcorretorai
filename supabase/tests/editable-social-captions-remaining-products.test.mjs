import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../migrations/20260902040000_enable_editable_social_captions_for_remaining_products.sql', import.meta.url), 'utf8')

test('migration atualiza somente os três contratos sociais previstos', () => {
  const functions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)/g)].map(match => match[1])
  assert.deepEqual(functions, [
    'create_or_reuse_banner_social_publish_job',
    'create_or_reuse_video_social_publish_job',
    'create_or_reuse_studio_social_publish_job',
  ])
})

test('legenda vazia é aceita, mas null e mais de 2200 caracteres permanecem inválidos', () => {
  assert.equal((sql.match(/p_caption IS NULL OR pg_catalog\.length\(p_caption\) > 2200/g) || []).length, 3)
  assert.doesNotMatch(sql, /pg_catalog\.btrim\(p_caption\)\s*=\s*''/)
  assert.doesNotMatch(sql, /p_caption\s*=\s*''/)
})

test('ownership, mídia, opção, destino, conexão e idempotência continuam protegidos', () => {
  assert.match(sql, /r\.user_id = p_user_id/)
  assert.match(sql, /vj\.user_id = p_user_id/)
  assert.match(sql, /request\.user_id = p_user_id/)
  assert.equal((sql.match(/v_platform NOT IN \('instagram', 'facebook'\)/g) || []).length, 3)
  assert.equal((sql.match(/connection_status = 'active'/g) || []).length, 3)
  assert.equal((sql.match(/caption_snapshot IS DISTINCT FROM p_caption/g) || []).length, 3)
  assert.equal((sql.match(/idempotency_key_intent_mismatch/g) || []).length, 3)
})

test('snapshot confirmado é persistido sem alterar custo ou invocar IA', () => {
  assert.equal((sql.match(/media_asset_id, caption_snapshot, status/g) || []).length, 3)
  assert.equal((sql.match(/v_media_asset_id, p_caption, 'queued'/g) || []).length, 3)
  assert.doesNotMatch(sql, /smart_tokens|reserve_smart|debit_smart|openai|net\.http|invoke[^\n]*generate/i)
})

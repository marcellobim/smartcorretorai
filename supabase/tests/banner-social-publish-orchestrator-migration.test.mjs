import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260831020000_prepare_banner_social_publish_orchestrator.sql', import.meta.url), 'utf8')

test('migration preserva identidade estável por destino, criação, mídia e opção', () => {
  assert.match(sql, /source_option_id TEXT/i)
  assert.match(sql, /media_asset_id TEXT/i)
  assert.match(sql, /CREATE UNIQUE INDEX social_publish_jobs_banner_destination_unique/i)
  assert.match(sql, /user_id, platform, source_type, source_id, source_option_id, media_asset_id/i)
})

test('create/reuse valida owner, mídia concluída, conta ativa e caption snapshot', () => {
  assert.match(sql, /r\.user_id = p_user_id/i)
  assert.match(sql, /i\.piece_id = v_media_asset_id/i)
  assert.match(sql, /i\.creation_option = v_option_number/i)
  assert.match(sql, /h\.user_id = p_user_id/i)
  assert.match(sql, /caption_snapshot/i)
  assert.match(sql, /account_status = 'active'/i)
})

test('RPC permanece somente service_role com SECURITY DEFINER e search_path fixo', () => {
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = ''/i)
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/i)
  assert.match(sql, /REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/i)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/i)
})

test('migration não publica, não chama Meta e não movimenta ST', () => {
  assert.doesNotMatch(sql, /graph\.facebook\.com|media_publish|\/photos|credit_lots|smart_tokens_consumed\s*=/i)
})

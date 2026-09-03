import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync(new URL('../migrations/20260831030000_prepare_smart_tour_video_social_publish.sql',import.meta.url),'utf8')

test('migration persiste três opções e metadados do MP4 sem aplicar publicação',()=>{assert.match(sql,/publication_options JSONB NOT NULL DEFAULT '\[\]'::JSONB/i);assert.match(sql,/output_media_metadata JSONB/i);assert.match(sql,/jsonb_array_length\(publication_options\) = 3/i);assert.doesNotMatch(sql,/graph\.facebook\.com|media_publish|\/videos|credit_lots|smart_tokens_consumed\s*=/i)})
test('identidade do vídeo exige source, asset e option estáveis',()=>{assert.match(sql,/source_type = 'video_imobiliario'/i);assert.match(sql,/source_option_id ~ '\^smart-tour-caption-option-\[1-3\]\$'/i);assert.match(sql,/media_asset_id = source_id::TEXT/i)})
test('create/reuse valida owner, job concluído, MP4 e caption persistida',()=>{assert.match(sql,/vj\.user_id = p_user_id/i);assert.match(sql,/vj\.status = 'completed'/i);assert.match(sql,/vj\.mode = 'smart_tour_gemini_omni'/i);assert.match(sql,/output_video_path = p_user_id::TEXT \|\| '\/' \|\| p_source_id::TEXT \|\| '\/smart-tour\.mp4'/i);assert.match(sql,/output_media_metadata->>'mime_type' = 'video\/mp4'/i);assert.match(sql,/v_stored_caption IS DISTINCT FROM p_caption/i)})
test('jobs são independentes por destino e idempotentes',()=>{assert.match(sql,/j\.platform = v_platform/i);assert.match(sql,/j\.source_id = p_source_id/i);assert.match(sql,/j\.source_option_id = v_option_id/i);assert.match(sql,/j\.media_asset_id = v_media_asset_id/i);assert.match(sql,/idempotency_key_intent_mismatch/i)})
test('RPC é service-only com SECURITY DEFINER e search_path fixo',()=>{assert.match(sql,/SECURITY DEFINER\s+SET search_path = ''/i);assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/i);assert.match(sql,/REVOKE EXECUTE[\s\S]*FROM PUBLIC, anon, authenticated/i);assert.match(sql,/GRANT EXECUTE[\s\S]*TO service_role/i)})

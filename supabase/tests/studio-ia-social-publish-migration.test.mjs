import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sql = await readFile(new URL('../migrations/20260901050000_enable_studio_ia_social_publish.sql', import.meta.url), 'utf8')

test('migration adiciona somente identidades Studio IA e mantém uma publicação por destino', () => {
  for (const source of ['studio_ia_commercial','studio_ia_creative','studio_ia_carousel']) assert.match(sql,new RegExp(source))
  assert.match(sql,/social_publish_jobs_studio_destination_unique/)
  assert.match(sql,/source_option_id ~ '\^studio-caption-option-\[1-3\]\$'/)
})

test('RPC valida owner, entrega terminal, texto persistido e conexão ativa', () => {
  assert.match(sql,/vj\.user_id = p_user_id AND vj\.status = 'completed'/)
  assert.match(sql,/request\.user_id = p_user_id[\s\S]*request\.status = 'succeeded'/)
  assert.match(sql,/v_stored_caption IS DISTINCT FROM p_caption/)
  assert.match(sql,/connection\.connection_status = 'active'/)
})

test('migration não movimenta economia nem cria jobs durante deploy', () => {
  assert.doesNotMatch(sql,/smart_token|credit_reservation|settle_/i)
  assert.doesNotMatch(sql,/DO\s+\$\$[\s\S]*INSERT INTO public\.social_publish_jobs/i)
})

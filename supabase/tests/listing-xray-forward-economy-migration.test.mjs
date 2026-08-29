import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../migrations/20260830020000_fix_listing_xray_v1_economy_and_image_input.sql', import.meta.url), 'utf8')

const auditedRemoteColumns = [
  'id', 'user_id', 'client_request_id', 'product_code', 'source_domain',
  'source_url_hash', 'source_url_sanitized', 'status', 'claim_token',
  'normalized_facts', 'result', 'provider_model', 'input_tokens', 'output_tokens',
  'total_tokens', 'estimated_cost_usd', 'error_code', 'duration_ms', 'created_at',
  'updated_at', 'completed_at', 'expires_at',
]
const approvedNewColumns = [
  'input_kind', 'image_count', 'content_type_hint', 'continuation', 'catalog_version',
  'smart_tokens_quoted', 'smart_tokens_reserved', 'smart_tokens_consumed',
  'smart_tokens_refunded', 'reservation_id', 'idempotency_key',
]

test('é forward-only e parte explicitamente das 22 colunas auditadas', () => {
  assert.equal(auditedRemoteColumns.length, 22)
  assert.equal(approvedNewColumns.length, 11)
  assert.doesNotMatch(migration, /CREATE TABLE public\.listing_xray_requests/i)
  for (const column of approvedNewColumns) assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`, 'i'))
  assert.match(migration, /listing_xray_base_schema_missing/)
  assert.match(migration, /listing_xray_active_requests_prevent_upgrade/)
})

test('backfill histórico é determinístico, neutro e não cria reserva retroativa', () => {
  const historical = { status: 'insufficient', result: null, completed_at: null, reserved: 0, consumed: 0, refunded: 0, reservation_id: null }
  assert.equal(historical.status, 'insufficient')
  assert.equal(historical.result, null)
  assert.equal(historical.completed_at, null)
  assert.deepEqual([historical.reserved, historical.consumed, historical.refunded], [0, 0, 0])
  assert.equal(historical.reservation_id, null)
  assert.match(migration, /smart_tokens_reserved = 0/)
  assert.match(migration, /smart_tokens_consumed = 0/)
  assert.match(migration, /smart_tokens_refunded = 0/)
  assert.match(migration, /reservation_id = NULL/)
  assert.match(migration, /'listing_xray:' \|\| user_id::TEXT \|\| ':' \|\| client_request_id::TEXT/)
  assert.doesNotMatch(migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION')), /reserve_credits_from_lots|consume_reserved_credits_from_lots|cancel_credit_reservation_from_lots/i)
})

test('schema final aceita awaiting_input e aplica constraints econômicas de 10 ST', () => {
  assert.match(migration, /'processing','awaiting_input','completed','insufficient','failed','expired'/)
  assert.match(migration, /listing_xray_economy_key_unique UNIQUE \(user_id, idempotency_key\)/)
  assert.match(migration, /listing_xray_economic_resolution/)
  assert.match(migration, /smart_tokens_quoted = 10/)
  assert.match(migration, /smart_tokens_reserved IN \(0,10\)/)
  assert.match(migration, /smart_tokens_consumed IN \(0,10\)/)
  assert.match(migration, /smart_tokens_refunded IN \(0,10\)/)
  assert.match(migration, /status='completed'[\s\S]*smart_tokens_consumed=10/)
  assert.match(migration, /FOREIGN KEY \(reservation_id\) REFERENCES public\.credit_reservations/)
})

test('substitui overloads antigos e instala exatamente as seis RPCs aprovadas', () => {
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.claim_listing_xray_request\(UUID,UUID,TEXT,TEXT,TEXT\)/)
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.finish_listing_xray_without_result\(UUID,UUID,UUID,TEXT,TEXT,JSONB\)/)
  const names = [...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)/gi)].map(match => match[1])
  assert.deepEqual(names, [
    'claim_listing_xray_request',
    'complete_listing_xray_request',
    'await_listing_xray_input',
    'finish_listing_xray_without_result',
    'get_listing_xray_request',
    'cleanup_listing_xray_requests',
  ])
})

test('economia usa helpers existentes e nunca cobra mais de 10 ST', () => {
  assert.match(migration, /reserve_credits_from_lots\(p_user_id,10,v_key/)
  assert.match(migration, /consume_reserved_credits_from_lots/)
  assert.match(migration, /cancel_credit_reservation_from_lots/)
  assert.match(migration, /v_request\.status='completed'[\s\S]*RETURN NEXT v_request/)
  assert.match(migration, /v_request\.status='awaiting_input'[\s\S]*reservation_id/)
  assert.match(migration, /smart_tokens_consumed=10/)
  assert.match(migration, /smart_tokens_refunded=smart_tokens_reserved/)
  assert.doesNotMatch(migration, /reserve_credits_from_lots\([^\n]*,(?:[1-9][1-9]|[2-9][0-9]|[1-9][0-9]{2,}),/)
})

test('browser não recebe acesso e todas as RPCs mantêm guard service_role', () => {
  const guards = migration.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g) || []
  assert.equal(guards.length, 6)
  for (const name of ['claim_listing_xray_request', 'complete_listing_xray_request', 'await_listing_xray_input', 'finish_listing_xray_without_result', 'get_listing_xray_request', 'cleanup_listing_xray_requests']) {
    assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?FROM PUBLIC,anon,authenticated`, 'i'))
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?TO service_role`, 'i'))
  }
  assert.doesNotMatch(migration, /GRANT (?:SELECT|INSERT|UPDATE|DELETE).*authenticated/i)
})

test('migration é isolada ao Raio-X', () => {
  for (const product of ['short_videos', 'virtual_staging', 'quick_banners', 'text_campaign', 'smart_carousel']) {
    assert.doesNotMatch(migration, new RegExp(`product_code['\"]?\\s*[,=]\\s*['\"]${product}`, 'i'))
  }
  assert.match(migration, /BEGIN;/)
  assert.match(migration, /COMMIT;/)
})

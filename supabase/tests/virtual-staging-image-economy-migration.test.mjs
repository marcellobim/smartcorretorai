import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260820040000_create_virtual_staging_image_economy.sql', import.meta.url), 'utf8')

test('reserva FEFO uma única operação de 1 a 5 imagens a 30 ST por imagem', () => {
  assert.match(sql, /image_count BETWEEN 1 AND 5/)
  assert.match(sql, /unit_cost = 30/)
  assert.match(sql, /smart_tokens_quoted = image_count \* 30/)
  assert.match(sql, /UNIQUE \(user_id, client_request_id\)/)
  assert.match(sql, /reserve_credits_from_lots/)
  assert.match(sql, /ORDER BY cl\.expires_at ASC NULLS LAST,cl\.created_at,cl\.id/)
  assert.match(sql, /UNIQUE \(request_id, item_index\)/)
})

test('settlement parcial consome entregues, devolve falhas e sincroniza o saldo uma vez', () => {
  assert.match(sql, /v_consumed:=v_completed\*30; v_refunded:=v_failed\*30/)
  assert.match(sql, /status='consumed'/)
  assert.match(sql, /status='refunded'/)
  assert.match(sql, /remaining_amount=remaining_amount\+v_slice\.amount/)
  assert.match(sql, /sync_credit_balance_cache_from_lots/)
  assert.match(sql, /smart_tokens_consumed=CASE WHEN status='completed' THEN 30 ELSE 0 END/)
  assert.match(sql, /ON CONFLICT\(idempotency_key\) DO UPDATE/)
})

test('matriz econômica cobre sucesso total, falha total e falhas parciais sem saldo negativo', () => {
  const settle = (images, completed) => ({ reserved: images * 30, consumed: completed * 30, refunded: (images - completed) * 30 })
  assert.deepEqual(settle(1, 1), { reserved: 30, consumed: 30, refunded: 0 })
  assert.deepEqual(settle(5, 5), { reserved: 150, consumed: 150, refunded: 0 })
  assert.deepEqual(settle(5, 3), { reserved: 150, consumed: 90, refunded: 60 })
  assert.deepEqual(settle(5, 4), { reserved: 150, consumed: 120, refunded: 30 })
  assert.deepEqual(settle(5, 1), { reserved: 150, consumed: 30, refunded: 120 })
  assert.deepEqual(settle(5, 0), { reserved: 150, consumed: 0, refunded: 150 })
  for (let images = 1; images <= 5; images += 1) {
    for (let completed = 0; completed <= images; completed += 1) {
      const result = settle(images, completed)
      assert.equal(result.consumed + result.refunded, result.reserved)
      assert.ok(result.consumed >= 0 && result.refunded >= 0)
    }
  }
})

test('concorrência usa identidade única e locks para não duplicar reserva ou claim', () => {
  assert.match(sql, /ON CONFLICT\(user_id,client_request_id\) DO NOTHING/)
  assert.match(sql, /WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE/)
  assert.match(sql, /IF v_request\.reservation_id IS NOT NULL THEN RETURN NEXT v_request; RETURN; END IF/)
  assert.match(sql, /IF v_item\.status='pending' THEN[\s\S]*status='processing'/)
})

test('tabelas e RPCs econômicas são privadas e preservam telemetria de uso/custo', () => {
  for (const table of ['virtual_staging_image_requests', 'virtual_staging_image_items', 'virtual_staging_image_item_allocations']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`))
  }
  assert.match(sql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(sql, /provider_usage JSONB/)
  assert.match(sql, /estimated_cost_usd_micros BIGINT NULL/)
  assert.match(sql, /quality TEXT NOT NULL DEFAULT 'medium'/)
  assert.match(sql, /model TEXT NOT NULL DEFAULT 'gpt-image-2'/)
})

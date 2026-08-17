import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  GEMINI_VIDEO_PRODUCT_CODES,
  claimGeminiVideoEconomy,
  insufficientGeminiVideoTokensResponse,
  quoteGeminiVideoGeneration,
  settleGeminiVideoEconomy,
} from '../gemini-video-economy.ts'

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('the four server-owned Gemini family SKUs quote exactly one 325 ST generation', () => {
  assert.deepEqual([...GEMINI_VIDEO_PRODUCT_CODES], ['real_estate_video', 'short_videos', 'life_in_property', 'broker_presentation'])
  for (const productCode of GEMINI_VIDEO_PRODUCT_CODES) {
    const sku = quoteGeminiVideoGeneration(productCode)
    assert.equal(sku.smartTokenCost, 325)
    assert.equal(sku.variant, 'standard')
    assert.equal(sku.enabled, true)
    assert.equal(sku.trialEligible, false)
    assert.equal(sku.metadata.quantity, 1)
  }
})

test('claim sends identity and telemetry but never accepts a client-controlled price', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const claim = await claimGeminiVideoEconomy({ rpc: async (name, args) => {
    calls.push({ name, args })
    return { data: [{ request_id: REQUEST_ID, request_status: 'processing', execution_claimed: true, required_tokens: 325, available_tokens: 900 }], error: null }
  } }, { userId: USER_ID, clientRequestId: REQUEST_ID, productCode: 'short_videos', metadata: { input_duration_seconds: 143, input_bytes: 12_345 } })
  assert.equal(claim.executionClaimed, true)
  assert.equal(claim.requiredTokens, 325)
  assert.equal(claim.availableTokens, 900)
  assert.equal(calls[0].name, 'claim_gemini_video_economy_request')
  assert.equal('p_amount' in calls[0].args, false)
  assert.equal('price' in calls[0].args, false)
  assert.equal('smart_token_cost' in calls[0].args, false)
})

test('insufficient balance exposes only required and available Smart Tokens', async () => {
  const claim = await claimGeminiVideoEconomy({ rpc: async () => ({
    data: [{ request_id: REQUEST_ID, request_status: 'insufficient', execution_claimed: false, required_tokens: 325, available_tokens: 124 }], error: null,
  }) }, { userId: USER_ID, clientRequestId: REQUEST_ID, productCode: 'real_estate_video' })
  assert.deepEqual(insufficientGeminiVideoTokensResponse(claim), {
    ok: false, code: 'INSUFFICIENT_SMART_TOKENS', error: 'Saldo de Smart Tokens insuficiente.', required_tokens: 325, available_tokens: 124,
  })
})

test('terminal settlement is delegated to one persistent idempotent RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = { rpc: async (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return { data: null, error: null } } }
  await settleGeminiVideoEconomy(client, { userId: USER_ID, clientRequestId: REQUEST_ID, status: 'completed', result: { output_video_path: 'recoverable.mp4' } })
  await settleGeminiVideoEconomy(client, { userId: USER_ID, clientRequestId: REQUEST_ID, status: 'failed', reason: 'provider_failed' })
  assert.deepEqual(calls.map(call => call.name), ['settle_gemini_video_economy_request', 'settle_gemini_video_economy_request'])
  assert.equal(calls[0].args.p_final_status, 'completed')
  assert.equal(calls[1].args.p_final_status, 'failed')
})

test('local SQL owns claim, FEFO reservation, idempotent consumption/refund and private ACL', async () => {
  const sql = await readFile(new URL('../../../migrations/20260817040000_create_gemini_video_economy.sql', import.meta.url), 'utf8')
  assert.match(sql, /unique \(user_id, product_code, client_request_id\)/i)
  assert.match(sql, /reserve_credits_from_lots\(p_user_id, 325, v_key/i)
  assert.match(sql, /consume_reserved_credits_from_lots\(p_user_id, v_request\.idempotency_key/i)
  assert.match(sql, /cancel_credit_reservation_from_lots\(p_user_id, v_request\.idempotency_key/i)
  assert.match(sql, /if v_request\.status in \('completed','failed','insufficient'\) then return/i)
  assert.match(sql, /revoke all on table public\.gemini_video_economy_requests from public, anon, authenticated/i)
  assert.match(sql, /grant execute[\s\S]+to service_role/i)
  assert.doesNotMatch(sql, /profiles\.role|user_metadata|@.*\.(com|com\.br)/i)
})

test('all four product pipelines claim before their first paid provider and settle from status recovery', async () => {
  const smartGenerate = await readFile(new URL('../../smart-tour-generate/index.ts', import.meta.url), 'utf8')
  const virtualGenerate = await readFile(new URL('../../virtual-staging-generate/index.ts', import.meta.url), 'utf8')
  const smartStatus = await readFile(new URL('../../smart-tour-status/index.ts', import.meta.url), 'utf8')
  const virtualStatus = await readFile(new URL('../../virtual-staging-status/index.ts', import.meta.url), 'utf8')
  for (const product of ["'short_videos'", "'real_estate_video'"]) assert.match(smartGenerate, new RegExp(`productCode:${product}`))
  for (const product of ["'life_in_property'", "'broker_presentation'"]) assert.match(virtualGenerate, new RegExp(product))
  assert.ok(smartGenerate.indexOf('claimGeminiVideoEconomy(supabase') < smartGenerate.indexOf('await generateSmartTourDynamicNarration'))
  assert.ok(virtualGenerate.indexOf('claimGeminiVideoEconomy(supabase') < virtualGenerate.indexOf('await generateStrategicHashtags({apiKey'))
  assert.match(smartStatus, /settleEconomy\('completed'/)
  assert.match(smartStatus, /settleEconomy\('failed'/)
  assert.match(virtualStatus, /settleEconomy\('completed'/)
  assert.match(virtualStatus, /settleEconomy\('failed'/)
})

test('Short Videos preserves long MP4 input and the existing 250 MB / 5 minute contract', async () => {
  const validation = await readFile(new URL('../smart-tour/validation.ts', import.meta.url), 'utf8')
  const client = await readFile(new URL('../geminiOmniClient.ts', import.meta.url), 'utf8')
  assert.match(client, /250 \* 1024 \* 1024|262144000/)
  assert.match(validation, /300|5 \* 60/)
})

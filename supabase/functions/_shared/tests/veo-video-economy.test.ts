import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  claimVeoVideoEconomy,
  insufficientVeoVideoTokensResponse,
  productCodeForVeoMode,
  quoteVeoVideoGeneration,
  settleVeoVideoEconomy,
} from '../veo-video-economy.ts'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const REQUEST_ID = '22222222-2222-4222-8222-222222222222'
const migration = readFileSync(new URL('../../../migrations/20260817050000_create_veo_video_economy.sql', import.meta.url), 'utf8')
const creator = readFileSync(new URL('../../criar-video-ia/index.ts', import.meta.url), 'utf8')
const status = readFileSync(new URL('../../get-video-job-status/index.ts', import.meta.url), 'utf8')

test('Comercial Imobiliario and Video Criativo have separate canonical 120 ST SKUs', () => {
  assert.equal(productCodeForVeoMode('dynamic_reel'), 'real_estate_commercial')
  assert.equal(productCodeForVeoMode('free_ai'), 'creative_video')
  assert.equal(quoteVeoVideoGeneration('real_estate_commercial').smartTokenCost, 120)
  assert.equal(quoteVeoVideoGeneration('creative_video').smartTokenCost, 120)
  assert.notEqual(quoteVeoVideoGeneration('real_estate_commercial').productCode, quoteVeoVideoGeneration('creative_video').productCode)
})

test('claim sends server-owned identity and admin decision to one persistent RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return { data: [{
      request_id: REQUEST_ID, request_status: 'processing', execution_claimed: true,
      required_tokens: 120, available_tokens: 500, reservation_id: 'reservation-id',
      idempotency_key: 'server-key', admin_bypass: false,
    }], error: null }
  } }
  const result = await claimVeoVideoEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, productCode: 'creative_video',
    jobId: REQUEST_ID, adminBypass: false, metadata: { fps: 24 },
  })
  assert.equal(result.requiredTokens, 120)
  assert.equal(result.executionClaimed, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'claim_veo_video_economy_request')
  assert.equal(calls[0].args.p_product_code, 'creative_video')
  assert.equal(calls[0].args.p_admin_bypass, false)
  assert.equal('price' in calls[0].args || 'amount' in calls[0].args || 'p_amount' in calls[0].args, false)
})

test('insufficient response exposes only Smart Token quantities and blocks execution', async () => {
  const client = { rpc: async () => ({ data: [{
    request_id: REQUEST_ID, request_status: 'insufficient', execution_claimed: false,
    required_tokens: 120, available_tokens: 119, idempotency_key: 'server-key', admin_bypass: false,
  }], error: null }) }
  const claim = await claimVeoVideoEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, productCode: 'real_estate_commercial',
    jobId: REQUEST_ID, adminBypass: false,
  })
  assert.deepEqual(insufficientVeoVideoTokensResponse(claim), {
    success: false, ok: false, code: 'INSUFFICIENT_SMART_TOKENS',
    error: 'Saldo de Smart Tokens insuficiente.', required_tokens: 120, available_tokens: 119,
  })
  assert.equal(claim.executionClaimed, false)
})

test('settlement delegates idempotent completed and failed outcomes to the database', async () => {
  const calls: string[] = []
  const client = { rpc: async (name: string) => { calls.push(name); return { data: true, error: null } } }
  assert.equal(await settleVeoVideoEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, status: 'completed', result: { output_video_path: 'video.mp4' },
  }), true)
  assert.equal(await settleVeoVideoEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, status: 'failed', reason: 'terminal_failure',
  }), true)
  assert.deepEqual(calls, ['settle_veo_video_economy_request', 'settle_veo_video_economy_request'])
})

test('migration is private, concurrent-safe, FEFO and exactly-once', () => {
  assert.match(migration, /unique \(user_id, client_request_id\)/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /execution_claimed_at is not null[\s\S]*execution_claimed[\s\S]*false/i)
  assert.match(migration, /get_credit_lot_balance\(p_user_id\)/i)
  assert.match(migration, /v_balance < 120[\s\S]*INSUFFICIENT_SMART_TOKENS/i)
  assert.match(migration, /reserve_credits_from_lots\([\s\S]*p_user_id, 120/i)
  assert.match(migration, /consume_reserved_credits_from_lots/i)
  assert.match(migration, /cancel_credit_reservation_from_lots/i)
  assert.match(migration, /status in \('completed','failed','insufficient'\)[\s\S]*return true/i)
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/i)
  assert.match(migration, /revoke all on function public\.claim_veo_video_economy_request[\s\S]*public, anon, authenticated/i)
})

test('creator reserves before Veo and preserves official admin authorization', () => {
  const claimAt = creator.indexOf('await claimVeoVideoEconomy')
  const providerAt = creator.indexOf('await startVeoVideo')
  assert.ok(claimAt > 0 && providerAt > claimAt)
  assert.match(creator, /isAuthorizedAdmin\(supabase, user\.id\)/)
  assert.doesNotMatch(creator, /user_metadata\.role|profiles\.role|@.*admin|STUDIO_HERO_TOKEN_COST/)
  assert.match(creator, /if \(economyClaim\.status === 'insufficient'\)[\s\S]*return jsonResponse[\s\S]*402/)
  assert.match(creator, /if \(!economyClaim\.executionClaimed\)[\s\S]*return jsonResponse/)
})

test('lost responses recover provider identity and consumption follows persisted delivery', () => {
  assert.match(creator, /acceptedProviderJobId = veoResult\.providerJobId[\s\S]*updateVeoVideoEconomyTelemetry/)
  assert.match(status, /veo_video_economy_requests[\s\S]*provider_job_id/)
  const persistAt = status.indexOf("status: 'completed',\n        output_video_path: outputPath")
  const settleAt = status.indexOf('await settleJobEconomy', persistAt)
  assert.ok(persistAt > 0 && settleAt > persistAt)
  assert.match(status, /job\.status === 'completed'[\s\S]*settleJobEconomy/)
  assert.match(status, /job\.status === 'failed'[\s\S]*settleJobEconomy/)
})

test('Veo product contract remains one 8s 720p generation with current inputs and lastFrame', () => {
  assert.match(creator, /durationSeconds: 8/)
  assert.match(creator, /resolution: '720p'/)
  assert.match(creator, /fps: 24/)
  assert.match(creator, /sampleCount: 1/)
  assert.match(creator, /image1Path: inputImage1Path \|\| undefined/)
  assert.match(creator, /image2Path: inputImage2Path \|\| undefined/)
  assert.match(creator, /resolveStudioHeroCtaFrame/)
  assert.match(creator, /audio_requested: true/)
})

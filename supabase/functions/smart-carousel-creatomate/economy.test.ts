import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  claimSmartCarouselEconomy,
  insufficientSmartCarouselTokensResponse,
  quoteSmartCarousel,
  recoverSmartCarouselEconomy,
  settleSmartCarouselEconomy,
} from '../_shared/smart-carousel-economy.ts'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const REQUEST_ID = '22222222-2222-4222-8222-222222222222'
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const frontend = readFileSync(new URL('../../../frontend/src/pages/SmartCarrossel.jsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../migrations/20260817060000_create_smart_carousel_economy.sql', import.meta.url), 'utf8')

test('every valid 5-20 image delivery has one fixed 100 ST server quote', () => {
  for (const imageCount of [5, 6, 10, 15, 20]) {
    const quote = quoteSmartCarousel(imageCount)
    assert.equal(quote.productCode, 'smart_carousel')
    assert.equal(quote.variant, 'standard')
    assert.equal(quote.smartTokenCost, 100)
  }
  assert.throws(() => quoteSmartCarousel(4), /invalid_smart_carousel_image_count/)
  assert.throws(() => quoteSmartCarousel(21), /invalid_smart_carousel_image_count/)
})

test('claim sends image telemetry but never a frontend-controlled amount', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const client = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return { data: [{
      request_id: REQUEST_ID, request_status: 'processing', execution_claimed: true,
      required_tokens: 100, available_tokens: 250, reservation_id: 'reservation', idempotency_key: 'server-key',
    }], error: null }
  } }
  const claim = await claimSmartCarouselEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, imageCount: 15, metadata: { image_count: 15 },
  })
  assert.equal(claim.requiredTokens, 100)
  assert.equal(calls[0].name, 'claim_smart_carousel_economy_request')
  assert.equal(calls[0].args.p_image_count, 15)
  assert.equal('p_amount' in calls[0].args || 'price' in calls[0].args || 'smart_tokens' in calls[0].args, false)
})

test('insufficient balance exposes only Smart Tokens and cannot claim execution', async () => {
  const client = { rpc: async () => ({ data: [{
    request_id: REQUEST_ID, request_status: 'insufficient', execution_claimed: false,
    required_tokens: 100, available_tokens: 99, idempotency_key: 'server-key',
  }], error: null }) }
  const claim = await claimSmartCarouselEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, imageCount: 5,
  })
  assert.equal(claim.executionClaimed, false)
  assert.deepEqual(insufficientSmartCarouselTokensResponse(claim), {
    ok: false, code: 'INSUFFICIENT_SMART_TOKENS', error: 'Saldo de Smart Tokens insuficiente.',
    required_tokens: 100, available_tokens: 99,
  })
})

test('recovery and terminal settlement use persistent server RPCs', async () => {
  const calls: string[] = []
  const client = { rpc: async (name: string) => {
    calls.push(name)
    if (name === 'get_smart_carousel_economy_request') return { data: [{
      request_status: 'succeeded', render_id: 'render', receipt: 'receipt',
      campaign_package: { campaigns: [1, 2, 3] }, video_url: 'https://example.test/video.mp4',
      provider_started_at: '2026-08-17T12:00:00.000Z',
    }], error: null }
    return { data: null, error: null }
  } }
  const recovered = await recoverSmartCarouselEconomy(client, { userId: USER_ID, clientRequestId: REQUEST_ID })
  assert.equal(recovered.status, 'succeeded')
  assert.equal(recovered.videoUrl, 'https://example.test/video.mp4')
  assert.equal(recovered.providerStartedAt, '2026-08-17T12:00:00.000Z')
  await settleSmartCarouselEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, status: 'succeeded', videoUrl: recovered.videoUrl,
  })
  await settleSmartCarouselEconomy(client, {
    userId: USER_ID, clientRequestId: REQUEST_ID, status: 'failed', reason: 'terminal_failure',
  })
  assert.deepEqual(calls, [
    'get_smart_carousel_economy_request',
    'settle_smart_carousel_economy_request',
    'settle_smart_carousel_economy_request',
  ])
})

test('migration enforces concurrency, FEFO, exactly-once settlement and private ACL', () => {
  assert.match(migration, /image_count between 5 and 20/i)
  assert.match(migration, /unique \(user_id, client_request_id\)/i)
  assert.match(migration, /for update/i)
  assert.match(migration, /execution_claimed_at is not null[\s\S]*false/i)
  assert.match(migration, /v_balance < 100[\s\S]*INSUFFICIENT_SMART_TOKENS/i)
  assert.match(migration, /reserve_credits_from_lots\([\s\S]*p_user_id, 100/i)
  assert.match(migration, /consume_reserved_credits_from_lots/i)
  assert.match(migration, /cancel_credit_reservation_from_lots/i)
  assert.match(migration, /status in \('succeeded','failed','insufficient'\)[\s\S]*return/i)
  assert.match(migration, /revoke all on table[\s\S]*public, anon, authenticated/i)
})

test('backend validates 5-20 then reserves before GPT, TTS and Creatomate', () => {
  assert.match(source, /imagePaths\.length < SMART_CAROUSEL_MIN_IMAGES \|\| imagePaths\.length > SMART_CAROUSEL_MAX_IMAGES/)
  const claimAt = source.indexOf('await claimSmartCarouselEconomy')
  const gptAt = source.indexOf('await buildPresentationPlan', claimAt)
  const creatomateAt = source.indexOf("fetch('https://api.creatomate.com/v2/renders'", claimAt)
  assert.ok(claimAt > 0 && gptAt > claimAt && creatomateAt > gptAt)
  assert.match(source, /economyClaim\.status === 'insufficient'[\s\S]*return jsonResponse[\s\S]*402/)
})

test('current providers and RenderScript remain unchanged', () => {
  assert.match(source, /OPENAI_MARKETING_MODEL = 'gpt-4\.1'/)
  assert.match(source, /OPENAI_TTS_MODEL = 'tts-1'/)
  assert.match(source, /api\.creatomate\.com\/v2\/renders/)
  assert.match(source, /output_format: 'mp4'/)
  assert.match(source, /width: 1080[\s\S]*height: 1920[\s\S]*frame_rate: 30/)
  assert.match(source, /calculateSmartCarouselTiming\(imageUrls\.length\)/)
  assert.doesNotMatch(source, /isAuthorizedAdmin|profiles\.role|user_metadata\.role|hardcoded.*email/i)
})

test('delivery is persisted before consumption and retries recover without providers', () => {
  const recordAt = source.indexOf('await recordSmartCarouselProvider')
  const createReturnAt = source.indexOf('return jsonResponse({', recordAt)
  assert.ok(recordAt > 0 && createReturnAt > recordAt)
  assert.match(source, /!economyClaim\.executionClaimed[\s\S]*recoverSmartCarouselEconomy/)
  assert.match(source, /recovered\.status === 'succeeded'[\s\S]*video_url: recovered\.videoUrl/)
  assert.match(source, /settleSmartCarouselEconomy\(supabase,[\s\S]*status: 'succeeded'[\s\S]*videoUrl/)
  assert.match(frontend, /pollRenderStatus\(data\.receipt \|\| '', jobId\)/)
  assert.match(frontend, /demorou mais que o esperado\|failed to fetch\|network[\s\S]*pollRenderStatus\('', jobId\)/)
})

test('signed receipts from pre-economy renders keep their legacy status path', () => {
  assert.match(source, /if \(!recovered\.found && !payload\)[\s\S]*404/)
  assert.match(source, /if \(recovered\.found\) \{[\s\S]*settleSmartCarouselEconomy/)
  assert.match(source, /const renderId = payload\?\.r \|\| recovered\.renderId/)
})

test('a stale claim without provider identity is terminally refunded', () => {
  assert.match(source, /Date\.now\(\) - providerStartedAt > 15 \* 60 \* 1000/)
  assert.match(source, /smart_carousel_provider_start_timeout/)
})

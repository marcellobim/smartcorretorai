import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handleBannerSocialPublish, type BannerDestination, type BannerSocialPublishDependencies } from './runtime.ts'

const sourceId = '6b66b517-8fea-4b62-a180-89f64c418cba'
const userId = '0d41421b-a063-4320-bba8-0f2f840c5fa1'
const captions = ['Texto 1 exato.', 'Texto 2 exato.\nSem alteração.', 'Texto 3 exato.']

const request = (destinations: BannerDestination[], option = 1, action: 'publish' | 'recovery' = 'publish', captionSnapshot?: string) => new Request('https://local.invalid/social-publish-banner', {
  method: 'POST',
  headers: { Authorization: 'Bearer user-session', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action,
    source: { type: 'banner_imobiliario', id: sourceId },
    media_asset_id: `idea-${option}-instagram_feed`,
    option_id: `banner-caption-option-${option}`,
    ...(captionSnapshot === undefined ? {} : { caption_snapshot: captionSnapshot }),
    destinations,
  }),
})

function context(outcomes: Partial<Record<BannerDestination, string>> = {}) {
  const calls = { resolved: 0, created: [] as Array<Record<string, unknown>>, claimed: [] as string[], leased: [] as string[], workers: [] as BannerDestination[] }
  const jobs = new Map<BannerDestination, { id: string; status: string; idempotency: string }>()
  const dependencies: BannerSocialPublishDependencies = {
    authenticate: async token => token === 'user-session' ? { id: userId } : null,
    resolveIntent: async (_owner, input) => {
      calls.resolved += 1
      return ({
      sourceId: input.sourceId,
      mediaAssetId: input.mediaAssetId,
      optionId: input.optionId,
      captionSnapshot: input.captionSnapshot ?? captions[Number(input.optionId.at(-1)) - 1],
      connectionId: '9bc6ad60-9021-4fda-a8f9-da6756f41cba',
      bucket: 'smartcorretor-assets',
      objectPath: `${userId}/hero-ia-next/generation/hero-principal.jpg`,
      contentType: 'image/jpeg',
      contentLength: 1234,
      })
    },
    deriveIdempotencyKey: async (_owner, intent, destination) => `${destination}-${intent.optionId}`,
    createOrReuseJob: async input => {
      calls.created.push(input)
      const existing = jobs.get(input.destination)
      if (existing) return { id: existing.id, status: existing.status, reused: true }
      const job = { id: input.destination === 'instagram' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222', status: 'queued', idempotency: input.idempotencyKey }
      jobs.set(input.destination, job)
      return { id: job.id, status: job.status, reused: false }
    },
    findJob: async (_owner, _key, destination) => {
      const job = jobs.get(destination)
      return job ? { jobId: job.id, destination, status: job.status, externalPostId: job.status === 'published' ? `${destination}-post` : null, externalPostLink: null, publicErrorCode: job.status === 'failed' ? 'social_publish_failed' : null, captionSnapshot: captions[0] } : null
    },
    claimJob: async jobId => {
      calls.claimed.push(jobId)
      return { jobId, claimToken: '33333333-3333-4333-8333-333333333333' }
    },
    createLease: async input => { calls.leased.push(input.jobId); return true },
    hashCapability: async () => 'a'.repeat(64),
    randomCapability: () => 'x'.repeat(43),
    invokeWorker: async input => {
      calls.workers.push(input.destination)
      const job = jobs.get(input.destination)!
      job.status = outcomes[input.destination] || 'published'
      return { ok: job.status === 'published' }
    },
  }
  return { calls, jobs, dependencies }
}

Deno.test('legenda editada, substituída e vazia chegam exatamente ao job', async () => {
  for (const captionSnapshot of ['Texto 1 editado.', 'Novo anúncio 🏡\nAgende sua visita.', '']) {
    const testContext = context()
    const response = await handleBannerSocialPublish(request(['instagram'], 1, 'publish', captionSnapshot), testContext.dependencies)
    assertEquals(response.status, 200)
    assertEquals((testContext.calls.created[0].intent as { captionSnapshot: string }).captionSnapshot, captionSnapshot)
  }
})

for (const option of [1, 2, 3]) {
  Deno.test(`Texto ${option} vira caption_snapshot exato no job`, async () => {
    const testContext = context()
    const response = await handleBannerSocialPublish(request(['instagram'], option), testContext.dependencies)
    assertEquals(response.status, 200)
    assertEquals((testContext.calls.created[0].intent as { captionSnapshot: string }).captionSnapshot, captions[option - 1])
  })
}

Deno.test('somente Instagram executa um worker e um job', async () => {
  const testContext = context()
  const payload = await (await handleBannerSocialPublish(request(['instagram']), testContext.dependencies)).json()
  assertEquals(testContext.calls.workers, ['instagram'])
  assertEquals(payload.status, 'published')
  assertEquals(payload.smart_tokens, 0)
})

Deno.test('somente Facebook executa um worker e um job', async () => {
  const testContext = context()
  const payload = await (await handleBannerSocialPublish(request(['facebook']), testContext.dependencies)).json()
  assertEquals(testContext.calls.workers, ['facebook'])
  assertEquals(payload.results[0].destination, 'facebook')
})

Deno.test('Instagram e Facebook são independentes e preservam sucesso parcial', async () => {
  const testContext = context({ facebook: 'failed' })
  const payload = await (await handleBannerSocialPublish(request(['instagram', 'facebook']), testContext.dependencies)).json()
  assertEquals(new Set(testContext.calls.workers), new Set(['instagram', 'facebook']))
  assertEquals(payload.status, 'partial_success')
  assertEquals(payload.results.find((item: { destination: string }) => item.destination === 'instagram').status, 'published')
  assertEquals(payload.results.find((item: { destination: string }) => item.destination === 'facebook').status, 'failed')
})

Deno.test('replay idempotente de job published não cria lease nem republica', async () => {
  const testContext = context()
  testContext.jobs.set('instagram', { id: '11111111-1111-4111-8111-111111111111', status: 'published', idempotency: 'instagram-banner-caption-option-1' })
  const payload = await (await handleBannerSocialPublish(request(['instagram']), testContext.dependencies)).json()
  assertEquals(payload.results[0].status, 'published')
  assertEquals(testContext.calls.claimed.length, 0)
  assertEquals(testContext.calls.leased.length, 0)
  assertEquals(testContext.calls.workers.length, 0)
})

Deno.test('recovery é read-only e nunca chama worker', async () => {
  const testContext = context()
  testContext.jobs.set('facebook', { id: '22222222-2222-4222-8222-222222222222', status: 'published', idempotency: 'facebook-banner-caption-option-1' })
  const payload = await (await handleBannerSocialPublish(request(['facebook'], 1, 'recovery'), testContext.dependencies)).json()
  assertEquals(payload.action, 'recovery')
  assertEquals(payload.results[0].external_post_id, 'facebook-post')
  assertEquals(testContext.calls.created.length, 0)
  assertEquals(testContext.calls.workers.length, 0)
  assertEquals(testContext.calls.resolved, 0)
})

Deno.test('resposta pública não contém capability, claim ou segredo', async () => {
  const testContext = context()
  const body = await (await handleBannerSocialPublish(request(['instagram', 'facebook']), testContext.dependencies)).text()
  assert(!/capability|claim_token|access_token|ciphertext|secret/i.test(body))
})

Deno.test('cancelar o modal não chega ao endpoint e requisição sem sessão é bloqueada', async () => {
  const testContext = context()
  const unauthorized = new Request('https://local.invalid/social-publish-banner', { method: 'POST', body: '{}' })
  assertEquals((await handleBannerSocialPublish(unauthorized, testContext.dependencies)).status, 401)
  assertEquals(testContext.calls.created.length, 0)
})

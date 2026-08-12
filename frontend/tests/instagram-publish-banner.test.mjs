import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createInstagramPublishAttempt,
  getInstagramPublishCandidate,
  InstagramPublishClientError,
  INSTAGRAM_PUBLISH_MESSAGES,
  publishInstagramImage,
} from '../src/lib/instagram-publish.js'

const GENERATION_ID = 'a6030fe3-7c8a-48a2-9020-d6f3bc11cb66'
const IDEMPOTENCY_KEY = 'f37cac04-18fd-4f57-89ee-33cc6dcdba39'

const client = (handler) => ({ functions: { invoke: handler } })

test('somente geração concluída com generation_id e imagem disponibiliza candidato', () => {
  const completed = getInstagramPublishCandidate({
    jobs: [{ status: 'completed', generationId: GENERATION_ID, imageUrl: 'https://private.example/banner.jpg', formatLabel: 'Feed Instagram' }],
  })
  assert.equal(completed.generationId, GENERATION_ID)
  assert.equal(completed.formatLabel, 'Feed Instagram')
  assert.equal(getInstagramPublishCandidate({ jobs: [{ status: 'processing', generationId: GENERATION_ID, imageUrl: 'x' }] }), null)
  assert.equal(getInstagramPublishCandidate({ jobs: [{ status: 'completed', generationId: '', imageUrl: 'x' }] }), null)
  assert.equal(getInstagramPublishCandidate({ status: 'processing', generation_id: GENERATION_ID, imageUrl: 'x' }), null)
})

test('cliente usa supabase.functions.invoke com o contrato mínimo do hero_generation', async () => {
  let observed
  const result = await publishInstagramImage(client(async (name, options) => {
    observed = { name, options }
    return { data: { success: true, published: true }, error: null }
  }), {
    generationId: GENERATION_ID,
    caption: '  Texto existente  ',
    idempotencyKey: IDEMPOTENCY_KEY,
  })

  assert.deepEqual(result, { success: true, published: true, replayed: false })
  assert.equal(observed.name, 'instagram-publish')
  assert.deepEqual(observed.options.body, {
    source: { type: 'hero_generation', id: GENERATION_ID },
    caption: 'Texto existente',
    idempotency_key: IDEMPOTENCY_KEY,
  })
  assert.equal('headers' in observed.options, false)
})

test('não lê token de storage nem monta Authorization manualmente', () => {
  const source = readFileSync(new URL('../src/lib/instagram-publish.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /localStorage|sessionStorage|getSession|access_token|page_access_token|Authorization|Bearer/i)
  assert.match(source, /client\.functions\.invoke/)
})

test('duplo clique chama a função uma única vez e mantém a tentativa travada', async () => {
  let calls = 0
  let observedIdempotencyKey = ''
  let release
  const pending = new Promise(resolve => { release = resolve })
  const attempt = createInstagramPublishAttempt({
    client: client(async (_name, options) => {
      calls += 1
      observedIdempotencyKey = options.body.idempotency_key
      await pending
      return { data: { success: true, published: true }, error: null }
    }),
    cryptoApi: { randomUUID: () => IDEMPOTENCY_KEY },
  })

  const first = attempt.publish({ generationId: GENERATION_ID, caption: '' })
  const second = await attempt.publish({ generationId: GENERATION_ID, caption: '' })
  assert.deepEqual(second, { started: false, reason: 'locked' })
  assert.equal(calls, 1)
  assert.equal(observedIdempotencyKey, IDEMPOTENCY_KEY)
  release()
  assert.equal((await first).published, true)
  assert.deepEqual(await attempt.publish({ generationId: GENERATION_ID }), { started: false, reason: 'locked' })
})

test('publish_in_progress é sanitizado e nunca provoca repetição automática', async () => {
  let calls = 0
  const attempt = createInstagramPublishAttempt({
    client: client(async () => {
      calls += 1
      return { data: { success: false, code: 'publish_in_progress' }, error: new Error('raw backend') }
    }),
    cryptoApi: { randomUUID: () => IDEMPOTENCY_KEY },
  })

  await assert.rejects(
    attempt.publish({ generationId: GENERATION_ID }),
    error => error instanceof InstagramPublishClientError
      && error.code === 'publish_in_progress'
      && error.message === INSTAGRAM_PUBLISH_MESSAGES.publish_in_progress,
  )
  assert.deepEqual(await attempt.publish({ generationId: GENERATION_ID }), { started: false, reason: 'locked' })
  assert.equal(calls, 1)
})

test('erros conhecidos usam somente mensagens seguras', async () => {
  for (const code of ['instagram_not_connected', 'instagram_reconnect_required', 'invalid_media_source', 'instagram_publish_failed']) {
    await assert.rejects(
      publishInstagramImage(client(async () => ({ data: { success: false, code }, error: new Error('private raw error') })), {
        generationId: GENERATION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
      error => error instanceof InstagramPublishClientError
        && error.code === code
        && error.message === INSTAGRAM_PUBLISH_MESSAGES[code]
        && !error.message.includes('private raw error'),
    )
  }
})

test('HeroNext integra somente a publicação real do Banner Imobiliário', () => {
  const hero = readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')
  assert.match(hero, /createInstagramPublishAttempt/)
  assert.match(hero, /generationId/)
  assert.match(hero, /Publicar no Instagram/)
  assert.match(hero, /setInstagramPublishStatus\('published'\)/)
  assert.match(hero, /Publicado no Instagram/)
  assert.match(hero, /disabled=\{instagramPublishStatus !== 'idle'\}/)
  assert.match(hero, /\/brand-icons\/instagram\.webp/)
  assert.doesNotMatch(hero, /facebook-publish|tiktok-publish|youtube-publish|whatsapp-publish/)
})

test('outros produtos não recebem instagram-publish', () => {
  for (const relativePath of [
    '../src/pages/NovaCampanha.jsx',
    '../src/pages/SmartCarrossel.jsx',
    '../src/pages/VirtualStaging.jsx',
    '../src/pages/SmartTourAI.jsx',
    '../src/pages/StudioHero.jsx',
  ]) {
    assert.doesNotMatch(readFileSync(new URL(relativePath, import.meta.url), 'utf8'), /instagram-publish|createInstagramPublishAttempt/)
  }
})

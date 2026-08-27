import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createInstagramImageContainer,
  InstagramPublishError,
  publishInstagramContainer,
} from '../publish-client.ts'
import {
  handleInstagramPublish,
  type InstagramPublicationStatus,
  type InstagramPublishRuntimeDependencies,
  type PublicationClaim,
} from '../../../instagram-publish/runtime.ts'

const USER_ID = '7a66d5cb-16de-4d31-a718-c98f4917af72'
const SOURCE_ID = 'c49b225b-afaa-433b-a53f-4c13b8a36a97'
const IDEMPOTENCY_KEY = 'f37cac04-18fd-4f57-89ee-33cc6dcdba39'
const IMAGE_URL = 'https://project.supabase.co/storage/v1/object/sign/private.jpg?token=private-signed-value'

const request = (body: unknown, method = 'POST', token = 'valid-token') => new Request('https://local/instagram-publish', {
  method,
  headers: {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  },
  body: method === 'POST' ? JSON.stringify(body) : undefined,
})

const validBody = (overrides: Record<string, unknown> = {}) => ({
  source: { type: 'hero_generation', id: SOURCE_ID },
  idempotency_key: IDEMPOTENCY_KEY,
  caption: '  Publicação existente #SmartCorretorAI  ',
  ...overrides,
})

type Calls = {
  signed: number
  create: number
  publish: number
  publishing: number
  published: number
  failed: number
  logs: Array<{ stage: string; details?: Record<string, unknown> }>
}

const dependencies = (overrides: Partial<InstagramPublishRuntimeDependencies> = {}) => {
  const calls: Calls = { signed: 0, create: 0, publish: 0, publishing: 0, published: 0, failed: 0, logs: [] }
  const deps: InstagramPublishRuntimeDependencies = {
    authenticate: async token => token === 'valid-token' ? { id: USER_ID } : null,
    getConnection: async () => ({ instagramUserId: '17841400000000000', pageAccessToken: 'private-page-token' }),
    resolveMedia: async () => ({ bucket: 'smartcorretor-assets', path: `${USER_ID}/hero-ia-next/${SOURCE_ID}/hero-principal.jpg`, mimeType: 'image/jpeg' }),
    createSignedUrl: async () => { calls.signed += 1; return IMAGE_URL },
    claimPublication: async () => ({ kind: 'created', publicationId: 'publication-id' }),
    markPublishing: async () => { calls.publishing += 1 },
    markPublished: async () => { calls.published += 1 },
    markFailed: async () => { calls.failed += 1 },
    createContainer: async input => {
      calls.create += 1
      assert.equal(input.caption, 'Publicação existente #SmartCorretorAI')
      assert.equal(input.imageUrl, IMAGE_URL)
      return '18000000000000001'
    },
    publishContainer: async input => {
      calls.publish += 1
      assert.equal(input.creationId, '18000000000000001')
      assert.equal(calls.publishing, 1)
      return '18000000000000002'
    },
    log: (stage, details) => calls.logs.push({ stage, details }),
    ...overrides,
  }
  return { deps, calls }
}

const bodyOf = async (response: Response) => await response.json() as Record<string, unknown>

test('OPTIONS retorna 200 com CORS antes da autenticação', async () => {
  const { deps } = dependencies({ authenticate: async () => { throw new Error('must_not_authenticate') } })
  const response = await handleInstagramPublish(request({}, 'OPTIONS', ''), deps)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
})

test('somente POST é aceito', async () => {
  const { deps } = dependencies()
  const response = await handleInstagramPublish(request({}, 'GET'), deps)
  assert.equal(response.status, 405)
  assert.deepEqual(await bodyOf(response), { success: false, code: 'method_not_allowed' })
})

test('Bearer é obrigatório e auth.getUser conceitual decide ownership', async () => {
  const { deps } = dependencies()
  assert.equal((await handleInstagramPublish(request(validBody(), 'POST', ''), deps)).status, 401)
  assert.equal((await handleInstagramPublish(request(validBody(), 'POST', 'invalid'), deps)).status, 401)
})

test('user_id do body nunca é aceito como autoridade', async () => {
  const { deps, calls } = dependencies()
  const response = await handleInstagramPublish(request(validBody({ user_id: 'another-user' })), deps)
  assert.equal(response.status, 400)
  assert.equal(calls.create, 0)
})

test('image_url arbitrária é rejeitada', async () => {
  const { deps, calls } = dependencies()
  const response = await handleInstagramPublish(request(validBody({ image_url: 'https://attacker.example/image.jpg' })), deps)
  assert.equal(response.status, 400)
  assert.equal(calls.signed, 0)
})

test('somente source hero_generation com UUID é aceito', async () => {
  for (const source of [
    { type: 'video_job', id: SOURCE_ID },
    { type: 'hero_generation', id: 'not-a-uuid' },
    { type: 'hero_generation', id: SOURCE_ID, image_url: 'https://attacker.example/x.jpg' },
  ]) {
    const { deps } = dependencies()
    const response = await handleInstagramPublish(request(validBody({ source })), deps)
    assert.equal(response.status, 400)
  }
})

test('conexão ausente ou incompleta retorna instagram_not_connected', async () => {
  for (const connection of [null, { instagramUserId: '', pageAccessToken: '' }]) {
    const { deps } = dependencies({ getConnection: async () => connection })
    const response = await handleInstagramPublish(request(validBody()), deps)
    assert.equal((await bodyOf(response)).code, 'instagram_not_connected')
  }
})

test('conexão expirada exige reconexão sem chamar Meta', async () => {
  const { deps, calls } = dependencies({ getConnection: async () => ({ instagramUserId: '', pageAccessToken: '', reconnectRequired: true }) })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.equal(response.status, 401)
  assert.equal((await bodyOf(response)).code, 'instagram_reconnect_required')
  assert.equal(calls.create, 0)
})

test('geração inexistente, alheia, incompleta ou path inválido falha fechado', async () => {
  for (const resolveMedia of [
    async () => null,
    async () => ({ bucket: 'smartcorretor-assets', path: 'other/path.jpg', mimeType: 'image/webp' }),
  ]) {
    const { deps, calls } = dependencies({ resolveMedia })
    const response = await handleInstagramPublish(request(validBody()), deps)
    assert.equal((await bodyOf(response)).code, 'invalid_media_source')
    assert.equal(calls.signed, 0)
  }
})

test('somente MIME JPEG ou PNG é publicado', async () => {
  for (const mimeType of ['video/mp4', 'image/webp', 'application/octet-stream']) {
    const { deps, calls } = dependencies({ resolveMedia: async () => ({ bucket: 'smartcorret-assets', path: 'safe', mimeType }) })
    const response = await handleInstagramPublish(request(validBody()), deps)
    assert.equal(response.status, 400)
    assert.equal(calls.create, 0)
  }
})

test('caption é aparada e não recebe hashtags automáticas', async () => {
  const { deps } = dependencies()
  const response = await handleInstagramPublish(request(validBody({ caption: '  Texto sem alteração  ' })), {
    ...deps,
    createContainer: async input => {
      assert.equal(input.caption, 'Texto sem alteração')
      return '18000000000000001'
    },
  })
  assert.equal(response.status, 200)
})

test('caption acima de 2200 caracteres é rejeitada antes da publicação', async () => {
  const { deps, calls } = dependencies()
  const response = await handleInstagramPublish(request(validBody({ caption: 'a'.repeat(2201) })), deps)
  assert.equal(response.status, 400)
  assert.equal(calls.create, 0)
})

test('publicação nova cria container e só então media_publish', async () => {
  const { deps, calls } = dependencies()
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.deepEqual(await bodyOf(response), { success: true, published: true })
  assert.equal(calls.create, 1)
  assert.equal(calls.publish, 1)
  assert.equal(calls.published, 1)
  assert.deepEqual(calls.logs.map(item => item.stage), [
    'instagram_publish_start', 'media_resolved', 'container_created', 'media_published',
  ])
})

test('replay published retorna sucesso sem nova chamada Meta', async () => {
  const { deps, calls } = dependencies({ claimPublication: async () => ({ kind: 'existing', status: 'published', sourceId: SOURCE_ID }) })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.deepEqual(await bodyOf(response), { success: true, published: true, replayed: true })
  assert.equal(calls.create, 0)
  assert.equal(calls.publish, 0)
})

test('processing e publishing retornam publish_in_progress', async () => {
  for (const status of ['processing', 'publishing'] as InstagramPublicationStatus[]) {
    const { deps, calls } = dependencies({ claimPublication: async () => ({ kind: 'existing', status, sourceId: SOURCE_ID }) })
    const response = await handleInstagramPublish(request(validBody()), deps)
    assert.equal((await bodyOf(response)).code, 'publish_in_progress')
    assert.equal(calls.create, 0)
  }
})

test('failed não é repetido automaticamente com a mesma chave', async () => {
  const { deps, calls } = dependencies({ claimPublication: async () => ({ kind: 'existing', status: 'failed', sourceId: SOURCE_ID, errorCode: 'instagram_publish_failed' }) })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.equal((await bodyOf(response)).code, 'instagram_publish_failed')
  assert.equal(calls.create, 0)
})

test('uma chave idempotente não pode ser reutilizada para outra origem', async () => {
  const { deps, calls } = dependencies({
    claimPublication: async () => ({ kind: 'existing', status: 'published', sourceId: 'bbfcd94d-b57b-4e94-86ae-6af1a745bc29' }),
  })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.equal((await bodyOf(response)).code, 'invalid_media_source')
  assert.equal(calls.create, 0)
})

test('concorrência com a mesma chave permite somente um claim novo', async () => {
  let status: InstagramPublicationStatus | null = null
  const claim = async (): Promise<PublicationClaim> => {
    if (status) return { kind: 'existing', status, sourceId: SOURCE_ID }
    status = 'processing'
    return { kind: 'created', publicationId: 'publication-id' }
  }
  const first = dependencies({ claimPublication: claim })
  const second = dependencies({ claimPublication: claim })
  const [a, b] = await Promise.all([
    handleInstagramPublish(request(validBody()), first.deps),
    handleInstagramPublish(request(validBody()), second.deps),
  ])
  assert.deepEqual([a.status, b.status].sort(), [200, 409])
  assert.equal(first.calls.create + second.calls.create, 1)
})

test('timeout ambíguo após container bloqueia repetição de media_publish', async () => {
  let status: InstagramPublicationStatus | null = null
  let publishCalls = 0
  const common = dependencies({
    claimPublication: async () => status ? { kind: 'existing', status, sourceId: SOURCE_ID } : { kind: 'created', publicationId: 'publication-id' },
    markPublishing: async () => { status = 'publishing' },
    publishContainer: async () => { publishCalls += 1; throw new Error('ambiguous_timeout') },
  })
  const first = await handleInstagramPublish(request(validBody()), common.deps)
  const second = await handleInstagramPublish(request(validBody()), common.deps)
  assert.equal(first.status, 502)
  assert.equal((await bodyOf(second)).code, 'publish_in_progress')
  assert.equal(publishCalls, 1)
  assert.equal(common.calls.failed, 0)
})

test('falha antes do container marca failed de forma conservadora', async () => {
  const { deps, calls } = dependencies({ createContainer: async () => { throw new Error('network') } })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.equal(response.status, 502)
  assert.equal(calls.failed, 1)
  assert.equal(calls.publish, 0)
})

test('erro Meta 190 é sanitizado como reconnect required', async () => {
  const { deps, calls } = dependencies({
    createContainer: async () => { throw new InstagramPublishError({ publicCode: 'instagram_reconnect_required', httpStatus: 400, metaCode: 190, metaSubcode: 463 }) },
  })
  const response = await handleInstagramPublish(request(validBody()), deps)
  assert.equal((await bodyOf(response)).code, 'instagram_reconnect_required')
  assert.deepEqual(calls.logs.at(-1), { stage: 'publication_failed', details: { http_status: 400, meta_code: 190, meta_subcode: 463 } })
})

test('cliente Meta cria container com image_url, caption e page token no body', async () => {
  let observedUrl = ''
  let observedBody = ''
  const id = await createInstagramImageContainer({
    graphApiVersion: 'v26.0', instagramUserId: '17841400000000000', pageAccessToken: 'private-page-token',
    imageUrl: IMAGE_URL, caption: 'Legenda existente',
    fetcher: async (input, init) => {
      observedUrl = String(input)
      observedBody = String(init?.body)
      return Response.json({ id: '18000000000000001' })
    },
  })
  assert.equal(id, '18000000000000001')
  assert.match(observedUrl, /\/v26\.0\/17841400000000000\/media$/)
  assert.doesNotMatch(observedUrl, /access_token|private-signed-value/)
  const body = new URLSearchParams(observedBody)
  assert.equal(body.get('image_url'), IMAGE_URL)
  assert.equal(body.get('caption'), 'Legenda existente')
  assert.equal(body.get('access_token'), 'private-page-token')
})

test('cliente Meta só publica depois de receber creation_id', async () => {
  let observedBody = ''
  const id = await publishInstagramContainer({
    graphApiVersion: 'v26.0', instagramUserId: '17841400000000000', pageAccessToken: 'private-page-token', creationId: '18000000000000001',
    fetcher: async (_input, init) => { observedBody = String(init?.body); return Response.json({ id: '18000000000000002' }) },
  })
  assert.equal(id, '18000000000000002')
  assert.equal(new URLSearchParams(observedBody).get('creation_id'), '18000000000000001')
})

test('cliente Meta não devolve corpo bruto em erro', async () => {
  const privateValue = 'private-raw-response-value'
  await assert.rejects(
    createInstagramImageContainer({
      graphApiVersion: 'v26.0', instagramUserId: '17841400000000000', pageAccessToken: 'private-page-token', imageUrl: IMAGE_URL,
      fetcher: async () => Response.json({ error: { message: privateValue, code: 100, error_subcode: 33 } }, { status: 400 }),
    }),
    error => error instanceof InstagramPublishError && !String(error).includes(privateValue) && error.metaCode === 100,
  )
})

test('telemetria e respostas nunca incluem URL assinada, caption, token ou IDs', async () => {
  const { deps, calls } = dependencies()
  const response = await handleInstagramPublish(request(validBody()), deps)
  const serialized = JSON.stringify({ response: await bodyOf(response), logs: calls.logs })
  for (const secret of ['private-signed-value', 'private-page-token', SOURCE_ID, '17841400000000000', 'Publicação existente']) {
    assert.doesNotMatch(serialized, new RegExp(secret))
  }
  assert.equal(calls.logs[0].details?.caption_present, true)
})

test('index restringe bucket/path final e usa auth.getUser/service role', () => {
  const source = readFileSync(new URL('../../../instagram-publish/index.ts', import.meta.url), 'utf8')
  assert.match(source, /auth\.getUser\(token\)/)
  assert.match(source, /resolveSupabaseAdminCredential\(\)\.key/)
  assert.match(source, /smartcorretor-assets/)
  assert.match(source, /hero-ia-next/)
  assert.match(source, /hero-principal/)
  assert.match(source, /status !== 'completed'/)
  const runtime = readFileSync(new URL('../../../instagram-publish/runtime.ts', import.meta.url), 'utf8')
  assert.match(runtime, /15 \* 60/)
  assert.doesNotMatch(source, /console\.(?:info|log|error)\([^\n]*(?:page_access_token|signedUrl|image_storage_path)/)
})

test('migration aplica idempotência e bloqueia acesso direto anon/authenticated', () => {
  const sql = readFileSync(new URL('../../../../migrations/20260811010000_create_instagram_publications.sql', import.meta.url), 'utf8')
  assert.match(sql, /UNIQUE \(user_id, idempotency_key\)/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /REVOKE ALL ON public\.instagram_publications FROM anon/)
  assert.match(sql, /REVOKE ALL ON public\.instagram_publications FROM authenticated/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.instagram_publications TO service_role/)
  assert.match(sql, /processing.*publishing.*published.*failed/s)
})

test('config registra somente o contrato de autenticação interna da nova função', () => {
  const config = readFileSync(new URL('../../../../config.toml', import.meta.url), 'utf8')
  assert.match(config, /\[functions\.instagram-publish\]\s+verify_jwt = false/)
})

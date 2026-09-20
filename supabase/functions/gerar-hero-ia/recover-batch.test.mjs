import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const handlerSource = source.slice(
  source.indexOf('async function handleRealEstateBannerRecovery'),
  source.indexOf('\nasync function handleHeroNextStatus'),
)
const executableHandlerSource = handlerSource.replace(
  /async function handleRealEstateBannerRecovery\([\s\S]*?\n\) \{/,
  'async function handleRealEstateBannerRecovery(supabase, userId, payload) {',
).replace(/ as JsonRecord\[\]/g, '').replace(/: JsonRecord\[\]/g, '')

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const normalizeText = (value, maximum = 180) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maximum)
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})
const HERO_IMAGE_BUCKET = 'smartcorretor-assets'

const handleRecovery = new Function(
  'isUuid',
  'normalizeText',
  'jsonResponse',
  'HERO_IMAGE_BUCKET',
  `return (${executableHandlerSource})`,
)(isUuid, normalizeText, jsonResponse, HERO_IMAGE_BUCKET)

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CLIENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const REQUEST_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const GENERATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const STORAGE_PATH = `${USER_A}/hero-ia-next/${GENERATION_ID}/hero-principal.jpg`

class Query {
  constructor(table, result, calls) {
    this.table = table
    this.result = result
    this.calls = calls
  }
  select(columns) { this.calls.push(['select', this.table, columns]); return this }
  eq(column, value) { this.calls.push(['eq', this.table, column, value]); return this }
  in(column, values) { this.calls.push(['in', this.table, column, values]); return this }
  order(column, options) { this.calls.push(['order', this.table, column, options]); return Promise.resolve(this.result) }
  maybeSingle() { this.calls.push(['maybeSingle', this.table]); return Promise.resolve(this.result) }
  then(resolve, reject) { return Promise.resolve(this.result).then(resolve, reject) }
}

function database({ request = null, items = [], generations = [], signedUrl = 'https://signed.example/banner.jpg', signedError = null, errors = {} } = {}) {
  const calls = []
  const signed = []
  const results = {
    real_estate_banner_requests: errors.request ? { data: null, error: errors.request } : { data: request, error: null },
    real_estate_banner_items: errors.items ? { data: null, error: errors.items } : { data: items, error: null },
    hero_generations: errors.generations ? { data: null, error: errors.generations } : { data: generations, error: null },
  }
  return {
    calls,
    signed,
    client: {
      from(table) {
        calls.push(['from', table])
        assert.ok(Object.hasOwn(results, table), `unexpected table ${table}`)
        return new Query(table, results[table], calls)
      },
      storage: {
        from(bucket) {
          calls.push(['storage.from', bucket])
          return {
            async createSignedUrl(path, seconds) {
              signed.push({ bucket, path, seconds })
              return { data: signedError ? null : { signedUrl }, error: signedError }
            },
          }
        },
      },
    },
  }
}

async function body(response) {
  return await response.json()
}

function fixture(status = 'completed') {
  return {
    request: { id: REQUEST_ID, client_request_id: CLIENT_ID, status },
    items: [{
      piece_id: 'idea-1-instagram_feed',
      format_id: 'instagram_feed',
      creation_option: 1,
      generation_id: GENERATION_ID,
      status,
      unit_cost: 75,
      provider_response_id: 'must-not-leak',
    }],
    generations: [{
      id: GENERATION_ID,
      user_id: USER_A,
      status,
      texts: { instagram: 'Texto seguro' },
      image_storage_path: STORAGE_PATH,
      openai_response_id: 'must-not-leak',
    }],
  }
}

test('routing requires Bearer auth and auth.getUser before recover_batch', () => {
  const authGuard = source.indexOf("if (!/^Bearer\\s+/i.test(authHeader))")
  const getUser = source.indexOf('supabase.auth.getUser(token)')
  const route = source.indexOf("normalizeId(payload.action) === 'recover_batch'")
  assert.ok(authGuard > -1 && getUser > authGuard && route > getUser)
  assert.match(source.slice(getUser, route + 300), /handleRealEstateBannerRecovery\(supabase, user\.id, payload\)/)
  assert.doesNotMatch(handlerSource, /payload\.user_id|payload\[['"]user_id['"]\]/)
})

test('invalid client_request_id is rejected before any database access', async () => {
  const db = database()
  const response = await handleRecovery(db.client, USER_A, { client_request_id: 'invalid' })
  assert.equal(response.status, 400)
  assert.deepEqual(await body(response), { success: false, error: 'client_request_id invalido.' })
  assert.deepEqual(db.calls, [])
})

test('request lookup is scoped to authenticated user, product and client request', async () => {
  const db = database({ request: null })
  const response = await handleRecovery(db.client, USER_A, {
    client_request_id: CLIENT_ID,
    user_id: USER_B,
  })
  assert.deepEqual(await body(response), { success: true, recovery_only: true, found: false })
  assert.ok(db.calls.some((call) => call[0] === 'eq' && call[2] === 'user_id' && call[3] === USER_A))
  assert.ok(db.calls.some((call) => call[0] === 'eq' && call[2] === 'product_code' && call[3] === 'real_estate_banner'))
  assert.ok(db.calls.some((call) => call[0] === 'eq' && call[2] === 'client_request_id' && call[3] === CLIENT_ID))
  assert.ok(!db.calls.some((call) => call.includes(USER_B)))
})

test('completed incident is recovered with the same generation and a short signed URL', async () => {
  const db = database(fixture())
  const response = await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID })
  const result = await body(response)
  assert.equal(response.status, 200)
  assert.equal(result.success, true)
  assert.equal(result.recovery_only, true)
  assert.equal(result.found, true)
  assert.equal(result.status, 'completed')
  assert.equal(result.request_id, REQUEST_ID)
  assert.equal(result.client_request_id, CLIENT_ID)
  assert.equal(result.items[0].generation_id, GENERATION_ID)
  assert.equal(result.items[0].status, 'completed')
  assert.equal(result.items[0].image_url, 'https://signed.example/banner.jpg')
  assert.equal(typeof result.items[0].expires_at, 'string')
  assert.deepEqual(db.signed, [{ bucket: HERO_IMAGE_BUCKET, path: STORAGE_PATH, seconds: 3600 }])
  const serialized = JSON.stringify(result)
  for (const forbidden of ['image_storage_path', 'provider_response_id', 'openai_response_id', 'unit_cost', 'reservation_id', 'claim_token']) {
    assert.ok(!serialized.includes(forbidden))
  }
})

test('unexpected or foreign storage paths are never signed or exposed', async () => {
  const data = fixture()
  data.generations[0].image_storage_path = `${USER_B}/hero-ia-next/${GENERATION_ID}/hero-principal.jpg`
  const db = database(data)
  const result = await body(await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID }))
  assert.equal(result.items[0].status, 'completed')
  assert.equal(result.items[0].image_url, null)
  assert.equal(result.items[0].expires_at, null)
  assert.deepEqual(db.signed, [])
  assert.ok(!JSON.stringify(result).includes(USER_B))
})

test('signed URL errors are sanitized and never expose storage details', async () => {
  const db = database({ ...fixture(), signedError: { message: `private path ${STORAGE_PATH}` } })
  const response = await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID })
  const result = await body(response)
  assert.equal(response.status, 500)
  assert.deepEqual(result, { success: false, error: 'Falha ao recuperar campanha.' })
  assert.ok(!JSON.stringify(result).includes(STORAGE_PATH))
})

test('processing returns the existing owned generation without signing or dispatching', async () => {
  const db = database(fixture('processing'))
  const result = await body(await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID }))
  assert.equal(result.status, 'processing')
  assert.equal(result.items[0].status, 'processing')
  assert.equal(result.items[0].generation_id, GENERATION_ID)
  assert.equal(result.items[0].image_url, null)
  assert.deepEqual(db.signed, [])
})

test('failed state is sanitized and does not mutate request or item', async () => {
  const db = database(fixture('failed'))
  const result = await body(await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID }))
  assert.equal(result.status, 'failed')
  assert.equal(result.items[0].status, 'failed')
  assert.equal(result.items[0].image_url, null)
  assert.deepEqual(db.signed, [])
})

test('database errors return a generic message without raw SQL details', async () => {
  const db = database({ errors: { request: { message: 'relation secret_table does not exist' } } })
  const result = await body(await handleRecovery(db.client, USER_A, { client_request_id: CLIENT_ID }))
  assert.deepEqual(result, { success: false, error: 'Falha ao recuperar campanha.' })
  assert.ok(!JSON.stringify(result).includes('secret_table'))
})

test('recover_batch handler is structurally read-only, provider-free and economy-free', () => {
  assert.match(handlerSource, /from\('real_estate_banner_requests'\)/)
  assert.match(handlerSource, /from\('real_estate_banner_items'\)/)
  assert.match(handlerSource, /from\('hero_generations'\)/)
  assert.match(handlerSource, /createSignedUrl/)
  assert.doesNotMatch(handlerSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/)
  assert.doesNotMatch(handlerSource, /createRealEstateBannerEconomy|reserve|consume|refund|settle|finalize|prepare|claim|allocation|transaction|economic_generation_events/i)
  assert.doesNotMatch(handlerSource, /OpenAI|getOpenAIResponseStatus|generateHero|fetch\(|dispatch|retry/i)
  assert.doesNotMatch(source, /discover_recoverable_batch/)
})

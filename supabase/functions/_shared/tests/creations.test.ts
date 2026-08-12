import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CreationValidationError,
  registerCompletedCreation,
  type CreationInsert,
  type CreationRecord,
  type CreationStore,
  type RegisterCompletedCreationInput,
} from '../creations.ts'

const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const COMPLETED_AT = '2026-08-12T18:00:00.000Z'

const file = (path = `${USER_ID}/jobs/job-1/video.mp4`) => ({
  bucket: 'studio-videos' as const,
  path,
  name: 'video.mp4',
  mime_type: 'video/mp4',
  size_bytes: 1024,
})

const validInput = (overrides: Partial<RegisterCompletedCreationInput> = {}): RegisterCompletedCreationInput => ({
  user_id: USER_ID,
  product_key: 'video_imobiliario',
  source_ref: 'job-1',
  title: 'Apartamento na Vila Mariana',
  delivery_kind: 'file',
  result_manifest: { version: 1, files: [file()] },
  completed_at: COMPLETED_AT,
  ...overrides,
})

const key = (value: Pick<CreationInsert, 'user_id' | 'product_key' | 'source_ref'>) =>
  `${value.user_id}:${value.product_key}:${value.source_ref}`

class FakeCreationStore implements CreationStore {
  records = new Map<string, CreationRecord>()
  insertions: CreationInsert[] = []

  async findByIdentity(identity: Pick<CreationInsert, 'user_id' | 'product_key' | 'source_ref'>) {
    return this.records.get(key(identity)) || null
  }

  async insertIfAbsent(input: CreationInsert) {
    this.insertions.push(input)
    if (this.records.has(key(input))) return { record: null, conflict: true }
    const completed = Date.parse(input.completed_at)
    const record: CreationRecord = {
      ...input,
      id: `creation-${this.records.size + 1}`,
      expires_at: new Date(completed + 24 * 60 * 60 * 1000).toISOString(),
      downloaded_at: null,
      deleted_at: null,
    }
    this.records.set(key(input), record)
    return { record, conflict: false }
  }
}

test('registers one valid controlled file without returning its manifest or a URL', async () => {
  const store = new FakeCreationStore()
  const result = await registerCompletedCreation(store, validInput())
  assert.equal(result.created, true)
  assert.equal(result.creation.delivery_kind, 'file')
  assert.equal(result.creation.expires_at, '2026-08-13T18:00:00.000Z')
  assert.equal('result_manifest' in result.creation, false)
  assert.doesNotMatch(JSON.stringify(result), /https?:|signed.?url|token/i)
})

test('registers a valid bundle of controlled files', async () => {
  const store = new FakeCreationStore()
  const result = await registerCompletedCreation(store, validInput({
    product_key: 'banners_rapidos',
    source_ref: 'bundle-1',
    delivery_kind: 'bundle',
    result_manifest: {
      version: 1,
      files: [
        { ...file(`${USER_ID}/creations/bundle-1/banner-01.jpg`), name: 'banner-01.jpg', mime_type: 'image/jpeg' },
        { ...file(`${USER_ID}/creations/bundle-1/banner-02.jpg`), name: 'banner-02.jpg', mime_type: 'image/jpeg' },
      ],
    },
  }))
  assert.equal(result.created, true)
  assert.equal(store.insertions[0].result_manifest.files?.length, 2)
})

test('registers structured temporary text without Storage', async () => {
  const store = new FakeCreationStore()
  const result = await registerCompletedCreation(store, validInput({
    product_key: 'campanha_textos',
    source_ref: 'text-1',
    delivery_kind: 'text',
    result_manifest: {
      version: 1,
      content: { titulo: 'Apartamento à venda', instagram: 'Conheça este imóvel.' },
      download_name: 'campanha-de-textos.txt',
    },
  }))
  assert.equal(result.created, true)
  assert.deepEqual(store.insertions[0].result_manifest.content, {
    titulo: 'Apartamento à venda', instagram: 'Conheça este imóvel.',
  })
})

test('rejects an unknown product key', async () => {
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({ product_key: 'produto_inventado' as never })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_product_key',
  )
})

test('rejects an empty source reference', async () => {
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({ source_ref: '   ' })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_source_ref',
  )
})

test('rejects manifests that do not match their delivery kind', async () => {
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({ result_manifest: { version: 1, files: [] } })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_result_manifest',
  )
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({
      delivery_kind: 'text', result_manifest: { version: 1, content: {}, download_name: 'vazio.txt' },
    })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_result_manifest',
  )
})

test('rejects buckets outside the backend allowlist', async () => {
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({
      result_manifest: { version: 1, files: [{ ...file(), bucket: 'public-assets' as never }] },
    })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_storage_bucket',
  )
})

test('rejects paths outside the authenticated owner namespace or external URLs', async () => {
  for (const path of [
    '323e4567-e89b-42d3-a456-426614174000/jobs/job-1/video.mp4',
    `${USER_ID}/jobs/../other/video.mp4`,
    'https://provider.example/video.mp4',
  ]) {
    await assert.rejects(
      () => registerCompletedCreation(new FakeCreationStore(), validInput({
        result_manifest: { version: 1, files: [file(path)] },
      })),
      (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_storage_path',
    )
  }
})

test('repeated completion returns the existing creation without duplicating it', async () => {
  const store = new FakeCreationStore()
  const first = await registerCompletedCreation(store, validInput())
  const repeated = await registerCompletedCreation(store, validInput({ title: 'Título vindo de poll antigo' }))
  assert.equal(first.created, true)
  assert.equal(repeated.created, false)
  assert.equal(repeated.creation.id, first.creation.id)
  assert.equal(repeated.creation.title, 'Apartamento na Vila Mariana')
  assert.equal(store.insertions.length, 1)
})

test('a repeated completion never reactivates a downloaded creation', async () => {
  const store = new FakeCreationStore()
  await registerCompletedCreation(store, validInput())
  const existing = store.records.get(key(store.insertions[0]))!
  existing.downloaded_at = '2026-08-12T18:30:00.000Z'
  const repeated = await registerCompletedCreation(store, validInput())
  assert.equal(repeated.created, false)
  assert.equal(repeated.creation.downloaded_at, '2026-08-12T18:30:00.000Z')
  assert.equal(store.insertions.length, 1)
})

test('a repeated completion never reactivates a deleted creation', async () => {
  const store = new FakeCreationStore()
  await registerCompletedCreation(store, validInput())
  const existing = store.records.get(key(store.insertions[0]))!
  existing.deleted_at = '2026-08-12T18:40:00.000Z'
  const repeated = await registerCompletedCreation(store, validInput())
  assert.equal(repeated.created, false)
  assert.equal(repeated.creation.deleted_at, '2026-08-12T18:40:00.000Z')
  assert.equal(store.insertions.length, 1)
})

test('expires_at is never accepted or sent by the helper', async () => {
  const store = new FakeCreationStore()
  const input = { ...validInput(), expires_at: '2099-01-01T00:00:00.000Z' } as RegisterCompletedCreationInput
  await registerCompletedCreation(store, input)
  assert.equal('expires_at' in store.insertions[0], false)
  assert.equal(store.records.values().next().value?.expires_at, '2026-08-13T18:00:00.000Z')
})

test('normalizes Date completion values and rejects timestamps without a timezone', async () => {
  const store = new FakeCreationStore()
  await registerCompletedCreation(store, validInput({ completed_at: new Date(COMPLETED_AT) }))
  assert.equal(store.insertions[0].completed_at, COMPLETED_AT)
  await assert.rejects(
    () => registerCompletedCreation(new FakeCreationStore(), validInput({ completed_at: '2026-08-12T18:00:00' })),
    (error: unknown) => error instanceof CreationValidationError && error.code === 'invalid_completed_at',
  )
})

test('handles a concurrent unique conflict by re-reading the single existing row', async () => {
  const base = new FakeCreationStore()
  let firstLookup = true
  const store: CreationStore = {
    findByIdentity: async identity => {
      if (firstLookup) { firstLookup = false; return null }
      return base.findByIdentity(identity)
    },
    insertIfAbsent: async input => {
      await base.insertIfAbsent(input)
      return { record: null, conflict: true }
    },
  }
  const result = await registerCompletedCreation(store, validInput())
  assert.equal(result.created, false)
  assert.equal(result.creation.id, 'creation-1')
})

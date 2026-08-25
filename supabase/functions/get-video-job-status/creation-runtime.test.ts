import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  type CreationInsert,
  type CreationRecord,
  type CreationStore,
} from '../_shared/creations.ts'
import {
  buildStudioCreationInput,
  registerStudioCreation,
  type StudioCreationJob,
} from './creation-runtime.ts'

const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

const userId = '11111111-1111-4111-8111-111111111111'
const jobId = '22222222-2222-4222-8222-222222222222'
const completedAt = '2026-08-13T20:00:00.000Z'

function job(overrides: Partial<StudioCreationJob> = {}): StudioCreationJob {
  return {
    id: jobId,
    user_id: userId,
    status: 'completed',
    mode: 'dynamic_reel',
    output_video_path: `${userId}/${jobId}/video.mp4`,
    completed_at: completedAt,
    ...overrides,
  }
}

function creationRecord(input: CreationInsert, lifecycle: Partial<CreationRecord> = {}): CreationRecord {
  return {
    ...input,
    id: '33333333-3333-4333-8333-333333333333',
    expires_at: '2026-08-14T20:00:00.000Z',
    downloaded_at: null,
    deleted_at: null,
    ...lifecycle,
  }
}

function memoryStore(existing: CreationRecord | null = null) {
  const state = { current: existing, inserts: 0, inserted: null as CreationInsert | null }
  const store: CreationStore = {
    async findByIdentity() { return state.current },
    async insertIfAbsent(input) {
      state.inserts += 1
      state.inserted = input
      state.current = creationRecord(input)
      return { record: state.current, conflict: false }
    },
  }
  return { store, state }
}

test('completed dynamic_reel registers one Comercial Imobiliário file', async () => {
  const current = memoryStore()
  const result = await registerStudioCreation(current.store, job())
  assert.equal(result?.created, true)
  assert.equal(current.state.inserted?.product_key, 'studio_comercial')
  assert.equal(current.state.inserted?.source_ref, jobId)
  assert.equal(current.state.inserted?.delivery_kind, 'file')
  assert.equal(current.state.inserted?.title, null)
  assert.deepEqual(current.state.inserted?.result_manifest.files, [{
    bucket: 'studio-videos',
    path: `${userId}/${jobId}/video.mp4`,
    name: 'comercial-imobiliario.mp4',
    mime_type: 'video/mp4',
  }])
})

test('completed free_ai registers one Vídeo Criativo file', async () => {
  const current = memoryStore()
  const result = await registerStudioCreation(current.store, job({ mode: 'free_ai' }))
  assert.equal(result?.created, true)
  assert.equal(current.state.inserted?.product_key, 'studio_video_criativo')
  assert.equal(current.state.inserted?.source_ref, jobId)
  assert.equal(current.state.inserted?.result_manifest.files?.[0]?.name, 'video-criativo.mp4')
})

test('pending and failed jobs never register', async () => {
  for (const status of ['pending', 'failed']) {
    const current = memoryStore()
    assert.equal(await registerStudioCreation(current.store, job({ status })), null)
    assert.equal(current.state.inserts, 0)
  }
})

test('Smart Carrossel, Short Videos and unknown modes never register', async () => {
  for (const mode of ['smart_carousel', 'smart_tour_gemini_omni_short_video', 'smart_tour_gemini_omni', 'unknown']) {
    const current = memoryStore()
    assert.equal(await registerStudioCreation(current.store, job({ mode })), null)
    assert.equal(current.state.inserts, 0)
  }
})

test('foreign paths and invalid user ownership are rejected', () => {
  assert.throws(() => buildStudioCreationInput(job({
    output_video_path: `99999999-9999-4999-8999-999999999999/${jobId}/video.mp4`,
  })), /invalid_studio_output_path/)
  assert.throws(() => buildStudioCreationInput(job({
    user_id: 'not-a-user',
    output_video_path: `not-a-user/${jobId}/video.mp4`,
  })), /invalid_studio_user_id/)
})

test('polling is idempotent and never reactivates downloaded or deleted creations', async () => {
  const first = memoryStore()
  await registerStudioCreation(first.store, job())
  const repeated = await registerStudioCreation(first.store, job())
  assert.equal(repeated?.created, false)
  assert.equal(first.state.inserts, 1)

  const base = creationRecord(first.state.inserted as CreationInsert)
  for (const lifecycle of [
    { downloaded_at: '2026-08-13T20:10:00.000Z' },
    { deleted_at: '2026-08-13T20:10:00.000Z' },
  ]) {
    const existing = { ...base, ...lifecycle }
    const current = memoryStore(existing)
    const result = await registerStudioCreation(current.store, job())
    assert.equal(result?.created, false)
    assert.equal(current.state.inserts, 0)
    assert.equal(result?.creation.downloaded_at, existing.downloaded_at)
    assert.equal(result?.creation.deleted_at, existing.deleted_at)
  }
})

test('frontend-controlled product or manifest fields are absent from the Studio request contract', () => {
  const input = buildStudioCreationInput(job({ mode: 'free_ai' }))
  assert.equal(input?.product_key, 'studio_video_criativo')
  assert.equal(input?.result_manifest.files?.[0]?.path, `${userId}/${jobId}/video.mp4`)
})

test('get-video-job-status registers completed paths through the idempotent Creations hook', () => {
  assert.match(indexSource, /status: 'completed'[\s\S]*signedVideoUrl/)
  assert.match(indexSource, /createSignedVideoUrl\(supabase, outputPath\)/)
  assert.match(indexSource, /createSupabaseCreationStore/)
  assert.match(indexSource, /registerStudioCreation/)
  assert.equal((indexSource.match(/await ensureStudioCreation\(supabase,/g) || []).length, 3)
  const failedBranch = indexSource.slice(indexSource.indexOf("if (job.status === 'failed')"), indexSource.indexOf('const existingOutputPath'))
  assert.doesNotMatch(failedBranch, /ensureStudioCreation/)
})

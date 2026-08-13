import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  type CreationInsert,
  type CreationRecord,
  type CreationStore,
} from '../_shared/creations.ts'
import {
  finalizeVirtualStagingSession,
  recordVirtualStagingSessionOutput,
  type VirtualStagingSessionOutput,
  type VirtualStagingSessionOutputInsert,
  type VirtualStagingSessionOutputStore,
} from './creation-runtime.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const sessionId = '22222222-2222-4222-8222-222222222222'
const completedAt = '2026-08-13T22:00:00.000Z'

function creationRecord(input: CreationInsert, lifecycle: Partial<CreationRecord> = {}): CreationRecord {
  return {
    ...input,
    id: '44444444-4444-4444-8444-444444444444',
    expires_at: '2026-08-14T22:00:00.000Z',
    downloaded_at: null,
    deleted_at: null,
    ...lifecycle,
  }
}

function memoryCreationStore(existing: CreationRecord | null = null) {
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

function memoryOutputStore(initial: VirtualStagingSessionOutput[] = []) {
  const rows = [...initial]
  const store: VirtualStagingSessionOutputStore = {
    async findByJob(ownerId, jobId) {
      return rows.find(row => row.user_id === ownerId && row.job_id === jobId) || null
    },
    async findByPosition(ownerId, currentSessionId, position) {
      return rows.find(row => row.user_id === ownerId && row.session_id === currentSessionId && row.position === position) || null
    },
    async insert(input) {
      const conflict = rows.some(row =>
        (row.user_id === input.user_id && row.job_id === input.job_id)
        || (row.user_id === input.user_id && row.output_path === input.output_path)
        || (row.user_id === input.user_id && row.session_id === input.session_id && row.position === input.position))
      if (conflict) return { record: null, conflict: true }
      const record = { ...input, id: `55555555-5555-4555-8555-${String(rows.length + 1).padStart(12, '0')}` }
      rows.push(record)
      return { record, conflict: false }
    },
    async listSession(ownerId, currentSessionId) {
      return rows.filter(row => row.user_id === ownerId && row.session_id === currentSessionId)
    },
  }
  return { store, rows }
}

function outputInput(position: number, overrides = {}) {
  const jobId = `33333333-3333-4333-8333-${String(position).padStart(12, '0')}`
  return {
    userId,
    jobId,
    inputPath: `${userId}/virtual-staging-images/inputs/${sessionId}/${String(position).padStart(2, '0')}.png`,
    outputPath: `${userId}/virtual-staging-images/results/${jobId}/generated-01.jpg`,
    sizeBytes: 170000 + position,
    completedAt,
    ...overrides,
  }
}

async function completedOutputStore(count: number) {
  const current = memoryOutputStore()
  for (let position = 1; position <= count; position += 1) {
    await recordVirtualStagingSessionOutput(current.store, outputInput(position))
  }
  return current
}

for (const count of [1, 2, 5]) {
  test(`finaliza uma sessão com ${count} arquivo(s) como uma única creation`, async () => {
    const outputs = await completedOutputStore(count)
    const creations = memoryCreationStore()
    const result = await finalizeVirtualStagingSession(creations.store, outputs.store, {
      userId, sessionId, expectedCount: count, completedAt,
    })

    assert.equal(result.created, true)
    assert.equal(creations.state.inserts, 1)
    assert.equal(creations.state.inserted?.source_ref, sessionId)
    assert.equal(creations.state.inserted?.delivery_kind, count === 1 ? 'file' : 'bundle')
    assert.equal(creations.state.inserted?.title, null)
    assert.equal(creations.state.inserted?.result_manifest.files.length, count)
    assert.deepEqual(creations.state.inserted?.result_manifest.files.map(file => file.name),
      Array.from({ length: count }, (_, index) => `virtual-staging-${String(index + 1).padStart(2, '0')}.jpg`))
  })
}

test('registra outputs backend-only e torna repetição idêntica do job idempotente', async () => {
  const current = memoryOutputStore()
  const first = await recordVirtualStagingSessionOutput(current.store, outputInput(1))
  const repeated = await recordVirtualStagingSessionOutput(current.store, outputInput(1))
  assert.equal(first.created, true)
  assert.equal(repeated.created, false)
  assert.equal(current.rows.length, 1)
})

test('rejeita job duplicado divergente, posição duplicada e ownership inválido', async () => {
  const current = memoryOutputStore()
  await recordVirtualStagingSessionOutput(current.store, outputInput(1))
  await assert.rejects(() => recordVirtualStagingSessionOutput(current.store, outputInput(2, {
    jobId: outputInput(1).jobId,
    outputPath: outputInput(1).outputPath,
  })), /duplicate_session_job/)
  await assert.rejects(() => recordVirtualStagingSessionOutput(current.store, outputInput(1, {
    jobId: '66666666-6666-4666-8666-666666666666',
    outputPath: `${userId}/virtual-staging-images/results/66666666-6666-4666-8666-666666666666/generated-01.jpg`,
  })), /duplicate_session_position/)
  await assert.rejects(() => recordVirtualStagingSessionOutput(current.store, outputInput(2, {
    inputPath: `99999999-9999-4999-8999-999999999999/virtual-staging-images/inputs/${sessionId}/02.png`,
  })), /invalid_virtual_staging_input_path/)
})

test('sessão incompleta ou com posições descontínuas não cria creation', async () => {
  const outputs = await completedOutputStore(2)
  const creations = memoryCreationStore()
  await assert.rejects(() => finalizeVirtualStagingSession(creations.store, outputs.store, {
    userId, sessionId, expectedCount: 3, completedAt,
  }), /session_incomplete/)
  assert.equal(creations.state.inserts, 0)

  const discontinuous = memoryOutputStore([{
    ...outputs.rows[1],
    id: '77777777-7777-4777-8777-777777777777',
    position: 3,
  }])
  await assert.rejects(() => finalizeVirtualStagingSession(creations.store, discontinuous.store, {
    userId, sessionId, expectedCount: 1, completedAt,
  }), /session_incomplete/)
})

test('finalização repetida não duplica nem reativa creation baixada ou deletada', async () => {
  const outputs = await completedOutputStore(2)
  const firstStore = memoryCreationStore()
  await finalizeVirtualStagingSession(firstStore.store, outputs.store, { userId, sessionId, expectedCount: 2, completedAt })
  const repeated = await finalizeVirtualStagingSession(firstStore.store, outputs.store, { userId, sessionId, expectedCount: 2, completedAt })
  assert.equal(repeated.created, false)
  assert.equal(firstStore.state.inserts, 1)

  const base = creationRecord(firstStore.state.inserted as CreationInsert)
  for (const lifecycle of [
    { downloaded_at: '2026-08-13T22:10:00.000Z' },
    { deleted_at: '2026-08-13T22:10:00.000Z' },
  ]) {
    const existing = { ...base, ...lifecycle }
    const current = memoryCreationStore(existing)
    const result = await finalizeVirtualStagingSession(current.store, outputs.store, { userId, sessionId, expectedCount: 2, completedAt })
    assert.equal(result.created, false)
    assert.equal(current.state.inserts, 0)
    assert.equal(result.creation.downloaded_at, existing.downloaded_at)
    assert.equal(result.creation.deleted_at, existing.deleted_at)
  }
})

test('manifesto final contém somente outputs JPEG confiáveis do backend', async () => {
  const valid = (await completedOutputStore(1)).rows[0]
  const invalid = memoryOutputStore([{ ...valid, output_path: `${userId}/outro/local.jpg` } as VirtualStagingSessionOutput])
  await assert.rejects(() => finalizeVirtualStagingSession(memoryCreationStore().store, invalid.store, {
    userId, sessionId, expectedCount: 1, completedAt,
  }), /invalid_session_output/)
})

test('migration mantém o staging técnico privado, mínimo e owner-consistent', () => {
  const migration = readFileSync(new URL('../../migrations/20260813010000_create_virtual_staging_session_outputs.sql', import.meta.url), 'utf8')
  for (const column of ['id UUID', 'user_id UUID', 'session_id UUID', 'job_id UUID', 'position INTEGER', 'output_path TEXT', 'mime_type TEXT', 'size_bytes BIGINT', 'completed_at TIMESTAMPTZ']) {
    assert.match(migration, new RegExp(column.replace(' ', '\\s+'), 'i'))
  }
  assert.match(migration, /REFERENCES auth\.users\(id\) ON DELETE CASCADE/i)
  assert.match(migration, /CHECK \(position BETWEEN 1 AND 5\)/i)
  assert.match(migration, /UNIQUE \(user_id, job_id\)/i)
  assert.match(migration, /UNIQUE \(user_id, output_path\)/i)
  assert.match(migration, /UNIQUE \(user_id, session_id, position\)/i)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/i)
  assert.match(migration, /REVOKE ALL ON public\.virtual_staging_session_outputs FROM authenticated/i)
  assert.match(migration, /GRANT SELECT, INSERT, DELETE ON public\.virtual_staging_session_outputs TO service_role/i)
  assert.doesNotMatch(migration, /CREATE POLICY|signed_url|prompt|provider_response/i)
})

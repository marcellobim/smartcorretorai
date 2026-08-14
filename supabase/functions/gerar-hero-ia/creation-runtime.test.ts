import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { registerCompletedCreation, type CreationRecord, type CreationStore } from '../_shared/creations.ts'
import {
  buildBannerImobiliarioCreationInput,
  buildBannerImobiliarioTitle,
} from './creation-runtime.ts'

const functionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const indexSource = readFileSync(path.join(functionRoot, 'index.ts'), 'utf8')
const completedAt = '2026-08-12T20:00:00.000Z'
const generation = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  status: 'completed',
  prompt_briefing: {
    schema_version: 'hero_prompt_briefing_v1',
    property: {
      id: null,
      title: 'Campanha de venda',
      type: 'Apartamento',
      neighborhood: 'Vila Mariana',
      city: 'São Paulo',
    },
  },
  image_storage_path: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/hero-ia-next/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hero-principal.jpg',
  completed_at: completedAt,
}

class FakeCreationStore implements CreationStore {
  record: CreationRecord | null = null
  insertions = 0

  async findByIdentity() {
    return this.record
  }

  async insertIfAbsent(input: Omit<CreationRecord, 'id' | 'expires_at' | 'downloaded_at' | 'deleted_at'>) {
    this.insertions += 1
    this.record = {
      ...input,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expires_at: '2026-08-13T20:00:00.000Z',
      downloaded_at: null,
      deleted_at: null,
    }
    return { record: this.record, conflict: false }
  }
}

test('builds one controlled Banner Imobiliário creation from the final persisted JPEG', () => {
  assert.deepEqual(buildBannerImobiliarioCreationInput(generation), {
    user_id: generation.user_id,
    product_key: 'banner_imobiliario',
    source_ref: generation.id,
    title: 'Apartamento em Vila Mariana',
    delivery_kind: 'file',
    result_manifest: {
      version: 1,
      files: [{
        bucket: 'smartcorretor-assets',
        path: generation.image_storage_path,
        name: 'smartcorretorai-banner-imobiliario.jpg',
        mime_type: 'image/jpeg',
      }],
    },
    completed_at: completedAt,
  })
})

test('pending, failed and incomplete generations never produce a creation input', () => {
  assert.equal(buildBannerImobiliarioCreationInput({ ...generation, status: 'processing' }), null)
  assert.equal(buildBannerImobiliarioCreationInput({ ...generation, status: 'failed' }), null)
  assert.equal(buildBannerImobiliarioCreationInput({ ...generation, completed_at: null }), null)
  assert.equal(buildBannerImobiliarioCreationInput({ ...generation, image_storage_path: null }), null)
})

test('rejects foreign or unexpected Storage paths without widening the shared allowlist', () => {
  assert.equal(buildBannerImobiliarioCreationInput({
    ...generation,
    image_storage_path: `other-user/hero-ia-next/${generation.id}/hero-principal.jpg`,
  }), null)
  assert.equal(buildBannerImobiliarioCreationInput({
    ...generation,
    image_storage_path: `${generation.user_id}/other/${generation.id}/hero-principal.jpg`,
  }), null)
})

test('uses only reliable property data for the title and otherwise returns null', () => {
  assert.equal(buildBannerImobiliarioTitle(generation.prompt_briefing), 'Apartamento em Vila Mariana')
  assert.equal(buildBannerImobiliarioTitle({
    schema_version: 'hero_prompt_briefing_v1',
    property: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Residencial Aurora' },
  }), 'Residencial Aurora')
  assert.equal(buildBannerImobiliarioTitle({ schema_version: 'unknown', property: { type: 'Casa' } }), null)
  assert.equal(buildBannerImobiliarioTitle({ schema_version: 'hero_prompt_briefing_v1', property: {} }), null)
})

test('repeated completion remains insert-once through the shared idempotent helper', async () => {
  const store = new FakeCreationStore()
  const input = buildBannerImobiliarioCreationInput(generation)
  assert.ok(input)
  const first = await registerCompletedCreation(store, input)
  const repeated = await registerCompletedCreation(store, input)
  assert.equal(first.created, true)
  assert.equal(repeated.created, false)
  assert.equal(first.creation.id, repeated.creation.id)
  assert.equal(store.insertions, 1)
})

test('status returns the signed completed image without an active Creations hook', () => {
  assert.match(indexSource, /status: 'completed',[\s\S]*?image_storage_path: storagePath,[\s\S]*?completed_at: completedAt/)
  assert.match(indexSource, /createSignedUrl\(storagePath, 60 \* 60\)/)
  assert.doesNotMatch(indexSource, /_shared\/creations|registerCompletedCreation|registerBannerImobiliarioCreation|creation_id/)
})

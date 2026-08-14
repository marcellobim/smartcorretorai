import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.resolve(repositoryRoot, relativePath), 'utf8')

const page = read('frontend/src/pages/VirtualStaging.jsx')
const runtime = read('supabase/functions/virtual-staging-image-test/runtime.ts')
const creationRuntime = read('supabase/functions/virtual-staging-image-test/creation-runtime.ts')
const edge = read('supabase/functions/virtual-staging-image-test/index.ts')

test('keeps Virtual Staging on the synchronous single-image OpenAI contract', () => {
  assert.match(edge, /OPENAI_IMAGE_EDIT_URL = 'https:\/\/api\.openai\.com\/v1\/images\/edits'/)
  assert.match(runtime, /count: 1/)
  assert.match(runtime, /generated-01\.jpg/)
  assert.doesNotMatch(runtime, /virtual-staging-(?:generate|status)|Gemini|Veo/)
})

test('keeps the creation adapter dormant while the product ends after its trusted JPEG upload', () => {
  assert.match(runtime, /await deps\.upload\(outputPath, generated\.bytes\)/)
  assert.doesNotMatch(`${runtime}\n${edge}`, /recordSessionOutput|finalizeSession|finalize_session|creation_id|creation-runtime|_shared\/creations/)
  assert.match(creationRuntime, /product_key: 'virtual_staging'/)
  assert.match(creationRuntime, /source_ref: input\.sessionId/)
  assert.match(creationRuntime, /delivery_kind: outputs\.length === 1 \? 'file' : 'bundle'/)
  assert.match(creationRuntime, /bucket: 'studio-videos'/)
  assert.match(creationRuntime, /title: null/)
  assert.doesNotMatch(creationRuntime, /signed|https?:\/\//)
})

test('preserves Before/After and individual downloads without frontend finalization', () => {
  assert.match(page, /label: 'Antes'[\s\S]*label: 'Depois'/)
  assert.match(page, /downloadFurnishRenovateResult[\s\S]*downloadFileFromPrivateUrl\(result\.afterUrl, fallbackName\)/)
  assert.match(page, /const sessionId = crypto\.randomUUID\(\)/)
  assert.match(page, /expected_count: orderedImages\.length/)
  assert.doesNotMatch(page, /finalize_session|creation_id|creationId|setFurnishSessionCreationId|SharePublishActions|sharePublish\s*=/)
})

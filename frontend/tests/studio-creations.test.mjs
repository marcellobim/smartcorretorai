import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relativePath => readFileSync(path.resolve(repositoryRoot, relativePath), 'utf8')
const studio = read('frontend/src/pages/StudioHero.jsx')
const status = read('supabase/functions/get-video-job-status/index.ts')
const runtime = read('supabase/functions/get-video-job-status/creation-runtime.ts')
const veo = read('supabase/functions/_shared/veoClient.ts')
const carousel = read('frontend/src/pages/SmartCarrossel.jsx')

test('preserves the dormant Studio creation adapter without calling it from production status', () => {
  assert.match(runtime, /dynamic_reel:[\s\S]*productKey: 'studio_comercial'/)
  assert.match(runtime, /free_ai:[\s\S]*productKey: 'studio_video_criativo'/)
  assert.match(runtime, /if \(job\.status !== 'completed'\) return null/)
  assert.match(runtime, /const expectedPath = `\$\{job\.user_id\}\/\$\{job\.id\}\/video\.mp4`/)
  assert.match(runtime, /delivery_kind: 'file'/)
  assert.match(runtime, /title: null/)
  assert.doesNotMatch(runtime, /smart_carousel|short_videos|smart_tour_gemini_omni/)
  assert.doesNotMatch(status, /registerStudioCreation|createSupabaseCreationStore|ensureStudioCreation|creationId/)
})

test('completes and returns the original signed MP4 without a creation registration', () => {
  assert.match(status, /if \(job\.status === 'completed'\)[\s\S]*createSignedVideoUrl/)
  assert.match(status, /status: 'completed',[\s\S]*output_video_path: outputPath,[\s\S]*completed_at: completedAt/)
  assert.match(status, /if \(completedUpdateError\) throw new Error\('video_completed_persist_failed'\)[\s\S]*createSignedVideoUrl/)
  assert.doesNotMatch(status, /_shared\/creations|registerStudioCreation|ensureStudioCreation|creationId/)
})

test('frontend ignores creation metadata and keeps product choice on the backend', () => {
  const payload = studio.slice(studio.indexOf('const payload = {'), studio.indexOf("invokeStudioFunction('criar-video-ia'"))
  assert.doesNotMatch(payload, /product_key|delivery_kind|result_manifest|creation_id/)
  assert.doesNotMatch(studio, /creationId|creation-download|onWithdrawDownload/)
})

test('uses the signed video URL for preview and direct download', () => {
  assert.match(studio, /previewUrl: videoUrl/)
  assert.match(studio, /downloadUrl: videoUrl/)
  assert.doesNotMatch(studio, /withdrawStudioVideo|onWithdrawDownload|sharePublish\s*=/)
})

test('does not integrate Smart Carrossel or Short Videos', () => {
  assert.doesNotMatch(carousel, /creation-download|creation_id|registerCompletedCreation/)
  assert.doesNotMatch(carousel, /sharePublish\s*=/)
  assert.doesNotMatch(runtime, /studio_carrossel|short_videos/)
  assert.doesNotMatch(status, /registerStudioCreation|creationId/)
})

test('does not alter the Veo provider contract', () => {
  assert.match(veo, /DEFAULT_VEO_MODEL = 'veo-3\.1-lite-generate-preview'/)
  assert.match(veo, /predictLongRunning/)
  assert.match(studio, /mode: isFreeAiMode \? 'free_ai' : 'cinematic'/)
  assert.doesNotMatch(status, /predictLongRunning|durationSeconds|resolution|aspectRatio|Smart Tokens/)
})

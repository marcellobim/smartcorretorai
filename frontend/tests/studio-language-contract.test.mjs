import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8')
const createVideo = readFileSync(path.join(repositoryRoot, 'supabase/functions/criar-video-ia/index.ts'), 'utf8')
const getVideoStatus = readFileSync(path.join(repositoryRoot, 'supabase/functions/get-video-job-status/index.ts'), 'utf8')

test('Studio sends the normalized locale language at the root and in the briefing', () => {
  assert.match(page, /const language = locale === 'en-US' \? 'en-US' : 'pt-BR'/)
  const payload = page.slice(page.indexOf('const payload = {'), page.indexOf("const result = await invokeStudioFunction('criar-video-ia', payload)"))
  assert.match(payload, /const payload = \{\s*language,/)
  assert.match(payload, /briefing: \{\s*language,/)
  assert.match(page, /writeStudioActiveJob\(window\.sessionStorage, \{[\s\S]*language,/)
  assert.match(page, /const jobLanguage = data\.language === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(page, /activeJobRef\.current\.language !== jobLanguage/)
})

test('backend accepts only supported Studio languages and safely defaults legacy requests to pt-BR', () => {
  assert.match(createVideo, /function normalizeStudioLanguage\(value: unknown\) \{\s*return value === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(createVideo, /const language = normalizeStudioLanguage\(body\.language \?\? briefing\.language\)/)
  assert.match(createVideo, /language,\s*objective,/)
  assert.match(createVideo, /output_media_metadata: \{ language: briefing\.language \}/)
})

test('status recovers the language persisted on the job and defaults older jobs to pt-BR', () => {
  assert.match(getVideoStatus, /function getStudioJobLanguage\(metadata: unknown\) \{[\s\S]*return 'pt-BR'/)
  assert.match(getVideoStatus, /\.language === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(getVideoStatus, /publication_options, output_media_metadata, completed_at/)
  assert.match(getVideoStatus, /const language = getStudioJobLanguage\(job\.output_media_metadata\)/)
  assert.ok((getVideoStatus.match(/\blanguage,/g) || []).length >= 8)
})

test('language contract leaves Studio mode, image behavior and VEO economy constants untouched', () => {
  assert.match(page, /const inputImage1Path = requiresImages\s*\? await uploadImage\(IMAGE_SLOTS\[0\], files\.image1, draftId\)\s*:\s*''/)
  assert.match(page, /\.\.\.\(requiresImages \? \{ inputImage1Path \} : \{\}\)/)
  assert.match(createVideo, /const jobMode = isFreeAiRequest \? 'free_ai' : 'dynamic_reel'/)
  assert.match(createVideo, /const productCode = productCodeForVeoMode\(jobMode\)/)
  assert.match(createVideo, /const ctaFrame = isFreeAiRequest \? null : resolveStudioHeroCtaFrame\(briefing\)/)
  assert.match(createVideo, /input_image_1_path: inputImage1Path \|\| null/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const generate = read('supabase/functions/virtual-staging-generate/index.ts')
const status = read('supabase/functions/virtual-staging-status/index.ts')
const validation = read('supabase/functions/_shared/virtual-staging/validation.ts')
const types = read('supabase/functions/_shared/virtual-staging/types.ts')
const sharedIndex = read('supabase/functions/_shared/virtual-staging/index.ts')
const page = read('frontend/src/pages/VirtualStaging.jsx')
const journeys = read('frontend/src/config/virtualStagingJourneys.js')
const imageRuntime = read('supabase/functions/virtual-staging-image-test/runtime.ts')
const alternateProvider = String.fromCharCode(86, 101, 111)
const alternateProviderPattern = new RegExp(`start${alternateProvider}Video|${alternateProvider}Client|${alternateProvider}_`, 'i')

test('backend de video nao aceita nem constroi o furnish antigo', () => {
  assert.doesNotMatch(generate, /buildReimaginePrompt|property_condition|normalizeVirtualStagingGenerateRequest/)
  assert.doesNotMatch(validation, /validateFurnishRenovate|FURNISH_RENOVATE_MODULE|property_condition/)
  assert.doesNotMatch(types, /ReimaginePropertyCondition|property_condition|furnish-renovate/)
  assert.doesNotMatch(sharedIndex, /reimagine-prompt|buildReimaginePrompt/)
  assert.equal(existsSync(path.join(repositoryRoot, 'supabase/functions/_shared/virtual-staging/reimagine-prompt.ts')), false)
})

test('Vida no Imovel e Apresentacao pelo Corretor continuam Gemini sem provider alternativo', () => {
  assert.match(generate, /generateGeminiOmniVideoInline/)
  assert.match(generate, /startGeminiOmniVideo/)
  assert.match(generate, /input\.generation\.mode === 'narrated_tour' && Boolean\(input\.generation\.life_scene\)/)
  assert.match(generate, /input\.module === 'broker-presentation'/)
  assert.match(generate, /aspectRatio:'9:16'/)
  assert.doesNotMatch(generate, alternateProviderPattern)
  assert.doesNotMatch(status, alternateProviderPattern)
})

test('status preserva compatibilidade para jobs antigos sem briefing estruturado', () => {
  assert.match(status, /let briefing = null[\s\S]*smart_tour_caption_briefing_invalid/)
  assert.match(status, /if \(briefing && hasDeterministicSmartTourText\(briefing\)\)/)
  assert.match(status, /virtual-staging\.mp4/)
})

test('Virtual Staging publico permanece somente no fluxo de imagens OpenAI', () => {
  assert.match(page, /virtual-staging-image-test/)
  assert.match(page, /VirtualStagingBeforeAfterPhone/)
  assert.doesNotMatch(page, /reimagine-1\.mp4|FurnishReimagineHero|FurnishReimagineComparison/)
  assert.doesNotMatch(journeys, /reimagine-1\.mp4|Reimagine AI/)
  assert.match(imageRuntime, /openAI\.editImage/)
  assert.doesNotMatch(imageRuntime, /startGeminiOmniVideo/)
  assert.doesNotMatch(imageRuntime, alternateProviderPattern)
})

test('asset demonstrativo do video removido nao permanece no produto', () => {
  assert.equal(existsSync(path.join(repositoryRoot, 'frontend/public/demos-videos/reimagine-1.mp4')), false)
})

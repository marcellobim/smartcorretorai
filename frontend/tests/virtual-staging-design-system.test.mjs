import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_QUESTIONS,
} from '../src/config/virtualStagingFurnish.js'
import { getVirtualStagingNextQuestion } from '../src/config/virtualStagingConversation.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const page = read('src/pages/VirtualStaging.jsx')

test('uses the shared visual foundation for every Virtual Staging journey', () => {
  assert.match(page, /import \{ ProductButton, ProductCard, ProductHero, ProductSectionHeading, ProductSteps \}/)
  assert.match(page, /<ProductSectionHeading[\s\S]*?<ProductSteps steps=\{journeySteps\}/)
  assert.match(page, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?accent="emerald"/)
  assert.match(page, /const chooseAnotherButton = <ProductButton/)
})

test('defines the shortened visual steps for image Virtual Staging', () => {
  const stepsStart = page.indexOf('const journeySteps = isFurnishRenovate')
  const stepsDefinition = page.slice(stepsStart, page.indexOf('return <section aria-labelledby', stepsStart))
  const expectedTitles = ['Transformação', 'Estilo', 'Imagens', 'Revisão']

  assert.deepEqual([...stepsDefinition.matchAll(/\{ title: '([^']+)'/g)].map(match => match[1]), expectedTitles)
  assert.doesNotMatch(stepsDefinition, /title: 'Aviso'/)
  assert.doesNotMatch(stepsDefinition, /title: 'Destinos'/)
})

test('maps transformation, style and images directly to review', () => {
  assert.deepEqual(
    FURNISH_RENOVATE_QUESTIONS.map(([id, step]) => [id, step]),
    [
      ['transformation_type', 1],
      ['decoration_style', 2],
      ['images', 3],
      ['review', 4],
    ],
  )
})

test('keeps the AI notice inside review without an extra conversational step', () => {
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.at(-1), ['review', 4, 'Revise seu projeto'])
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.doesNotMatch(page, /id === 'ai_notice'/)
  assert.match(page, /FURNISH_RENOVATE_COPY\.reviewNotice/)
})

test('keeps both active video modules in the shared mobile result presentation', () => {
  assert.match(page, /journey\.id === LIFE_IN_PROPERTY_JOURNEY_ID/)
  assert.match(page, /journey\.id === BROKER_PRESENTATION_JOURNEY_ID/)
  assert.match(page, /if \(result\) \{[\s\S]*?return <section[\s\S]*?<CampaignPackage[\s\S]*?mediaPresentation="mobile"/)
  assert.match(page, /previewUrl: result\.signedVideoUrl, downloadUrl: result\.signedVideoUrl/)
})

test('keeps the image result as Before and After with its private download', () => {
  const imageDelivery = page.slice(page.indexOf('function FurnishRenovateResultCard'), page.indexOf('function FurnishRenovateProcessing'))

  assert.match(imageDelivery, /label: 'Original'[\s\S]*\.\.\.result\.stages/)
  assert.match(imageDelivery, /\{item\.label\}[\s\S]*<img src=\{item\.src\}/)
  assert.match(imageDelivery, /downloadFurnishRenovateResult\(result, stage\)/)
  assert.match(imageDelivery, /Baixar \{stage\.label\.toLocaleLowerCase/)
  assert.doesNotMatch(imageDelivery, /CampaignPackage/)
})

test('preserves the existing generation endpoints without selecting providers in the frontend', () => {
  assert.match(page, /functions\.invoke\('virtual-staging-image-test'/)
  assert.match(page, /functions\.invoke\('virtual-staging-generate'/)
  assert.match(page, /functions\.invoke\('virtual-staging-status'/)
  assert.doesNotMatch(page, /startGeminiOmniVideo|startVeo|veoClient|openai\.images/)
})

test('does not restore the removed Reimagine video contract', () => {
  assert.doesNotMatch(page, /reimagine-1\.mp4|buildReimaginePrompt|ReimaginePropertyCondition|FurnishReimagineHero|FurnishReimagineComparison/)
})

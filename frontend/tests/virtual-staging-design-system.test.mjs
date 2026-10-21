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

test('uses the shared visual foundation without an intermediate progress rail', () => {
  assert.match(page, /import \{ ProductButton, ProductCard, ProductHero, ProductSectionHeading \}/)
  assert.doesNotMatch(page, /<ProductSteps/)
  assert.match(page, /<GuidedConversation[\s\S]*?designSystem[\s\S]*?accent="emerald"/)
  assert.match(page, /showHeader=\{false\}/)
  assert.match(page, /showSummary=\{false\}/)
  assert.match(page, /const chooseAnotherButton = <ProductButton/)
})

test('keeps only the discrete question counter and final review in the conversation', () => {
  assert.match(page, /review=\{question\[0\] === 'review'\}/)
  assert.match(page, /reviewItems: isFurnishRenovate \? furnishReviewItems : reviewItems/)
  assert.doesNotMatch(page, /journeySteps|visualStep|summaryItems=\{reviewItems\}/)
})

test('keeps the approved destination branch after the images', () => {
  assert.deepEqual(
    FURNISH_RENOVATE_QUESTIONS.map(([id, step]) => [id, step]),
    [
      ['transformation_type', 1],
      ['decoration_style', 2],
      ['images', 3],
      ['use_destination', 4],
      ['social_options', 5],
      ['social_property_details', 5],
      ['social_caption_decision', 5],
      ['social_caption_mode', 5],
      ['social_caption_custom', 5],
      ['social_cta_decision', 5],
      ['cta', 5],
      ['social_phone_decision', 5],
      ['phone', 5],
      ['social_identity_decision', 5],
      ['professional_identity', 5],
      ['review', 6],
    ],
  )
})

test('keeps publishing decisions out of the social briefing and in the generated delivery', () => {
  assert.deepEqual(
    FURNISH_RENOVATE_QUESTIONS.map(([id]) => id),
    ['transformation_type', 'decoration_style', 'images', 'use_destination', 'social_options', 'social_property_details', 'social_caption_decision', 'social_caption_mode', 'social_caption_custom', 'social_cta_decision', 'cta', 'social_phone_decision', 'phone', 'social_identity_decision', 'professional_identity', 'review'],
  )
  const socialQuestion = page.slice(page.indexOf("if (id === 'social_options'"), page.indexOf("if (id === 'social_property_details'"))
  assert.doesNotMatch(socialQuestion, /checkbox|getFurnishRenovateSocialOptions/)
  assert.doesNotMatch(socialQuestion, /Publish to Instagram|Publicar no Instagram|Send to TikTok|Enviar para TikTok|publish|tiktok/i)
  const delivery = page.slice(page.indexOf('function FurnishRenovateDelivery'), page.indexOf('function FurnishRenovateProcessing'))
  assert.match(delivery, /social=\{isSocial\}/)
  assert.match(delivery, /isSocial && completedResults\.some/)
})

test('keeps the AI notice inside final review without a dedicated step', () => {
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.at(-1), ['review', 6, 'Revise seu projeto'])
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'use_destination')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'use_destination', answerId: 'portal', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.doesNotMatch(page, /id === 'ai_notice'/)
  assert.match(page, /furnishCopy\.reviewNotice/)
})

test('keeps both active video modules in the shared mobile result presentation', () => {
  assert.match(page, /journey\.id === LIFE_IN_PROPERTY_JOURNEY_ID/)
  assert.match(page, /journey\.id === BROKER_PRESENTATION_JOURNEY_ID/)
  assert.match(page, /if \(result\) \{[\s\S]*?return <section[\s\S]*?<CampaignPackage[\s\S]*?mediaPresentation="mobile"/)
  assert.match(page, /previewUrl: result\.signedVideoUrl, downloadUrl: result\.signedVideoUrl/)
})

test('keeps the image result as Before and After with its private download', () => {
  const imageDelivery = page.slice(page.indexOf('function FurnishRenovateResultCard'), page.indexOf('function FurnishRenovateProcessing'))

  assert.match(imageDelivery, /label: copy\.original[\s\S]*\.\.\.result\.stages/)
  assert.match(imageDelivery, /\{item\.label\}[\s\S]*<img src=\{item\.src\}/)
  assert.match(imageDelivery, /downloadFurnishRenovateResult\(result, stage\)/)
  assert.match(imageDelivery, /\{copy\.download\} \{stageLabel\(stage\)\.toLocaleLowerCase/)
  assert.match(imageDelivery, /isSocial && socialOptions\?\.caption && caption && <CampaignPackage/)
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

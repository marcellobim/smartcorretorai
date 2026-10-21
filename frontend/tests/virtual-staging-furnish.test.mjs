import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getVirtualStagingNextQuestion, getVirtualStagingReviewEditNext } from '../src/config/virtualStagingConversation.js'
import {
  buildFurnishRenovateReviewItems,
  canAddFurnishRenovateImages,
  FURNISH_RENOVATE_JOURNEY_ID,
  FURNISH_RENOVATE_MAX_IMAGES,
  FURNISH_RENOVATE_QUESTIONS,
  FURNISH_RENOVATE_STYLE_OPTIONS,
  FURNISH_RENOVATE_TRANSFORMATION_OPTIONS,
  furnishRenovateRequiresStyle,
  getFurnishRenovateCopy,
  getFurnishRenovateDestinationOptions,
  getFurnishRenovateSocialOptions,
  getFurnishRenovateTransformationLabel,
  getFurnishRenovateTransformationOptions,
  getSmartSpaceQuote,
  getSmartSpaceUnitCost,
  isAvailableFurnishRenovateTransformation,
} from '../src/config/virtualStagingFurnish.js'
import { VIRTUAL_STAGING_MAX_IMAGES } from '../src/config/virtualStaging.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const read = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
const page = read('frontend/src/pages/VirtualStaging.jsx')

test('exposes only the two approved actions for new projects and preserves legacy labels for recovery', () => {
  assert.deepEqual(FURNISH_RENOVATE_TRANSFORMATION_OPTIONS.map(option => option.id), ['remove_furniture', 'remove_and_redecorate'])
  assert.deepEqual(getFurnishRenovateTransformationOptions('en-US').map(option => option.label), ['Clear the space', 'Redesign completely'])
  assert.equal(isAvailableFurnishRenovateTransformation('furnish'), false)
  assert.equal(isAvailableFurnishRenovateTransformation('clear_area'), false)
  assert.equal(getFurnishRenovateTransformationLabel('furnish'), 'Mobiliar um ambiente vazio')
  assert.equal(getFurnishRenovateTransformationLabel('clear_area', 'en-US'), 'Visually clear a lot or area to better see the space')
  assert.equal(furnishRenovateRequiresStyle('remove_furniture'), false)
  assert.equal(furnishRenovateRequiresStyle('remove_and_redecorate'), true)
  assert.deepEqual(FURNISH_RENOVATE_STYLE_OPTIONS.map(option => option.id), ['cozy', 'contemporary'])
})

test('uses the approved destination labels and optional social controls in BR and US', () => {
  assert.deepEqual(getFurnishRenovateDestinationOptions('pt-BR'), [{ id: 'social', label: 'Redes sociais' }, { id: 'portal', label: 'Portal / plataforma imobiliária' }])
  assert.deepEqual(getFurnishRenovateDestinationOptions('en-US'), [{ id: 'social', label: 'Social media' }, { id: 'portal', label: 'Real estate portal / platform' }])
  assert.deepEqual(getFurnishRenovateSocialOptions('en-US').map(option => option.id), ['property', 'caption', 'cta', 'phone', 'identity'])
  const en = getFurnishRenovateCopy('en-US')
  assert.equal(en.destinationQuestion, 'Where will you use this content?')
  assert.equal(en.socialOptionsQuestion, 'What would you like to include?')
  assert.equal(getFurnishRenovateCopy('pt-BR').socialOptionsQuestion, 'O que deseja incluir no material?')
})

test('branches after upload to clean portal delivery or optional social questions', () => {
  assert.deepEqual(FURNISH_RENOVATE_QUESTIONS.map(([id]) => id), ['transformation_type', 'decoration_style', 'images', 'use_destination', 'social_options', 'social_property_details', 'social_caption_mode', 'social_caption_custom', 'cta', 'phone', 'professional_identity', 'review'])
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'transformation_type', answerId: 'remove_furniture', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'images')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'transformation_type', answerId: 'remove_and_redecorate', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'decoration_style')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'use_destination')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'use_destination', answerId: 'portal', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'use_destination', answerId: 'social', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'social_options')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'social_options', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { property: true } }), 'social_property_details')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'social_property_details', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { caption: true } }), 'social_caption_mode')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'social_caption_mode', answerId: 'custom', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { caption: true } }), 'social_caption_custom')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'social_options', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { cta: true, phone: true, identity: true } }), 'cta')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'cta', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { phone: true, identity: true } }), 'phone')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'phone', journeyId: FURNISH_RENOVATE_JOURNEY_ID, socialOptions: { identity: true } }), 'professional_identity')
  assert.equal(getVirtualStagingNextQuestion({ questionId: 'professional_identity', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
})

test('preserves the normal 1–5 contract and 30/60 ST economy for all accounts', () => {
  assert.equal(FURNISH_RENOVATE_MAX_IMAGES, 5)
  assert.equal(FURNISH_RENOVATE_MAX_IMAGES, VIRTUAL_STAGING_MAX_IMAGES)
  assert.equal(canAddFurnishRenovateImages(0, 1), true)
  assert.equal(canAddFurnishRenovateImages(2, 3), true)
  assert.equal(canAddFurnishRenovateImages(5, 1), false)
  assert.equal(getSmartSpaceUnitCost('remove_furniture'), 30)
  assert.equal(getSmartSpaceUnitCost('remove_and_redecorate'), 60)
  assert.equal(getSmartSpaceQuote('remove_furniture', 5), 150)
  assert.equal(getSmartSpaceQuote('remove_and_redecorate', 5), 300)
  assert.match(page, /images\.length >= 1[\s\S]*images\.length <= FURNISH_RENOVATE_MAX_IMAGES/)
  assert.match(page, /Boolean\(useDestination\)/)
  assert.doesNotMatch(page, /1 to 10|1–10|1-10/)
})

test('keeps portal delivery clean and exposes social publication only after generation', () => {
  assert.match(page, /const isSocial = socialOptions\?\.destination === 'social'/)
  assert.match(page, /social && publication\?\.enabled/)
  assert.match(page, /supportedNetworks=\{\['tiktok'\]\}/)
  assert.match(page, /<BannerPublishDialog/)
  assert.match(page, /<SharePublishActions/)
  assert.match(page, /isSocial && socialOptions\?\.caption && caption && <CampaignPackage/)
  assert.match(page, /onSaveProfile=\{async patch =>/)
  const socialQuestion = page.slice(page.indexOf("if (id === 'social_options'"), page.indexOf("if (id === 'social_property_details'"))
  assert.doesNotMatch(socialQuestion, /publish|tiktok|Instagram\/Facebook|TikTok/)
  const delivery = page.slice(page.indexOf('function FurnishRenovateDelivery'), page.indexOf('function FurnishRenovateProcessing'))
  assert.match(delivery, /social=\{isSocial\}/)
  assert.match(delivery, /isSocial && completedResults\.some/)
})

test('reuses structured property data and the shared caption editor for Social media', () => {
  const socialProperty = page.slice(page.indexOf("if (id === 'social_property_details'"), page.indexOf("if (id === 'social_caption_mode'"))
  assert.match(socialProperty, /<StudioUsLocation[\s\S]*showContinue=\{false\}/)
  assert.match(socialProperty, /<SmartCarouselStateSelect/)
  assert.match(socialProperty, /<SmartCarouselCitySelect/)
  assert.match(socialProperty, /getVirtualStagingMeasureFields\(property\.type\)/)
  assert.match(socialProperty, /getVirtualStagingHighlightGroups\(property\.type\)/)
  const socialCaption = page.slice(page.indexOf("if (id === 'social_caption_mode'"), page.indexOf("if (id === 'presenter_reference')"))
  assert.match(socialCaption, /buildVirtualStagingCampaignPackage/)
  assert.match(socialCaption, /<SocialCaptionEditor/)
  assert.match(socialCaption, /countSocialCaptionCharacters/)
  assert.doesNotMatch(page, /propertyText/)
})

test('keeps final review, Back/Edit/reset, and historical recovery compatible', () => {
  const review = buildFurnishRenovateReviewItems({ imagesCount: 3, transformationType: 'remove_and_redecorate', decorationStyle: 'cozy', useDestination: 'social', socialOptions: { caption: true, publish: true } })
  assert.deepEqual(review.map(item => item.id), ['transformation_type', 'decoration_style', 'images', 'use_destination', 'social_options'])
  assert.equal(getVirtualStagingReviewEditNext({ originQuestionId: 'images', questionId: 'images', journeyId: FURNISH_RENOVATE_JOURNEY_ID }), 'review')
  assert.match(page, /isRecoverableFurnishRenovateTransformation\(restoredJourneyDraft\.transformationType\)/)
  assert.match(page, /setUseDestination\(''\); setSocialOptions\(initialSocialOptions\)/)
})

test('keeps destination and social options out of the Edge image-generation payload', () => {
  const integration = page.slice(page.indexOf('const createFurnishRenovateImage'), page.indexOf('const createTour'))
  assert.match(integration, /functions\.invoke\('virtual-staging-image-test'/)
  assert.doesNotMatch(integration, /use_destination|socialOptions|captionText|propertyText/)
  assert.doesNotMatch(read('frontend/src/config/virtualStagingFurnish.js'), /supabase|fetch\(|invoke\(/)
})

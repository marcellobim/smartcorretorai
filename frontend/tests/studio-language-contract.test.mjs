import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8')
const usLocation = readFileSync(path.join(frontendRoot, 'src/components/location/StudioUsLocation.jsx'), 'utf8')
const createVideo = readFileSync(path.join(repositoryRoot, 'supabase/functions/criar-video-ia/index.ts'), 'utf8')
const getVideoStatus = readFileSync(path.join(repositoryRoot, 'supabase/functions/get-video-job-status/index.ts'), 'utf8')

test('Studio sends the normalized locale language at the root and in the briefing', () => {
  assert.match(page, /const language = locale === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(page, /export function buildStudioGenerationPayload/)
  assert.match(page, /language, market,/)
  assert.match(page, /briefing = \{\s*language,/)
  assert.match(page, /dispatchStudioGeneration\(invokeStudioFunction, payload\)/)
  assert.match(page, /writeStudioActiveJob\(window\.sessionStorage, \{[\s\S]*language,/)
  assert.match(page, /const jobLanguage = data\.language === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(page, /activeJobRef\.current\.language !== jobLanguage/)
})

test('backend accepts only supported Studio languages and safely defaults legacy requests to pt-BR', () => {
  assert.match(createVideo, /function normalizeStudioLanguage\(value: unknown\) \{\s*return value === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(createVideo, /const language = normalizeStudioLanguage\(body\.language \?\? briefing\.language\)/)
  assert.match(createVideo, /language,\s*objective,/)
  assert.match(createVideo, /output_media_metadata: \{ language: briefing\.language, professional_identity: professionalIdentitySelection \}/)
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

test('dynamic_reel resolves each existing CTA choice to its locale-specific fixed frame', () => {
  const frames = [
    ['cta-saiba-mais.png', 'cta-learn-more.png'],
    ['cta-agende-sua-visita.png', 'cta-schedule-your-visit.png'],
    ['cta-entre-em-contato-agora.png', 'cta-contact-us-now.png'],
    ['cta-faca-parte-do-nosso-time.png', 'cta-join-our-team.png'],
    ['cta-aguardo-seu-contato.png', 'cta-get-in-touch.png'],
  ]
  for (const [pt, en] of frames) {
    assert.match(createVideo, new RegExp(`'pt-BR':[\\s\\S]*${pt}`))
    assert.match(createVideo, new RegExp(`'en-US':[\\s\\S]*${en}`))
  }
  assert.match(createVideo, /const language = briefing\.language === 'en-US' \? 'en-US' : 'pt-BR'/)
  assert.match(createVideo, /STUDIO_HERO_CTA_FRAMES\.sell\[language\]/)
  assert.match(createVideo, /const ctaFrame = isFreeAiRequest \? null : resolveStudioHeroCtaFrame\(briefing\)/)
})

test('dynamic_reel and free_ai use the persisted language for narration without changing their separate flows', () => {
  assert.match(createVideo, /voiceover_language: briefing\.language/)
  assert.match(createVideo, /AMERICAN ENGLISH VOICE LOCK - MANDATORY/)
  assert.match(createVideo, /This is a dynamic_reel commercial\. All spoken narration must be natural American English\./)
  assert.match(createVideo, /function localizeDynamicReelPromptLanguage\(prompt: string, language: string\)/)
  assert.match(createVideo, /\.replaceAll\('Brazilian Portuguese', 'American English'\)/)
  assert.match(createVideo, /const language = briefing\.language/)
  assert.match(createVideo, /if \(isFreeAiRequest\) \{[\s\S]*withFreeAiSpokenCta[\s\S]*\} else \{/)
  assert.doesNotMatch(createVideo.slice(createVideo.indexOf('function buildDynamicReelLanguagePresentation'), createVideo.indexOf('function buildStructuredStudioHeroBriefing')), /withFreeAiSpokenCta/)
})

test('the EN-US CTA assets are versioned locally and the runtime continues to use bucket paths', () => {
  const assetRoot = path.join(frontendRoot, 'public/studio-hero/cta')
  for (const asset of ['cta-learn-more.png', 'cta-schedule-your-visit.png', 'cta-contact-us-now.png', 'cta-join-our-team.png', 'cta-get-in-touch.png']) {
    assert.ok(readFileSync(path.join(assetRoot, asset)).byteLength > 0, `${asset} is present`)
  }
  assert.match(createVideo, /const STUDIO_HERO_CTA_LIBRARY_PREFIX = 'system\/studio-hero\/cta'/)
  assert.match(createVideo, /const libraryPath = `\$\{STUDIO_HERO_CTA_LIBRARY_PREFIX\}\/\$\{ctaFrame\.fileName\}`/)
})

test('US Studio keeps structural copy localized and excludes Brazilian-only intermediate UI', () => {
  assert.match(page, /getConversationControls\(market\)/)
  assert.match(page, /market === 'US' \? 'Creative direction' : 'Direção criativa'/)
  assert.match(page, /market === 'US' \? 'Talk with AI' : 'Converse com a IA'/)
  assert.match(page, /getProfileOptions\(answers, market\)/)
  assert.match(page, /profile !== 'MCMV'/)
  assert.match(page, /current\.profile === 'MCMV'/)
  assert.doesNotMatch(page, /<ProductSteps/)
  assert.doesNotMatch(page, /<ProductSummary/)
  assert.match(page, /market === 'US' \? \[\] : STUDIO_POSSIBILITY_EXAMPLES/)
  assert.match(page, /translated === key \? '' : translated/)
})

test('Studio uses the real US state/county/city hierarchy and does not require optional fields', () => {
  assert.match(page, /<StudioUsLocation/)
  assert.match(page, /const hasCompletedLocation = market === 'US'/)
  assert.match(page, /Boolean\(answers\.state && answers\.county && answers\.city\)/)
  assert.match(page, /state: answers\.state \|\| ''/)
  assert.match(page, /county: answers\.county \|\| ''/)
  assert.match(page, /\.\.\.\(answers\.zipCode \? \{ zipCode: answers\.zipCode \} : \{\}\)/)
  assert.match(page, /\.\.\.\(answers\.neighborhoodCommunity \? \{ neighborhoodCommunity: answers\.neighborhoodCommunity \} : \{\}\)/)
  assert.match(usLocation, /loadCities = getUsCitiesByCounty/)
  assert.match(usLocation, /county: '', city: '', zipCode: '', neighborhoodCommunity: ''/)
  assert.match(usLocation, /onState\(\{ cities: \[\], status: 'loading', error: '' \}\)/)
  assert.match(usLocation, /request !== requestRef\.current/)
  assert.match(usLocation, /Try again/)
  assert.match(usLocation, /No cities were found for this county\./)
})

test('Studio clears incompatible geography when the global market changes', () => {
  assert.match(page, /const previousMarketRef = useRef\(market\)/)
  assert.match(page, /if \(market === 'US'\)/)
  assert.match(page, /uf: '', city: '', cityOther: '', district: '', captureHasDistrict: ''/)
  assert.match(page, /state: '', county: '', zipCode: '', neighborhoodCommunity: ''/)
})

test('Studio runtime copy stays localized when US mode begins', () => {
  assert.match(page, /US_OBJECTIVE_DESCRIPTIONS/)
  assert.match(page, /optionLabel\('profiles', option\)/)
  assert.match(page, /t\('studio\.accessibility\.progress'\)/)
  assert.match(page, /t\('smartTour\.showcase\.usAssetsPending'\)/)
  assert.match(page, /mode\.id === 'smart_carousel' && market === 'US'/)
  assert.match(page, /const \{ t, market \} = useLocale\(\)/)
})

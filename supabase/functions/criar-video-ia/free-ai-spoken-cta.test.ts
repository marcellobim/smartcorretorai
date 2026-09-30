import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  buildFreeAiSpokenCtaClosing,
  buildFreeAiSpokenCtaInstruction,
  withFreeAiSpokenCta,
} from './free-ai-spoken-cta.ts'
import {
  productCodeForVeoMode,
  quoteVeoVideoGeneration,
} from '../_shared/veo-video-economy.ts'

const creator = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('free_ai without CTA preserves the current prompt unchanged', () => {
  const prompt = 'CURRENT FREE AI PROMPT'
  assert.equal(withFreeAiSpokenCta(prompt, '', false), prompt)
  assert.equal(withFreeAiSpokenCta(prompt, '   ', false), prompt)
})

test('free_ai CTA becomes the final spoken narration instruction', () => {
  const prompt = withFreeAiSpokenCta('CURRENT FREE AI PROMPT', 'SAIBA MAIS', false)
  assert.match(prompt, /SPOKEN CTA CLOSING - FREE AI ONLY/)
  assert.match(prompt, /selected CTA is "SAIBA MAIS"/)
  assert.match(prompt, /spoken sentence "Saiba mais\."/)
  assert.match(prompt, /final sentence/)
  assert.match(prompt, /audio-only/)
})

test('catalog CTAs receive natural Brazilian Portuguese closing sentences', () => {
  assert.deepEqual(buildFreeAiSpokenCtaClosing('SAIBA MAIS'), {
    selectedCta: 'SAIBA MAIS',
    spokenClosing: 'Saiba mais.',
  })
  assert.deepEqual(buildFreeAiSpokenCtaClosing('ENTRE EM CONTATO'), {
    selectedCta: 'ENTRE EM CONTATO',
    spokenClosing: 'Entre em contato.',
  })
})

test('catalog CTAs receive natural American English spoken closings without changing their internal values', () => {
  assert.deepEqual(buildFreeAiSpokenCtaClosing('SAIBA MAIS', 'en-US'), {
    selectedCta: 'SAIBA MAIS',
    spokenClosing: 'Learn more.',
  })
  assert.deepEqual(buildFreeAiSpokenCtaClosing('AGENDE SUA VISITA', 'en-US'), {
    selectedCta: 'AGENDE SUA VISITA',
    spokenClosing: 'Schedule your visit.',
  })
  assert.deepEqual(buildFreeAiSpokenCtaClosing('ENTRE EM CONTATO', 'en-US'), {
    selectedCta: 'ENTRE EM CONTATO',
    spokenClosing: 'Contact us.',
  })
  const instruction = buildFreeAiSpokenCtaInstruction('SAIBA MAIS', 'en-US')
  assert.match(instruction, /American English voiceover/)
  assert.match(instruction, /spoken sentence "Learn more\."/)
  assert.doesNotMatch(instruction, /Brazilian Portuguese voiceover/)
})

test('JSON provider prompt receives CTA in audio_engine without enabling visual text', () => {
  const prompt = JSON.stringify({
    video: { duration_seconds: 8 },
    audio_engine: { voiceover_language: 'pt-BR' },
    text_engine: { enabled: false },
  })
  const payload = JSON.parse(withFreeAiSpokenCta(prompt, 'SAIBA MAIS', true))

  assert.equal(payload.audio_engine.voiceover_language, 'pt-BR')
  assert.equal(payload.audio_engine.spoken_cta_closing.required_final_spoken_sentence, 'Saiba mais.')
  assert.equal(payload.audio_engine.spoken_cta_closing.placement, 'final_voiceover_sentence')
  assert.equal(payload.audio_engine.spoken_cta_closing.audio_only, true)
  assert.equal(payload.audio_engine.spoken_cta_closing.visible_text_forbidden, true)
  assert.equal(payload.video.duration_seconds, 8)
  assert.equal(payload.text_engine.enabled, false)
})

test('JSON provider prompt keeps the creative CTA audio-only in English', () => {
  const prompt = JSON.stringify({
    video: { duration_seconds: 8 },
    audio_engine: { voiceover_language: 'en-US' },
    text_engine: { enabled: false },
  })
  const payload = JSON.parse(withFreeAiSpokenCta(prompt, 'SAIBA MAIS', true, 'en-US'))

  assert.equal(payload.audio_engine.voiceover_language, 'en-US')
  assert.equal(payload.audio_engine.spoken_cta_closing.required_final_spoken_sentence, 'Learn more.')
  assert.equal(payload.audio_engine.spoken_cta_closing.language, 'en-US')
  assert.equal(payload.audio_engine.spoken_cta_closing.audio_only, true)
  assert.equal(payload.audio_engine.spoken_cta_closing.visible_text_forbidden, true)
  assert.equal(payload.video.duration_seconds, 8)
  assert.equal(payload.text_engine.enabled, false)
})

test('opening highlight stays separate from the final CTA', () => {
  const instruction = buildFreeAiSpokenCtaInstruction('SAIBA MAIS')
  assert.match(instruction, /Do not replace it with the opening highlight or hero phrase\./)
  assert.doesNotMatch(instruction, /QUER VENDER/)
})

test('free_ai integration keeps zero visual text and has no CTA frame or post-processing', () => {
  assert.match(creator, /if \(isFreeAiRequest\) \{[\s\S]*?withFreeAiSpokenCta\(promptFinal, metadataChat\.cta, promptMode === 'json', briefing\.language\)/)
  const spokenCtaAt = creator.indexOf('promptFinal = withFreeAiSpokenCta')
  const finalVisualLockAt = creator.indexOf('promptFinal = withStudioHeroFinalVisualQualityLock', spokenCtaAt)
  assert.ok(spokenCtaAt > 0 && finalVisualLockAt > spokenCtaAt)
  assert.match(creator, /Render no visible text\. There is no native CTA exception in IA Livre\./)
  assert.match(creator, /visibleTextsForDebug = \[\][\s\S]*visibleTextCount = 0/)
  assert.match(creator, /const ctaFrame = isFreeAiRequest \? null : resolveStudioHeroCtaFrame/)
  assert.doesNotMatch(creator, /ffmpeg|drawtext|overlay.*spoken_cta/i)
})

test('free_ai uses its persisted language for prompt, voiceover and visible CTA presentation', () => {
  assert.match(creator, /function getStudioHeroFreeAiFinalCta\(language: string\)/)
  assert.match(creator, /return language === 'en-US' \? 'LEARN MORE' : 'SAIBA MAIS'/)
  assert.match(creator, /voiceover_language: briefing\.language/)
  assert.match(creator, /free_ai_american_english_presentation: isFreeAi && briefing\.language === 'en-US'/)
  assert.match(creator, /if \(isFreeAiRequest\) \{[\s\S]*localizeFreeAiPromptLanguage[\s\S]*withFreeAiSpokenCta\(promptFinal, metadataChat\.cta, promptMode === 'json', briefing\.language\)/)
  assert.match(creator, /function localizeFreeAiPromptLanguage\(prompt: string, language: string\)/)
  assert.match(creator, /const promptLanguage = briefing\.language/)
  assert.match(creator, /const ctaFrame = isFreeAiRequest \? null : resolveStudioHeroCtaFrame\(briefing\)/)
})

test('dynamic_reel CTA frame path remains outside the free_ai spoken CTA branch', () => {
  const spokenCallAt = creator.indexOf('promptFinal = withFreeAiSpokenCta')
  const spokenBranch = creator.slice(creator.lastIndexOf('if (isFreeAiRequest)', spokenCallAt), spokenCallAt + 180)
  assert.match(spokenBranch, /withFreeAiSpokenCta/)
  assert.doesNotMatch(spokenBranch, /resolveStudioHeroCtaFrame|downloadStudioHeroCtaFrameBytes/)
  assert.match(creator, /isFreeAiRequest \? null : resolveStudioHeroCtaFrame\(briefing\)/)
})

test('provider, model, duration and 120 ST economy remain unchanged', () => {
  assert.match(creator, /const DEFAULT_MODEL = 'veo-3\.1-lite-generate-preview'/)
  assert.match(creator, /durationSeconds: 8/)
  assert.match(creator, /resolution: '720p'/)
  assert.match(creator, /await startVeoVideo\(\{[\s\S]*durationSeconds: 8[\s\S]*resolution: '720p'/)
  const productCode = productCodeForVeoMode('free_ai')
  assert.equal(productCode, 'creative_video')
  assert.equal(quoteVeoVideoGeneration(productCode).smartTokenCost, 120)
})

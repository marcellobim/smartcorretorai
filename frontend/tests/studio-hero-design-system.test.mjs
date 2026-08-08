import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const studio = readFileSync(path.join(frontendRoot, 'src/pages/StudioHero.jsx'), 'utf8').replaceAll('\r\n', '\n')
const helperSource = studio
  .slice(studio.indexOf('export function getStudioVisualStep'), studio.indexOf('function isLandType'))
  .replace('export function getStudioVisualStep', 'function getStudioVisualStep')
const { getStudioVisualStep } = Function(`${helperSource}; return { getStudioVisualStep }`)()

const visualStep = overrides => getStudioVisualStep({
  studioMode: 'cinematic',
  step: 1,
  creativeStep: 5,
  reviewStep: 8,
  status: 'idle',
  hasResult: false,
  hasRequiredUpload: false,
  ...overrides,
})

test('uses only the shared product and conversation primitives in the StudioHero visual hierarchy', () => {
  for (const component of [
    'ProductHero',
    'ProductCard',
    'ProductSteps',
    'ProductButton',
    'ProductSectionHeading',
    'ProductFlowLayout',
    'ProductSummary',
    'ConversationHeader',
    'ConversationAssistantBubble',
    'ConversationUserBubble',
    'ConversationQuestionCard',
  ]) {
    assert.match(studio, new RegExp(`<${component}`), `StudioHero should use ${component}`)
  }
  assert.match(studio, /<section data-smart-conversation/)
})

test('declares the five official StudioHero visual steps in order', () => {
  const steps = studio.slice(studio.indexOf('const STUDIO_PRODUCT_STEPS'), studio.indexOf('function logStudioHero'))
  assert.match(steps, /title: 'Objetivo'[\s\S]*title: 'Imóvel'[\s\S]*title: 'Direção'[\s\S]*title: 'Revisão'[\s\S]*title: 'Criação'/)
  assert.equal(steps.match(/\{ title:/g)?.length, 5)
  assert.match(studio, /<ProductSteps steps=\{STUDIO_PRODUCT_STEPS\} activeStep=\{studioVisualStep\}/)
})

test('maps objective, property, direction and review from the real conversation position', () => {
  assert.equal(visualStep({ step: 1 }), 1)
  assert.equal(visualStep({ step: 2 }), 2)
  assert.equal(visualStep({ step: 5 }), 3)
  assert.equal(visualStep({ step: 8, hasRequiredUpload: true }), 4)
  assert.equal(visualStep({ studioMode: 'free_ai', step: 8 }), 4)
})

test('keeps the required cinematic upload in Property until it is ready for review', () => {
  assert.equal(visualStep({ step: 8, hasRequiredUpload: false }), 2)
  assert.equal(visualStep({ step: 8, hasRequiredUpload: true }), 4)
})

test('activates Creation only after a real generation phase starts', () => {
  for (const status of ['uploading', 'generating', 'processing', 'completed', 'failed']) {
    assert.equal(visualStep({ step: 8, status, hasRequiredUpload: true }), 5, status)
  }
  assert.equal(visualStep({ step: 8, status: 'idle', hasRequiredUpload: true }), 4)
  assert.equal(visualStep({ step: 8, status: 'idle', hasRequiredUpload: true, hasResult: true }), 5)
})

test('returns to the edited visual step even after generation or result', () => {
  assert.equal(visualStep({ step: 2, status: 'failed', hasResult: true }), 2)
  assert.equal(visualStep({ step: 5, status: 'completed', hasResult: true }), 3)
})

test('derives the visual step without using the conversation percentage', () => {
  const mapping = studio.slice(studio.indexOf('const studioVisualStep'), studio.indexOf('const studioSummaryItems'))
  assert.match(mapping, /getStudioVisualStep\(\{[\s\S]*creativeStep: differentialsStep[\s\S]*reviewStep: uploadStep/)
  assert.doesNotMatch(mapping, /progressPercent|Math\.ceil/)
})

test('preserves upload, edit, generation, retry and reset callbacks', () => {
  assert.match(studio, /function FilePicker\([\s\S]*onChange=\{\(event\) => \{[\s\S]*event\.currentTarget\.blur\(\)[\s\S]*onChange\(event\.target\.files\?\.\[0\] \|\| null\)/)
  assert.match(studio, /<FilePicker[\s\S]*onChange=\{\(file\) => handleImageChange\(slot\.key, file\)\}/)
  assert.match(studio, /function StudioChecklist\([\s\S]*onClick=\{\(\) => \(label\.startsWith\('Imagem'\) \? onEditImages\(\) : onEdit\(editStep\)\)\}/)
  assert.match(studio, /<ProductButton type="button" onClick=\{onGenerate\} disabled=\{!canGenerate \|\| isGenerating\} loading=\{isGenerating\}/)
  assert.match(studio, /status === 'failed'[\s\S]*<ErrorCard[\s\S]*onEditImages=\{goToUploadStep\}/)
  assert.match(studio, /<ResultPanel[\s\S]*onReset=\{resetFlow\}/)
  assert.match(studio, /const resetFlow = \(nextMode = studioMode\) => \{/)
})

test('keeps mobile result media and the authorized download unchanged', () => {
  assert.equal(studio.match(/mediaPresentation="mobile"/g)?.length, 2)
  assert.match(studio, /aspect-\[9\/16\]/)
  assert.equal(studio.match(/smart-phone-media/g)?.length, 3)
  assert.match(studio, /className="smart-presentation-media"/)
  assert.match(studio, /as="a"[\s\S]*href=\{videoUrl\}[\s\S]*download="studio-hero-video\.mp4"/)
})

test('keeps both Gallery invitations in distinct landing and internal contexts', () => {
  const invitations = [...studio.matchAll(/<StudioGalleryInvitation \/>/g)].map(match => match.index)
  const landingStart = studio.indexOf('if (!studioMode)')
  const internalStart = studio.indexOf('\n  return (\n    <main', landingStart)

  assert.equal(invitations.length, 2)
  assert.ok(invitations[0] > landingStart && invitations[0] < internalStart)
  assert.ok(invitations[1] > internalStart)
})

test('keeps responsive containment in the StudioHero residual', () => {
  assert.match(studio, /<ProductFlowLayout[\s\S]*className="pb-12"/)
  assert.match(studio, /grid gap-4 md:grid-cols-2 xl:grid-cols-3/)
  assert.match(studio, /grid gap-4 sm:grid-cols-2/)
  assert.match(studio, /className="min-w-0 flex-1 bg-transparent/)
  assert.doesNotMatch(studio, /object-contain/)
})

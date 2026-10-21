import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const studio = readFileSync(new URL('../src/pages/StudioHero.jsx', import.meta.url), 'utf8')
const carousel = readFileSync(new URL('../src/pages/SmartCarrossel.jsx', import.meta.url), 'utf8')

test('AI Studio stores its two internal conversations under mode-specific drafts', () => {
  assert.match(studio, /productKey: getStudioModeDraftProductKey\('cinematic'\)/)
  assert.match(studio, /productKey: getStudioModeDraftProductKey\('free_ai'\)/)
  assert.match(studio, /const getModeDraft = \(mode\) => mode === 'free_ai' \? creativeDraft : commercialDraft/)
  assert.match(studio, /const storedDraft = getModeDraft\(mode\.id\)\.restore\(\)/)
  assert.match(studio, /applyStudioModeState\(mode\.id, storedDraft\)/)
})

test('Back to Studio preserves only the current mode draft, while Restart clears only that mode', () => {
  const backToStudio = studio.slice(studio.indexOf('const backToStudio ='), studio.indexOf('const selectStudioMode ='))
  const restart = studio.slice(studio.indexOf('const restartStudioMode ='), studio.indexOf('const createNewStudioVersion ='))
  assert.match(backToStudio, /saveStudioModeDraft\(studioMode\)/)
  assert.match(backToStudio, /setStudioMode\(''\)/)
  assert.doesNotMatch(backToStudio, /resetFlow/)
  assert.match(restart, /getModeDraft\(studioMode\)\.clear\(\)/)
  assert.match(restart, /resetFlow\(studioMode\)/)
  assert.match(studio, /onClick=\{status === 'completed' \? createNewStudioVersion : restartStudioMode\}/)
})

test('Ad Carousel remains on its separate route and has its own existing draft keys', () => {
  assert.match(studio, /navigate\('\/smart-carrossel'\)/)
  assert.match(carousel, /productKey: 'smart-carousel:media'/)
  assert.match(carousel, /productKey: 'smart-carousel:flow'/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const carousel = readFileSync(path.join(frontendRoot, 'src/pages/SmartCarrossel.jsx'), 'utf8')
const sharedConversation = readFileSync(path.join(frontendRoot, 'src/components/conversation/GuidedConversation.jsx'), 'utf8')

test('preserves the approved Smart Carousel sale and rental paths', () => {
  assert.match(carousel, /title=\{copy\.purpose\.sale\[0\]\}/)
  assert.match(carousel, /title=\{copy\.purpose\.rent\[0\]\}/)
  assert.match(carousel, /purpose === 'rent' \? \['Pronto para mudar'\]/)
  assert.match(carousel, /copy\.purpose\[purpose\]\[0\]/)
})

test('preserves Smart Carousel upload and generation contracts', () => {
  assert.match(carousel, /SMART_CAROUSEL_MIN_IMAGES = 5/)
  assert.match(carousel, /SMART_CAROUSEL_MAX_IMAGES = 20/)
  assert.match(carousel, /SMART_CAROUSEL_FUNCTION = 'smart-carousel-creatomate'/)
  for (const key of ['image_paths', 'cta_path', 'answers', 'share_phone']) assert.ok(carousel.includes(key))
  assert.match(carousel, /pollRenderStatus/)
})

test('preserves one active question and the lateral summary', () => {
  assert.match(sharedConversation, /Uma pergunta por vez para construir sua apresentação/)
  assert.match(sharedConversation, /Resumo da apresentação/)
  assert.match(carousel, /summaryItems\.map/)
  assert.match(carousel, /useGuidedConversation/)
  assert.match(carousel, /GuidedConversation/)
})

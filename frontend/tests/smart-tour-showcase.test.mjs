import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SMART_TOUR_EXAMPLES } from '../src/config/smartTour.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(path.join(frontendRoot, 'src/pages/SmartTourAI.jsx'), 'utf8')

test('centralizes exactly the four approved Smart Tour families in order', () => {
  assert.deepEqual(SMART_TOUR_EXAMPLES.map(example => example.id), [
    'guided-tour',
    'narrated-tour',
    'smart-staging',
    'cinematic-tour',
  ])
  for (const example of SMART_TOUR_EXAMPLES) {
    assert.equal(typeof example.title, 'string')
    assert.equal(typeof example.description, 'string')
    assert.match(example.video, /^\/smart-tour\/examples\/.+\.mp4$/)
    for (const field of ['hasNarration', 'hasTexts', 'hasPresenter', 'hasFurniture']) {
      assert.equal(typeof example[field], 'boolean')
    }
    assert.equal(example.placeholder, true)
  }
})

test('keeps showcase playback silent and inline while enabling modal controls', () => {
  assert.match(page, /autoPlay[\s\S]*?muted[\s\S]*?loop[\s\S]*?playsInline[\s\S]*?controls=\{false\}/)
  assert.match(page, /role="dialog"/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.match(page, /Demonstração anterior/)
  assert.match(page, /Próxima demonstração/)
  assert.match(page, /controlsList="nodownload noremoteplayback"/)
  assert.doesNotMatch(page, /target="_blank"/)
})

test('uses a contained mobile carousel without page-wide horizontal overflow', () => {
  assert.match(page, /overflow-x-auto overscroll-x-contain/)
  assert.match(page, /auto-cols-\[minmax\(240px,82vw\)\]/)
  assert.match(page, /lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible/)
  assert.match(page, /object-contain/)
})

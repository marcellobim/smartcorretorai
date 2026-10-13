import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SMART_CAROUSEL_CANVAS,
  buildSmartCarouselPhotoLayers,
  calculateContainedPhotoFrame,
} from './photo-layout.ts'

const cases = [
  ['horizontal 3:2', 1200, 800],
  ['horizontal 4:3', 1200, 900],
  ['square', 1200, 1200],
  ['vertical', 800, 1200],
] as const

test('contain keeps every source edge visible inside the 1080x1920 canvas', () => {
  for (const [label, sourceWidth, sourceHeight] of cases) {
    const frame = calculateContainedPhotoFrame(sourceWidth, sourceHeight)

    assert.ok(frame.x >= 0, `${label}: left edge stays in canvas`)
    assert.ok(frame.y >= 0, `${label}: top edge stays in canvas`)
    assert.ok(frame.x + frame.width <= SMART_CAROUSEL_CANVAS.width, `${label}: right edge stays in canvas`)
    assert.ok(frame.y + frame.height <= SMART_CAROUSEL_CANVAS.height, `${label}: bottom edge stays in canvas`)
    assert.deepEqual(frame.sourceVisible, { left: 0, top: 0, right: sourceWidth, bottom: sourceHeight })
  }
})

test('3:2 fixture uses contain geometry rather than a vertical cover crop', () => {
  const frame = calculateContainedPhotoFrame(1200, 800)

  assert.deepEqual(frame, {
    x: 0,
    y: 600,
    width: 1080,
    height: 720,
    scale: 0.9,
    sourceVisible: { left: 0, top: 0, right: 1200, bottom: 800 },
  })
})

test('RenderScript layers reserve cover exclusively for the decorative backdrop', () => {
  const { backgrounds, foregrounds } = buildSmartCarouselPhotoLayers(
    ['https://example.test/property.jpg'],
    { sceneDuration: 3.5, transitionDuration: 0.45 },
  )

  assert.equal(backgrounds[0].source, foregrounds[0].source)
  assert.equal(backgrounds[0].fit, 'cover')
  assert.equal(backgrounds[0].opacity, '24%')
  assert.equal(foregrounds[0].fit, 'contain')
  assert.equal(foregrounds[0].clip, false)
  assert.deepEqual(foregrounds[0].animations, [])
})

test('photo transitions remain fades and never add pan or scale motion', () => {
  const { foregrounds } = buildSmartCarouselPhotoLayers(
    ['https://example.test/one.jpg', 'https://example.test/two.jpg'],
    { sceneDuration: 3.5, transitionDuration: 0.45 },
  )

  assert.deepEqual(foregrounds[1].animations, [{
    duration: 0.45,
    easing: 'cubic-in-out',
    transition: true,
    type: 'fade',
  }])
})

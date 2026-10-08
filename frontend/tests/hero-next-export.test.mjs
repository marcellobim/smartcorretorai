import assert from 'node:assert/strict'
import test from 'node:test'
import { getHeroNextExportDimensions, isHeroNextVerticalFormat, withNineBySixteenSuffix } from '../src/lib/hero-next-export.js'

test('vertical Banner export is a true 9:16 file target while the feed stays untouched', () => {
  assert.equal(isHeroNextVerticalFormat('story_reels', 'vertical'), true)
  assert.deepEqual(getHeroNextExportDimensions('story_reels', 'vertical'), { width: 1080, height: 1920 })
  assert.equal(getHeroNextExportDimensions('instagram_feed', 'square_feed'), null)
  assert.equal(withNineBySixteenSuffix('banner.jpg'), 'banner-9x16.jpg')
})

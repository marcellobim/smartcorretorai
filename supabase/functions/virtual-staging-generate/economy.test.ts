import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveVirtualStagingVideoProductCode, VIRTUAL_STAGING_VIDEO_JOURNEY_PRODUCTS } from './economy.ts'

test('maps every active paid video journey to one canonical server-owned SKU', () => {
  assert.deepEqual(VIRTUAL_STAGING_VIDEO_JOURNEY_PRODUCTS, {
    'life-in-property': 'life_in_property',
    'broker-presentation': 'broker_presentation',
  })
  assert.equal(resolveVirtualStagingVideoProductCode('life-in-property'), 'life_in_property')
  assert.equal(resolveVirtualStagingVideoProductCode('broker-presentation'), 'broker_presentation')
})

test('null, missing and unknown journeys are rejected instead of becoming free provider calls', () => {
  for (const value of [null, undefined, '', 'furnish-renovate', 'legacy-video', 'life_in_property']) {
    assert.throws(() => resolveVirtualStagingVideoProductCode(value), /invalid_economic_product/)
  }
})

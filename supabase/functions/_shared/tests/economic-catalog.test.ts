import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ECONOMIC_CATALOG_ACTIVATED,
  ECONOMIC_CATALOG_VERSION,
  ECONOMIC_SKUS,
  MONTHLY_PLAN_GRANTS,
  PURCHASE_GRANTS,
  getEconomicSku,
  quoteEconomicSku,
} from '../economic-catalog.ts'

test('canonical catalog contains unique versioned server-side SKUs', () => {
  assert.equal(ECONOMIC_CATALOG_VERSION, '2026-08-16.phase1.v1')
  assert.equal(ECONOMIC_SKUS.length, 20)
  const keys = ECONOMIC_SKUS.map(item => `${item.productCode}:${item.variant}`)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(ECONOMIC_SKUS.every(item => item.catalogVersion === ECONOMIC_CATALOG_VERSION))
  assert.ok(ECONOMIC_SKUS.every(item => Number.isSafeInteger(item.smartTokenCost) && item.smartTokenCost > 0))
})

test('valid and invalid SKU lookup is deterministic', () => {
  assert.equal(getEconomicSku('real_estate_video', 'standard').smartTokenCost, 750)
  assert.equal(getEconomicSku('real_estate_banner', 'pieces_6').smartTokenCost, 900)
  assert.throws(() => getEconomicSku('real_estate_video', 'frontend_price_1'), /invalid_economic_sku/)
})

test('all approved phase 1 Smart Token values are registered without a Google Ads SKU', () => {
  assert.deepEqual(
    Object.fromEntries(ECONOMIC_SKUS.map(item => [`${item.productCode}:${item.variant}`, item.smartTokenCost])),
    {
      'real_estate_video:standard': 750,
      'life_in_property:standard': 800,
      'broker_presentation:standard': 800,
      'short_videos:standard': 800,
      'real_estate_commercial:standard': 275,
      'creative_video:standard': 275,
      'text_campaign:standard': 100,
      'real_estate_banner:pieces_1': 200,
      'real_estate_banner:pieces_3': 500,
      'real_estate_banner:pieces_5': 800,
      'real_estate_banner:pieces_6': 900,
      'quick_banners:static_pieces_1': 100,
      'quick_banners:static_pieces_3': 300,
      'quick_banners:static_pieces_5': 500,
      'virtual_staging:images_1': 200,
      'virtual_staging:images_3': 500,
      'virtual_staging:images_5': 800,
      'smart_carousel:photos_5': 300,
      'smart_carousel:photos_10': 500,
      'smart_carousel:photos_20': 800,
    },
  )
  assert.equal(ECONOMIC_SKUS.some(item => /google.?ads/i.test(`${item.productCode}:${item.variant}`)), false)
})

test('only the migrated text campaign SKU can be quoted while global activation remains false', () => {
  assert.equal(ECONOMIC_CATALOG_ACTIVATED, false)
  assert.deepEqual(ECONOMIC_SKUS.filter(item => item.enabled).map(item => `${item.productCode}:${item.variant}`), ['text_campaign:standard'])
  assert.equal(quoteEconomicSku('text_campaign', 'standard').smartTokenCost, 100)
  assert.throws(() => quoteEconomicSku('real_estate_video', 'standard'), /economic_catalog_not_activated/)
  assert.equal(Object.isFrozen(ECONOMIC_SKUS), true)
  assert.equal(Object.isFrozen(getEconomicSku('text_campaign', 'standard')), true)
})

test('trial eligibility and provisional pricing follow the approved model', () => {
  assert.equal(getEconomicSku('text_campaign', 'standard').trialEligible, true)
  assert.equal(getEconomicSku('quick_banners', 'static_pieces_3').trialEligible, true)
  assert.equal(getEconomicSku('real_estate_banner', 'pieces_1').trialEligible, true)
  assert.equal(getEconomicSku('virtual_staging', 'images_1').trialEligible, true)
  assert.equal(getEconomicSku('smart_carousel', 'photos_5').trialEligible, false)
  assert.equal(getEconomicSku('real_estate_video', 'standard').trialEligible, false)
  assert.equal(getEconomicSku('real_estate_banner', 'pieces_1').metadata.pricingStatus, 'provisional')
  assert.equal(getEconomicSku('virtual_staging', 'images_5').metadata.telemetryRequired, true)
})

test('plan and fixed purchase grants match the approved Scale A values', () => {
  assert.deepEqual(MONTHLY_PLAN_GRANTS, {
    start_promotional: { smartTokens: 5_350, months: 3 },
    start: { smartTokens: 6_350 },
    pro: { smartTokens: 10_850 },
    elite: { smartTokens: 26_350 },
  })
  assert.deepEqual(PURCHASE_GRANTS, {
    brl_30: { smartTokens: 1_200, validityDays: 30 },
    brl_50: { smartTokens: 2_000, validityDays: 30 },
    brl_100: { smartTokens: 4_000, validityDays: 30 },
    brl_250: { smartTokens: 10_000, validityDays: 30 },
    brl_500: { smartTokens: 20_000, validityDays: 30 },
  })
})

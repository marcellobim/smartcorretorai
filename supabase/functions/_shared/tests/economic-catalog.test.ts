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
  assert.equal(ECONOMIC_CATALOG_VERSION, '2026-08-20.virtual-staging.v1')
  assert.equal(ECONOMIC_SKUS.length, 12)
  const keys = ECONOMIC_SKUS.map(item => `${item.productCode}:${item.variant}`)
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(ECONOMIC_SKUS.every(item => item.catalogVersion === ECONOMIC_CATALOG_VERSION))
  assert.ok(ECONOMIC_SKUS.every(item => Number.isSafeInteger(item.smartTokenCost) && item.smartTokenCost > 0))
})

test('valid and invalid SKU lookup is deterministic', () => {
  assert.equal(getEconomicSku('real_estate_video', 'standard').smartTokenCost, 325)
  assert.equal(getEconomicSku('real_estate_banner', 'item').smartTokenCost, 75)
  assert.throws(() => getEconomicSku('real_estate_video', 'frontend_price_1'), /invalid_economic_sku/)
})

test('all approved phase 1 Smart Token values are registered without a Google Ads SKU', () => {
  assert.deepEqual(
    Object.fromEntries(ECONOMIC_SKUS.map(item => [`${item.productCode}:${item.variant}`, item.smartTokenCost])),
    {
      'real_estate_video:standard': 325,
      'life_in_property:standard': 325,
      'broker_presentation:standard': 325,
      'short_videos:standard': 325,
      'real_estate_commercial:standard': 120,
      'creative_video:standard': 120,
      'text_campaign:standard': 25,
      'listing_xray:analysis': 10,
      'real_estate_banner:item': 75,
      'quick_banners:item': 45,
      'virtual_staging:image': 30,
      'smart_carousel:standard': 100,
    },
  )
  assert.equal(ECONOMIC_SKUS.some(item => /google.?ads/i.test(`${item.productCode}:${item.variant}`)), false)
})

test('only migrated product SKUs can be quoted while global activation remains false', () => {
  assert.equal(ECONOMIC_CATALOG_ACTIVATED, false)
  assert.deepEqual(ECONOMIC_SKUS.filter(item => item.enabled).map(item => `${item.productCode}:${item.variant}`), ['real_estate_video:standard', 'life_in_property:standard', 'broker_presentation:standard', 'short_videos:standard', 'real_estate_commercial:standard', 'creative_video:standard', 'text_campaign:standard', 'listing_xray:analysis', 'real_estate_banner:item', 'quick_banners:item', 'virtual_staging:image', 'smart_carousel:standard'])
  assert.equal(quoteEconomicSku('text_campaign', 'standard').smartTokenCost, 25)
  assert.equal(quoteEconomicSku('real_estate_video', 'standard').smartTokenCost, 325)
  assert.equal(quoteEconomicSku('real_estate_commercial', 'standard').smartTokenCost, 120)
  assert.equal(quoteEconomicSku('creative_video', 'standard').smartTokenCost, 120)
  assert.equal(quoteEconomicSku('smart_carousel', 'standard').smartTokenCost, 100)
  assert.equal(quoteEconomicSku('virtual_staging', 'image').smartTokenCost, 30)
  assert.equal(quoteEconomicSku('listing_xray', 'analysis').smartTokenCost, 10)
  assert.equal(Object.isFrozen(ECONOMIC_SKUS), true)
  assert.equal(Object.isFrozen(getEconomicSku('text_campaign', 'standard')), true)
})

test('trial eligibility and approved Virtual Staging unit follow the approved model', () => {
  assert.equal(getEconomicSku('text_campaign', 'standard').trialEligible, true)
  assert.equal(getEconomicSku('listing_xray', 'analysis').trialEligible, true)
  assert.equal(getEconomicSku('quick_banners', 'item').trialEligible, true)
  assert.equal(quoteEconomicSku('quick_banners', 'item').smartTokenCost, 45)
  assert.equal(getEconomicSku('real_estate_banner', 'item').trialEligible, false)
  assert.equal(quoteEconomicSku('real_estate_banner', 'item').smartTokenCost, 75)
  assert.equal(getEconomicSku('virtual_staging', 'image').trialEligible, false)
  assert.equal(getEconomicSku('smart_carousel', 'standard').trialEligible, true)
  assert.equal(getEconomicSku('real_estate_video', 'standard').trialEligible, false)
  assert.equal(getEconomicSku('real_estate_banner', 'item').metadata.pricingStatus, 'approved')
  assert.equal(getEconomicSku('virtual_staging', 'image').metadata.telemetryRequired, true)
  assert.equal(getEconomicSku('virtual_staging', 'image').metadata.pricingStatus, 'approved')
  assert.equal(getEconomicSku('virtual_staging', 'image').metadata.maxImagesPerRequest, 5)
  assert.throws(() => getEconomicSku('virtual_staging', 'images_1'), /invalid_economic_sku/)
})

test('plan and fixed purchase grants match the approved Scale A values', () => {
  assert.deepEqual(MONTHLY_PLAN_GRANTS, {
    start_promotional: { smartTokens: 5_350, months: 3 },
    start: { smartTokens: 6_350, monthlyPriceBrlCents: 12_700, displayName: 'START' },
    pro: { smartTokens: 10_850, monthlyPriceBrlCents: 21_700, displayName: 'PRO' },
    elite: { smartTokens: 26_350, monthlyPriceBrlCents: 54_700, displayName: 'ELITE' },
    usd_start: { smartTokens: 6_350, monthlyPriceUsdCents: 2_490, displayName: 'START' },
    usd_pro: { smartTokens: 10_850, monthlyPriceUsdCents: 3_990, displayName: 'PRO' },
    usd_elite: { smartTokens: 26_350, monthlyPriceUsdCents: 9_990, displayName: 'ELITE' },
  })
  assert.deepEqual(PURCHASE_GRANTS, {
    brl_49_90: { smartTokens: 2_000, validityDays: 30, priceBrlCents: 4_990 },
    brl_97_90: { smartTokens: 4_000, validityDays: 30, priceBrlCents: 9_790 },
    usd_9_90: { smartTokens: 2_000, validityDays: 30, priceUsdCents: 990 },
    usd_19_90: { smartTokens: 4_000, validityDays: 30, priceUsdCents: 1_990 },
  })
})

export const ECONOMIC_CATALOG_VERSION = '2026-08-17.veo-video-family.v1'

// Global rollout stays disabled. A product can opt in only after its provider
// pipeline is migrated and its canonical SKU is explicitly enabled below.
export const ECONOMIC_CATALOG_ACTIVATED = false

export type ProviderCategory =
  | 'gemini_video'
  | 'veo_video'
  | 'openai_text'
  | 'openai_image'
  | 'creatomate'
  | 'composite'

export type EconomicSku = Readonly<{
  productCode: string
  variant: string
  smartTokenCost: number
  enabled: boolean
  trialEligible: boolean
  providerCategory: ProviderCategory
  catalogVersion: string
  metadata: Readonly<Record<string, unknown>>
}>

const sku = (
  productCode: string,
  variant: string,
  smartTokenCost: number,
  providerCategory: ProviderCategory,
  trialEligible = false,
  metadata: Record<string, unknown> = {},
  enabled = false,
): EconomicSku => Object.freeze({
  productCode,
  variant,
  smartTokenCost,
  enabled,
  trialEligible,
  providerCategory,
  catalogVersion: ECONOMIC_CATALOG_VERSION,
  metadata: Object.freeze({ pricingStatus: 'modeled', ...metadata }),
})
export const ECONOMIC_SKUS: readonly EconomicSku[] = Object.freeze([
  sku('real_estate_video', 'standard', 325, 'gemini_video', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  sku('life_in_property', 'standard', 325, 'composite', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  sku('broker_presentation', 'standard', 325, 'composite', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  sku('short_videos', 'standard', 325, 'composite', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  sku('real_estate_commercial', 'standard', 120, 'veo_video', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  sku('creative_video', 'standard', 120, 'veo_video', false, {
    pricingStatus: 'approved', telemetryRequired: true, quantity: 1,
  }, true),
  // Product 1 is activated explicitly while the global rollout remains off.
  sku('text_campaign', 'standard', 25, 'openai_text', true, {}, true),

  // Product 3 has one canonical server-owned unit. References and formats do
  // not change the quote; the validated number of final pieces does.
  sku('real_estate_banner', 'item', 75, 'openai_image', false, {
    quantity: 1,
    pricingStatus: 'approved',
    telemetryRequired: true,
    maxItemsPerRequest: 6,
    maxReferenceImages: 4,
  }, true),

  // Product 2 is quoted server-side by multiplying this canonical unit.
  // Static and video deliveries intentionally have the same public weight.
  sku('quick_banners', 'item', 45, 'composite', false, {
    quantity: 1,
    media: 'mixed',
    pricingStatus: 'approved',
    maxItemsPerRequest: 5,
  }, true),

  sku('virtual_staging', 'images_1', 200, 'openai_image', true, {
    quantity: 1,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),
  sku('virtual_staging', 'images_3', 500, 'openai_image', false, {
    quantity: 3,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),
  sku('virtual_staging', 'images_5', 800, 'openai_image', false, {
    quantity: 5,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),

  sku('smart_carousel', 'photos_5', 300, 'composite', false, { quantity: 5 }),
  sku('smart_carousel', 'photos_10', 500, 'composite', false, { quantity: 10 }),
  sku('smart_carousel', 'photos_20', 800, 'composite', false, { quantity: 20 }),
])

const SKU_INDEX = new Map(ECONOMIC_SKUS.map(item => [`${item.productCode}:${item.variant}`, item]))

export function getEconomicSku(productCode: unknown, variant: unknown): EconomicSku {
  const key = `${String(productCode ?? '').trim()}:${String(variant ?? '').trim()}`
  const item = SKU_INDEX.get(key)
  if (!item) throw new Error('invalid_economic_sku')
  return item
}

export function quoteEconomicSku(productCode: unknown, variant: unknown): EconomicSku {
  const item = getEconomicSku(productCode, variant)
  if (!ECONOMIC_CATALOG_ACTIVATED && !item.enabled) throw new Error('economic_catalog_not_activated')
  return item
}

export const MONTHLY_PLAN_GRANTS = Object.freeze({
  start_promotional: Object.freeze({ smartTokens: 5_350, months: 3 }),
  start: Object.freeze({ smartTokens: 6_350 }),
  pro: Object.freeze({ smartTokens: 10_850 }),
  elite: Object.freeze({ smartTokens: 26_350 }),
})

export const PURCHASE_GRANTS = Object.freeze({
  brl_30: Object.freeze({ smartTokens: 1_200, validityDays: 30 }),
  brl_50: Object.freeze({ smartTokens: 2_000, validityDays: 30 }),
  brl_100: Object.freeze({ smartTokens: 4_000, validityDays: 30 }),
  brl_250: Object.freeze({ smartTokens: 10_000, validityDays: 30 }),
  brl_500: Object.freeze({ smartTokens: 20_000, validityDays: 30 }),
})

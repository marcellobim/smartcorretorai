export const ECONOMIC_CATALOG_VERSION = '2026-08-20.virtual-staging.v1'

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
  sku('quick_banners', 'item', 45, 'composite', true, {
    quantity: 1,
    media: 'mixed',
    pricingStatus: 'approved',
    maxItemsPerRequest: 5,
  }, true),

  // Virtual Staging is charged per image actually delivered. The request
  // reserves imageCount * 30 before the first provider call and settles each
  // image independently.
  sku('virtual_staging', 'image', 30, 'openai_image', false, {
    quantity: 1,
    pricingStatus: 'approved',
    telemetryRequired: true,
    maxImagesPerRequest: 5,
  }, true),

  sku('smart_carousel', 'standard', 100, 'composite', true, {
    pricingStatus: 'approved', telemetryRequired: true, minImages: 5, maxImages: 20,
  }, true),
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
  start: Object.freeze({ smartTokens: 6_350, monthlyPriceBrlCents: 12_700, displayName: 'START' }),
  pro: Object.freeze({ smartTokens: 10_850, monthlyPriceBrlCents: 21_700, displayName: 'PRO' }),
  elite: Object.freeze({ smartTokens: 26_350, monthlyPriceBrlCents: 54_700, displayName: 'ELITE' }),
})

export const PURCHASE_GRANTS = Object.freeze({
  brl_49_90: Object.freeze({ smartTokens: 2_000, validityDays: 30, priceBrlCents: 4_990 }),
  brl_97_90: Object.freeze({ smartTokens: 4_000, validityDays: 30, priceBrlCents: 9_790 }),
})

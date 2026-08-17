export const ECONOMIC_CATALOG_VERSION = '2026-08-16.phase1.v1'

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
  sku('real_estate_video', 'standard', 750, 'gemini_video'),
  sku('life_in_property', 'standard', 800, 'composite'),
  sku('broker_presentation', 'standard', 800, 'composite'),
  sku('short_videos', 'standard', 800, 'composite'),
  sku('real_estate_commercial', 'standard', 275, 'veo_video'),
  sku('creative_video', 'standard', 275, 'veo_video'),
  // Product 1 is the only SKU activated while the global rollout remains off.
  sku('text_campaign', 'standard', 100, 'openai_text', true, {}, true),

  sku('real_estate_banner', 'pieces_1', 200, 'openai_image', true, {
    quantity: 1,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),
  sku('real_estate_banner', 'pieces_3', 500, 'openai_image', false, {
    quantity: 3,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),
  sku('real_estate_banner', 'pieces_5', 800, 'openai_image', false, {
    quantity: 5,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),
  sku('real_estate_banner', 'pieces_6', 900, 'openai_image', false, {
    quantity: 6,
    pricingStatus: 'provisional',
    telemetryRequired: true,
  }),

  sku('quick_banners', 'static_pieces_1', 100, 'composite', true, { quantity: 1, media: 'static' }),
  sku('quick_banners', 'static_pieces_3', 300, 'composite', true, { quantity: 3, media: 'static' }),
  sku('quick_banners', 'static_pieces_5', 500, 'composite', false, { quantity: 5, media: 'static' }),

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

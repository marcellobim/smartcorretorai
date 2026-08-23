import type { GeminiVideoProductCode } from '../_shared/gemini-video-economy.ts'

export const VIRTUAL_STAGING_VIDEO_JOURNEY_PRODUCTS = Object.freeze({
  'life-in-property': 'life_in_property',
  'broker-presentation': 'broker_presentation',
} as const satisfies Record<string, GeminiVideoProductCode>)

export type VirtualStagingVideoJourneyId = keyof typeof VIRTUAL_STAGING_VIDEO_JOURNEY_PRODUCTS

export function resolveVirtualStagingVideoProductCode(journeyId: unknown): GeminiVideoProductCode {
  const normalized = typeof journeyId === 'string' ? journeyId.trim() : ''
  const productCode = VIRTUAL_STAGING_VIDEO_JOURNEY_PRODUCTS[normalized as VirtualStagingVideoJourneyId]
  if (!productCode) throw new Error('invalid_economic_product')
  return productCode
}

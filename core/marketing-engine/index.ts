export type MarketingEngineInput = Record<string, unknown>
export type MarketingEngineOutput = Record<string, unknown>

export const marketingEngineStatus = {
  name: 'marketing-engine',
  implemented: false,
  integrated: false,
} as const

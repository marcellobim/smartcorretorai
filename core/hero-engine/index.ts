export type HeroEngineInput = Record<string, unknown>
export type HeroEngineOutput = Record<string, unknown>

export const heroEngineStatus = {
  name: 'hero-engine',
  implemented: false,
  integrated: false,
} as const

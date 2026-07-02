export type FactEngineInput = Record<string, unknown>
export type FactEngineOutput = Record<string, unknown>

export const factEngineStatus = {
  name: 'fact-engine',
  implemented: false,
  integrated: false,
} as const

export type CopyEngineInput = Record<string, unknown>
export type CopyEngineOutput = Record<string, unknown>

export const copyEngineStatus = {
  name: 'copy-engine',
  implemented: false,
  integrated: false,
} as const

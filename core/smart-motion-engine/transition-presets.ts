import type { SmartTransitionPreset } from './schema.ts'

export const SMART_TRANSITION_PRESETS: SmartTransitionPreset[] = [
  'fade',
  'crossfade',
  'fadeblack',
  'smoothleft',
  'smoothup',
]

export function normalizeTransitionPreset(value: unknown, fallback: SmartTransitionPreset = 'fade'): SmartTransitionPreset {
  return SMART_TRANSITION_PRESETS.includes(value as SmartTransitionPreset)
    ? value as SmartTransitionPreset
    : fallback
}

export function toFfmpegXfadeTransition(preset: SmartTransitionPreset): string {
  if (preset === 'crossfade') return 'fade'
  return preset
}

import type { SmartMotionPreset } from './schema.ts'

type MotionFilterInput = {
  width: number
  height: number
  fps: number
  seconds: number
}

export const SMART_MOTION_PRESETS: SmartMotionPreset[] = [
  'zoom_in',
  'zoom_out',
  'pan_left',
  'pan_right',
  'pan_up',
  'pan_down',
  'subtle_rotate',
  'stable',
]

export function normalizeMotionPreset(value: unknown, fallback: SmartMotionPreset = 'zoom_in'): SmartMotionPreset {
  return SMART_MOTION_PRESETS.includes(value as SmartMotionPreset)
    ? value as SmartMotionPreset
    : fallback
}

export function buildMotionFilter(preset: SmartMotionPreset, input: MotionFilterInput): string {
  const frames = Math.max(1, Math.round(input.seconds * input.fps))
  const progress = `on/${frames}`
  const centerX = 'iw/2-(iw/zoom/2)'
  const centerY = 'ih/2-(ih/zoom/2)'

  const expressions: Record<SmartMotionPreset, { z: string; x: string; y: string; extra?: string }> = {
    zoom_in: {
      z: `min(1.12,1+0.12*${progress})`,
      x: centerX,
      y: centerY,
    },
    zoom_out: {
      z: `max(1.0,1.12-0.12*${progress})`,
      x: centerX,
      y: centerY,
    },
    pan_left: {
      z: '1.08',
      x: `(iw-iw/zoom)*(1-${progress})`,
      y: centerY,
    },
    pan_right: {
      z: '1.08',
      x: `(iw-iw/zoom)*${progress}`,
      y: centerY,
    },
    pan_up: {
      z: '1.08',
      x: centerX,
      y: `(ih-ih/zoom)*(1-${progress})`,
    },
    pan_down: {
      z: '1.08',
      x: centerX,
      y: `(ih-ih/zoom)*${progress}`,
    },
    subtle_rotate: {
      z: `min(1.08,1+0.05*${progress})`,
      x: centerX,
      y: centerY,
      extra: `rotate='0.008*sin(2*PI*t/${input.seconds})':fillcolor=black@0,scale=${input.width}:${input.height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${input.width}:${input.height}`,
    },
    stable: {
      z: '1.0001',
      x: centerX,
      y: centerY,
    },
  }

  const motion = expressions[preset] || expressions.zoom_in
  const base = [
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${input.width}:${input.height}`,
  ]

  if (motion.extra) base.push(motion.extra)

  base.push(`zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=${frames}:s=${input.width}x${input.height}:fps=${input.fps}`)
  return base.join(',')
}

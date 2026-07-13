import type { SmartMotionPlan, SmartMotionScenePlan } from './schema.ts'
import { SMART_MOTION_DEFAULTS } from './schema.ts'
import { buildMotionFilter } from './motion-presets.ts'
import { toFfmpegXfadeTransition } from './transition-presets.ts'
import { escapeFfmpegFilterPath } from './sanitize.ts'
import {
  buildCommercialTypographyFilters,
  type CommercialTypographyFilterInput,
} from './commercial-typography.ts'

export function buildEncodeArgs(outputSegment: string, plan: Pick<SmartMotionPlan, 'fps'>): string[] {
  return [
    '-r', String(plan.fps),
    '-c:v', SMART_MOTION_DEFAULTS.videoCodec,
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', SMART_MOTION_DEFAULTS.pixelFormat,
    '-movflags', '+faststart',
    outputSegment,
  ]
}

export function buildSceneFilter(input: {
  scene: SmartMotionScenePlan
  plan: SmartMotionPlan
  fontFile: string
  typography?: Omit<CommercialTypographyFilterInput, 'fontFile' | 'startSeconds' | 'endSeconds'>
}): string {
  const { scene, plan, fontFile } = input
  const motion = buildMotionFilter(scene.motion, {
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    seconds: scene.durationSeconds,
  })
  const fadeOutStart = Math.max(0, scene.durationSeconds - 0.22).toFixed(2)
  const font = escapeFfmpegFilterPath(fontFile)

  const base = [
    motion,
    'eq=contrast=1.035:saturation=1.015:brightness=-0.002',
    `fade=t=in:st=0:d=0.18`,
    `fade=t=out:st=${fadeOutStart}:d=0.22`,
  ]

  if (input.typography && (scene.kind === 'cta' || scene.caption)) {
    base.push(...buildCommercialTypographyFilters({
      ...input.typography,
      fontFile,
      startSeconds: 0,
      endSeconds: scene.durationSeconds,
    }))
    if (scene.kind === 'cta') {
      base.push(`drawtext=fontfile='${font}':text='SMARTCORRETORAI':fontcolor=white@0.62:fontsize=27:x=(w-text_w)/2:y=h-92`)
    }
  }

  base.push(`format=${SMART_MOTION_DEFAULTS.pixelFormat}`)
  return base.join(',')
}

export function buildCrossfadeArgs(input: {
  segments: Array<{ file: string; durationSeconds: number; transition: string }>
  targetFile: string
  transitionSeconds: number
}): string[] {
  const { segments, targetFile, transitionSeconds } = input
  if (segments.length === 1) {
    return ['-y', '-i', segments[0].file, '-c', 'copy', targetFile]
  }

  const args = ['-y']
  for (const segment of segments) args.push('-i', segment.file)

  const filters: string[] = []
  let previousLabel = '[0:v]'
  let currentDuration = segments[0].durationSeconds

  for (let index = 1; index < segments.length; index += 1) {
    const outLabel = index === segments.length - 1 ? '[vout]' : `[v${index}]`
    const offset = Math.max(0, currentDuration - transitionSeconds)
    const transition = toFfmpegXfadeTransition(segments[index - 1].transition as never)
    filters.push(`${previousLabel}[${index}:v]xfade=transition=${transition}:duration=${transitionSeconds}:offset=${offset.toFixed(2)}${outLabel}`)
    previousLabel = outLabel
    currentDuration = currentDuration + segments[index].durationSeconds - transitionSeconds
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    '-c:v', SMART_MOTION_DEFAULTS.videoCodec,
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', SMART_MOTION_DEFAULTS.pixelFormat,
    '-movflags', '+faststart',
    targetFile,
  )
  return args
}

export function buildNormalizedMusicFilter(input: {
  inputLabel?: string
  outputLabel?: string
  durationSeconds: number
  fadeInSeconds?: number
  fadeOutSeconds?: number
  volumeLevel?: number
}) {
  const duration = Math.max(0.1, input.durationSeconds)
  const fadeInSeconds = Math.min(Math.max(0, input.fadeInSeconds ?? 1.2), duration / 4)
  const fadeOutSeconds = Math.min(Math.max(0, input.fadeOutSeconds ?? 2), duration / 3)
  const fadeOutStart = Math.max(0, duration - fadeOutSeconds)
  const volumeLevel = Math.min(1, Math.max(0, input.volumeLevel ?? 1))
  const inputLabel = input.inputLabel || '1:a'
  const outputLabel = input.outputLabel || 'music'
  const audioFilter = [
    `atrim=0:${duration.toFixed(3)}`,
    'asetpts=N/SR/TB',
    'loudnorm=I=-23:LRA=7:TP=-2',
    `volume=${volumeLevel.toFixed(3)}`,
    `afade=t=in:st=0:d=${fadeInSeconds.toFixed(3)}`,
    `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOutSeconds.toFixed(3)}`,
    'aresample=48000',
    'aformat=sample_rates=48000:channel_layouts=stereo',
  ].join(',')
  return `[${inputLabel}]${audioFilter}[${outputLabel}]`
}

export function buildMusicArgs(input: {
  videoFile: string
  musicFile: string
  outputFile: string
  durationSeconds: number
}): string[] {
  const duration = Math.max(0.1, input.durationSeconds)
  const audioFilter = buildNormalizedMusicFilter({
    durationSeconds: duration,
    fadeInSeconds: 0,
    outputLabel: 'aout',
  })

  return [
    '-y',
    '-i', input.videoFile,
    '-stream_loop', '-1',
    '-i', input.musicFile,
    '-filter_complex', audioFilter,
    '-map', '0:v:0',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-t', duration.toFixed(3),
    '-shortest',
    '-movflags', '+faststart',
    input.outputFile,
  ]
}

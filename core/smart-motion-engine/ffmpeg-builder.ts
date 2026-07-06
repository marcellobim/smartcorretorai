import type { SmartMotionPlan, SmartMotionScenePlan } from './schema.ts'
import { SMART_MOTION_DEFAULTS } from './schema.ts'
import { buildMotionFilter } from './motion-presets.ts'
import { toFfmpegXfadeTransition } from './transition-presets.ts'
import { escapeFfmpegFilterPath } from './sanitize.ts'

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
  captionFile: string
  fontFile: string
}): string {
  const { scene, plan, captionFile, fontFile } = input
  const motion = buildMotionFilter(scene.motion, {
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    seconds: scene.durationSeconds,
  })
  const fadeOutStart = Math.max(0, scene.durationSeconds - 0.22).toFixed(2)
  const font = escapeFfmpegFilterPath(fontFile)
  const caption = escapeFfmpegFilterPath(captionFile)

  const base = [
    motion,
    'eq=contrast=1.035:saturation=1.015:brightness=-0.002',
    `fade=t=in:st=0:d=0.18`,
    `fade=t=out:st=${fadeOutStart}:d=0.22`,
  ]

  if (scene.kind === 'cta') {
    const strongCta = plan.ctaMode === 'strong'
    const subtleCta = plan.ctaMode === 'subtle'
    base.push(
      `drawbox=x=0:y=0:w=iw:h=ih:color=black@${subtleCta ? '0.18' : '0.30'}:t=fill`,
      `drawbox=x=${strongCta ? 70 : 112}:y=ih-${strongCta ? 690 : 620}:w=iw-${strongCta ? 140 : 224}:h=${strongCta ? 400 : 315}:color=black@${strongCta ? '0.62' : '0.48'}:t=fill`,
      `drawbox=x=${strongCta ? 70 : 112}:y=ih-${strongCta ? 690 : 620}:w=iw-${strongCta ? 140 : 224}:h=4:color=white@0.84:t=fill`,
      `drawtext=fontfile='${font}':textfile='${caption}':fontcolor=white:fontsize=${strongCta ? 82 : 66}:line_spacing=14:x=(w-text_w)/2:y=h-${strongCta ? 595 : 535}`,
      `drawbox=x=238:y=ih-270:w=iw-476:h=82:color=white@${subtleCta ? '0.82' : '0.94'}:t=fill`,
      `drawtext=fontfile='${font}':text='SMARTCORRETORAI':fontcolor=black@0.90:fontsize=30:x=(w-text_w)/2:y=h-244`,
    )
  } else if (scene.caption) {
    const compactText = plan.rhythm === 'fast' || plan.rhythm === 'direct'
    const textAlpha = plan.visualIntensity === 'high' ? '0.42' : '0.32'
    base.push(
      `drawbox=x=${compactText ? 142 : 112}:y=h-${compactText ? 350 : 405}:w=iw-${compactText ? 284 : 224}:h=${compactText ? 104 : 128}:color=black@${textAlpha}:t=fill`,
      `drawbox=x=${compactText ? 142 : 112}:y=h-${compactText ? 350 : 405}:w=iw-${compactText ? 284 : 224}:h=3:color=white@0.58:t=fill`,
      `drawtext=fontfile='${font}':textfile='${caption}':fontcolor=white@0.95:fontsize=${compactText ? 44 : 48}:line_spacing=8:x=(w-text_w)/2:y=h-${compactText ? 312 : 358}`,
    )
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

export function buildMusicArgs(input: {
  videoFile: string
  musicFile: string
  outputFile: string
}): string[] {
  return [
    '-y',
    '-i', input.videoFile,
    '-stream_loop', '-1',
    '-i', input.musicFile,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    input.outputFile,
  ]
}

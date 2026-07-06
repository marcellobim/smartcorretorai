import { SMART_MOTION_DEFAULTS, type SmartMotionPlan, type SmartMotionRenderReport } from './schema.ts'

export function createSmartMotionReport(input: {
  plan: SmartMotionPlan
  outputPath: string
  reportPath?: string
  ffmpegPath: string
  musicApplied: boolean
}): SmartMotionRenderReport {
  const transitionLoss = Math.max(0, input.plan.scenes.length - 1) * input.plan.transitionSeconds
  const durationSeconds = input.plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) - transitionLoss

  return {
    engine: 'smart-motion-engine',
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    outputPath: input.outputPath,
    reportPath: input.reportPath,
    outputType: input.plan.outputType,
    visualModelId: input.plan.visualModelId,
    rhythm: input.plan.rhythm,
    visualIntensity: input.plan.visualIntensity,
    width: input.plan.width,
    height: input.plan.height,
    fps: input.plan.fps,
    codec: SMART_MOTION_DEFAULTS.videoCodec,
    sceneCount: input.plan.scenes.length,
    durationSeconds: Number(durationSeconds.toFixed(2)),
    ctaUsed: input.plan.ctaEnabled,
    ctaText: input.plan.scenes.find((scene) => scene.kind === 'cta')?.caption || '',
    musicApplied: input.musicApplied,
    musicPath: input.musicApplied ? input.plan.musicPath : undefined,
    warnings: input.plan.warnings,
    imagesUsed: Array.from(new Set(input.plan.scenes.map((scene) => scene.imagePath))),
    source: {
      reusedFromPoc: true,
      ffmpegPath: input.ffmpegPath,
    },
    scenes: input.plan.scenes.map((scene, index) => ({
      index: index + 1,
      kind: scene.kind,
      imagePath: scene.imagePath,
      caption: scene.caption,
      motion: scene.motion,
      transition: scene.transition,
      durationSeconds: scene.durationSeconds,
    })),
  }
}

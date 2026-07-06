import {
  SMART_MOTION_DEFAULTS,
  type SmartMotionInput,
  type SmartMotionPlan,
} from './schema.ts'
import { normalizeMotionPreset, SMART_MOTION_PRESETS } from './motion-presets.ts'
import { normalizeTransitionPreset, SMART_TRANSITION_PRESETS } from './transition-presets.ts'
import { sanitizeCaption, sanitizeCta, sanitizePositiveNumber } from './sanitize.ts'
import { getDeterministicModelItem, getSmartVisualModel, SMART_VISUAL_MODELS } from './visual-models.ts'

export function createSmartMotionPlan(input: SmartMotionInput): SmartMotionPlan {
  if (!input || typeof input !== 'object') {
    throw new Error('smart_motion_input_required')
  }

  if (!input.outputPath || typeof input.outputPath !== 'string') {
    throw new Error('output_path_required')
  }

  const outputType = input.outputType || 'motion_video'
  if (outputType !== 'motion_video') {
    throw new Error(`output_type_not_implemented:${outputType}`)
  }

  const rawScenes = Array.isArray(input.scenes) ? input.scenes : []
  if (rawScenes.length < 1) {
    throw new Error('at_least_one_image_required')
  }

  const width = Math.round(sanitizePositiveNumber(input.width, SMART_MOTION_DEFAULTS.width, 320, 4096))
  const height = Math.round(sanitizePositiveNumber(input.height, SMART_MOTION_DEFAULTS.height, 320, 4096))
  const fps = Math.round(sanitizePositiveNumber(input.fps, SMART_MOTION_DEFAULTS.fps, 12, 60))
  const visualModel = getSmartVisualModel(input.visualModelId)
  const warnings: string[] = []
  const slideSeconds = sanitizePositiveNumber(input.slideSeconds, visualModel.averageSceneSeconds, 1, 12)
  const ctaSeconds = sanitizePositiveNumber(input.ctaSeconds, visualModel.ctaSeconds, 1, 8)
  const transitionSeconds = sanitizePositiveNumber(input.transitionSeconds, visualModel.transitionSeconds, 0.1, 2)
  const captionsEnabled = input.captionsEnabled ?? visualModel.captionsDefault
  const ctaText = sanitizeCta(input.cta)
  const ctaEnabled = input.ctaEnabled !== false && Boolean(ctaText)
  if (!ctaEnabled) warnings.push('cta_disabled_or_empty')
  if (input.visualModelId && input.visualModelId !== visualModel.id) warnings.push(`visual_model_fallback:${visualModel.id}`)

  const scenes = rawScenes.map((scene, index) => {
    if (!scene?.imagePath || typeof scene.imagePath !== 'string') {
      throw new Error(`scene_${index + 1}_image_path_required`)
    }

    const motionFallback = getDeterministicModelItem(visualModel.allowedMotions, index)
    const transitionFallback = getDeterministicModelItem(visualModel.allowedTransitions, index)
    const motion = normalizeMotionPreset(scene.motion, motionFallback)
    const transition = normalizeTransitionPreset(scene.transition, transitionFallback)

    return {
      kind: 'image' as const,
      imagePath: scene.imagePath,
      caption: captionsEnabled ? sanitizeCaption(scene.caption) : '',
      motion: visualModel.allowedMotions.includes(motion) ? motion : motionFallback,
      transition: visualModel.allowedTransitions.includes(transition) ? transition : transitionFallback,
      durationSeconds: sanitizePositiveNumber(scene.durationSeconds, slideSeconds, 1, 12),
    }
  })

  if (ctaEnabled) {
    const lastScene = scenes[scenes.length - 1]
    scenes.push({
      kind: 'cta',
      imagePath: lastScene.imagePath,
      caption: ctaText,
      motion: visualModel.ctaMode === 'strong' ? 'zoom_in' : 'stable',
      transition: visualModel.ctaMode === 'subtle' ? 'crossfade' : 'fadeblack',
      durationSeconds: ctaSeconds,
    })
  }

  return {
    outputType,
    visualModelId: visualModel.id,
    rhythm: visualModel.rhythm,
    visualIntensity: visualModel.visualIntensity,
    ctaMode: visualModel.ctaMode,
    width,
    height,
    fps,
    slideSeconds,
    ctaSeconds,
    transitionSeconds,
    outputPath: input.outputPath,
    reportPath: input.reportPath,
    musicPath: input.musicPath,
    captionsEnabled,
    ctaEnabled,
    warnings,
    scenes,
  }
}

export function getSmartMotionCapabilities() {
  return {
    motions: SMART_MOTION_PRESETS,
    transitions: SMART_TRANSITION_PRESETS,
    visualModels: SMART_VISUAL_MODELS,
    defaults: SMART_MOTION_DEFAULTS,
  }
}

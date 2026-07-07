import {
  SMART_MOTION_DEFAULTS,
  type SmartMotionInput,
  type SmartMotionPlan,
  type StudioHeroMotionPlan,
  type StudioHeroMotionPlanInput,
} from './schema.ts'
import { normalizeMotionPreset, SMART_MOTION_PRESETS } from './motion-presets.ts'
import { normalizeTransitionPreset, SMART_TRANSITION_PRESETS } from './transition-presets.ts'
import { sanitizeCaption, sanitizeCta, sanitizePositiveNumber } from './sanitize.ts'
import { getDeterministicModelItem, getSmartVisualModel, SMART_VISUAL_MODELS } from './visual-models.ts'

const STUDIO_HERO_MOTION_CLIP_SECONDS = 4 as const
const STUDIO_HERO_MOTION_MIN_IMAGES = 1
const STUDIO_HERO_MOTION_MAX_IMAGES = 9

function sanitizeMotionToken(value: unknown, fallback: string, maxLength = 64) {
  const clean = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

  return clean || fallback
}

function buildStudioHeroMotionPrompt(input: {
  pairLabel: string
  fidelityMode: string
  movement: string
  lighting: string
  atmosphere: string
  rhythm: string
  cinematicEffects: string
}) {
  return [
    'Create a vertical 9:16 cinematic motion video.',
    '',
    `Use ${input.pairLabel}.`,
    `Duration: ${STUDIO_HERO_MOTION_CLIP_SECONDS} seconds.`,
    '',
    'Preserve the real property identity, architecture, layout, furniture, materials, colors and proportions.',
    'Keep the result realistic and visually coherent with the uploaded property images.',
    '',
    'Visual direction:',
    `- fidelity mode: ${input.fidelityMode}`,
    `- camera movement: ${input.movement}`,
    `- lighting: ${input.lighting}`,
    `- atmosphere: ${input.atmosphere}`,
    `- rhythm: ${input.rhythm}`,
    `- cinematic effects: ${input.cinematicEffects}`,
    '',
    'Use smooth transitions, natural depth, subtle parallax, consistent exposure and coherent color grading.',
    'Maintain realistic scale, stable geometry and continuous camera flow.',
  ].join('\n')
}

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

export function createStudioHeroMotionPlan(input: StudioHeroMotionPlanInput): StudioHeroMotionPlan {
  if (!input || typeof input !== 'object') {
    throw new Error('studio_hero_motion_input_required')
  }

  const imagePaths = Array.isArray(input.imagePaths)
    ? input.imagePaths.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (imagePaths.length < STUDIO_HERO_MOTION_MIN_IMAGES) {
    throw new Error('studio_hero_motion_at_least_one_image_required')
  }

  if (imagePaths.length > STUDIO_HERO_MOTION_MAX_IMAGES) {
    throw new Error('studio_hero_motion_max_9_images')
  }

  const uniqueImagePaths = new Set(imagePaths)
  const warnings: string[] = []
  if (uniqueImagePaths.size !== imagePaths.length) {
    warnings.push('duplicate_image_paths_preserved_in_order')
  }

  const neutralFramePath = String(input.neutralFramePath || 'system/studio-hero/motion/neutral-final-frame.png').trim()
  const fidelityMode = sanitizeMotionToken(input.fidelityMode, 'HIGH_FIDELITY')
  const movement = sanitizeMotionToken(input.movement, 'smooth cinematic camera movement')
  const lighting = sanitizeMotionToken(input.lighting, 'soft premium natural light')
  const atmosphere = sanitizeMotionToken(input.atmosphere, 'clean cinematic real estate atmosphere')
  const rhythm = sanitizeMotionToken(input.rhythm, 'calm balanced motion')
  const cinematicEffects = sanitizeMotionToken(input.cinematicEffects, 'subtle depth, reflections and light sweep')

  const jobs = []
  for (let index = 0; index < imagePaths.length - 1; index += 1) {
    jobs.push({
      index: index + 1,
      role: 'motion_pair' as const,
      from: imagePaths[index],
      to: imagePaths[index + 1],
      durationSeconds: STUDIO_HERO_MOTION_CLIP_SECONDS,
      prompt: buildStudioHeroMotionPrompt({
        pairLabel: `image ${index + 1} as the opening frame and image ${index + 2} as the ending frame`,
        fidelityMode,
        movement,
        lighting,
        atmosphere,
        rhythm,
        cinematicEffects,
      }),
    })
  }

  jobs.push({
    index: imagePaths.length,
    role: 'neutral_final' as const,
    from: imagePaths[imagePaths.length - 1],
    to: neutralFramePath,
    durationSeconds: STUDIO_HERO_MOTION_CLIP_SECONDS,
    prompt: buildStudioHeroMotionPrompt({
      pairLabel: `image ${imagePaths.length} as the opening frame and a blank neutral white frame as the ending frame`,
      fidelityMode,
      movement,
      lighting,
      atmosphere,
      rhythm,
      cinematicEffects,
    }),
  })

  return {
    mode: 'studio_hero_motion',
    jobId: input.jobId,
    userId: input.userId,
    imageCount: imagePaths.length,
    durationSecondsPerClip: STUDIO_HERO_MOTION_CLIP_SECONDS,
    totalDurationSeconds: jobs.length * STUDIO_HERO_MOTION_CLIP_SECONDS,
    neutralFrame: {
      type: 'neutral_blank_frame',
      path: neutralFramePath,
      hasText: false,
      description: 'Frame branco/neutro final, sem texto, logo, marca, CTA ou elemento comercial.',
    },
    jobs,
    warnings,
  }
}

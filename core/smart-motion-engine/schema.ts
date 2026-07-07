export const SMART_MOTION_DEFAULTS = {
  width: 1080,
  height: 1920,
  fps: 30,
  slideSeconds: 3.4,
  ctaSeconds: 3,
  transitionSeconds: 0.62,
  videoCodec: 'libx264',
  pixelFormat: 'yuv420p',
} as const

export type SmartMediaOutputType =
  | 'motion_video'
  | 'enhanced_images'
  | 'animated_images'
  | 'full_video'

export type SmartVisualModelId =
  | 'clean_showcase'
  | 'social_impact'
  | 'luxury_soft'
  | 'rental_direct'

export type SmartMotionPreset =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'pan_down'
  | 'subtle_rotate'
  | 'stable'

export type SmartTransitionPreset =
  | 'fade'
  | 'crossfade'
  | 'fadeblack'
  | 'smoothleft'
  | 'smoothup'

export type SmartMotionSceneInput = {
  imagePath: string
  caption?: string
  motion?: SmartMotionPreset
  transition?: SmartTransitionPreset
  durationSeconds?: number
}

export type SmartMotionInput = {
  outputType?: SmartMediaOutputType
  visualModelId?: SmartVisualModelId
  scenes: SmartMotionSceneInput[]
  outputPath: string
  reportPath?: string
  musicPath?: string
  cta?: string
  ctaEnabled?: boolean
  captionsEnabled?: boolean
  width?: number
  height?: number
  fps?: number
  slideSeconds?: number
  ctaSeconds?: number
  transitionSeconds?: number
}

export type SmartMotionScenePlan = Required<Pick<SmartMotionSceneInput, 'imagePath' | 'motion' | 'transition'>> & {
  caption: string
  durationSeconds: number
  kind: 'image' | 'cta'
}

export type SmartMotionPlan = {
  outputType: SmartMediaOutputType
  visualModelId: SmartVisualModelId
  rhythm: 'calm' | 'balanced' | 'fast' | 'direct'
  visualIntensity: 'low' | 'medium' | 'high'
  ctaMode: 'subtle' | 'standard' | 'strong'
  width: number
  height: number
  fps: number
  slideSeconds: number
  ctaSeconds: number
  transitionSeconds: number
  outputPath: string
  reportPath?: string
  musicPath?: string
  captionsEnabled: boolean
  ctaEnabled: boolean
  warnings: string[]
  scenes: SmartMotionScenePlan[]
}

export type SmartMotionRenderReport = {
  engine: 'smart-motion-engine'
  version: '0.1.0'
  generatedAt: string
  outputPath: string
  reportPath?: string
  outputType: SmartMediaOutputType
  visualModelId: SmartVisualModelId
  rhythm: string
  visualIntensity: string
  width: number
  height: number
  fps: number
  codec: string
  sceneCount: number
  durationSeconds: number
  ctaUsed: boolean
  ctaText: string
  musicApplied: boolean
  musicPath?: string
  warnings: string[]
  imagesUsed: string[]
  source: {
    reusedFromPoc: boolean
    ffmpegPath: string
  }
  scenes: Array<{
    index: number
    kind: 'image' | 'cta'
    imagePath: string
    caption: string
    motion: SmartMotionPreset
    transition: SmartTransitionPreset
    durationSeconds: number
  }>
}

export type SmartMotionRenderResult = {
  outputPath: string
  reportPath?: string
  report: SmartMotionRenderReport
}

export type StudioHeroMotionPreset =
  | 'high_fidelity'
  | 'light_transformation'

export type StudioHeroMotionPlanInput = {
  imagePaths: string[]
  neutralFramePath?: string
  jobId?: string
  userId?: string
  fidelityMode?: StudioHeroMotionPreset
  movement?: string
  lighting?: string
  atmosphere?: string
  rhythm?: string
  cinematicEffects?: string
}

export type StudioHeroMotionJobPlan = {
  index: number
  role: 'motion_pair' | 'neutral_final'
  from: string
  to: string
  durationSeconds: 4
  prompt: string
}

export type StudioHeroMotionPlan = {
  mode: 'studio_hero_motion'
  jobId?: string
  userId?: string
  imageCount: number
  durationSecondsPerClip: 4
  totalDurationSeconds: number
  neutralFrame: {
    type: 'neutral_blank_frame'
    path: string
    hasText: false
    description: string
  }
  jobs: StudioHeroMotionJobPlan[]
  warnings: string[]
}

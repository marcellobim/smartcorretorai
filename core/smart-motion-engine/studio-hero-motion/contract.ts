export type StudioHeroMotionAspectRatio = '9:16' | '1:1' | '4:5' | '16:9'

export type StudioHeroMotionOutputKind =
  | 'main_reel'
  | 'smart_clip'
  | 'campaign_texts'

export type StudioHeroMotionEffectKind =
  | 'stabilize'
  | 'zoom'
  | 'speed_ramp'
  | 'color_grade'
  | 'transition'
  | 'caption'
  | 'future_effect'

export type StudioHeroMotionTextTag = {
  id: string
  label: string
  text: string
  startSeconds: number
  endSeconds: number
  style?: 'headline' | 'subtitle' | 'badge' | 'cta' | 'metadata'
}

export type StudioHeroMotionCut = {
  id: string
  sourceStartSeconds: number
  sourceEndSeconds: number
  outputStartSeconds?: number
  outputEndSeconds?: number
  label?: string
  keepAudio?: boolean
  textTags?: StudioHeroMotionTextTag[]
  effects?: StudioHeroMotionEffect[]
}

export type StudioHeroMotionEffect = {
  id: string
  kind: StudioHeroMotionEffectKind
  targetCutId?: string
  startSeconds?: number
  endSeconds?: number
  intensity?: 'low' | 'medium' | 'high'
  params?: Record<string, unknown>
}

export type StudioHeroMotionCta = {
  text: string
  startSeconds?: number
  endSeconds?: number
  visualStyle?: 'clean' | 'strong' | 'premium' | 'direct'
}

export type StudioHeroMotionMainReel = {
  id: string
  title: string
  aspectRatio: StudioHeroMotionAspectRatio
  targetDurationSeconds: number
  cuts: StudioHeroMotionCut[]
  ctaFinal: StudioHeroMotionCta
  effects?: StudioHeroMotionEffect[]
}

export type StudioHeroMotionSmartClip = {
  id: string
  title: string
  aspectRatio: StudioHeroMotionAspectRatio
  targetDurationSeconds: number
  cuts: StudioHeroMotionCut[]
  tags?: string[]
  ctaFinal?: StudioHeroMotionCta
  effects?: StudioHeroMotionEffect[]
}

export type StudioHeroMotionCampaignTextPackage = {
  headline: string
  shortCaption: string
  longCaption?: string
  whatsappMessage?: string
  hashtags: string[]
  cta: string
}

export type StudioHeroMotionSourceVideo = {
  id: string
  fileName: string
  mimeType?: 'video/mp4' | 'video/quicktime' | 'video/webm' | string
  durationSeconds?: number
}

export type StudioHeroMotionCampaignBrief = {
  objective: 'sale' | 'rent' | 'property_capture' | 'broker_capture' | 'generic'
  propertyType?: string
  city?: string
  district?: string
  keyFeatures?: string[]
  tone?: 'direct' | 'premium' | 'emotional' | 'social'
}

export type StudioHeroBrainSmartMotionContract = {
  contractVersion: 'studio_hero_motion.v1'
  requestId: string
  source: 'studio_hero_brain'
  target: 'smart_motion_engine'
  sourceVideo: StudioHeroMotionSourceVideo
  campaignBrief: StudioHeroMotionCampaignBrief
  mainReel: StudioHeroMotionMainReel
  smartClips: StudioHeroMotionSmartClip[]
  campaignTexts: StudioHeroMotionCampaignTextPackage
  metadata?: Record<string, unknown>
}

export type StudioHeroMotionValidationResult = {
  ok: boolean
  errors: string[]
}

export type StudioHeroMotionActionType =
  | 'cut_segment'
  | 'apply_text'
  | 'apply_zoom'
  | 'apply_effect'
  | 'generate_reel'
  | 'generate_smart_clip'
  | 'generate_campaign_texts'

export type StudioHeroMotionMockAction = {
  order: number
  type: StudioHeroMotionActionType
  targetId: string
  label: string
  payload: Record<string, unknown>
}

export type StudioHeroMotionMockExecutionResult = {
  requestId: string
  engine: 'smart_motion_engine'
  mode: 'mock_plan_only'
  actions: StudioHeroMotionMockAction[]
}

import type { ShortVideosRequest, SmartTourGenerationConfig, SmartTourRequest } from './types.ts'
const MODES = new Set(['guided_tour','narrated_tour','smart_staging','cinematic_tour'])
const LANGUAGES = new Set(['pt-BR','en-US','es'])
const clean = (value: unknown, max = 160) => String(value ?? '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0,max)

export function normalizeGeneration(value: Partial<SmartTourGenerationConfig>): SmartTourGenerationConfig {
  const mode = MODES.has(String(value.mode)) ? value.mode as SmartTourGenerationConfig['mode'] : 'narrated_tour'
  const language = LANGUAGES.has(String(value.language)) ? value.language as SmartTourGenerationConfig['language'] : 'pt-BR'
  const normalized: SmartTourGenerationConfig = { mode, language, presenterGender: 'none', presenterSpeechMode: 'automatic', presenterCustomSpeech: '', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only' }
  if (mode === 'guided_tour') normalized.presenterGender = value.presenterGender === 'female' || value.presenterGender === 'male' ? value.presenterGender : 'none'
  else if (mode !== 'narrated_tour') normalized.presenterGender = value.presenterGender === 'female' || value.presenterGender === 'male' ? value.presenterGender : 'none'
  normalized.narration = value.narration === 'disabled' ? 'disabled' : mode === 'cinematic_tour' && value.narration !== 'enabled' ? 'disabled' : 'enabled'
  if (value.presenterSpeechMode === 'custom') {
    normalized.presenterSpeechMode = 'custom'
    normalized.presenterCustomSpeech = typeof value.presenterCustomSpeech === 'string' ? value.presenterCustomSpeech : ''
    normalized.narration = 'enabled'
  }
  normalized.captions = value.captions === 'disabled' ? 'disabled' : 'enabled'
  normalized.furniture = 'original'
  normalized.stagingPresentation = 'final_only'
  return normalized
}

export function validateSmartTourRequest(input: unknown): SmartTourRequest {
  if (!input || typeof input !== 'object') throw new Error('invalid_request')
  const raw = input as Record<string, unknown>
  const paths = Array.isArray(raw.imagePaths) ? raw.imagePaths.map(item => clean(item,300)).filter(Boolean) : []
  const order = Array.isArray(raw.imageOrder) ? raw.imageOrder.map(item => clean(item,300)).filter(Boolean) : []
  if (!paths.length || paths.length > 5 || new Set(paths).size !== paths.length) throw new Error('invalid_image_count')
  if (order.length !== paths.length || order.some((path,index) => path !== paths[index])) throw new Error('invalid_image_order')
  const propertyRaw = raw.property && typeof raw.property === 'object' ? raw.property as Record<string, unknown> : {}
  const highlights = Array.isArray(propertyRaw.highlights) ? propertyRaw.highlights.map(item => clean(item,80)).filter(Boolean).slice(0,10) : []
  const property = Object.fromEntries(Object.entries(propertyRaw).filter(([key]) => key !== 'highlights').map(([key,value]) => [key,clean(value,key === 'description' ? 1000 : 120)]))
  const generation = normalizeGeneration(raw.generation as Partial<SmartTourGenerationConfig> || {})
  if (generation.presenterSpeechMode === 'custom') {
    const wordCount = String(generation.presenterCustomSpeech ?? '').trim().split(/\s+/).filter(Boolean).length
    if (wordCount < 1 || wordCount > 25) throw new Error('invalid_presenter_custom_speech')
  }
  return { clientRequestId: clean(raw.clientRequestId,80), imagePaths: paths, imageOrder: order, property: { ...property, highlights }, generation, selectedCta: clean(raw.selectedCta,120), includeProfessionalPhone: raw.includeProfessionalPhone === true, showProfessionalIdentity: raw.showProfessionalIdentity === true, language: LANGUAGES.has(String(raw.language)) ? raw.language as SmartTourRequest['language'] : 'pt-BR' }
}

export function validateShortVideosRequest(input: unknown): ShortVideosRequest {
  if (!input || typeof input !== 'object') throw new Error('invalid_request')
  const raw = input as Record<string, unknown>
  if (raw.inputFlow !== 'short-videos') throw new Error('invalid_input_flow')
  const videoPath = clean(raw.videoPath, 300)
  if (!videoPath || !/\.mp4$/i.test(videoPath)) throw new Error('invalid_video_path')
  const metadata = raw.videoMetadata && typeof raw.videoMetadata === 'object' ? raw.videoMetadata as Record<string, unknown> : {}
  const durationSeconds = Number(metadata.durationSeconds)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300) throw new Error('invalid_video_duration')
  if (metadata.mimeType !== 'video/mp4') throw new Error('invalid_video_type')
  const propertyRaw = raw.property && typeof raw.property === 'object' ? raw.property as Record<string, unknown> : {}
  const highlights = Array.isArray(propertyRaw.highlights) ? propertyRaw.highlights.map(item => clean(item,80)).filter(Boolean).slice(0,10) : []
  const property = Object.fromEntries(Object.entries(propertyRaw).filter(([key]) => key !== 'highlights').map(([key,value]) => [key,clean(value,key === 'description' ? 1000 : 120)]))
  return {
    inputFlow: 'short-videos',
    clientRequestId: clean(raw.clientRequestId,80),
    videoPath,
    videoMetadata: { durationSeconds, mimeType: 'video/mp4' },
    property: { ...property, highlights },
    generation: { ...normalizeGeneration(raw.generation as Partial<SmartTourGenerationConfig> || {}), presenterGender: 'none' },
    selectedCta: clean(raw.selectedCta,120),
    includeProfessionalPhone: raw.includeProfessionalPhone === true,
    showProfessionalIdentity: raw.showProfessionalIdentity === true,
    language: LANGUAGES.has(String(raw.language)) ? raw.language as ShortVideosRequest['language'] : 'pt-BR',
  }
}

export const OFFICIAL_MATRIX: SmartTourGenerationConfig[] = [
  ...(['female','male'] as const).map(presenterGender => normalizeGeneration({mode:'guided_tour',presenterGender})),
  normalizeGeneration({mode:'narrated_tour'}),
  ...(['original','virtual_staging'] as const).flatMap(furniture => (furniture === 'original' ? ['final_only'] : ['final_only','before_after']).flatMap(stagingPresentation => ['enabled','disabled'].flatMap(narration => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'smart_staging',furniture,stagingPresentation: stagingPresentation as 'final_only'|'before_after',narration: narration as 'enabled'|'disabled',captions: captions as 'enabled'|'disabled'}))))),
  ...(['original','virtual_staging'] as const).flatMap(furniture => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'cinematic_tour',furniture,captions: captions as 'enabled'|'disabled'}))),
]

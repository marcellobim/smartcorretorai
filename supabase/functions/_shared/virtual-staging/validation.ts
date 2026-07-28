import type { LifeScene, PresenterReference, PropertyContext, PropertyImages, SmartTourGenerationConfig, SmartTourRequest } from './types.ts'
const MODES = new Set(['guided_tour','narrated_tour','smart_staging','cinematic_tour'])
const LANGUAGES = new Set(['pt-BR','en-US','es'])
const LIFE_SCENES = new Set<LifeScene>(['young','young_dog','young_cat','adult','adult_dog','adult_cat','senior','senior_dog','senior_cat'])
const clean = (value: unknown, max = 160) => String(value ?? '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0,max)
const FURNISH_RENOVATE_MODULE = 'furnish-renovate'
const BROKER_PRESENTATION_MODULE = 'broker-presentation'
const FURNISH_VIDEO_MODES = new Set(['complete-transformation', 'visual-only'])
const FURNISH_NARRATED_CTAS = new Set(['Saiba mais', 'Agende sua visita', 'Entre em contato', 'Conheça este imóvel', 'Solicite mais informações'])

function readPropertyImages(raw: Record<string, unknown>) {
  const value = raw.property_images && typeof raw.property_images === 'object' && !Array.isArray(raw.property_images) ? raw.property_images as Record<string, unknown> : null
  const imagePaths = Array.isArray(value?.image_paths) ? value.image_paths.map(item => clean(item,300)).filter(Boolean) : []
  const imageOrder = Array.isArray(value?.image_order) ? value.image_order.map(item => clean(item,300)).filter(Boolean) : []
  return { value, imagePaths, imageOrder }
}

function validateBrokerFiles(raw: Record<string, unknown>, paths: string[], order: string[]) {
  if (raw.module !== BROKER_PRESENTATION_MODULE) {
    if (raw.presenter_reference !== undefined) throw new Error('invalid_presenter_reference')
    if (raw.module !== FURNISH_RENOVATE_MODULE && raw.property_images !== undefined) throw new Error('invalid_property_images')
    return {}
  }
  const referenceRaw = raw.presenter_reference && typeof raw.presenter_reference === 'object' && !Array.isArray(raw.presenter_reference) ? raw.presenter_reference as Record<string, unknown> : null
  const propertyImages = readPropertyImages(raw)
  const imagePath = clean(referenceRaw?.image_path, 300)
  if (!referenceRaw || referenceRaw.enabled !== true || referenceRaw.source !== 'temporary_upload' || referenceRaw.purpose !== 'identity_reference' || !imagePath || !/\.(jpg|jpeg|png)$/i.test(imagePath)) throw new Error('invalid_presenter_reference')
  if (!propertyImages.value || propertyImages.imagePaths.length !== paths.length || propertyImages.imagePaths.some((path,index) => path !== paths[index]) || propertyImages.imageOrder.length !== order.length || propertyImages.imageOrder.some((path,index) => path !== order[index]) || paths.includes(imagePath)) throw new Error('invalid_property_images')
  return {
    module: BROKER_PRESENTATION_MODULE as const,
    presenter_reference: { enabled: true, source: 'temporary_upload', purpose: 'identity_reference', image_path: imagePath } as PresenterReference,
    property_images: { image_paths: [...paths], image_order: [...order] } as PropertyImages,
  }
}

function validateFurnishRenovate(raw: Record<string, unknown>, paths: string[], order: string[], property: PropertyContext) {
  if (raw.module !== FURNISH_RENOVATE_MODULE) return null
  const propertyImages = readPropertyImages(raw)
  if (!propertyImages.value || propertyImages.imagePaths.some((path,index) => path !== paths[index]) || propertyImages.imageOrder.some((path,index) => path !== order[index])) throw new Error('invalid_property_images')
  const transformationStyle = clean(raw.transformationStyle, 80)
  const videoMode = clean(raw.videoMode, 40)
  const narratedCta = clean(raw.narratedCta, 80)
  if (!transformationStyle) throw new Error('invalid_transformation_style')
  if (!FURNISH_VIDEO_MODES.has(videoMode)) throw new Error('invalid_video_mode')
  if (raw.presenter_reference !== undefined) throw new Error('invalid_presenter_reference')
  if (raw.selectedCta || raw.includeProfessionalPhone === true || raw.phone || raw.texts || raw.captions) throw new Error('invalid_furnish_output')
  if (videoMode === 'visual-only') {
    if (raw.narrationEnabled !== undefined || raw.narratedCta !== undefined || Object.keys(property).some(key => key === 'highlights' ? (property.highlights || []).length > 0 : Boolean(property[key as keyof PropertyContext]))) throw new Error('invalid_visual_only_context')
  } else {
    if (raw.narrationEnabled !== true || !property.purpose || !property.stage || !property.type || !property.district || !property.city || !FURNISH_NARRATED_CTAS.has(narratedCta)) throw new Error('invalid_complete_transformation')
  }
  return {
    module: FURNISH_RENOVATE_MODULE as const,
    property_images: { image_paths: [...paths], image_order: [...order] } as PropertyImages,
    transformationStyle,
    videoMode: videoMode as 'complete-transformation' | 'visual-only',
    ...(videoMode === 'complete-transformation' ? { narrationEnabled: true as const, narratedCta } : {}),
  }
}

export function normalizeGeneration(value: Partial<SmartTourGenerationConfig>): SmartTourGenerationConfig {
  const mode = MODES.has(String(value.mode)) ? value.mode as SmartTourGenerationConfig['mode'] : 'narrated_tour'
  const language = LANGUAGES.has(String(value.language)) ? value.language as SmartTourGenerationConfig['language'] : 'pt-BR'
  const normalized: SmartTourGenerationConfig = { mode, language, presenterGender: 'none', narration: 'enabled', captions: 'enabled', furniture: 'original', stagingPresentation: 'final_only' }
  if (mode === 'guided_tour') normalized.presenterGender = value.presenterGender === 'none' ? 'none' : value.presenterGender === 'male' ? 'male' : 'female'
  else if (mode !== 'narrated_tour') normalized.presenterGender = value.presenterGender === 'female' || value.presenterGender === 'male' ? value.presenterGender : 'none'
  normalized.narration = value.narration === 'disabled' ? 'disabled' : mode === 'cinematic_tour' && value.narration !== 'enabled' ? 'disabled' : 'enabled'
  normalized.captions = value.captions === 'disabled' ? 'disabled' : 'enabled'
  normalized.furniture = 'original'
  normalized.stagingPresentation = 'final_only'
  if (value.life_scene !== undefined) {
    if (!LIFE_SCENES.has(value.life_scene as LifeScene)) throw new Error('invalid_life_scene')
    normalized.life_scene = value.life_scene as LifeScene
  }
  return normalized
}

export function validateSmartTourRequest(input: unknown): SmartTourRequest {
  if (!input || typeof input !== 'object') throw new Error('invalid_request')
  const raw = input as Record<string, unknown>
  const furnishImages = raw.module === FURNISH_RENOVATE_MODULE ? readPropertyImages(raw) : null
  const paths = furnishImages ? furnishImages.imagePaths : Array.isArray(raw.imagePaths) ? raw.imagePaths.map(item => clean(item,300)).filter(Boolean) : []
  const order = furnishImages ? furnishImages.imageOrder : Array.isArray(raw.imageOrder) ? raw.imageOrder.map(item => clean(item,300)).filter(Boolean) : []
  const maxImages = raw.module === FURNISH_RENOVATE_MODULE ? 4 : 5
  if (!paths.length || paths.length > maxImages || new Set(paths).size !== paths.length) throw new Error('invalid_image_count')
  if (order.length !== paths.length || order.some((path,index) => path !== paths[index])) throw new Error('invalid_image_order')
  const propertyRaw = raw.property && typeof raw.property === 'object' ? raw.property as Record<string, unknown> : {}
  const highlights = Array.isArray(propertyRaw.highlights) ? propertyRaw.highlights.map(item => clean(item,80)).filter(Boolean).slice(0,raw.module === FURNISH_RENOVATE_MODULE ? 3 : 10) : []
  const property = Object.fromEntries(Object.entries(propertyRaw).filter(([key]) => key !== 'highlights').map(([key,value]) => [key,clean(value,key === 'description' ? 1000 : 120)]))
  const generationInput = raw.generation && typeof raw.generation === 'object' && !Array.isArray(raw.generation) ? raw.generation as Partial<SmartTourGenerationConfig> : {}
  const furnishMode = raw.videoMode === 'complete-transformation' ? 'enabled' : 'disabled'
  const generation = normalizeGeneration(raw.module === FURNISH_RENOVATE_MODULE ? { mode: 'guided_tour', presenterGender: 'none', narration: furnishMode, captions: 'disabled', language: raw.language as SmartTourGenerationConfig['language'] } : generationInput)
  const brokerFiles = validateBrokerFiles(raw, paths, order)
  const furnishContract = validateFurnishRenovate(raw, paths, order, { ...property, highlights })
  if (generation.mode === 'narrated_tour' && !generation.life_scene) throw new Error('invalid_life_scene')
  if (raw.module !== undefined && ![FURNISH_RENOVATE_MODULE, BROKER_PRESENTATION_MODULE].includes(String(raw.module))) throw new Error('invalid_module')
  return { clientRequestId: clean(raw.clientRequestId,80), imagePaths: paths, imageOrder: order, property: { ...property, highlights }, generation, selectedCta: raw.module === FURNISH_RENOVATE_MODULE ? '' : clean(raw.selectedCta,120), includeProfessionalPhone: raw.module === FURNISH_RENOVATE_MODULE ? false : raw.includeProfessionalPhone === true, language: LANGUAGES.has(String(raw.language)) ? raw.language as SmartTourRequest['language'] : 'pt-BR', ...(furnishContract || {}), ...brokerFiles }
}

export const OFFICIAL_MATRIX: SmartTourGenerationConfig[] = [
  ...(['female','male'] as const).map(presenterGender => normalizeGeneration({mode:'guided_tour',presenterGender})),
  normalizeGeneration({mode:'narrated_tour'}),
  ...(['original','virtual_staging'] as const).flatMap(furniture => (furniture === 'original' ? ['final_only'] : ['final_only','before_after']).flatMap(stagingPresentation => ['enabled','disabled'].flatMap(narration => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'smart_staging',furniture,stagingPresentation: stagingPresentation as 'final_only'|'before_after',narration: narration as 'enabled'|'disabled',captions: captions as 'enabled'|'disabled'}))))),
  ...(['original','virtual_staging'] as const).flatMap(furniture => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'cinematic_tour',furniture,captions: captions as 'enabled'|'disabled'}))),
]

import type { LifeScene, PresenterReference, PropertyImages, SmartTourGenerationConfig, SmartTourRequest } from './types.ts'
const MODES = new Set(['guided_tour','narrated_tour','smart_staging','cinematic_tour'])
const LANGUAGES = new Set(['pt-BR','en-US','es'])
const LIFE_SCENES = new Set<LifeScene>(['young','young_dog','young_cat','adult','adult_dog','adult_cat','senior','senior_dog','senior_cat'])
const clean = (value: unknown, max = 160) => String(value ?? '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0,max)
const BROKER_PRESENTATION_MODULE = 'broker-presentation'
const PAID_VIDEO_JOURNEYS = new Set(['life-in-property', 'broker-presentation'])

function readPropertyImages(raw: Record<string, unknown>) {
  const value = raw.property_images && typeof raw.property_images === 'object' && !Array.isArray(raw.property_images) ? raw.property_images as Record<string, unknown> : null
  const imagePaths = Array.isArray(value?.image_paths) ? value.image_paths.map(item => clean(item,300)).filter(Boolean) : []
  const imageOrder = Array.isArray(value?.image_order) ? value.image_order.map(item => clean(item,300)).filter(Boolean) : []
  return { value, imagePaths, imageOrder }
}

function validateBrokerFiles(raw: Record<string, unknown>, paths: string[], order: string[]) {
  if (raw.module !== BROKER_PRESENTATION_MODULE) {
    if (raw.presenter_reference !== undefined) throw new Error('invalid_presenter_reference')
    if (raw.property_images !== undefined) throw new Error('invalid_property_images')
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
  const suppliedJourneyId = clean(raw.journeyId, 80)
  if (Object.prototype.hasOwnProperty.call(raw, 'journeyId') && !PAID_VIDEO_JOURNEYS.has(suppliedJourneyId)) throw new Error('invalid_economic_product')
  if (raw.module !== undefined && raw.module !== BROKER_PRESENTATION_MODULE) throw new Error('invalid_module')
  const paths = Array.isArray(raw.imagePaths) ? raw.imagePaths.map(item => clean(item,300)).filter(Boolean) : []
  const order = Array.isArray(raw.imageOrder) ? raw.imageOrder.map(item => clean(item,300)).filter(Boolean) : []
  const maxImages = 5
  if (!paths.length || paths.length > maxImages || new Set(paths).size !== paths.length) throw new Error('invalid_image_count')
  if (order.length !== paths.length || order.some((path,index) => path !== paths[index])) throw new Error('invalid_image_order')
  const propertyRaw = raw.property && typeof raw.property === 'object' ? raw.property as Record<string, unknown> : {}
  const rawHighlights = Array.isArray(propertyRaw.highlights) ? propertyRaw.highlights.map(item => clean(item,80)).filter(Boolean) : []
  const highlights = rawHighlights.slice(0,10)
  const property = Object.fromEntries(Object.entries(propertyRaw).filter(([key]) => key !== 'highlights').map(([key,value]) => [key,clean(value,key === 'description' ? 1000 : 120)]))
  const generationInput = raw.generation && typeof raw.generation === 'object' && !Array.isArray(raw.generation) ? raw.generation as Partial<SmartTourGenerationConfig> : {}
  const generation = normalizeGeneration(generationInput)
  const brokerFiles = validateBrokerFiles(raw, paths, order)
  if (generation.mode === 'narrated_tour' && !generation.life_scene) throw new Error('invalid_life_scene')
  const derivedJourneyId = raw.module === BROKER_PRESENTATION_MODULE
    ? 'broker-presentation'
    : generation.mode === 'narrated_tour' && generation.life_scene
      ? 'life-in-property'
      : ''
  const journeyId = suppliedJourneyId || derivedJourneyId
  if (journeyId && !PAID_VIDEO_JOURNEYS.has(journeyId)) throw new Error('invalid_economic_product')
  if (journeyId === 'life-in-property' && (generation.mode !== 'narrated_tour' || !generation.life_scene || raw.module !== undefined)) throw new Error('invalid_life_scene')
  if (journeyId === 'broker-presentation' && (generation.mode !== 'guided_tour' || raw.module !== BROKER_PRESENTATION_MODULE)) throw new Error('invalid_presenter_reference')
  return { ...(journeyId ? { journeyId: journeyId as SmartTourRequest['journeyId'] } : {}), clientRequestId: clean(raw.clientRequestId,80), imagePaths: paths, imageOrder: order, property: { ...property, highlights }, generation, selectedCta: clean(raw.selectedCta,120), includeProfessionalPhone: raw.includeProfessionalPhone === true, language: LANGUAGES.has(String(raw.language)) ? raw.language as SmartTourRequest['language'] : 'pt-BR', ...brokerFiles }
}

export const OFFICIAL_MATRIX: SmartTourGenerationConfig[] = [
  ...(['female','male'] as const).map(presenterGender => normalizeGeneration({mode:'guided_tour',presenterGender})),
  normalizeGeneration({mode:'narrated_tour'}),
  ...(['original','virtual_staging'] as const).flatMap(furniture => (furniture === 'original' ? ['final_only'] : ['final_only','before_after']).flatMap(stagingPresentation => ['enabled','disabled'].flatMap(narration => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'smart_staging',furniture,stagingPresentation: stagingPresentation as 'final_only'|'before_after',narration: narration as 'enabled'|'disabled',captions: captions as 'enabled'|'disabled'}))))),
  ...(['original','virtual_staging'] as const).flatMap(furniture => ['enabled','disabled'].map(captions => normalizeGeneration({mode:'cinematic_tour',furniture,captions: captions as 'enabled'|'disabled'}))),
]

export type GenerationMode = 'guided_tour' | 'narrated_tour' | 'smart_staging' | 'cinematic_tour'
export type PresenterGender = 'female' | 'male' | 'none'
export type ToggleMode = 'enabled' | 'disabled'
export type FurnitureMode = 'original' | 'virtual_staging'
export type StagingPresentation = 'final_only' | 'before_after'
export type SupportedLanguage = 'pt-BR' | 'en-US' | 'es'
export type LifeScene = 'young' | 'young_dog' | 'young_cat' | 'adult' | 'adult_dog' | 'adult_cat' | 'senior' | 'senior_dog' | 'senior_cat'
export type VirtualStagingModule = 'broker-presentation'
export type VirtualStagingVideoJourneyId = 'life-in-property' | 'broker-presentation'
export interface PresenterReference { enabled: true; source: 'temporary_upload'; purpose: 'identity_reference'; image_path: string }
export interface PropertyImages { image_paths: string[]; image_order: string[] }
export interface SmartTourGenerationConfig { mode: GenerationMode; presenterGender: PresenterGender; narration: ToggleMode; captions: ToggleMode; furniture: FurnitureMode; stagingPresentation: StagingPresentation; language: SupportedLanguage; life_scene?: LifeScene; presenterSpeechMode?: 'generated' | 'custom'; presenterCustomSpeech?: string }
export interface PropertyContext { purpose?: string; stage?: string; type?: string; bedrooms?: string; suites?: string; parkingSpaces?: string; area?: string; state?: string; city?: string; district?: string; neighborhood?: string; price?: string; condominium?: string; iptu?: string; highlights?: string[]; description?: string }
export interface SmartTourRequest { journeyId?: VirtualStagingVideoJourneyId; clientRequestId: string; imagePaths: string[]; imageOrder: string[]; property: PropertyContext; generation: SmartTourGenerationConfig; selectedCta: string; includeProfessionalPhone: boolean; language: SupportedLanguage; module?: VirtualStagingModule; presenter_reference?: PresenterReference; property_images?: PropertyImages }

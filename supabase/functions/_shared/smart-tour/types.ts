export type GenerationMode = 'guided_tour' | 'narrated_tour' | 'smart_staging' | 'cinematic_tour'
export type PresenterGender = 'female' | 'male' | 'none'
export type ToggleMode = 'enabled' | 'disabled'
export type PresenterSpeechMode = 'automatic' | 'custom'
export type FurnitureMode = 'original' | 'virtual_staging'
export type StagingPresentation = 'final_only' | 'before_after'
export type SupportedLanguage = 'pt-BR' | 'en-US' | 'es'
export type SupportedMarket = 'BR' | 'US'
export type ProfessionalIdentitySelection = { enabled: boolean; name_source?: 'real' | 'display'; credential_source?: 'br_creci' | 'us_license' }
export interface SmartTourGenerationConfig { mode: GenerationMode; presenterGender: PresenterGender; presenterSpeechMode?: PresenterSpeechMode; presenterCustomSpeech?: string; narration: ToggleMode; captions: ToggleMode; furniture: FurnitureMode; stagingPresentation: StagingPresentation; language: SupportedLanguage }
export interface PropertyContext { purpose?: string; stage?: string; type?: string; bedrooms?: string; suites?: string; bathrooms?: string; parkingSpaces?: string; area?: string; state?: string; county?: string; city?: string; district?: string; zipCode?: string; neighborhoodCommunity?: string; price?: string; condominium?: string; iptu?: string; hoa?: string; propertyTaxes?: string; highlights?: string[]; description?: string }
export interface SmartTourRequest { clientRequestId: string; imagePaths: string[]; imageOrder: string[]; property: PropertyContext; generation: SmartTourGenerationConfig; selectedCta: string; includeProfessionalPhone: boolean; professional_identity: ProfessionalIdentitySelection; language: SupportedLanguage; market: SupportedMarket }
export interface ShortVideosRequest {
  inputFlow: 'short-videos'
  clientRequestId: string
  videoPath: string
  videoMetadata: { durationSeconds: number; mimeType: 'video/mp4' }
  property: PropertyContext
  generation: SmartTourGenerationConfig
  selectedCta: string
  includeProfessionalPhone: boolean
  showProfessionalIdentity: boolean
  language: SupportedLanguage
  market: SupportedMarket
}

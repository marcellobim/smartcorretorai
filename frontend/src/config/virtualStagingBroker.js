export const BROKER_PRESENTATION_JOURNEY_ID = 'broker-presentation'

export const BROKER_PRESENTER_REFERENCE_SOURCE = 'temporary_upload'
export const BROKER_PRESENTER_REFERENCE_PURPOSE = 'identity_reference'

export const BROKER_REFERENCE_OPTIONS = Object.freeze([
  { id: 'yes', label: 'Sim' },
  { id: 'no', label: 'Não' },
])
export const BROKER_SPEECH_OPTIONS = Object.freeze([
  { id: 'generated', label: 'Criar uma fala para mim' },
  { id: 'custom', label: 'Escrever minha própria fala' },
])
export const BROKER_CUSTOM_SPEECH_MAX_WORDS = 25

const PRESENTER_REFERENCE_TYPES = new Set(['image/jpeg', 'image/png'])
const PRESENTER_REFERENCE_MAX_BYTES = 15 * 1024 * 1024

export function validatePresenterReferenceSelection(files) {
  const selected = Array.from(files || [])
  if (selected.length !== 1) return { file: null, error: 'presenterPhotoCount' }
  const [file] = selected
  if (!PRESENTER_REFERENCE_TYPES.has(file.type) || !file.size || file.size > PRESENTER_REFERENCE_MAX_BYTES) {
    return { file: null, error: 'presenterPhotoFormat' }
  }
  return { file, error: '' }
}

export function buildBrokerPresentationGenerationPayload({ captions, presenterSpeechMode = 'generated', presenterCustomSpeech = '', language = 'pt-BR' }) {
  return {
    mode: 'guided_tour',
    presenterGender: 'none',
    narration: 'enabled',
    captions: captions === 'disabled' ? 'disabled' : 'enabled',
    furniture: 'original',
    stagingPresentation: 'final_only',
    language: language === 'en-US' ? 'en-US' : 'pt-BR',
    presenterSpeechMode: presenterSpeechMode === 'custom' ? 'custom' : 'generated',
    presenterCustomSpeech: presenterSpeechMode === 'custom' ? presenterCustomSpeech : '',
  }
}

export function buildBrokerPresentationFilePayload({ presenterReferencePath, propertyImagePaths }) {
  return {
    module: BROKER_PRESENTATION_JOURNEY_ID,
    presenter_reference: {
      enabled: true,
      source: BROKER_PRESENTER_REFERENCE_SOURCE,
      purpose: BROKER_PRESENTER_REFERENCE_PURPOSE,
      image_path: presenterReferencePath,
    },
    property_images: {
      image_paths: [...propertyImagePaths],
      image_order: [...propertyImagePaths],
    },
  }
}

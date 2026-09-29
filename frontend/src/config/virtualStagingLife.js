export const LIFE_IN_PROPERTY_JOURNEY_ID = 'life-in-property'

export const LIFE_RENTAL_STAGE_OPTIONS = Object.freeze([
  'Pronto para morar',
  'Disponível já',
  'Vago',
])

export const LIFE_SCENE_OPTIONS = Object.freeze([
  { id: 'young', label: 'Jovens' },
  { id: 'young_dog', label: 'Jovens com cachorro' },
  { id: 'young_cat', label: 'Jovens com gato' },
  { id: 'adult', label: 'Adultos' },
  { id: 'adult_dog', label: 'Adultos com cachorro' },
  { id: 'adult_cat', label: 'Adultos com gato' },
  { id: 'senior', label: 'Idosos' },
  { id: 'senior_dog', label: 'Idosos com cachorro' },
  { id: 'senior_cat', label: 'Idosos com gato' },
])

const LIFE_SCENE_IDS = new Set(LIFE_SCENE_OPTIONS.map(option => option.id))

export function getLifeSceneLabel(lifeScene) {
  return LIFE_SCENE_OPTIONS.find(option => option.id === lifeScene)?.label || ''
}

export function buildLifeInPropertyGenerationPayload({ lifeScene, captions, language = 'pt-BR' }) {
  return {
    mode: 'narrated_tour',
    narration: 'enabled',
    captions: captions === 'disabled' ? 'disabled' : 'enabled',
    furniture: 'original',
    stagingPresentation: 'final_only',
    language: language === 'en-US' ? 'en-US' : 'pt-BR',
    life_scene: LIFE_SCENE_IDS.has(lifeScene) ? lifeScene : '',
  }
}

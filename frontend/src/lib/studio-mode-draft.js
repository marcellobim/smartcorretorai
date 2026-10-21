import { restoreProductDraftShape } from './product-draft.js'

export const STUDIO_MODE_DRAFT_SCHEMA_VERSION = 1

const MODE_PRODUCT_KEYS = Object.freeze({
  cinematic: 'studio-ia:commercial',
  free_ai: 'studio-ia:creative',
})

export function getStudioModeDraftProductKey(mode) {
  return MODE_PRODUCT_KEYS[mode] || MODE_PRODUCT_KEYS.cinematic
}

export function createStudioModeDraft({ answers, step, manualCityMode }) {
  return {
    answers,
    step: Number.isInteger(step) && step > 0 ? step : 1,
    manualCityMode: Boolean(manualCityMode),
  }
}

export function restoreStudioModeDraft({ initialAnswers, mode, storedDraft }) {
  const storedAnswers = storedDraft && typeof storedDraft === 'object'
    ? storedDraft.answers
    : null
  const restoredAnswers = restoreProductDraftShape(initialAnswers, storedAnswers)

  return {
    answers: {
      ...restoredAnswers,
      creativeMode: mode === 'free_ai' ? 'free_ai' : 'cinematic',
    },
    step: Number.isInteger(storedDraft?.step) && storedDraft.step > 0 ? storedDraft.step : 1,
    manualCityMode: Boolean(storedDraft?.manualCityMode),
  }
}

export function isStudioModeDraftMeaningful({ answers, step }) {
  if (Number(step) > 1) return true
  return Object.entries(answers || {}).some(([key, value]) => {
    if (key === 'creativeMode' || key === 'professionalIdentity') return false
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  })
}

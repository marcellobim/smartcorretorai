import { LIFE_IN_PROPERTY_JOURNEY_ID } from './virtualStagingLife.js'
import { BROKER_PRESENTATION_JOURNEY_ID } from './virtualStagingBroker.js'
import { FURNISH_RENOVATE_JOURNEY_ID, furnishRenovateRequiresStyle } from './virtualStagingFurnish.js'

const LINEAR_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'narration',
  narration: 'captions',
  captions: 'cta_enabled',
  cta: 'phone',
  phone: 'review',
})

const LIFE_IN_PROPERTY_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'life_scene',
  life_scene: 'captions',
  captions: 'cta',
  cta: 'phone',
  phone: 'review',
})

const BROKER_PRESENTATION_NEXT_QUESTION = Object.freeze({
  presenter_reference: 'presenter_photo',
  presenter_photo: 'images',
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'presenter_speech_mode',
  presenter_custom_speech: 'captions',
  highlights: 'captions',
  captions: 'cta_enabled',
  cta_enabled: 'cta',
  cta: 'phone',
  phone: 'review',
})

const FURNISH_RENOVATE_NEXT_QUESTION = Object.freeze({
  transformation_type: 'decoration_style',
  decoration_style: 'images',
  images: 'review',
})

export function getVirtualStagingNextQuestion({ questionId, answerId = '', mode = '', journeyId = '' }) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) {
    if (questionId === 'transformation_type') return furnishRenovateRequiresStyle(answerId) ? 'decoration_style' : 'images'
    return FURNISH_RENOVATE_NEXT_QUESTION[questionId] || 'review'
  }
  if (journeyId === LIFE_IN_PROPERTY_JOURNEY_ID) return LIFE_IN_PROPERTY_NEXT_QUESTION[questionId] || 'review'
  if (journeyId === BROKER_PRESENTATION_JOURNEY_ID) {
    if (questionId === 'presenter_reference') return answerId === 'yes' ? 'presenter_photo' : 'presenter_reference_required'
    if (questionId === 'presenter_speech_mode') return answerId === 'custom' ? 'presenter_custom_speech' : 'highlights'
    if (questionId === 'cta_enabled') return answerId === 'yes' ? 'cta' : 'phone'
    return BROKER_PRESENTATION_NEXT_QUESTION[questionId] || 'review'
  }
  if (questionId === 'cta_enabled') return answerId === 'yes' ? 'cta' : 'review'
  return LINEAR_NEXT_QUESTION[questionId] || 'review'
}
export function getVirtualStagingReviewEditNext({ originQuestionId, questionId, answerId = '', mode = '', journeyId = '' }) {
  if (journeyId === FURNISH_RENOVATE_JOURNEY_ID) return 'review'
  if (originQuestionId === 'presenter_reference') {
    if (questionId === 'presenter_reference') return getVirtualStagingNextQuestion({ questionId, answerId, mode, journeyId })
    if (questionId === 'presenter_photo') return 'review'
  }
  if (originQuestionId === 'presenter_photo') return 'review'
  if (originQuestionId === 'purpose') return questionId === 'purpose' ? 'stage' : 'review'
  if (originQuestionId === 'type') {
    if (questionId === 'type') return 'facts'
    if (questionId === 'facts') return 'highlights'
    return 'review'
  }
  if (originQuestionId === 'cta_enabled') {
    const nextQuestionId = getVirtualStagingNextQuestion({ questionId, answerId, mode, journeyId })
    if (questionId === 'cta_enabled') return nextQuestionId
    if (questionId === 'cta') return 'phone'
    return 'review'
  }
  return 'review'
}

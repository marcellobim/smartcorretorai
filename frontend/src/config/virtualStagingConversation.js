import { LIFE_IN_PROPERTY_JOURNEY_ID } from './virtualStagingLife.js'

const LINEAR_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'presenter',
  presenter: 'narration',
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

export function getVirtualStagingNextQuestion({ questionId, answerId = '', mode = '', journeyId = '' }) {
  if (journeyId === LIFE_IN_PROPERTY_JOURNEY_ID) return LIFE_IN_PROPERTY_NEXT_QUESTION[questionId] || 'review'
  if (questionId === 'cta_enabled') return answerId === 'yes' ? 'cta' : 'review'
  return LINEAR_NEXT_QUESTION[questionId] || 'review'
}
export function getVirtualStagingReviewEditNext({ originQuestionId, questionId, answerId = '', mode = '', journeyId = '' }) {
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

const LINEAR_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'mode',
  presenter: 'cta',
  staging: 'narration',
  narration: 'captions',
  cta: 'phone',
  phone: 'review',
})

export function getSmartTourNextQuestion({ questionId, answerId = '', mode = '' }) {
  if (questionId === 'cta' && answerId === 'none') return 'review'
  if (questionId === 'presenter' && mode === 'smart_staging') return 'narration'
  if (questionId === 'mode') {
    if (answerId === 'guided_tour') return 'presenter'
    if (answerId === 'smart_staging') return 'staging'
    if (answerId === 'cinematic_tour') return 'captions'
    if (answerId === 'free_ai') return 'free_ai_format'
    return 'cta'
  }
  if (questionId === 'free_ai_format') return answerId === 'presenter' ? 'presenter' : 'cta'
  if (questionId === 'furniture') {
    return 'cta'
  }
  if (questionId === 'staging' && mode === 'smart_staging') return 'presenter'
  if (questionId === 'captions') return mode === 'cinematic_tour' ? 'furniture' : 'cta'
  return LINEAR_NEXT_QUESTION[questionId] || 'review'
}

export function getSmartTourReviewEditNext({ originQuestionId, questionId, answerId = '', mode = '' }) {
  if (originQuestionId === 'purpose') return questionId === 'purpose' ? 'stage' : 'review'
  if (originQuestionId === 'type') {
    if (questionId === 'type') return 'facts'
    if (questionId === 'facts') return 'highlights'
    return 'review'
  }
  if (originQuestionId === 'mode') {
    const nextQuestionId = getSmartTourNextQuestion({ questionId, answerId, mode })
    return nextQuestionId === 'cta' ? 'review' : nextQuestionId
  }
  return 'review'
}

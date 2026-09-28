const LINEAR_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'presenter',
  presenter_custom_speech: 'captions',
  narration: 'captions',
  captions: 'professional_identity',
  professional_identity: 'cta_enabled',
  cta: 'phone',
  phone: 'review',
})

export function shouldAskProfessionalIdentity({ identity = '' } = {}) {
  return Boolean(String(identity || '').trim())
}

export function getSmartTourNextQuestion({ questionId, answerId = '', mode = '' }) {
  if (questionId === 'presenter') return 'presenter_speech_mode'
  if (questionId === 'presenter_speech_mode') return answerId === 'custom' ? 'presenter_custom_speech' : 'narration'
  if (questionId === 'cta_enabled') return answerId === 'yes' ? 'cta' : 'review'
  return LINEAR_NEXT_QUESTION[questionId] || 'review'
}

export function getSmartTourReviewEditNext({ originQuestionId, questionId, answerId = '', mode = '' }) {
  if (originQuestionId === 'presenter') {
    if (questionId === 'presenter') return 'presenter_speech_mode'
    if (questionId === 'presenter_speech_mode') return answerId === 'custom' ? 'presenter_custom_speech' : 'review'
    return 'review'
  }
  if (originQuestionId === 'presenter_speech_mode') {
    return questionId === 'presenter_speech_mode' && answerId === 'custom' ? 'presenter_custom_speech' : 'review'
  }
  if (originQuestionId === 'presenter_custom_speech') return questionId === 'presenter_custom_speech' ? 'captions' : 'review'
  if (originQuestionId === 'purpose') return questionId === 'purpose' ? 'stage' : 'review'
  if (originQuestionId === 'type') {
    if (questionId === 'type') return 'facts'
    if (questionId === 'facts') return 'highlights'
    return 'review'
  }
  if (originQuestionId === 'cta_enabled') {
    const nextQuestionId = getSmartTourNextQuestion({ questionId, answerId, mode })
    if (questionId === 'cta_enabled') return nextQuestionId
    if (questionId === 'cta') return 'phone'
    return 'review'
  }
  return 'review'
}

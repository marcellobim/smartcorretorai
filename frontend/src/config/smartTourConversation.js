const LINEAR_NEXT_QUESTION = Object.freeze({
  images: 'purpose',
  purpose: 'stage',
  stage: 'type',
  type: 'facts',
  facts: 'location',
  location: 'commercial',
  commercial: 'highlights',
  highlights: 'description',
  description: 'mode',
  presenter: 'language',
  staging: 'narration',
  narration: 'captions',
  language: 'cta',
  cta: 'phone',
  phone: 'review',
})

export function getSmartTourNextQuestion({ questionId, answerId = '', mode = '' }) {
  if (questionId === 'mode') {
    if (answerId === 'guided_tour') return 'presenter'
    if (answerId === 'smart_staging') return 'furniture'
    if (answerId === 'cinematic_tour') return 'captions'
    return 'language'
  }
  if (questionId === 'furniture') {
    if (mode === 'smart_staging') return answerId === 'virtual_staging' ? 'staging' : 'narration'
    return 'language'
  }
  if (questionId === 'captions') return mode === 'cinematic_tour' ? 'furniture' : 'language'
  return LINEAR_NEXT_QUESTION[questionId] || 'review'
}

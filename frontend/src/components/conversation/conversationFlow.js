export const CONVERSATION_PHASE = Object.freeze({
  QUESTION: 'question',
  CONFIRMATION: 'confirmation',
  TYPING: 'typing',
})

export function appendConversationTurn(history, turn) {
  const existingIndex = history.findIndex(item => item.questionId === turn.questionId)
  const stableHistory = existingIndex >= 0 ? history.slice(0, existingIndex) : history
  return [...stableHistory, turn]
}

export function truncateConversationAt(history, questionId) {
  const index = history.findIndex(item => item.questionId === questionId)
  if (index < 0) return { history, removed: [] }
  return { history: history.slice(0, index), removed: history.slice(index) }
}

export function createConversationTurn({ questionId, question, answer, confirmation }) {
  return {
    questionId,
    question: String(question || '').trim(),
    answer: String(answer || '').trim(),
    confirmation: String(confirmation || '').trim(),
  }
}

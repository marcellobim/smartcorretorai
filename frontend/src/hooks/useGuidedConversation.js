import { useCallback, useEffect, useRef, useState } from 'react'
import { appendConversationTurn, CONVERSATION_PHASE, createConversationTurn, truncateConversationAt } from '../components/conversation/conversationFlow'

const DEFAULT_CONFIRMATION_MS = 650
const DEFAULT_TYPING_MS = 700

export function useGuidedConversation({ initialQuestionId, onEdit, confirmationMs = DEFAULT_CONFIRMATION_MS, typingMs = DEFAULT_TYPING_MS }) {
  const [activeQuestionId, setActiveQuestionId] = useState(initialQuestionId)
  const [history, setHistory] = useState([])
  const [phase, setPhase] = useState(CONVERSATION_PHASE.QUESTION)
  const lockedRef = useRef(false)
  const timersRef = useRef([])
  const onEditRef = useRef(onEdit)

  useEffect(() => { onEditRef.current = onEdit }, [onEdit])
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(timer => window.clearTimeout(timer))
    timersRef.current = []
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  const submitAnswer = useCallback(({ questionId, question, answer, confirmation, nextQuestionId }) => {
    if (lockedRef.current || phase !== CONVERSATION_PHASE.QUESTION || questionId !== activeQuestionId) return false
    lockedRef.current = true
    setHistory(current => appendConversationTurn(current, createConversationTurn({ questionId, question, answer, confirmation })))
    setPhase(CONVERSATION_PHASE.CONFIRMATION)

    const confirmationTimer = window.setTimeout(() => {
      setPhase(CONVERSATION_PHASE.TYPING)
      const typingTimer = window.setTimeout(() => {
        setActiveQuestionId(nextQuestionId)
        setPhase(CONVERSATION_PHASE.QUESTION)
        lockedRef.current = false
      }, typingMs)
      timersRef.current.push(typingTimer)
    }, confirmationMs)
    timersRef.current.push(confirmationTimer)
    return true
  }, [activeQuestionId, confirmationMs, phase, typingMs])

  const editAnswer = useCallback((questionId) => {
    clearTimers()
    const truncated = truncateConversationAt(history, questionId)
    setHistory(truncated.history)
    onEditRef.current?.(questionId, truncated.removed)
    setActiveQuestionId(questionId)
    setPhase(CONVERSATION_PHASE.QUESTION)
    lockedRef.current = false
  }, [clearTimers, history])

  const resetConversation = useCallback(() => {
    clearTimers()
    setHistory([])
    setActiveQuestionId(initialQuestionId)
    setPhase(CONVERSATION_PHASE.QUESTION)
    lockedRef.current = false
  }, [clearTimers, initialQuestionId])

  return {
    activeQuestionId,
    history,
    phase,
    isTransitioning: phase !== CONVERSATION_PHASE.QUESTION,
    submitAnswer,
    editAnswer,
    resetConversation,
  }
}

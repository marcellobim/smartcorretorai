import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth-context'
import { trackAccountAnalyticsEvent } from '../lib/account-analytics'

export function useAccountAnalytics(productId, reachedStep = null) {
  const { accessToken, user } = useAuth()
  const reachedSteps = useRef(new Set())

  const send = useCallback((eventType, stepId = null) => {
    void trackAccountAnalyticsEvent({ eventType, productId, stepId, accessToken })
  }, [accessToken, productId])

  const trackStep = useCallback(stepId => {
    if (!stepId || reachedSteps.current.has(stepId)) return
    reachedSteps.current.add(stepId)
    send('flow_step_reached', stepId)
  }, [send])

  const trackGenerationClicked = useCallback(() => {
    send('generation_clicked')
  }, [send])

  useEffect(() => {
    reachedSteps.current.clear()
  }, [productId, user?.id])

  useEffect(() => {
    trackStep(reachedStep)
  }, [reachedStep, trackStep])

  return { trackStep, trackGenerationClicked }
}

import { useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { getSmartTokenBalance, isTrialUser } from '../lib/smart-tokens'

export function useSmartTokens() {
  const { user, reloadProfile } = useAuth()
  const balance = getSmartTokenBalance(user)
  const trial = isTrialUser(user)
  const refreshBalance = useCallback(() => reloadProfile(), [reloadProfile])

  return { balance, trial, refreshBalance }
}

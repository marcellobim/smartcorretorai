import { useMemo } from 'react'

import { DEFAULT_LOCALE_CONFIG } from './locale-config'
import { getMessage } from './messages'

export function useLocale() {
  return useMemo(() => ({
    ...DEFAULT_LOCALE_CONFIG,
    t: (key) => getMessage(key, DEFAULT_LOCALE_CONFIG.locale),
  }), [])
}

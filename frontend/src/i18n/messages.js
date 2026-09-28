import ptBR from './messages/pt-BR'
import enUS from './messages/en-US'

import { DEFAULT_LOCALE_CONFIG } from './locale-config'

export const MESSAGES = Object.freeze({
  'pt-BR': ptBR,
  'en-US': enUS,
})

function getByKey(catalog, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], catalog)
}

export function getMessage(key, locale = DEFAULT_LOCALE_CONFIG.locale) {
  if (!key) return ''

  const localized = getByKey(MESSAGES[locale], key)
  if (localized !== undefined) return localized

  const fallback = getByKey(MESSAGES[DEFAULT_LOCALE_CONFIG.locale], key)
  return fallback === undefined ? key : fallback
}

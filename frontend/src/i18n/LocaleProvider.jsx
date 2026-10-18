import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

import { DEFAULT_LOCALE_CONFIG, MARKET_CONFIG, SUPPORTED_LOCALES, SUPPORTED_MARKETS, normalizeMarketPreferences } from './locale-config'
import { formatArea, formatCurrency, formatDate, formatNumber } from './formatters'
import { getMessage } from './messages'

export const LOCALE_PREFERENCES_KEY = 'snetia:locale-preferences'

// Product naming is presentation-only. Keep the existing catalog keys and all
// persisted smart-space identifiers stable while every localized UI surface
// renders the current customer-facing name.
const presentProductNames = value => typeof value === 'string'
  ? value.replaceAll('Smart Space', 'Snetia Space')
  : value

function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale)
}

function isSupportedMarket(market) {
  return SUPPORTED_MARKETS.includes(market)
}

function readPreferences() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE_CONFIG

  try {
    const stored = window.localStorage.getItem(LOCALE_PREFERENCES_KEY)
    if (!stored) {
      // A first visit can use the browser language as a non-invasive suggestion.
      // A persisted manual choice always wins on subsequent visits.
      const browserLocales = [window.navigator?.language, ...(window.navigator?.languages || [])].filter(Boolean)
      const market = browserLocales.some(value => String(value).toLowerCase() === 'en-us') ? 'US' : 'BR'
      return normalizeMarketPreferences({ market })
    }
    const preferences = JSON.parse(stored)
    return normalizeMarketPreferences(preferences)
  } catch {
    return DEFAULT_LOCALE_CONFIG
  }
}

export const DEFAULT_LOCALE_CONTEXT = Object.freeze({
  ...DEFAULT_LOCALE_CONFIG,
  t: (key) => presentProductNames(getMessage(key, DEFAULT_LOCALE_CONFIG.locale)),
  formatCurrency: (value) => formatCurrency(value, DEFAULT_LOCALE_CONFIG.locale, DEFAULT_LOCALE_CONFIG.currency),
  formatDate: (value) => formatDate(value, DEFAULT_LOCALE_CONFIG.locale),
  formatNumber: (value) => formatNumber(value, DEFAULT_LOCALE_CONFIG.locale),
  formatArea: (value) => formatArea(value, DEFAULT_LOCALE_CONFIG.units, DEFAULT_LOCALE_CONFIG.locale),
  setLocale: () => {},
  setMarket: () => {},
})

export const LocaleContext = createContext(DEFAULT_LOCALE_CONTEXT)

export function LocaleProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences)
  const { locale, market } = preferences
  const { currency, units } = MARKET_CONFIG[market] || DEFAULT_LOCALE_CONFIG

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCALE_PREFERENCES_KEY, JSON.stringify({ locale, market }))
    } catch {
      // Local persistence is optional; the in-memory fallback remains available.
    }
  }, [locale, market])

  const setLocale = useCallback((nextLocale) => {
    if (!isSupportedLocale(nextLocale)) return
    setPreferences(() => normalizeMarketPreferences({ locale: nextLocale }))
  }, [])

  const setMarket = useCallback((nextMarket) => {
    if (!isSupportedMarket(nextMarket)) return
    setPreferences(() => normalizeMarketPreferences({ market: nextMarket }))
  }, [])

  const value = useMemo(() => ({
    locale,
    market,
    currency,
    units,
    t: (key) => presentProductNames(getMessage(key, locale)),
    formatCurrency: (amount) => formatCurrency(amount, locale, currency),
    formatDate: (date) => formatDate(date, locale),
    formatNumber: (number) => formatNumber(number, locale),
    formatArea: (area) => formatArea(area, units, locale),
    setLocale,
    setMarket,
  }), [currency, locale, market, setLocale, setMarket, units])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

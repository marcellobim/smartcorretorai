import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

import { DEFAULT_LOCALE_CONFIG, MARKET_CONFIG, SUPPORTED_LOCALES, SUPPORTED_MARKETS } from './locale-config'
import { formatArea, formatCurrency, formatDate, formatNumber } from './formatters'
import { getMessage } from './messages'

export const LOCALE_PREFERENCES_KEY = 'snetia:locale-preferences'

function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale)
}

function isSupportedMarket(market) {
  return SUPPORTED_MARKETS.includes(market)
}

function readPreferences() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE_CONFIG

  try {
    const preferences = JSON.parse(window.localStorage.getItem(LOCALE_PREFERENCES_KEY) || '{}')
    return {
      locale: isSupportedLocale(preferences.locale) ? preferences.locale : DEFAULT_LOCALE_CONFIG.locale,
      market: isSupportedMarket(preferences.market) ? preferences.market : DEFAULT_LOCALE_CONFIG.market,
    }
  } catch {
    return DEFAULT_LOCALE_CONFIG
  }
}

export const DEFAULT_LOCALE_CONTEXT = Object.freeze({
  ...DEFAULT_LOCALE_CONFIG,
  t: (key) => getMessage(key, DEFAULT_LOCALE_CONFIG.locale),
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
    setPreferences((current) => ({ ...current, locale: nextLocale }))
  }, [])

  const setMarket = useCallback((nextMarket) => {
    if (!isSupportedMarket(nextMarket)) return
    setPreferences((current) => ({ ...current, market: nextMarket }))
  }, [])

  const value = useMemo(() => ({
    locale,
    market,
    currency,
    units,
    t: (key) => getMessage(key, locale),
    formatCurrency: (amount) => formatCurrency(amount, locale, currency),
    formatDate: (date) => formatDate(date, locale),
    formatNumber: (number) => formatNumber(number, locale),
    formatArea: (area) => formatArea(area, units, locale),
    setLocale,
    setMarket,
  }), [currency, locale, market, setLocale, setMarket, units])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

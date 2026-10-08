export const SUPPORTED_LOCALES = Object.freeze(['pt-BR', 'en-US'])

export const SUPPORTED_MARKETS = Object.freeze(['BR', 'US'])

export const DEFAULT_LOCALE_CONFIG = Object.freeze({
  locale: 'pt-BR',
  market: 'BR',
  currency: 'BRL',
  units: 'metric',
})

export const MARKET_CONFIG = Object.freeze({
  BR: Object.freeze({ locale: 'pt-BR', currency: 'BRL', units: 'metric' }),
  US: Object.freeze({ locale: 'en-US', currency: 'USD', units: 'imperial' }),
})

export function getMarketConfig(market) {
  return MARKET_CONFIG[market] || DEFAULT_LOCALE_CONFIG
}

// `market` is the persisted source of truth. Locale is always derived from it
// so an old or partially persisted preference cannot create a mixed state.
export function normalizeMarketPreferences(preferences = {}) {
  const market = SUPPORTED_MARKETS.includes(preferences.market)
    ? preferences.market
    : preferences.locale === 'en-US'
      ? 'US'
      : 'BR'

  return {
    market,
    locale: getMarketConfig(market).locale,
  }
}

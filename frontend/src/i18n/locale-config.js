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

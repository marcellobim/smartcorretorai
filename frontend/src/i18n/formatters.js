import { DEFAULT_LOCALE_CONFIG } from './locale-config'

export function formatCurrency(value, locale = DEFAULT_LOCALE_CONFIG.locale, currency = DEFAULT_LOCALE_CONFIG.currency) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value || 0))
}

export function formatDate(value, locale = DEFAULT_LOCALE_CONFIG.locale) {
  return new Intl.DateTimeFormat(locale).format(new Date(value))
}

export function formatNumber(value, locale = DEFAULT_LOCALE_CONFIG.locale) {
  return new Intl.NumberFormat(locale).format(Number(value || 0))
}

export function formatArea(value, marketOrUnits = DEFAULT_LOCALE_CONFIG.units, locale = DEFAULT_LOCALE_CONFIG.locale) {
  const units = marketOrUnits === 'US' ? 'imperial' : marketOrUnits === 'BR' ? 'metric' : marketOrUnits
  return `${formatNumber(value, locale)} ${units === 'imperial' ? 'sqft' : 'm²'}`
}

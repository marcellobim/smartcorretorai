export function normalizePhone(value = '', market = 'BR') {
  const rawValue = String(value ?? '').trim()
  const rawDigits = rawValue.replace(/\D/g, '')
  const local = market === 'US'
    // Eleven plain digits beginning with 1 are ambiguous (they can be a BR
    // number). Strip 1 only when the user explicitly supplied +1.
    ? (rawDigits.length === 11 && /^\+1\D*/.test(rawValue) ? rawDigits.slice(1) : rawDigits)
    : (rawDigits.length > 11 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits)
  const max = market === 'US' ? 10 : 11
  // A value from the other market must remain untouched until its owner
  // explicitly replaces it.  Never turn a foreign number into a plausible
  // local number by silently dropping digits.
  return local.length > max ? rawDigits : local
}

export function isPhoneCompatibleWithMarket(value = '', market = 'BR') {
  const digits = normalizePhone(value, market)
  return market === 'US' ? digits.length === 10 : digits.length === 10 || digits.length === 11
}

export function formatBrazilianPhone(value = '') {
  const digits = normalizePhone(value, 'BR')
  if (digits.length > 11) return String(value ?? '')
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatUsPhone(value = '') {
  const digits = normalizePhone(value, 'US')
  if (digits.length > 10) return String(value ?? '')
  if (!digits) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatPhone(value = '', market = 'BR', sourceMarket = market) {
  if (value && (sourceMarket === 'BR' || sourceMarket === 'US') && sourceMarket !== market) return String(value)
  return market === 'US' ? formatUsPhone(value) : formatBrazilianPhone(value)
}

export function formatBrazilianPhone(value = '') {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  const digits = (rawDigits.length > 11 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatUsPhone(value = '') {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const extension = raw.match(/(?:ext\.?|x)\s*\d+$/i)?.[0] || ''
  const digits = raw.replace(/(?:ext\.?|x)\s*\d+$/i, '').replace(/\D/g, '')
  const hasCountryCode = digits.length === 11 && digits.startsWith('1')
  const local = hasCountryCode ? digits.slice(1) : digits
  if (local.length !== 10) return raw
  return `${hasCountryCode ? '+1 ' : ''}(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}${extension ? ` ${extension}` : ''}`
}

export function formatPhone(value = '', market = 'BR') {
  return market === 'US' ? formatUsPhone(value) : formatBrazilianPhone(value)
}

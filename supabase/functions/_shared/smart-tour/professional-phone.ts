const BRAZIL_COUNTRY_CODE = '55'
const PHONE_LIKE_TEXT = /(?:\+?55[\s().-]*)?\(?[1-9]\d\)?[\s.-]*(?:9\d{4}|[2-5]\d{3})[\s.-]*\d{4}/g

export function formatSmartTourProfessionalPhone(value: unknown): string {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  const digits = rawDigits.startsWith(BRAZIL_COUNTRY_CODE) && rawDigits.length >= 12
    ? rawDigits.slice(BRAZIL_COUNTRY_CODE.length)
    : rawDigits

  if (!/^[1-9]\d{9,10}$/.test(digits)) return ''

  const areaCode = digits.slice(0, 2)
  const subscriber = digits.slice(2)
  const validSubscriber = subscriber.length === 9
    ? subscriber.startsWith('9')
    : /^[2-5]/.test(subscriber)
  if (!validSubscriber) return ''

  const prefixLength = subscriber.length === 9 ? 5 : 4
  return `+55 (${areaCode}) ${subscriber.slice(0, prefixLength)}-${subscriber.slice(prefixLength)}`
}

export function resolveSmartTourProfessionalPhone(includePhone: boolean, ...profileValues: unknown[]): string {
  if (!includePhone) return ''
  for (const value of profileValues) {
    const formatted = formatSmartTourProfessionalPhone(value)
    if (formatted) return formatted
  }
  return ''
}

export function removeNonOfficialPhoneNumbers(value: unknown): string {
  return String(value ?? '').replace(PHONE_LIKE_TEXT, '').replace(/\s{2,}/g, ' ').trim()
}

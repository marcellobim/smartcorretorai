export type PtBrSpeechGender = 'masculine' | 'feminine'

export type PtBrSpeechNoun = {
  singular: string
  plural: string
  gender: PtBrSpeechGender
}

const UNITS_MASCULINE = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const UNITS_FEMININE = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const TEENS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS_MASCULINE = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
const HUNDREDS_FEMININE = ['', 'cento', 'duzentas', 'trezentas', 'quatrocentas', 'quinhentas', 'seiscentas', 'setecentas', 'oitocentas', 'novecentas']

const fold = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')

function underThousand(value: number, gender: PtBrSpeechGender) {
  if (value === 0) return ''
  if (value === 100) return 'cem'
  const units = gender === 'feminine' ? UNITS_FEMININE : UNITS_MASCULINE
  const hundreds = gender === 'feminine' ? HUNDREDS_FEMININE : HUNDREDS_MASCULINE
  const parts: string[] = []
  const hundred = Math.floor(value / 100)
  const remainder = value % 100
  if (hundred) parts.push(hundreds[hundred])
  if (remainder) {
    if (hundred) parts.push('e')
    if (remainder < 10) parts.push(units[remainder])
    else if (remainder < 20) parts.push(TEENS[remainder - 10])
    else {
      const ten = Math.floor(remainder / 10)
      const unit = remainder % 10
      parts.push(TENS[ten])
      if (unit) parts.push('e', units[unit])
    }
  }
  return parts.join(' ')
}

export function ptBrIntegerToWords(value: number, gender: PtBrSpeechGender = 'masculine'): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999_999_999) return ''
  if (value === 0) return 'zero'
  if (value < 1_000) return underThousand(value, gender)
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1_000)
    const remainder = value % 1_000
    const prefix = thousands === 1 ? 'mil' : `${ptBrIntegerToWords(thousands, gender)} mil`
    if (!remainder) return prefix
    return `${prefix}${remainder < 100 || remainder % 100 === 0 ? ' e ' : ' '}${ptBrIntegerToWords(remainder, gender)}`
  }
  const millions = Math.floor(value / 1_000_000)
  const remainder = value % 1_000_000
  const prefix = millions === 1 ? 'um milhão' : `${ptBrIntegerToWords(millions)} milhões`
  if (!remainder) return prefix
  return `${prefix}${remainder < 100 || remainder % 100 === 0 ? ' e ' : ' '}${ptBrIntegerToWords(remainder, gender)}`
}

function parseSmallQuantity(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text || /^(?:0|zero|sem|nenhum|nenhuma)(?:\b|$)/i.test(fold(text))) return null
  const matched = text.match(/^\s*(\d{1,3})(\+)?(?:\s|$)/)
  if (!matched) return null
  const quantity = Number(matched[1])
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null
  const atLeast = Boolean(matched[2]) || /\bou mais\b/i.test(fold(text))
  return { quantity, atLeast }
}

export function formatPtBrSpeechQuantity(value: unknown, noun: PtBrSpeechNoun): string {
  const parsed = parseSmallQuantity(value)
  if (!parsed) return ''
  const words = ptBrIntegerToWords(parsed.quantity, noun.gender)
  if (!words) return ''
  const label = parsed.quantity === 1 && !parsed.atLeast ? noun.singular : noun.plural
  return `${words}${parsed.atLeast ? ' ou mais' : ''} ${label}`
}

export const PT_BR_SPEECH_NOUNS = Object.freeze({
  bedroom: { singular: 'dormitório', plural: 'dormitórios', gender: 'masculine' },
  suite: { singular: 'suíte', plural: 'suítes', gender: 'feminine' },
  parking: { singular: 'vaga', plural: 'vagas', gender: 'feminine' },
  parkingGarage: { singular: 'vaga de garagem', plural: 'vagas de garagem', gender: 'feminine' },
  bathroom: { singular: 'banheiro', plural: 'banheiros', gender: 'masculine' },
  balcony: { singular: 'varanda', plural: 'varandas', gender: 'feminine' },
  room: { singular: 'sala', plural: 'salas', gender: 'feminine' },
} satisfies Record<string, PtBrSpeechNoun>)

export function composePtBrPropertySpeechFacts(input: {
  bedrooms?: unknown
  suites?: unknown
  parkingSpaces?: unknown
  variant?: 'natural' | 'concise'
}): string {
  const bedrooms = formatPtBrSpeechQuantity(input.bedrooms, PT_BR_SPEECH_NOUNS.bedroom)
  const suites = formatPtBrSpeechQuantity(input.suites, PT_BR_SPEECH_NOUNS.suite)
  const parking = formatPtBrSpeechQuantity(
    input.parkingSpaces,
    input.variant === 'concise' ? PT_BR_SPEECH_NOUNS.parking : PT_BR_SPEECH_NOUNS.parkingGarage,
  )
  const facts = [bedrooms, suites, parking].filter(Boolean)
  if (!facts.length) return ''
  if (input.variant === 'concise') {
    if (facts.length === 1) return facts[0]
    return `${facts.slice(0, -1).join(', ')} e ${facts.at(-1)}`
  }
  if (bedrooms && suites && parking) return `${bedrooms}, sendo ${suites}, além de ${parking}`
  if (bedrooms && suites) return `${bedrooms}, sendo ${suites}`
  if (parking && (bedrooms || suites)) return `${bedrooms || suites}, além de ${parking}`
  return facts[0]
}

function parsePtBrInteger(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const compact = raw.replace(/\s/g, '')
  if (!/^\d{1,3}(?:\.\d{3})*$/.test(compact) && !/^\d+$/.test(compact)) return null
  const parsed = Number(compact.replace(/\./g, ''))
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function formatPtBrSpeechArea(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const normalized = fold(raw).replace(/²/g, '2')
  const range = normalized.match(/^(\d+)\s+a\s+(\d+)\s*m2$/)
  if (range) {
    const start = ptBrIntegerToWords(Number(range[1]))
    const end = ptBrIntegerToWords(Number(range[2]))
    return start && end ? `de ${start} a ${end} metros quadrados` : ''
  }
  const until = normalized.match(/^ate\s+(\d+)\s*m2$/)
  if (until) return `até ${ptBrIntegerToWords(Number(until[1]))} metros quadrados`
  const above = normalized.match(/^acima\s+de\s+(\d+)\s*m2$/)
  if (above) return `acima de ${ptBrIntegerToWords(Number(above[1]))} metros quadrados`
  const numeric = parsePtBrInteger(normalized.replace(/\s*m2$/, ''))
  return numeric ? `${ptBrIntegerToWords(numeric)} metros quadrados` : ''
}

export function formatPtBrSpeechCurrency(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const normalized = raw.replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(normalized) && !/^\d+(?:,\d{1,2})?$/.test(normalized)) return ''
  const [integerPart, centsPart = ''] = normalized.split(',')
  const reais = Number(integerPart.replace(/\./g, ''))
  const cents = centsPart ? Number(centsPart.padEnd(2, '0')) : 0
  if (!Number.isSafeInteger(reais) || reais < 0 || !Number.isInteger(cents) || cents < 0 || cents > 99) return ''
  const parts: string[] = []
  if (reais > 0) parts.push(`${ptBrIntegerToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  if (cents > 0) parts.push(`${ptBrIntegerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`)
  if (!parts.length) return ''
  return parts.join(' e ')
}

const NOUN_BY_FOLDED_LABEL: Record<string, PtBrSpeechNoun> = {
  dormitorio: PT_BR_SPEECH_NOUNS.bedroom,
  dormitorios: PT_BR_SPEECH_NOUNS.bedroom,
  suite: PT_BR_SPEECH_NOUNS.suite,
  suites: PT_BR_SPEECH_NOUNS.suite,
  vaga: PT_BR_SPEECH_NOUNS.parking,
  vagas: PT_BR_SPEECH_NOUNS.parking,
  'vaga de garagem': PT_BR_SPEECH_NOUNS.parkingGarage,
  'vagas de garagem': PT_BR_SPEECH_NOUNS.parkingGarage,
  banheiro: PT_BR_SPEECH_NOUNS.bathroom,
  banheiros: PT_BR_SPEECH_NOUNS.bathroom,
  varanda: PT_BR_SPEECH_NOUNS.balcony,
  varandas: PT_BR_SPEECH_NOUNS.balcony,
  sala: PT_BR_SPEECH_NOUNS.room,
  salas: PT_BR_SPEECH_NOUNS.room,
}

export function normalizePtBrSpeechText(value: unknown): string {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  text = text.replace(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|R\$\s*\d+(?:,\d{1,2})?/gi, match => formatPtBrSpeechCurrency(match) || match)
  text = text.replace(/\b\d{1,3}(?:\.\d{3})*\s*m(?:²|2)(?=\s|[.,;:!?)]|$)/gi, match => formatPtBrSpeechArea(match) || match)
  const nounPattern = '(dormit[oó]rios?|su[ií]tes?|vagas?(?:\\s+de\\s+garagem)?|banheiros?|varandas?|salas?)'
  text = text.replace(new RegExp(`\\b(\\d{1,3}\\+?)\\s+${nounPattern}\\b`, 'giu'), (_match, amount, label) => {
    const noun = NOUN_BY_FOLDED_LABEL[fold(label)]
    return noun ? formatPtBrSpeechQuantity(amount, noun) : _match
  })
  text = text.replace(new RegExp(`\\b(um|uma|dois|duas)\\s+${nounPattern}\\b`, 'giu'), (_match, amount, label) => {
    const noun = NOUN_BY_FOLDED_LABEL[fold(label)]
    if (!noun) return _match
    const quantity = /^(?:um|uma)$/i.test(amount) ? 1 : 2
    return formatPtBrSpeechQuantity(quantity, noun)
  })
  return text
}

export function containsPtBrPhoneLike(value: unknown): boolean {
  return /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/.test(String(value ?? ''))
}

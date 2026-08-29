export type PtBrQuantityNoun =
  | 'dormitório'
  | 'suíte'
  | 'banheiro'
  | 'vaga'
  | 'imagem'
  | 'quarto'
  | 'foto'
  | 'peça'
  | 'grupo'
  | 'ambiente'
  | 'captura'

const FORMS: Record<PtBrQuantityNoun, { singular: string; plural: string }> = {
  dormitório: { singular: 'dormitório', plural: 'dormitórios' },
  suíte: { singular: 'suíte', plural: 'suítes' },
  banheiro: { singular: 'banheiro', plural: 'banheiros' },
  vaga: { singular: 'vaga', plural: 'vagas' },
  imagem: { singular: 'imagem', plural: 'imagens' },
  quarto: { singular: 'quarto', plural: 'quartos' },
  foto: { singular: 'foto', plural: 'fotos' },
  peça: { singular: 'peça', plural: 'peças' },
  grupo: { singular: 'grupo', plural: 'grupos' },
  ambiente: { singular: 'ambiente', plural: 'ambientes' },
  captura: { singular: 'captura', plural: 'capturas' },
}

const numericValue = (value: string | number) => Number(String(value).trim().replace(',', '.'))

export function formatPtBrQuantity(value: string | number, noun: PtBrQuantityNoun) {
  const displayValue = String(value).trim()
  const form = numericValue(value) === 1 ? FORMS[noun].singular : FORMS[noun].plural
  return `${displayValue} ${form}`
}

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const quantityPatterns = Object.values(FORMS).flatMap(({ singular, plural }) => [
  { pattern: new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s+${escaped(singular)}\\(s\\)`, 'giu'), singular, plural },
  { pattern: new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s+${escaped(singular)}\\(ns\\)`, 'giu'), singular, plural },
])

export function normalizePtBrQuantityText(value: string) {
  return quantityPatterns.reduce((text, { pattern, singular, plural }) => text.replace(pattern, (_match, count) => (
    `${count} ${numericValue(count) === 1 ? singular : plural}`
  )), value)
}

export function normalizePtBrQuantities<T>(value: T): T {
  if (typeof value === 'string') return normalizePtBrQuantityText(value) as T
  if (Array.isArray(value)) return value.map(item => normalizePtBrQuantities(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizePtBrQuantities(item)])) as T
  }
  return value
}

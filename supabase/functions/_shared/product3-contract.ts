export type Product3Purpose = 'sale' | 'rental'

const normalizeToken = (value: unknown): string => String(value ?? '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')

const PURPOSE_ALIASES: Record<Product3Purpose, Set<string>> = {
  sale: new Set(['sale', 'venda', 'vender', 'a_venda', 'para_venda']),
  rental: new Set(['rental', 'rent', 'locacao', 'aluguel', 'alugar', 'para_locacao', 'for_rent', 'for_lease']),
}

export function normalizeProduct3Purpose(value: unknown): Product3Purpose {
  const normalized = normalizeToken(value)
  if (PURPOSE_ALIASES.sale.has(normalized)) return 'sale'
  if (PURPOSE_ALIASES.rental.has(normalized)) return 'rental'
  throw new Error(`Finalidade ausente ou inválida: ${String(value ?? '(vazia)')}`)
}

export function getProduct3PurposeLabel(value: unknown): 'Venda' | 'Locação' {
  return normalizeProduct3Purpose(value) === 'rental' ? 'Locação' : 'Venda'
}

export function getProduct3PurposeBadge(value: unknown): 'À VENDA' | 'PARA LOCAÇÃO' {
  return normalizeProduct3Purpose(value) === 'rental' ? 'PARA LOCAÇÃO' : 'À VENDA'
}

export function formatBrazilianPhone(value: unknown = ''): string {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  const digits = (rawDigits.length > 11 && rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatProduct3Currency(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
  }
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const numeric = Number(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(numeric) || numeric <= 0) return raw
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(numeric)
}

export function formatProduct3Price(value: unknown, purpose: unknown, mode = ''): string {
  const formatted = formatProduct3Currency(value)
  if (!formatted) return ''
  if (normalizeProduct3Purpose(purpose) === 'rental') return `${formatted}/mês`
  return mode === 'starting_at' ? `A partir de ${formatted}` : formatted
}

export type OfficialHashtagContext = {
  purpose?: unknown
  propertyType?: unknown
  city?: unknown
  district?: unknown
  state?: unknown
  bedrooms?: unknown
  suites?: unknown
  parkingSpaces?: unknown
  highlights?: unknown
  cta?: unknown
}

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
const fold = (value: unknown) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export function toOfficialHashtag(value: unknown): string {
  const token = clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return token ? `#${token}` : ''
}

const normalizePurpose = (value: unknown): 'sale' | 'rental' | '' => {
  const purpose = fold(value)
  if (['rent', 'rental', 'locacao', 'aluguel', 'alugar', 'para locacao'].includes(purpose)) return 'rental'
  if (['sale', 'venda', 'vender', 'a venda', 'para venda'].includes(purpose)) return 'sale'
  return ''
}

const contradictsPurpose = (tag: string, purpose: 'sale' | 'rental' | '') => {
  const normalized = fold(tag).replace(/[^a-z0-9]/g, '')
  if (purpose === 'sale') return /aluguel|alugar|locacao|paraalugar|paralocacao/.test(normalized)
  if (purpose === 'rental') return /avenda|venda|vender|compra|comprar|financiamento/.test(normalized)
  return false
}

const extractHashtags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(extractHashtags)
  return clean(value).match(/#[\p{L}\p{N}_]+/gu) || []
}

export function buildOfficialHashtags(context: OfficialHashtagContext = {}, generated: unknown = []): string[] {
  const purpose = normalizePurpose(context.purpose)
  const propertyType = clean(context.propertyType) || 'Imovel'
  const city = clean(context.city)
  const district = clean(context.district)
  const state = clean(context.state)
  const rawHighlights = Array.isArray(context.highlights) ? context.highlights.map(clean).filter(Boolean) : []
  const highlights = [...new Map(rawHighlights.map((item) => [fold(item), item])).values()]
  const cta = fold(context.cta)
  const characteristics = [
    clean(context.bedrooms) && toOfficialHashtag(`${context.bedrooms} dormitorios`),
    clean(context.suites) && toOfficialHashtag(`${context.suites} suites`),
    clean(context.parkingSpaces) && toOfficialHashtag(`${context.parkingSpaces} vagas`),
  ].filter(Boolean).slice(0, 2)
  const candidates: string[] = [
    city && toOfficialHashtag(city),
    district && toOfficialHashtag(district),
    state && toOfficialHashtag(`Imoveis ${state}`),
    purpose === 'rental' ? toOfficialHashtag(`${propertyType} para alugar`) : purpose === 'sale' ? toOfficialHashtag(`${propertyType} a venda`) : toOfficialHashtag(propertyType),
    purpose === 'rental' ? '#Locacao' : purpose === 'sale' ? '#ImovelAVenda' : '',
    purpose === 'rental' ? '#Aluguel' : purpose === 'sale' ? '#VendaDeImoveis' : '',
    '#MercadoImobiliario',
    '#InvestimentoImobiliario',
    ...characteristics,
    ...highlights.slice(0, 2).map(toOfficialHashtag),
    /agende|visita/.test(cta) ? '#AgendeSuaVisita' : /saiba|conheca/.test(cta) ? '#SaibaMais' : /contato|fale|whatsapp/.test(cta) ? '#EntreEmContato' : '',
    '#CorretorDeImoveis',
    ...extractHashtags(generated),
    purpose === 'rental' ? '#ProntoParaMorar' : purpose === 'sale' ? '#SeuNovoLar' : '#Imoveis',
    '#NegociosImobiliarios',
    '#OportunidadeImobiliaria',
    '#MorarBem',
    '#Imoveis',
    '#Imobiliaria',
    '#DivulgacaoImobiliaria',
    '#SmartCorretorAI',
  ].filter(Boolean) as string[]

  const unique = new Map<string, string>()
  for (const candidate of candidates) {
    const tag = toOfficialHashtag(String(candidate).replace(/^#/, ''))
    const key = fold(tag)
    if (!tag || contradictsPurpose(tag, purpose) || unique.has(key)) continue
    unique.set(key, tag === '#SmartcorretorAI' ? '#SmartCorretorAI' : tag)
    if (unique.size >= 15) break
  }

  unique.delete('#smartcorretorai')
  const result = [...unique.values()].slice(0, 14)
  result.push('#SmartCorretorAI')
  return result
}

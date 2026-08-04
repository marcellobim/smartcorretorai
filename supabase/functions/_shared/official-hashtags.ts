export type OfficialHashtagContext = {
  purpose?: unknown
  propertyType?: unknown
  propertyStage?: unknown
  city?: unknown
  district?: unknown
  state?: unknown
  bedrooms?: unknown
  suites?: unknown
  parkingSpaces?: unknown
  highlights?: unknown
  cta?: unknown
}

export type OfficialHashtagGroups = {
  location: string[]
  purpose: string[]
  market: string[]
  characteristics: string[]
  commercialAppeal: string[]
  brand: ['#SmartCorretorAI']
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

type OfficialPurpose = 'sale' | 'rental' | 'launch' | ''

const normalizePurpose = (value: unknown): OfficialPurpose => {
  const purpose = fold(value)
  if (['rent', 'rental', 'locacao', 'aluguel', 'alugar', 'para locacao'].includes(purpose)) return 'rental'
  if (['launch', 'lancamento', 'pre-lancamento', 'pre lancamento'].includes(purpose)) return 'launch'
  if (['sale', 'venda', 'vender', 'a venda', 'para venda'].includes(purpose)) return 'sale'
  return ''
}

const contradictsPurpose = (tag: string, purpose: OfficialPurpose) => {
  const normalized = fold(tag).replace(/[^a-z0-9]/g, '')
  if (purpose === 'sale') return /aluguel|alugar|locacao|paraalugar|paralocacao/.test(normalized)
  if (purpose === 'rental') return /avenda|venda|vender|compra|comprar|financiamento/.test(normalized)
  return false
}

const uniqueGroup = (values: unknown[], max: number, purpose: OfficialPurpose) => {
  const unique = new Map<string, string>()
  for (const value of values) {
    const tag = toOfficialHashtag(String(value || '').replace(/^#/, ''))
    const key = fold(tag)
    if (!tag || contradictsPurpose(tag, purpose) || unique.has(key)) continue
    unique.set(key, tag)
    if (unique.size >= max) break
  }
  return [...unique.values()]
}

const isResidentialType = (value: unknown) => /apartamento|casa|cobertura|studio|loft|sobrado|residencial/.test(fold(value))
const isCommercialType = (value: unknown) => /comercial|sala|loja|galpao|escritorio/.test(fold(value))

export function buildOfficialHashtagGroups(context: OfficialHashtagContext = {}): OfficialHashtagGroups {
  const purpose = normalizePurpose(context.purpose)
  const propertyType = clean(context.propertyType) || 'Imovel'
  const propertyStage = clean(context.propertyStage)
  const city = clean(context.city)
  const district = clean(context.district)
  const state = clean(context.state)
  const rawHighlights = Array.isArray(context.highlights) ? context.highlights.map(clean).filter(Boolean) : []
  const highlights = [...new Map(rawHighlights.map((item) => [fold(item), item])).values()]
  const cta = fold(context.cta)
  const residential = isResidentialType(propertyType)
  const commercial = isCommercialType(propertyType)
  const purposeTag = purpose === 'rental'
    ? commercial ? toOfficialHashtag(`Locacao ${propertyType}`) : toOfficialHashtag(`${propertyType} para alugar`)
    : purpose === 'launch' ? toOfficialHashtag(`Lancamento ${propertyType}`)
      : purpose === 'sale' ? toOfficialHashtag(`${propertyType} a venda`) : toOfficialHashtag(propertyType)
  const categoryTag = residential ? '#ImovelResidencial' : commercial ? '#ImovelComercial' : propertyType !== 'Imovel' ? toOfficialHashtag(propertyType) : ''
  const ctaTag = /agende|visita/.test(cta) ? '#AgendeSuaVisita' : /saiba|conheca/.test(cta) ? '#SaibaMais' : /contato|fale|whatsapp/.test(cta) ? '#EntreEmContato' : ''
  const readyToMove = /pronto|disponivel|imediat/.test(fold(propertyStage))
  const lifestyleTag = purpose === 'rental' && readyToMove
    ? '#ProntoParaMorar'
    : residential ? purpose === 'sale' ? '#SeuNovoLar' : '#MorarBem' : '#ExcelenteOportunidade'

  return {
    location: uniqueGroup([district, city, district && city && `${district} ${city}`], 3, purpose),
    purpose: uniqueGroup([
      purposeTag,
      purpose === 'rental' ? `Locacao ${city || state}` : purpose === 'launch' ? `Lancamento ${city || state}` : `Comprar ${propertyType}`,
    ], 2, purpose),
    market: uniqueGroup([
      city && `${propertyType} em ${city}`,
      district && `Morar no ${district}`,
      city && `Vida em ${city}`,
    ], 3, purpose),
    characteristics: uniqueGroup([
      clean(context.bedrooms) && `${context.bedrooms} dormitorios`,
      clean(context.suites) && `${context.suites} suites`,
      clean(context.parkingSpaces) && `${context.parkingSpaces} vagas`,
      ...highlights,
      propertyStage,
      propertyType !== 'Imovel' && propertyType,
      categoryTag,
    ], 4, purpose),
    commercialAppeal: uniqueGroup([ctaTag, lifestyleTag, `Busca por ${propertyType}`], 2, purpose),
    brand: ['#SmartCorretorAI'],
  }
}

export function buildOfficialHashtags(context: OfficialHashtagContext = {}): string[] {
  const groups = buildOfficialHashtagGroups(context)
  const unique = new Map<string, string>()
  for (const tag of [...groups.location, ...groups.purpose, ...groups.market, ...groups.characteristics, ...groups.commercialAppeal]) {
    if (!unique.has(fold(tag))) unique.set(fold(tag), tag)
  }
  const propertyType = clean(context.propertyType) || 'Imovel'
  const city = clean(context.city)
  const district = clean(context.district)
  const purpose = normalizePurpose(context.purpose)
  const supplemental = [
    city && `Imoveis em ${city}`,
    district && `${propertyType} no ${district}`,
    purpose === 'rental' ? 'Seu novo endereco' : purpose === 'launch' ? 'Novo lancamento imobiliario' : 'Seu novo imovel',
    `Busca por ${propertyType}`,
    purpose === 'rental' ? 'Aluguel residencial' : purpose === 'launch' ? 'Imovel na planta' : 'Oferta imobiliaria',
    city && `Morar em ${city}`,
    '#SmartCorretorAI',
  ]
  for (const value of supplemental) {
    const tag = toOfficialHashtag(String(value || '').replace(/^#/, ''))
    const key = fold(tag)
    if (tag && !contradictsPurpose(tag, purpose) && !unique.has(key)) unique.set(key, tag)
    if (unique.size >= 14) break
  }
  const result = [...unique.values()].filter(tag => fold(tag) !== '#smartcorretorai').slice(0, 14)
  result.splice(Math.max(1, Math.floor(result.length / 2)), 0, '#SmartCorretorAI')
  return result.slice(0, 15)
}

export function normalizeOfficialHashtags(input: unknown, context: OfficialHashtagContext = {}): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === 'string' ? input.match(/#[\p{L}\p{N}_]+/gu) || [] : []
  const purpose = normalizePurpose(context.purpose)
  const excessiveGeneric = new Set(['#imoveis', '#corretordeimoveis', '#mercadoimobiliario'])
  const unique = new Map<string, string>()
  let genericCount = 0
  for (const value of values) {
    const tag = toOfficialHashtag(String(value || '').replace(/^#/, ''))
    const key = fold(tag)
    if (!tag || key === '#smartcorretorai' || contradictsPurpose(tag, purpose) || unique.has(key)) continue
    if (excessiveGeneric.has(key) && genericCount >= 1) continue
    if (excessiveGeneric.has(key)) genericCount += 1
    unique.set(key, tag)
    if (unique.size >= 14) break
  }
  for (const tag of buildOfficialHashtags(context)) {
    const key = fold(tag)
    if (key !== '#smartcorretorai' && !unique.has(key)) unique.set(key, tag)
    if (unique.size >= 14) break
  }
  const result = [...unique.values()].slice(0, 14)
  result.splice(Math.max(1, Math.floor(result.length / 2)), 0, '#SmartCorretorAI')
  return result.slice(0, 15)
}

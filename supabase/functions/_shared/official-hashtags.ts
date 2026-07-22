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

const uniqueGroup = (values: unknown[], max: number, purpose: 'sale' | 'rental' | '') => {
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
    : purpose === 'sale' ? toOfficialHashtag(`${propertyType} a venda`) : toOfficialHashtag(propertyType)
  const categoryTag = residential ? '#ImovelResidencial' : commercial ? '#ImovelComercial' : propertyType !== 'Imovel' ? toOfficialHashtag(propertyType) : ''
  const ctaTag = /agende|visita/.test(cta) ? '#AgendeSuaVisita' : /saiba|conheca/.test(cta) ? '#SaibaMais' : /contato|fale|whatsapp/.test(cta) ? '#EntreEmContato' : ''
  const readyToMove = /pronto|disponivel|imediat/.test(fold(propertyStage))
  const lifestyleTag = purpose === 'rental' && readyToMove
    ? '#ProntoParaMorar'
    : residential ? purpose === 'sale' ? '#SeuNovoLar' : '#MorarBem' : '#ExcelenteOportunidade'

  return {
    location: uniqueGroup([city, district, state && `Imoveis ${state}`], 3, purpose),
    purpose: uniqueGroup([purposeTag], 2, purpose),
    market: uniqueGroup(['#MercadoImobiliario', '#InvestimentoImobiliario', '#CorretorDeImoveis'], 3, purpose),
    characteristics: uniqueGroup([
      clean(context.bedrooms) && `${context.bedrooms} dormitorios`,
      clean(context.suites) && `${context.suites} suites`,
      clean(context.parkingSpaces) && `${context.parkingSpaces} vagas`,
      ...highlights,
      propertyStage,
      propertyType !== 'Imovel' && propertyType,
      categoryTag,
    ], 4, purpose),
    commercialAppeal: uniqueGroup([ctaTag, lifestyleTag, '#ExcelenteOportunidade'], 2, purpose),
    brand: ['#SmartCorretorAI'],
  }
}

export function buildOfficialHashtags(context: OfficialHashtagContext = {}): string[] {
  const groups = buildOfficialHashtagGroups(context)
  const unique = new Map<string, string>()
  for (const tag of [...groups.location, ...groups.purpose, ...groups.market, ...groups.characteristics, ...groups.commercialAppeal]) {
    if (!unique.has(fold(tag))) unique.set(fold(tag), tag)
  }
  return [...unique.values(), '#SmartCorretorAI'].slice(0, 15)
}

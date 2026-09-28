export type SmartTourPublicationOption = Readonly<{
  id: `smart-tour-caption-option-${1 | 2 | 3}`
  label: `Texto ${1 | 2 | 3}`
  text: string
}>

type SmartTourPublicationInput = {
  property?: Record<string, unknown>
  language?: string
  cta?: string
  phone?: string
}

const clean = (value: unknown) => String(value ?? '').trim()
const location = (property: Record<string, unknown>) => [property.district, property.city, property.state]
  .map(clean)
  .filter(Boolean)
  .join(', ')

const translations = {
  'pt-BR': { intro: 'Conheça', sale: 'à venda', rent: 'para locação', in: 'em', details: 'Destaques', contact: 'Entre em contato para saber mais.', bedrooms: 'dormitórios', suites: 'suítes', parking: 'vagas' },
  'en-US': { intro: 'Discover', sale: 'for sale', rent: 'for rent', in: 'in', details: 'Highlights', contact: 'Get in touch to learn more.', bedrooms: 'bedrooms', suites: 'suites', parking: 'parking spaces' },
  es: { intro: 'Descubre', sale: 'en venta', rent: 'en alquiler', in: 'en', details: 'Características', contact: 'Contáctanos para más información.', bedrooms: 'dormitorios', suites: 'suites', parking: 'plazas de garaje' },
} as const

const translatedTypes: Record<string, Record<string, string>> = {
  'en-US': { Apartamento: 'apartment', Casa: 'house', Cobertura: 'penthouse', 'Studio / Loft': 'studio / loft', Sobrado: 'townhouse', 'Terreno / Lote': 'land', Comercial: 'commercial property' },
  es: { Apartamento: 'apartamento', Casa: 'casa', Cobertura: 'ático', 'Studio / Loft': 'estudio / loft', Sobrado: 'casa adosada', 'Terreno / Lote': 'terreno', Comercial: 'inmueble comercial' },
}

const translatedCtas: Record<string, Record<string, string>> = {
  'en-US': { 'Agende sua visita': 'Schedule your visit', 'Saiba mais': 'Learn more', 'Entre em contato agora': 'Contact us now', 'Fale comigo': 'Talk to me' },
  es: { 'Agende sua visita': 'Agenda tu visita', 'Saiba mais': 'Más información', 'Entre em contato agora': 'Contáctanos ahora', 'Fale comigo': 'Habla conmigo' },
}

export function buildSmartTourPublicationOptions(input: SmartTourPublicationInput): readonly SmartTourPublicationOption[] {
  const property = input.property && typeof input.property === 'object' ? input.property : {}
  const language = input.language && input.language in translations ? input.language as keyof typeof translations : 'pt-BR'
  const copy = translations[language]
  const presentedType = presentSmartTourPropertyType(property.type)
  const propertyType = translatedTypes[language]?.[presentedType] || presentedType.toLocaleLowerCase(language)
  const subject = [
    copy.intro,
    propertyType,
    property.purpose === 'rent' ? copy.rent : copy.sale,
    location(property) && `${copy.in} ${location(property)}`,
  ].filter(Boolean).join(' ')
  const factLine = [
    property.bedrooms && `${clean(property.bedrooms)} ${copy.bedrooms}`,
    property.suites && `${clean(property.suites)} ${copy.suites}`,
    property.parkingSpaces && `${clean(property.parkingSpaces)} ${copy.parking}`,
    property.area && `${clean(property.area)} m²`,
  ].filter(Boolean).join(' · ')
  const highlights = language === 'pt-BR'
    ? presentSmartTourHighlights(property.highlights).map(clean).filter(Boolean)
    : []
  const detail = [
    factLine,
    highlights.length ? `${copy.details}: ${highlights.slice(0, 5).join(', ')}` : '',
    language === 'pt-BR' ? clean(property.description) : '',
    clean(property.price),
  ].filter(Boolean).join('\n\n')
  const localizedCta = translatedCtas[language]?.[clean(input.cta)] || clean(input.cta) || copy.contact
  const close = [localizedCta, clean(input.phone)].filter(Boolean).join('\n')
  const variants = [
    `${subject}.\n\n${detail}\n\n${close}`,
    `${highlights[0] || subject}.\n\n${subject}.\n\n${detail}\n\n${close}`,
    `${subject}.\n\n${highlights.slice(0, 3).join(' · ') || detail}\n\n${close}`,
  ].map(value => value.replace(/\n{3,}/g, '\n\n').trim())

  return Object.freeze(variants.map((text, index) => Object.freeze({
    id: `smart-tour-caption-option-${index + 1}` as SmartTourPublicationOption['id'],
    label: `Texto ${index + 1}` as SmartTourPublicationOption['label'],
    text,
  })))
}

export function normalizePersistedSmartTourPublicationOptions(value: unknown): readonly SmartTourPublicationOption[] {
  if (!Array.isArray(value) || value.length !== 3) return []
  const normalized = value.map((item, index) => {
    const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
    const expectedId = `smart-tour-caption-option-${index + 1}`
    const text = typeof record.text === 'string' ? record.text : ''
    if (record.id !== expectedId || !text || text.length > 2200) return null
    return Object.freeze({ id: expectedId, label: `Texto ${index + 1}`, text }) as SmartTourPublicationOption
  })
  return normalized.every(Boolean) ? Object.freeze(normalized as SmartTourPublicationOption[]) : []
}
import { presentSmartTourHighlights, presentSmartTourPropertyType } from './presentation.ts'

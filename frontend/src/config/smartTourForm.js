export const SMART_TOUR_PROPERTY_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Terreno / Lote', 'Comercial']

export const SMART_TOUR_MEASURE_FIELDS = Object.freeze({
  residential: ['bedrooms', 'suites', 'parkingSpaces', 'area'],
  commercial: ['parkingSpaces', 'area'],
  land: ['area'],
})

export const SMART_TOUR_HIGHLIGHTS = Object.freeze({
  residential: [
    'Próximo ao metrô', 'Lazer completo', 'Varanda gourmet', 'Vista livre', 'Piscina',
    'Academia', 'Segurança 24h', 'Iluminação natural', 'Acabamento premium',
    'Ambientes integrados', 'Bairro valorizado', 'Andar alto', 'Elevador', 'Portaria 24h',
  ],
  house: [
    'Quintal', 'Área gourmet', 'Churrasqueira', 'Piscina', 'Jardim', 'Sobrado',
    'Edícula', 'Escritório', 'Suíte master', 'Closet', 'Garagem coberta',
    'Rua tranquila', 'Segurança 24h', 'Iluminação natural',
  ],
  commercial: [
    'Localização estratégica', 'Alto fluxo de pessoas', 'Fácil acesso', 'Estacionamento',
    'Vitrine', 'Recepção', 'Salas privativas', 'Ar-condicionado', 'Elevador',
    'Acessibilidade', 'Segurança 24h', 'Pronto para uso', 'Zoneamento comercial',
  ],
  land: [
    'Topografia plana', 'Esquina', 'Rua asfaltada', 'Infraestrutura completa',
    'Rede de água', 'Rede elétrica', 'Área valorizada', 'Fácil acesso',
    'Próximo ao comércio', 'Documentação regular', 'Potencial construtivo',
  ],
})

export function getSmartTourPropertyKind(type) {
  if (type === 'Comercial') return 'commercial'
  if (type === 'Terreno / Lote') return 'land'
  if (type === 'Casa') return 'house'
  return 'residential'
}

export function getSmartTourMeasureFields(type) {
  const kind = getSmartTourPropertyKind(type)
  return SMART_TOUR_MEASURE_FIELDS[kind === 'house' ? 'residential' : kind]
}

export function getSmartTourHighlights(type) {
  return SMART_TOUR_HIGHLIGHTS[getSmartTourPropertyKind(type)]
}

export function normalizeSmartTourDistrict(value = '') {
  return String(value)
    .trim()
    .replace(/\s+,/g, ',')
    .replace(/,+$/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])([\p{L}])/gu, (_, separator, letter) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`)
}

export function formatSmartTourLocation({ district = '', city = '', state = '' }) {
  const normalizedDistrict = normalizeSmartTourDistrict(district)
  return [normalizedDistrict, city].filter(Boolean).join(', ') + (state ? ` - ${state}` : '')
}

export function formatSmartTourCurrency(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 12)
  return digits ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(digits)) : ''
}

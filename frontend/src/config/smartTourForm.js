export const SMART_TOUR_PROPERTY_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Studio / Loft', 'Terreno / Lote', 'Comercial']

export const SMART_TOUR_MEASURE_FIELDS = Object.freeze({
  residential: ['bedrooms', 'suites', 'parkingSpaces', 'area'],
  commercial: ['parkingSpaces', 'area'],
  land: ['area'],
})

export const SMART_TOUR_MEASURE_OPTIONS = Object.freeze({
  bedrooms: ['0', '1', '2', '3', '4', '5+'],
  suites: ['0', '1', '2', '3', '4+'],
  parkingSpaces: ['0', '1', '2', '3', '4+'],
})

export const SMART_TOUR_HIGHLIGHT_GROUPS = Object.freeze({
  residential: [
    { title: 'Localização', items: ['Próximo ao metrô', 'Próximo ao comércio', 'Próximo a escolas', 'Próximo a parques', 'Próximo a hospitais', 'Fácil acesso', 'Bairro valorizado', 'Vista livre'] },
    { title: 'Condomínio', items: ['Lazer completo', 'Piscina', 'Academia', 'Churrasqueira', 'Salão de festas', 'Playground', 'Quadra esportiva', 'Quadra de tênis', 'Pet Place', 'Pista de caminhada', 'Coworking', 'Portaria 24h', 'Segurança 24h', 'Monitoramento', 'Elevador', 'Ponto para carregamento de carro elétrico'] },
    { title: 'Diferenciais do imóvel', items: ['Alto padrão', 'Mobiliado', 'Móveis planejados', 'Varanda gourmet', 'Depósito privativo', 'Vagas demarcadas', 'Ar-condicionado', 'Iluminação natural', 'Ambientes integrados', 'Andar alto', 'Acabamento premium'] },
  ],
  house: [
    { title: 'Localização', items: ['Próximo ao comércio', 'Próximo a escolas', 'Próximo a parques', 'Próximo a hospitais', 'Fácil acesso', 'Bairro valorizado', 'Rua tranquila'] },
    { title: 'Condomínio', items: ['Casa em condomínio fechado', 'Lazer completo', 'Academia', 'Salão de festas', 'Playground', 'Quadra esportiva', 'Pet Place', 'Portaria 24h', 'Segurança 24h', 'Monitoramento'] },
    { title: 'Diferenciais do imóvel', items: ['Casa térrea', 'Sobrado', 'Casa em rua aberta', 'Quintal', 'Jardim', 'Área gourmet', 'Piscina', 'Churrasqueira', 'Edícula', 'Escritório', 'Suíte master', 'Closet', 'Garagem coberta', 'Alto padrão', 'Mobiliado', 'Móveis planejados', 'Ar-condicionado', 'Iluminação natural', 'Ambientes integrados', 'Acabamento premium'] },
  ],
  commercial: [
    { title: 'Destaques comerciais', items: [
      'Localização estratégica', 'Alto fluxo de pessoas', 'Fácil acesso', 'Estacionamento',
      'Vitrine', 'Recepção', 'Salas privativas', 'Ar-condicionado', 'Elevador',
      'Acessibilidade', 'Segurança 24h', 'Pronto para uso', 'Zoneamento comercial',
      'Internet de alta velocidade', 'Cabeamento estruturado', 'Piso elevado', 'Energia trifásica',
      'Energia solar', 'Ponto para carregamento de carro elétrico', 'Coworking', 'Sala de reuniões',
      'Copa', 'Banheiros privativos', 'Depósito', 'Refeitório', 'Controle de acesso',
      'Monitoramento por câmeras', 'Estacionamento para clientes', 'Acesso para carga e descarga',
      'Doca', 'Próximo ao transporte público', 'Fácil acesso às principais vias', 'Ideal para clínica',
      'Ideal para escritório', 'Ideal para coworking', 'Ideal para loja', 'Ideal para logística',
      'Recém-reformado',
    ] },
  ],
  land: [
    { title: 'Destaques do terreno', items: [
      'Topografia plana', 'Esquina', 'Rua asfaltada', 'Infraestrutura completa',
      'Rede de água', 'Rede elétrica', 'Área valorizada', 'Fácil acesso',
      'Próximo ao comércio', 'Documentação regular', 'Potencial construtivo',
    ] },
  ],
})

export const SMART_TOUR_HIGHLIGHTS = Object.freeze(Object.fromEntries(
  Object.entries(SMART_TOUR_HIGHLIGHT_GROUPS).map(([kind, groups]) => [kind, [...new Set(groups.flatMap(group => group.items))]]),
))

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

export function getSmartTourHighlightGroups(type) {
  return SMART_TOUR_HIGHLIGHT_GROUPS[getSmartTourPropertyKind(type)]
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

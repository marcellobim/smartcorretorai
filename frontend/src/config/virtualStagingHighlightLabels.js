import { VIRTUAL_STAGING_HIGHLIGHT_GROUPS } from './virtualStagingForm.js'

const activeValues = Object.freeze([...new Set(
  Object.values(VIRTUAL_STAGING_HIGHLIGHT_GROUPS).flatMap(groups => groups.flatMap(group => group.items)),
)])

const EN_US = Object.freeze({
  'Próximo ao metrô': 'Near public transit',
  'Próximo ao comércio': 'Near shops',
  'Próximo a escolas': 'Near schools',
  'Próximo a universidades': 'Near universities',
  'Próximo a hospitais': 'Near hospitals',
  'Próximo a parques': 'Near parks',
  'Próximo ao shopping': 'Near shopping',
  'Próximo à praia': 'Near the beach',
  'Próximo ao aeroporto': 'Near the airport',
  'Próximo ao centro': 'Near downtown',
  'Fácil acesso': 'Easy access',
  'Próximo a rodovias': 'Near major highways',
  'Rua tranquila': 'Quiet street',
  'Bairro valorizado': 'Desirable neighborhood',
  'Região nobre': 'Prestigious area',
  'Vista livre': 'Unobstructed view',
  'Frente para praça': 'Facing a public square',
  'Lazer completo': 'Full leisure amenities',
  'Piscina': 'Swimming pool',
  'Piscina aquecida': 'Heated pool',
  'Academia': 'Fitness center',
  'Churrasqueira': 'Barbecue area',
  'Espaço gourmet': 'Gourmet entertaining area',
  'Salão de festas': 'Party room',
  'Salão de jogos': 'Game room',
  'Playground': 'Playground',
  'Brinquedoteca': "Children's playroom",
  'Coworking': 'Coworking space',
  'Pet Place': 'Pet area',
  'Quadra esportiva': 'Sports court',
  'Quadra de tênis': 'Tennis court',
  'Sauna': 'Sauna',
  'Spa': 'Spa',
  'Cinema': 'Screening room',
  'Mini mercado': 'On-site convenience store',
  'Bicicletário': 'Bike storage',
  'Lavanderia coletiva': 'Shared laundry',
  'Portaria 24h': '24-hour concierge',
  'Segurança 24h': '24-hour security',
  'Monitoramento': 'Security monitoring',
  'Elevador': 'Elevator',
  'Gerador': 'Backup generator',
  'Energia solar': 'Solar energy',
  'Alto padrão': 'Luxury',
  'Reformado': 'Renovated',
  'Novo': 'New',
  'Nunca habitado': 'Never occupied',
  'Semi mobiliado': 'Partially furnished',
  'Mobiliado': 'Furnished',
  'Móveis planejados': 'Custom built-in cabinetry',
  'Closet': 'Walk-in closet',
  'Escritório': 'Office',
  'Home office': 'Home office',
  'Lavabo': 'Powder room',
  'Suíte master': 'Primary suite',
  'Cozinha americana': 'Open-concept kitchen',
  'Despensa': 'Pantry',
  'Área de serviço': 'Laundry area',
  'Dependência': 'Staff quarters',
  'Varanda gourmet': 'Gourmet balcony',
  'Sacada': 'Balcony',
  'Sacada envidraçada': 'Enclosed glass balcony',
  'Terraço': 'Terrace',
  'Quintal': 'Backyard',
  'Jardim': 'Garden',
  'Piscina privativa': 'Private pool',
  'Jacuzzi': 'Hot tub',
  'Churrasqueira privativa': 'Private barbecue area',
  'Piso porcelanato': 'Porcelain tile flooring',
  'Piso vinílico': 'Vinyl flooring',
  'Mármore': 'Marble',
  'Granito': 'Granite',
  'Pé-direito alto': 'High ceilings',
  'Excelente ventilação': 'Excellent ventilation',
  'Sol da manhã': 'Morning sun',
  'Sol da tarde': 'Afternoon sun',
  'Iluminação natural': 'Natural light',
  'Ambientes integrados': 'Open-plan living',
  'Vista panorâmica': 'Panoramic view',
  'Vista permanente': 'Protected view',
  'Vista para o mar': 'Ocean view',
  'Vista para parque': 'Park view',
  'Vista para cidade': 'City view',
  'Ar-condicionado': 'Air conditioning',
  'Fechadura eletrônica': 'Smart lock',
  'Acabamento premium': 'Premium finishes',
  'Vagas demarcadas': 'Assigned parking spaces',
  'Vaga coberta': 'Covered parking',
  'Box privativo': 'Private storage unit',
  'Carregador para veículo elétrico': 'EV charger',
  'Aquecimento solar': 'Solar water heating',
  'Reuso de água': 'Water reuse system',
  'Preparação para carro elétrico': 'EV-ready infrastructure',
  'Casa em condomínio fechado': 'Home in a gated community',
  'Casa térrea': 'Single-story home',
  'Sobrado': 'Two-story home',
  'Casa em rua aberta': 'Home on a public street',
  'Área gourmet': 'Gourmet entertaining area',
  'Edícula': 'Detached guest house',
  'Recepção': 'Reception area',
  'Copa': 'Kitchenette',
  'Sala de reunião': 'Meeting room',
  'Excelente visibilidade': 'Excellent visibility',
  'Frente para avenida': 'Fronting a major avenue',
  'Alto fluxo': 'High traffic',
  'Ideal para clínica': 'Ideal for a medical practice',
  'Ideal para escritório': 'Ideal for an office',
  'Ideal para loja': 'Ideal for retail',
  'Localização estratégica': 'Strategic location',
  'Alto fluxo de pessoas': 'High foot traffic',
  'Estacionamento': 'Parking',
  'Vitrine': 'Storefront display window',
  'Salas privativas': 'Private offices',
  'Acessibilidade': 'Accessibility',
  'Pronto para uso': 'Move-in ready',
  'Zoneamento comercial': 'Commercial zoning',
  'Internet de alta velocidade': 'High-speed internet',
  'Cabeamento estruturado': 'Structured cabling',
  'Piso elevado': 'Raised flooring',
  'Energia trifásica': 'Three-phase power',
  'Sala de reuniões': 'Conference room',
  'Banheiros privativos': 'Private restrooms',
  'Depósito': 'Storage room',
  'Refeitório': 'Break room',
  'Controle de acesso': 'Access control',
  'Monitoramento por câmeras': 'Security camera monitoring',
  'Estacionamento para clientes': 'Customer parking',
  'Acesso para carga e descarga': 'Loading and unloading access',
  'Doca': 'Loading dock',
  'Ponto para carregamento de carro elétrico': 'EV charging point',
  'Próximo ao transporte público': 'Near public transportation',
  'Fácil acesso às principais vias': 'Easy access to major routes',
  'Ideal para coworking': 'Ideal for coworking',
  'Ideal para logística': 'Ideal for logistics',
  'Recém-reformado': 'Recently renovated',
  'Plano': 'Level lot',
  'Esquina': 'Corner lot',
  'Murado': 'Walled',
  'Documentação regular': 'Clear documentation',
  'Alto potencial construtivo': 'High development potential',
  'Zoneamento residencial': 'Residential zoning',
  'Excelente investimento': 'Excellent investment opportunity',
  'Rua asfaltada': 'Paved street',
  'Infraestrutura completa': 'Full infrastructure',
  'Rede de água': 'Water service',
  'Rede elétrica': 'Electric service',
  'Área valorizada': 'Highly desirable area',
})

// Values here are market-specific rather than merely untranslated.
export const VIRTUAL_STAGING_BR_ONLY_HIGHLIGHTS = Object.freeze([])

const brOnlyValues = new Set(VIRTUAL_STAGING_BR_ONLY_HIGHLIGHTS)
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const GROUP_LABELS = Object.freeze({
  'Localização': Object.freeze({ ptBR: 'Localização', enUS: 'Location' }),
  'Condomínio': Object.freeze({ ptBR: 'Condomínio', enUS: 'Condominium' }),
  'Diferenciais do imóvel': Object.freeze({ ptBR: 'Diferenciais do imóvel', enUS: 'Property highlights' }),
  'Garagem': Object.freeze({ ptBR: 'Garagem', enUS: 'Parking' }),
  'Sustentabilidade': Object.freeze({ ptBR: 'Sustentabilidade', enUS: 'Sustainability' }),
  'Comercial': Object.freeze({ ptBR: 'Comercial', enUS: 'Commercial' }),
  'Terrenos': Object.freeze({ ptBR: 'Terrenos', enUS: 'Land' }),
})

export const VIRTUAL_STAGING_HIGHLIGHT_LABELS = Object.freeze(Object.fromEntries(
  activeValues.map(value => [value, Object.freeze({
    ptBR: value,
    ...(hasOwn(EN_US, value) ? { enUS: EN_US[value] } : {}),
    ...(brOnlyValues.has(value) ? { brOnly: true } : {}),
  })]),
))

export function getVirtualStagingHighlightLabel(value, { locale = 'pt-BR', market = 'BR' } = {}) {
  const label = VIRTUAL_STAGING_HIGHLIGHT_LABELS[value]
  if (!label) return value
  if (locale === 'en-US' && market === 'US' && !label.brOnly && label.enUS) return label.enUS
  if (locale === 'en-US' && !label.brOnly && label.enUS) return label.enUS
  return label.ptBR || value
}

export function getVirtualStagingHighlightGroupLabel(value, { locale = 'pt-BR' } = {}) {
  const label = GROUP_LABELS[value]
  if (!label) return value
  return locale === 'en-US' ? label.enUS : label.ptBR
}

export function isVirtualStagingHighlightAvailableForMarket(value, market = 'BR') {
  return market !== 'US' || !brOnlyValues.has(value)
}

export function getVirtualStagingActiveHighlightValues() {
  return activeValues
}

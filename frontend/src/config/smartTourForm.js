export const SMART_TOUR_PROPERTY_TYPES = Object.freeze([
  { value: 'Apartamento', labelKey: 'smartTour.propertyTypes.apartment' },
  { value: 'Casa', labelKey: 'smartTour.propertyTypes.house' },
  { value: 'Cobertura', labelKey: 'smartTour.propertyTypes.penthouse' },
  { value: 'Studio / Loft', labelKey: 'smartTour.propertyTypes.studioLoft' },
  { value: 'Terreno / Lote', labelKey: 'smartTour.propertyTypes.landLot' },
  { value: 'Comercial', labelKey: 'smartTour.propertyTypes.commercial' },
])

export const SMART_TOUR_US_PROPERTY_TYPES = Object.freeze([
  { value: 'us_single_family_home', labelKey: 'smartTour.propertyTypes.usSingleFamilyHome' },
  { value: 'us_condo', labelKey: 'smartTour.propertyTypes.usCondo' },
  { value: 'us_townhouse', labelKey: 'smartTour.propertyTypes.usTownhouse' },
  { value: 'us_multi_family', labelKey: 'smartTour.propertyTypes.usMultiFamily' },
  { value: 'us_apartment', labelKey: 'smartTour.propertyTypes.usApartment' },
  { value: 'us_studio', labelKey: 'smartTour.propertyTypes.usStudio' },
  { value: 'us_land_lot', labelKey: 'smartTour.propertyTypes.usLandLot' },
  { value: 'us_commercial', labelKey: 'smartTour.propertyTypes.usCommercial' },
])

export const SMART_TOUR_PROPERTY_TYPES_BY_MARKET = Object.freeze({
  BR: SMART_TOUR_PROPERTY_TYPES,
  US: SMART_TOUR_US_PROPERTY_TYPES,
})
export const SMART_TOUR_RENTAL_STAGES = Object.freeze(['Pronto para morar', 'Disponível já', 'Vago'])

export function getSmartTourStageOptions(purpose, saleOptions) {
  return purpose === 'rent' ? SMART_TOUR_RENTAL_STAGES : saleOptions
}

export function getSmartTourPropertyTypes(purpose, options = {}) {
  // Arrays remain supported for existing callers that supply a custom BR catalog.
  const propertyTypes = Array.isArray(options)
    ? options
    : SMART_TOUR_PROPERTY_TYPES_BY_MARKET[options?.market] || SMART_TOUR_PROPERTY_TYPES
  return purpose === 'rent'
    ? propertyTypes.filter(type => type.value !== 'Terreno / Lote' && type.value !== 'us_land_lot')
    : propertyTypes
}

export const SMART_TOUR_MEASURE_FIELDS = Object.freeze({
  residential: ['bedrooms', 'suites', 'parkingSpaces', 'area'],
  commercial: ['parkingSpaces', 'area'],
  land: ['area'],
})

export const SMART_TOUR_MEASURE_OPTIONS = Object.freeze({
  bedrooms: ['0', '1', '2', '3', '4', '5+'],
  suites: ['0', '1', '2', '3', '4+'],
  bathrooms: ['0', '1', '2', '3', '4+'],
  parkingSpaces: ['0', '1', '2', '3', '4+'],
})

export const SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY = Object.freeze({
  'Localização': Object.freeze([
    'Próximo ao metrô', 'Próximo ao comércio', 'Próximo a escolas', 'Próximo a universidades',
    'Próximo a hospitais', 'Próximo a parques', 'Próximo ao shopping', 'Próximo à praia',
    'Próximo ao aeroporto', 'Próximo ao centro', 'Fácil acesso', 'Próximo a rodovias',
    'Rua tranquila', 'Bairro valorizado', 'Região nobre', 'Vista livre', 'Frente para praça',
  ]),
  'Condomínio': Object.freeze([
    'Lazer completo', 'Piscina', 'Piscina aquecida', 'Academia', 'Churrasqueira', 'Espaço gourmet',
    'Salão de festas', 'Salão de jogos', 'Playground', 'Brinquedoteca', 'Coworking', 'Pet Place',
    'Quadra esportiva', 'Quadra de tênis', 'Sauna', 'Spa', 'Cinema', 'Mini mercado', 'Bicicletário',
    'Lavanderia coletiva', 'Portaria 24h', 'Segurança 24h', 'Monitoramento', 'Elevador', 'Gerador',
    'Energia solar',
  ]),
  'Diferenciais do imóvel': Object.freeze([
    'Alto padrão', 'Reformado', 'Novo', 'Nunca habitado', 'Semi mobiliado', 'Mobiliado',
    'Móveis planejados', 'Closet', 'Escritório', 'Home office', 'Lavabo', 'Suíte master',
    'Cozinha americana', 'Despensa', 'Área de serviço', 'Dependência', 'Varanda gourmet', 'Sacada',
    'Sacada envidraçada', 'Terraço', 'Quintal', 'Jardim', 'Piscina privativa', 'Jacuzzi',
    'Churrasqueira privativa', 'Piso porcelanato', 'Piso vinílico', 'Mármore', 'Granito',
    'Pé-direito alto', 'Excelente ventilação', 'Sol da manhã', 'Sol da tarde', 'Iluminação natural',
    'Ambientes integrados', 'Vista panorâmica', 'Vista permanente', 'Vista para o mar',
    'Vista para parque', 'Vista para cidade', 'Ar-condicionado', 'Fechadura eletrônica',
    'Acabamento premium',
  ]),
  'Garagem': Object.freeze([
    'Vagas demarcadas', 'Vaga coberta', 'Box privativo', 'Carregador para veículo elétrico',
  ]),
  'Sustentabilidade': Object.freeze([
    'Energia solar', 'Aquecimento solar', 'Reuso de água', 'Preparação para carro elétrico',
  ]),
  'Comercial': Object.freeze([
    'Recepção', 'Copa', 'Sala de reunião', 'Excelente visibilidade', 'Frente para avenida',
    'Alto fluxo', 'Ideal para clínica', 'Ideal para escritório', 'Ideal para loja',
    'Localização estratégica', 'Alto fluxo de pessoas', 'Estacionamento', 'Vitrine', 'Salas privativas',
    'Ar-condicionado', 'Elevador', 'Acessibilidade', 'Segurança 24h', 'Pronto para uso',
    'Zoneamento comercial', 'Internet de alta velocidade', 'Cabeamento estruturado',
    'Piso elevado', 'Energia trifásica', 'Coworking', 'Sala de reuniões', 'Banheiros privativos',
    'Depósito', 'Refeitório', 'Controle de acesso', 'Monitoramento por câmeras',
    'Estacionamento para clientes', 'Acesso para carga e descarga', 'Doca',
    'Ponto para carregamento de carro elétrico', 'Próximo ao transporte público',
    'Fácil acesso às principais vias', 'Ideal para coworking',
    'Ideal para logística', 'Recém-reformado',
  ]),
  'Terrenos': Object.freeze([
    'Plano', 'Esquina', 'Murado', 'Documentação regular', 'Alto potencial construtivo',
    'Zoneamento residencial', 'Zoneamento comercial', 'Excelente investimento', 'Rua asfaltada',
    'Infraestrutura completa', 'Rede de água', 'Rede elétrica', 'Área valorizada',
  ]),
})

const masterGroup = (title, additions = []) => ({
  title,
  items: [...new Set([...additions, ...SMART_TOUR_MASTER_HIGHLIGHT_LIBRARY[title]])],
})

const withoutItemsAlreadyUsed = groups => {
  const used = new Set()
  return groups.map(group => ({
    ...group,
    items: group.items.filter(item => !used.has(item) && used.add(item)),
  }))
}

const RESIDENTIAL_GROUPS = withoutItemsAlreadyUsed([
  masterGroup('Localização'), masterGroup('Condomínio'), masterGroup('Diferenciais do imóvel'),
  masterGroup('Garagem'), masterGroup('Sustentabilidade'),
])

export const SMART_TOUR_HIGHLIGHT_GROUPS = Object.freeze({
  residential: RESIDENTIAL_GROUPS,
  house: withoutItemsAlreadyUsed([
    masterGroup('Localização'),
    masterGroup('Condomínio', ['Casa em condomínio fechado']),
    masterGroup('Diferenciais do imóvel', ['Casa térrea', 'Sobrado', 'Casa em rua aberta', 'Área gourmet', 'Churrasqueira', 'Edícula']),
    masterGroup('Garagem'), masterGroup('Sustentabilidade'),
  ]),
  commercial: withoutItemsAlreadyUsed([
    masterGroup('Localização'), masterGroup('Comercial'), masterGroup('Garagem'), masterGroup('Sustentabilidade'),
  ]),
  land: withoutItemsAlreadyUsed([
    masterGroup('Localização'), masterGroup('Terrenos'),
  ]),
})

const US_PROPERTY_TYPES = Object.freeze({
  singleFamilyHome: 'us_single_family_home', condo: 'us_condo', townhouse: 'us_townhouse', multiFamily: 'us_multi_family',
  apartment: 'us_apartment', studio: 'us_studio', landLot: 'us_land_lot', commercial: 'us_commercial',
})

const US_RESIDENTIAL_TYPES = Object.freeze([
  US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily,
  US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio,
])

const usHighlight = (value, labelKey, types) => Object.freeze({ value, labelKey, types: Object.freeze(types) })

export const SMART_TOUR_US_HIGHLIGHT_GROUPS = Object.freeze([
  Object.freeze({ id: 'location', labelKey: 'smartTour.highlightGroups.us.location', items: Object.freeze([
    usHighlight('us_near_downtown', 'smartTour.highlights.us.nearDowntown', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_near_schools', 'smartTour.highlights.us.nearSchools', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.landLot]),
    usHighlight('us_near_parks', 'smartTour.highlights.us.nearParks', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio, US_PROPERTY_TYPES.landLot]),
    usHighlight('us_near_shopping', 'smartTour.highlights.us.nearShopping', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_easy_highway_access', 'smartTour.highlights.us.easyHighwayAccess', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.landLot, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_quiet_street', 'smartTour.highlights.us.quietStreet', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.landLot]),
  ]) }),
  Object.freeze({ id: 'communityHoa', labelKey: 'smartTour.highlightGroups.us.communityHoa', items: Object.freeze([
    usHighlight('us_community_pool', 'smartTour.highlights.us.communityPool', [US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio]),
    usHighlight('us_fitness_center', 'smartTour.highlights.us.fitnessCenter', [US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio]),
    usHighlight('us_clubhouse', 'smartTour.highlights.us.clubhouse', [US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment]),
    usHighlight('us_gated_community', 'smartTour.highlights.us.gatedCommunity', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily]),
  ]) }),
  Object.freeze({ id: 'propertyFeatures', labelKey: 'smartTour.highlightGroups.us.propertyFeatures', items: Object.freeze([
    usHighlight('us_updated', 'smartTour.highlights.us.updated', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_new_construction', 'smartTour.highlights.us.newConstruction', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_move_in_ready', 'smartTour.highlights.us.moveInReady', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_open_floor_plan', 'smartTour.highlights.us.openFloorPlan', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_home_office', 'smartTour.highlights.us.homeOffice', US_RESIDENTIAL_TYPES),
    usHighlight('us_walk_in_closet', 'smartTour.highlights.us.walkInCloset', US_RESIDENTIAL_TYPES),
    usHighlight('us_gourmet_kitchen', 'smartTour.highlights.us.gourmetKitchen', US_RESIDENTIAL_TYPES),
    usHighlight('us_covered_patio', 'smartTour.highlights.us.coveredPatio', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.condo]),
    usHighlight('us_fenced_yard', 'smartTour.highlights.us.fencedYard', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily]),
    usHighlight('us_high_ceilings', 'smartTour.highlights.us.highCeilings', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_natural_light', 'smartTour.highlights.us.naturalLight', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_fireplace', 'smartTour.highlights.us.fireplace', US_RESIDENTIAL_TYPES),
  ]) }),
  Object.freeze({ id: 'parking', labelKey: 'smartTour.highlightGroups.us.parking', items: Object.freeze([
    usHighlight('us_garage', 'smartTour.highlights.us.garage', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_covered_parking', 'smartTour.highlights.us.coveredParking', [US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_assigned_parking', 'smartTour.highlights.us.assignedParking', [US_PROPERTY_TYPES.condo, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.apartment, US_PROPERTY_TYPES.studio]),
  ]) }),
  Object.freeze({ id: 'efficiencySmartHome', labelKey: 'smartTour.highlightGroups.us.efficiencySmartHome', items: Object.freeze([
    usHighlight('us_solar_panels', 'smartTour.highlights.us.solarPanels', [US_PROPERTY_TYPES.singleFamilyHome, US_PROPERTY_TYPES.townhouse, US_PROPERTY_TYPES.multiFamily, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_energy_efficient', 'smartTour.highlights.us.energyEfficient', [...US_RESIDENTIAL_TYPES, US_PROPERTY_TYPES.commercial]),
    usHighlight('us_smart_home_features', 'smartTour.highlights.us.smartHomeFeatures', US_RESIDENTIAL_TYPES),
  ]) }),
  Object.freeze({ id: 'commercial', labelKey: 'smartTour.highlightGroups.us.commercial', items: Object.freeze([
    usHighlight('us_high_visibility', 'smartTour.highlights.us.highVisibility', [US_PROPERTY_TYPES.commercial]),
    usHighlight('us_storefront', 'smartTour.highlights.us.storefront', [US_PROPERTY_TYPES.commercial]),
    usHighlight('us_ready_to_occupy', 'smartTour.highlights.us.readyToOccupy', [US_PROPERTY_TYPES.commercial]),
    usHighlight('us_customer_parking', 'smartTour.highlights.us.customerParking', [US_PROPERTY_TYPES.commercial]),
    usHighlight('us_loading_access', 'smartTour.highlights.us.loadingAccess', [US_PROPERTY_TYPES.commercial]),
  ]) }),
  Object.freeze({ id: 'landLot', labelKey: 'smartTour.highlightGroups.us.landLot', items: Object.freeze([
    usHighlight('us_corner_lot', 'smartTour.highlights.us.cornerLot', [US_PROPERTY_TYPES.landLot]),
    usHighlight('us_cleared_lot', 'smartTour.highlights.us.clearedLot', [US_PROPERTY_TYPES.landLot]),
    usHighlight('us_utilities_available', 'smartTour.highlights.us.utilitiesAvailable', [US_PROPERTY_TYPES.landLot]),
    usHighlight('us_residential_zoning', 'smartTour.highlights.us.residentialZoning', [US_PROPERTY_TYPES.landLot]),
    usHighlight('us_paved_road', 'smartTour.highlights.us.pavedRoad', [US_PROPERTY_TYPES.landLot]),
  ]) }),
])

export const SMART_TOUR_HIGHLIGHT_CATALOG_BY_MARKET = Object.freeze({
  BR: SMART_TOUR_HIGHLIGHT_GROUPS,
  US: SMART_TOUR_US_HIGHLIGHT_GROUPS,
})

export const SMART_TOUR_HIGHLIGHTS = Object.freeze(Object.fromEntries(
  Object.entries(SMART_TOUR_HIGHLIGHT_GROUPS).map(([kind, groups]) => [kind, [...new Set(groups.flatMap(group => group.items))]]),
))

export function getSmartTourPropertyKind(type) {
  if (type === 'Comercial') return 'commercial'
  if (type === 'Terreno / Lote') return 'land'
  if (type === 'Casa') return 'house'
  if (type === 'us_commercial') return 'commercial'
  if (type === 'us_land_lot') return 'land'
  if (type === 'us_single_family_home' || type === 'us_townhouse') return 'house'
  return 'residential'
}

export function getSmartTourMeasureFields(type, { market = 'BR' } = {}) {
  const kind = getSmartTourPropertyKind(type)
  const fields = SMART_TOUR_MEASURE_FIELDS[kind === 'house' ? 'residential' : kind]
  return market === 'US' ? fields.map(field => field === 'suites' ? 'bathrooms' : field) : fields
}

export function getSmartTourHighlights(type, options = {}) {
  return getSmartTourHighlightGroups(type, options)
    .flatMap(group => group.items)
    .map(item => typeof item === 'string' ? item : item.value)
}

export function getSmartTourHighlightGroups(type, options = {}) {
  if (options?.market !== 'US') return SMART_TOUR_HIGHLIGHT_GROUPS[getSmartTourPropertyKind(type)]
  return SMART_TOUR_US_HIGHLIGHT_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => item.types.includes(type)) }))
    .filter(group => group.items.length > 0)
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

export function formatSmartTourCurrency(value = '', market = 'BR') {
  const digits = String(value).replace(/\D/g, '').slice(0, 12)
  if (!digits) return ''
  const isUs = market === 'US'
  return new Intl.NumberFormat(isUs ? 'en-US' : 'pt-BR', { style: 'currency', currency: isUs ? 'USD' : 'BRL', maximumFractionDigits: 0 }).format(Number(digits))
}

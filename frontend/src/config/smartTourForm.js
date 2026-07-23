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

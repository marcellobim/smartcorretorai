type JsonRecord = Record<string, unknown>

export type SmartCarouselLocale = Readonly<{ language: 'pt-BR' | 'en-US'; market: 'BR' | 'US' }>

const PRESENTATION: Record<string, Record<string, string>> = {
  'pt-BR': {
    'Pronto para morar': 'Pronto para morar', 'Lançamento': 'Lançamento', 'Em construção': 'Em construção', 'Pronto para mudar': 'Pronto para mudar',
    'Apartamento': 'Apartamento', 'Casa': 'Casa', 'Cobertura': 'Cobertura', 'Studio / Loft': 'Studio / Loft', 'Sobrado': 'Sobrado', 'Terreno / Lote': 'Terreno / Lote',
  },
  'en-US': {
    'Pronto para morar': 'Move-in ready', 'Lançamento': 'New development', 'Em construção': 'Under construction', 'Pronto para mudar': 'Available now',
    'Apartamento': 'Apartment', 'Casa': 'House', 'Cobertura': 'Penthouse', 'Studio / Loft': 'Studio / Loft', 'Sobrado': 'Townhouse', 'Terreno / Lote': 'Land / Lot',
  },
}

const EN_HIGHLIGHTS: Record<string, string> = {
  'Próximo ao metrô': 'Near the subway', 'Próximo ao trem': 'Near the train', 'Próximo ao shopping': 'Near shopping', 'Próximo a escolas': 'Near schools', 'Próximo a universidades': 'Near universities', 'Próximo a hospitais': 'Near hospitals', 'Próximo a mercados': 'Near grocery stores', 'Fácil acesso às principais vias': 'Easy access to major roads', 'Bairro valorizado': 'Desirable neighborhood', 'Região em crescimento': 'Growing area', 'Vista livre': 'Open view',
  'Lazer completo': 'Full amenity package', 'Piscina': 'Pool', 'Academia': 'Fitness center', 'Salão de festas': 'Event room', 'Espaço gourmet': 'Entertaining area', 'Churrasqueira': 'Grilling area', 'Coworking': 'Coworking space', 'Pet place': 'Pet area', 'Playground': 'Playground', 'Brinquedoteca': 'Playroom', 'Quadra esportiva': 'Sports court', 'Quadra de tênis ou beach tennis': 'Tennis or beach tennis court', 'Bicicletário': 'Bike storage', 'Portaria 24h': '24-hour staffed entry', 'Segurança 24h': '24-hour security', 'Lounge': 'Lounge', 'Mini mercado': 'On-site market', 'Lavanderia': 'Laundry', 'Piscina aquecida ou climatizada': 'Heated pool', 'Conveniência': 'Convenience services', 'Áreas verdes': 'Green spaces', 'Rooftop': 'Rooftop', 'Espaço delivery': 'Package delivery area', 'Locker para encomendas': 'Package lockers', 'Espaço wellness': 'Wellness area', 'Spa ou sauna': 'Spa or sauna',
  'Serviços tipo hotelaria': 'Hotel-style services', 'Manobrista': 'Valet', 'Ponto de carregamento para carros elétricos': 'EV charging', 'Depósito privativo por unidade': 'Private storage', 'Vagas demarcadas': 'Assigned parking',
  'Varanda': 'Balcony', 'Varanda gourmet': 'Outdoor entertaining balcony', 'Suíte': 'En-suite bedroom', 'Closet': 'Walk-in closet', 'Planta inteligente': 'Thoughtful floor plan', 'Ambientes integrados': 'Open-concept living', 'Cozinha americana': 'Open kitchen', 'Acabamento premium': 'Premium finishes', 'Iluminação natural': 'Natural light', 'Vista panorâmica': 'Panoramic view',
  'Aceita financiamento': 'Financing available', 'Usa FGTS': 'Eligible financing terms', 'Entrada facilitada': 'Flexible down payment', 'Subsídio do governo': 'Government subsidy', 'Documentação em ordem': 'Documentation in order', 'Últimas unidades': 'Limited availability', 'Condições especiais': 'Special terms', 'Alto potencial de valorização': 'Strong appreciation potential',
}

export function normalizeSmartCarouselLocale(value: unknown): SmartCarouselLocale {
  const input = value && typeof value === 'object' ? value as JsonRecord : {}
  const language = input.language === 'en-US' ? 'en-US' : 'pt-BR'
  const market = input.market === 'US' ? 'US' : 'BR'
  return Object.freeze({ language, market })
}

export function presentationLabel(value: unknown, language: SmartCarouselLocale['language']) {
  const raw = String(value ?? '').trim()
  return PRESENTATION[language][raw] || raw
}

export function presentationHighlights(value: unknown, language: SmartCarouselLocale['language']) {
  const values = Array.isArray(value) ? value : []
  return values.map(item => {
    const raw = String(item ?? '').trim()
    return language === 'en-US' ? EN_HIGHLIGHTS[raw] || '' : raw
  }).filter(Boolean)
}

export function presentationCta(value: unknown, language: SmartCarouselLocale['language']) {
  const raw = String(value ?? '').trim()
  if (language !== 'en-US') return raw
  return ({ 'Saiba Mais': 'Learn more', 'Agende sua visita': 'Schedule a tour', 'Entre em contato agora': 'Contact us now', 'Aguardo seu contato': 'Get in touch' } as Record<string, string>)[raw] || raw
}

export function formatSmartCarouselPhone(value: unknown, market: SmartCarouselLocale['market']) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (market === 'US') {
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
    if (!/^\d{10}$/.test(digits)) return ''
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (!/^\d{10,11}$/.test(digits) || digits.slice(0, 2).startsWith('0') || digits.slice(2).startsWith('0')) return ''
  const areaCode = digits.slice(0, 2)
  const subscriber = digits.slice(2)
  return subscriber.length === 9 ? `(${areaCode}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}` : `(${areaCode}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`
}

export function buildSmartCarouselCaptions(answers: JsonRecord, locale: SmartCarouselLocale) {
  const text = (value: unknown, length: number) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length)
  const location = locale.market === 'US'
    ? [text(answers.neighborhood_community, 60), [text(answers.city, 60), text(answers.county, 60), text(answers.uf, 40), text(answers.zip_code, 12)].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    : [text(answers.district, 60), text(answers.city, 60), text(answers.uf, 2)].filter(Boolean).join(' · ')
  const bedrooms = text(answers.bedrooms, 8)
  const suites = text(answers.suites, 8)
  const parking = text(answers.parking_spaces, 8)
  const details = locale.language === 'en-US'
    ? [bedrooms && `${bedrooms} bedroom${bedrooms === '1' ? '' : 's'}`, suites && `${suites} suite${suites === '1' ? '' : 's'}`, parking && `${parking} parking space${parking === '1' ? '' : 's'}`].filter(Boolean).join(' · ')
    : [bedrooms && `${bedrooms} dormitório${bedrooms === '1' ? '' : 's'}`, suites && `${suites} suíte${suites === '1' ? '' : 's'}`, parking && `${parking} vaga${parking === '1' ? '' : 's'}`].filter(Boolean).join(' · ')
  const area = text(answers.area, 10)
  return [location, presentationLabel(answers.property_stage, locale.language), details, area && `${area} ${locale.market === 'US' ? 'sq ft' : 'm²'}`, text(answers.price_label, 50)].filter(Boolean).slice(0, 5)
}

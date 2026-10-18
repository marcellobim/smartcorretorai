type BannerMarket = 'BR' | 'US'

type BannerHighlight = {
  id: string
  ptBR: string
  enUS: string
  aliases?: string[]
}

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

// These are system-controlled Banner choices. Free-form user text intentionally
// has no entry and therefore remains literal in every market.
const HIGHLIGHTS: readonly BannerHighlight[] = Object.freeze([
  { id: 'near_public_transit', ptBR: 'Próximo ao metrô', enUS: 'Near public transit' },
  { id: 'near_commuter_rail', ptBR: 'Próximo à CPTM/trem', enUS: 'Near commuter rail' },
  { id: 'near_shopping_center', ptBR: 'Próximo ao shopping', enUS: 'Near a shopping center' },
  { id: 'near_shopping', ptBR: 'Comércio próximo', enUS: 'Near shopping', aliases: ['Próximo ao comércio'] },
  { id: 'near_parks', ptBR: 'Parque próximo', enUS: 'Near parks', aliases: ['Próximo a parques'] },
  { id: 'near_schools', ptBR: 'Escolas próximas', enUS: 'Near schools', aliases: ['Próximo a escolas'] },
  { id: 'near_hospitals', ptBR: 'Hospital próximo', enUS: 'Near hospitals', aliases: ['Próximo a hospitais'] },
  { id: 'near_universities', ptBR: 'Universidade próxima', enUS: 'Near universities', aliases: ['Próximo a universidades'] },
  { id: 'major_routes', ptBR: 'Fácil acesso às principais vias', enUS: 'Easy access to major routes' },
  { id: 'desirable_neighborhood', ptBR: 'Bairro valorizado', enUS: 'Desirable neighborhood' },
  { id: 'growing_area', ptBR: 'Região em crescimento', enUS: 'Growing area' },
  { id: 'restaurants_nearby', ptBR: 'Gastronomia', enUS: 'Restaurants nearby' },
  { id: 'convenient_mobility', ptBR: 'Mobilidade', enUS: 'Convenient mobility' },
  { id: 'full_leisure', ptBR: 'Lazer completo', enUS: 'Full leisure amenities' },
  { id: 'pool', ptBR: 'Piscina', enUS: 'Swimming pool' },
  { id: 'fitness_center', ptBR: 'Academia', enUS: 'Fitness center' },
  { id: 'party_room', ptBR: 'Salão de festas', enUS: 'Party room' },
  { id: 'gourmet_area', ptBR: 'Espaço gourmet', enUS: 'Gourmet entertaining area' },
  { id: 'barbecue_area', ptBR: 'Churrasqueira', enUS: 'Barbecue area' },
  { id: 'playground', ptBR: 'Playground', enUS: 'Playground' },
  { id: 'childrens_playroom', ptBR: 'Brinquedoteca', enUS: "Children's playroom" },
  { id: 'pet_area', ptBR: 'Pet place', enUS: 'Pet area', aliases: ['Pet Place'] },
  { id: 'coworking', ptBR: 'Coworking', enUS: 'Coworking space' },
  { id: 'sports_court', ptBR: 'Quadra', enUS: 'Sports court' },
  { id: 'rooftop', ptBR: 'Rooftop', enUS: 'Rooftop' },
  { id: 'lounge', ptBR: 'Lounge', enUS: 'Lounge' },
  { id: 'convenience_store', ptBR: 'Mini mercado', enUS: 'On-site convenience store' },
  { id: 'shared_laundry', ptBR: 'Lavanderia', enUS: 'Shared laundry' },
  { id: 'bike_storage', ptBR: 'Bicicletário', enUS: 'Bike storage' },
  { id: 'green_areas', ptBR: 'Áreas verdes', enUS: 'Green spaces' },
  { id: 'spa_sauna', ptBR: 'Spa ou sauna', enUS: 'Spa or sauna' },
  { id: 'package_room', ptBR: 'Espaço delivery', enUS: 'Package room' },
  { id: 'balcony', ptBR: 'Varanda', enUS: 'Balcony' },
  { id: 'gourmet_balcony', ptBR: 'Varanda gourmet', enUS: 'Gourmet balcony' },
  { id: 'thoughtful_layout', ptBR: 'Planta inteligente', enUS: 'Thoughtful layout' },
  { id: 'open_plan_living', ptBR: 'Ambientes integrados', enUS: 'Open-plan living' },
  { id: 'open_kitchen', ptBR: 'Cozinha americana', enUS: 'Open-concept kitchen' },
  { id: 'primary_suite', ptBR: 'Suíte', enUS: 'Primary suite' },
  { id: 'walk_in_closet', ptBR: 'Closet', enUS: 'Walk-in closet' },
  { id: 'premium_finishes', ptBR: 'Acabamento premium', enUS: 'Premium finishes' },
  { id: 'natural_light', ptBR: 'Iluminação natural', enUS: 'Natural light' },
  { id: 'open_views', ptBR: 'Vista livre', enUS: 'Open views' },
  { id: 'panoramic_views', ptBR: 'Vista panorâmica', enUS: 'Panoramic views' },
  { id: 'furnished', ptBR: 'Mobiliado', enUS: 'Furnished' },
  { id: 'renovated', ptBR: 'Reformado', enUS: 'Renovated' },
  { id: 'financing_available', ptBR: 'Aceita financiamento', enUS: 'Financing available' },
  { id: 'fgts_eligible', ptBR: 'Usa FGTS', enUS: 'FGTS eligible' },
  { id: 'government_subsidy', ptBR: 'Subsídio do governo', enUS: 'Government subsidy available' },
  { id: 'flexible_down_payment', ptBR: 'Entrada facilitada', enUS: 'Flexible down payment options' },
  { id: 'special_terms', ptBR: 'Condições especiais', enUS: 'Special terms available' },
  { id: 'clear_documentation', ptBR: 'Documentação em ordem', enUS: 'Clear documentation', aliases: ['Documentação regular'] },
  { id: 'limited_availability', ptBR: 'Últimas unidades', enUS: 'Limited availability', aliases: ['Unidades limitadas'] },
  { id: 'strong_appreciation', ptBR: 'Alto potencial de valorização', enUS: 'Strong appreciation potential' },
  { id: 'pet_friendly', ptBR: 'Aceita pet', enUS: 'Pet friendly' },
  { id: 'move_in_ready', ptBR: 'Pronto para morar', enUS: 'Move-in ready' },
  { id: 'secure_community', ptBR: 'Condomínio seguro', enUS: 'Secure community' },
  { id: 'good_lighting', ptBR: 'Boa iluminação', enUS: 'Good lighting' },
  { id: 'immediate_availability', ptBR: 'Disponibilidade imediata', enUS: 'Available now' },
  { id: 'easy_showings', ptBR: 'Fácil visita', enUS: 'Easy showings' },
  { id: 'flexible_lease', ptBR: 'Contrato facilitado', enUS: 'Flexible lease terms' },
])

const byAlias = new Map<string, BannerHighlight>()
for (const highlight of HIGHLIGHTS) {
  for (const label of [highlight.id, highlight.ptBR, highlight.enUS, ...(highlight.aliases || [])]) {
    byAlias.set(normalize(label), highlight)
  }
}

export const getBannerHighlightId = (value: unknown) => byAlias.get(normalize(value))?.id || ''

export const localizeBannerHighlight = (value: unknown, market: BannerMarket = 'BR') => {
  const literal = String(value || '').trim()
  const highlight = byAlias.get(normalize(literal))
  if (!highlight) return literal
  return market === 'US' ? highlight.enUS : highlight.ptBR
}

export const localizeBannerHighlights = (values: unknown, market: BannerMarket = 'BR') => (
  Array.isArray(values) ? values.map((value) => localizeBannerHighlight(value, market)).filter(Boolean) : []
)

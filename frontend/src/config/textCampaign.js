import {
  getSmartTourHighlightGroups,
  getSmartTourMeasureFields,
  getSmartTourPropertyTypes,
  getSmartTourStageOptions,
  normalizeSmartTourDistrict,
  SMART_TOUR_MEASURE_OPTIONS,
  SMART_TOUR_PROPERTY_TYPES,
  SMART_TOUR_RENTAL_STAGES,
} from './smartTourForm'

export const TEXT_CAMPAIGN_PRODUCT_NAME = 'Campanha de Textos'
export const TEXT_CAMPAIGN_ROUTE = '/campanha-de-textos'
export const TEXT_CAMPAIGN_MAX_HIGHLIGHTS = 15

export const TEXT_CAMPAIGN_SALE_STAGES = Object.freeze([
  'Pré-lançamento',
  'Lançamento',
  'Em obras',
  'Pronto para morar',
])

export const TEXT_CAMPAIGN_STEPS = Object.freeze([
  { title: 'Objetivo', subtitle: 'Venda ou locação' },
  { title: 'Imóvel', subtitle: 'Tipo e ficha' },
  { title: 'Localização', subtitle: 'Estado, cidade e bairro' },
  { title: 'Diferenciais e condições', subtitle: 'Argumentos reais' },
  { title: 'Revisão e criação', subtitle: 'Confira o briefing' },
])

export const TEXT_CAMPAIGN_CTA_OPTIONS = Object.freeze([
  'Fale comigo',
  'Saiba mais',
  'Agende sua visita',
  'Conheça as condições',
  'Quero informações',
  'Chamar no WhatsApp',
])

export const TEXT_CAMPAIGN_SALE_CONDITIONS = Object.freeze([
  'Entrada facilitada',
  'Usa FGTS',
  'Subsídio do governo',
  'Aceita financiamento',
  'Condições especiais',
  'Parcelamento durante a obra',
  'Últimas unidades',
  'Unidades limitadas',
])

// Commercial language is a user-selected fact. Keep the Brazilian catalogue out
// of the U.S. journey instead of translating programs that do not apply there.
export const TEXT_CAMPAIGN_US_SALE_CONDITIONS = Object.freeze([
  'Special terms available',
  'Flexible terms available',
  'Contact for pricing details',
])

export const TEXT_CAMPAIGN_RENT_GUARANTEES = Object.freeze([
  { id: 'seguro_fianca', label: 'Seguro-fiança' },
  { id: 'fiador', label: 'Fiador' },
  { id: 'caucao', label: 'Caução' },
  { id: 'titulo_capitalizacao', label: 'Título de capitalização' },
  { id: 'a_combinar', label: 'A combinar' },
  { id: 'nao_informar', label: 'Não informar' },
])

export const TEXT_CAMPAIGN_COMMERCIAL_TERM_FIELDS = Object.freeze([
  { id: 'entry_amount', label: 'Entrada' },
  { id: 'monthly_amount', label: 'Mensais' },
  { id: 'annual_amount', label: 'Anuais' },
])

export const EMPTY_TEXT_CAMPAIGN_COMMERCIAL_TERMS = Object.freeze({
  entry_amount: '',
  monthly_amount: '',
  annual_amount: '',
})

export const TEXT_CAMPAIGN_DELIVERABLES = Object.freeze([
  { id: 'listing_title', label: 'Título do anúncio' },
  { id: 'portal_description', label: 'Descrição completa para portal' },
  { id: 'short_listing', label: 'Anúncio curto' },
  { id: 'instagram_commercial', label: 'Instagram — comercial' },
  { id: 'instagram_emotional', label: 'Instagram — emocional' },
  { id: 'instagram_opportunity', label: 'Instagram — curiosidade/oportunidade' },
  { id: 'facebook_commercial', label: 'Facebook — comercial' },
  { id: 'facebook_emotional', label: 'Facebook — emocional' },
  { id: 'facebook_opportunity', label: 'Facebook — curiosidade/oportunidade' },
  { id: 'whatsapp_individual', label: 'WhatsApp individual' },
  { id: 'whatsapp_list', label: 'WhatsApp para carteira/lista' },
  { id: 'whatsapp_short', label: 'WhatsApp curto' },
  { id: 'email', label: 'E-mail', fields: Object.freeze(['subject', 'body']) },
  { id: 'linkedin', label: 'LinkedIn', conditional: true },
  { id: 'cta', label: 'CTA' },
  { id: 'hashtags', label: 'Hashtags estratégicas' },
  { id: 'reels_script', label: 'Roteiro curto para Reels' },
  { id: 'text_carousel', label: 'Carrossel textual', slides: 5 },
  { id: 'google_ads', label: 'Google Ads', fields: Object.freeze(['headlines', 'long_headline', 'descriptions', 'cta', 'suggested_keywords']) },
])

export function getTextCampaignDeliverableLabel(id, locale = 'pt-BR') {
  const fallback = TEXT_CAMPAIGN_DELIVERABLES.find(item => item.id === id)?.label || id
  if (locale !== 'en-US') return fallback
  return ({
    listing_title: 'Listing title', portal_description: 'Full portal description', short_listing: 'Short listing',
    instagram_commercial: 'Instagram — commercial', instagram_emotional: 'Instagram — emotional', instagram_opportunity: 'Instagram — opportunity',
    facebook_commercial: 'Facebook — commercial', facebook_emotional: 'Facebook — emotional', facebook_opportunity: 'Facebook — opportunity',
    whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp list', whatsapp_short: 'Short WhatsApp',
    email: 'Email', linkedin: 'LinkedIn', cta: 'CTA', hashtags: 'Strategic hashtags', reels_script: 'Short Reels script', text_carousel: 'Text carousel', google_ads: 'Google Ads',
  })[id] || id
}

export const TEXT_CAMPAIGN_HASHTAG_CONTRACT = Object.freeze({
  minimum: 12,
  maximum: 15,
  requiredBrand: '#SmartCorretorAI',
  brandPosition: 'middle',
  dimensions: Object.freeze([
    'location',
    'property_type',
    'purpose',
    'characteristics',
    'purchase_or_investment_intent',
    'lifestyle',
    'real_estate_market',
    'brand',
  ]),
  futureHelpers: Object.freeze(['strategic-hashtags', 'official-hashtags']),
})

export const createEmptyTextCampaignAnswers = () => ({
  purpose: '',
  stage: '',
  type: '',
  bedrooms: '',
  suites: '',
  bathrooms: '',
  parkingSpaces: '',
  area: '',
  state: '',
  county: '',
  city: '',
  cityOther: '',
  district: '',
  zipCode: '',
  neighborhoodCommunity: '',
  saleValueMode: '',
  salePriceMode: '',
  salePrice: '',
  saleConditions: [],
  commercialTerms: { ...EMPTY_TEXT_CAMPAIGN_COMMERCIAL_TERMS },
  rentValueMode: '',
  rentPrice: '',
  condominium: '',
  iptu: '',
  rentGuarantee: '',
  highlights: [],
  customHighlight: '',
  notes: '',
  cta: '',
  includeProfessionalPhone: '',
  professionalIdentity: { enabled: null, name_source: null, credential_source: null },
})

export const getTextCampaignStageOptions = purpose => getSmartTourStageOptions(purpose, TEXT_CAMPAIGN_SALE_STAGES)
export const getTextCampaignPropertyTypes = (purpose, market = 'BR') => getSmartTourPropertyTypes(purpose, market === 'US' ? { market } : SMART_TOUR_PROPERTY_TYPES)
  .map(type => typeof type === 'string' ? type : type.value)
export const getTextCampaignMeasureFields = (type, market = 'BR') => {
  const fields = getSmartTourMeasureFields(type)
  return market === 'US' ? fields.map(field => field === 'suites' ? 'bathrooms' : field) : fields
}
export const getTextCampaignSaleConditions = (market = 'BR') => market === 'US' ? TEXT_CAMPAIGN_US_SALE_CONDITIONS : TEXT_CAMPAIGN_SALE_CONDITIONS
export const getTextCampaignHighlightGroups = (type, market = 'BR') => getSmartTourHighlightGroups(type, { market })
export { SMART_TOUR_MEASURE_OPTIONS, SMART_TOUR_PROPERTY_TYPES, SMART_TOUR_RENTAL_STAGES }

export function normalizeTextCampaignLocation(value = '') {
  return normalizeSmartTourDistrict(value)
}

export function getEffectiveTextCampaignCity(answers = {}) {
  return normalizeTextCampaignLocation(answers.cityOther) || normalizeTextCampaignLocation(answers.city)
}

export function changeTextCampaignState(current, state) {
  const usFields = ['county', 'zipCode', 'neighborhoodCommunity'].some(field => field in current)
    ? { county: '', zipCode: '', neighborhoodCommunity: '' }
    : {}
  return { ...current, state, city: '', cityOther: '', district: '', ...usFields }
}

export function changeTextCampaignSelectedCity(current, city) {
  return { ...current, city, cityOther: '', district: '' }
}

export function changeTextCampaignManualCity(current, cityOther) {
  return { ...current, city: '', cityOther: normalizeTextCampaignLocation(cityOther), district: '' }
}

export function formatTextCampaignCurrency(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 12)
  return digits
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(digits))
    : ''
}

export function formatTextCampaignCurrencyForMarket(value = '', locale = 'pt-BR', market = 'BR') {
  const digits = String(value).replace(/\D/g, '').slice(0, 12)
  return digits ? new Intl.NumberFormat(locale, { style: 'currency', currency: market === 'US' ? 'USD' : 'BRL', maximumFractionDigits: 0 }).format(Number(digits)) : ''
}


export function normalizeTextCampaignCommercialTerms(value = {}) {
  return Object.fromEntries(TEXT_CAMPAIGN_COMMERCIAL_TERM_FIELDS
    .map(({ id }) => [id, String(value[id] || '').replace(/\D/g, '').slice(0, 12)])
    .filter(([, amount]) => amount))
}

export function textCampaignCommercialTermsAvailable(stage) {
  return ['Pré-lançamento', 'Lançamento', 'Em obras'].includes(stage)
}

export function getTextCampaignVisualStep(questionId) {
  if (questionId === 'purpose') return 1
  if (['stage', 'type', 'facts'].includes(questionId)) return 2
  if (questionId === 'location') return 3
  if (questionId === 'review') return 5
  return 4
}

export function buildTextCampaignBriefing(answers = {}, professionalPhone = '', { language = 'pt-BR', market = 'BR' } = {}) {
  const city = getEffectiveTextCampaignCity(answers)
  const district = normalizeTextCampaignLocation(answers.district)
  const commercialTerms = normalizeTextCampaignCommercialTerms(answers.commercialTerms)
  const sale = answers.purpose === 'sale'
  const contactAuthorized = answers.includeProfessionalPhone === 'yes' && Boolean(professionalPhone)

  return {
    language: language === 'en-US' ? 'en-US' : 'pt-BR',
    market: market === 'US' ? 'US' : 'BR',
    purpose: answers.purpose,
    stage: answers.stage,
    property_type: answers.type,
    bedrooms: answers.bedrooms,
    suites: answers.suites,
    bathrooms: market === 'US' ? answers.bathrooms : '',
    parking_spaces: answers.parkingSpaces,
    area: answers.area,
    area_unit: market === 'US' ? 'sqft' : 'm²',
    state: answers.state,
    county: market === 'US' ? String(answers.county || '').trim() : '',
    city,
    district,
    zip_code: market === 'US' ? String(answers.zipCode || '').trim() : '',
    neighborhood_community: market === 'US' ? normalizeTextCampaignLocation(answers.neighborhoodCommunity) : '',
    highlights: [...(answers.highlights || [])],
    custom_highlight: String(answers.customHighlight || '').trim() || null,
    notes: String(answers.notes || '').trim() || null,
    cta: answers.cta,
    contact_authorized: contactAuthorized,
    professional_phone: contactAuthorized ? professionalPhone : '',
    ...(answers.professionalIdentity?.enabled === true && answers.professionalIdentity.name_source && answers.professionalIdentity.credential_source ? { professional_identity: { enabled: true, name_source: answers.professionalIdentity.name_source, credential_source: answers.professionalIdentity.credential_source } } : {}),
    commercial: sale
      ? {
          mode: answers.saleValueMode,
          price_mode: answers.saleValueMode === 'price' ? answers.salePriceMode : '',
          price: answers.saleValueMode === 'price' ? answers.salePrice : '',
          conditions: answers.saleValueMode === 'conditions' ? [...(answers.saleConditions || [])] : [],
          commercial_terms: answers.saleValueMode === 'conditions' ? commercialTerms : {},
        }
      : {
          mode: answers.rentValueMode,
          rent: answers.rentValueMode === 'show' ? answers.rentPrice : '',
          condominium: answers.rentValueMode === 'show' ? answers.condominium : '',
          iptu: answers.rentValueMode === 'show' ? answers.iptu : '',
          guarantee: answers.rentValueMode === 'show' ? answers.rentGuarantee : '',
        },
  }
}

export function isTextCampaignBriefingValid(briefing = {}) {
  const required = ['purpose', 'stage', 'property_type', 'area', 'state', 'city', 'cta']
  if (briefing.market !== 'US') required.push('district')
  if (briefing.market === 'US' && !briefing.county) return false
  if (briefing.market === 'US' && briefing.zip_code && !/^\d{5}(?:-\d{4})?$/.test(briefing.zip_code)) return false
  if (required.some(field => !briefing[field])) return false
  if (!['sale', 'rent'].includes(briefing.purpose)) return false
  if (briefing.purpose === 'rent' && ['Terreno / Lote', 'us_land_lot'].includes(briefing.property_type)) return false
  if (!Array.isArray(briefing.highlights) || briefing.highlights.length > TEXT_CAMPAIGN_MAX_HIGHLIGHTS) return false
  if (briefing.contact_authorized && !briefing.professional_phone) return false
  const residential = !['Comercial', 'Terreno / Lote', 'us_commercial', 'us_land_lot'].includes(briefing.property_type)
  if (residential && (!briefing.bedrooms || !(briefing.market === 'US' ? briefing.bathrooms : briefing.suites) || !briefing.parking_spaces)) return false
  if (['Comercial', 'us_commercial'].includes(briefing.property_type) && !briefing.parking_spaces) return false
  const commercial = briefing.commercial || {}
  if (briefing.purpose === 'sale') {
    if (!['price', 'conditions', 'hidden'].includes(commercial.mode)) return false
    if (commercial.mode === 'price' && (!['fixed', 'starting_at'].includes(commercial.price_mode) || !commercial.price)) return false
    if (commercial.mode === 'conditions' && !(commercial.conditions?.length || Object.keys(commercial.commercial_terms || {}).length)) return false
  } else {
    if (!['show', 'hidden'].includes(commercial.mode)) return false
    if (commercial.mode === 'show' && (!commercial.rent || !commercial.guarantee)) return false
  }
  return true
}

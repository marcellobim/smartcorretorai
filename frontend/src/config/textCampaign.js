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
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp_individual', label: 'WhatsApp individual' },
  { id: 'whatsapp_list', label: 'WhatsApp para carteira/lista' },
  { id: 'whatsapp_short', label: 'WhatsApp curto' },
  { id: 'email', label: 'E-mail', fields: Object.freeze(['subject', 'body']) },
  { id: 'linkedin', label: 'LinkedIn', conditional: true },
  { id: 'cta', label: 'CTA' },
  { id: 'hashtags', label: 'Hashtags estratégicas' },
  { id: 'reels_script', label: 'Roteiro curto para Reels' },
  { id: 'text_carousel', label: 'Carrossel textual', slides: 5 },
])

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
  parkingSpaces: '',
  area: '',
  state: '',
  city: '',
  cityOther: '',
  district: '',
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
})

export const getTextCampaignStageOptions = purpose => getSmartTourStageOptions(purpose, TEXT_CAMPAIGN_SALE_STAGES)
export const getTextCampaignPropertyTypes = purpose => getSmartTourPropertyTypes(purpose, SMART_TOUR_PROPERTY_TYPES)
export const getTextCampaignMeasureFields = type => getSmartTourMeasureFields(type)
export const getTextCampaignHighlightGroups = type => getSmartTourHighlightGroups(type)
export { SMART_TOUR_MEASURE_OPTIONS, SMART_TOUR_PROPERTY_TYPES, SMART_TOUR_RENTAL_STAGES }

export function normalizeTextCampaignLocation(value = '') {
  return normalizeSmartTourDistrict(value)
}

export function getEffectiveTextCampaignCity(answers = {}) {
  return normalizeTextCampaignLocation(answers.cityOther) || normalizeTextCampaignLocation(answers.city)
}

export function changeTextCampaignState(current, state) {
  return { ...current, state, city: '', cityOther: '', district: '' }
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

export function buildTextCampaignBriefing(answers = {}, professionalPhone = '') {
  const city = getEffectiveTextCampaignCity(answers)
  const district = normalizeTextCampaignLocation(answers.district)
  const commercialTerms = normalizeTextCampaignCommercialTerms(answers.commercialTerms)
  const sale = answers.purpose === 'sale'
  const contactAuthorized = answers.includeProfessionalPhone === 'yes' && Boolean(professionalPhone)

  return {
    purpose: answers.purpose,
    stage: answers.stage,
    property_type: answers.type,
    bedrooms: answers.bedrooms,
    suites: answers.suites,
    parking_spaces: answers.parkingSpaces,
    area: answers.area,
    state: answers.state,
    city,
    district,
    highlights: [...(answers.highlights || [])],
    custom_highlight: String(answers.customHighlight || '').trim() || null,
    notes: String(answers.notes || '').trim() || null,
    cta: answers.cta,
    contact_authorized: contactAuthorized,
    professional_phone: contactAuthorized ? professionalPhone : '',
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

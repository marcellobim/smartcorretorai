import { buildPublicationPackage } from '../../../core/copy-engine/index.ts'

const clean = value => String(value || '').replace(/\s+/g, ' ').trim()
const normalized = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const sentence = value => {
  const text = clean(value)
  return text && /[.!?]$/.test(text) ? text : text ? `${text}.` : ''
}

const PRESENTATION = {
  APARTAMENTO: 'Apartment', CASA: 'House', 'SALA COMERCIAL': 'Commercial Suite', LOJA: 'Retail Space',
  'LAJE CORPORATIVA': 'Corporate Floor', GALPAO: 'Warehouse', LOTE: 'Land Lot', TERRENO: 'Land',
  COMERCIAL: 'Commercial Property', IMOVEL: 'Property', CORRETORES: 'Real Estate Agents',
  'CAPTADORES DE IMOVEIS': 'Property Acquisition Specialists', 'PERITOS AVALIADORES': 'Appraisers',
  'GERENTES COMERCIAIS': 'Sales Managers', 'DIRETORES COMERCIAIS': 'Sales Directors',
  'PRE-LANCAMENTO': 'Pre-Launch', LANCAMENTO: 'New Launch', PRONTO: 'Move-In Ready',
  'LOCALIZACAO': 'Prime Location', 'ESPACO INTERNO': 'Generous Interior Space', 'VARANDA / AREA EXTERNA': 'Balcony or Outdoor Area',
  ACABAMENTO: 'Quality Finishes', LAZER: 'Leisure Amenities', VISTA: 'Great Views', OPORTUNIDADE: 'Great Opportunity',
  CONDOMINIO: 'Condominium Living', 'AREA EXTERNA': 'Outdoor Area', SEGURANCA: 'Security', INFRAESTRUTURA: 'Infrastructure',
  NEGOCIOS: 'Business Potential', VISIBILIDADE: 'Visibility', 'AVALIACAO DE MERCADO': 'Market Valuation',
  'DIVULGACAO PROFISSIONAL': 'Professional Marketing', 'CARTEIRA DE CLIENTES': 'Client Network',
  'ATENDIMENTO CONSULTIVO': 'Consultative Service', 'VENDA COM ESTRATEGIA': 'Strategic Sales',
  'LEADS QUALIFICADOS': 'Qualified Leads', TREINAMENTO: 'Training', 'AMBIENTE COLABORATIVO': 'Collaborative Environment',
  'COMISSOES ATRATIVAS': 'Attractive Commissions', 'CRESCIMENTO PROFISSIONAL': 'Professional Growth',
  'MARCA FORTE': 'Strong Brand', 'LEADS FORNECIDOS': 'Provided Leads', 'MARKETING DIGITAL': 'Digital Marketing',
  'PLANO DE CARREIRA': 'Career Path', 'ESTRUTURA MODERNA': 'Modern Infrastructure', TECNOLOGIA: 'Technology',
  FLEXIBILIDADE: 'Flexibility', '1 DORMITORIO': '1 Bedroom', '2 DORMITORIOS': '2 Bedrooms',
  '3 DORMITORIOS': '3 Bedrooms', '4 DORMITORIOS': '4 Bedrooms', 'SEM SUITE': 'No Suites',
  '1 SUITE': '1 Suite', '2 SUITES': '2 Suites', '3 SUITES': '3 Suites', '4 SUITES': '4 Suites',
  'SEM VAGA': 'No Parking', '1 VAGA': '1 Parking Space', '2 VAGAS': '2 Parking Spaces',
  '3 VAGAS': '3 Parking Spaces', '4 VAGAS': '4 Parking Spaces', 'ATE 50 M2': 'Up to 50 m²',
  '50 A 100 M2': '50 to 100 m²', '100 A 200 M2': '100 to 200 m²', 'ACIMA DE 200 M2': 'Over 200 m²',
}

const CTA_PRESENTATION = {
  'SAIBA MAIS': 'Learn More', 'AGENDE SUA VISITA': 'Schedule Your Visit', 'ENTRE EM CONTATO': 'Contact Us',
  'ENTRE EM CONTATO AGORA': 'Contact Us Now', 'SOLICITE MAIS INFORMACOES': 'Request More Information',
  'INFORMACOES NA BIO': 'Find Details in Our Bio', 'FALE COMIGO': "Let's Talk", 'QUERO CONVERSAR': "Let's Talk",
  'CHAME NO WHATSAPP': 'Message Us on WhatsApp', 'FACA PARTE DO NOSSO TIME': 'Join Our Team',
  'AGUARDO SEU CONTATO': 'Get in Touch',
}

const present = value => PRESENTATION[normalized(value)] || ''
const presentCta = value => CTA_PRESENTATION[normalized(value)] || 'Learn More'
const place = ({ district, city }) => [clean(district), clean(city)].filter(Boolean).join(', ')
const numberLabel = (value, singular, plural) => {
  const text = clean(value)
  if (!/^\d\+?$/.test(text)) return ''
  return `${text} ${text === '1' ? singular : plural}`
}
const presentBedrooms = value => present(value) || (normalized(value) === 'STUDIO' ? 'Studio' : numberLabel(value, 'Bedroom', 'Bedrooms'))
const presentSuites = value => present(value) || (normalized(value) === 'NENHUMA' ? 'No Suites' : numberLabel(value, 'Suite', 'Suites'))
const presentParking = value => present(value) || (normalized(value) === 'NENHUMA' ? 'No Parking' : numberLabel(value, 'Parking Space', 'Parking Spaces'))
const presentArea = value => present(value) || (/^\d+(?:[.,]\d+)?\s*(?:M2|M²)?$/i.test(clean(value)) ? `${clean(value).replace(/\s*(?:M2|M²)?$/i, '')} m²` : '')
const facts = input => [presentBedrooms(input.bedrooms), presentSuites(input.suites), presentParking(input.parking), presentArea(input.area)].filter(Boolean)
const joinNatural = values => values.length < 2 ? values[0] || '' : values.length === 2 ? values.join(' and ') : `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
const hashtagToken = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')

function buildEnglishHashtags({ objective, propertyType, district, city, features }) {
  const type = present(propertyType).replace(/\s+/g, '') || 'RealEstate'
  const objectiveTags = {
    sale: ['ForSale', 'HomesForSale'], rent: ['ForRent', 'RentalProperty'],
    property_capture: ['ListYourProperty', 'RealEstateMarketing'], broker_capture: ['RealEstateCareers', 'JoinOurTeam'],
  }[objective] || ['RealEstate']
  const featureTags = (features || []).map(present).filter(Boolean).slice(0, 2).map(value => value.replace(/[^a-zA-Z0-9]/g, ''))
  const primaryTag = objective === 'sale' || objective === 'rent' ? `${type}${objectiveTags[0]}` : objectiveTags[0]
  return [...new Set([
    hashtagToken(district), hashtagToken(city), primaryTag, ...objectiveTags.slice(1), ...featureTags, 'SmartCorretorAI',
  ].filter(Boolean).map(value => `#${value}`))].join(' ')
}

function buildEnglishPropertyOptions(input) {
  const isRent = input.objective === 'rent'
  const propertyType = present(input.propertyType) || 'Property'
  const location = place(input)
  const details = joinNatural(facts(input))
  const feature = (input.features || []).map(present).find(Boolean) || ''
  const action = isRent ? 'for rent' : 'for sale'
  const cta = presentCta(input.cta)
  const subject = [propertyType, action, location ? `in ${location}` : ''].filter(Boolean).join(' ')
  const hashtags = buildEnglishHashtags(input)
  return [
    { label: 'Instagram/Facebook Commercial', text: [sentence(subject), details && sentence(`Featuring ${details}`), feature && sentence(`Highlights include ${feature}`), sentence(cta), hashtags].filter(Boolean).join('\n\n') },
    { label: 'Instagram/Facebook Emotional', text: [location ? `Discover a place that makes everyday life in ${location} feel exceptional.` : 'Discover a place that fits your next chapter.', sentence(`${propertyType} ${action}${details ? ` with ${details}` : ''}`), feature && sentence(`A standout feature: ${feature}`), sentence(cta), hashtags].filter(Boolean).join('\n\n') },
    { label: 'Instagram/Facebook Direct', text: [sentence(subject), details && sentence(details), feature && sentence(feature), sentence(cta), hashtags].filter(Boolean).join('\n') },
  ]
}

function buildEnglishCaptureOptions(input) {
  const location = place(input)
  const locationSuffix = location ? ` in ${location}` : ''
  const cta = presentCta(input.cta)
  const hashtags = buildEnglishHashtags(input)
  if (input.objective === 'broker_capture') {
    const professional = present(input.profile || input.propertyType) || 'real estate professionals'
    return [
      { label: 'Instagram/Facebook Commercial', text: [`We're looking for ${professional.toLowerCase()}${locationSuffix} to join a growth-minded team.`, 'An opportunity for professionals who value strong relationships, service, and results in real estate.', sentence(cta), hashtags].join('\n\n') },
      { label: 'Instagram/Facebook Emotional', text: ['Every career has a moment for the next step.', `For real estate professionals${locationSuffix}, this can be a new chapter with more support, structure, and opportunity.`, sentence(cta), hashtags].join('\n\n') },
      { label: 'Instagram/Facebook Direct', text: [`Opportunity for ${professional.toLowerCase()}${locationSuffix}.`, 'A growing real estate team.', sentence(cta), hashtags].join('\n') },
    ]
  }
  return [
    { label: 'Instagram/Facebook Commercial', text: [`Do you own a property${locationSuffix} and are thinking about selling or renting it out?`, 'With professional marketing, your property can reach qualified prospects and create better opportunities for a successful transaction.', sentence(cta), hashtags].join('\n\n') },
    { label: 'Instagram/Facebook Emotional', text: ['Your property can reach the right people with a more thoughtful marketing strategy.', location ? `In ${location}, a well-planned strategy helps highlight your property and start conversations with serious prospects.` : 'A well-planned strategy helps highlight your property and start conversations with serious prospects.', sentence(cta), hashtags].join('\n\n') },
    { label: 'Instagram/Facebook Direct', text: [`Property acquisition${locationSuffix}.`, 'Professional marketing and consultative service for selling or renting your property.', sentence(cta), hashtags].join('\n') },
  ]
}

export function buildStudioPublicationOptions(input = {}) {
  if (input.language !== 'en-US') return buildPublicationPackage(input)
  return input.objective === 'property_capture' || input.objective === 'broker_capture'
    ? buildEnglishCaptureOptions(input)
    : buildEnglishPropertyOptions(input)
}

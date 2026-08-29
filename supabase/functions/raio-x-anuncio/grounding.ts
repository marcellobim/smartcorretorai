import type { ListingAnalysis, ListingModelSection, NormalizedListing, ObservedField } from './contract.ts'
import { formatPtBrQuantity } from './pt-br-quantities.ts'

const CONDITIONAL_LOCATION_COPY = 'Se houver comércio, transporte ou serviços próximos, destaque apenas os que forem realmente relevantes para o imóvel.'
const LOCATION_CLAIMS = ['próxim', 'perto', 'transporte', 'metrô', 'metro', 'comércio', 'comercio', 'serviços', 'servicos', 'shopping', 'escola', 'hospital', 'parque']
const PROPERTY_CLAIMS = ['piscina', 'churrasqueira', 'academia', 'varanda', 'elevador', 'lavanderia', 'suíte', 'suite', 'vaga', 'garagem', 'dormitório', 'dormitorio', 'quarto', 'banheiro']
const GENERIC_REAL_ESTATE_COPY = /(experi[eê]ncia [uú]nica|lar acolhedor|localiza[cç][aã]o privilegiada|oportunidade imperd[ií]vel)/i
const ADD_MORE_IMAGES = /(?:adicion|inclu|acrescent|coloque|insira).{0,30}(?:mais\s+)?(?:foto|fotos|imagem|imagens)|mais\s+(?:foto|fotos|imagem|imagens)/i
const ABUNDANT_IMAGE_ACTION = 'Selecione as imagens mais fortes, organize uma sequência que destaque os diferenciais confirmados e use esse material em outros formatos de divulgação.'
const acquisitionConflict = /(inconsist|diverg|conflit|dois valores|sale|rent)/i
const normalize = (value: unknown) => String(value || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const includesLocationClaim = (value: unknown) => {
  const content = normalize(value).replace(/proximo passo/g, '')
  return LOCATION_CLAIMS.some(term => content.includes(normalize(term)))
}
const unsupportedPropertyClaim = (value: unknown, corpus: string) => {
  const content = normalize(value); const confirmed = normalize(corpus)
  const unsupportedTerm = PROPERTY_CLAIMS.some(term => content.includes(normalize(term)) && !confirmed.includes(normalize(term)))
  const unsupportedNumber = (content.match(/\b\d+(?:[.,]\d+)?\b/g) || []).some(number => !confirmed.includes(number))
  return unsupportedTerm || unsupportedNumber
}

function safeSection(section: ListingModelSection, confirmedCorpus: string, fallbackCopy: string, stripAcquisitionConflict = false, abundantImages = false): ListingModelSection {
  if (stripAcquisitionConflict && (section.issue_codes.some(code => acquisitionConflict.test(code)) || acquisitionConflict.test(section.analysis) || acquisitionConflict.test(section.suggestion || ''))) {
    return { ...section, issue_codes: [], suggestion_mode: 'none', suggestion: null, copy_text: null, what_can_improve: null, how_to_improve: null, analysis: 'As informações confirmadas foram consideradas sem transformar incertezas de aquisição em defeito do anúncio.' }
  }
  const publicTexts = [section.analysis, section.what_works, section.what_can_improve, section.how_to_improve, section.suggestion, section.copy_text]
  const unsupportedLocation = publicTexts.some(value => includesLocationClaim(value)) && !includesLocationClaim(confirmedCorpus)
  if (unsupportedLocation) return { ...section, analysis: 'A análise considera somente as informações confirmadas no anúncio.', what_works: 'O material apresenta informações objetivas que podem ser aproveitadas.', suggestion_mode: 'append', suggestion: 'Inclua somente informações de localização que você possa confirmar.', copy_text: CONDITIONAL_LOCATION_COPY, what_can_improve: 'O contexto de localização pode ser melhor explorado apenas quando houver fatos confirmados.', how_to_improve: CONDITIONAL_LOCATION_COPY, issue_codes: section.issue_codes.length ? section.issue_codes : ['UNCONFIRMED_LOCATION_CLAIM_REMOVED'] }
  if (abundantImages && publicTexts.some(value => ADD_MORE_IMAGES.test(String(value || '')))) return { ...section, suggestion_mode: 'append', suggestion: ABUNDANT_IMAGE_ACTION, copy_text: fallbackCopy, what_can_improve: 'O material visual já é abundante; o ganho está na seleção, ordem e uso das imagens mais fortes.', how_to_improve: ABUNDANT_IMAGE_ACTION, issue_codes: section.issue_codes.length ? section.issue_codes : ['ABUNDANT_IMAGES_REFRAMED'] }
  if (publicTexts.some(value => GENERIC_REAL_ESTATE_COPY.test(String(value || '')))) return { ...section, suggestion_mode: 'append', suggestion: 'Use um fato confirmado, explique o benefício prático e finalize com um próximo passo claro.', copy_text: fallbackCopy, what_can_improve: section.what_can_improve || 'A mensagem pode ficar mais específica e menos genérica.', how_to_improve: 'Conecte um diferencial confirmado a um benefício concreto e convide o interessado a conhecer mais.', issue_codes: section.issue_codes.length ? section.issue_codes : ['GENERIC_REAL_ESTATE_COPY_REMOVED'] }
  const unsupportedFact = [section.suggestion, section.copy_text, section.how_to_improve].some(value => unsupportedPropertyClaim(value, confirmedCorpus))
  if (!unsupportedFact) return section
  const safeCopy = fallbackCopy
  return { ...section, suggestion_mode: 'append', suggestion: 'Use somente os diferenciais confirmados no material analisado.', copy_text: safeCopy, what_can_improve: section.what_can_improve || 'A mensagem pode ficar mais específica sem acrescentar fatos não confirmados.', how_to_improve: safeCopy, issue_codes: section.issue_codes.length ? section.issue_codes : ['UNCONFIRMED_FACT_REMOVED'] }
}

function safeObservedField(field: ObservedField): ObservedField {
  if (field.state !== 'CONFIRMED') return { ...field, value: null }
  const isZero = /^\s*(?:0|R\$\s*0(?:[.,]0+)?)\s*$/i.test(String(field.value || ''))
  return isZero && !field.evidence ? { ...field, state: 'NOT_FOUND', value: null } : field
}

function groundedFallbackCopy(listing: NormalizedListing | null, analysis: ListingAnalysis) {
  const value = (key: keyof NormalizedListing['fields']) => listing?.fields[key]?.state === 'CONFIRMED'
    ? listing.fields[key].value
    : analysis.observed_fields.find(field => field.key === key && field.state === 'CONFIRMED')?.value
  const hasValue = (fieldValue: unknown) => fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== ''
  const type = String(value('propertyType') || 'imóvel').toLocaleLowerCase('pt-BR')
  const area = value('area'); const areaText = area ? (/m(?:²|2)/i.test(String(area)) ? String(area) : `${area} m²`) : null
  const bedrooms = value('bedrooms'); const suites = value('suites'); const parkingSpaces = value('parkingSpaces')
  const details = [
    areaText,
    hasValue(bedrooms) ? formatPtBrQuantity(bedrooms as string | number, 'dormitório') : null,
    hasValue(suites) ? formatPtBrQuantity(suites as string | number, 'suíte') : null,
    hasValue(parkingSpaces) ? formatPtBrQuantity(parkingSpaces as string | number, 'vaga') : null,
  ].filter(Boolean)
  return `Conheça este ${type}${details.length ? ` com ${details.join(', ')}` : ''} e veja se essa configuração atende ao que você procura. Entre em contato para saber mais.`
}

export function groundListingAnalysis(listing: NormalizedListing | null, analysis: ListingAnalysis, imageCount = 0): ListingAnalysis {
  const confirmedCorpus = listing
    ? `${JSON.stringify(listing.confirmedFacts)} ${listing.fields.parkingSpaces.state === 'CONFIRMED' ? `vaga garagem ${listing.fields.parkingSpaces.value}` : ''} ${listing.fields.bedrooms.state === 'CONFIRMED' ? `quarto dormitório ${listing.fields.bedrooms.value}` : ''} ${listing.fields.suites.state === 'CONFIRMED' ? `suíte ${listing.fields.suites.value}` : ''} ${listing.fields.bathrooms.state === 'CONFIRMED' ? `banheiro ${listing.fields.bathrooms.value}` : ''}`
    : analysis.observed_fields.filter(field => field.state === 'CONFIRMED').map(field => `${field.key}:${field.value}`).join(' ')
  const stripAcquisitionConflict = Boolean(listing && listing.inconsistencies.length === 0)
  const detectedImages = listing?.detectedImageCount.state === 'CONFIRMED' ? Number(listing.detectedImageCount.value) || 0 : 0
  const abundantImages = Math.max(imageCount, detectedImages) >= 20
  const fallbackCopy = groundedFallbackCopy(listing, analysis)
  return {
    ...analysis,
    title: safeSection(analysis.title, confirmedCorpus, fallbackCopy, false, abundantImages),
    description: safeSection(analysis.description, confirmedCorpus, fallbackCopy, false, abundantImages),
    information: safeSection(analysis.information, confirmedCorpus, fallbackCopy, stripAcquisitionConflict, abundantImages),
    persuasion: safeSection(analysis.persuasion, confirmedCorpus, fallbackCopy, false, abundantImages),
    attraction: safeSection(analysis.attraction, confirmedCorpus, fallbackCopy, false, abundantImages),
    observed_fields: analysis.observed_fields.map(safeObservedField),
  }
}

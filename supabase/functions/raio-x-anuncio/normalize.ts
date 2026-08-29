import {
  LISTING_XRAY_FIELD_KEYS, LISTING_XRAY_SCHEMA_VERSION, type EvidenceField, type FieldCandidate,
  type ListingXrayFieldKey, type ListingXrayInconsistency, type NormalizedListing,
} from './contract.ts'
import type { ListingExtraction, RawCandidate } from './extract.ts'

const NUMERIC_FIELDS = new Set<ListingXrayFieldKey>(['price', 'condominiumFee', 'propertyTax', 'area', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces'])
const ARRAY_FIELDS = new Set<ListingXrayFieldKey>(['highlights', 'amenities'])
const TEXT_VARIANT_FIELDS = new Set<ListingXrayFieldKey>(['title', 'description'])
const CRITICAL_AMBIGUOUS = new Set<ListingXrayFieldKey>(['price', 'area', 'bedrooms', 'city', 'district', 'address'])

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
const lower = (value: unknown) => clean(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const NON_SEMANTIC_AMENITY = /^(?:true|false|sim|nao|não|yes|no|0|1)$/i
const STRONG_CONFLICT_CONFIDENCE = 0.75

function parseNumericValue(value: unknown) {
  if (typeof value === 'number') return value
  const raw = clean(value).replace(/[^0-9.,-]/g, '')
  if (!raw) return Number.NaN
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d+(?:,\d+)?$/.test(raw)) return Number(raw.replace(',', '.'))
  return Number(raw)
}

function normalizeValue(field: ListingXrayFieldKey | 'detectedImageCount' | 'videoDetected', value: unknown) {
  if (field === 'videoDetected') return value === true ? 'true' : String(value)
  if (NUMERIC_FIELDS.has(field as ListingXrayFieldKey) || field === 'detectedImageCount') {
    const amount = parseNumericValue(value)
    if (!Number.isFinite(amount) || amount < 0) return ''
    if (field === 'price' || field === 'condominiumFee' || field === 'propertyTax') return String(Math.round(amount * 100) / 100)
    return String(Math.round(amount * 10) / 10)
  }
  if (ARRAY_FIELDS.has(field as ListingXrayFieldKey)) {
    const values = (Array.isArray(value) ? value : [value]).map(lower).filter(Boolean).sort()
    return [...new Set(values)].join('|')
  }
  return lower(value).replace(/[^a-z0-9\s/.-]/g, '').replace(/\s+/g, ' ').trim()
}

function publicCandidate(raw: RawCandidate): FieldCandidate {
  return { value: raw.value, normalizedValue: normalizeValue(raw.field, raw.value), source: raw.source, locator: raw.locator, confidence: raw.confidence }
}

function normalizeTextField(candidates: FieldCandidate[]): EvidenceField {
  if (!candidates.length) return { state: 'NOT_FOUND', value: null, confidence: 0, candidates: [] }
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence || clean(b.value).length - clean(a.value).length)
  const best = sorted[0]
  return best.confidence >= 0.6
    ? { state: 'CONFIRMED', value: clean(best.value), confidence: best.confidence, candidates: sorted }
    : { state: 'NOT_FOUND', value: null, confidence: best.confidence, candidates: sorted }
}

function normalizeArrayField(candidates: FieldCandidate[]): EvidenceField {
  const values = candidates.flatMap(candidate => Array.isArray(candidate.value) ? candidate.value : [candidate.value])
    .map(clean).filter(value => value.length >= 3 && !NON_SEMANTIC_AMENITY.test(value))
  const unique = [...new Map(values.map(value => [lower(value), value])).values()]
  if (!unique.length) return { state: 'NOT_FOUND', value: null, confidence: 0, candidates }
  return { state: 'CONFIRMED', value: unique.slice(0, 30), confidence: Math.max(...candidates.map(candidate => candidate.confidence)), candidates }
}

function isExplicitZero(field: ListingXrayFieldKey | 'detectedImageCount', candidate: FieldCandidate) {
  if (parseNumericValue(candidate.value) !== 0) return true
  if (!['suites', 'parkingSpaces', 'propertyTax', 'condominiumFee', 'bathrooms', 'bedrooms'].includes(field)) return false
  if (candidate.source === 'visible_text') return /(?:0|sem)\s*(?:su[ií]te|vaga|garagem|IPTU|condom[ií]nio|banheiro|quarto|dormit)/i.test(`${candidate.locator} ${candidate.value}`)
  return candidate.source === 'json_ld' && new RegExp(`(?:${field}|${field === 'parkingSpaces' ? 'parking' : field === 'propertyTax' ? 'iptu' : field})`, 'i').test(candidate.locator)
}

function validPrice(candidate: FieldCandidate) {
  const amount = parseNumericValue(candidate.value)
  if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000_000) return false
  return candidate.source !== 'embedded_data' || candidate.confidence >= 0.8
}

function normalizePurposeField(candidates: FieldCandidate[]): EvidenceField {
  const strong = candidates.filter(candidate => candidate.normalizedValue && candidate.confidence >= STRONG_CONFLICT_CONFIDENCE)
  const groups = groupsFor(strong)
  if (!groups.length) return { state: 'NOT_FOUND', value: null, confidence: candidates[0]?.confidence || 0, candidates }
  if (groups.length > 1) return { state: 'AMBIGUOUS', value: null, confidence: Math.min(groups[0].confidence, groups[1].confidence), candidates }
  const best = groups[0].items.sort((a, b) => b.confidence - a.confidence)[0]
  return { state: 'CONFIRMED', value: best.value, confidence: best.confidence, candidates }
}

const addressTokens = (value: unknown) => new Set(lower(value).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(token => token.length > 2 && !['rua', 'avenida', 'bairro'].includes(token)))
const compatibleAddresses = (left: unknown, right: unknown) => {
  const a = addressTokens(left); const b = addressTokens(right)
  if (!a.size || !b.size) return false
  const shared = [...a].filter(token => b.has(token)).length
  return shared === Math.min(a.size, b.size) || shared >= Math.min(2, Math.min(a.size, b.size))
}

function normalizeAddressField(candidates: FieldCandidate[]): EvidenceField {
  const strong = candidates.filter(candidate => candidate.normalizedValue && candidate.confidence >= 0.65).sort((a, b) => b.confidence - a.confidence || clean(b.value).length - clean(a.value).length)
  if (!strong.length) return { state: 'NOT_FOUND', value: null, confidence: candidates[0]?.confidence || 0, candidates }
  const best = strong[0]
  const incompatible = strong.find(candidate => candidate !== best && candidate.confidence >= STRONG_CONFLICT_CONFIDENCE && best.confidence >= STRONG_CONFLICT_CONFIDENCE && !compatibleAddresses(best.value, candidate.value))
  if (incompatible) return { state: 'AMBIGUOUS', value: null, confidence: Math.min(best.confidence, incompatible.confidence), candidates }
  const mostSpecific = strong.filter(candidate => compatibleAddresses(best.value, candidate.value)).sort((a, b) => clean(b.value).length - clean(a.value).length || b.confidence - a.confidence)[0] || best
  return { state: 'CONFIRMED', value: mostSpecific.value, confidence: mostSpecific.confidence, candidates }
}

function groupsFor(candidates: FieldCandidate[]) {
  const groups = new Map<string, FieldCandidate[]>()
  for (const candidate of candidates.filter(item => item.normalizedValue && item.confidence >= 0.55)) {
    const group = groups.get(candidate.normalizedValue) || []
    group.push(candidate)
    groups.set(candidate.normalizedValue, group)
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items, confidence: Math.max(...items.map(item => item.confidence)) })).sort((a, b) => b.confidence - a.confidence || b.items.length - a.items.length)
}

function normalizeField(field: ListingXrayFieldKey | 'detectedImageCount' | 'videoDetected', raw: RawCandidate[]): EvidenceField {
  let candidates = raw.filter(candidate => candidate.field === field).map(publicCandidate)
  if (field === 'price') candidates = candidates.filter(validPrice)
  if (NUMERIC_FIELDS.has(field as ListingXrayFieldKey) || field === 'detectedImageCount') candidates = candidates.filter(candidate => isExplicitZero(field as ListingXrayFieldKey | 'detectedImageCount', candidate))
  if (TEXT_VARIANT_FIELDS.has(field as ListingXrayFieldKey)) return normalizeTextField(candidates)
  if (ARRAY_FIELDS.has(field as ListingXrayFieldKey)) return normalizeArrayField(candidates)
  if (field === 'purpose') return normalizePurposeField(candidates)
  if (field === 'address') return normalizeAddressField(candidates)
  const groups = groupsFor(candidates)
  if (!groups.length) return { state: 'NOT_FOUND', value: null, confidence: candidates[0]?.confidence || 0, candidates }
  if (groups.length > 1 && groups[0].confidence >= STRONG_CONFLICT_CONFIDENCE && groups[1].confidence >= STRONG_CONFLICT_CONFIDENCE) return { state: 'AMBIGUOUS', value: null, confidence: Math.min(groups[0].confidence, groups[1].confidence), candidates }
  const best = groups[0].items.sort((a, b) => b.confidence - a.confidence)[0]
  return { state: 'CONFIRMED', value: best.value, confidence: best.confidence, candidates }
}

const FIELD_LABELS: Record<ListingXrayFieldKey, string> = {
  purpose: 'finalidade', propertyType: 'tipo do imóvel', title: 'título', description: 'descrição', price: 'preço', condominiumFee: 'condomínio', propertyTax: 'IPTU', area: 'área', bedrooms: 'dormitórios', suites: 'suítes', bathrooms: 'banheiros', parkingSpaces: 'vagas', state: 'estado', city: 'cidade', district: 'bairro', address: 'endereço', highlights: 'diferenciais', amenities: 'comodidades', developmentName: 'empreendimento', builder: 'construtora', stage: 'estágio',
}

function candidateDisplay(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return clean(value)
}

export function buildDeterministicInconsistencies(fields: Record<ListingXrayFieldKey, EvidenceField>): ListingXrayInconsistency[] {
  return LISTING_XRAY_FIELD_KEYS.flatMap(field => {
    const evidence = fields[field]
    if (evidence.state !== 'AMBIGUOUS') return []
    const values = [...new Map(evidence.candidates.filter(candidate => candidate.confidence >= STRONG_CONFLICT_CONFIDENCE && candidate.normalizedValue).map(candidate => [candidate.normalizedValue, candidateDisplay(candidate.value)])).values()].filter(Boolean).slice(0, 4)
    if (values.length < 2) return []
    const message = field === 'price'
      ? `O anúncio apresenta dois valores imobiliários diferentes em fontes confiáveis: ${values.slice(0, 2).map(value => `R$ ${Number(String(value).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.')).toLocaleString('pt-BR')}`).join(' e ')}. Confirme qual é o valor correto.`
      : field === 'purpose'
        ? 'O anúncio apresenta indicações conflitantes de venda e aluguel em fontes confiáveis. Confirme a finalidade correta.'
        : field === 'address'
          ? 'O anúncio apresenta endereços incompatíveis em fontes confiáveis. Confirme qual endereço está correto.'
          : `O anúncio apresenta informações incompatíveis para ${FIELD_LABELS[field]} em fontes confiáveis. Confirme o dado correto.`
    return [{
      field, values,
      message,
    }]
  })
}

const CATEGORY_FIELDS: Record<string, ListingXrayFieldKey[]> = {
  identity: ['purpose', 'propertyType'],
  location: ['state', 'city', 'district', 'address'],
  physical: ['area', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces', 'amenities', 'highlights'],
  commercial: ['price', 'condominiumFee', 'propertyTax', 'stage', 'developmentName', 'builder'],
}

export function normalizeListing(extraction: ListingExtraction, fetchedAt = new Date().toISOString()): NormalizedListing {
  const fields = Object.fromEntries(LISTING_XRAY_FIELD_KEYS.map(field => [field, normalizeField(field, extraction.candidates)])) as Record<ListingXrayFieldKey, EvidenceField>
  const detectedImageCount = normalizeField('detectedImageCount', extraction.candidates)
  const videoDetected = normalizeField('videoDetected', extraction.candidates)
  const inconsistencies = buildDeterministicInconsistencies(fields)
  const objectiveKeys = LISTING_XRAY_FIELD_KEYS.filter(field => !['title', 'description', 'highlights', 'amenities'].includes(field) && fields[field].state === 'CONFIRMED')
  const categories = Object.entries(CATEGORY_FIELDS).filter(([, keys]) => keys.some(key => fields[key].state === 'CONFIRMED')).map(([category]) => category)
  const titleLength = clean(fields.title.value).length
  const descriptionLength = clean(fields.description.value).length
  const textualLength = titleLength + descriptionLength
  const sourceReliability = Object.values(fields).filter(field => field.state === 'CONFIRMED').map(field => field.confidence)
  const reliability = sourceReliability.length ? sourceReliability.reduce((sum, value) => sum + value, 0) / sourceReliability.length : 0
  const coverage = Math.min(1, objectiveKeys.length / 6) * 0.7 + (titleLength >= 10 ? 0.1 : 0) + (descriptionLength >= 100 ? 0.2 : descriptionLength ? 0.08 : 0)
  const substance = Math.min(1, textualLength / 800)
  const score = Number(Math.min(1, coverage * 0.45 + reliability * 0.35 + substance * 0.2).toFixed(3))
  const reasons: string[] = []
  if (!titleLength && !descriptionLength) reasons.push('missing_title_and_description')
  if (objectiveKeys.length < 3) reasons.push('insufficient_confirmed_fields')
  if (categories.length < 2) reasons.push('insufficient_information_categories')
  if (textualLength < 80) reasons.push('insufficient_textual_content')
  if (score < 0.6) reasons.push('low_extraction_confidence')
  const gate = reasons.length ? 'FAIL' : 'PASS'
  const confirmedFacts = Object.fromEntries(LISTING_XRAY_FIELD_KEYS.filter(field => fields[field].state === 'CONFIRMED').map(field => [field, fields[field].value]))

  return {
    schemaVersion: LISTING_XRAY_SCHEMA_VERSION,
    sourceUrl: extraction.sourceUrl, sourceDomain: extraction.sourceDomain, adapter: extraction.adapter, fetchedAt,
    fields, detectedImageCount, videoDetected,
    extractedText: { title: extraction.title, description: extraction.description, evidenceSnippets: extraction.evidenceSnippets },
    extractionConfidence: { score, gate, reasons, confirmedObjectiveFields: objectiveKeys.length, categories },
    inconsistencies, confirmedFacts,
  }
}

export function informationScoreFromListing(listing: NormalizedListing) {
  let score = 100
  for (const inconsistency of listing.inconsistencies) score -= CRITICAL_AMBIGUOUS.has(inconsistency.field) ? 15 : 10
  return Math.max(0, Math.min(100, score))
}

// Canonical textual contract shared by Edge Functions and frontend formatters.
export type GoogleAdsDelivery = {
  headlines: string[]
  long_headline: string
  descriptions: string[]
  cta: string
  suggested_keywords: string[]
}

export type GoogleAdsBriefing = {
  purpose?: unknown
  propertyType?: unknown
  district?: unknown
  city?: unknown
  state?: unknown
  bedrooms?: unknown
  suites?: unknown
  highlights?: unknown
  cta?: unknown
}

export const GOOGLE_ADS_LIMITS = Object.freeze({
  headlines: Object.freeze({ min: 2, max: 6, itemMax: 30 }),
  longHeadlineMax: 90,
  descriptions: Object.freeze({ min: 2, max: 4, itemMax: 90 }),
  ctaMax: 30,
  suggestedKeywords: Object.freeze({ min: 3, max: 8, itemMax: 80 }),
})

export const GOOGLE_ADS_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['headlines', 'long_headline', 'descriptions', 'cta', 'suggested_keywords'],
  properties: {
    headlines: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string', minLength: 1, maxLength: 30 } },
    long_headline: { type: 'string', minLength: 1, maxLength: 90 },
    descriptions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 90 } },
    cta: { type: 'string', minLength: 1, maxLength: 30 },
    suggested_keywords: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 80 } },
  },
})

export const GOOGLE_ADS_PROMPT_RULES = `Google Ads deve ser uma entrega textual adicional no campo google_ads, sem substituir ou reorganizar as entregas existentes. Retorne 2 a 6 headlines com ate 30 caracteres cada, um long_headline com ate 90 caracteres, 2 a 4 descriptions com ate 90 caracteres cada, o CTA exato escolhido no briefing com ate 30 caracteres e 3 a 8 suggested_keywords com ate 80 caracteres cada. Nao trunque silenciosamente, nao duplique itens e nao crie CTA independente. Nas palavras-chave, priorize nesta ordem: tipo + finalidade + localizacao; intencao comercial + tipo + localizacao; tipo + caracteristica importante + localizacao; tipo + dormitorios ou suites + localizacao; caracteristica relevante + tipo + localizacao. Use apenas fatos do briefing. Nao informe CPC, volume de pesquisa, concorrencia, ranking ou previsao de trafego.`

const METRIC_PATTERN = /\b(cpc|volume de pesquisa|concorr[eê]ncia|ranking|previs[aã]o de tr[aá]fego|palavras mais buscadas)\b/i

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()
const lower = (value: unknown) => clean(value).toLocaleLowerCase('pt-BR')
const unique = (values: string[]) => [...new Map(values.filter(Boolean).map(value => [lower(value), value])).values()]

function bounded(value: unknown, maximum: number, code: string) {
  const text = clean(value)
  if (!text || text.length > maximum) throw new Error(code)
  return text
}

function boundedList(value: unknown, minimum: number, maximum: number, itemMaximum: number, code: string) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new Error(code)
  const items = value.map((item, index) => bounded(item, itemMaximum, `${code}_${index + 1}`))
  if (unique(items).length !== items.length) throw new Error(`${code}_duplicate`)
  return items
}

export function validateGoogleAdsDelivery(value: unknown, options: { expectedCta?: unknown } = {}): GoogleAdsDelivery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_google_ads')
  const record = value as Record<string, unknown>
  const expectedKeys = ['headlines', 'long_headline', 'descriptions', 'cta', 'suggested_keywords']
  if (Object.keys(record).sort().join('|') !== [...expectedKeys].sort().join('|')) throw new Error('invalid_google_ads')
  const result = {
    headlines: boundedList(record.headlines, 2, 6, 30, 'invalid_google_ads_headlines'),
    long_headline: bounded(record.long_headline, 90, 'invalid_google_ads_long_headline'),
    descriptions: boundedList(record.descriptions, 2, 4, 90, 'invalid_google_ads_descriptions'),
    cta: bounded(record.cta, 30, 'invalid_google_ads_cta'),
    suggested_keywords: boundedList(record.suggested_keywords, 3, 8, 80, 'invalid_google_ads_keywords'),
  }
  const expectedCta = clean(options.expectedCta)
  if (expectedCta && result.cta !== expectedCta) throw new Error('invalid_google_ads_cta_context')
  if ([...result.headlines, result.long_headline, ...result.descriptions, result.cta, ...result.suggested_keywords].some(text => METRIC_PATTERN.test(text))) {
    throw new Error('invalid_google_ads_keyword_metrics')
  }
  return result
}

function purposeContext(value: unknown) {
  const normalized = lower(value)
  if (/rent|rental|loca[cç][aã]o|alug/.test(normalized)) return { phrase: 'para locação', intent: 'alugar' }
  if (/property.?capture|capta[cç][aã]o.*im[oó]ve/.test(normalized)) return { phrase: 'para captação', intent: 'vender' }
  if (/broker.?capture|capta[cç][aã]o.*corret|recrut/.test(normalized)) return { phrase: 'para corretores', intent: 'trabalhar como corretor' }
  return { phrase: 'à venda', intent: 'comprar' }
}

const fit = (values: string[], maximum: number) => unique(values.map(clean)).filter(value => value.length <= maximum)
const sentence = (value: string) => /[.!?]$/.test(value) ? value : `${value}.`

export function buildGoogleAdsDelivery(input: GoogleAdsBriefing): GoogleAdsDelivery {
  const propertyType = clean(input.propertyType) || 'Imóvel'
  const district = clean(input.district)
  const city = clean(input.city)
  const state = clean(input.state)
  const location = district || city || state
  const extendedLocation = unique([district, city, state]).join(', ')
  const bedrooms = clean(input.bedrooms)
  const suites = clean(input.suites)
  const highlights = Array.isArray(input.highlights) ? unique(input.highlights.map(clean)).slice(0, 3) : []
  const cta = bounded(input.cta || 'Saiba mais', 30, 'invalid_google_ads_cta')
  const purpose = purposeContext(input.purpose)
  const typeLower = lower(propertyType)
  const locationLower = lower(location)
  const purposeSubject = clean(`${propertyType} ${purpose.phrase}${location ? ` ${district ? 'na' : 'em'} ${location}` : ''}`)

  const headlines = fit([
    purposeSubject,
    `${propertyType}${location ? ` em ${location}` : ''}`,
    bedrooms ? `${propertyType} ${bedrooms} dorm${location ? ` ${location}` : ''}` : '',
    suites ? `${propertyType} ${suites} suítes${location ? ` ${location}` : ''}` : '',
    highlights[0] ? `${propertyType} com ${highlights[0]}` : '',
    cta,
  ], GOOGLE_ADS_LIMITS.headlines.itemMax).slice(0, GOOGLE_ADS_LIMITS.headlines.max)
  if (headlines.length < GOOGLE_ADS_LIMITS.headlines.min) {
    for (const fallback of fit([propertyType, `${purpose.intent} ${propertyType}`, cta], 30)) {
      if (!headlines.some(item => lower(item) === lower(fallback))) headlines.push(fallback)
      if (headlines.length >= 2) break
    }
  }

  const factPhrase = bedrooms
    ? `${bedrooms} ${bedrooms === '1' ? 'dormitório' : 'dormitórios'}`
    : suites ? `${suites} ${suites === '1' ? 'suíte' : 'suítes'}` : ''
  const longHeadline = fit([
    `${purposeSubject}${highlights[0] ? ` com ${highlights[0]}` : ''}`,
    purposeSubject,
    `${propertyType}${extendedLocation ? ` em ${extendedLocation}` : ''}`,
  ], GOOGLE_ADS_LIMITS.longHeadlineMax)[0]
  const descriptions = fit([
    sentence(`Conheça ${lower(purposeSubject)}`),
    sentence([factPhrase, highlights[0]].filter(Boolean).join(' com ') || `${cta} para ver os detalhes`),
    highlights[1] ? sentence(`${propertyType} com ${highlights[1]}${location ? ` em ${location}` : ''}`) : '',
  ], GOOGLE_ADS_LIMITS.descriptions.itemMax).slice(0, GOOGLE_ADS_LIMITS.descriptions.max)

  const keywordLocation = locationLower ? ` ${district ? 'na' : 'em'} ${locationLower}` : ''
  const compactKeywordLocation = locationLower ? ` ${locationLower}` : ''
  const keywords = fit([
    `${typeLower} ${purpose.phrase}${keywordLocation}`,
    `${purpose.intent} ${typeLower}${keywordLocation}`,
    highlights[0] ? `${typeLower} com ${lower(highlights[0])}${compactKeywordLocation}` : '',
    bedrooms ? `${typeLower} ${bedrooms} dormitórios${compactKeywordLocation}` : '',
    suites ? `${typeLower} ${suites} suítes${compactKeywordLocation}` : '',
    highlights[1] ? `${lower(highlights[1])} ${typeLower}${compactKeywordLocation}` : '',
    `${purpose.intent} imóvel${keywordLocation}`,
  ], GOOGLE_ADS_LIMITS.suggestedKeywords.itemMax).slice(0, GOOGLE_ADS_LIMITS.suggestedKeywords.max)

  return validateGoogleAdsDelivery({
    headlines,
    long_headline: longHeadline,
    descriptions,
    cta,
    suggested_keywords: keywords,
  }, { expectedCta: cta })
}

export function formatGoogleAdsDelivery(value: GoogleAdsDelivery) {
  return [
    `Títulos\n${value.headlines.map(item => `- ${item}`).join('\n')}`,
    `Título longo\n${value.long_headline}`,
    `Descrições\n${value.descriptions.map(item => `- ${item}`).join('\n')}`,
    `CTA\n${value.cta}`,
    `Palavras-chave sugeridas\n${value.suggested_keywords.map(item => `- ${item}`).join('\n')}`,
  ].join('\n\n')
}

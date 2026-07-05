export type CopyEngineInput = {
  objective?: string
  objectiveLabel?: string
  propertyType?: string
  profile?: string
  stage?: string
  city?: string
  district?: string
  location?: string
  features?: string[]
  bedrooms?: string
  suites?: string
  parking?: string
  area?: string
  displayArea?: string
  display_area?: string
  area_exibicao?: string
  value?: string
  displayPrice?: string
  display_price?: string
  valor_exibicao?: string
  showValue?: boolean
  contactPhone?: string
  displayPhone?: string
  display_phone?: string
  telefone_exibicao?: string
  cta?: string
}

export type CopyPackageItem = {
  label: string
  text: string
}

export type CopyEngineOutput = CopyPackageItem[]

type CampaignKind = 'sale' | 'rent' | 'property_capture' | 'broker_capture' | 'generic'

const BROKER_CAPTURE_TERMS = ['BROKER', 'CORRETOR', 'CORRETORES', 'PROFISSIONAIS']
const PROPERTY_CAPTURE_TERMS = ['CAPTACAO DE IMOVEIS', 'CAPTACAO IMOVEIS', 'CAPTAR IMOVEIS']
const RENT_TERMS = ['RENT', 'LOCACAO', 'ALUGUEL', 'ALUGAR']
const SALE_TERMS = ['SALE', 'VENDA', 'VENDER']

export const copyEngineStatus = {
  name: 'copy-engine',
  implemented: true,
  integrated: true,
} as const

function clean(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function compact(items: Array<string | undefined | null | false>): string[] {
  return items.map(clean).filter(Boolean)
}

function sentence(value: string): string {
  const text = clean(value)
  if (!text) return ''
  return text.endsWith('.') || text.endsWith('!') || text.endsWith('?') ? text : `${text}.`
}

function toReadable(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  const smallWords = new Set(['a', 'as', 'com', 'da', 'de', 'do', 'das', 'dos', 'e', 'em', 'mais', 'na', 'no', 'o', 'os', 'para', 'sem', 'um', 'uma'])
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

function toSentenceCase(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/^[A-Z0-9\s]+$/.test(text) && text.length <= 18) return text
  const lower = text.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function normalizeContactPhoneForDisplay(phone: unknown): string {
  const original = String(phone || '').trim().replace(/\.+$/g, '')
  if (!original) return ''

  const digits = original.replace(/\D/g, '')
  const hasBrazilPrefix = /^\s*\+55/.test(original)
  const nationalDigits = hasBrazilPrefix && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits

  if (hasBrazilPrefix && nationalDigits.length === 11) {
    return `+55 ${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2, 7)}-${nationalDigits.slice(7)}`
  }

  if (hasBrazilPrefix && nationalDigits.length === 10) {
    return `+55 ${nationalDigits.slice(0, 2)} ${nationalDigits.slice(2, 6)}-${nationalDigits.slice(6)}`
  }

  if (nationalDigits.length === 11) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 7)}-${nationalDigits.slice(7)}`
  }

  if (nationalDigits.length === 10) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 6)}-${nationalDigits.slice(6)}`
  }

  return original
}

export function formatCurrencyForDisplay(value: unknown, objective?: unknown): string {
  const original = clean(value)
  if (!original) return ''
  if (/R\$/i.test(original)) return original

  const numeric = original.replace(/\s/g, '')
  if (!/^\d+([.,]\d{1,2})?$/.test(numeric)) return original

  const [integerPart, decimalPart = ''] = numeric.split(/[.,]/)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const formattedDecimal = decimalPart ? `,${decimalPart.padEnd(2, '0').slice(0, 2)}` : ''
  const comparableObjective = normalize(objective)
  const suffix = comparableObjective.includes('LOCACAO') || comparableObjective.includes('RENT') || comparableObjective.includes('ALUGUEL')
    ? '/m\u00eas'
    : ''

  return `R$ ${formattedInteger}${formattedDecimal}${suffix}`
}

export function formatAreaForDisplay(area: unknown): string {
  const original = clean(area)
  if (!original) return ''

  const match = original.match(/^(\d+(?:[.,]\d+)?)\s*(?:m2|m\u00b2)?$/i)
  if (!match) return original

  return `${match[1]} m\u00b2`
}

function getCampaignKind(input: CopyEngineInput): CampaignKind {
  const source = normalize([input.objective, input.objectiveLabel].filter(Boolean).join(' '))
  if (BROKER_CAPTURE_TERMS.some((term) => source.includes(term))) return 'broker_capture'
  if (PROPERTY_CAPTURE_TERMS.some((term) => source.includes(term))) return 'property_capture'
  if (RENT_TERMS.some((term) => source.includes(term))) return 'rent'
  if (SALE_TERMS.some((term) => source.includes(term))) return 'sale'
  return 'generic'
}

function getPlace(input: CopyEngineInput): string {
  const district = toReadable(input.district)
  const city = toReadable(input.city)
  const location = toReadable(input.location)
  if (district && city) return `${district}, ${city}`
  return district || city || location || 'a regi\u00e3o selecionada'
}

function getPropertyType(input: CopyEngineInput): string {
  return toReadable(input.propertyType) || 'im\u00f3vel'
}

function formatBedrooms(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (normalize(text) === 'STUDIO') return 'studio'
  return `${text} ${text === '1' ? 'dormit\u00f3rio' : 'dormit\u00f3rios'}`
}

function formatSuites(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/NENHUMA/i.test(normalize(text))) return 'nenhuma su\u00edte'
  return `${text} ${text === '1' ? 'su\u00edte' : 'su\u00edtes'}`
}

function formatParking(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/NENHUMA/i.test(normalize(text))) return 'sem vaga'
  return `${text} ${text === '1' ? 'vaga' : 'vagas'}`
}

function formatArea(value: unknown): string {
  return formatAreaForDisplay(value)
}

function getImmutableFacts(input: CopyEngineInput): string[] {
  return compact([
    formatBedrooms(input.bedrooms),
    formatSuites(input.suites),
    formatParking(input.parking),
    formatArea(input.area),
    input.showValue ? formatCurrencyForDisplay(input.value, input.objective || input.objectiveLabel) : '',
  ])
}

function getFeatureText(input: CopyEngineInput): string {
  return compact([input.stage, ...(input.features || [])])
    .filter((item) => !/MINHA CASA|MCMV|ECONOM|MEDIO|ALTO PADRAO|LUXO|INVESTIMENTO|COMERCIAL/i.test(normalize(item)))
    .map(toReadable)
    .slice(0, 2)
    .join(' e ')
}

function getCta(input: CopyEngineInput, fallback = 'Entre em contato'): string {
  return toSentenceCase(input.cta) || fallback
}

function getContactPhone(input: CopyEngineInput): string {
  return normalizeContactPhoneForDisplay(input.displayPhone || input.display_phone || input.telefone_exibicao || input.contactPhone)
}

function joinSentenceParts(parts: Array<string | undefined | null | false>): string {
  return compact(parts).map(sentence).join(' ')
}

function joinNatural(items: string[]): string {
  const filtered = compact(items)
  if (filtered.length <= 1) return filtered[0] || ''
  if (filtered.length === 2) return `${filtered[0]} e ${filtered[1]}`
  return `${filtered.slice(0, -1).join(', ')} e ${filtered[filtered.length - 1]}`
}

function startLower(value: string): string {
  const text = clean(value)
  if (!text) return ''
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function startUpper(value: string): string {
  const text = clean(value)
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getArticleForDistrict(value: string): string {
  const text = normalize(value)
  if (!text) return 'em'
  if (text.startsWith('VILA ') || text.startsWith('ALDEIA ') || text.endsWith('A')) return 'na'
  if (text.startsWith('JARDIM ') || text.startsWith('CENTRO') || text.endsWith('O')) return 'no'
  return 'em'
}

function getLocationInfo(input: CopyEngineInput) {
  const district = toReadable(input.district)
  const city = toReadable(input.city)
  const location = toReadable(input.location)
  const article = getArticleForDistrict(district)
  const districtPhrase = district ? `${article} ${district}` : ''
  const short = districtPhrase || (city ? `em ${city}` : location ? `em ${location}` : 'na regi\u00e3o selecionada')
  const full = districtPhrase && city ? `${districtPhrase}, em ${city}` : short

  return {
    district,
    city,
    short,
    full,
  }
}

function getStageText(input: CopyEngineInput): string {
  const stage = clean(input.stage).toLowerCase()
  if (!stage) return ''
  return stage
}

function getDifferentials(input: CopyEngineInput): string[] {
  const stage = normalize(input.stage)
  const seen = new Set<string>()

  return compact(input.features || [])
    .filter((item) => {
      const comparable = normalize(item)
      if (!comparable || comparable === stage) return false
      return !/MINHA CASA|MCMV|ECONOM|MEDIO|ALTO PADRAO|LUXO|INVESTIMENTO|COMERCIAL/i.test(comparable)
    })
    .map(naturalizeDifferential)
    .filter((item) => {
      const comparable = normalize(item)
      if (!comparable || seen.has(comparable)) return false
      seen.add(comparable)
      return true
    })
}

function naturalizeDifferential(value: unknown): string {
  const text = clean(value)
  const comparable = normalize(text)

  if (!text) return ''
  if (comparable.includes('METRO')) return 'metr\u00f4 por perto'
  if (comparable.includes('FACIL ACESSO') && comparable.includes('VIAS')) return 'f\u00e1cil acesso \u00e0s principais vias'
  if (comparable.includes('ACESSO') && comparable.includes('VIAS')) return 'acesso \u00e0s principais vias'
  if (comparable.includes('LAZER COMPLETO')) return 'lazer completo'
  if (comparable.includes('PLANTA INTELIGENTE')) return 'planta inteligente e bem aproveitada'
  if (comparable.includes('COMERC') && comparable.includes('ESCOLA')) return 'com\u00e9rcio e escolas por perto'
  if (comparable.includes('COMERC')) return 'com\u00e9rcio por perto'
  if (comparable.includes('ESCOLA')) return 'escolas pr\u00f3ximas'
  if (comparable.includes('SALAO') && comparable.includes('FEST')) return 'sal\u00e3o de festas'
  if (comparable.includes('PISCINA')) return 'piscina'
  if (comparable.includes('ACADEMIA')) return 'academia'
  if (comparable.includes('VARANDA')) return 'varanda'
  if (comparable.includes('CHURRAS')) return 'churrasqueira'
  if (comparable.includes('PORTARIA')) return 'portaria'

  return startLower(toSentenceCase(text))
}

function buildDifferentialSentence(differentials: string[], mode: 'social' | 'whatsapp' | 'portal' = 'social'): string {
  const selected = differentials.slice(0, mode === 'portal' ? 3 : 2)
  if (!selected.length) return ''

  const leisure = selected.filter((item) => /PISCINA|SALAO DE FESTAS|ACADEMIA|CHURRASQUEIRA/.test(normalize(item)))
  const mobility = selected.filter((item) => /METRO|ACESSO|VIAS|COMERCIO|ESCOLAS|PERTO|PROXIMAS/.test(normalize(item)))
  const layout = selected.filter((item) => /PLANTA|LAZER COMPLETO/.test(normalize(item)))
  const other = selected.filter((item) => !leisure.includes(item) && !mobility.includes(item) && !layout.includes(item))

  if (leisure.length && mobility.length) {
    return `O lazer conta com ${joinNatural(leisure)}, e a localiza\u00e7\u00e3o facilita a rotina com ${joinNatural(mobility)}.`
  }

  if (leisure.length) return `O lazer conta com ${joinNatural(leisure)}, trazendo mais conforto para o dia a dia.`
  if (mobility.length) return `A localiza\u00e7\u00e3o facilita a rotina, com ${joinNatural(mobility)}.`
  if (layout.length) return `A configura\u00e7\u00e3o do im\u00f3vel valoriza ${joinNatural(layout)}.`
  return `A proposta ganha for\u00e7a com ${joinNatural(other)}.`
}

function getDisplayArea(input: CopyEngineInput): string {
  return formatAreaForDisplay(input.displayArea || input.display_area || input.area_exibicao || input.area)
}

function formatValueChunk(value: string, objective: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/^R\$/i.test(text)) return text.replace(/\/mes$/i, '/m\u00eas')
  return formatCurrencyForDisplay(text, objective)
}

function formatValueForCopy(value: unknown, objective: unknown): string {
  const text = clean(value)
  if (!text) return ''

  if (text.includes('|')) {
    return text
      .split('|')
      .map((part) => formatValueForCopy(part, objective))
      .filter(Boolean)
      .join(' | ')
  }

  const separatorIndex = text.indexOf(':')
  if (separatorIndex >= 0) {
    const label = clean(text.slice(0, separatorIndex))
    const rawValue = clean(text.slice(separatorIndex + 1))
    return label && rawValue ? `${label}: ${formatValueChunk(rawValue, label)}` : text
  }

  const currencyMatch = text.match(/R\$\s*[\d.]+(?:,\d{2})?(?:\/m[e\u00ea]s)?/i)
  if (currencyMatch) return currencyMatch[0].replace(/\/mes$/i, '/m\u00eas')

  const numericMatch = text.match(/\d+(?:[.,]\d{1,2})?/)
  if (numericMatch && normalize(text).replace(/[^0-9]/g, '') === numericMatch[0].replace(/\D/g, '')) {
    return formatCurrencyForDisplay(numericMatch[0], objective)
  }

  return text
}

function getValueText(input: CopyEngineInput, kind: CampaignKind): string {
  if (!input.showValue) return ''
  const objective = kind === 'rent' ? 'locacao' : input.objective || input.objectiveLabel
  const raw = input.displayPrice || input.display_price || input.valor_exibicao || input.value
  const formatted = formatValueForCopy(raw, objective)
  if (!formatted) return ''
  if (formatted.includes(':')) return formatted
  return `${kind === 'rent' ? 'Aluguel' : 'Valor'}: ${formatted}`
}

function getFacts(input: CopyEngineInput): string[] {
  return compact([
    formatBedrooms(input.bedrooms),
    formatSuites(input.suites),
    formatParking(input.parking),
    getDisplayArea(input),
  ])
}

function getFactSentence(input: CopyEngineInput): string {
  const facts = getFacts(input)
  return facts.length ? joinNatural(facts) : ''
}

function ctaLine(cta: string, phone: string): string {
  if (phone) return `${cta}: ${phone}`
  return sentence(cta)
}

function portalContactLine(cta: string, phone: string): string {
  if (!phone) return ''
  return normalize(cta).includes('CONDICOES')
    ? `Entre em contato para conhecer as condi\u00e7\u00f5es: ${phone}`
    : `Entre em contato para mais informa\u00e7\u00f5es: ${phone}`
}

function propertyCopy(input: CopyEngineInput, kind: CampaignKind): CopyEngineOutput {
  const location = getLocationInfo(input)
  const propertyType = getPropertyType(input)
  const factsText = getFactSentence(input)
  const stage = getStageText(input)
  const differentials = getDifferentials(input)
  const socialDifferential = buildDifferentialSentence(differentials, 'social')
  const portalDifferential = buildDifferentialSentence(differentials, 'portal')
  const cta = getCta(input)
  const contactPhone = getContactPhone(input)
  const valueText = getValueText(input, kind)
  const rentMode = kind === 'rent'
  const action = rentMode ? 'para loca\u00e7\u00e3o' : '\u00e0 venda'
  const availableAction = rentMode ? 'dispon\u00edvel para loca\u00e7\u00e3o' : '\u00e0 venda'
  const opening = `${[
    `${propertyType} ${action} ${location.full}`,
    stage,
    factsText ? `com ${factsText}` : '',
  ].filter(Boolean).join(', ')}.`
  const directOpening = `${propertyType} ${action} ${location.short}.`
  const factsLine = factsText ? sentence(factsText) : ''
  const stageLine = stage ? sentence(startUpper(stage)) : ''
  const directDifferentialLine = differentials.length ? sentence(startUpper(differentials[0])) : ''
  const valueLine = valueText ? sentence(valueText) : ''
  const socialCta = ctaLine(cta, contactPhone)
  const routineLine = socialDifferential
    || (location.district ? 'Uma op\u00e7\u00e3o pr\u00e1tica para quem busca facilidade no dia a dia.' : 'Uma op\u00e7\u00e3o para quem busca uma decis\u00e3o imobili\u00e1ria mais objetiva.')

  return [
    {
      label: 'Instagram/Facebook Comercial',
      text: [
        opening,
        valueLine,
        routineLine,
        socialCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Emocional',
      text: [
        location.district
          ? `Viver ${location.short} pode deixar a rotina mais simples.`
          : 'Viver bem tamb\u00e9m \u00e9 encontrar um im\u00f3vel que combina com o seu momento.',
        [
          `Este ${propertyType.toLowerCase()} ${rentMode ? 'para loca\u00e7\u00e3o' : '\u00e0 venda'}`,
          stage,
          factsText ? `re\u00fane ${factsText}` : '',
        ].filter(Boolean).join(', ') + '.',
        differentials.length ? buildDifferentialSentence(differentials.slice(0, 1), 'social') : '',
        socialCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Direta',
      text: [
        directOpening,
        factsLine,
        stageLine,
        directDifferentialLine,
        valueLine,
        socialCta,
      ].filter(Boolean).join('\n'),
    },
    {
      label: 'WhatsApp Conversa',
      text: [
        'Ol\u00e1! Tudo bem?',
        '',
        sentence(`Tenho um ${propertyType.toLowerCase()} ${action} ${location.short} que pode fazer sentido para voc\u00ea`),
        factsText || stage || differentials.length
          ? sentence([
            factsText ? `S\u00e3o ${factsText}` : '',
            stage,
            differentials.length ? `com ${joinNatural(differentials.slice(0, 2))}` : '',
          ].filter(Boolean).join(', '))
          : '',
        valueLine,
        'Quer que eu te envie mais detalhes?',
        contactPhone ? `Contato: ${contactPhone}` : '',
      ].filter((item, index) => index === 1 || item !== '').join('\n'),
    },
    {
      label: 'WhatsApp Carteira',
      text: [
        sentence(`${propertyType} ${availableAction} ${location.short}`),
        [stage ? startUpper(stage) : '', factsText ? `com ${factsText}` : ''].filter(Boolean).join(', ') + (stage || factsText ? '.' : ''),
        socialDifferential,
        valueLine,
        contactPhone ? `Para mais informa\u00e7\u00f5es, fale comigo: ${contactPhone}` : sentence(cta),
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'WhatsApp Curto',
      text: [
        directOpening,
        factsLine,
        stageLine,
        directDifferentialLine,
        valueLine,
        socialCta,
      ].filter(Boolean).join('\n'),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `${propertyType} ${availableAction} ${location.full}${stage ? `, ${stage}` : ''}`,
        factsText ? `O im\u00f3vel possui ${factsText}` : '',
        valueText,
        portalDifferential,
        portalContactLine(cta, contactPhone),
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, kind).join(' '),
    },
  ]
}

function propertyCaptureCopy(input: CopyEngineInput): CopyEngineOutput {
  const location = getLocationInfo(input)
  const cta = getCta(input)
  const contactPhone = getContactPhone(input)
  const contactCta = ctaLine(cta, contactPhone)
  const place = location.city || location.district || getPlace(input)
  const placePhrase = place && place !== 'a regi\u00e3o selecionada' ? ` em ${place}` : ''
  const ownerQuestion = `Tem um im\u00f3vel${placePhrase} e pensa em vender ou alugar?`
  const strategyLine = 'Com uma apresenta\u00e7\u00e3o profissional, seu im\u00f3vel ganha mais visibilidade, atrai interessados mais qualificados e aumenta as chances de uma boa negocia\u00e7\u00e3o.'

  return [
    {
      label: 'Instagram/Facebook Comercial',
      text: [
        ownerQuestion,
        strategyLine,
        contactCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Emocional',
      text: [
        'Seu im\u00f3vel pode chegar \u00e0s pessoas certas com uma divulga\u00e7\u00e3o mais cuidadosa.',
        placePhrase
          ? `Em ${place}, uma estrat\u00e9gia bem feita ajuda a valorizar o im\u00f3vel e abrir conversas com interessados reais.`
          : 'Uma estrat\u00e9gia bem feita ajuda a valorizar o im\u00f3vel e abrir conversas com interessados reais.',
        contactCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Direta',
      text: [
        `Capta\u00e7\u00e3o de im\u00f3veis${placePhrase}.`,
        'Venda ou loca\u00e7\u00e3o com divulga\u00e7\u00e3o profissional e atendimento consultivo.',
        contactCta,
      ].filter(Boolean).join('\n'),
    },
    {
      label: 'WhatsApp Conversa',
      text: [
        'Ol\u00e1! Tudo bem?',
        '',
        `Estou captando im\u00f3veis${placePhrase} para venda e loca\u00e7\u00e3o.`,
        'Se voc\u00ea tem um im\u00f3vel ou conhece algu\u00e9m que deseja vender ou alugar, posso ajudar com uma divulga\u00e7\u00e3o mais estrat\u00e9gica e profissional.',
        contactPhone ? `Contato: ${contactPhone}` : '',
      ].filter((item, index) => index === 1 || item !== '').join('\n'),
    },
    {
      label: 'WhatsApp Carteira',
      text: [
        `Estou captando im\u00f3veis${placePhrase} para venda e loca\u00e7\u00e3o.`,
        'Se souber de algu\u00e9m que quer vender ou alugar, pode me indicar.',
        contactPhone ? `Fale comigo: ${contactPhone}` : sentence(cta),
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'WhatsApp Curto',
      text: [
        ownerQuestion,
        'Posso ajudar com avalia\u00e7\u00e3o, divulga\u00e7\u00e3o e atendimento para venda ou loca\u00e7\u00e3o.',
        contactCta,
      ].filter(Boolean).join('\n'),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `Atendimento para propriet\u00e1rios que desejam vender ou alugar im\u00f3veis${placePhrase}`,
        'Trabalho com avalia\u00e7\u00e3o, divulga\u00e7\u00e3o e acompanhamento para aproximar o im\u00f3vel de interessados mais qualificados',
        portalContactLine(cta, contactPhone),
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, 'property_capture').join(' '),
    },
  ]
}

function brokerCaptureCopy(input: CopyEngineInput): CopyEngineOutput {
  const location = getLocationInfo(input)
  const place = location.city || location.district || getPlace(input)
  const professional = getPropertyType(input)
  const cta = getCta(input)
  const contactPhone = getContactPhone(input)
  const contactCta = ctaLine(cta, contactPhone)
  const placePhrase = place && place !== 'a regi\u00e3o selecionada' ? ` em ${place}` : ''

  return [
    {
      label: 'Instagram/Facebook Comercial',
      text: [
        `Estamos buscando ${professional.toLowerCase()}${placePhrase} para fazer parte de uma equipe com vis\u00e3o de crescimento.`,
        'Uma oportunidade para quem quer atuar com atendimento profissional, relacionamento e resultado no mercado imobili\u00e1rio.',
        contactCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Emocional',
      text: [
        'Toda carreira tem um momento de dar o pr\u00f3ximo passo.',
        placePhrase
          ? `Para corretores${placePhrase}, esta pode ser uma nova fase com mais troca, estrutura e oportunidades.`
          : 'Para profissionais do mercado imobili\u00e1rio, esta pode ser uma nova fase com mais troca, estrutura e oportunidades.',
        contactCta,
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'Instagram/Facebook Direta',
      text: [
        `Oportunidade para ${professional.toLowerCase()}${placePhrase}.`,
        'Equipe imobili\u00e1ria em crescimento.',
        contactCta,
      ].filter(Boolean).join('\n'),
    },
    {
      label: 'WhatsApp Conversa',
      text: [
        'Ol\u00e1! Tudo bem?',
        '',
        `Estamos abrindo oportunidade para ${professional.toLowerCase()}${placePhrase}.`,
        'A ideia \u00e9 conversar com profissionais que querem crescer no mercado imobili\u00e1rio com mais estrutura e parceria.',
        contactPhone ? `Contato: ${contactPhone}` : '',
      ].filter((item, index) => index === 1 || item !== '').join('\n'),
    },
    {
      label: 'WhatsApp Carteira',
      text: [
        `Estamos buscando profissionais do mercado imobili\u00e1rio${placePhrase}.`,
        'Se conhecer algu\u00e9m em busca de uma nova oportunidade, pode me indicar.',
        contactPhone ? `Contato: ${contactPhone}` : sentence(cta),
      ].filter(Boolean).join('\n\n'),
    },
    {
      label: 'WhatsApp Curto',
      text: joinSentenceParts([
        `Oportunidade para ${professional.toLowerCase()}${placePhrase}`,
        contactPhone ? `Contato: ${contactPhone}` : cta,
      ]),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `Oportunidade para profissionais do mercado imobili\u00e1rio${placePhrase}`,
        'Busca por pessoas comprometidas com atendimento, relacionamento e crescimento profissional',
        portalContactLine(cta, contactPhone),
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, 'broker_capture').join(' '),
    },
  ]
}

function toHashtagToken(value: unknown): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function getCityHashtagSuffix(city: unknown): string {
  const token = toHashtagToken(city)
  if (!token) return ''
  if (normalize(city) === 'SAO PAULO') return 'SP'
  if (normalize(city) === 'RIO DE JANEIRO') return 'RJ'
  return token
}

function buildHashtags(input: CopyEngineInput, kind: CampaignKind): string[] {
  const city = toHashtagToken(input.city)
  const citySuffix = getCityHashtagSuffix(input.city)
  const district = toHashtagToken(input.district)
  const type = ['TODOS', 'TODAS', 'ALL'].includes(normalize(input.propertyType))
    ? ''
    : toHashtagToken(input.propertyType)
  const locationTag = district || city

  if (kind === 'property_capture') {
    const captureTags = [
      locationTag,
      'CaptacaoDeImoveis',
      'VendaDeImoveis',
      'LocacaoDeImoveis',
      'MercadoImobiliario',
      'CorretorDeImoveis',
      'SmartCorretorAI',
    ]
    return [...new Set(captureTags.filter(Boolean).map((tag) => `#${tag}`))].slice(0, 8)
  }

  const typeObjectiveTag = type
    ? kind === 'rent'
      ? `${type}ParaLocacao`
      : kind === 'sale'
        ? `${type}AVenda`
        : type
    : ''
  const objectiveTag = {
    sale: 'VendaDeImoveis',
    rent: 'Locacao',
    property_capture: 'CaptacaoDeImoveis',
    broker_capture: 'CorretoresDeImoveis',
    generic: 'MercadoImobiliario',
  }[kind]
  const tags = [
    locationTag,
    typeObjectiveTag,
    citySuffix ? `Imoveis${citySuffix}` : '',
    objectiveTag,
    kind === 'rent' && citySuffix ? `Locacao${citySuffix}` : '',
    'Imoveis',
    'MercadoImobiliario',
    'MorarBem',
    'SmartCorretorAI',
  ]
  const unique = [...new Set(tags.filter(Boolean).map((tag) => `#${tag}`))]
  const smartTag = '#SmartCorretorAI'
  return unique.includes(smartTag)
    ? [...unique.filter((tag) => tag !== smartTag).slice(0, 7), smartTag]
    : unique.slice(0, 8)
}

export function buildPublicationPackage(input: CopyEngineInput): CopyEngineOutput {
  const kind = getCampaignKind(input)
  if (kind === 'property_capture') return propertyCaptureCopy(input)
  if (kind === 'broker_capture') return brokerCaptureCopy(input)
  return propertyCopy(input, kind)
}

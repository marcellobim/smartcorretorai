export type CopyEngineInput = {
  objective?: string
  objectiveLabel?: string
  propertyType?: string
  profile?: string
  city?: string
  district?: string
  location?: string
  features?: string[]
  bedrooms?: string
  suites?: string
  parking?: string
  area?: string
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
  const smallWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'para'])
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
  return district || city || location || 'a regiao selecionada'
}

function getPropertyType(input: CopyEngineInput): string {
  return toReadable(input.propertyType) || 'imovel'
}

function getProfile(input: CopyEngineInput): string {
  return toReadable(input.profile)
}

function formatBedrooms(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (normalize(text) === 'STUDIO') return 'studio'
  return `${text} ${text === '1' ? 'dormitorio' : 'dormitorios'}`
}

function formatSuites(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/NENHUMA/i.test(normalize(text))) return 'nenhuma suite'
  return `${text} ${text === '1' ? 'suite' : 'suites'}`
}

function formatParking(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  if (/NENHUMA/i.test(normalize(text))) return 'sem vaga'
  return `${text} ${text === '1' ? 'vaga' : 'vagas'}`
}

function formatArea(value: unknown): string {
  const text = clean(value)
  if (!text) return ''
  return /\bm2\b|m²/i.test(text) ? text : `${text} m2`
}

function getImmutableFacts(input: CopyEngineInput): string[] {
  return compact([
    formatBedrooms(input.bedrooms),
    formatSuites(input.suites),
    formatParking(input.parking),
    formatArea(input.area),
  ])
}

function getFeatureText(input: CopyEngineInput): string {
  const feature = compact(input.features || []).map(toReadable).slice(0, 2).join(' e ')
  return feature || getProfile(input)
}

function getCta(input: CopyEngineInput, fallback = 'Entre em contato'): string {
  return toReadable(input.cta) || fallback
}

function joinSentenceParts(parts: Array<string | undefined | null | false>): string {
  return compact(parts).map(sentence).join(' ')
}

function propertyCopy(input: CopyEngineInput, kind: CampaignKind): CopyEngineOutput {
  const place = getPlace(input)
  const propertyType = getPropertyType(input)
  const profile = getProfile(input)
  const facts = getImmutableFacts(input)
  const factsText = facts.length ? facts.join(', ') : ''
  const feature = getFeatureText(input)
  const cta = getCta(input)
  const rentMode = kind === 'rent'
  const action = rentMode ? 'locacao' : 'venda'
  const actionVerb = rentMode ? 'alugar' : 'comprar'

  return [
    {
      label: 'Instagram Comercial',
      text: joinSentenceParts([
        `${propertyType} para ${action} em ${place}`,
        factsText ? `Com ${factsText}` : '',
        feature ? `Destaque para ${feature}` : '',
        `${cta}`,
      ]),
    },
    {
      label: 'Instagram Emocional',
      text: joinSentenceParts([
        `${place} pode ser o cenario do proximo passo`,
        `${propertyType}${profile ? ` ${profile}` : ''} pensado para quem busca uma escolha mais certeira`,
        factsText ? `Conta com ${factsText}` : '',
        `${cta}`,
      ]),
    },
    {
      label: 'Instagram Direto',
      text: joinSentenceParts([
        `${propertyType} em ${place}`,
        factsText,
        cta,
      ]),
    },
    {
      label: 'WhatsApp Conversa',
      text: joinSentenceParts([
        `Oi, tenho uma opcao em ${place} que pode fazer sentido para voce`,
        `${propertyType}${factsText ? ` com ${factsText}` : ''}`,
        feature ? `O ponto forte e ${feature}` : '',
        `Quer que eu te mande mais detalhes?`,
      ]),
    },
    {
      label: 'WhatsApp Carteira',
      text: joinSentenceParts([
        `Separei este ${propertyType.toLowerCase()} em ${place} porque combina com o que alguns clientes procuram`,
        factsText ? `Ele tem ${factsText}` : '',
        rentMode ? 'Esta disponivel para locacao' : 'Pode ser uma boa oportunidade de compra',
        `Me chama que eu te explico melhor`,
      ]),
    },
    {
      label: 'WhatsApp Curto',
      text: joinSentenceParts([
        `${propertyType} em ${place}`,
        factsText,
        `Quer saber mais?`,
      ]),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `${propertyType} disponivel para ${action} em ${place}`,
        factsText ? `O imovel conta com ${factsText}` : '',
        feature ? `Diferencial: ${feature}` : '',
        `Uma opcao indicada para quem busca ${rentMode ? 'praticidade para alugar' : `seguranca para ${actionVerb}`}`,
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, kind).join(' '),
    },
  ]
}

function propertyCaptureCopy(input: CopyEngineInput): CopyEngineOutput {
  const place = getPlace(input)
  const propertyType = getPropertyType(input)
  const feature = getFeatureText(input)
  const cta = getCta(input)

  return [
    {
      label: 'Instagram Comercial',
      text: joinSentenceParts([
        `Tem ${propertyType.toLowerCase()} em ${place}?`,
        `Apresente seu imovel com estrategia, alcance e atendimento profissional`,
        feature ? `Destaque para ${feature}` : '',
        cta,
      ]),
    },
    {
      label: 'Instagram Emocional',
      text: joinSentenceParts([
        `Seu imovel merece ser visto pelas pessoas certas`,
        `Em ${place}, uma boa apresentacao pode abrir novas oportunidades`,
        `Fale com quem entende do mercado`,
      ]),
    },
    {
      label: 'Instagram Direto',
      text: joinSentenceParts([
        `Quer vender ou alugar em ${place}?`,
        `Atendimento profissional para captar e divulgar seu imovel`,
        cta,
      ]),
    },
    {
      label: 'WhatsApp Conversa',
      text: joinSentenceParts([
        `Oi, se voce tem imovel em ${place}, posso te ajudar a avaliar a melhor estrategia`,
        `A ideia e divulgar com mais clareza e atrair oportunidades reais`,
      ]),
    },
    {
      label: 'WhatsApp Carteira',
      text: joinSentenceParts([
        `Estou captando imoveis em ${place}`,
        `Se souber de alguem que quer vender ou alugar, pode me indicar`,
      ]),
    },
    {
      label: 'WhatsApp Curto',
      text: joinSentenceParts([
        `Tem imovel em ${place}?`,
        `Fale comigo para vender ou alugar com estrategia`,
      ]),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `Atendimento especializado para proprietarios que desejam vender ou alugar imoveis em ${place}`,
        feature ? `Trabalho com foco em ${feature}` : '',
        `Acompanhamento profissional para valorizar a apresentacao e ampliar as oportunidades de negociacao`,
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, 'property_capture').join(' '),
    },
  ]
}

function brokerCaptureCopy(input: CopyEngineInput): CopyEngineOutput {
  const place = getPlace(input)
  const professional = getPropertyType(input)
  const feature = getFeatureText(input)
  const cta = getCta(input)

  return [
    {
      label: 'Instagram Comercial',
      text: joinSentenceParts([
        `Oportunidade para ${professional.toLowerCase()} em ${place}`,
        feature ? `Estrutura com foco em ${feature}` : '',
        `Faca parte de um time preparado para crescer no mercado imobiliario`,
        cta,
      ]),
    },
    {
      label: 'Instagram Emocional',
      text: joinSentenceParts([
        `Toda carreira tem um momento de virar a chave`,
        `Se voce atua no mercado imobiliario em ${place}, esta pode ser uma nova fase`,
        `Cresca com apoio, estrutura e foco em resultados`,
      ]),
    },
    {
      label: 'Instagram Direto',
      text: joinSentenceParts([
        `${professional} em ${place}`,
        `Estamos buscando novos profissionais`,
        cta,
      ]),
    },
    {
      label: 'WhatsApp Conversa',
      text: joinSentenceParts([
        `Oi, estamos abrindo oportunidade para ${professional.toLowerCase()} em ${place}`,
        feature ? `A proposta tem foco em ${feature}` : '',
        `Quer conversar sobre isso?`,
      ]),
    },
    {
      label: 'WhatsApp Carteira',
      text: joinSentenceParts([
        `Se conhecer algum profissional do mercado imobiliario em ${place}, estou com uma oportunidade interessante`,
        `Pode me indicar ou encaminhar meu contato`,
      ]),
    },
    {
      label: 'WhatsApp Curto',
      text: joinSentenceParts([
        `Oportunidade para ${professional.toLowerCase()} em ${place}`,
        `Quer saber mais?`,
      ]),
    },
    {
      label: 'Portal',
      text: joinSentenceParts([
        `Oportunidade para profissionais do mercado imobiliario em ${place}`,
        feature ? `Ambiente com foco em ${feature}` : '',
        `Busca por pessoas comprometidas com atendimento, crescimento profissional e resultados`,
      ]),
    },
    {
      label: 'Hashtags',
      text: buildHashtags(input, 'broker_capture').join(' '),
    },
  ]
}

function buildHashtags(input: CopyEngineInput, kind: CampaignKind): string[] {
  const city = normalize(input.city).replace(/[^A-Z0-9]/g, '')
  const district = normalize(input.district).replace(/[^A-Z0-9]/g, '')
  const type = normalize(input.propertyType).replace(/[^A-Z0-9]/g, '')
  const profile = normalize(input.profile).replace(/[^A-Z0-9]/g, '')
  const objectiveTag = {
    sale: 'VendaDeImoveis',
    rent: 'Locacao',
    property_capture: 'CaptacaoDeImoveis',
    broker_capture: 'CorretoresDeImoveis',
    generic: 'MercadoImobiliario',
  }[kind]
  const tags = [
    objectiveTag,
    city,
    district,
    type,
    profile,
    'Imoveis',
    'MercadoImobiliario',
    'SmartCorretorAI',
  ]
  return [...new Set(tags.filter(Boolean).map((tag) => `#${tag}`))].slice(0, 8)
}

export function buildPublicationPackage(input: CopyEngineInput): CopyEngineOutput {
  const kind = getCampaignKind(input)
  if (kind === 'property_capture') return propertyCaptureCopy(input)
  if (kind === 'broker_capture') return brokerCaptureCopy(input)
  return propertyCopy(input, kind)
}

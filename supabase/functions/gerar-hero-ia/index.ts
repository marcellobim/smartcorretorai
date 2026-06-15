import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MASTER_MARKER = '[[SMARTCORRETORAI_MASTER_PROPERTY_V1]]'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, x-supabase-authorization, accept',
  'Access-Control-Max-Age': '86400',
}

const IMAGE_MODES = new Set(['main_photo', 'reference_photos', 'new_image'])
const HERO_IMAGE_BUCKET = 'smartcorretor-assets'
const HERO_PROMPT_VERSION = 'hero_image_prompt_v1'
const DELIVERY_KEYS = new Set([
  'hero_image',
  'instagram_text',
  'hashtags',
  'cta',
  'whatsapp',
  'portal_description',
])

type JsonRecord = Record<string, unknown>
type InlineImageInput = {
  name: string
  contentType: string
  data: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeText(value: unknown, maxLength = 180) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeLongText(value: unknown, maxLength = 5000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
}

function normalizeId(value: unknown, allowed?: Set<string>) {
  const normalized = normalizeText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  if (!normalized) return ''
  if (allowed && !allowed.has(normalized)) return ''
  return normalized
}

function normalizeTextArray(value: unknown, maxItems = 12, maxLength = 120) {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  for (const item of value) {
    const normalized = normalizeText(item, maxLength)
    if (normalized && !items.includes(normalized)) items.push(normalized)
    if (items.length >= maxItems) break
  }
  return items
}

function normalizePhotoUrls(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return []
  const urls: string[] = []

  for (const item of value) {
    const candidate = typeof item === 'string'
      ? item
      : item && typeof item === 'object'
        ? (item as JsonRecord).url || (item as JsonRecord).publicUrl || (item as JsonRecord).signedUrl || (item as JsonRecord).path
        : ''
    const url = normalizeText(candidate, 2000)
    if (/^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url)
    if (urls.length >= maxItems) break
  }

  return urls
}

function normalizeInlineImages(value: unknown, maxItems = 8): InlineImageInput[] {
  if (!Array.isArray(value)) return []
  const images: InlineImageInput[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const source = item as JsonRecord
    const contentType = normalizeText(source.content_type ?? source.contentType, 80).toLowerCase()
    const data = String(source.data ?? source.base64 ?? '').trim()
    const name = normalizeText(source.name, 120) || `referencia-${images.length + 1}.jpg`

    if (!contentType.startsWith('image/') || !data) continue
    images.push({ name, contentType, data })
    if (images.length >= maxItems) break
  }

  return images
}

function getInlineImageBase64(data: string) {
  const commaIndex = data.indexOf(',')
  return commaIndex >= 0 ? data.slice(commaIndex + 1).trim() : data.trim()
}

function getImageExtension(contentType: string) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

function inlineImageToFile(image: InlineImageInput, index: number) {
  const safeExtension = getImageExtension(image.contentType)
  const safeName = image.name.includes('.')
    ? image.name.replace(/[^a-z0-9._-]/gi, '-')
    : `referencia-${index + 1}.${safeExtension}`
  const bytes = base64ToUint8Array(getInlineImageBase64(image.data))
  return new File([bytes], safeName, { type: image.contentType })
}

function sanitizePromptBriefingForStorage(briefing: JsonRecord) {
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const inlineImages = normalizeInlineImages(choices.inline_images, 8)

  return {
    ...briefing,
    choices: {
      ...choices,
      inline_images: undefined,
      inline_image_count: inlineImages.length,
    },
  }
}

function normalizeLabeledItems(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return []
  const items: Array<{ id: string; label: string; format_group?: string }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const source = item as JsonRecord
    const id = normalizeId(source.id)
    const label = normalizeText(source.label, 120)
    const formatGroup = normalizeId(source.format_group)
    if (!id || !label || items.some((existing) => existing.id === id)) continue
    items.push({
      id,
      label,
      ...(formatGroup ? { format_group: formatGroup } : {}),
    })
    if (items.length >= maxItems) break
  }
  return items
}

function normalizeLabeledItem(value: unknown) {
  const [item] = normalizeLabeledItems([value], 1)
  return item || null
}

function parseMasterProperty(description: unknown) {
  const raw = String(description || '')
  const markerIndex = raw.indexOf(MASTER_MARKER)
  if (markerIndex === -1) return {}

  try {
    const parsed = JSON.parse(raw.slice(markerIndex + MASTER_MARKER.length).trim())
    return parsed && typeof parsed === 'object' ? parsed as JsonRecord : {}
  } catch {
    return {}
  }
}

function normalizeDeliverables(input: unknown) {
  const source = input && typeof input === 'object' ? input as JsonRecord : {}
  const deliverables: Record<string, boolean> = {}
  for (const key of DELIVERY_KEYS) {
    deliverables[key] = source[key] !== false
  }
  deliverables.hero_image = true
  return deliverables
}

function normalizeValueCondition(input: unknown) {
  const source = input && typeof input === 'object' ? input as JsonRecord : {}
  const mode = normalizeId(source.mode)
  return {
    mode: mode || 'hide_values',
    label: normalizeText(source.label, 120),
    details: normalizeText(source.details, 280),
  }
}

function buildLocation(property: JsonRecord) {
  return [
    normalizeText(property.neighborhood, 100),
    normalizeText(property.city, 100),
    normalizeText(property.state, 2),
  ].filter(Boolean).join(', ')
}

function getImageSize(briefing: JsonRecord) {
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const destination = choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination as JsonRecord
    : {}
  const formatGroup = normalizeId(destination.format_group)
  if (formatGroup === 'vertical') return '1024x1536'
  if (formatGroup === 'landscape') return '1536x1024'
  return '1024x1024'
}

function getExperimentalImageSize(briefing: JsonRecord) {
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const destination = choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination as JsonRecord
    : {}
  const id = normalizeId(destination.id)
  const label = normalizeText(destination.label, 120).toLowerCase()
  const formatGroup = normalizeId(destination.format_group)

  if (id.includes('story') || id.includes('reels') || label.includes('story') || label.includes('reels') || formatGroup === 'vertical') {
    return '1024x1536'
  }

  if (id.includes('google') || id.includes('ads') || id.includes('facebook') || id.includes('landing') || label.includes('google') || label.includes('facebook') || label.includes('landing') || formatGroup === 'landscape') {
    return '1536x1024'
  }

  if (id.includes('instagram') || id.includes('feed') || id.includes('whatsapp') || label.includes('instagram') || label.includes('feed') || label.includes('whatsapp') || formatGroup === 'square_feed') {
    return '1024x1024'
  }

  return 'auto'
}

function normalizeComparableText(value: unknown) {
  return normalizeText(value, 240)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildHeroVisualStrategy(input: {
  objective: unknown
  profile: unknown
  stage: unknown
  city: unknown
  district: unknown
  bedrooms: unknown
  suites: unknown
  parking: unknown
  highlights: string[]
  cta: unknown
  destination: unknown
}) {
  const objectiveText = normalizeComparableText(input.objective)
  const profileText = normalizeComparableText(input.profile)
  const stageText = normalizeComparableText(input.stage)
  const highlightText = normalizeComparableText(input.highlights.join(' '))
  const ctaText = normalizeComparableText(input.cta)
  const destinationText = normalizeComparableText(input.destination)
  const combined = `${objectiveText} ${profileText} ${stageText} ${highlightText} ${ctaText} ${destinationText}`

  if (combined.includes('locacao') || combined.includes('aluguel')) {
    return {
      family: 'Locação prática',
      promise: 'Disponibilidade clara, localização valorizada e contato rápido para visita.',
      visualDirection: 'Peça limpa, objetiva e prática, com aparência urbana, confiável e fácil de entender.',
      palette: 'Branco, azul, cinza claro, verde pontual e tons neutros; evitar preto/dourado dominante.',
      hierarchy: 'Imagem principal do imóvel, localização em destaque, CTA forte e poucos dados úteis para decisão rápida.',
      tone: 'Direto, comercial, acessível e orientado à ação.',
      avoid: 'Não usar estética de lançamento, compra, luxo pesado, promessa de investimento ou linguagem aspiracional exagerada.',
    }
  }

  if (combined.includes('minha casa') || combined.includes('mcmv') || combined.includes('popular') || combined.includes('casa propria')) {
    return {
      family: 'MCMV / Casa própria',
      promise: 'Facilitar a conquista do primeiro imóvel e transmitir oportunidade real de sair do aluguel.',
      visualDirection: 'Visual claro, acessível, moderno e otimista, com sensação de novo começo, acolhimento e conquista.',
      palette: 'Azul, verde, laranja, amarelo, branco e tons claros; evitar preto, dourado, luxo e alto contraste pesado.',
      hierarchy: 'Headline emocional e simples, CTA muito visível, poucos dados e leitura imediata em celular.',
      tone: 'Popular qualificado, humano, positivo e direto, sem linguagem de alto padrão.',
      avoid: 'Não aplicar estética de luxo, não usar navy/dourado como base e não transformar a peça em ficha técnica fria.',
    }
  }

  if (combined.includes('lancamento') || combined.includes('pre-lancamento') || combined.includes('pre lancamento')) {
    return {
      family: 'Lançamento / Oportunidade',
      promise: 'Apresentar novidade, oportunidade de entrada e sensação de momento certo.',
      visualDirection: 'Visual fresco, contemporâneo e energético, com composição clara de oportunidade e campanha de lançamento.',
      palette: 'Branco, azul, verde, laranja, tons claros e acentos vibrantes; luxo só se o perfil também for alto padrão.',
      hierarchy: 'Headline de oportunidade, selo ou chamada curta, CTA destacado e imagem principal limpa.',
      tone: 'Confiante, convidativo e orientado a ação rápida.',
      avoid: 'Não parecer folder institucional antigo, prancha de empreendimento ou mosaico de formatos.',
    }
  }

  if (combined.includes('metro') || combined.includes('metrô') || combined.includes('mobilidade') || combined.includes('transporte') || combined.includes('perto de tudo')) {
    return {
      family: 'Mobilidade / Localização',
      promise: 'Mostrar rotina facilitada, acesso, bairro e conveniência como argumentos centrais.',
      visualDirection: 'Visual urbano, leve e dinâmico, com sensação de cidade, praticidade e deslocamento fácil.',
      palette: 'Branco, azul, verde, cinza claro e acentos laranja ou amarelos; evitar luxo escuro dominante.',
      hierarchy: 'Localização e CTA primeiro, depois benefício de rotina e um dado objetivo do imóvel.',
      tone: 'Moderno, útil, claro e voltado para o dia a dia.',
      avoid: 'Não inventar metrô, estação, comércio, vista ou serviços se não foram informados.',
    }
  }

  if (combined.includes('invest') || combined.includes('valoriz') || combined.includes('rentabilidade') || combined.includes('renda')) {
    return {
      family: 'Investimento / Valorização',
      promise: 'Comunicar potencial, escassez, valorização e racional de oportunidade sem inventar números.',
      visualDirection: 'Visual sólido, moderno e analítico, com aparência de oportunidade imobiliária confiável.',
      palette: 'Azul profundo moderado, branco, cinza, verde e detalhes metálicos discretos; dourado só como acento.',
      hierarchy: 'Promessa de oportunidade, localização, CTA e benefício financeiro qualitativo sem dados inventados.',
      tone: 'Seguro, racional, estratégico e objetivo.',
      avoid: 'Não prometer rentabilidade, porcentagem, ROI, escassez ou valorização específica sem dado fornecido.',
    }
  }

  if (combined.includes('open house') || combined.includes('evento') || combined.includes('visita guiada')) {
    return {
      family: 'Open House / Evento',
      promise: 'Convidar para uma visita com data, urgência leve e facilidade de participação.',
      visualDirection: 'Visual convidativo, claro e com energia de evento, sem parecer anúncio frio de portal.',
      palette: 'Branco, azul, verde, laranja e tons quentes leves.',
      hierarchy: 'Convite e CTA primeiro, localização em seguida, dados mínimos para interesse.',
      tone: 'Próximo, convidativo e direto.',
      avoid: 'Não criar aparência de show, festa ou evento genérico fora do contexto imobiliário.',
    }
  }

  if (combined.includes('institucional') || combined.includes('corretor') || combined.includes('captacao') || combined.includes('captação')) {
    return {
      family: 'Institucional / Corretor / Captação',
      promise: 'Construir autoridade e confiança sem parecer campanha de venda de um imóvel específico.',
      visualDirection: 'Visual profissional, limpo e confiável, com foco em marca pessoal, atendimento e credibilidade.',
      palette: 'Branco, cinza, azul, preto suave e acentos da marca; evitar ostentação.',
      hierarchy: 'Mensagem de autoridade, CTA de contato e elemento visual imobiliário de apoio.',
      tone: 'Consultivo, seguro e profissional.',
      avoid: 'Não inventar imóvel, não usar ficha técnica e não parecer propaganda de empreendimento.',
    }
  }

  if (combined.includes('luxo')) {
    return {
      family: 'Luxo / Exclusividade',
      promise: 'Transmitir raridade, privacidade, status e desejo para um público de alto poder aquisitivo.',
      visualDirection: 'Visual editorial, cinematográfico e de luxo extremo, com composição refinada e pouco texto.',
      palette: 'Preto, off-white, champagne, dourado, tons profundos e alto contraste controlado.',
      hierarchy: 'Imagem aspiracional dominante, headline curta, CTA discreto e sofisticado.',
      tone: 'Exclusivo, sensorial, elegante e contido.',
      avoid: 'Não usar excesso de ficha técnica, cores populares, selos chamativos ou linguagem promocional agressiva.',
    }
  }

  if (combined.includes('alto padrao') || combined.includes('alto')) {
    return {
      family: 'Alto padrão / Lifestyle',
      promise: 'Vender uma experiência de morar melhor, com desejo, localização e acabamento percebido.',
      visualDirection: 'Visual sofisticado, elegante e aspiracional, com estética de lifestyle imobiliário.',
      palette: 'Navy, champagne, preto equilibrado, off-white, cinza quente e dourado discreto.',
      hierarchy: 'Imagem principal forte, headline aspiracional, bairro/localização e CTA elegante.',
      tone: 'Sofisticado, seguro, aspiracional e comercial.',
      avoid: 'Não exagerar em dourado, não criar ostentação vazia e não inventar acabamentos ou serviços.',
    }
  }

  return {
    family: 'Médio padrão / Praticidade',
    promise: 'Mostrar conforto, localização, rotina fácil e bom custo-benefício para decisão prática.',
    visualDirection: 'Visual limpo, moderno, urbano e confiável, com aparência profissional sem luxo pesado.',
    palette: 'Branco, azul, cinza claro, verde e laranja pontual; evitar preto/navy/dourado como base.',
    hierarchy: 'Headline clara, benefício principal de rotina, CTA forte e no máximo poucos dados objetivos.',
    tone: 'Claro, comercial, confiável e próximo.',
    avoid: 'Não aplicar visual de luxo, não dominar com ficha técnica e não usar linguagem de exclusividade quando o perfil for médio padrão.',
  }
}

function buildHeroNextSinglePiecePrompt(humanPrompt: string, briefing: JsonRecord) {
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const property = briefing.property && typeof briefing.property === 'object'
    ? briefing.property as JsonRecord
    : {}
  const destination = choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination as JsonRecord
    : {}
  const destinationLabel = normalizeText(destination.label, 120) || 'o destino escolhido'
  const profile = normalizeText(choices.property_profile || property.master_profile, 120)
  const objective = normalizeText(choices.campaign_objective || property.purpose, 80)
  const stage = normalizeText(choices.property_stage || property.master_property_state, 120)
  const highlights = normalizeTextArray(choices.highlights || property.master_highlights, 8, 120)
  const strategy = buildHeroVisualStrategy({
    objective,
    profile,
    stage,
    city: property.city,
    district: property.neighborhood,
    bedrooms: property.bedrooms,
    suites: property.suites,
    parking: property.parking_spaces,
    highlights,
    cta: choices.cta,
    destination: destinationLabel,
  })

  return [
    humanPrompt,
    '',
    `Formato principal da peça: ${destinationLabel}.`,
    '',
    'STYLE DIRECTOR DA CAMPANHA:',
    `Família da campanha: ${strategy.family}.`,
    `Promessa principal: ${strategy.promise}`,
    `Direção visual: ${strategy.visualDirection}`,
    `Paleta sugerida: ${strategy.palette}`,
    `Hierarquia da peça: ${strategy.hierarchy}`,
    `Tom comercial: ${strategy.tone}`,
    `Evitar: ${strategy.avoid}`,
    'A estética da peça deve seguir o perfil comercial do imóvel. Não aplicar visual de luxo em imóvel Minha Casa Minha Vida, médio padrão ou locação.',
    '',
    `Crie UMA única peça publicitária final para ${destinationLabel}.`,
    'A saída deve ser uma única arte final pronta para publicação.',
    'Não crie múltiplas versões dentro da mesma imagem.',
    'Não crie mosaico, grade de formatos, mockup de apresentação, prancha de layout ou prévia de campanha.',
    'Não mostre feed, story e horizontal juntos.',
    'Não repita a mesma arte em formatos diferentes dentro da imagem.',
    'Não crie vários cards, telas ou variações dentro do mesmo canvas.',
    'Se houver imagem anexada, use como referência ou elemento principal da campanha, sem repetir a mesma imagem várias vezes sem necessidade.',
    'Escolha uma composição principal elegante e resolvida.',
  ].join('\n')
}

function buildImageUsageInstruction(imageMode: string, photoCount: number) {
  if (imageMode === 'main_photo') {
    return [
      'Orientacao de uso das imagens: usar a foto principal como referencia visual dominante.',
      'Aprimore a foto com acabamento publicitario premium, sem trocar o imovel e sem transformar a propriedade em outro lugar.',
      'Pode aplicar luz, contraste, profundidade, atmosfera editorial e composicao de campanha, preservando arquitetura, fachada, ambientes e proporcoes reais.',
    ]
  }

  if (imageMode === 'reference_photos') {
    return [
      `Orientacao de uso das imagens: usar o conjunto de ${photoCount || 'todas as'} fotos cadastradas como referencias reais do mesmo imovel.`,
      'Monte uma campanha publicitaria com as fotos reais como base visual, sem criar nova fachada, novo apartamento, nova planta ou outro empreendimento.',
      'A composicao pode valorizar, organizar e combinar referencias, mas deve continuar parecendo o mesmo imovel do Cadastro Mestre.',
    ]
  }

  return [
    'Orientacao de uso das imagens: explorar conceitos da regiao e do imovel dentro de uma direcao criativa publicitaria.',
    'Use o Cadastro Mestre e as fotos disponiveis como limite de realidade: nao invente empreendimento, fachada, planta, lazer, vista ou dados.',
    'A campanha pode ser mais conceitual, mas deve continuar vinculada ao imovel real informado.',
  ]
}

function buildFinalPrompt(briefing: JsonRecord) {
  const property = briefing.property && typeof briefing.property === 'object'
    ? briefing.property as JsonRecord
    : {}
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const audiences = Array.isArray(choices.audiences)
    ? choices.audiences
      .map((item) => item && typeof item === 'object' ? normalizeText((item as JsonRecord).label, 80) : '')
      .filter(Boolean)
    : []
  const destination = choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination as JsonRecord
    : {}
  const valueCondition = choices.value_condition && typeof choices.value_condition === 'object'
    ? choices.value_condition as JsonRecord
    : {}
  const humanPrompt = normalizeLongText(choices.human_prompt, 5000)

  const imageMode = normalizeId(choices.image_mode, IMAGE_MODES)
  const highlights = normalizeTextArray(choices.highlights, 8, 120)
  const subcategories = normalizeTextArray(choices.subcategories, 8, 120)
  const creativeConcepts = normalizeTextArray(choices.creative_concepts, 12, 120)
  const photoUrls = normalizePhotoUrls(property.photo_urls, 8)
  const location = buildLocation(property)
  const details = [
    normalizeText(property.type, 80),
    location,
    property.area ? `${property.area} m2` : '',
    property.bedrooms ? `${property.bedrooms} dormitorios` : '',
    property.suites ? `${property.suites} suites` : '',
    property.parking_spaces ? `${property.parking_spaces} vagas` : '',
  ].filter(Boolean).join(' | ')

  const headline = creativeConcepts.includes('Investimento')
    ? 'Oportunidade para investir'
    : creativeConcepts.includes('Exclusividade')
      ? 'Um imovel exclusivo'
      : creativeConcepts.includes('Família')
        ? 'O lugar da sua familia'
        : creativeConcepts.includes('Lifestyle')
          ? 'Viva melhor todos os dias'
          : 'Seu novo imovel espera por voce'
  const cta = normalizeText(choices.cta, 120) || 'Fale com o corretor'

  if (humanPrompt) {
    return [
      humanPrompt,
      '',
      `Destino/formato: ${normalizeText(destination.label, 120) || 'Feed Instagram'}.`,
      `Destino principal: ${normalizeText(destination.label, 120) || 'Feed Instagram'}.`,
      `CTA principal: ${cta}.`,
      'Criar uma peca publicitaria imobiliaria premium.',
      'Usar somente informacoes fornecidas no prompt e nas imagens de referencia.',
      'Nao inventar imovel, fachada, planta, lazer, localizacao, condicoes ou dados.',
    ].join('\n')
  }

  return [
    'Crie UMA peca imobiliaria publicitaria premium, pronta para campanha digital brasileira.',
    'Use um unico motor publicitario: a escolha do usuario orienta apenas como as fotos devem ser usadas, nao muda a natureza da entrega.',
    'A peca deve ter impacto de campanha, composicao sofisticada, imagem forte, headline clara e CTA destacado.',
    'Use tipografia grande, limpa, curta e legivel somente para headline e CTA. Nao use texto pequeno, torto, truncado, inventado, pseudo-texto, nomes ficticios, telefone, email, QR code ou rodape com letras ilegíveis.',
    'Nao volte ao estilo antigo de foto com legenda simples. Deve parecer uma campanha premium finalizada.',
    'Nao invente metro, escolas, shopping, vista, lazer, financiamento, seguranca ou outros diferenciais que nao estejam no briefing.',
    'Nao invente outro imovel, outra fachada, outra planta, outro apartamento, outro empreendimento ou dados que nao vieram do Cadastro Mestre.',
    ...buildImageUsageInstruction(imageMode, photoUrls.length),
    `Imovel: ${details || 'imovel residencial a venda'}.`,
    `Perfil do imovel: ${normalizeText(property.master_profile, 120) || 'nao informado'}.`,
    `Estado do imovel: ${normalizeText(choices.property_state, 120) || normalizeText(property.master_property_state, 120) || 'nao informado'}.`,
    `Publico-alvo: ${audiences.join(', ') || 'compradores de imoveis'}.`,
    `Conceitos selecionados: ${creativeConcepts.join(', ') || 'sem conceito adicional'}.`,
    `Focos/objetivos: ${subcategories.join(', ') || normalizeText(choices.subcategory, 120) || 'divulgacao imobiliaria'}.`,
    `Destaques informados: ${highlights.join(', ') || 'sem destaques adicionais'}.`,
    `Headline sugerida para a peca: ${headline}.`,
    `CTA principal da campanha: ${cta}.`,
    'O CTA deve ser um elemento visual principal da campanha, com hierarquia clara e area de respiro.',
    `Valores e condicoes: ${normalizeText(valueCondition.label, 120) || 'nao destacar valores'} ${normalizeText(valueCondition.details, 280)}`.trim(),
    `Destino principal: ${normalizeText(destination.label, 120) || 'Feed Instagram'}.`,
    `Orientacao adicional do usuario: ${normalizeText(choices.additional_info, 400) || 'nenhuma'}.`,
    'Priorize composicao WOW: imagem imobiliaria real valorizada, bloco visual forte, headline curta, CTA evidente, dados reais e acabamento premium.',
  ].join('\n')
}

function buildTextBriefing(briefing: JsonRecord) {
  const property = briefing.property && typeof briefing.property === 'object'
    ? briefing.property as JsonRecord
    : {}
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const audiences = Array.isArray(choices.audiences)
    ? choices.audiences
      .map((item) => item && typeof item === 'object' ? normalizeText((item as JsonRecord).label, 80) : '')
      .filter(Boolean)
    : []
  const destination = choices.primary_destination && typeof choices.primary_destination === 'object'
    ? choices.primary_destination as JsonRecord
    : {}
  const valueCondition = choices.value_condition && typeof choices.value_condition === 'object'
    ? choices.value_condition as JsonRecord
    : {}
  const highlights = normalizeTextArray(choices.highlights, 8, 120)
  const subcategories = normalizeTextArray(choices.subcategories, 8, 120)
  const creativeConcepts = normalizeTextArray(choices.creative_concepts, 12, 120)

  return {
    tipo: normalizeText(property.type, 80),
    localizacao: buildLocation(property),
    area: property.area ?? null,
    dormitorios: property.bedrooms ?? null,
    suites: property.suites ?? null,
    vagas: property.parking_spaces ?? null,
    perfil: normalizeText(property.master_profile, 120),
    estado_imovel: normalizeText(choices.property_state, 120),
    prompt_humano: normalizeLongText(choices.human_prompt, 5000),
    publico: audiences,
    subcategoria: normalizeText(choices.subcategory, 120),
    focos: subcategories,
    conceitos_criativos: creativeConcepts,
    destaques: highlights,
    cta_escolhido: normalizeText(choices.cta, 120),
    valores_condicoes: {
      regra: normalizeText(valueCondition.label, 120),
      detalhes: normalizeText(valueCondition.details, 280),
    },
    destino_principal: normalizeText(destination.label, 120),
    observacao_adicional: normalizeText(choices.additional_info, 400),
  }
}

function normalizeGeneratedTexts(value: JsonRecord, deliverables: Record<string, boolean>, briefing: JsonRecord) {
  const textBriefing = buildTextBriefing(briefing)
  const cta = normalizeText(value.cta, 120) || normalizeText(textBriefing.cta_escolhido, 120) || 'Agende sua visita'
  const hashtagsRaw = Array.isArray(value.hashtags)
    ? value.hashtags.join(' ')
    : normalizeText(value.hashtags, 500)
  const hashtags = hashtagsRaw
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => /^#[A-Za-z0-9_]+$/.test(item))
    .slice(0, 15)
    .join(' ')

  const texts: Record<string, string> = {
    instagram: normalizeText(value.instagram, 1600),
    whatsapp: normalizeText(value.whatsapp, 900),
    cta,
    portal: normalizeText(value.portal, 1400),
    hashtags,
  }

  if (!texts.instagram) {
    texts.instagram = `${textBriefing.tipo || 'Imovel'} em ${textBriefing.localizacao || 'localizacao especial'} com uma apresentacao visual pensada para destacar o que realmente importa. ${cta}.`
  }
  if (!texts.whatsapp) {
    texts.whatsapp = `Ola, tudo bem? Tenho uma oportunidade que pode fazer sentido para voce: ${textBriefing.tipo || 'imovel'} em ${textBriefing.localizacao || 'uma excelente localizacao'}. Posso te enviar mais detalhes?`
  }
  if (!texts.portal) {
    texts.portal = `${textBriefing.tipo || 'Imovel'} em ${textBriefing.localizacao || 'localizacao privilegiada'}, com diferenciais selecionados para uma divulgacao clara e profissional.`
  }
  if (!texts.hashtags) {
    texts.hashtags = '#Imoveis #MercadoImobiliario #ImovelAVenda #CorretorDeImoveis #MorarBem'
  }

  return texts
}

function buildFallbackHeroTexts(briefing: JsonRecord) {
  const textBriefing = buildTextBriefing(briefing)
  const cta = normalizeText(textBriefing.cta_escolhido, 120) || 'Fale com o corretor'
  const tipo = normalizeText(textBriefing.tipo, 80) || 'Imovel'
  const localizacao = normalizeText(textBriefing.localizacao, 160)

  return {
    instagram: `${tipo}${localizacao ? ` em ${localizacao}` : ''} com campanha visual criada para destacar os diferenciais informados. ${cta}.`,
    whatsapp: `Ola, tudo bem? Tenho uma oportunidade que pode fazer sentido para voce: ${tipo}${localizacao ? ` em ${localizacao}` : ''}. Posso te enviar mais detalhes?`,
    cta,
    portal: `${tipo}${localizacao ? ` em ${localizacao}` : ''}, divulgado com foco nos diferenciais reais informados na campanha.`,
    hashtags: '#Imoveis #MercadoImobiliario #CorretorDeImoveis #ImovelAVenda #MorarBem',
  }
}

async function generateHeroTexts(briefing: JsonRecord, deliverables: Record<string, boolean>) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  const textBriefing = buildTextBriefing(briefing)
  const humanPrompt = typeof textBriefing.prompt_humano === 'string' ? textBriefing.prompt_humano : ''
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('HERO_TEXT_MODEL') || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            'Voce e um redator de marketing imobiliario premium do SmartCorretorAI.',
            'Escreva em portugues do Brasil, com linguagem comercial, clara e correta.',
            'Nao invente informacoes nao fornecidas. Nao invente CRECI, telefone, email, metro, escola, shopping, vista, lazer, financiamento ou condominio.',
            'Hashtags devem ser sem acentos, sem termos estranhos e coerentes com o briefing.',
            'Sempre gere Instagram, WhatsApp, CTA, portal e hashtags, mesmo que o pacote visual tenha sido ajustado.',
            'O CTA escolhido deve ser o eixo principal da campanha e aparecer de forma forte nos textos.',
            'Retorne somente JSON valido com as chaves: instagram, whatsapp, cta, portal, hashtags.',
          ].join(' '),
        },
        {
          role: 'user',
          content: humanPrompt
            ? [
              'Use o Prompt Humano abaixo como briefing principal para escrever os textos.',
              '',
              humanPrompt,
              '',
              'Retorne JSON valido com: instagram, whatsapp, cta, portal, hashtags.',
              'Nao invente informacoes nao fornecidas.',
              `Apoio tecnico: ${JSON.stringify({
                destino_principal: textBriefing.destino_principal,
                cta_escolhido: textBriefing.cta_escolhido,
                valores_condicoes: textBriefing.valores_condicoes,
              })}`,
            ].join('\n')
            : JSON.stringify({
              briefing: textBriefing,
              itens_solicitados: {
                instagram: true,
                whatsapp: true,
                cta: true,
                portal: true,
                hashtags: true,
              },
              regras: {
                instagram: 'Legenda pronta para Instagram com 1 a 2 paragrafos curtos.',
                whatsapp: 'Mensagem do corretor para enviar ao lead, nunca como se fosse o cliente falando.',
                cta: 'Chamada curta, direta e comercial. O CTA deve ser o elemento principal da campanha.',
                portal: 'Descricao objetiva para portal imobiliario, sem exagero e sem inventar diferenciais.',
                hashtags: 'String com 12 a 15 hashtags sem acentos, separadas por espaco.',
              },
            }),
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1400,
      stream: false,
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] text generation failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel gerar os textos agora.')
  }

  const data = await response.json()
  const rawContent = data?.choices?.[0]?.message?.content
  if (!rawContent) {
    throw new Error('A geracao de textos retornou vazia.')
  }

  try {
    return normalizeGeneratedTexts(JSON.parse(rawContent) as JsonRecord, deliverables, briefing)
  } catch {
    throw new Error('A geracao de textos retornou em formato invalido.')
  }
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function updateGenerationFailure(
  supabase: ReturnType<typeof createClient>,
  generationId: string,
  message: string,
) {
  await supabase
    .from('hero_generations')
    .update({
      status: 'failed',
      error_message: message,
    })
    .eq('id', generationId)
}

async function fetchReferenceImage(url: string, index: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) })
  if (!response.ok) {
    throw new Error('Nao foi possivel carregar uma das fotos de referencia.')
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Uma das referencias nao e uma imagem valida.')
  }

  const extension = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg'

  const blob = new Blob([await response.arrayBuffer()], { type: contentType })
  return new File([blob], `referencia-${index + 1}.${extension}`, { type: contentType })
}

async function generateHeroImageFromPrompt(prompt: string, size: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('HERO_IMAGE_MODEL') || 'gpt-image-1'

  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: 'medium',
      output_format: 'jpeg',
      n: 1,
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] image generation failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel gerar a imagem agora.')
  }

  const data = await response.json()
  const item = data?.data?.[0]
  if (item?.b64_json) {
    return {
      bytes: base64ToUint8Array(item.b64_json),
      contentType: 'image/jpeg',
      model,
    }
  }

  if (item?.url) {
    const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(45000) })
    if (!imageResponse.ok) {
      throw new Error('Nao foi possivel baixar a imagem gerada.')
    }
    return {
      bytes: new Uint8Array(await imageResponse.arrayBuffer()),
      contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
      model,
    }
  }

  throw new Error('A geracao nao retornou imagem.')
}

async function generateHeroImageFromFiles(prompt: string, size: string, files: File[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('HERO_IMAGE_MODEL') || 'gpt-image-1'

  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  if (files.length === 0) {
    throw new Error('Fotos de referencia nao encontradas para este modo.')
  }

  const formData = new FormData()
  formData.append('model', model)
  formData.append('prompt', prompt)
  formData.append('size', size)
  formData.append('quality', 'medium')
  formData.append('output_format', 'jpeg')

  for (const file of files) {
    formData.append(files.length === 1 ? 'image' : 'image[]', file)
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] image edit failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel gerar a imagem a partir das fotos do imovel.')
  }

  const data = await response.json()
  const item = data?.data?.[0]
  if (item?.b64_json) {
    return {
      bytes: base64ToUint8Array(item.b64_json),
      contentType: 'image/jpeg',
      model,
    }
  }

  if (item?.url) {
    const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(45000) })
    if (!imageResponse.ok) {
      throw new Error('Nao foi possivel baixar a imagem gerada.')
    }
    return {
      bytes: new Uint8Array(await imageResponse.arrayBuffer()),
      contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
      model,
    }
  }

  throw new Error('A geracao nao retornou imagem.')
}

async function generateHeroImageFromReferences(prompt: string, size: string, photoUrls: string[]) {
  const files = await Promise.all(photoUrls.map((url, index) => fetchReferenceImage(url, index)))
  return generateHeroImageFromFiles(prompt, size, files)
}

async function generateHeroImageFromInlineImages(prompt: string, size: string, inlineImages: InlineImageInput[]) {
  const files = inlineImages.map((image, index) => inlineImageToFile(image, index))
  return generateHeroImageFromFiles(prompt, size, files)
}

async function generateHeroImageFromMultimodalContext(prompt: string, size: string, inlineImages: InlineImageInput[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('HERO_MULTIMODAL_MODEL') || Deno.env.get('HERO_IMAGE_CONTEXT_MODEL') || 'gpt-5'
  const endpoint = 'responses:image_generation'
  const experimentalImages = inlineImages.slice(0, 1)
  const startedAt = Date.now()

  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  if (experimentalImages.length === 0) {
    throw new Error('Imagens de contexto nao encontradas para o experimento multimodal.')
  }

  const content = [
    {
      type: 'input_text',
      text: prompt,
    },
    ...experimentalImages.map((image) => ({
      type: 'input_image',
      image_url: image.data,
    })),
  ]

  console.log('[gerar-hero-ia] hero_next_experimental request', {
    endpoint,
    model,
    image_count: experimentalImages.length,
    size,
    final_prompt: prompt,
    payload: {
      model,
      input_content: ['input_text', ...experimentalImages.map(() => 'input_image')],
      image_count: experimentalImages.length,
      tool: {
        type: 'image_generation',
        quality: 'medium',
        size,
        output_format: 'jpeg',
        action: 'generate',
      },
    },
  })

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content,
          },
        ],
        tools: [
          {
            type: 'image_generation',
            quality: 'medium',
            size,
            output_format: 'jpeg',
            action: 'generate',
          },
        ],
      }),
      signal: AbortSignal.timeout(55000),
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    console.warn('[gerar-hero-ia] hero_next_experimental request failed', {
      endpoint,
      model,
      image_count: experimentalImages.length,
      size,
      duration_ms: durationMs,
      status: 'request_error',
      error: error instanceof Error ? error.name : 'unknown',
    })

    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('A geracao experimental demorou demais. Tente novamente com uma imagem menor ou sem imagem.')
    }

    throw error
  }

  const durationMs = Date.now() - startedAt
  console.log('[gerar-hero-ia] hero_next_experimental response', {
    endpoint,
    model,
    image_count: experimentalImages.length,
    size,
    duration_ms: durationMs,
    status: response.status,
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] multimodal image generation failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel gerar a imagem com o experimento multimodal.')
  }

  const data = await response.json()
  const imageOutput = Array.isArray(data?.output)
    ? data.output.find((item: JsonRecord) => item?.type === 'image_generation_call' && typeof item?.result === 'string') as JsonRecord | undefined
    : undefined
  const imageBase64 = typeof imageOutput?.result === 'string' ? imageOutput.result : ''

  if (!imageBase64) {
    throw new Error('A geracao multimodal nao retornou imagem.')
  }

  return {
    bytes: base64ToUint8Array(imageBase64),
    contentType: 'image/jpeg',
    model,
  }
}

function buildHeroNextMultimodalContent(prompt: string, inlineImages: InlineImageInput[]) {
  const experimentalImages = inlineImages.slice(0, 1)
  return [
    {
      type: 'input_text',
      text: prompt,
    },
    ...experimentalImages.map((image) => ({
      type: 'input_image',
      image_url: image.data,
    })),
  ]
}

async function createHeroNextBackgroundResponse(prompt: string, size: string, inlineImages: InlineImageInput[], destinationLabel = '') {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('HERO_MULTIMODAL_MODEL') || Deno.env.get('HERO_IMAGE_CONTEXT_MODEL') || 'gpt-5'
  const endpoint = 'responses:image_generation:background'
  const experimentalImages = inlineImages.slice(0, 1)
  const startedAt = Date.now()

  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  const content = buildHeroNextMultimodalContent(prompt, experimentalImages)

  console.log('[gerar-hero-ia] hero_next_background request', {
    endpoint,
    model,
    image_count: experimentalImages.length,
    size,
    destination: destinationLabel,
    final_prompt: prompt,
    payload: {
      model,
      background: true,
      input_content: ['input_text', ...experimentalImages.map(() => 'input_image')],
      image_count: experimentalImages.length,
      tool: {
        type: 'image_generation',
        quality: 'medium',
        size,
        output_format: 'jpeg',
        action: 'generate',
      },
    },
  })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      background: true,
      input: [
        {
          role: 'user',
          content,
        },
      ],
      tools: [
        {
          type: 'image_generation',
          quality: 'medium',
          size,
          output_format: 'jpeg',
          action: 'generate',
        },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })

  const durationMs = Date.now() - startedAt
  console.log('[gerar-hero-ia] hero_next_background response', {
    endpoint,
    model,
    image_count: experimentalImages.length,
    size,
    duration_ms: durationMs,
    status: response.status,
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] background response create failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel iniciar a campanha em background.')
  }

  const data = await response.json()
  const responseId = normalizeText(data?.id, 160)
  const responseStatus = normalizeText(data?.status, 80)

  if (!responseId) {
    throw new Error('A criacao em background nao retornou identificador.')
  }

  return {
    responseId,
    status: responseStatus || 'queued',
    model,
    endpoint,
  }
}

async function getOpenAIResponseStatus(responseId: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  const startedAt = Date.now()
  const response = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(20000),
  })
  const durationMs = Date.now() - startedAt

  console.log('[gerar-hero-ia] hero_next_background poll', {
    endpoint: 'responses:get',
    response_id: responseId,
    duration_ms: durationMs,
    status: response.status,
  })

  if (!response.ok) {
    const body = await response.text()
    console.warn('[gerar-hero-ia] background response poll failed:', response.status, body.slice(0, 240))
    throw new Error('Nao foi possivel consultar o status da campanha.')
  }

  return await response.json()
}

function extractImageGenerationBase64(responseData: JsonRecord) {
  const output = Array.isArray(responseData.output) ? responseData.output : []
  const imageOutput = output.find((item) => (
    item
    && typeof item === 'object'
    && (item as JsonRecord).type === 'image_generation_call'
    && typeof (item as JsonRecord).result === 'string'
  )) as JsonRecord | undefined

  return typeof imageOutput?.result === 'string' ? imageOutput.result : ''
}

async function generateHeroImage(prompt: string, size: string, briefing: JsonRecord) {
  const property = briefing.property && typeof briefing.property === 'object'
    ? briefing.property as JsonRecord
    : {}
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const imageMode = normalizeId(choices.image_mode, IMAGE_MODES)
  const inlineImages = normalizeInlineImages(choices.inline_images, 8)
  const useHeroNextExperimental = choices.hero_next_experimental === true
  const photoUrls = normalizePhotoUrls(property.photo_urls, 8)
  const referenceUrls = imageMode === 'main_photo' ? photoUrls.slice(0, 1) : photoUrls

  if (useHeroNextExperimental && inlineImages.length > 0) {
    return generateHeroImageFromMultimodalContext(prompt, getExperimentalImageSize(briefing), inlineImages)
  }

  if (inlineImages.length > 0) {
    return generateHeroImageFromInlineImages(prompt, size, inlineImages)
  }

  if (referenceUrls.length > 0) {
    return generateHeroImageFromReferences(prompt, size, referenceUrls)
  }

  return generateHeroImageFromPrompt(prompt, size)
}

function buildPromptBriefing(property: JsonRecord, masterProperty: JsonRecord, payload: JsonRecord) {
  const propertyPhotos = normalizePhotoUrls(property.fotos, 8)
  const masterPhotos = normalizePhotoUrls(masterProperty.fotos_imovel, 8)
  const photos = propertyPhotos.length > 0 ? propertyPhotos : masterPhotos
  const selectedHighlights = normalizeTextArray(payload.highlights, 12, 120)
  const audienceIds = normalizeTextArray(payload.audience_ids, 8, 80)
    .map((item) => normalizeId(item))
    .filter(Boolean)
  const audiences = normalizeLabeledItems(payload.audiences, 8)
  const subcategories = normalizeTextArray(payload.subcategories, 8, 120)
  const selectedSubcategory = normalizeText(payload.subcategory, 120)
  const creativeConcepts = normalizeTextArray(payload.creative_concepts, 12, 120)
  const primaryDestination = normalizeLabeledItem(payload.primary_destination)
  const compatibleDestinations = normalizeLabeledItems(payload.compatible_destinations, 6)
  const masterHighlights = normalizeTextArray(
    masterProperty.destaques_selecionados ?? masterProperty.destaques,
    20,
    120,
  )

  return {
    schema_version: 'hero_prompt_briefing_v1',
    source: 'hero_ia_smart_prompt_engine',
    property: {
      id: property.id,
      title: normalizeText(property.titulo, 160),
      type: normalizeText(property.tipo, 80),
      purpose: 'venda',
      price: property.preco ?? null,
      area: property.area_m2 ?? null,
      bedrooms: property.quartos ?? null,
      suites: masterProperty.suites ?? null,
      bathrooms: property.banheiros ?? null,
      parking_spaces: property.vagas ?? null,
      neighborhood: normalizeText(property.bairro, 100),
      city: normalizeText(property.cidade, 100),
      state: normalizeText(property.estado, 2),
      photo_count: photos.length,
      photo_urls: photos,
      master_profile: normalizeText(masterProperty.perfil_imovel, 120),
      master_property_state: normalizeText(masterProperty.estado_imovel, 120),
      master_highlights: masterHighlights,
    },
    choices: {
      image_mode: normalizeId(payload.image_mode, IMAGE_MODES),
      image_mode_label: normalizeText(payload.image_mode_label, 120),
      human_prompt: normalizeLongText(payload.human_prompt, 5000),
      hero_next_experimental: payload.hero_next_experimental === true,
      audience_ids: audienceIds,
      audiences,
      subcategories: subcategories.length > 0 ? subcategories : selectedSubcategory ? [selectedSubcategory] : [],
      subcategory: selectedSubcategory,
      creative_concepts: creativeConcepts,
      property_state: normalizeText(payload.property_state || masterProperty.estado_imovel, 120),
      highlights: selectedHighlights,
      cta: normalizeText(payload.cta, 120),
      value_condition: normalizeValueCondition(payload.value_condition),
      primary_destination: primaryDestination,
      compatible_destinations: compatibleDestinations,
      additional_info: normalizeText(payload.additional_info, 400),
    },
  }
}

function buildStandalonePromptBriefing(payload: JsonRecord) {
  const inlineImages = normalizeInlineImages(payload.inline_images, 8)
  const primaryDestination = normalizeLabeledItem(payload.primary_destination)
  const compatibleDestinations = normalizeLabeledItems(payload.compatible_destinations, 6)
  const campaignObjective = normalizeId(payload.campaign_objective) === 'locacao' ? 'locacao' : 'venda'
  const highlights = normalizeTextArray(payload.highlights, 12, 120)

  return {
    schema_version: 'hero_prompt_briefing_v1',
    source: 'hero_ia_next_campaign_prompt',
    property: {
      id: null,
      title: campaignObjective === 'locacao' ? 'Campanha de locacao' : 'Campanha de venda',
      type: normalizeText(payload.property_type, 80),
      purpose: campaignObjective,
      price: null,
      area: null,
      bedrooms: normalizeText(payload.bedrooms, 40),
      suites: normalizeText(payload.suites, 40),
      bathrooms: null,
      parking_spaces: normalizeText(payload.parking, 40),
      neighborhood: normalizeText(payload.district || payload.neighborhood, 120),
      city: normalizeText(payload.city, 120),
      state: '',
      photo_count: inlineImages.length,
      photo_urls: [],
      master_profile: normalizeText(payload.property_profile, 120),
      master_property_state: normalizeText(payload.property_stage, 120),
      master_highlights: highlights,
    },
    choices: {
      image_mode: inlineImages.length > 0 ? 'reference_photos' : normalizeId(payload.image_mode, IMAGE_MODES) || 'new_image',
      image_mode_label: normalizeText(payload.image_mode_label, 120),
      human_prompt: normalizeLongText(payload.human_prompt, 5000),
      inline_images: inlineImages,
      hero_next_experimental: payload.hero_next_experimental === true,
      audience_ids: [],
      audiences: [],
      subcategories: [],
      subcategory: '',
      creative_concepts: [],
      property_profile: normalizeText(payload.property_profile, 120),
      property_stage: normalizeText(payload.property_stage, 120),
      property_state: normalizeText(payload.property_stage, 120),
      highlights,
      cta: normalizeText(payload.cta, 120),
      value_condition: normalizeValueCondition(payload.value_condition),
      primary_destination: primaryDestination,
      compatible_destinations: compatibleDestinations,
      additional_info: normalizeText(payload.additional_info, 400),
      campaign_objective: campaignObjective,
    },
  }
}

async function resolveRetentionDays(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[gerar-hero-ia] subscription lookup failed:', error.message)
    return 1
  }

  return data ? 15 : 1
}

async function handleHeroNextStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: JsonRecord,
) {
  const generationId = normalizeText(payload.generation_id ?? payload.hero_generation_id, 160)
  if (!isUuid(generationId)) {
    return jsonResponse({ error: 'generation_id invalido' }, 400)
  }

  const { data: generation, error: lookupError } = await supabase
    .from('hero_generations')
    .select('id, user_id, status, prompt_briefing, deliverables, texts, image_storage_path, openai_response_id, provider_model, expires_at, created_at')
    .eq('id', generationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (lookupError) {
    console.warn('[gerar-hero-ia] hero next status lookup failed:', lookupError.message)
    return jsonResponse({ error: 'Falha ao consultar campanha.' }, 500)
  }

  if (!generation) {
    return jsonResponse({ error: 'Campanha nao encontrada.' }, 404)
  }

  if (generation.status === 'completed' && generation.image_storage_path) {
    const { data: signedImage, error: signedError } = await supabase.storage
      .from(HERO_IMAGE_BUCKET)
      .createSignedUrl(generation.image_storage_path, 60 * 60)

    if (signedError || !signedImage?.signedUrl) {
      console.warn('[gerar-hero-ia] completed hero next signed url failed:', signedError?.message)
      return jsonResponse({ error: 'A visualizacao segura falhou.' }, 500)
    }

    return jsonResponse({
      success: true,
      status: 'completed',
      generation_id: generation.id,
      hero_generation_id: generation.id,
      image_url: signedImage.signedUrl,
      texts: generation.texts || {},
      expires_at: generation.expires_at,
    })
  }

  if (generation.status === 'failed' || generation.status === 'cancelled') {
    return jsonResponse({
      success: false,
      status: generation.status,
      generation_id: generation.id,
      message: 'Nao foi possivel concluir a campanha. Tente novamente.',
    })
  }

  const responseId = normalizeText(generation.openai_response_id, 160)
  if (!responseId) {
    return jsonResponse({
      success: true,
      status: 'processing',
      generation_id: generation.id,
      hero_generation_id: generation.id,
      message: 'Campanha em criacao',
    })
  }

  let responseData: JsonRecord
  try {
    responseData = await getOpenAIResponseStatus(responseId) as JsonRecord
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar campanha.'
    return jsonResponse({ error: message }, 502)
  }

  const remoteStatus = normalizeText(responseData.status, 80)
  console.log('[gerar-hero-ia] hero_next_background status', {
    generation_id: generation.id,
    response_id: responseId,
    status: remoteStatus,
    model: generation.provider_model,
  })

  if (['queued', 'in_progress', 'pending'].includes(remoteStatus)) {
    return jsonResponse({
      success: true,
      status: 'processing',
      generation_id: generation.id,
      hero_generation_id: generation.id,
      openai_response_id: responseId,
      message: 'Campanha em criacao',
    })
  }

  if (['failed', 'cancelled', 'canceled', 'expired', 'error'].includes(remoteStatus)) {
    const errorMessage = normalizeText((responseData.error as JsonRecord | undefined)?.message, 300) || 'A geracao nao foi concluida.'
    await supabase
      .from('hero_generations')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', generation.id)
      .eq('user_id', userId)

    return jsonResponse({
      success: false,
      status: 'failed',
      generation_id: generation.id,
      message: 'Nao foi possivel concluir a campanha. Tente novamente.',
    })
  }

  if (remoteStatus !== 'completed') {
    return jsonResponse({
      success: true,
      status: 'processing',
      generation_id: generation.id,
      hero_generation_id: generation.id,
      openai_response_id: responseId,
      message: 'Campanha em criacao',
    })
  }

  const imageBase64 = extractImageGenerationBase64(responseData)
  if (!imageBase64) {
    await supabase
      .from('hero_generations')
      .update({
        status: 'failed',
        error_message: 'A geracao terminou sem imagem.',
      })
      .eq('id', generation.id)
      .eq('user_id', userId)

    return jsonResponse({
      success: false,
      status: 'failed',
      generation_id: generation.id,
      message: 'A campanha terminou sem imagem. Tente novamente.',
    })
  }

  const storagePath = `${userId}/hero-ia-next/${generation.id}/hero-principal.jpg`
  const imageBytes = base64ToUint8Array(imageBase64)
  const imageBlob = new Blob([imageBytes], { type: 'image/jpeg' })
  const { error: uploadError } = await supabase.storage
    .from(HERO_IMAGE_BUCKET)
    .upload(storagePath, imageBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) {
    console.warn('[gerar-hero-ia] hero next background upload failed:', uploadError.message)
    return jsonResponse({ error: 'Falha ao salvar imagem gerada.' }, 500)
  }

  const promptBriefing = generation.prompt_briefing && typeof generation.prompt_briefing === 'object'
    ? generation.prompt_briefing as JsonRecord
    : {}
  const texts = buildFallbackHeroTexts(promptBriefing)

  const { error: updateError } = await supabase
    .from('hero_generations')
    .update({
      status: 'completed',
      image_storage_path: storagePath,
      texts: {
        ...texts,
        hero_image: {
          status: 'completed',
          prompt_version: HERO_PROMPT_VERSION,
          size: normalizeText((promptBriefing.choices as JsonRecord | undefined)?.primary_destination, 120),
          content_type: 'image/jpeg',
          storage_path: storagePath,
          response_id: responseId,
          generated_at: new Date().toISOString(),
        },
      },
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', generation.id)
    .eq('user_id', userId)

  if (updateError) {
    console.warn('[gerar-hero-ia] hero next background update failed:', updateError.message)
    return jsonResponse({ error: 'Falha ao finalizar campanha.' }, 500)
  }

  const { data: signedImage, error: signedError } = await supabase.storage
    .from(HERO_IMAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (signedError || !signedImage?.signedUrl) {
    console.warn('[gerar-hero-ia] hero next background signed url failed:', signedError?.message)
    return jsonResponse({ error: 'Campanha gerada, mas a visualizacao segura falhou.' }, 500)
  }

  return jsonResponse({
    success: true,
    status: 'completed',
    generation_id: generation.id,
    hero_generation_id: generation.id,
    image_url: signedImage.signedUrl,
    texts,
    expires_at: generation.expires_at,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Configuracao indisponivel.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ error: 'Nao autorizado' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.warn(`[${reqId}] invalid jwt:`, authError?.message)
      return jsonResponse({ error: 'Nao autorizado' }, 401)
    }

    const payload = await req.json().catch(() => ({})) as JsonRecord
    if (normalizeId(payload.action) === 'status') {
      return await handleHeroNextStatus(supabase, user.id, payload)
    }

    const propertyId = typeof payload.property_id === 'string' ? payload.property_id : ''
    const humanPrompt = normalizeLongText(payload.human_prompt, 5000)
    const hasPropertyId = isUuid(propertyId)

    if (!hasPropertyId && humanPrompt) {
      const promptBriefing = buildStandalonePromptBriefing(payload)
      const deliverables = normalizeDeliverables(payload.deliverables)
      const retentionDays = await resolveRetentionDays(supabase, user.id)
      const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
      const useHeroNextExperimental = payload.hero_next_experimental === true
      const finalPrompt = useHeroNextExperimental ? buildHeroNextSinglePiecePrompt(humanPrompt, promptBriefing as JsonRecord) : buildFinalPrompt(promptBriefing as JsonRecord)
      const imageSize = useHeroNextExperimental
        ? getExperimentalImageSize(promptBriefing as JsonRecord)
        : getImageSize(promptBriefing as JsonRecord)
      const storedPromptBriefing = sanitizePromptBriefingForStorage({
        ...(promptBriefing as JsonRecord),
        output: {
          image_size: imageSize,
        },
      })

      if (useHeroNextExperimental) {
        const inlineImages = normalizeInlineImages((promptBriefing as JsonRecord).choices && typeof (promptBriefing as JsonRecord).choices === 'object'
          ? ((promptBriefing as JsonRecord).choices as JsonRecord).inline_images
          : [], 8)
        const primaryDestination = (storedPromptBriefing.choices as JsonRecord | undefined)?.primary_destination as JsonRecord | undefined
        const destinationLabel = normalizeText(primaryDestination?.label, 120)

        const { data: generation, error: insertError } = await supabase
          .from('hero_generations')
          .insert({
            user_id: user.id,
            property_id: null,
            status: 'processing',
            prompt_briefing: storedPromptBriefing,
            deliverables,
            texts: {},
            credit_amount: 0,
            credit_status: 'not_required',
            provider: 'openai',
            provider_model: 'pending',
            destination: primaryDestination || {},
            started_at: new Date().toISOString(),
            expires_at: expiresAt,
          })
          .select('id, status, expires_at')
          .single()

        if (insertError || !generation) {
          console.warn(`[${reqId}] hero next generation insert failed:`, insertError?.message)
          return jsonResponse({ error: 'Falha ao preparar campanha.' }, 500)
        }

        try {
          const background = await createHeroNextBackgroundResponse(finalPrompt, imageSize, inlineImages, destinationLabel)
          const { error: updateError } = await supabase
            .from('hero_generations')
            .update({
              openai_response_id: background.responseId,
              provider_model: background.model,
              prompt_briefing: {
                ...storedPromptBriefing,
                openai: {
                  response_id: background.responseId,
                  status: background.status,
                  endpoint: background.endpoint,
                  model: background.model,
                },
              },
            })
            .eq('id', generation.id)
            .eq('user_id', user.id)

          if (updateError) {
            console.warn(`[${reqId}] hero next response id update failed:`, updateError.message)
            return jsonResponse({ error: 'Falha ao registrar campanha em criacao.' }, 500)
          }

          return jsonResponse({
            success: true,
            status: 'processing',
            generation_id: generation.id,
            hero_generation_id: generation.id,
            openai_response_id: background.responseId,
            message: 'Campanha em criacao',
            expires_at: generation.expires_at,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha ao iniciar campanha em background.'
          await supabase
            .from('hero_generations')
            .update({
              status: 'failed',
              error_message: message,
            })
            .eq('id', generation.id)
            .eq('user_id', user.id)
          return jsonResponse({ error: message }, 502)
        }
      }

      const generationId = crypto.randomUUID()
      const storagePath = `${user.id}/hero-ia-next/${generationId}/hero-principal.jpg`

      let generatedTexts: Awaited<ReturnType<typeof generateHeroTexts>>
      try {
        generatedTexts = await generateHeroTexts(promptBriefing as JsonRecord, deliverables)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao gerar textos da campanha.'
        return jsonResponse({ error: message }, 502)
      }

      let imageResult: Awaited<ReturnType<typeof generateHeroImage>>
      try {
        imageResult = await generateHeroImage(finalPrompt, imageSize, promptBriefing as JsonRecord)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao gerar campanha.'
        return jsonResponse({ error: message }, 502)
      }

      const imageBlob = new Blob([imageResult.bytes], { type: imageResult.contentType })
      const { error: uploadError } = await supabase.storage
        .from(HERO_IMAGE_BUCKET)
        .upload(storagePath, imageBlob, {
          contentType: imageResult.contentType,
          upsert: true,
        })

      if (uploadError) {
        console.warn(`[${reqId}] hero next image upload failed:`, uploadError.message)
        return jsonResponse({ error: 'Falha ao salvar imagem gerada.' }, 500)
      }

      const { data: signedImage, error: signedError } = await supabase.storage
        .from(HERO_IMAGE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60)

      if (signedError || !signedImage?.signedUrl) {
        console.warn(`[${reqId}] hero next signed url failed:`, signedError?.message)
        return jsonResponse({ error: 'Campanha gerada, mas a visualizacao segura falhou.' }, 500)
      }

      console.log(`[${reqId}] hero next campaign completed`)

      return jsonResponse({
        success: true,
        hero_generation_id: generationId,
        generation_id: generationId,
        status: 'completed',
        message: 'Campanha IA gerada com sucesso.',
        image_url: signedImage.signedUrl,
        texts: generatedTexts,
        expires_at: expiresAt,
      })
    }

    if (!hasPropertyId) {
      return jsonResponse({ error: 'property_id obrigatorio' }, 400)
    }

    const imageMode = normalizeId(payload.image_mode, IMAGE_MODES)
    if (!imageMode) {
      return jsonResponse({ error: 'image_mode invalido' }, 400)
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, user_id, titulo, tipo, preco, area_m2, quartos, banheiros, vagas, bairro, cidade, estado, descricao, fotos')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (propertyError) {
      console.warn(`[${reqId}] property lookup failed:`, propertyError.message)
      return jsonResponse({ error: 'Falha ao validar imovel' }, 500)
    }

    if (!property) {
      return jsonResponse({ error: 'Imovel nao encontrado' }, 404)
    }

    const masterProperty = parseMasterProperty(property.descricao)
    const promptBriefing = buildPromptBriefing(property as JsonRecord, masterProperty, payload)
    const deliverables = normalizeDeliverables(payload.deliverables)
    const retentionDays = await resolveRetentionDays(supabase, user.id)
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: generation, error: insertError } = await supabase
      .from('hero_generations')
      .insert({
        user_id: user.id,
        property_id: property.id,
        status: 'processing',
        prompt_briefing: promptBriefing,
        deliverables,
        texts: {},
        credit_amount: 0,
        credit_status: 'not_required',
        expires_at: expiresAt,
      })
      .select('id, status, expires_at')
      .single()

    if (insertError || !generation) {
      console.warn(`[${reqId}] hero generation insert failed:`, insertError?.message)
      return jsonResponse({ error: 'Falha ao preparar Hero IA' }, 500)
    }

    const finalPrompt = buildFinalPrompt(promptBriefing as JsonRecord)
    const imageSize = getImageSize(promptBriefing as JsonRecord)
    const storagePath = `${user.id}/hero-ia/${generation.id}/hero-principal.jpg`

    let generatedTexts: Awaited<ReturnType<typeof generateHeroTexts>>
    try {
      generatedTexts = await generateHeroTexts(promptBriefing as JsonRecord, deliverables)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar textos do Hero IA.'
      await updateGenerationFailure(supabase, generation.id, message)
      return jsonResponse({ error: message }, 502)
    }

    let imageResult: Awaited<ReturnType<typeof generateHeroImage>>
    try {
      imageResult = await generateHeroImage(finalPrompt, imageSize, promptBriefing as JsonRecord)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar Hero IA.'
      await updateGenerationFailure(supabase, generation.id, message)
      return jsonResponse({ error: message }, 502)
    }

    const imageBlob = new Blob([imageResult.bytes], { type: imageResult.contentType })
    const { error: uploadError } = await supabase.storage
      .from(HERO_IMAGE_BUCKET)
      .upload(storagePath, imageBlob, {
        contentType: imageResult.contentType,
        upsert: true,
      })

    if (uploadError) {
      console.warn(`[${reqId}] hero image upload failed:`, uploadError.message)
      await updateGenerationFailure(supabase, generation.id, 'Falha ao salvar imagem gerada.')
      return jsonResponse({ error: 'Falha ao salvar imagem gerada.' }, 500)
    }

    const texts = {
      ...generatedTexts,
      hero_image: {
        status: 'completed',
        prompt_version: HERO_PROMPT_VERSION,
        size: imageSize,
        content_type: imageResult.contentType,
        storage_path: storagePath,
        generated_at: new Date().toISOString(),
      },
    }

    const { data: updatedGeneration, error: updateError } = await supabase
      .from('hero_generations')
      .update({
        status: 'completed',
        image_storage_path: storagePath,
        texts,
        error_message: null,
      })
      .eq('id', generation.id)
      .select('id, status, image_storage_path, expires_at')
      .single()

    if (updateError || !updatedGeneration) {
      console.warn(`[${reqId}] hero generation update failed:`, updateError?.message)
      return jsonResponse({ error: 'Falha ao finalizar Hero IA.' }, 500)
    }

    const { data: signedImage, error: signedError } = await supabase.storage
      .from(HERO_IMAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60)

    if (signedError || !signedImage?.signedUrl) {
      console.warn(`[${reqId}] hero image signed url failed:`, signedError?.message)
      return jsonResponse({ error: 'Hero IA gerado, mas a visualizacao segura falhou.' }, 500)
    }

    console.log(`[${reqId}] hero generation completed`)

    return jsonResponse({
      success: true,
      hero_generation_id: updatedGeneration.id,
      generation_id: updatedGeneration.id,
      status: updatedGeneration.status,
      message: 'Hero IA gerado com sucesso.',
      image_url: signedImage.signedUrl,
      texts: generatedTexts,
      expires_at: updatedGeneration.expires_at,
    })
  } catch (error) {
    console.error(`[${reqId}] gerar-hero-ia failed:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ error: 'Falha ao preparar Hero IA' }, 500)
  }
})

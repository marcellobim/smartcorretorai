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

  const imageMode = normalizeId(choices.image_mode, IMAGE_MODES)
  const highlights = normalizeTextArray(choices.highlights, 8, 120)
  const subcategories = normalizeTextArray(choices.subcategories, 8, 120)
  const creativeConcepts = normalizeTextArray(choices.creative_concepts, 12, 120)
  const location = buildLocation(property)
  const details = [
    normalizeText(property.type, 80),
    location,
    property.area ? `${property.area} m2` : '',
    property.bedrooms ? `${property.bedrooms} dormitorios` : '',
    property.suites ? `${property.suites} suites` : '',
    property.parking_spaces ? `${property.parking_spaces} vagas` : '',
  ].filter(Boolean).join(' | ')

  const modeInstruction = imageMode === 'main_photo'
    ? [
      'Modo selecionado: melhorar foto principal.',
      'Use a imagem enviada como base obrigatoria. Preserve o imovel original, arquitetura, ambiente, perspectiva, fachada ou interior existente.',
      'Nao crie outro imovel, nao troque fachada, nao altere planta, nao invente apartamento diferente.',
      'Aplique melhoria visual premium: luz, contraste, cor, profundidade, atmosfera editorial, acabamento sofisticado e composicao preparada para motion futuro.',
    ]
    : imageMode === 'reference_photos'
      ? [
        'Modo selecionado: usar todas as fotos reais do imovel.',
        'Use as imagens enviadas como referencias obrigatorias da mesma propriedade.',
        'Monte uma campanha visual imobiliaria com as fotos reais, sem criar nova fachada, novo apartamento ou empreendimento diferente.',
        'A composicao pode organizar, valorizar e combinar referencias, mas deve respeitar o imovel fotografado.',
      ]
      : [
        'Modo selecionado: Diretor Criativo IA.',
        'Crie uma campanha imobiliaria completa baseada no briefing, no publico e nos conceitos escolhidos.',
        'Use liberdade criativa para conceito, atmosfera, direcao de arte e composicao, mas nao invente um empreendimento diferente do briefing.',
        `Conceitos criativos selecionados: ${creativeConcepts.join(', ') || 'sem conceito especifico'}.`,
      ]

  return [
    'Crie uma imagem hero premium para marketing imobiliario brasileiro.',
    'A imagem deve ser limpa, sofisticada, realista e pronta para receber textos em HTML/CSS depois.',
    'NAO inclua nenhum texto na imagem. Nao use letras, palavras, numeros, frases, headline, CTA, selo, banner, placa, logotipo, marca d agua, telefone, email ou QR code.',
    'No text, no typography, no letters, no words, no captions, no signs, no labels anywhere in the image.',
    'Deixe respiro visual e area limpa para overlay futuro, sem cortar o topo, sem cortar elementos importantes e sem compor como banner textual.',
    'Nao invente metro, escolas, shopping, vista, lazer, financiamento, seguranca ou outros diferenciais que nao estejam no briefing.',
    ...modeInstruction,
    `Imovel: ${details || 'imovel residencial a venda'}.`,
    `Perfil do imovel: ${normalizeText(property.master_profile, 120) || 'nao informado'}.`,
    `Estado do imovel: ${normalizeText(choices.property_state, 120) || normalizeText(property.master_property_state, 120) || 'nao informado'}.`,
    `Publico-alvo: ${audiences.join(', ') || 'compradores de imoveis'}.`,
    `Focos/objetivos: ${subcategories.join(', ') || normalizeText(choices.subcategory, 120) || 'divulgacao imobiliaria'}.`,
    `Destaques informados: ${highlights.join(', ') || 'sem destaques adicionais'}.`,
    `CTA principal da campanha: ${normalizeText(choices.cta, 120) || 'Agende sua visita'}.`,
    'O CTA deve orientar a direcao comercial da campanha, mas nunca deve aparecer escrito dentro da imagem.',
    `Valores e condicoes: ${normalizeText(valueCondition.label, 120) || 'nao destacar valores'} ${normalizeText(valueCondition.details, 280)}`.trim(),
    `Destino principal: ${normalizeText(destination.label, 120) || 'Feed Instagram'}.`,
    `Orientacao adicional do usuario: ${normalizeText(choices.additional_info, 400) || 'nenhuma'}.`,
    'Priorize composicao premium com impacto visual, boa iluminacao, enquadramento inteiro, sensacao de valor e espaco negativo elegante.',
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

async function generateHeroTexts(briefing: JsonRecord, deliverables: Record<string, boolean>) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  const textBriefing = buildTextBriefing(briefing)
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
          content: JSON.stringify({
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

async function generateHeroImageFromReferences(prompt: string, size: string, photoUrls: string[]) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('HERO_IMAGE_MODEL') || 'gpt-image-1'

  if (!apiKey) {
    throw new Error('Configuracao de IA indisponivel.')
  }

  if (photoUrls.length === 0) {
    throw new Error('Fotos de referencia nao encontradas para este modo.')
  }

  const files = await Promise.all(photoUrls.map((url, index) => fetchReferenceImage(url, index)))
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

async function generateHeroImage(prompt: string, size: string, briefing: JsonRecord) {
  const property = briefing.property && typeof briefing.property === 'object'
    ? briefing.property as JsonRecord
    : {}
  const choices = briefing.choices && typeof briefing.choices === 'object'
    ? briefing.choices as JsonRecord
    : {}
  const imageMode = normalizeId(choices.image_mode, IMAGE_MODES)
  const photoUrls = normalizePhotoUrls(property.photo_urls, 8)

  if (imageMode === 'main_photo') {
    return generateHeroImageFromReferences(prompt, size, photoUrls.slice(0, 1))
  }

  if (imageMode === 'reference_photos') {
    return generateHeroImageFromReferences(prompt, size, photoUrls)
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
    const propertyId = typeof payload.property_id === 'string' ? payload.property_id : ''
    if (!isUuid(propertyId)) {
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const BUCKET = 'studio-videos'
const MAX_IMAGES = 30
const MAX_HIGHLIGHTS = 10
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60
const RECEIPT_TTL_SECONDS = 6 * 60 * 60
const SCENE_DURATION_SECONDS = 3.5
const NARRATION_CTA_GAP_SECONDS = 1.5
const OPENAI_TTS_MODEL = 'tts-1'
const RECEIPT_VERSION = 1
const RECEIPT_CONTEXT = 'smart-carousel-creatomate:receipt:v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CTA_FILES: Record<string, string> = {
  'Saiba Mais': 'cta-saiba-mais.png',
  'Agende sua visita': 'cta-agende-sua-visita.png',
  'Entre em contato agora': 'cta-entre-em-contato-agora.png',
  'Aguardo seu contato': 'cta-aguardo-seu-contato.png',
}

type JsonRecord = Record<string, unknown>
type ReceiptPayload = {
  v: number
  r: string
  u: string
  j: string
  i: number
  e: number
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizeDistrictName(value: unknown) {
  return cleanText(value, 60)
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])([\p{L}])/gu, (_, separator, letter) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`)
}

function normalizePhone(value: unknown) {
  let digits = cleanText(value, 40).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }

  if (!/^\d{10,11}$/.test(digits)) return ''

  const areaCode = digits.slice(0, 2)
  const subscriber = digits.slice(2)
  if (areaCode.startsWith('0') || subscriber.startsWith('0')) return ''

  return subscriber.length === 9
    ? `(${areaCode}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
    : `(${areaCode}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveReceiptKey(apiKey: string) {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    'HKDF',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(RECEIPT_CONTEXT),
      info: encoder.encode('render-ownership'),
    },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  )
}

async function createReceipt(apiKey: string, payload: ReceiptPayload) {
  const encoder = new TextEncoder()
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await deriveReceiptKey(apiKey)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload))
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`
}

async function verifyReceipt(apiKey: string, receipt: unknown) {
  if (typeof receipt !== 'string' || receipt.length > 2048) return null
  const parts = receipt.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null

  try {
    const key = await deriveReceiptKey(apiKey)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(parts[1]),
      new TextEncoder().encode(parts[0]),
    )
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]))) as ReceiptPayload
    if (
      payload?.v !== RECEIPT_VERSION
      || !isUuid(payload?.r)
      || !isUuid(payload?.u)
      || !isUuid(payload?.j)
      || !Number.isInteger(payload?.i)
      || !Number.isInteger(payload?.e)
      || payload.e <= payload.i
      || payload.e - payload.i > RECEIPT_TTL_SECONDS
    ) return null

    return payload
  } catch {
    return null
  }
}

function assertOwnedJobPath(path: unknown, userId: string, jobId: string) {
  if (typeof path !== 'string' || path.length > 512) return false
  const prefix = `${userId}/smart-carousel/${jobId}/`
  if (!path.startsWith(prefix)) return false
  const fileName = path.slice(prefix.length)
  return Boolean(fileName) && !fileName.includes('/') && !fileName.includes('\\') && !fileName.includes('..')
}

async function listJobObjects(supabase: ReturnType<typeof createClient>, userId: string, jobId: string) {
  const folder = `${userId}/smart-carousel/${jobId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: MAX_IMAGES + 10,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw new Error('storage_list_failed')
  return new Set((data || []).filter((item) => item?.name && item.id).map((item) => item.name))
}

async function cleanupJobFiles(supabase: ReturnType<typeof createClient>, userId: string, jobId: string) {
  if (!isUuid(userId) || !isUuid(jobId)) return
  const folder = `${userId}/smart-carousel/${jobId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: MAX_IMAGES + 10,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error || !data?.length) return

  const paths = data
    .filter((item) => item?.name && item.id && !item.name.includes('/') && !item.name.includes('..'))
    .map((item) => `${folder}/${item.name}`)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

async function createSignedUrl(supabase: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) throw new Error('signed_url_failed')
  return data.signedUrl
}

function buildCaptions(answers: JsonRecord) {
  const propertyStage = cleanText(answers.property_stage, 40)
  const city = cleanText(answers.city, 60)
  const district = normalizeDistrictName(answers.district)
  const uf = cleanText(answers.uf, 2)
  const priceLabel = cleanText(answers.price_label, 50)
  const bedrooms = cleanText(answers.bedrooms, 8)
  const suites = cleanText(answers.suites, 8)
  const parkingSpaces = cleanText(answers.parking_spaces, 8)
  const area = cleanText(answers.area, 10)

  const captions: string[] = []
  const location = [district, city, uf].filter(Boolean).join(' · ')
  if (location) captions.push(location)
  if (propertyStage) captions.push(propertyStage)

  const details = [
    bedrooms ? `${bedrooms} dormitório${bedrooms === '1' ? '' : 's'}` : '',
    suites ? `${suites} suíte${suites === '1' ? '' : 's'}` : '',
    parkingSpaces ? `${parkingSpaces} vaga${parkingSpaces === '1' ? '' : 's'}` : '',
  ].filter(Boolean).join(' · ')
  if (details) captions.push(details)
  if (area) captions.push(`${area} m²`)
  if (priceLabel) captions.push(priceLabel)

  return captions.filter(Boolean).slice(0, 5)
}

function joinNarrationItems(items: string[]) {
  if (items.length < 2) return items[0] || ''
  if (items.length === 2) return `${items[0]} e ${items[1]}`
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`
}

const NARRATION_HIGHLIGHT_PRIORITY = [
  'Varanda gourmet', 'Próximo ao metrô', 'Lazer completo', 'Acabamento premium', 'Vista panorâmica',
  'Bairro valorizado', 'Planta inteligente', 'Ambientes integrados', 'Iluminação natural', 'Portaria 24h',
  'Segurança 24h', 'Piscina', 'Academia', 'Espaço gourmet', 'Alto potencial de valorização',
]

function getHighlightTheme(value: string) {
  const normalized = value.toLocaleLowerCase('pt-BR')
  if (/próximo|acesso|bairro|região|vista livre/.test(normalized)) return 'location'
  if (/piscina|academia|lazer|salão|gourmet|churrasqueira|coworking|playground|quadra|rooftop|spa|sauna|wellness/.test(normalized)) return 'leisure'
  if (/varanda|suíte|closet|planta|ambientes|cozinha|acabamento|iluminação|vista panorâmica/.test(normalized)) return 'property'
  if (/financiamento|fgts|entrada|subsídio|documentação|unidades|condições|valorização/.test(normalized)) return 'commercial'
  return 'services'
}

function selectNarrationHighlights(highlights: string[]) {
  const targetCount = Math.min(5, Math.max(3, Math.ceil(highlights.length / 2)), highlights.length)
  const ranked = highlights
    .map((value, originalIndex) => {
      const priorityIndex = NARRATION_HIGHLIGHT_PRIORITY.indexOf(value)
      return { value, originalIndex, priorityIndex: priorityIndex === -1 ? NARRATION_HIGHLIGHT_PRIORITY.length : priorityIndex }
    })
    .sort((left, right) => left.priorityIndex - right.priorityIndex || left.originalIndex - right.originalIndex)

  const selected: string[] = []
  const usedThemes = new Set<string>()
  for (const item of ranked) {
    const theme = getHighlightTheme(item.value)
    if (!usedThemes.has(theme)) {
      selected.push(item.value)
      usedThemes.add(theme)
    }
    if (selected.length === targetCount) return selected
  }
  for (const item of ranked) {
    if (!selected.includes(item.value)) selected.push(item.value)
    if (selected.length === targetCount) break
  }
  return selected
}

function selectNarrationVoice(imageCount: number, highlightCount: number) {
  const useFemaleVoice = (imageCount + highlightCount) % 2 === 0
  const id = useFemaleVoice ? 'nova' : 'onyx'
  return {
    id,
    gender: useFemaleVoice ? 'feminina' : 'masculina',
    provider: `openai model=${OPENAI_TTS_MODEL} voice=${id}`,
    criterion: 'nova quando fotos + destaques é par; onyx quando é ímpar',
  }
}

function stableVariantIndex(seed: string, variantCount: number) {
  const hash = Array.from(seed).reduce((total, character) => (total * 31 + character.codePointAt(0)!) >>> 0, 0)
  return variantCount ? hash % variantCount : 0
}

function countNarrationWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function buildNarrationPlan(answers: JsonRecord, cta: string, imageCount: number, availableSeconds: number) {
  const purpose = cleanText(answers.purpose, 20)
  const propertyStage = cleanText(answers.property_stage, 40)
  const propertyType = cleanText(answers.property_type, 40)
  const priceLabel = cleanText(answers.price_label, 50)
  const district = normalizeDistrictName(answers.district)
  const city = cleanText(answers.city, 60)
  const uf = cleanText(answers.uf, 2)
  const highlights = (Array.isArray(answers.highlights) ? answers.highlights : [])
    .slice(0, MAX_HIGHLIGHTS)
    .map((item) => cleanText(item, 60))
    .filter(Boolean)
  const narrationHighlights = selectNarrationHighlights(highlights)
  const ctaLabel = cleanText(cta, 80)
  const voice = selectNarrationVoice(imageCount, highlights.length)

  const propertyTypeLower = propertyType.toLocaleLowerCase('pt-BR')
  const feminineProperty = /^(casa|cobertura)$/.test(propertyTypeLower)
  const subject = propertyType ? `${feminineProperty ? 'esta' : 'este'} ${propertyTypeLower}` : 'este imóvel'
  const purposeLabel = purpose === 'rent' ? 'para locação' : purpose === 'sale' ? 'à venda' : ''
  const location = [district ? `em ${district}` : '', city ? `na cidade de ${city}` : ''].filter(Boolean).join(', ')
  const spokenHighlights = narrationHighlights.map((item) => item.toLocaleLowerCase('pt-BR'))
  const ctaNarration: Record<string, string> = {
    'Saiba Mais': 'Vale a pena conhecer de perto. Saiba mais.',
    'Agende sua visita': 'Venha conhecer todos os detalhes. Agende sua visita.',
    'Entre em contato agora': 'Descubra se este é o imóvel ideal para você. Entre em contato agora.',
    'Aguardo seu contato': 'Conheça melhor esta oportunidade. Aguardo seu contato.',
  }

  const openingSeed = [propertyType, propertyStage, district, city, highlights.join('|')].join('|')
  const openings = [
    `Conheça ${subject}${location ? ` ${location}` : ''}${purposeLabel ? `, ${purposeLabel}` : ''}.`,
    `Descubra uma nova forma de viver com ${subject}${location ? ` ${location}` : ''}.`,
    `Apresentamos ${subject}${location ? ` ${location}` : ''}, uma oportunidade que merece sua atenção.`,
    `Uma excelente oportunidade espera por você${location ? ` ${location}` : ''}.`,
    `Se você procura um imóvel especial${location ? ` ${location}` : ''}, vale a pena conhecer esta opção.`,
    `Vale a pena conhecer ${subject}${location ? ` ${location}` : ''}, pensado para uma experiência diferenciada.`,
  ]
  const segments: string[] = [openings[stableVariantIndex(openingSeed, openings.length)]]
  if (propertyStage) segments.push(`${propertyStage} e pronto para despertar novas possibilidades.`)
  if (spokenHighlights.length) segments.push(`A experiência ganha ainda mais valor com ${joinNarrationItems(spokenHighlights)}.`)

  const targetWords = Math.max(24, Math.round(availableSeconds * 2.45))
  const supportingSegments = [
    'Uma combinação de atributos que torna cada momento mais agradável e cheio de possibilidades.',
    'Tudo foi reunido para criar uma experiência marcante, acolhedora e alinhada ao seu estilo de vida.',
    'É uma oportunidade para transformar planos em uma nova história e viver momentos especiais.',
  ]
  for (const supportingSegment of supportingSegments) {
    const closing = ctaNarration[ctaLabel] || 'Venha conhecer este imóvel.'
    if (countNarrationWords([...segments, closing].join(' ')) >= targetWords - 4) break
    segments.push(supportingSegment)
  }
  segments.push(ctaNarration[ctaLabel] || 'Venha conhecer este imóvel.')

  return {
    source: 'broker_answers',
    facts: {
      purpose,
      property_stage: propertyStage,
      property_type: propertyType,
      price_label: priceLabel,
      district,
      city,
      uf,
      highlights,
      narration_highlights: narrationHighlights,
      cta: ctaLabel,
    },
    segments,
    text: segments.join(' '),
    timing: {
      available_seconds: availableSeconds,
      target_gap_seconds: NARRATION_CTA_GAP_SECONDS,
      estimated_words: countNarrationWords(segments.join(' ')),
      estimated_seconds: Number((countNarrationWords(segments.join(' ')) / 2.45).toFixed(2)),
    },
    voice,
  }
}

function buildRenderScript(imageUrls: string[], ctaUrl: string, answers: JsonRecord, phone: string, narrationText: string, voiceProvider: string) {
  const captions = buildCaptions(answers)
  const transitionDuration = 0.45
  const ctaSceneDuration = 3.5
  const photoSequenceDuration = imageUrls.length * SCENE_DURATION_SECONDS
    - Math.max(0, imageUrls.length - 1) * transitionDuration
  const duration = photoSequenceDuration + ctaSceneDuration
  const narrationDuration = Math.max(1, photoSequenceDuration - NARRATION_CTA_GAP_SECONDS)
  const imageMovements = [
    {
      easing: 'cubic-in-out',
      type: 'pan',
      scope: 'element',
      start_x: '47%',
      end_x: '53%',
      start_y: '53%',
      end_y: '47%',
      start_scale: '110%',
      end_scale: '132%',
      fade: false,
    },
    {
      easing: 'cubic-in-out',
      type: 'pan',
      scope: 'element',
      start_x: '40%',
      end_x: '60%',
      start_scale: '126%',
      end_scale: '126%',
      fade: false,
    },
    {
      easing: 'cubic-in-out',
      type: 'scale',
      scope: 'element',
      start_scale: '132%',
      end_scale: '108%',
      fade: false,
    },
    {
      easing: 'cubic-in-out',
      type: 'pan',
      scope: 'element',
      start_x: '60%',
      end_x: '40%',
      start_y: '48%',
      end_y: '52%',
      start_scale: '128%',
      end_scale: '124%',
      fade: false,
    },
    {
      easing: 'cubic-in-out',
      type: 'pan',
      scope: 'element',
      start_x: '44%',
      end_x: '56%',
      start_y: '54%',
      end_y: '46%',
      start_scale: '114%',
      end_scale: '128%',
      fade: false,
    },
  ]
  const imageElements = imageUrls.map((source, index) => ({
    type: 'image',
    track: 1,
    duration: SCENE_DURATION_SECONDS,
    source,
    fit: 'cover',
    clip: true,
    x: index % 2 === 0 ? '49%' : '51%',
    animations: [
      ...(index > 0 ? [{
        duration: transitionDuration,
        easing: 'cubic-in-out',
        transition: true,
        type: 'fade',
      }] : []),
      imageMovements[index % imageMovements.length],
    ],
  }))

  const textElements = captions.slice(0, imageUrls.length).map((text, index) => ({
    type: 'text',
    track: 2,
    time: index * (SCENE_DURATION_SECONDS - transitionDuration) + transitionDuration,
    duration: 2.6,
    x: '50%',
    y: '82%',
    width: '86%',
    height: '12%',
    x_alignment: '50%',
    y_alignment: '50%',
    text,
    fill_color: '#ffffff',
    font_family: 'Inter',
    font_weight: 700,
    font_size: '5.2 vmin',
    text_wrap: true,
    background_color: 'rgba(5, 46, 22, 0.72)',
    background_x_padding: '16%',
    background_y_padding: '16%',
    background_border_radius: '18%',
    animations: [{ duration: 0.35, easing: 'quadratic-out', type: 'fade' }],
  }))

  const voiceoverElements: JsonRecord[] = narrationText ? [
    {
      name: 'Smart-Carousel-Voiceover',
      type: 'audio',
      track: 5,
      time: 0,
      duration: narrationDuration,
      source: narrationText,
      provider: voiceProvider,
      volume: '100%',
      audio_fade_in: 0.2,
      audio_fade_out: 0.35,
    },
  ] : []

  const ctaTime = photoSequenceDuration
  const finalElements: JsonRecord[] = [
    {
      type: 'image',
      track: 3,
      time: ctaTime,
      duration: ctaSceneDuration,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      source: ctaUrl,
      fit: 'cover',
      clip: true,
      animations: [{ duration: 0.65, easing: 'cubic-in-out', type: 'fade' }],
    },
  ]

  if (phone) {
    finalElements.push({
      type: 'text',
      track: 4,
      time: ctaTime + 1.15,
      duration: 2.1,
      x: '50%',
      y: '87%',
      width: '82%',
      height: '8%',
      x_alignment: '50%',
      y_alignment: '50%',
      text: phone,
      fill_color: '#ffffff',
      font_family: 'Inter',
      font_weight: 700,
      font_size: '4.6 vmin',
      text_wrap: false,
      background_color: 'rgba(5, 46, 22, 0.82)',
      background_x_padding: '14%',
      background_y_padding: '16%',
      background_border_radius: '20%',
      animations: [
        { duration: 0.55, easing: 'quadratic-out', type: 'fade' },
        {
          duration: 0.65,
          easing: 'quadratic-out',
          type: 'text-slide',
          scope: 'element',
          direction: 'up',
          distance: '35%',
          background_effect: 'disabled',
        },
      ],
    })
  }

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration,
    snapshot_time: Math.min(1, Math.max(0, duration - 0.1)),
    elements: [...imageElements, ...textElements, ...voiceoverElements, ...finalElements],
  }
}

function buildPresentationPlan(imageUrls: string[], ctaUrl: string, answers: JsonRecord, phone: string, cta: string) {
  const transitionDuration = 0.45
  const photoSequenceDuration = imageUrls.length * SCENE_DURATION_SECONDS
    - Math.max(0, imageUrls.length - 1) * transitionDuration
  const narration = buildNarrationPlan(answers, cta, imageUrls.length, Math.max(1, photoSequenceDuration - NARRATION_CTA_GAP_SECONDS))
  return {
    renderScript: buildRenderScript(imageUrls, ctaUrl, answers, phone, narration.text, narration.voice.provider),
    narration,
  }
}

async function handleCreate(
  body: JsonRecord,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  creatomateApiKey: string,
) {
  const jobId = cleanText(body.job_id, 64)
  const imagePaths = Array.isArray(body.image_paths) ? body.image_paths : []
  const answers = asRecord(body.answers)
  const cta = cleanText(body.cta, 80)
  const ctaPath = cleanText(body.cta_path, 512)
  const sharePhone = body.share_phone === true || body.share_phone === 'yes'

  if (!isUuid(jobId)) return jsonResponse({ ok: false, error: 'Apresentação inválida.' }, 400)
  if (!imagePaths.length || imagePaths.length > MAX_IMAGES) {
    return jsonResponse({ ok: false, error: 'Selecione entre 1 e 30 fotos.' }, 400)
  }
  if (!CTA_FILES[cta]) return jsonResponse({ ok: false, error: 'Chamada final inválida.' }, 400)
  if (!imagePaths.every((path) => assertOwnedJobPath(path, userId, jobId))) {
    return jsonResponse({ ok: false, error: 'Arquivos inválidos.' }, 400)
  }
  if (new Set(imagePaths).size !== imagePaths.length) {
    return jsonResponse({ ok: false, error: 'Existem fotos duplicadas no envio.' }, 400)
  }
  if (!assertOwnedJobPath(ctaPath, userId, jobId) || ctaPath.split('/').pop() !== CTA_FILES[cta]) {
    return jsonResponse({ ok: false, error: 'Chamada final inválida.' }, 400)
  }

  try {
    const existingNames = await listJobObjects(supabase, userId, jobId)
    const requestedNames = [...imagePaths, ctaPath].map((path) => path.split('/').pop() || '')
    if (!requestedNames.every((name) => existingNames.has(name))) {
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({ ok: false, error: 'Não foi possível localizar todas as fotos.' }, 400)
    }

    const imageUrls: string[] = []
    for (const path of imagePaths) imageUrls.push(await createSignedUrl(supabase, String(path)))
    const ctaUrl = await createSignedUrl(supabase, ctaPath)

    let phone = ''
    if (sharePhone) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('whatsapp, telefone')
        .eq('id', userId)
        .maybeSingle()
      phone = normalizePhone(profile?.whatsapp || profile?.telefone || '')
    }

    const presentationPlan = buildPresentationPlan(imageUrls, ctaUrl, answers, phone, cta)
    const response = await fetch('https://api.creatomate.com/v2/renders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatomateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presentationPlan.renderScript),
    })
    const responseBody = await response.json().catch(() => null)
    if (!response.ok) {
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({ ok: false, error: 'Não foi possível iniciar sua apresentação.' }, 502)
    }

    const render = Array.isArray(responseBody) ? responseBody[0] : responseBody
    const renderId = render && typeof render === 'object' ? cleanText((render as JsonRecord).id, 64) : ''
    if (!isUuid(renderId)) {
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({ ok: false, error: 'Não foi possível iniciar sua apresentação.' }, 502)
    }

    const issuedAt = Math.floor(Date.now() / 1000)
    const receipt = await createReceipt(creatomateApiKey, {
      v: RECEIPT_VERSION,
      r: renderId,
      u: userId,
      j: jobId,
      i: issuedAt,
      e: issuedAt + RECEIPT_TTL_SECONDS,
    })

    return jsonResponse({
      ok: true,
      status: cleanText((render as JsonRecord).status, 32) || 'planned',
      receipt,
    })
  } catch {
    await cleanupJobFiles(supabase, userId, jobId)
    return jsonResponse({ ok: false, error: 'Não foi possível preparar sua apresentação.' }, 500)
  }
}

async function handleStatus(
  body: JsonRecord,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  creatomateApiKey: string,
) {
  const payload = await verifyReceipt(creatomateApiKey, body.receipt)
  if (!payload || payload.u !== userId) {
    return jsonResponse({ ok: false, error: 'Acompanhamento inválido.' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.e <= now) {
    await cleanupJobFiles(supabase, userId, payload.j)
    return jsonResponse({ ok: false, error: 'O acompanhamento expirou. Tente novamente.' }, 410)
  }

  try {
    const response = await fetch(`https://api.creatomate.com/v2/renders/${encodeURIComponent(payload.r)}`, {
      headers: { Authorization: `Bearer ${creatomateApiKey}` },
    })
    const render = await response.json().catch(() => null) as JsonRecord | null
    if (!response.ok || !render) {
      return jsonResponse({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
    }

    const status = cleanText(render.status, 32)
    if (status === 'succeeded') {
      const videoUrl = cleanText(render.url, 2048)
      await cleanupJobFiles(supabase, userId, payload.j)
      if (!/^https:\/\//i.test(videoUrl)) {
        return jsonResponse({ ok: false, error: 'A apresentação foi concluída sem arquivo disponível.' }, 502)
      }
      return jsonResponse({ ok: true, status: 'succeeded', video_url: videoUrl })
    }

    if (status === 'failed') {
      await cleanupJobFiles(supabase, userId, payload.j)
      return jsonResponse({ ok: true, status: 'failed', error: 'Não foi possível criar sua apresentação. Tente novamente.' })
    }

    const allowedStatus = ['planned', 'waiting', 'transcribing', 'rendering'].includes(status) ? status : 'rendering'
    return jsonResponse({ ok: true, status: allowedStatus })
  } catch {
    return jsonResponse({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const creatomateApiKey = Deno.env.get('CREATOMATE_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !creatomateApiKey) {
      return jsonResponse({ ok: false, error: 'Serviço temporariamente indisponível.' }, 503)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id || !isUuid(user.id)) {
      return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const body = asRecord(await req.json().catch(() => ({})))
    const action = cleanText(body.action, 20)
    if (action === 'create') return handleCreate(body, user.id, supabase, creatomateApiKey)
    if (action === 'status') return handleStatus(body, user.id, supabase, creatomateApiKey)
    return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
  } catch {
    return jsonResponse({ ok: false, error: 'Não foi possível concluir a solicitação.' }, 500)
  }
})

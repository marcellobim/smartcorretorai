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
const OPENAI_MARKETING_MODEL = 'gpt-4.1'
const OPENAI_MARKETING_TIMEOUT_MS = 55_000
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

function countNarrationWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function sanitizeStringList(value: unknown, maxItems: number, maxLength: number) {
  return (Array.isArray(value) ? value : [])
    .slice(0, maxItems)
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
}

function sanitizeCampaign(value: unknown, index: number) {
  const campaign = asRecord(value)
  const email = asRecord(campaign.email)
  const expectedStyles = ['emocional', 'comercial', 'curiosidade']
  const style = expectedStyles[index] || cleanText(campaign.style, 30)
  return {
    id: `campaign-${index + 1}`,
    style,
    name: cleanText(campaign.name, 80),
    objective: cleanText(campaign.objective, 220),
    instagram: cleanText(campaign.instagram, 2400),
    whatsapp: cleanText(campaign.whatsapp, 1200),
    facebook: cleanText(campaign.facebook, 2400),
    email: {
      subject: cleanText(email.subject, 180),
      body: cleanText(email.body, 3000),
    },
    linkedin: cleanText(campaign.linkedin, 2400),
    hashtags: sanitizeStringList(campaign.hashtags, 12, 80),
    cta: cleanText(campaign.cta, 220),
  }
}

function validateMarketingIntelligence(value: unknown) {
  const result = asRecord(value)
  const narration = cleanText(result.narration, 2200)
  const campaigns = (Array.isArray(result.campaigns) ? result.campaigns : [])
    .slice(0, 3)
    .map(sanitizeCampaign)

  if (!narration || campaigns.length !== 3) throw new Error('invalid_marketing_response')
  for (const campaign of campaigns) {
    if (
      !campaign.name
      || !campaign.objective
      || !campaign.instagram
      || !campaign.whatsapp
      || !campaign.facebook
      || !campaign.email.subject
      || !campaign.email.body
      || !campaign.hashtags.includes('#SmartCorretorAI')
      || !campaign.cta
    ) throw new Error('invalid_marketing_response')
  }

  return {
    narration,
    narrationHighlights: sanitizeStringList(result.narration_highlights, 5, 80),
    campaigns,
  }
}

async function generateMarketingIntelligence(
  apiKey: string,
  answers: JsonRecord,
  cta: string,
  phone: string,
  imageCount: number,
  availableSeconds: number,
) {
  const facts = {
    purpose: cleanText(answers.purpose, 20),
    property_stage: cleanText(answers.property_stage, 40),
    property_type: cleanText(answers.property_type, 40),
    bedrooms: cleanText(answers.bedrooms, 8),
    suites: cleanText(answers.suites, 8),
    parking_spaces: cleanText(answers.parking_spaces, 8),
    area: cleanText(answers.area, 10),
    district: normalizeDistrictName(answers.district),
    city: cleanText(answers.city, 60),
    uf: cleanText(answers.uf, 2),
    property_stage_label: cleanText(answers.property_stage, 40),
    price_label: cleanText(answers.price_label, 50),
    highlights: sanitizeStringList(answers.highlights, MAX_HIGHLIGHTS, 80),
    cta: cleanText(cta, 80),
    contact_authorized: Boolean(phone),
    phone: phone || '',
  }
  const maxNarrationWords = Math.max(8, Math.floor(availableSeconds * 2.35))
  const minNarrationWords = Math.max(5, Math.min(maxNarrationWords - 2, Math.floor(availableSeconds * 1.85)))

  const systemPrompt = `Voc\u00ea \u00e9 o Diretor de Marketing Imobili\u00e1rio do SmartCorretorAI.
Sua miss\u00e3o \u00e9 entregar uma narra\u00e7\u00e3o e tr\u00eas campanhas completas que um corretor publicaria exatamente como recebeu.

REGRA ABSOLUTA: use somente os fatos confirmados no JSON do usu\u00e1rio. Nunca invente localiza\u00e7\u00e3o, proximidade, vista, acabamento, seguran\u00e7a, valoriza\u00e7\u00e3o, lazer, financiamento, perfil familiar, investimento ou qualquer caracter\u00edstica ausente.

NARRA\u00c7\u00c3O — A TELA INFORMA; A NARRA\u00c7\u00c3O VENDE:
- crie gancho, interesse, benef\u00edcio sustentado, desejo e convite;
- n\u00e3o leia a ficha t\u00e9cnica nem narre pre\u00e7o, metragem, dormit\u00f3rios, su\u00edtes ou vagas;
- selecione de 3 a 5 destaques quando existirem; com menos, use apenas os dispon\u00edveis; sem destaques, venda adequa\u00e7\u00e3o, clareza ou possibilidade sem fingir excepcionalidade;
- n\u00e3o descreva as fotografias;
- evite clich\u00eas sem prova: im\u00f3vel dos sonhos, localiza\u00e7\u00e3o privilegiada, oportunidade imperd\u00edvel, conforto e sofistica\u00e7\u00e3o;
- escreva para voz brasileira: frases curtas, contra\u00e7\u00f5es naturais, ritmo oral e pequenas pausas marcadas por pontua\u00e7\u00e3o;
- termine antes do CTA visual, com um convite natural, sem repetir mecanicamente o texto do CTA;
- respeite rigorosamente a faixa de palavras informada.

CENTRAL DA CAMPANHA:
- gere tr\u00eas campanhas realmente diferentes e coerentes em todos os canais;
- Campanha 1 emocional: convence por identifica\u00e7\u00e3o, momento ou mudan\u00e7a;
- Campanha 2 comercial: convence por clareza, compara\u00e7\u00e3o e decis\u00e3o;
- Campanha 3 curiosidade: convence por perguntas e descoberta;
- cada campanha precisa ter personalidade pr\u00f3pria, n\u00e3o apenas outra abertura;
- WhatsApp deve soar como conversa espont\u00e2nea entre pessoas. N\u00e3o use \"Tenho um im\u00f3vel para apresentar\", \"Deseja conhecer?\" ou \"Solicite informa\u00e7\u00f5es\";
- e-mail deve criar relacionamento: humano, pr\u00f3ximo e profissional, nunca um comunicado;
- adapte Instagram, Facebook, WhatsApp e e-mail ao comportamento de cada canal;
- LinkedIn deve ser vazio quando n\u00e3o houver contexto profissional, comercial, institucional ou de investimento confirmado;
- n\u00e3o inclua telefone sem contact_authorized=true;
- hashtags devem ser grupos inteligentes de descoberta: marca, localiza\u00e7\u00e3o, estilo de vida sustentado, nicho e inten\u00e7\u00e3o compat\u00edvel. Nunca apenas converta campos. Evite listas \u00f3bvias e repetitivas. Inclua sempre #SmartCorretorAI;
- CTAs devem variar conforme a estrat\u00e9gia e soar humanos;
- revise silenciosamente cada sa\u00edda com a pergunta: \"Eu publicaria exatamente assim?\". Se n\u00e3o, reescreva antes de responder.

Responda somente com JSON v\u00e1lido neste formato:
{
  \"narration\": \"texto final pronto para voz\",
  \"narration_highlights\": [\"destaques efetivamente usados\"],
  \"campaigns\": [
    {
      \"style\": \"emocional|comercial|curiosidade\",
      \"name\": \"nome memor\u00e1vel\",
      \"objective\": \"forma espec\u00edfica de convencer\",
      \"instagram\": \"texto pronto\",
      \"whatsapp\": \"mensagem pronta\",
      \"facebook\": \"texto pronto\",
      \"email\": { \"subject\": \"assunto\", \"body\": \"mensagem\" },
      \"linkedin\": \"texto pronto ou string vazia\",
      \"hashtags\": [\"#SmartCorretorAI\", \"outras hashtags\"],
      \"cta\": \"CTA da estrat\u00e9gia\"
    }
  ]
}`

  const userPrompt = JSON.stringify({
    confirmed_facts: facts,
    visual_information: ['localiza\u00e7\u00e3o', 'estado do im\u00f3vel', 'composi\u00e7\u00e3o', 'area', 'pre\u00e7o quando informado'],
    narration: {
      available_seconds: availableSeconds,
      minimum_words: minNarrationWords,
      maximum_words: maxNarrationWords,
      image_count: imageCount,
    },
  })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MARKETING_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 6500,
    }),
    signal: AbortSignal.timeout(OPENAI_MARKETING_TIMEOUT_MS),
  })
  const responseBody = await response.json().catch(() => null) as JsonRecord | null
  if (!response.ok || !responseBody) throw new Error('marketing_generation_failed')

  const choices = Array.isArray(responseBody.choices) ? responseBody.choices : []
  const firstChoice = asRecord(choices[0])
  const message = asRecord(firstChoice.message)
  const content = cleanText(message.content, 40_000)
  if (!content) throw new Error('marketing_generation_failed')

  try {
    const intelligence = validateMarketingIntelligence(JSON.parse(content))
    const narrationWords = countNarrationWords(intelligence.narration)
    if (narrationWords < minNarrationWords || narrationWords > maxNarrationWords) {
      throw new Error('invalid_narration_duration')
    }
    return intelligence
  } catch {
    throw new Error('marketing_generation_failed')
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

async function buildPresentationPlan(
  imageUrls: string[],
  ctaUrl: string,
  answers: JsonRecord,
  phone: string,
  cta: string,
  openaiApiKey: string,
) {
  const transitionDuration = 0.45
  const photoSequenceDuration = imageUrls.length * SCENE_DURATION_SECONDS
    - Math.max(0, imageUrls.length - 1) * transitionDuration
  const availableSeconds = Math.max(1, photoSequenceDuration - NARRATION_CTA_GAP_SECONDS)
  const intelligence = await generateMarketingIntelligence(
    openaiApiKey,
    answers,
    cta,
    phone,
    imageUrls.length,
    availableSeconds,
  )
  const voice = selectNarrationVoice(imageUrls.length, intelligence.narrationHighlights.length)
  return {
    renderScript: buildRenderScript(imageUrls, ctaUrl, answers, phone, intelligence.narration, voice.provider),
    narration: {
      source: 'openai_marketing_director',
      text: intelligence.narration,
      highlights: intelligence.narrationHighlights,
      timing: {
        available_seconds: availableSeconds,
        target_gap_seconds: NARRATION_CTA_GAP_SECONDS,
        words: countNarrationWords(intelligence.narration),
      },
      voice,
    },
    campaigns: intelligence.campaigns,
  }
}

async function handleCreate(
  body: JsonRecord,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  creatomateApiKey: string,
  openaiApiKey: string,
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

    const presentationPlan = await buildPresentationPlan(imageUrls, ctaUrl, answers, phone, cta, openaiApiKey)
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
      campaign_package: {
        campaigns: presentationPlan.campaigns,
      },
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!supabaseUrl || !serviceRoleKey || !creatomateApiKey || !openaiApiKey) {
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
    if (action === 'create') return handleCreate(body, user.id, supabase, creatomateApiKey, openaiApiKey)
    if (action === 'status') return handleStatus(body, user.id, supabase, creatomateApiKey)
    return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
  } catch {
    return jsonResponse({ ok: false, error: 'Não foi possível concluir a solicitação.' }, 500)
  }
})

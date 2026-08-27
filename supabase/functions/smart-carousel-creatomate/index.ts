import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { normalizeOfficialHashtags } from '../_shared/official-hashtags.ts'
import { GOOGLE_ADS_PROMPT_RULES, validateGoogleAdsDelivery } from '../_shared/google-ads.ts'
import {
  SMART_CAROUSEL_MAX_IMAGES,
  SMART_CAROUSEL_MIN_IMAGES,
  claimSmartCarouselEconomy,
  insufficientSmartCarouselTokensResponse,
  recordSmartCarouselProvider,
  recoverSmartCarouselEconomy,
  settleSmartCarouselEconomy,
} from '../_shared/smart-carousel-economy.ts'
import {
  SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS,
  SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS,
  SMART_CAROUSEL_SCENE_DURATION_SECONDS,
  SMART_CAROUSEL_TRANSITION_DURATION_SECONDS,
  calculateNarrationWordTargets,
  calculateSmartCarouselTiming,
  countNarrationWords,
  resolveNarrationTiming,
} from './narration-timing.ts'
import {
  MarketingOpenAIError,
  createMarketingOpenAICallBudget,
  logMarketingLocalFailure,
  requestMarketingOpenAIJson,
} from './marketing-openai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const BUCKET = 'studio-videos'
const MAX_HIGHLIGHTS = 10
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60
const RECEIPT_TTL_SECONDS = 6 * 60 * 60
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
    limit: SMART_CAROUSEL_MAX_IMAGES + 10,
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
    limit: SMART_CAROUSEL_MAX_IMAGES + 10,
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

function validateMarketingIntelligence(value: unknown, expectedCta: string) {
  const result = asRecord(value)
  const narration = cleanText(result.narration, 2200)
  const campaigns = (Array.isArray(result.campaigns) ? result.campaigns : [])
    .slice(0, 3)
    .map(sanitizeCampaign)
  const googleAds = validateGoogleAdsDelivery(result.google_ads, { expectedCta })

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
    googleAds,
  }
}

function validateNarrationRevision(value: unknown) {
  const result = asRecord(value)
  const narration = cleanText(result.narration, 2200)
  if (!narration) throw new Error('invalid_marketing_response')

  return {
    narration,
    narrationHighlights: sanitizeStringList(result.narration_highlights, 5, 80),
  }
}

async function generateMarketingIntelligence(
  apiKey: string,
  jobId: string,
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
  const {
    minimumWords: minNarrationWords,
    maximumWords: maxNarrationWords,
  } = calculateNarrationWordTargets(availableSeconds)

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
- o tempo util, o minimo recomendado e o maximo absoluto estao informados no JSON do usuario;
- respeite rigorosamente essa faixa: nunca ultrapasse o maximo absoluto e nao entregue abaixo do minimo recomendado.

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
- hashtags devem ser grupos inteligentes de descoberta: misture localiza\u00e7\u00e3o, tipo, finalidade, estilo de vida sustentado, diferenciais reais, inten\u00e7\u00e3o de busca e termos amplos, m\u00e9dios e espec\u00edficos. Gere de 12 a 15, varie entre im\u00f3veis semelhantes, nunca apenas converta campos, n\u00e3o repita e evite excesso de #Imoveis, #CorretorDeImoveis e #MercadoImobiliario. Inclua sempre #SmartCorretorAI no meio da lista, nunca no in\u00edcio ou no final;
- CTAs devem variar conforme a estrat\u00e9gia e soar humanos;
- revise silenciosamente cada sa\u00edda com a pergunta: \"Eu publicaria exatamente assim?\". Se n\u00e3o, reescreva antes de responder.

${GOOGLE_ADS_PROMPT_RULES}

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
  ],
  \"google_ads\": {
    \"headlines\": [\"titulo curto 1\", \"titulo curto 2\"],
    \"long_headline\": \"titulo longo\",
    \"descriptions\": [\"descricao 1\", \"descricao 2\"],
    \"cta\": \"CTA exato do briefing\",
    \"suggested_keywords\": [\"palavra-chave 1\", \"palavra-chave 2\", \"palavra-chave 3\"]
  }
}`

  const userPrompt = JSON.stringify({
    confirmed_facts: facts,
    visual_information: ['localiza\u00e7\u00e3o', 'estado do im\u00f3vel', 'composi\u00e7\u00e3o', 'area', 'pre\u00e7o quando informado'],
    narration: {
      available_seconds: availableSeconds,
      minimum_words: minNarrationWords,
      maximum_words: maxNarrationWords,
      image_count: imageCount,
      writing_requirements: [
        'Use frases curtas.',
        'Crie pausas naturais com pontuacao.',
        'Nao ultrapasse a faixa de palavras.',
      ],
    },
  })

  const callBudget = createMarketingOpenAICallBudget()
  const intelligence = await requestMarketingOpenAIJson({
    jobId,
    stage: 'initial',
    budget: callBudget,
    url: 'https://api.openai.com/v1/chat/completions',
    timeoutMs: OPENAI_MARKETING_TIMEOUT_MS,
    init: {
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
    },
    validate: value => validateMarketingIntelligence(value, facts.cta),
  })

  try {
    const resolvedNarration = await resolveNarrationTiming({
      initial: {
        narration: intelligence.narration,
        narrationHighlights: intelligence.narrationHighlights,
      },
      minimumWords: minNarrationWords,
      maximumWords: maxNarrationWords,
      fallbackInvitation: cta,
      reviseOnce: async (targetNarrationWords) => {
        return requestMarketingOpenAIJson({
          jobId,
          stage: 'revision',
          budget: callBudget,
          url: 'https://api.openai.com/v1/chat/completions',
          timeoutMs: OPENAI_MARKETING_TIMEOUT_MS,
          init: {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: OPENAI_MARKETING_MODEL,
              messages: [
                {
                  role: 'system',
                  content: `Voce e um revisor de narracao imobiliaria para voz brasileira.
Revise uma unica vez a narracao recebida para caber rigorosamente na faixa informada.
Entregue exatamente a contagem-alvo informada sempre que semanticamente possivel.
Preserve os fatos confirmados, o gancho e o convite natural.
Nao adicione informacoes, nao invente fatos e nao faca corte mecanico.
Use frases curtas, pausas naturais e ritmo comercial.
Responda somente com JSON valido no formato:
{"narration":"texto revisado","narration_highlights":["destaques efetivamente usados"]}`,
                },
                {
                  role: 'user',
                  content: JSON.stringify({
                    confirmed_facts: facts,
                    original_narration: intelligence.narration,
                    original_narration_highlights: intelligence.narrationHighlights,
                    available_seconds: availableSeconds,
                    minimum_words: minNarrationWords,
                    maximum_words: maxNarrationWords,
                    target_words: targetNarrationWords,
                  }),
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0,
              max_tokens: 1200,
            }),
          },
          validate: validateNarrationRevision,
        })
      },
    })

    const campaigns = intelligence.campaigns.map(campaign => ({
      ...campaign,
      hashtags: normalizeOfficialHashtags(campaign.hashtags, {
        purpose:facts.purpose, propertyType:facts.property_type, propertyStage:facts.property_stage,
        city:facts.city, district:facts.district, state:facts.uf, bedrooms:facts.bedrooms,
        suites:facts.suites, parkingSpaces:facts.parking_spaces, highlights:facts.highlights, cta:campaign.cta,
      }),
    }))
    return {
      ...intelligence,
      campaigns,
      narration: resolvedNarration.narration,
      narrationHighlights: resolvedNarration.narrationHighlights,
    }
  } catch (error) {
    if (error instanceof MarketingOpenAIError) throw error
    if (error instanceof Error && error.message === 'narration_duration_out_of_range') {
      throw logMarketingLocalFailure({
        jobId,
        stage: 'revision',
        code: 'marketing_revision_invalid',
        attempt: callBudget.calls,
        failureType: 'narration_duration_out_of_range',
      })
    }
    throw logMarketingLocalFailure({
      jobId,
      stage: 'revision',
      code: 'marketing_local_deterministic_error',
      attempt: callBudget.calls,
      failureType: 'local_deterministic',
    })
  }
}

function buildRenderScript(imageUrls: string[], ctaUrl: string, answers: JsonRecord, phone: string, narrationText: string, voiceProvider: string) {
  const captions = buildCaptions(answers)
  const transitionDuration = SMART_CAROUSEL_TRANSITION_DURATION_SECONDS
  const ctaSceneDuration = SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS
  const timing = calculateSmartCarouselTiming(imageUrls.length)
  const duration = timing.totalSeconds
  const narrationDuration = timing.narrationSeconds
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
    duration: SMART_CAROUSEL_SCENE_DURATION_SECONDS,
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
    time: index * (SMART_CAROUSEL_SCENE_DURATION_SECONDS - transitionDuration) + transitionDuration,
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

  const ctaTime = timing.photoSequenceSeconds
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
  jobId: string,
) {
  const timing = calculateSmartCarouselTiming(imageUrls.length)
  const availableSeconds = timing.narrationSeconds
  const intelligence = await generateMarketingIntelligence(
    openaiApiKey,
    jobId,
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
        target_gap_seconds: SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS,
        words: countNarrationWords(intelligence.narration),
      },
      voice,
    },
    campaigns: intelligence.campaigns,
    googleAds: intelligence.googleAds,
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
  if (imagePaths.length < SMART_CAROUSEL_MIN_IMAGES || imagePaths.length > SMART_CAROUSEL_MAX_IMAGES) {
    return jsonResponse({ ok: false, error: 'Selecione entre 5 e 20 fotos.' }, 400)
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
  let executionClaimed = false
  try {
    const existingNames = await listJobObjects(supabase, userId, jobId)
    const requestedNames = [...imagePaths, ctaPath].map((path) => path.split('/').pop() || '')
    if (!requestedNames.every((name) => existingNames.has(name))) {
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({ ok: false, error: 'Não foi possível localizar todas as fotos.' }, 400)
    }

    const economyClaim = await claimSmartCarouselEconomy(supabase, {
      userId,
      clientRequestId: jobId,
      imageCount: imagePaths.length,
      metadata: {
        primary_provider: 'creatomate',
        openai_model: OPENAI_MARKETING_MODEL,
        tts_model: OPENAI_TTS_MODEL,
        image_count: imagePaths.length,
        has_audio: true,
      },
    })
    executionClaimed = economyClaim.executionClaimed
    if (economyClaim.status === 'insufficient') {
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse(insufficientSmartCarouselTokensResponse(economyClaim), 402)
    }
    if (!economyClaim.executionClaimed) {
      const recovered = await recoverSmartCarouselEconomy(supabase, { userId, clientRequestId: jobId })
      if (recovered.status === 'succeeded' && /^https:\/\//i.test(recovered.videoUrl)) {
        return jsonResponse({
          ok: true, status: 'succeeded', job_id: jobId, video_url: recovered.videoUrl,
          campaign_package: recovered.campaignPackage,
        })
      }
      if (recovered.status === 'failed') {
        return jsonResponse({ ok: true, status: 'failed', job_id: jobId, error: 'Não foi possível criar sua apresentação. Tente novamente.' })
      }
      return jsonResponse({
        ok: true, status: 'processing', job_id: jobId,
        ...(recovered.receipt ? { receipt: recovered.receipt } : {}),
        ...(Object.keys(recovered.campaignPackage).length ? { campaign_package: recovered.campaignPackage } : {}),
      }, 202)
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

    const presentationPlan = await buildPresentationPlan(
      imageUrls,
      ctaUrl,
      answers,
      phone,
      cta,
      openaiApiKey,
      jobId,
    )
    const response = await fetch('https://api.creatomate.com/v2/renders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatomateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(presentationPlan.renderScript),
    })
    const responseBody = await response.json().catch(() => null)
    if (!response.ok) throw new Error('creatomate_start_failed')

    const render = Array.isArray(responseBody) ? responseBody[0] : responseBody
    const renderId = render && typeof render === 'object' ? cleanText((render as JsonRecord).id, 64) : ''
    if (!isUuid(renderId)) {
      throw new Error('creatomate_start_failed')
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
    const campaignPackage = {
      campaigns: presentationPlan.campaigns,
      google_ads: presentationPlan.googleAds,
    }
    await recordSmartCarouselProvider(supabase, {
      userId,
      clientRequestId: jobId,
      renderId,
      receipt,
      campaignPackage,
      telemetry: {
        provider_status: cleanText((render as JsonRecord).status, 32) || 'planned',
        image_count: imagePaths.length,
        duration_seconds: presentationPlan.renderScript.duration,
        width: presentationPlan.renderScript.width,
        height: presentationPlan.renderScript.height,
        fps: presentationPlan.renderScript.frame_rate,
        has_audio: true,
      },
    })
    return jsonResponse({
      ok: true,
      status: cleanText((render as JsonRecord).status, 32) || 'planned',
      job_id: jobId,
      receipt,
      campaign_package: campaignPackage,
    })
  } catch (error) {
    if (executionClaimed) {
      try {
        await settleSmartCarouselEconomy(supabase, {
          userId, clientRequestId: jobId, status: 'failed',
          reason: error instanceof Error ? error.message : 'smart_carousel_create_failed',
        })
      } catch (settlementError) {
        console.warn('[smart-carousel] liquidacao de falha pendente:', cleanText(settlementError instanceof Error ? settlementError.message : settlementError, 160))
      }
    }
    await cleanupJobFiles(supabase, userId, jobId)
    if (error instanceof MarketingOpenAIError && error.publicErrorCode === 'narration_duration_out_of_range') {
      return jsonResponse({ ok: false, error: 'narration_duration_out_of_range' }, 422)
    }
    if (error instanceof Error && error.message === 'creatomate_start_failed') {
      return jsonResponse({ ok: false, error: 'Não foi possível iniciar sua apresentação.' }, 502)
    }
    return jsonResponse({ ok: false, error: 'Não foi possível preparar sua apresentação.' }, 500)
  }
}

async function handleStatus(
  body: JsonRecord,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  creatomateApiKey: string,
) {
  const payload = body.receipt ? await verifyReceipt(creatomateApiKey, body.receipt) : null
  if (body.receipt && (!payload || payload.u !== userId)) {
    return jsonResponse({ ok: false, error: 'Acompanhamento inválido.' }, 401)
  }
  const jobId = payload?.j || cleanText(body.job_id, 64)
  if (!isUuid(jobId)) return jsonResponse({ ok: false, error: 'Acompanhamento inválido.' }, 400)

  const recovered = await recoverSmartCarouselEconomy(supabase, { userId, clientRequestId: jobId })
  if (!recovered.found && !payload) return jsonResponse({ ok: false, error: 'Apresentação não encontrada.' }, 404)
  if (recovered.status === 'succeeded' && /^https:\/\//i.test(recovered.videoUrl)) {
    return jsonResponse({
      ok: true, status: 'succeeded', job_id: jobId, video_url: recovered.videoUrl,
      campaign_package: recovered.campaignPackage,
    })
  }
  if (recovered.status === 'failed' || recovered.status === 'insufficient') {
    return jsonResponse({ ok: true, status: 'failed', job_id: jobId, error: 'Não foi possível criar sua apresentação. Tente novamente.' })
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload && payload.e <= now) {
    if (recovered.found) {
      await settleSmartCarouselEconomy(supabase, {
        userId, clientRequestId: jobId, status: 'failed', reason: 'smart_carousel_receipt_expired',
      })
    }
    await cleanupJobFiles(supabase, userId, jobId)
    return jsonResponse({ ok: false, error: 'O acompanhamento expirou. Tente novamente.' }, 410)
  }

  const renderId = payload?.r || recovered.renderId
  if (!isUuid(renderId)) {
    const providerStartedAt = Date.parse(recovered.providerStartedAt)
    if (recovered.found && Number.isFinite(providerStartedAt) && Date.now() - providerStartedAt > 15 * 60 * 1000) {
      await settleSmartCarouselEconomy(supabase, {
        userId, clientRequestId: jobId, status: 'failed', reason: 'smart_carousel_provider_start_timeout',
      })
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({ ok: true, status: 'failed', job_id: jobId, error: 'Não foi possível criar sua apresentação. Tente novamente.' })
    }
    return jsonResponse({ ok: true, status: 'processing', job_id: jobId })
  }

  try {
    const response = await fetch(`https://api.creatomate.com/v2/renders/${encodeURIComponent(renderId)}`, {
      headers: { Authorization: `Bearer ${creatomateApiKey}` },
    })
    const render = await response.json().catch(() => null) as JsonRecord | null
    if (!response.ok || !render) {
      return jsonResponse({ ok: false, error: 'Não foi possível consultar sua apresentação.' }, 502)
    }

    const status = cleanText(render.status, 32)
    if (status === 'succeeded') {
      const videoUrl = cleanText(render.url, 2048)
      if (!/^https:\/\//i.test(videoUrl)) {
        if (recovered.found) {
          await settleSmartCarouselEconomy(supabase, {
            userId, clientRequestId: jobId, status: 'failed', reason: 'smart_carousel_output_missing',
            telemetry: { provider_status: 'succeeded_without_output' },
          })
        }
        await cleanupJobFiles(supabase, userId, jobId)
        return jsonResponse({ ok: false, error: 'A apresentação foi concluída sem arquivo disponível.' }, 502)
      }
      if (recovered.found) {
        await settleSmartCarouselEconomy(supabase, {
          userId, clientRequestId: jobId, status: 'succeeded', videoUrl,
          telemetry: { provider_status: 'succeeded', deliverable_persisted_before_consumption: true },
        })
      }
      await cleanupJobFiles(supabase, userId, jobId)
      return jsonResponse({
        ok: true, status: 'succeeded', job_id: jobId, video_url: videoUrl,
        campaign_package: recovered.campaignPackage,
      })
    }

    if (status === 'failed') {
      if (recovered.found) {
        await settleSmartCarouselEconomy(supabase, {
          userId, clientRequestId: jobId, status: 'failed', reason: 'smart_carousel_provider_failed',
          telemetry: { provider_status: 'failed' },
        })
      }
      await cleanupJobFiles(supabase, userId, jobId)
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
    const serviceRoleKey = resolveSupabaseAdminCredential().key
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

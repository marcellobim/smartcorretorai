import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startVeoVideo } from '../_shared/veoClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const DEFAULT_MODEL = 'veo-3.1-lite-generate-preview'
const DEFAULT_TOKEN_COST = 500
const VIDEO_BUCKET = 'studio-videos'
const STUDIO_HERO_CTA_LIBRARY_PREFIX = 'system/studio-hero/cta'
const PROMPT_TEST_MODE: 'controlled_narrative' | 'narrative' | 'legacy' = 'controlled_narrative'
const DEFAULT_CREATIVE_PROMPT_MODEL = 'gpt-4o-mini'

type JsonRecord = Record<string, unknown>
type ProfileRow = {
  email?: string | null
  role?: string | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function formatDiagnosticError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
      cause: error.cause instanceof Error
        ? {
          name: error.cause.name,
          message: error.cause.message,
          stack: error.cause.stack || null,
        }
        : error.cause ? String(error.cause) : null,
    }
  }

  return {
    name: 'NonError',
    message: String(error),
    stack: null,
    cause: null,
  }
}

function safeDiagnosticMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 500)
  return String(error || 'unknown_error').slice(0, 500)
}

function logStudioHeroDiagnostic(reqId: string, stage: string, context: Record<string, unknown> = {}) {
  console.info(`[${reqId}] ${stage}`, context)
}

function normalizeText(value: unknown, maxLength = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeTextArray(value: unknown, maxItems = 6, maxLength = 80) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizePromptText(value: unknown, maxLength = 48) {
  if (!value) return ''
  return normalizeText(value, Math.max(maxLength * 2, 120))
    .replace(/m(?:\u00c2)?\u00b2/gi, 'M2')
    .replace(/\u00c3\u00a0|\u00c3\u0080/g, 'A')
    .replace(/\u00c3\u00a1|\u00c3\u0081/g, 'A')
    .replace(/\u00c3\u00a2|\u00c3\u0082/g, 'A')
    .replace(/\u00c3\u00a3|\u00c3\u0083/g, 'A')
    .replace(/\u00c3\u00a7|\u00c3\u2021/g, 'C')
    .replace(/\u00c3\u00a8|\u00c3\u0088/g, 'E')
    .replace(/\u00c3\u00a9|\u00c3\u2030/g, 'E')
    .replace(/\u00c3\u00aa|\u00c3\u0160/g, 'E')
    .replace(/\u00c3\u00ad|\u00c3\u008d/g, 'I')
    .replace(/\u00c3\u00b3|\u00c3\u201c/g, 'O')
    .replace(/\u00c3\u00b4|\u00c3\u201d/g, 'O')
    .replace(/\u00c3\u00b5|\u00c3\u2022/g, 'O')
    .replace(/\u00c3\u00ba|\u00c3\u0161/g, 'U')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ã§/g, 'c')
    .replace(/Ã‡/g, 'C')
    .replace(/[{}]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
}

function cleanStaticText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00e7/g, 'c')
    .replace(/\u00c7/g, 'C')
    .replace(/\u00b2/g, '2')
    .replace(/m2/gi, 'M2')
    .toUpperCase()
    .trim()
}

function buildStaticChampionPrompt(bairro: string, cta: string, dadosImovelText = ''): string {
  const bairroTratado = bairro.split('-')[0].trim()
  const b = cleanStaticText(bairroTratado)
  const c = cleanStaticText(cta)
  const facts = normalizeText(dadosImovelText, 900)

  return `Cinematic real estate advertisement, vertical format.

SCREEN TEXT ONLY:
Opening: ${b}
Closing: ${c}
Do not show any other on-screen text.

VOICEOVER ONLY:
Narrate property facts in Brazilian Portuguese.
Do not display these facts as text on screen.
Do not narrate in English.
Property facts: ${facts}

Professional luxury atmosphere.`
}

function cleanMatrixField(value: unknown, fallback: string, maxLength = 72) {
  const clean = cleanStaticText(normalizeText(value, Math.max(maxLength * 2, 160)))
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

  return clean || fallback
}

function cleanMatrixDisplayText(value: unknown, fallback: string, maxLength = 72) {
  const clean = normalizeText(value, Math.max(maxLength * 2, 160))
    .replace(/[{}]/g, '')
    .replace(/[^\p{L}0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)

  return clean || fallback
}

type StudioHeroCtaFrame = {
  slug: string
  label: string
  fileName: string
  publicPath: string
}

const STUDIO_HERO_CTA_FRAMES: Record<string, StudioHeroCtaFrame> = {
  sell: {
    slug: 'saiba-mais',
    label: 'SAIBA MAIS',
    fileName: 'cta-saiba-mais.png',
    publicPath: '/studio-hero/cta/cta-saiba-mais.png',
  },
  rent: {
    slug: 'agende-sua-visita',
    label: 'AGENDE SUA VISITA',
    fileName: 'cta-agende-sua-visita.png',
    publicPath: '/studio-hero/cta/cta-agende-sua-visita.png',
  },
  property_capture: {
    slug: 'entre-em-contato-agora',
    label: 'ENTRE EM CONTATO AGORA',
    fileName: 'cta-entre-em-contato-agora.png',
    publicPath: '/studio-hero/cta/cta-entre-em-contato-agora.png',
  },
  broker_capture: {
    slug: 'faca-parte-do-nosso-time',
    label: 'FACA PARTE DO NOSSO TIME',
    fileName: 'cta-faca-parte-do-nosso-time.png',
    publicPath: '/studio-hero/cta/cta-faca-parte-do-nosso-time.png',
  },
  fallback: {
    slug: 'aguardo-seu-contato',
    label: 'AGUARDO SEU CONTATO',
    fileName: 'cta-aguardo-seu-contato.png',
    publicPath: '/studio-hero/cta/cta-aguardo-seu-contato.png',
  },
}

function resolveStudioHeroCtaFrame(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>): StudioHeroCtaFrame {
  if (getMatrixProfileGroup(briefing) === 'LANCAMENTO') return STUDIO_HERO_CTA_FRAMES.sell
  if (briefing.objective === 'rent') return STUDIO_HERO_CTA_FRAMES.rent
  if (briefing.objective === 'property_capture') return STUDIO_HERO_CTA_FRAMES.property_capture
  if (briefing.objective === 'broker_capture') return STUDIO_HERO_CTA_FRAMES.broker_capture
  if (briefing.objective === 'sell') return STUDIO_HERO_CTA_FRAMES.sell
  return STUDIO_HERO_CTA_FRAMES.fallback
}

async function downloadStudioHeroCtaFrameBytes(supabase: ReturnType<typeof createClient>, ctaFrame: StudioHeroCtaFrame) {
  const libraryPath = `${STUDIO_HERO_CTA_LIBRARY_PREFIX}/${ctaFrame.fileName}`
  const { data, error } = await supabase.storage.from(VIDEO_BUCKET).download(libraryPath)

  if (error || !data) {
    throw new Error(`cta_frame_library_download_failed:${ctaFrame.fileName}:${error?.message || 'empty_file'}`)
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  const isPng = pngSignature.every((byte, index) => bytes[index] === byte)

  if (!isPng) throw new Error(`cta_frame_invalid_png:${ctaFrame.fileName}`)

  return {
    bytes,
    libraryPath,
  }
}

async function uploadStudioHeroCtaFrame(supabase: ReturnType<typeof createClient>, input: {
  userId: string
  jobId: string
  ctaFrame: StudioHeroCtaFrame
  reqId?: string
  markDiagnosticStage?: (stage: string, context?: Record<string, unknown>) => void
}) {
  const path = `${input.userId}/${input.jobId}/input-2.png`
  const ctaLibraryPath = `${STUDIO_HERO_CTA_LIBRARY_PREFIX}/${input.ctaFrame.fileName}`
  const mark = input.markDiagnosticStage || ((stage: string, context: Record<string, unknown> = {}) => {
    logStudioHeroDiagnostic(input.reqId || 'studioHeroVideo', stage, context)
  })

  mark('LOG 5 - abrindo arquivo CTA oficial', {
    selectedCta: input.ctaFrame.slug,
    ctaFileName: input.ctaFrame.fileName,
    bucket: VIDEO_BUCKET,
    libraryPath: ctaLibraryPath,
    absolutePath: `ss://${VIDEO_BUCKET}/${ctaLibraryPath}`,
  })

  const { bytes, libraryPath } = await downloadStudioHeroCtaFrameBytes(supabase, input.ctaFrame)
  mark('LOG 5 OK - arquivo CTA oficial carregado', {
    selectedCta: input.ctaFrame.slug,
    ctaFileName: input.ctaFrame.fileName,
    bucket: VIDEO_BUCKET,
    libraryPath,
    byteLength: bytes.byteLength,
  })

  mark('LOG 6 - upload do CTA como lastFrame', {
    selectedCta: input.ctaFrame.slug,
    ctaFileName: input.ctaFrame.fileName,
    bucket: VIDEO_BUCKET,
    storagePath: path,
    contentType: 'image/png',
  })

  const { error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(path, new Blob([bytes], { type: 'image/png' }), {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw new Error(`cta_frame_upload_failed:${error.message}`)

  mark('LOG 6 OK - CTA oficial enviado como lastFrame', {
    selectedCta: input.ctaFrame.slug,
    label: input.ctaFrame.label,
    absolutePath: `ss://${VIDEO_BUCKET}/${libraryPath}`,
    fileName: input.ctaFrame.fileName,
    libraryPath,
    path,
    publicPath: input.ctaFrame.publicPath,
    byteLength: bytes.byteLength,
  })

  return path
}

type StudioHeroMatrixId =
  | 'SELL_MCMV_V1'
  | 'SELL_PRONTOS_V1'
  | 'SELL_ALTO_PADRAO_V1'
  | 'SELL_LANCAMENTO_V1'
  | 'RENT_MCMV_V1'
  | 'RENT_PRONTOS_V1'
  | 'RENT_ALTO_PADRAO_V1'
  | 'CAPTURE_PROPERTY_V1'
  | 'CAPTURE_AGENT_V1'
  | 'FREE_AI_V1'

type StudioHeroMatrixDefinition = {
  marketingStyle: string
  commercialObjective: string
  targetAudience: string
  emotionalTone: string
  visualMood: string
  allowedHighlights: string[]
  allowedCtas: string[]
  propertyCategory?: string
}

const STUDIO_HERO_MATRIX_TEMPLATE = `Create a premium cinematic real estate commercial.
Vertical format 9:16.
Duration: 8 seconds.

Use only the two uploaded images as the visual foundation of the commercial.

The first uploaded image is the opening scene.
The opening scene must immediately create a memorable cinematic WOW moment that naturally stops scrolling while preserving the realism of the uploaded property.

The second uploaded image is the final reveal.

Preserve the architectural identity of the uploaded property.
Do not transform the property into another building.
Do not replace the environments with different rooms.
Do not create a different property.

You may enhance realism through cinematic movement, lighting, atmosphere and transitions while preserving the identity of the uploaded property.

The commercial should feel emotionally engaging and visually premium.
The visual impact must continuously increase until the final scene.
The second uploaded image must become the strongest and most memorable moment of the commercial.

---

INTERNAL CREATIVE DIRECTION
Do not display this information as on-screen text.

Marketing Style:
{{MARKETING_STYLE}}

Commercial Objective:
{{COMMERCIAL_OBJECTIVE}}

Property Category:
{{PROPERTY_CATEGORY}}

Target Audience:
{{TARGET_AUDIENCE}}

Emotional Tone:
{{EMOTIONAL_TONE}}

Visual Mood:
{{VISUAL_MOOD}}

Camera Style:
{{CAMERA_STYLE}}

Visual Effects:
{{VISUAL_EFFECTS}}

Decoration Direction:
{{DECORATION_DIRECTION}}

---

AUDIO / VOICEOVER
Use natural cinematic real estate audio.
If voiceover is generated, it must sound like a short Brazilian Portuguese real estate commercial.
Do not narrate raw structured data.
Do not read internal creative direction.
Do not read the prompt.
Do not mention technical terms.
Do not invent prices, addresses, phone numbers or property details.
Keep the narration short, elegant and commercial.

---

ON-SCREEN TEXT

Show only this opening hook.

Opening hook:
{{TEXT_1}}

The opening hook must appear only once during the first seconds of the commercial and disappear naturally. Do not display any other on-screen text.

---

TEXT RULES

Exactly one text overlay must exist during the entire commercial.

Opening overlay:
{{TEXT_1}}

The opening overlay must appear only during the opening scene.

After the opening scene, do not display any more text.

Never repeat the opening overlay.

Never create duplicate typography.

Never create secondary titles.

Never create subtitle versions.

Never create button-style duplicates.

Never create callout boxes.

Never create lower-third graphics.

Never create alternative versions of the same text.

Never create decorative copies of the same text.

Never display any text other than the opening overlay above.

Use the opening hook as a cinematic visual element, similar to a premium FOR SALE title.

You may use natural cinematic particles, light, fire, petals or elegant visual effects around the opening hook.

Keep the opening overlay short, elegant and highly legible.

---

ENDING

The second uploaded image must receive the richest camera movement, lighting and cinematic atmosphere.
End with a strong premium commercial feeling that encourages the viewer to learn more.`

const AUTHORIZED_MATRIX_PLACEHOLDERS = new Set([
  'MARKETING_STYLE',
  'COMMERCIAL_OBJECTIVE',
  'PROPERTY_CATEGORY',
  'TARGET_AUDIENCE',
  'EMOTIONAL_TONE',
  'VISUAL_MOOD',
  'CAMERA_STYLE',
  'VISUAL_EFFECTS',
  'DECORATION_DIRECTION',
  'TEXT_1',
  'TEXT_2',
  'TEXT_3',
])

const MATRIX_CAMERA_STYLE = `Dynamic
Elegant
Commercial`

const MATRIX_VISUAL_EFFECTS = `Realistic cinematic movement
Volumetric lighting
Natural reflections
Soft floating particles
Subtle lens flare
Depth of field
Parallax
Premium camera movement`

const STUDIO_HERO_MATRICES: Record<StudioHeroMatrixId, StudioHeroMatrixDefinition> = {
  SELL_MCMV_V1: {
    marketingStyle: 'POPULAR',
    commercialObjective: 'SELL',
    targetAudience: `First-time buyers
Young families
Value-conscious buyers`,
    emotionalTone: `Optimistic
Friendly
Inviting`,
    visualMood: `Bright
Modern
Welcoming`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    allowedCtas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_PRONTOS_V1: {
    marketingStyle: 'READY HOMES',
    commercialObjective: 'SELL',
    targetAudience: `Home buyers
Families
People looking for immediate occupancy`,
    emotionalTone: `Comfortable
Confident
Welcoming`,
    visualMood: `Warm
Modern
Comfortable`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    allowedCtas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_ALTO_PADRAO_V1: {
    marketingStyle: 'HIGH STANDARD',
    commercialObjective: 'SELL',
    targetAudience: `Families seeking comfort
Professionals
Discerning buyers`,
    emotionalTone: `Elegant
Sophisticated
Exclusive`,
    visualMood: `Premium
Refined
Architectural`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    allowedCtas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  SELL_LANCAMENTO_V1: {
    marketingStyle: 'launch',
    commercialObjective: 'SELL',
    targetAudience: `Buyers looking for new developments
Investors
People planning a future move`,
    emotionalTone: `Opportunity
Anticipation
Future value`,
    visualMood: `Modern
Aspirational
Promising`,
    allowedHighlights: ['LANCAMENTO', 'EXCLUSIVO', 'OPORTUNIDADE'],
    allowedCtas: ['SAIBA MAIS', 'AGENDE SUA VISITA', 'ENTRE EM CONTATO'],
  },
  RENT_MCMV_V1: {
    marketingStyle: 'POPULAR',
    commercialObjective: 'RENT',
    targetAudience: `Young families
Couples
People seeking affordability`,
    emotionalTone: `Friendly
Practical
Welcoming`,
    visualMood: `Bright
Modern
Comfortable`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  RENT_PRONTOS_V1: {
    marketingStyle: 'READY HOMES',
    commercialObjective: 'RENT',
    targetAudience: `Families
Professionals
People looking for immediate occupancy`,
    emotionalTone: `Comfortable
Modern
Welcoming`,
    visualMood: `Warm
Modern
Comfortable`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  RENT_ALTO_PADRAO_V1: {
    marketingStyle: 'HIGH STANDARD',
    commercialObjective: 'RENT',
    targetAudience: `Executives
Families
Professionals`,
    emotionalTone: `Elegant
Confident
Exclusive`,
    visualMood: `Premium
Refined
Comfortable`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'DISPONIVEL'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  CAPTURE_PROPERTY_V1: {
    marketingStyle: 'PROPERTY CAPTURE',
    commercialObjective: 'CAPTURE PROPERTY',
    propertyCategory: 'REAL ESTATE PROPERTY',
    targetAudience: `Property owners
Homeowners
Real estate investors`,
    emotionalTone: `Professional
Trustworthy
Confident`,
    visualMood: `Modern
Professional
Clean`,
    allowedHighlights: ['EXCLUSIVO', 'QUER VENDER', 'QUER ALUGAR'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  CAPTURE_AGENT_V1: {
    marketingStyle: 'RECRUITMENT',
    commercialObjective: 'RECRUIT AGENTS',
    propertyCategory: 'REAL ESTATE CAREER',
    targetAudience: `Real estate agents
Brokers
Real estate professionals`,
    emotionalTone: `Motivational
Professional
Confident`,
    visualMood: `Modern
Dynamic
Professional`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'CONTRATAMOS'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
  FREE_AI_V1: {
    marketingStyle: 'FREE CREATIVE REAL ESTATE COMMERCIAL',
    commercialObjective: 'SELL',
    propertyCategory: 'REAL ESTATE CONCEPT',
    targetAudience: `Real estate audience
Potential buyers
People interested in the property concept`,
    emotionalTone: `Creative
Inviting
Commercial`,
    visualMood: `Cinematic
Modern
Visually engaging`,
    allowedHighlights: ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'],
    allowedCtas: ['SAIBA MAIS', 'ENTRE EM CONTATO'],
  },
}

function getMatrixProfileKey(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const source = [
    briefing.objective,
    briefing.objectiveLabel,
    briefing.propertyType,
    briefing.profile,
    briefing.stage,
    briefing.offer,
    briefing.finalFeatures,
    ...briefing.differentials,
  ].join(' ').toUpperCase()

  if (/CAPTACAO DE CORRETORES|BROKER|CORRETOR|CAPTADORES|PERITOS|GERENTES|DIRETORES/.test(source)) return 'broker_capture'
  if (/CAPTACAO DE IMOVEIS|CAPTURE PROPERTY|PROPRIETARIO/.test(source)) return 'property_capture'
  if (/LOCAC|ALUG|RENT/.test(source)) return 'rent'
  if (/COMERCIAL|SALA|LAJE|GALPAO|LOJA|OFFICE|FLOOR/.test(source)) return 'commercial'
  if (/MCMV|ECONOM|POPULAR|SUBSID/.test(source)) return 'popular'
  if (/LUXO|LUXURY/.test(source)) return 'luxury'
  if (/ALTO PADRAO|HIGH STANDARD|SOFISTIC|DESIGN/.test(source)) return 'high_standard'
  return 'middle_standard'
}

function getMatrixProfileGroup(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const source = cleanMatrixField(`${briefing.profile} ${briefing.stage}`, '', 80)
  if (/MCMV|ECONOMICO|POPULAR/.test(source)) return 'MCMV'
  if (/LANCAMENTO|PRE LANCAMENTO|OBRAS|FUTURO/.test(source)) return 'LANCAMENTO'
  if (/ALTO PADRAO|LUXO|LUXURY|HIGH STANDARD/.test(source)) return 'ALTO_PADRAO'
  return 'PRONTOS'
}

function selectStudioHeroMatrix(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>): StudioHeroMatrixId {
  if (briefing.creativeMode === 'free_ai') return 'FREE_AI_V1'
  if (briefing.objective === 'property_capture') return 'CAPTURE_PROPERTY_V1'
  if (briefing.objective === 'broker_capture') return 'CAPTURE_AGENT_V1'

  const group = getMatrixProfileGroup(briefing)
  if (briefing.objective === 'rent') {
    if (group === 'MCMV') return 'RENT_MCMV_V1'
    if (group === 'ALTO_PADRAO') return 'RENT_ALTO_PADRAO_V1'
    return 'RENT_PRONTOS_V1'
  }

  if (group === 'MCMV') return 'SELL_MCMV_V1'
  if (group === 'LANCAMENTO') return 'SELL_LANCAMENTO_V1'
  if (group === 'ALTO_PADRAO') return 'SELL_ALTO_PADRAO_V1'
  return 'SELL_PRONTOS_V1'
}

function normalizePropertyCategory(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>, matrixId: StudioHeroMatrixId) {
  const definition = STUDIO_HERO_MATRICES[matrixId]
  if (definition.propertyCategory) return definition.propertyCategory

  const rawPropertyType = cleanMatrixField(briefing.propertyType, 'PROPERTY', 40)
  const propertyType = (() => {
    if (/APARTAMENTO/.test(rawPropertyType)) return 'APARTMENT'
    if (/CASA/.test(rawPropertyType) && /CONDOMINIO/.test(cleanMatrixField(briefing.houseLocationType, '', 40))) return 'CONDOMINIUM HOME'
    if (/CASA/.test(rawPropertyType)) return 'HOUSE'
    if (/SALA/.test(rawPropertyType)) return 'COMMERCIAL OFFICE'
    if (/LAJE/.test(rawPropertyType)) return 'COMMERCIAL FLOOR'
    if (/TERRENO/.test(rawPropertyType)) return 'LAND'
    if (/LOJA/.test(rawPropertyType)) return 'COMMERCIAL STORE'
    if (/GALPAO/.test(rawPropertyType)) return 'COMMERCIAL WAREHOUSE'
    if (/COMERCIAL/.test(rawPropertyType)) return 'COMMERCIAL PROPERTY'
    return rawPropertyType
  })()

  if (propertyType.startsWith('COMMERCIAL')) return propertyType

  const group = getMatrixProfileGroup(briefing)
  if (group === 'MCMV') return `POPULAR ${propertyType}`
  if (group === 'LANCAMENTO') return `LAUNCH ${propertyType}`
  if (group === 'ALTO_PADRAO') return `HIGH STANDARD ${propertyType}`
  if (group === 'PRONTOS') return `READY ${propertyType}`
  return propertyType
}

function getAllowedHighlights(matrixId: StudioHeroMatrixId) {
  return STUDIO_HERO_MATRICES[matrixId].allowedHighlights
}

function getAllowedCtas(matrixId: StudioHeroMatrixId) {
  return STUDIO_HERO_MATRICES[matrixId].allowedCtas
}

function pickAllowedMatrixValue(value: unknown, allowed: string[], fallback: string) {
  const clean = cleanMatrixField(value, '', 48)
  const match = allowed.find((item) => cleanMatrixField(item, '', 48) === clean)
  return match || fallback
}

function normalizeText1(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>, fallback: string) {
  const district = cleanMatrixDisplayText(briefing.district, '', 36)
  const city = cleanMatrixDisplayText(briefing.city, '', 36)
  const fallbackLocation = cleanMatrixDisplayText(fallback, '', 48)
  if (district) return district
  if (city) return city
  if (fallbackLocation) return fallbackLocation.replace(/\s+(SP|RJ|MG|PR|SC|RS|BA|PE|CE|GO|DF|ES|MT|MS)$/i, '').trim()
  return 'OPORTUNIDADE'
}

function getOpeningHookText(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const matrixId = selectStudioHeroMatrix(briefing)
  const allowedHighlights = getAllowedHighlights(matrixId)
  const pick = (options: string[]) => {
    const chosenValues = [
      briefing.finalFeatures,
      ...briefing.differentials,
      briefing.offer,
    ].map((value) => cleanMatrixField(value, '', 48)).filter(Boolean)
    const match = options.find((option) => chosenValues.includes(cleanMatrixField(option, '', 48)))
    return cleanStaticText(match || options[0])
  }

  return pick(allowedHighlights.length ? allowedHighlights : ['EXCLUSIVO', 'OPORTUNIDADE', 'LANCAMENTO'])
}

function resolveDecorationDirection(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const policy = cleanMatrixField(briefing.decorationPolicy, '', 120)

  if (/PRESERVAR/.test(policy)) {
    return 'Preserve the existing furniture, decoration and visual condition of the uploaded images. Do not add new furniture or decoration.'
  }

  if (/DECORACAO LEVE|SUGERIR/.test(policy)) {
    return 'If the uploaded images are empty or minimally furnished, you may suggest subtle, realistic and tasteful decoration while preserving the property identity.'
  }

  if (/MELHORAR LIVREMENTE|AMBIENTACAO/.test(policy)) {
    return 'You may enhance the visual staging with realistic, tasteful and commercially appealing decoration, while preserving the architectural identity of the property.'
  }

  return 'Preserve the existing furniture, decoration and visual condition of the uploaded images. Do not add new furniture or decoration.'
}

function renderStudioHeroMatrix(template: string, values: Record<string, string>) {
  const placeholders = [...template.matchAll(/{{([A-Z0-9_]+)}}/g)].map((match) => match[1])
  const unknown = placeholders.filter((name) => !AUTHORIZED_MATRIX_PLACEHOLDERS.has(name))
  if (unknown.length) throw new Error(`matrix_unknown_placeholder:${unknown.join(',')}`)

  let rendered = template
  for (const name of AUTHORIZED_MATRIX_PLACEHOLDERS) {
    const value = values[name]
    if (!value || !String(value).trim()) throw new Error(`matrix_missing_placeholder:${name}`)
    rendered = rendered.replaceAll(`{{${name}}}`, value)
  }

  const leftovers = [...rendered.matchAll(/{{([^}]+)}}/g)].map((match) => match[1])
  if (leftovers.length) throw new Error(`matrix_unresolved_placeholder:${leftovers.join(',')}`)
  return rendered
}

function buildStudioHeroMatrixPrompt(
  briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>,
  metadataChat: { bairro: string; caracteristica: string; cta: string },
) {
  const matrixId = selectStudioHeroMatrix(briefing)
  const matrix = STUDIO_HERO_MATRICES[matrixId]
  const text1 = normalizeText1(briefing, metadataChat.bairro)
  const openingHook = getOpeningHookText(briefing)
  const text2 = pickAllowedMatrixValue(
    briefing.differentials[0] || briefing.finalFeatures || metadataChat.caracteristica,
    getAllowedHighlights(matrixId),
    getAllowedHighlights(matrixId)[0] || 'OPORTUNIDADE',
  )
  const text3 = pickAllowedMatrixValue(metadataChat.cta || briefing.cta, getAllowedCtas(matrixId), getAllowedCtas(matrixId)[0] || 'SAIBA MAIS')

  const matrixPrompt = renderStudioHeroMatrix(STUDIO_HERO_MATRIX_TEMPLATE, {
    MARKETING_STYLE: matrix.marketingStyle,
    COMMERCIAL_OBJECTIVE: matrix.commercialObjective,
    PROPERTY_CATEGORY: normalizePropertyCategory(briefing, matrixId),
    TARGET_AUDIENCE: matrix.targetAudience,
    EMOTIONAL_TONE: matrix.emotionalTone,
    VISUAL_MOOD: matrix.visualMood,
    CAMERA_STYLE: MATRIX_CAMERA_STYLE,
    VISUAL_EFFECTS: MATRIX_VISUAL_EFFECTS,
    DECORATION_DIRECTION: resolveDecorationDirection(briefing),
    TEXT_1: openingHook,
    TEXT_2: text2,
    TEXT_3: text3,
  })

  const visualPrompt = removeMatrixAudioSection(matrixPrompt)
  const voiceoverPrompt = buildMatrixVoiceoverPrompt(matrixId, text1)
  const prompt = buildProviderPromptWithVoiceover(visualPrompt, voiceoverPrompt)

  return {
    prompt,
    visualPrompt,
    voiceoverPrompt,
    profileKey: matrixId,
    matrixId,
    visibleTexts: [openingHook],
  }
}

function compactJsonRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false
      if (typeof value === 'string') return value.trim().length > 0
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
      return true
    }),
  )
}

function buildStudioHeroJsonPrompt(payload: {
  briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>
  metadataChat: { bairro: string; caracteristica: string; oferta: string; cta: string }
  ctaFrame?: StudioHeroCtaFrame | null
}) {
  const { briefing, metadataChat, ctaFrame } = payload
  const isFreeAi = briefing.creativeMode === 'free_ai'
  const matrixId = selectStudioHeroMatrix(briefing)
  const matrix = STUDIO_HERO_MATRICES[matrixId]
  const heroWord = getOpeningHookText(briefing)
  const isRentObjective = briefing.objective === 'rent' || /LOCAC|ALUG/.test(`${briefing.objective} ${briefing.objectiveLabel} ${briefing.offer}`.toUpperCase())
  const isLaunchProfile = getMatrixProfileGroup(briefing) === 'LANCAMENTO'
  const launchFactRules = isLaunchProfile
    ? [
      'sell the opportunity, not immediate occupancy',
      'do not describe the unit as ready to move in',
      'never say pronto para morar unless explicitly provided by the user',
      'never say totalmente mobiliado unless explicitly provided by the user',
      'never say mobiliado unless explicitly provided by the user',
      'never say disponivel imediatamente unless explicitly provided by the user',
      'never say entregue unless explicitly provided by the user',
      'never say pronto unless explicitly provided by the user',
      'never say visite hoje este apartamento pronto',
      'use launch-oriented narration: novo empreendimento, oportunidade, valorizacao, projeto pensado para morar ou investir, condicoes e detalhes sob consulta',
    ]
    : []
  const propertyContext = compactJsonRecord({
    objective: briefing.objective,
    objective_label: briefing.objectiveLabel,
    property_type: briefing.propertyType,
    profile: briefing.profile,
    stage: briefing.stage,
    uf: briefing.uf,
    city: briefing.city,
    district: briefing.district,
    location: briefing.location,
    normalized_location: briefing.normalizedLocation,
    main_feature: metadataChat.caracteristica,
    offer: metadataChat.oferta,
    differentials: briefing.differentials,
    final_features: briefing.finalFeatures,
    furnishing_status: briefing.furnishingStatus,
    decoration_policy: briefing.decorationPolicy,
    visual_style: briefing.visualStyle,
    atmosphere: briefing.atmosphere,
    pace: briefing.pace,
    creative_freedom: briefing.creativeFreedom,
    bedrooms: briefing.bedrooms,
    suites: briefing.suites,
    parking: briefing.parking,
  })

  const promptPayload = {
    task: 'real_estate_cinematic_video',
    video: {
      duration_seconds: 8,
      aspect_ratio: '9:16',
      style: 'ultra_photorealistic_cinematic_real_estate_commercial',
    },
    input_engine: isFreeAi
      ? {
        mode: 'text_to_video',
        opening_frame: 'generated_by_ai_from_briefing',
        ending_frame: 'generated_by_ai_from_briefing',
        frame_policy: 'create_the_full_commercial_from_the_structured_briefing_without_uploaded_images',
      }
      : {
        opening_frame: 'first_uploaded_image',
        ending_frame: 'system_fixed_cta_image',
        frame_policy: 'use_the_uploaded_property_photo_as_the_visual_basis_and_end_on_the_provided_CTA_frame',
      },
    marketing_engine: {
      objective: briefing.objective || 'sell_or_rent_property',
      objective_label: briefing.objectiveLabel || briefing.objective,
      purpose: briefing.objective || 'sell_or_rent_property',
      marketing_style: isLaunchProfile ? 'launch' : matrix.marketingStyle || 'real_estate_commercial',
      launch_property_marketing: isLaunchProfile,
      property_category: normalizePropertyCategory(briefing, matrixId),
      target_audience: matrix.targetAudience || 'property_buyers_or_renters',
      emotional_goal: isLaunchProfile
        ? 'create anticipation, opportunity perception, future value and curiosity'
        : matrix.emotionalTone || 'create desire, trust and curiosity',
      commercial_goal: 'make_the_viewer_stop_scrolling_and_want_to_know_more',
      launch_strategy: isLaunchProfile ? 'sell the opportunity, not immediate occupancy' : undefined,
    },
    property_engine: propertyContext,
    text_engine: {
      enabled: true,
      hero_word_only: true,
      hero_word: {
        value: heroWord,
        time_range: '0.5s-2.5s',
        show_once: true,
        style: 'cinematic_wow_reveal',
        animation: [
          'premium_material_formation',
          'subtle_light_burst',
          'elegant_particle_emergence',
          'brief_hold_then_fade_out',
        ],
      },
      rules: [
        'show only one marketing word in the entire video',
        'never repeat the hero word',
        'never create additional on-screen text',
        ...(isFreeAi
          ? ['do not create visual CTA text in the generated video']
          : [
            'never create CTA text',
            'the final CTA is already present in the provided lastFrame image',
          ]),
      ],
      forbidden: [
        'duplicate text',
        'extra text',
        'A VENDA',
        'SAIBA MAIS generated by Veo',
        'overlapping text',
        'misspelled text',
        'invented text',
      ],
    },
    fact_engine: {
      rules: [
        'use only facts explicitly provided by the user',
        'never invent bedrooms, suites or parking spaces',
        'if bedrooms, suites or parking are empty, omit them completely',
        'never say furnished unless the user provided this information',
        'never say ready to move in unless the user provided this information',
        'never invent amenities',
        'never invent property features',
        'if information is missing, omit it',
        ...(isRentObjective ? [
          'this is a rental commercial, not a sale commercial',
          'prioritize rental language: disponivel para locacao, disponivel para aluguel, ideal para quem procura, alugue, locacao',
          'avoid sale language: compre, invista, lancamento, casa propria, realize o sonho da compra',
          'never imply purchase or ownership transfer',
        ] : []),
        ...launchFactRules,
      ],
    },
    cta_frame_engine: isFreeAi
      ? {
        enabled: false,
        source: 'none',
        instruction: 'no system CTA lastFrame is provided in free AI mode',
      }
      : {
        enabled: true,
        source: 'system_fixed_cta_image',
        role: 'lastFrame',
        selected_cta_slug: ctaFrame?.slug || '',
        selected_cta_public_path: ctaFrame?.publicPath || '',
        selected_cta_text: ctaFrame?.label || '',
        instruction: 'the video must naturally end on the provided CTA image',
        rules: [
          'do not modify the CTA text',
          'do not rewrite the CTA',
          'do not add extra words to the CTA',
          'keep the final CTA frame clean and readable',
        ],
      },
    audio_engine: {
      music: 'luxury_cinematic',
      voiceover_language: 'pt-BR',
      voiceover_style: 'short_elegant_brazilian_portuguese_real_estate_commercial',
      voiceover_content_policy: 'narrate_property_facts_naturally_without_reading_raw_structured_data',
      rental_voiceover_policy: isRentObjective
        ? 'make it clear this is available for rent or lease; never use purchase-oriented narration'
        : undefined,
      voiceover_tone: isLaunchProfile
        ? [
          'novo empreendimento',
          'oportunidade',
          'valorizacao',
          'projeto pensado para morar ou investir',
          'condicoes e detalhes sob consulta',
        ]
        : undefined,
      effects: [
        'soft_bells',
        'ambient_air',
        'subtle_whoosh',
      ],
    },
    camera_engine: {
      opening_camera: [
        'slow_cinematic_dolly_forward',
        'subtle_parallax',
        'realistic_camera_motion',
      ],
      transition_camera: [
        isFreeAi
          ? 'smooth_continuous_transition_between_ai_generated_real_estate_scenes'
          : 'smooth_continuous_transition_from_property_photo_to_final_CTA_frame',
      ],
      ending_camera: [
        isFreeAi ? 'strong_cinematic_final_reveal' : 'clean_final_brand_like_CTA_reveal',
        'subtle_motion_until_the_last_frame',
        'premium_final_closure',
      ],
      hero_shot: isFreeAi
        ? 'ai_generated_real_estate_commercial_scene_based_on_the_briefing'
        : 'uploaded_property_photo_as_the_main_cinematic_visual',
    },
    motion_engine: {
      movement_rules: [
        'continuous_cinematic_motion',
        'avoid_static_slideshow_feeling',
        'preserve_realistic_depth_and_scale',
        isFreeAi
          ? 'use_smooth_motion_between_generated_real_estate_scenes'
          : 'use_smooth_motion_from_the_property_photo_into_the_final_CTA_frame',
      ],
      transition_style: 'premium_real_estate_cinematic_transition',
      ending_motion: isFreeAi
        ? 'finish_with_a_strong_cinematic_final_scene'
        : 'settle_naturally_on_the_fixed_CTA_frame_without_rewriting_it',
    },
    lighting_engine: {
      style: [
        'natural_golden_hour_light',
        'soft_volumetric_light',
        'realistic_reflections',
        'high_dynamic_range',
        'premium_color_grading',
      ],
    },
    atmosphere_engine: [
      'floating_dust_particles',
      'natural_depth_of_field',
      'premium_real_estate_atmosphere',
    ],
    physics_engine: {
      must_preserve: [
        'architecture',
        'layout',
        'furniture',
        'materials',
        'colors',
        'windows',
        'doors',
        'proportions',
        'real_property_identity',
      ],
      motion_physics: [
        'realistic_camera_movement',
        'no_geometry_warping',
        'no_object_deformation',
        'no_unrealistic_scale_changes',
      ],
    },
    render_engine: {
      format: 'vertical_social_commercial',
      aspect_ratio: '9:16',
      duration_seconds: 8,
      resolution: '720p',
      output_feeling: 'finished_advertising_video_for_reels_stories_and_whatsapp',
    },
    priority_engine: isFreeAi
      ? [
        'Create the full commercial from the structured briefing',
        'Use only one opening hero word as on-screen text generated by Veo',
        'Do not invent facts not provided by the user',
        'Create real cinematic camera movement',
        'Finish with the strongest emotional real estate scene',
      ]
      : [
        'Preserve the uploaded property photo',
        'Use only one opening hero word as on-screen text generated by Veo',
        'Do not create CTA text because the final CTA already exists in lastFrame',
        'Create real cinematic camera movement from the uploaded image',
        'Naturally end on the fixed CTA lastFrame',
      ],
    forbidden_engine: {
      forbidden: [
        'invent_rooms',
        'invent_objects',
        'change_architecture',
        'change_furniture',
        'add_people',
        'add_animals',
        'add_logos',
        'add_watermarks',
        'add_interface_elements',
        'add_random_text',
        'morph_geometry',
        'deform_objects',
        'hallucinations',
        'duplicate_text',
        'repeated_text',
        'overlapping_text',
        'stacked_text',
        'invented_text',
        'misspelled_text',
        'extra_words',
        'two_texts_visible_at_once',
        'generated_CTA_text',
        'altered_CTA_frame_text',
      ],
    },
    ending: isFreeAi
      ? {
        final_frame: 'ai_generated_final_scene',
        priority: 'strong_memorable_emotional_closure',
        instruction: 'the video must end with a polished cinematic real estate closing scene without showing extra text',
      }
      : {
        final_frame: 'system_fixed_cta_image',
        priority: 'clean_readable_professional_CTA_closure',
        instruction: 'the video must end on the provided lastFrame CTA image without rewriting or duplicating its text',
      },
  }

  const prompt = JSON.stringify(promptPayload, null, 2)
  return {
    prompt,
    profileKey: 'json_structured_prompt',
    visibleTexts: [heroWord].filter(Boolean),
  }
}

function resolveStudioHeroPromptMode(value: unknown) {
  const mode = normalizeText(value, 40).toLowerCase()
  if (!mode || mode === 'classic' || mode === 'matrix_v1') return 'classic'
  return mode
}

function buildVoiceoverFactsText(values: unknown[]) {
  return values
    .map((value) => normalizeText(value, 120))
    .filter(Boolean)
    .join('. ')
    .slice(0, 900)
}

function removeMatrixAudioSection(prompt: string) {
  return prompt
    .replace(/\n---\n\nAUDIO \/ VOICEOVER[\s\S]*?\n---\n\nON-SCREEN TEXT/, '\n---\n\nON-SCREEN TEXT')
    .trim()
}

function buildMatrixVoiceoverPrompt(matrixId: StudioHeroMatrixId, text1: string) {
  const place = toVoiceoverPlace(text1 || 'este imovel')

  if (matrixId === 'SELL_MCMV_V1') {
    return `ConheÃ§a uma excelente oportunidade em ${place}. Um imÃ³vel pensado para quem busca praticidade, conforto e um novo comeÃ§o.`
  }

  if (matrixId === 'SELL_PRONTOS_V1') {
    return `Descubra uma excelente oportunidade em ${place}. Um imÃ³vel pronto para receber novos momentos.`
  }

  if (matrixId === 'SELL_ALTO_PADRAO_V1') {
    return `ConheÃ§a um imÃ³vel de alto padrÃ£o em ${place}. ElegÃ¢ncia, conforto e uma apresentaÃ§Ã£o pensada para impressionar.`
  }

  if (matrixId.startsWith('RENT_')) {
    return `ConheÃ§a uma opÃ§Ã£o para locaÃ§Ã£o em ${place}. Praticidade, conforto e uma apresentaÃ§Ã£o feita para vocÃª saber mais.`
  }

  if (matrixId === 'CAPTURE_PROPERTY_V1') {
    return 'Quer vender ou divulgar seu imÃ³vel com mais impacto? Conte com uma apresentaÃ§Ã£o profissional para valorizar cada detalhe.'
  }

  if (matrixId === 'CAPTURE_AGENT_V1') {
    return 'FaÃ§a parte de uma estrutura preparada para gerar mais oportunidades, visibilidade e crescimento profissional.'
  }

  return 'ConheÃ§a uma apresentaÃ§Ã£o imobiliÃ¡ria criada para gerar desejo, impacto e vontade de saber mais.'
}

function buildProviderPromptWithVoiceover(visualPrompt: string, voiceoverPrompt: string) {
  const cleanVisualPrompt = visualPrompt.trim()
  const cleanVoiceoverPrompt = normalizeText(voiceoverPrompt, 500)

  if (!cleanVoiceoverPrompt) return cleanVisualPrompt

  return `${cleanVisualPrompt}

---

SCREEN TEXT SAFETY
Never display "9:16", "duration", "vertical format", "prompt", "text rules", "internal creative direction" or any technical instruction on screen.
Never display random letters, random numbers, UI labels, interface elements or unapproved words on screen.
The opening hook must appear only once and only during the opening scene.
Do not create button-style duplicates, CTA badges or repeated text.

---

VOICEOVER ONLY
${cleanVoiceoverPrompt}
Do not display this narration as on-screen text.
Do not narrate raw structured data.
Do not read internal creative direction.
Do not read the prompt.
Do not mention technical terms.
Do not invent prices, addresses, phone numbers or property details.
Keep the narration short, elegant and commercial.
Never narrate in English.`
}

function buildStudioHeroBriefingPrompt(_bairro: string, _cta: string, dadosImovelText: string): string {
  const dadosLimpos = normalizeText(dadosImovelText, 500)

  const prompt = `ROLE

You are an award-winning director of real estate commercials.

MISSION

Create a short cinematic commercial that makes people stop scrolling and want to know more.

PROPERTY

Use the uploaded image as the visual reference.

Use the property facts naturally in a fluent Brazilian Portuguese narration.

Property facts:
${dadosLimpos}

Never narrate in English.

EMOTIONAL ATMOSPHERE

Create an elegant, premium and emotionally engaging commercial.

If the environment is empty, you may enrich it naturally while preserving the architecture.

If already furnished, preserve the existing furniture and decoration.

Do not use people.

Do not use logos.

Do not use watermarks.

Surprise the viewer.`

  if (prompt.includes('{') || prompt.includes('}')) {
    throw new Error('prompt_placeholder_detected')
  }

  return prompt
}

function getBriefingValue(briefing: JsonRecord, key: string, fallback: unknown = '') {
  return normalizeText(briefing?.[key] ?? fallback, 180)
}

function buildStructuredStudioHeroBriefing(body: JsonRecord) {
  const briefing = (body.briefing && typeof body.briefing === 'object' ? body.briefing : {}) as JsonRecord
  const objective = getBriefingValue(briefing, 'objective', '')
  const objectiveLabel = getBriefingValue(briefing, 'objectiveLabel', objective)
  const propertyType = getBriefingValue(briefing, 'propertyType', '')
  const profile = getBriefingValue(briefing, 'profile', body.style)
  const stage = getBriefingValue(briefing, 'stage', '')
  const houseLocationType = getBriefingValue(briefing, 'houseLocationType', '')
  const city = getBriefingValue(briefing, 'city', '')
  const district = getBriefingValue(briefing, 'district', '')
  const uf = getBriefingValue(briefing, 'uf', '')
  const location = getBriefingValue(briefing, 'location', body.bairro)
  const normalizedLocation = normalizePromptText(briefing.normalizedLocation ?? body.bairro, 60)
  const differentials = normalizeTextArray(briefing.differentials, 5, 80)
  const offer = getBriefingValue(briefing, 'offer', body.oferta)
  const cta = getBriefingValue(briefing, 'cta', body.cta)
  const finalFeatures = getBriefingValue(briefing, 'finalFeatures', body.caracteristica)
  const furnishingStatus = getBriefingValue(briefing, 'furnishingStatus', '')
  const decorationPolicy = getBriefingValue(briefing, 'decorationPolicy', '')
  const visualStyle = getBriefingValue(briefing, 'visualStyle', '')
  const atmosphere = getBriefingValue(briefing, 'atmosphere', '')
  const pace = getBriefingValue(briefing, 'pace', '')
  const creativeFreedom = getBriefingValue(briefing, 'creativeFreedom', '')
  const bedrooms = getBriefingValue(briefing, 'bedrooms', body.bedrooms)
  const suites = getBriefingValue(briefing, 'suites', body.suites)
  const parking = getBriefingValue(briefing, 'parking', body.parking)

  return {
    objective,
    objectiveLabel,
    propertyType,
    profile,
    stage,
    houseLocationType,
    city,
    district,
    uf,
    location,
    normalizedLocation,
    differentials,
    offer,
    cta,
    finalFeatures,
    furnishingStatus,
    decorationPolicy,
    visualStyle,
    atmosphere,
    pace,
    creativeFreedom,
    bedrooms,
    suites,
    parking,
    creativeMode: getBriefingValue(briefing, 'creativeMode', body.creativeMode ?? body.mode ?? 'cinematic'),
  }
}

function cleanScreenText(value: unknown, maxLength = 48) {
  return cleanStaticText(normalizeText(value, Math.max(maxLength * 2, 120)))
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function removeTrailingStateCode(value: string) {
  return value
    .replace(/\s+(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i, '')
    .trim()
}

function toVoiceoverPlace(value: string) {
  const smallWords = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM'])
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function dedupeScreenWords(value: string) {
  const words = value.split(/\s+/).filter(Boolean)
  const output: string[] = []
  for (const word of words) {
    if (output[output.length - 1] === word) continue
    output.push(word)
  }
  return output.join(' ')
}

function buildShortAdOpeningText(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const district = cleanScreenText(briefing.district, 36)
  const city = cleanScreenText(briefing.city, 36)
  const location = removeTrailingStateCode(cleanScreenText(briefing.location || briefing.normalizedLocation, 48))
  const genericDistricts = new Set(['CENTRO', 'ZONA SUL', 'ZONA NORTE', 'ZONA LESTE', 'ZONA OESTE', 'INTERIOR', 'LITORAL'])

  if (district && city && district !== city && genericDistricts.has(district)) {
    return `${district} DE ${city}`.slice(0, 48)
  }
  if (district) return district
  if (location) return location
  if (city) return city
  return 'IMOVEL'
}

function buildShortAdClosingText(cta: string) {
  const clean = dedupeScreenWords(cleanScreenText(cta, 48))
  if (/SAIBA|MAIS/.test(clean)) return 'SAIBA MAIS'
  if (/AGENDE|VISITA/.test(clean)) return 'AGENDE SUA VISITA'
  if (/ENTRE|CONTATO|FALE|CORRETOR|ESPECIALISTA|WHATS/.test(clean)) return 'ENTRE EM CONTATO'
  if (/SOLICITE|INFORM/.test(clean)) return 'SOLICITE INFORMACOES'
  return clean.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'SAIBA MAIS'
}

function firstUsefulFeature(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>, metadataChat: { caracteristica: string }) {
  return cleanScreenText(
    briefing.differentials[0]
      || briefing.finalFeatures
      || metadataChat.caracteristica,
    48,
  )
}

function buildShortAdVoiceoverScript(
  briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>,
  metadataChat: { caracteristica: string },
  openingText: string,
) {
  const source = cleanScreenText([
    briefing.objective,
    briefing.objectiveLabel,
    briefing.propertyType,
    briefing.profile,
    briefing.stage,
    briefing.offer,
    briefing.finalFeatures,
    ...briefing.differentials,
    metadataChat.caracteristica,
  ].filter(Boolean).join(' '), 240)
  const place = toVoiceoverPlace(openingText)
  const propertyType = toVoiceoverPlace(cleanScreenText(briefing.propertyType, 32) || 'imovel').toLowerCase()
  const feature = firstUsefulFeature(briefing, metadataChat)
  const featureText = feature && !/VENDA|LOCACAO|ALUGAR|IMOVEL|APARTAMENTO|CASA/.test(feature)
    ? toVoiceoverPlace(feature).toLowerCase()
    : ''

  if (/CAPTACAO|CAPTAR|PROPRIET/.test(source) && !/CORRETOR|PROFISSION/.test(source)) {
    return `Mostre seu imovel com quem entende de divulgacao profissional. Uma apresentacao forte ajuda a atrair compradores certos com mais confianca.`
  }

  if (/CORRETOR|PROFISSION|CAPTADOR|GERENTE|DIRETOR|CARREIRA/.test(source)) {
    return `Faca parte de uma equipe preparada para crescer no mercado imobiliario. Uma oportunidade para profissionais que querem mais estrutura e resultado.`
  }

  if (/LOCAC|ALUG/.test(source)) {
    return `Encontre uma opcao pronta para facilitar sua proxima escolha em ${place}. Um ${propertyType} apresentado com clareza para quem busca praticidade.`
  }

  if (/MCMV|ECONOM|POPULAR|OPORTUNIDADE|CASA PROPRIA|SAIA DO ALUGUEL/.test(source)) {
    const second = /LANCAMENTO|OBRAS|FUTURO/.test(source)
      ? 'Um lancamento pensado para quem busca praticidade, localizacao e bom custo-beneficio.'
      : 'Uma escolha pensada para quem busca praticidade e uma excelente oportunidade.'
    return `Conheca uma excelente oportunidade em ${place}. ${second}`
  }

  if (/LUXO|ALTO PADRAO|SOFISTIC|DESIGN|EXCLUSIV|ELEGAN/.test(source)) {
    const detail = featureText ? ` com foco em ${featureText}` : ''
    return `Descubra um ${propertyType}${detail} em ${place}. Uma apresentacao criada para despertar desejo desde os primeiros segundos.`
  }

  if (/COMERCIAL|SALA|LAJE|LOJA|GALPAO|NEGOCIO|NEGOCIOS/.test(source)) {
    return `Apresente seu negocio com mais presenca em ${place}. Um comercial direto para destacar potencial, localizacao e oportunidade.`
  }

  if (/LANCAMENTO|OBRAS|FUTURO/.test(source)) {
    return `Conheca uma novidade imobiliaria em ${place}. Um lancamento criado para quem busca uma nova oportunidade com praticidade.`
  }

  return `Descubra um ${propertyType} com grande potencial em ${place}. Uma apresentacao pensada para gerar interesse e vontade de saber mais.`
}

function buildShortAdVisualDirection(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const source = cleanScreenText(`${briefing.profile} ${briefing.objectiveLabel} ${briefing.propertyType} ${briefing.stage}`, 160)
  if (/MCMV|ECONOM|POPULAR/.test(source)) {
    return 'Bright and optimistic real estate commercial. Natural camera movement. Warm daylight. Friendly modern atmosphere. Professional advertising style.'
  }
  if (/LUXO|ALTO PADRAO|SOFISTIC|DESIGN/.test(source)) {
    return 'Premium cinematic real estate commercial. Elegant camera movement. Warm lighting. Refined atmosphere. Natural motion. Professional luxury advertising style.'
  }
  if (/COMERCIAL|NEGOCIO|SALA|LAJE|LOJA|GALPAO/.test(source)) {
    return 'Modern commercial real estate advertisement. Confident camera movement. Clean lighting. Professional business atmosphere. Direct advertising rhythm.'
  }
  return 'Premium cinematic real estate commercial. Elegant camera movement. Warm lighting. Modern atmosphere. Natural motion. Professional advertising style.'
}

function buildShortAdScriptPrompt(
  briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>,
  metadataChat: { cta: string; caracteristica: string },
) {
  const screenTextOpening = buildShortAdOpeningText(briefing)
  const screenTextClosing = buildShortAdClosingText(metadataChat.cta)
  const voiceoverScript = buildShortAdVoiceoverScript(briefing, metadataChat, screenTextOpening)
  const visualDirection = buildShortAdVisualDirection(briefing)

  const prompt = `VIDEO PROFILE
Vertical 9:16 real estate commercial.
Duration 8 seconds.
Use the uploaded property image as the visual reference.
Create a professional real estate advertisement, not a technical listing.

VISUAL DIRECTION
${visualDirection}

VOICEOVER SCRIPT
Brazilian Portuguese voiceover only.
Use this script naturally:
"${voiceoverScript}"

SCREEN TEXT
Opening: "${screenTextOpening}"
Closing: "${screenTextClosing}"
Do not show any other on-screen text.
Do not repeat screen text.
Keep words separated and readable.

FORBIDDEN RULES
Do not invent amenities.
Do not invent architecture.
Do not invent rooms, pools, views, furniture, people, logos or watermarks.
Do not concatenate city or state.
Do not show state code, UF or state name on screen.
Do not repeat screen text.
Do not narrate raw structured data.
Use only provided information.
If information is missing, stay generic and commercial.`

  return {
    prompt,
    screenTextOpening,
    screenTextClosing,
    voiceoverScript,
    visualDirection,
  }
}

function getCreativeProfileDirection(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>) {
  const source = `${briefing.objective} ${briefing.objectiveLabel} ${briefing.propertyType} ${briefing.profile} ${briefing.stage} ${briefing.offer} ${briefing.finalFeatures} ${briefing.differentials.join(' ')}`.toUpperCase()

  if (/CAPTACAO|CAPTAR|IMOVEIS|PROPRIET/.test(source) && !/CORRETOR|PROFISSION/.test(source)) {
    return 'Captacao de imoveis: autoridade do corretor, confianca, venda melhor, divulgacao profissional, seguranca para o proprietario.'
  }
  if (/CORRETOR|PROFISSION|CAPTADOR|GERENTE|DIRETOR|CARREIRA/.test(source)) {
    return 'Captacao de profissionais: carreira, parceria, tecnologia, crescimento, ganhos, inovacao e equipe forte.'
  }
  if (/LOCAC|ALUG/.test(source)) {
    return 'Locacao: disponibilidade, praticidade, conforto imediato, solucao rapida e desejo de visitar.'
  }
  if (/COMERCIAL|SALA|LAJE|NEGOCIO|NEGOCIOS/.test(source)) {
    return 'Comercial: negocio, localizacao estrategica, presenca profissional, investimento e credibilidade.'
  }
  if (/LANCAMENTO|OBRAS|FUTURO/.test(source)) {
    return 'Lancamento: novidade, futuro, valorizacao, oportunidade e antecipacao.'
  }
  if (/MCMV|ECONOM|POPULAR|OPORTUNIDADE|SAIA DO ALUGUEL|CASA PROPRIA/.test(source)) {
    return 'MCMV/economico: casa propria, sair do aluguel, conquista, familia, oportunidade e emocao positiva.'
  }
  if (/LUXO|ALTO|SOFISTIC|DESIGN|EXCLUSIV|ELEGAN/.test(source)) {
    return 'Luxo/alto padrao: exclusividade, sofisticacao, desejo, trailer cinematografico, alto impacto e sensacao premium.'
  }
  return 'Medio/pronto: conforto, praticidade, localizacao, morar bem, vida real e decisao facil.'
}

function buildCreativePromptRequest(briefing: ReturnType<typeof buildStructuredStudioHeroBriefing>, hasImage: boolean) {
  const visibleTextCandidates = [
    normalizePromptText(briefing.normalizedLocation || briefing.location, 40),
    normalizePromptText(briefing.offer, 32),
    ...briefing.differentials.map((item) => normalizePromptText(item, 32)),
    normalizePromptText(briefing.cta, 40),
  ].filter(Boolean)

  return {
    studioMode: hasImage ? 'Studio Hero Modo 1 - Comercial Cinematografico' : 'Studio Hero Modo 2 - Comercial IA Livre',
    format: 'vertical 9:16, 8 seconds, social media commercial',
    objective: briefing.objectiveLabel || briefing.objective,
    propertyType: briefing.propertyType,
    profile: briefing.profile,
    stage: briefing.stage,
    location: briefing.location,
    city: briefing.city,
    district: briefing.district,
    uf: briefing.uf,
    mainFeatures: briefing.finalFeatures,
    differentials: briefing.differentials,
    offer: briefing.offer,
    cta: briefing.cta,
    creativeProfile: getCreativeProfileDirection(briefing),
    visibleTextCandidates,
    imagePolicy: hasImage
      ? 'There is an uploaded image. Treat it as the absolute architectural reference. Preserve the architecture, layout, furniture, materials, proportions and visual identity. The system will send the same image as image and lastFrame.'
      : 'There is no uploaded image. Create the full visual scene from the briefing with total creative freedom. Do not mention preserving an uploaded image or architecture. Invent a coherent cinematic real estate world that matches the objective, audience, profile and emotional atmosphere.',
  }
}

function extractOpenAiText(data: JsonRecord) {
  const choice = Array.isArray(data.choices) ? data.choices[0] as JsonRecord | undefined : undefined
  const message = choice?.message as JsonRecord | undefined
  return normalizeText(message?.content, 4500)
}

async function buildCreativeStudioHeroPrompt(body: JsonRecord, reqId: string, options: { hasImage: boolean }) {
  const apiKey = Deno.env.get('OPENAI_API_KEY') || ''
  if (!apiKey) throw new Error('creative_prompt_missing_openai_key')

  const briefing = buildStructuredStudioHeroBriefing(body)
  const promptRequest = buildCreativePromptRequest(briefing, options.hasImage)
  const model = Deno.env.get('STUDIO_HERO_PROMPT_MODEL') || Deno.env.get('HERO_TEXT_MODEL') || DEFAULT_CREATIVE_PROMPT_MODEL
  const visualReferencePolicy = options.hasImage
    ? `This generation has an uploaded property image.
The uploaded image is the absolute architectural reference.
The final prompt must explicitly instruct the video model to preserve the uploaded architecture, layout, furniture, materials, proportions and visual identity.
Do not replace the property with a different project.`
    : `This generation has no uploaded image.
The final prompt must not mention an uploaded image, image reference, lastFrame, preservation of uploaded architecture or preserving the existing property.
Create the entire cinematic scene from the briefing with total creative freedom, while keeping the commercial believable and aligned with the real estate objective.`

  const systemPrompt = `You are the Creative Director of SmartCorretorAI Studio Hero.
Your job is to transform a real estate briefing into one powerful cinematic prompt for a video generation model.
Do not fill a dry template.
Write like a premium advertising agency and film director.
Start from the type of commercial and emotional goal, not from a list of property data.
Create emotion, storytelling, anticipation, visual impact and WOW.
The result must feel designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.
Use Brazilian Portuguese for narration instructions when relevant.
Visible text is allowed, but choose only a few strong messages.
All visible text must be uppercase Brazilian Portuguese without accents or cedilla.
Do not dump all property data as text.
Do not invent property facts, people, logos or watermarks.
${visualReferencePolicy}
Return only the final video prompt. No markdown. No JSON.`

  const userPrompt = `Create the final cinematic video prompt from this structured briefing.

Creative profile:
${promptRequest.creativeProfile}

Structured briefing:
${JSON.stringify(promptRequest, null, 2)}

The final prompt should include ideas like:
- Create an ultra realistic real estate cinematic trailer when appropriate.
- Create emotional connection.
- Create anticipation.
- Create excitement.
- Create the strongest emotional moment.
- Designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.

Keep the final prompt concise but powerful.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`creative_prompt_failed:${response.status}:${text.slice(0, 160)}`)
  }

  const data = await response.json() as JsonRecord
  const creativePrompt = extractOpenAiText(data)
  if (!creativePrompt || creativePrompt.length < 80) {
    throw new Error('creative_prompt_empty')
  }

  console.info(`[${reqId}] Studio Hero prompt criativo preparado`, {
    model,
    promptLength: creativePrompt.length,
    objective: promptRequest.objective,
    propertyType: promptRequest.propertyType,
    hasImage: options.hasImage,
    visibleTextCandidates: promptRequest.visibleTextCandidates.length,
  })

  return creativePrompt
}

type ChampionPromptInput = {
  objetivo?: string
  perfil?: string
  tipoImovel?: string
  bairro?: string
  cidade?: string
  area?: string
  dormitorios?: string
  suites?: string
  vagas?: string
  diferenciais?: string[]
  oferta?: string
  cta?: string
}

type ChampionPromptResult = {
  prompt: string
  profileKey: string
  visibleTexts: string[]
}

function uniquePromptTexts(values: unknown[], maxItems = 6, maxLength = 36) {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const clean = normalizePromptText(value, maxLength)
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    output.push(clean)
    if (output.length >= maxItems) break
  }

  return output
}

function normalizeMetricPromptText(value: unknown, label: string, maxLength = 28) {
  const clean = normalizePromptText(value, maxLength)
  if (!clean) return ''
  if (/^\d/.test(clean) && label && !clean.includes(label)) return `${clean} ${label}`.slice(0, maxLength)
  return clean
}

function getChampionProfileKey(input: ChampionPromptInput) {
  const source = normalizePromptText([
    input.objetivo,
    input.perfil,
    input.tipoImovel,
    input.oferta,
    ...(input.diferenciais || []),
  ].filter(Boolean).join(' '), 240)

  if (/CAPTACAO.*CORRET|CORRETOR|PROFISSION|CAPTADOR|GERENTE|DIRETOR/.test(source)) return 'broker_capture'
  if (/CAPTACAO.*IMOV|PROPRIET|VENDA SEU IMOVEL/.test(source)) return 'property_capture'
  if (/LOCAC|ALUG/.test(source)) return 'rent'
  if (/COMERCIAL|SALA COMERCIAL|LOJA|LAJE|GALPAO|NEGOCIO|NEGOCIOS/.test(source)) return 'commercial'
  if (/MCMV|ECONOM|POPULAR|CASA PROPRIA|SAIA DO ALUGUEL|SUBSID/.test(source)) return 'economic'
  if (/LANCAMENTO|PRE LANCAMENTO|OBRAS|FUTURO/.test(source)) return 'launch'
  if (/LUXO|ALTO PADRAO|SOFISTIC|EXCLUSIV|DESIGN|ELEGAN/.test(source)) return 'luxury'
  return 'ready'
}

function getOfferText(input: ChampionPromptInput, fallback = 'A VENDA') {
  const objective = normalizePromptText(`${input.objetivo || ''} ${input.oferta || ''}`, 80)
  if (/LOCAC|ALUG/.test(objective)) return 'PARA LOCACAO'
  if (/CAPTACAO.*IMOV/.test(objective)) return 'DIVULGACAO PROFISSIONAL'
  if (/CAPTACAO.*CORRET|CORRETOR|PROFISSION/.test(objective)) return 'JUNTE SE AO TIME'
  const offer = normalizePromptText(input.oferta, 32)
  return offer || fallback
}

function getChampionBaseTexts(input: ChampionPromptInput) {
  const location = normalizePromptText(input.bairro || input.cidade, 36)
  const propertyType = normalizePromptText(input.tipoImovel || input.perfil, 28) || 'IMOVEL'
  const profile = normalizePromptText(input.perfil, 28)
  const offer = getOfferText(input)
  const cta = normalizePromptText(input.cta, 32) || 'AGENDE SUA VISITA'
  const area = normalizeMetricPromptText(input.area, 'M2', 18)
  const suites = normalizeMetricPromptText(input.suites, 'SUITES', 20)
  const dormitorios = normalizeMetricPromptText(input.dormitorios, 'DORMITORIOS', 24)
  const vagas = normalizeMetricPromptText(input.vagas, 'VAGAS', 18)
  const strongFeatures = uniquePromptTexts([
    area,
    suites,
    dormitorios,
    vagas,
    ...(input.diferenciais || []),
    profile,
  ], 5, 32)

  return {
    location: location || normalizePromptText(input.cidade, 36) || 'LOCALIZACAO',
    propertyType,
    profile,
    offer,
    cta,
    strongFeature1: strongFeatures[0] || propertyType,
    strongFeature2: strongFeatures[1] || profile || offer,
  }
}

function buildLuxuryChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const commercialProfile = profileKey === 'luxury' && /LUXO/.test(normalizePromptText(input.perfil, 28))
    ? 'LUXO'
    : 'ALTO PADRAO'
  const visibleTexts = uniquePromptTexts([
    texts.propertyType,
    texts.strongFeature1,
    texts.strongFeature2,
    texts.location,
    commercialProfile,
    texts.offer,
    texts.cta,
  ], 7, 36)

  const prompt = `Create an ultra realistic luxury real estate cinematic trailer.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as the opening scene and final visual reference.

Preserve the real property exactly as shown.
Maintain maximum realism and preserve architecture, colors, materials and overall appearance of the property.

Luxury real estate marketing style.

Golden hour lighting.

Premium cinematic audio.

Deep impacts.

Elegant bells.

Luxury atmosphere.

Subtle whooshes.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a cinematic luxury reveal.
Create depth, reflections, light rays and subtle floating particles.
Build anticipation.
Reveal:
"${texts.propertyType}"

Middle scene:
Increase visual energy.
Create a premium luxury feeling.
Reveal:
"${texts.strongFeature1}"
Then reveal:
"${texts.strongFeature2}"

Transition scene:
Create a dramatic cinematic reveal.
Luxury atmosphere.
Reveal:
"${texts.location}"
Then reveal:
"${commercialProfile}"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.offer}"
Then reveal:
"${texts.cta}"

The entire video should feel like a luxury real estate trailer designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.
The result should create a strong WOW effect and feel like a premium real estate advertisement.`

  return { prompt, profileKey, visibleTexts }
}

function buildEconomicChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const visibleTexts = uniquePromptTexts([
    'SEU PRIMEIRO IMOVEL',
    'CONDICOES FACILITADAS',
    'SUBSIDIOS DISPONIVEIS',
    'SAIA DO ALUGUEL',
    texts.cta,
  ], 5, 36)

  const prompt = `Create an ultra realistic residential real estate commercial.

Vertical format 9:16.

Duration 8 seconds.

Create all scenes from the uploaded property image and the commercial briefing.

Modern Brazilian residential development.

Focus on first-time home buyers.

Focus on affordability, opportunity and family achievement.

Create a realistic Minha Casa Minha Vida atmosphere.

Show a welcoming residential environment.

Warm lighting.

Optimistic atmosphere.

Modern architecture.

Affordable housing with quality design.

Create emotional connection.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a modern residential condominium atmosphere.
Reveal:
"SEU PRIMEIRO IMOVEL"

Middle scene:
Show pleasant residential lifestyle.
Green areas.
Playground.
Leisure areas.
Safe environment.
Reveal:
"CONDICOES FACILITADAS"

Then reveal:
"SUBSIDIOS DISPONIVEIS"

Final scene:
Create the strongest emotional moment.
Show the feeling of achieving the dream of home ownership.
Reveal:
"SAIA DO ALUGUEL"

Then reveal:
"${texts.cta}"

Warm cinematic soundtrack.

Positive atmosphere.

The result should feel like a professional Minha Casa Minha Vida commercial designed for Instagram Reels, TikTok and YouTube Shorts.`

  return { prompt, profileKey, visibleTexts }
}

function buildReadyChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const readyMessage = profileKey === 'launch' ? 'LANCAMENTO' : 'PRONTO PARA MORAR'
  const visibleTexts = uniquePromptTexts([
    readyMessage,
    texts.strongFeature1,
    texts.location,
    texts.offer,
    texts.cta,
  ], 5, 36)

  const prompt = `Create an ultra realistic residential real estate cinematic commercial.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as the opening scene and final visual reference.
Preserve architecture, layout, colors, materials and the real appearance of the property.

Create a polished real estate advertisement focused on comfort, practicality, location and real life.

Warm modern lighting.

Natural cinematic camera movement.

Premium but believable atmosphere.

Create anticipation.

Create emotional impact.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a welcoming reveal of the property.
Create depth, natural reflections and subtle moving light.
Reveal:
"${readyMessage}"

Middle scene:
Increase the sense of comfort and everyday value.
Reveal:
"${texts.strongFeature1}"

Transition scene:
Create a smooth cinematic transition with warm light and movement.
Reveal:
"${texts.location}"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.offer}"
Then reveal:
"${texts.cta}"

The result should feel like a professional real estate commercial designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.
The commercial should feel useful, desirable and ready for real buyers or renters.`

  return { prompt, profileKey, visibleTexts }
}

function buildCommercialChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const visibleTexts = uniquePromptTexts([
    'ESPACO COMERCIAL',
    'LOCALIZACAO ESTRATEGICA',
    'PRONTO PARA SEU NEGOCIO',
    texts.location,
    texts.cta,
  ], 5, 36)

  const prompt = `Create an ultra realistic commercial real estate cinematic advertisement.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as the opening scene and final visual reference.
Preserve architecture, layout, materials, proportions and the real commercial potential of the property.

Focus on business, strategic location, professional presence and space to grow.

Corporate cinematic style.

Confident pacing.

Modern lighting.

Premium commercial atmosphere.

Create anticipation.

Create excitement.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a strong professional reveal.
Reveal:
"ESPACO COMERCIAL"

Middle scene:
Create a sense of business potential and credibility.
Reveal:
"LOCALIZACAO ESTRATEGICA"

Transition scene:
Create a dynamic transition with light, depth and modern movement.
Reveal:
"PRONTO PARA SEU NEGOCIO"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.location}"
Then reveal:
"${texts.cta}"

The result should feel like a premium commercial property advertisement designed to stop scrolling on Instagram Reels, TikTok and YouTube Shorts.`

  return { prompt, profileKey, visibleTexts }
}

function buildRentChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const visibleTexts = uniquePromptTexts([
    'DISPONIVEL PARA LOCACAO',
    'PRONTO PARA ENTRAR',
    'CONFORTO E PRATICIDADE',
    texts.location,
    texts.cta,
  ], 5, 36)

  const prompt = `Create an ultra realistic real estate rental commercial.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as the opening scene and final visual reference.
Preserve architecture, layout, furniture, materials and the real appearance of the property.

Focus on availability, practicality, immediate comfort and the desire to visit.

Clean modern cinematic style.

Fast but elegant pacing.

Natural light.

Trustworthy atmosphere.

Create curiosity.

Create the feeling of a quick and practical solution.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a clear and attractive property reveal.
Reveal:
"DISPONIVEL PARA LOCACAO"

Middle scene:
Show comfort and practicality through cinematic movement and light.
Reveal:
"PRONTO PARA ENTRAR"

Transition scene:
Create a polished transition with depth and natural reflections.
Reveal:
"CONFORTO E PRATICIDADE"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.location}"
Then reveal:
"${texts.cta}"

The result should feel like a professional rental property commercial designed to stop scrolling and motivate a visit.`

  return { prompt, profileKey, visibleTexts }
}

function buildPropertyCaptureChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const visibleTexts = uniquePromptTexts([
    'VENDA SEU IMOVEL MELHOR',
    'DIVULGACAO PROFISSIONAL',
    'ESTRATEGIA QUE VALORIZA',
    texts.location,
    texts.cta || 'FALE COM ESPECIALISTA',
  ], 5, 36)

  const prompt = `Create an ultra realistic real estate authority commercial for a broker.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as visual support and real estate atmosphere.
Do not sell this specific property as the product.
The commercial is about attracting property owners who want to sell or rent better.

Focus on broker authority, trust, professional marketing, strategy and property valuation.

Premium real estate marketing style.

Confident cinematic pacing.

Modern visual atmosphere.

Create emotional impact.

Create trust.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a strong real estate authority reveal.
Reveal:
"VENDA SEU IMOVEL MELHOR"

Middle scene:
Create a professional marketing feeling.
Reveal:
"DIVULGACAO PROFISSIONAL"

Transition scene:
Create confidence, strategy and premium presentation.
Reveal:
"ESTRATEGIA QUE VALORIZA"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.location}"
Then reveal:
"${texts.cta || 'FALE COM ESPECIALISTA'}"

The result should feel like a professional broker positioning commercial designed to attract property owners on Instagram Reels, TikTok and YouTube Shorts.`

  return { prompt, profileKey, visibleTexts }
}

function buildBrokerCaptureChampionPrompt(input: ChampionPromptInput, profileKey: string): ChampionPromptResult {
  const texts = getChampionBaseTexts(input)
  const visibleTexts = uniquePromptTexts([
    'CRESCA NA CARREIRA',
    'TECNOLOGIA PARA VENDER MAIS',
    'JUNTE SE AO TIME',
    texts.location,
    texts.cta || 'FALE CONOSCO',
  ], 5, 36)

  const prompt = `Create an ultra realistic professional recruiting commercial for a real estate team.

Vertical format 9:16.

Duration 8 seconds.

Use the uploaded property image as visual support and premium real estate atmosphere.
Do not sell this specific property as the product.
The commercial is about attracting real estate professionals.

Focus on career growth, partnership, technology, earnings, innovation and a strong team.

Modern recruitment advertising style.

Premium real estate atmosphere.

Confident cinematic rhythm.

Create excitement.

Create professional ambition.

No people.

No logos.

No watermark.

No interface elements.

No extra text besides the specified messages.

All on-screen text must be clean uppercase Brazilian Portuguese without accents or cedilla.
Do not invent words.
Do not misspell words.
Do not use link in bio, na bio, clique aqui or any unapproved call to action.

STORYBOARD

Opening scene:
Create a strong professional growth reveal.
Reveal:
"CRESCA NA CARREIRA"

Middle scene:
Create a sense of innovation and sales power.
Reveal:
"TECNOLOGIA PARA VENDER MAIS"

Transition scene:
Create team energy and ambition.
Reveal:
"JUNTE SE AO TIME"

Final scene:
Create the strongest visual moment.
Reveal:
"${texts.location}"
Then reveal:
"${texts.cta || 'FALE CONOSCO'}"

The result should feel like a premium real estate recruiting commercial designed to attract focused professionals on Instagram Reels, TikTok and YouTube Shorts.`

  return { prompt, profileKey, visibleTexts }
}

function buildChampionStudioHeroPrompt(input: ChampionPromptInput): ChampionPromptResult {
  const profileKey = getChampionProfileKey(input)

  if (profileKey === 'broker_capture') return buildBrokerCaptureChampionPrompt(input, profileKey)
  if (profileKey === 'property_capture') return buildPropertyCaptureChampionPrompt(input, profileKey)
  if (profileKey === 'rent') return buildRentChampionPrompt(input, profileKey)
  if (profileKey === 'commercial') return buildCommercialChampionPrompt(input, profileKey)
  if (profileKey === 'economic') return buildEconomicChampionPrompt(input, profileKey)
  if (profileKey === 'luxury') return buildLuxuryChampionPrompt(input, profileKey)
  return buildReadyChampionPrompt(input, profileKey)
}

function inferSupportedImageMimeType(path: string) {
  const cleanPath = path.split('?')[0] || ''
  if (/\.png$/i.test(cleanPath)) return 'image/png'
  if (/\.jpe?g$/i.test(cleanPath)) return 'image/jpeg'
  return null
}

async function uploadStudioHeroPromptDebug(supabase: ReturnType<typeof createClient>, input: {
  userId: string
  jobId: string
  prompt: string
  visualPrompt?: string
  voiceoverPrompt?: string
  model: string
  aspectRatio: string
  durationSeconds: number
  resolution: string
  sampleCount: number
  promptMode: string
  matrixId?: string
  visibleTexts?: string[]
  image1Path?: string
  image2Path?: string
}) {
  const debugEnabled = Deno.env.get('STUDIO_HERO_DEBUG_PROMPT_TO_STORAGE') === 'true'
  console.info('[DIAGNOSTICO] Studio Hero debug status', {
    debugEnabled,
    bucket: VIDEO_BUCKET,
    promptLength: input.prompt.length,
    promptMode: input.promptMode || 'champion_library',
  })

  if (!debugEnabled) return

  console.log('[DIAGNOSTICO] Executando dump de auditoria para o Storage privado...')

  try {
    const promptPath = `${input.userId}/${input.jobId}/debug/prompt.txt`
    const visualPromptPath = `${input.userId}/${input.jobId}/debug/visual-prompt.txt`
    const voiceoverPromptPath = `${input.userId}/${input.jobId}/debug/voiceover-prompt.txt`
    const imageMimeType = input.image1Path ? inferSupportedImageMimeType(input.image1Path) : null
    const lastFrameMimeType = input.image2Path ? inferSupportedImageMimeType(input.image2Path) : null
    const metaPath = `${input.userId}/${input.jobId}/debug/payload-meta.json`
    const payloadShapePath = `${input.userId}/${input.jobId}/debug/final-payload-shape.json`
    const endpointType = 'gemini_api_predict_long_running'
    const visualPrompt = input.visualPrompt || input.prompt
    const voiceoverPrompt = normalizeText(input.voiceoverPrompt, 500)
    const [text1, text2, text3] = input.visibleTexts || []

    console.info('[DIAGNOSTICO] Studio Hero debug paths', {
      promptPath,
      visualPromptPath,
      voiceoverPromptPath: voiceoverPrompt ? voiceoverPromptPath : null,
      metaPath,
      payloadShapePath,
      promptLength: input.prompt.length,
    })

    const uploadDebugText = async (path: string, content: string, contentType: string) => {
      const result = await supabase.storage
        .from(VIDEO_BUCKET)
        .upload(path, new Blob([content], { type: contentType }), {
          contentType,
          upsert: true,
        })

      if (result.error) {
        console.error('[DIAGNOSTICO] upload debug error', {
          path,
          error: result.error.message,
        })
      } else {
        console.info('[DIAGNOSTICO] upload debug success', { path })
      }

      return result
    }

    const promptUpload = await uploadDebugText(promptPath, input.prompt, 'text/plain')
    const visualPromptUpload = await uploadDebugText(visualPromptPath, visualPrompt, 'text/plain')
    const voiceoverPromptUpload = voiceoverPrompt
      ? await uploadDebugText(voiceoverPromptPath, voiceoverPrompt, 'text/plain')
      : { error: null }

    const metaPayload = {
      model: input.model,
      endpointType,
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: input.resolution,
      sampleCount: input.sampleCount,
      enhancedPrompt: false,
      audioConfig: false,
      languageCode: null,
      hasImage: Boolean(input.image1Path),
      hasLastFrame: Boolean(input.image2Path),
      imagePath: input.image1Path || null,
      lastFramePath: input.image2Path || null,
      imageMimeType,
      lastFrameMimeType,
      promptLength: input.prompt.length,
      visualPromptLength: visualPrompt.length,
      voiceoverPromptLength: voiceoverPrompt.length,
      promptMode: input.promptMode || 'champion_library',
      matrixId: input.matrixId || input.promptMode || 'champion_library',
      text1: text1 || '',
      text2: text2 || '',
      text3: text3 || '',
    }

    const payloadInstance: Record<string, unknown> = {
      prompt: `[omitted:${input.prompt.length} chars]`,
    }
    if (imageMimeType) {
      payloadInstance.image = {
        mimeType: imageMimeType,
        bytesBase64Encoded: '[omitted]',
      }
    }
    if (lastFrameMimeType) {
      payloadInstance.lastFrame = {
        mimeType: lastFrameMimeType,
        bytesBase64Encoded: '[omitted]',
      }
    }

    const payloadShape = {
      endpointType,
      model: input.model,
      requestBody: {
        instances: [payloadInstance],
        parameters: {
          aspectRatio: input.aspectRatio,
          durationSeconds: input.durationSeconds,
          resolution: input.resolution,
          sampleCount: input.sampleCount,
        },
      },
      unsupportedFieldsNotSent: [
        'audioConfig',
        'enhancedPrompt',
        'resizeMode',
      ],
    }

    const metaUpload = await uploadDebugText(metaPath, JSON.stringify(metaPayload, null, 2), 'application/json')
    const payloadShapeUpload = await uploadDebugText(payloadShapePath, JSON.stringify(payloadShape, null, 2), 'application/json')

    console.info('[DIAGNOSTICO] Studio Hero debug concluido', {
      promptUploaded: !promptUpload.error,
      visualPromptUploaded: !visualPromptUpload.error,
      voiceoverPromptUploaded: !voiceoverPromptUpload.error,
      metaUploaded: !metaUpload.error,
      payloadShapeUploaded: !payloadShapeUpload.error,
    })
  } catch (debugErr) {
    const message = debugErr instanceof Error ? debugErr.message : String(debugErr)
    console.error('[DIAGNOSTICO FALHOU] Nao foi possivel gravar os logs no Storage:', message)
  }
}

function normalizeOverlayText(value: unknown, fallback: string) {
  const clean = normalizePromptText(value, 32)
  const words = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  return words.join(' ') || fallback
}

function normalizeImpactText(value: unknown, fallback: string, maxWords = 1) {
  const clean = normalizePromptText(value, 28)
  const words = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
  return words.join(' ') || fallback
}

function pickCommercialImpactWord(style: string, caracteristica: string, oferta: string) {
  const source = `${style} ${caracteristica} ${oferta}`.toUpperCase()
  if (/PRAIA|MAR|VISTA|LITORAL|BEACH/.test(source)) return 'PRAIA'
  if (/INVEST|RENDA|VALORIZ/.test(source)) return 'INVESTIMENTO'
  if (/LUXO|LUXURY/.test(source)) return 'LUXO'
  if (/ALTO|SOFISTIC|ELEGAN|DESIGN/.test(source)) return 'DESIGN'
  if (/MCMV|ECONOM|POPULAR|SUBSID|FAMIL/.test(source)) return 'OPORTUNIDADE'
  if (/LOCAC|ALUG/.test(source)) return 'VISITE'
  if (/PRONTO|NOVO|MORAR/.test(source)) return 'MORAR'
  return normalizeImpactText(oferta || caracteristica, 'EXCLUSIVO')
}

function pickShortCta(cta: string) {
  const clean = normalizePromptText(cta, 28)
  if (/SAIBA/.test(clean)) return 'SAIBA MAIS'
  if (/AGENDE|VISITA/.test(clean)) return 'AGENDE'
  if (/CONTATO|FALE|CORRETOR|WHATS/.test(clean)) return 'CONTATO'
  if (/VISITE|CONHECA/.test(clean)) return 'VISITE'
  return normalizeImpactText(clean, 'SAIBA MAIS', 2)
}

function buildCreativeDirection(style: string, oferta: string) {
  const source = `${style} ${oferta}`.toUpperCase()
  if (/MCMV|ECONOM|POPULAR|SUBSID/.test(source)) {
    return `Campaign Type: Opportunity
Market Segment: Popular Housing
Target Audience: First-time buyers
Emotional Goal: Create excitement, confidence and desire to start a new life.
Visual Mood: Bright, optimistic, friendly, modern.
Camera Style: Commercial cinematic, natural, dynamic, welcoming.`
  }
  if (/LUXO|LUXURY/.test(source)) {
    return `Campaign Type: Desire
Market Segment: Luxury Real Estate
Target Audience: High-end buyers
Emotional Goal: Create exclusivity, aspiration and curiosity.
Visual Mood: Sophisticated, iconic, private, cinematic.
Camera Style: Premium luxury advertising quality, elegant, immersive, refined.`
  }
  if (/ALTO|SOFISTIC|DESIGN/.test(source)) {
    return `Campaign Type: Premium Lifestyle
Market Segment: High-end Residential
Target Audience: Qualified buyers
Emotional Goal: Create desire and a sense of elevated living.
Visual Mood: Elegant, modern, aspirational, polished.
Camera Style: Commercial cinematic, natural, dynamic, luxury advertising quality.`
  }
  if (/LOCAC|ALUG/.test(source)) {
    return `Campaign Type: Visit
Market Segment: Rental Property
Target Audience: People looking for a practical place to live or work.
Emotional Goal: Create curiosity and motivate a visit.
Visual Mood: Clean, practical, modern, trustworthy.
Camera Style: Commercial cinematic, clear, natural, dynamic.`
  }
  return `Campaign Type: Opportunity
Market Segment: Real Estate
Target Audience: Potential buyers
Emotional Goal: Stop the scroll, create emotion and curiosity, lead to a click.
Visual Mood: Modern, premium, clear, commercial.
Camera Style: Commercial cinematic, natural, dynamic, luxury advertising quality.`
}

function normalizeStoragePath(value: unknown, userId: string) {
  const path = normalizeText(value, 700)
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
  if (!path || !path.startsWith(`${userId}/`)) return ''
  return path
}

function isSupportedImagePath(path: string) {
  return /\.(jpe?g|png)$/i.test(path.split('?')[0] || '')
}

function isUuid(value: unknown) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isAdminBypassUser(profile: ProfileRow | null, user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const role = String(profile?.role || user.user_metadata?.role || '').toLowerCase()
  const email = String(profile?.email || user.email || '').toLowerCase()
  return role === 'admin' || email === 'riccieri68@gmail.com'
}

function buildPromptFinal({ bairro, caracteristica, oferta, cta }: {
  bairro: string
  caracteristica: string
  oferta: string
  cta: string
}) {
  const safeBairro = normalizeOverlayText(bairro, 'IMOVEL')
  const safeCaracteristica = normalizeOverlayText(caracteristica, 'DESTAQUE')
  const safeOferta = normalizeOverlayText(oferta, 'OFERTA')
  const safeCta = normalizeOverlayText(cta, 'AGENDE VISITA')

  const prompt = `Create one single vertical real estate video in the style "Apresentacao de Impacto".

Format: 9:16.
Duration: 8 seconds.
Resolution target: 720p.

Use only the two uploaded property images.
Use image 1 from 0.0s to 4.0s.
Create a smooth transition from 4.0s to 4.8s.
Use image 2 as the main final scene from 4.8s to 8.0s.
Image 2 must not be just a static final frame. It must be the strongest part of the video, with elegant cinematic movement and a clear final reveal.

Keep the property realistic.
Do not invent rooms, amenities, facade, floor plan, views, people, logos, brands or property data that are not visible or provided.

Create smooth cinematic movement, professional real estate pacing and a polished commercial atmosphere.
The video should feel like a finished social media property ad, not a slideshow.

Text rules are strict.
Use only short text overlays from the exact overlay list below.
Each overlay must have at most 2 words.
Display each text overlay only once.
Do not duplicate text.
Do not create extra text.
Do not repeat words.
Do not repeat "SAIBA MAIS".
Never use small, distorted or unreadable typography.
Do not show the final CTA before 6.5s.
Show the final CTA only once, from 6.5s to 8.0s.
The ending must be the strongest part of the video.

Allowed overlay list:
Overlay 1: ${safeOferta}
Overlay 2: ${safeBairro}
Overlay 3: ${safeCaracteristica}
Final CTA: ${safeCta}

End the video on image 2 with Final CTA only from 6.5s to 8.0s.`

  if (prompt.includes('{') || prompt.includes('}')) {
    throw new Error('prompt_placeholder_detected')
  }

  return prompt
}

function buildStudioHeroVeoPromptNarrativeTest({ bairro, caracteristica, oferta, cta }: {
  bairro: string
  caracteristica: string
  oferta: string
  cta: string
}) {
  const safeBairro = normalizePromptText(bairro, 32) || 'IMOVEL'
  const safeCaracteristica = normalizePromptText(caracteristica, 48) || 'DESTAQUE'
  const safeOferta = normalizePromptText(oferta, 28) || 'OFERTA'
  const safeCta = normalizePromptText(cta, 28) || 'AGENDE SUA VISITA'

  const prompt = `Create one single vertical real estate video for Studio Hero Premium.

Format: 9:16.
Duration: 8 seconds.
Resolution target: 720p.

Use exactly the two uploaded property images.
Use image 1 as the opening image.
Use image 2 as the lastFrame and final visual destination.

Narrative direction:
Start with an elegant opening.
The video must have a rising curve of visual impact.
Each new scene must feel more visually impressive than the previous one.
The whole narrative must naturally lead to image 2.
Image 2 / lastFrame represents the visual climax of the commercial.
The last scene must be the most cinematic moment of the entire video.
The CTA must feel integrated into the grand finale without reducing the impact of the final scene.

Cinematic direction:
Prioritize cinematic direction instead of technical or temporal commands.
Avoid any feeling of an animated photograph.
The property must feel like a real space captured by a moving camera.
The camera must move organically, elegantly and cinematically.
Avoid only slow zoom or simple pan.
Create depth using camera movement, parallax, foreground, background and perspective.
Add visual richness with volumetric light, natural reflections, elegant lens flare, floating particles, atmospheric depth, realistic environmental motion, subtle light changes, moving shadows and realistic window lighting.
When using interior spaces, make the environment feel alive.
Do not merely move the camera over a still photograph.
Make the camera feel like it is entering or passing through the space.

Safety rules:
Keep the property realistic.
Do not invent rooms, amenities, facade, floor plan, views, people, logos, brands, watermark, interface, app screen or property data that are not visible or provided.
Do not show any UI, buttons, mockups, captions from an app, browser interface or editor interface.

Text rules:
Use only text informed below.
Avoid accents if text is rendered.
Do not repeat text.
Display each text overlay only once.
Do not create extra text.
Do not duplicate words.
Do not show two important text overlays at the same time.
Use clean, large and legible typography only.
Final CTA must appear only once near the end.

Text available:
Offer: ${safeOferta}
Location: ${safeBairro}
Feature: ${safeCaracteristica}
Final CTA: ${safeCta}

Commercial goal:
Create a polished premium social media real estate video that grows in impact until the final CTA.`

  if (prompt.includes('{') || prompt.includes('}')) {
    throw new Error('prompt_placeholder_detected')
  }

  return prompt
}

function buildStudioHeroVeoPromptControlledNarrativeTest({ bairro, caracteristica, oferta, cta, style }: {
  bairro: string
  caracteristica: string
  oferta: string
  cta: string
  style?: string
}) {
  const safeLocation = normalizeImpactText(bairro, 'IMOVEL', 2)
  const commercialWord = pickCommercialImpactWord(style || '', caracteristica, oferta)
  const creativeDirection = buildCreativeDirection(style || caracteristica, oferta)

  const prompt = `Create one single vertical premium real estate commercial for Studio Hero.

Format: 9:16.
Duration: 8 seconds.
Resolution target: 720p.

Main goal:
Create a premium commercial with strong visual impact.
It must feel like a polished luxury real estate ad, not a slideshow.
The video must stop the scroll, create desire and make the viewer want to know more.
Use advertising rhythm, cinematic motion, dramatic light and bold visual composition.
Make it look closer to a high-end social media property campaign than a simple animated photo.
Prioritize the same level of cinematic richness expected from a direct premium AI video generation.

Source images:
Use the two uploaded property images as the visual foundation and source of truth.
Image 1 is the opening and initial development.
Image 2 is the mandatory final scene and must have clear protagonism.
Preserve the property exactly as represented by the uploaded images.

Commercial narrative:
Start immediately with energy and movement on image 1.
Use continuous cinematic camera movement, not static framing.
Make image 1 feel alive with parallax depth, foreground/background separation, moving light and elegant commercial atmosphere.
Transition from image 1 to image 2 with a smooth cinematic transition, using motion blur, depth, golden light sweep, particles and a premium advertising rhythm.
Reveal image 2 as the visual payoff and strongest moment of the commercial.
Image 2 must continue moving with real cinematic camera motion until the end.
The ending must be strong, premium, memorable and ready for a final CTA moment.
Never let the video look like image 1, then a simple fade, then image 2.

Strict visual limits:
Do not create new rooms.
Do not create new home spaces.
Do not create new facades.
Do not create new buildings.
Do not create new interior spaces.
Do not create invented intermediate scenes.
Do not show another property.
Do not invent decoration or architecture different from the uploaded images.
Do not invent amenities, views, floor plans, furniture, people, logos, brands, watermark, app screens or interface.
Transitions may use movement, depth, light, reflections, shadows and elegant atmosphere, but must always preserve the environments shown in the uploaded images.
The visual identity of the property must remain faithful to the uploaded images.
Do not make the property more luxurious than the uploaded images support.

Image 2 rules:
Image 2 is the hero shot.
Image 2 must not be only a static background.
Image 2 must receive real camera movement, depth, light, atmosphere and impact.
Image 2 must feel animated by the camera, the light and the environment, not by a simple zoom.
Image 2 must occupy the final part of the video and become the strongest visual moment.
The last frame must remain alive with subtle movement, cinematic lighting and commercial impact.
Image 2 must feel like the most expensive and cinematic shot in the commercial.

Text rules:
Use large, bold, premium on-screen text.
Text must be clean, uppercase, legible and impactful.
All on-screen text must be in Brazilian Portuguese without accents.
Do not use accents or special characters in rendered text.
Do not render punctuation, symbols, decorative numbers or random characters.
Do not misspell words.
Do not invent words.
Maximum two text moments generated by Veo in the entire video.
Each text moment must contain one strong word, or exceptionally two very short words.
Text moment 1, location: ${safeLocation}
Text moment 2, commercial impact word: ${commercialWord}
Never repeat the location.
Never repeat any text.
Display each text block only once.
Do not create extra text.
Do not use long phrases.
Do not write descriptions like "APARTAMENTO DE LUXO", "LOCALIZACAO PRIVILEGIADA", "4 DORMITORIOS" or "224M2".
Use short, large and legible text.
Text must be elegant and integrated into the scene.
Text must not occupy the whole screen.
Avoid excessive words.
Do not show two important text blocks at the same time.
Do not generate any call to action text.
Do not write CTA text.
Do not write contact text.
Do not write "SAIBA MAIS", "AGENDE", "CONTATO" or similar CTA words.
The platform will add the final CTA outside the Veo video.

Data rules:
Use exclusively the data provided in the three text blocks above.
If a data point was not provided, do not display it.
Never invent numbers.
Never create random numbers.
Never create decorative numbers.
Never create phone numbers.
Never create fake phone numbers.
Never create prices.
Never create property areas.
Never create bedrooms, suites, parking spaces, codes or commercial information that was not provided.
Do not display numbers that look like contacts.
Do not display strange text such as "6.5 corretor".

Creative Direction (internal only, never display this text in the video):
${creativeDirection}

Cinematic direction:
The camera should feel present, premium and organic.
Avoid static slideshow feeling.
Avoid simple slow zoom as the only motion.
Use real cinematic camera movement: travelling, dolly, push-in, pull-out, orbit, pan, depth movement, parallax depth, foreground and background movement.
The camera must feel alive, as if it is exploring the property with intention.
Use a smooth dynamic transition from image 1 to image 2 with strong commercial pacing.
Use cinematic transitions, not a basic fade slideshow.
Use golden light sweep, volumetric light, subtle particles, atmosphere, natural reflections, elegant lens flare, atmospheric depth, moving shadows and realistic window lighting.
Add a sense of depth and premium energy throughout the entire video.
Allow premium cinematic soundtrack, elegant sound design and natural commercial atmosphere.
Do not use narration.
Prepare the ending as a final CTA moment with impact, but do not write CTA text.
The result must feel like a polished premium real estate commercial, while remaining faithful to the two uploaded images.`

  if (prompt.includes('{') || prompt.includes('}')) {
    throw new Error('prompt_placeholder_detected')
  }

  return prompt
}

function buildActiveStudioHeroPrompt(input: {
  bairro: string
  caracteristica: string
  oferta: string
  cta: string
  style?: string
}) {
  return buildStudioHeroBriefingPrompt(
    input.bairro,
    input.cta,
    [input.oferta, input.caracteristica, input.style].filter(Boolean).join('. '),
  )
}

function getTokenCost() {
  const configured = Number(Deno.env.get('STUDIO_HERO_TOKEN_COST') || '')
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_TOKEN_COST
}

async function reserveCredits(supabase: ReturnType<typeof createClient>, userId: string, jobId: string, amount: number) {
  const idempotencyKey = `studio-hero:${jobId}`
  const { data, error } = await supabase.rpc('reserve_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_campaign_id: null,
    p_reason: 'studio-hero-video',
    p_metadata: {
      product: 'studio_hero',
      mode: 'dynamic_reel',
      job_id: jobId,
    },
  })

  if (error) throw new Error(error.message || 'credit_reservation_failed')
  const [reservation] = Array.isArray(data) ? data : []
  if (!reservation?.idempotency_key) throw new Error('credit_reservation_empty')
  return {
    id: reservation.id as string | undefined,
    idempotencyKey: reservation.idempotency_key as string,
    amount: Number(reservation.amount || amount),
    status: String(reservation.status || 'reserved'),
  }
}

async function cancelCredits(supabase: ReturnType<typeof createClient>, userId: string, idempotencyKey: string, reason: string) {
  if (!idempotencyKey) return
  const { error } = await supabase.rpc('cancel_credit_reservation', {
    p_user_id: userId,
    p_idempotency_key: idempotencyKey,
    p_reason: reason,
  })
  if (error) console.warn('[criar-video-ia] falha ao cancelar reserva:', error.message)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const reqId = crypto.randomUUID().slice(0, 8)
  let diagnosticStage = 'LOG 0 - inicializacao'
  let diagnosticContext: Record<string, unknown> = {}
  const markDiagnosticStage = (stage: string, context: Record<string, unknown> = {}) => {
    diagnosticStage = stage
    diagnosticContext = context
    logStudioHeroDiagnostic(reqId, stage, context)
  }

  try {
    markDiagnosticStage('LOG 1 - recebeu requisicao', {
      method: req.method,
      pathname: new URL(req.url).pathname,
      contentType: req.headers.get('content-type') || '',
    })

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ success: false, error: 'Configuracao indisponivel.' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) {
      console.warn(`[${reqId}] jwt invalido:`, authError?.message)
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.warn(`[${reqId}] perfil nao carregado para bypass admin:`, profileError.message)
    }

    const isAdminBypass = isAdminBypassUser((profileRow as ProfileRow | null) || null, user)

    const body = await req.json().catch(() => ({})) as JsonRecord
    const style = normalizeText(body.style, 40) || 'alto_padrao'
    const briefing = buildStructuredStudioHeroBriefing(body)
    const isFreeAiRequest = briefing.creativeMode === 'free_ai'
      || normalizeText(body.mode, 40).toLowerCase() === 'free_ai'
      || normalizeText(body.creativeMode, 40).toLowerCase() === 'free_ai'
    const inputImage1Path = isFreeAiRequest ? '' : normalizeStoragePath(body.inputImage1Path, user.id)
    const requestedJobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()
    markDiagnosticStage('LOG 1 OK - payload validado inicialmente', {
      userId: user.id,
      requestedJobId,
      creativeMode: briefing.creativeMode,
      isFreeAiRequest,
      hasInputImage1Path: Boolean(inputImage1Path),
      inputImage1Path,
      bucket: VIDEO_BUCKET,
      isAdminBypass,
    })

    if (!isFreeAiRequest && !inputImage1Path) {
      return jsonResponse({
        success: false,
        error: 'Envie a imagem do imovel antes de gerar.',
      }, 400)
    }

    if (!isFreeAiRequest && !isSupportedImagePath(inputImage1Path)) {
      return jsonResponse({
        success: false,
        error: 'Para este teste, envie imagens JPG ou PNG.',
      }, 400)
    }

    const expectedPrefix = `${user.id}/${requestedJobId}/`
    if (!isFreeAiRequest && !inputImage1Path.startsWith(expectedPrefix)) {
      return jsonResponse({
        success: false,
        error: 'Nao foi possivel validar a imagem enviada.',
      }, 400)
    }

    if (isFreeAiRequest) {
      markDiagnosticStage('LOG 2 OK - modo IA Livre sem upload', {
        jobId: requestedJobId,
        creativeMode: briefing.creativeMode,
      })
    } else {
      markDiagnosticStage('LOG 2 - carregando imagem do usuario', {
        bucket: VIDEO_BUCKET,
        storagePath: inputImage1Path,
      })
      const { data: userImageDiagnosticData, error: userImageDiagnosticError } = await supabase.storage
        .from(VIDEO_BUCKET)
        .download(inputImage1Path)

      if (userImageDiagnosticError || !userImageDiagnosticData) {
        throw new Error(`user_image_download_failed:${userImageDiagnosticError?.message || 'empty_file'}`)
      }

      const userImageDiagnosticBytes = new Uint8Array(await userImageDiagnosticData.arrayBuffer())
      markDiagnosticStage('LOG 2 OK - imagem usuario carregada', {
        bucket: VIDEO_BUCKET,
        storagePath: inputImage1Path,
        contentType: userImageDiagnosticData.type || '',
        byteLength: userImageDiagnosticBytes.byteLength,
      })
    }

    const model = Deno.env.get('VEO_MODEL_ID') || DEFAULT_MODEL
    const veoEnabled = Deno.env.get('VEO_ENABLED') === 'true'
    markDiagnosticStage('LOG 3 - perfil identificado', {
      objective: briefing.objective,
      profile: briefing.profile,
      propertyType: briefing.propertyType,
      creativeMode: briefing.creativeMode,
      isFreeAiRequest,
      matrixProfileGroup: getMatrixProfileGroup(briefing),
      model,
      veoEnabled,
    })

    const ctaFrame = isFreeAiRequest ? null : resolveStudioHeroCtaFrame(briefing)
    const inputImage2Path = ctaFrame
      ? await (async () => {
        markDiagnosticStage('LOG 4 - CTA escolhido', {
          selectedCta: ctaFrame.slug,
          label: ctaFrame.label,
          fileName: ctaFrame.fileName,
          publicPath: ctaFrame.publicPath,
          bucket: VIDEO_BUCKET,
          libraryPath: `${STUDIO_HERO_CTA_LIBRARY_PREFIX}/${ctaFrame.fileName}`,
        })

        const ctaPath = await uploadStudioHeroCtaFrame(supabase, {
          userId: user.id,
          jobId: requestedJobId,
          ctaFrame,
          reqId,
          markDiagnosticStage,
        })
        markDiagnosticStage('LOG 7 - lastFrame criado', {
          bucket: VIDEO_BUCKET,
          image1Path: inputImage1Path,
          image2Path: ctaPath,
          ctaFileName: ctaFrame.fileName,
          selectedCta: ctaFrame.slug,
        })
        return ctaPath
      })()
      : ''

    if (isFreeAiRequest) {
      markDiagnosticStage('LOG 7 - IA Livre sem lastFrame', {
        bucket: VIDEO_BUCKET,
        jobId: requestedJobId,
      })
    }

    const { data: job, error: insertError } = await supabase
      .from('video_jobs')
      .insert({
        id: requestedJobId,
        user_id: user.id,
        status: 'pending',
        mode: isFreeAiRequest ? 'free_ai' : 'dynamic_reel',
        style,
        model,
        prompt_final: null,
        input_image_1_path: inputImage1Path || null,
        input_image_2_path: inputImage2Path || null,
        tokens_reserved: 0,
      })
      .select('id')
      .single()

    if (insertError || !job?.id) {
      markDiagnosticStage('LOG 7 ERRO - falha ao criar video_jobs', {
        requestedJobId,
        userId: user.id,
        errorMessage: insertError?.message || 'empty_job',
      })
      return jsonResponse({
        success: false,
        error: `Falha em LOG 7 ao criar job: ${insertError?.message || 'empty_job'}`,
      }, 500)
    }

    markDiagnosticStage('LOG 7 OK - job criado', {
      jobId: job.id,
      userId: user.id,
      inputImage1Path,
      inputImage2Path,
      ctaFileName: ctaFrame?.fileName || null,
      isFreeAiRequest,
    })

    if (!veoEnabled) {
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: 'veo_disabled',
          tokens_reserved: 0,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      console.warn(`[${reqId}] Studio Hero em modo teste: Veo desligado.`)
      return jsonResponse({
        success: false,
        job_id: job.id,
        jobId: job.id,
        status: 'disabled',
        error: 'Falha em LOG 7 OK - job criado: veo_disabled',
      }, 503)
    }

    const tokenCost = isAdminBypass ? 0 : getTokenCost()
    let creditIdempotencyKey = ''

    try {
      markDiagnosticStage('LOG 7.1 - preparando Smart Tokens', {
        jobId: job.id,
        userId: user.id,
        tokenCost,
        isAdminBypass,
      })

      if (tokenCost > 0) {
        const reservation = await reserveCredits(supabase, user.id, job.id, tokenCost)
        creditIdempotencyKey = reservation.idempotencyKey

        await supabase
          .from('video_jobs')
          .update({
            status: 'generating',
            tokens_reserved: reservation.amount,
            credit_reservation_id: reservation.id || null,
            credit_idempotency_key: reservation.idempotencyKey,
          })
          .eq('id', job.id)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('video_jobs')
          .update({
            status: 'generating',
            tokens_reserved: 0,
            credit_reservation_id: null,
            credit_idempotency_key: null,
          })
          .eq('id', job.id)
          .eq('user_id', user.id)
      }

      markDiagnosticStage('LOG 7.1 OK - Smart Tokens preparados', {
        jobId: job.id,
        tokenCost,
        hasCreditReservation: Boolean(creditIdempotencyKey),
        isAdminBypass,
      })

      const metadataChat = {
        bairro: briefing.normalizedLocation || briefing.district || briefing.location || normalizeText(body.bairro, 80) || '',
        caracteristica: briefing.finalFeatures
          || briefing.differentials[0]
          || normalizeText(body.caracteristica, 80)
          || normalizeText(body.tipoImovel ?? body.propertyType, 80)
          || '',
        oferta: briefing.offer || normalizeText(body.oferta, 40) || '',
        cta: briefing.cta || normalizeText(body.cta, 40) || '',
        dadosImovelText: buildVoiceoverFactsText([
          briefing.objectiveLabel || briefing.objective,
          briefing.propertyType,
          briefing.profile,
          briefing.stage,
          briefing.location,
          briefing.bedrooms,
          briefing.suites,
          briefing.parking,
          briefing.finalFeatures,
          ...briefing.differentials,
          briefing.offer,
          briefing.cta,
        ]),
      }
      const promptMode = resolveStudioHeroPromptMode(Deno.env.get('STUDIO_HERO_PROMPT_MODE'))
      let promptFinal = ''
      let visualPromptForDebug = ''
      let voiceoverPromptForDebug = ''
      let promptProfileKey = 'champion_library'
      let visibleTextCount = 0
      let visibleTextsForDebug: string[] = []

      if (promptMode === 'json') {
        const jsonPrompt = buildStudioHeroJsonPrompt({ briefing, metadataChat, ctaFrame })
        promptFinal = jsonPrompt.prompt
        visualPromptForDebug = promptFinal
        promptProfileKey = jsonPrompt.profileKey
        visibleTextCount = jsonPrompt.visibleTexts.length
        visibleTextsForDebug = jsonPrompt.visibleTexts
      } else if (promptMode === 'classic' || promptMode === 'matrix_v1') {
        const matrixPrompt = buildStudioHeroMatrixPrompt(briefing, metadataChat)
        promptFinal = matrixPrompt.prompt
        visualPromptForDebug = matrixPrompt.visualPrompt
        voiceoverPromptForDebug = matrixPrompt.voiceoverPrompt
        promptProfileKey = matrixPrompt.profileKey
        visibleTextCount = matrixPrompt.visibleTexts.length
        visibleTextsForDebug = matrixPrompt.visibleTexts
      } else if (promptMode === 'static_champion') {
        console.log('[DIAGNOSTICO] Ativando Modo Prompt Campeao Estatico. Ignorando OpenAI e Creative Director.')
        promptFinal = buildStaticChampionPrompt(metadataChat.bairro, metadataChat.cta, metadataChat.dadosImovelText)
        visualPromptForDebug = promptFinal
        promptProfileKey = 'static_champion'
        visibleTextCount = 2
      } else if (promptMode === 'purist_two_texts') {
        console.log('[DIAGNOSTICO] Ativando Modo Purista Dois Textos. Mantendo narracao somente no prompt.')
        promptFinal = buildStaticChampionPrompt(metadataChat.bairro, metadataChat.cta, metadataChat.dadosImovelText)
        visualPromptForDebug = promptFinal
        promptProfileKey = 'purist_two_texts'
        visibleTextCount = 2
      } else if (promptMode === 'short_ad_script') {
        const shortAdPrompt = buildShortAdScriptPrompt(briefing, metadataChat)
        promptFinal = shortAdPrompt.prompt
        visualPromptForDebug = promptFinal
        voiceoverPromptForDebug = shortAdPrompt.voiceoverScript
        promptProfileKey = 'short_ad_script'
        visibleTextCount = 2
      } else {
        const championPrompt = buildChampionStudioHeroPrompt({
          objetivo: briefing.objectiveLabel || briefing.objective,
          perfil: briefing.profile || style,
          tipoImovel: briefing.propertyType,
          bairro: metadataChat.bairro,
          cidade: briefing.city,
          area: normalizeText(body.area, 24),
          dormitorios: normalizeText(body.dormitorios ?? body.bedrooms, 24),
          suites: normalizeText(body.suites, 24),
          vagas: normalizeText(body.vagas ?? body.parking, 24),
          diferenciais: [
            briefing.finalFeatures,
            ...briefing.differentials,
          ].filter(Boolean),
          oferta: metadataChat.oferta,
          cta: metadataChat.cta,
        })
        promptFinal = championPrompt.prompt
        visualPromptForDebug = promptFinal
        promptProfileKey = championPrompt.profileKey
        visibleTextCount = championPrompt.visibleTexts.length
        visibleTextsForDebug = championPrompt.visibleTexts
      }

      if (!visualPromptForDebug) visualPromptForDebug = promptFinal

      if (promptMode !== 'json' && (promptFinal.includes('{') || promptFinal.includes('}'))) {
        throw new Error('prompt_placeholder_detected')
      }

      markDiagnosticStage('LOG 8 - montando payload Veo', {
        jobId: job.id,
        promptMode,
        profileKey: promptProfileKey,
        promptLength: promptFinal.length,
        visibleTextCount,
        visibleTexts: visibleTextsForDebug,
        bucket: VIDEO_BUCKET,
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
        ctaFileName: ctaFrame?.fileName || null,
        selectedCta: ctaFrame?.slug || null,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        sampleCount: 1,
        isFreeAiRequest,
      })

      console.info(`[${reqId}] Studio Hero prompt preparado`, {
        promptMode,
        profileKey: promptProfileKey,
        promptLength: promptFinal.length,
        visibleTextCount,
        hasImage: Boolean(inputImage1Path),
        isFreeAiRequest,
      })

      await uploadStudioHeroPromptDebug(supabase, {
        userId: user.id,
        jobId: job.id,
        prompt: promptFinal,
        visualPrompt: visualPromptForDebug,
        voiceoverPrompt: voiceoverPromptForDebug,
        model,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        sampleCount: 1,
        promptMode,
        matrixId: promptProfileKey,
        visibleTexts: visibleTextsForDebug,
        image1Path: inputImage1Path || undefined,
        image2Path: inputImage2Path || undefined,
      })

      markDiagnosticStage('LOG 8 OK - payload Veo preparado', {
        jobId: job.id,
        promptLength: promptFinal.length,
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
        isFreeAiRequest,
      })

      markDiagnosticStage('LOG 9 - enviando para Veo', {
        jobId: job.id,
        model,
        bucket: VIDEO_BUCKET,
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
        isFreeAiRequest,
      })

      const veoResult = await startVeoVideo({
        prompt: promptFinal,
        image1Path: inputImage1Path || undefined,
        image2Path: inputImage2Path || undefined,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        userId: user.id,
        jobId: job.id,
        bucket: VIDEO_BUCKET,
        supabase,
      })

      markDiagnosticStage('LOG 9 OK - Veo aceitou requisicao', {
        jobId: job.id,
        hasProviderJobId: Boolean(veoResult.providerJobId),
      })

      await supabase
        .from('video_jobs')
        .update({
          status: 'generating',
          provider_job_id: veoResult.providerJobId,
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      return jsonResponse({
        ok: true,
        success: true,
        jobId: job.id,
        job_id: job.id,
        status: 'generating',
        message: 'Gerando seu video.',
      })
    } catch (error) {
      const diagnosticError = formatDiagnosticError(error)
      console.error(`[${reqId}] Studio Hero excecao detalhada`, {
        stage: diagnosticStage,
        context: diagnosticContext,
        error: diagnosticError,
        bucket: VIDEO_BUCKET,
        ctaFileName: ctaFrame?.fileName || null,
        ctaSelected: ctaFrame?.slug || null,
        ctaLibraryPath: ctaFrame ? `${STUDIO_HERO_CTA_LIBRARY_PREFIX}/${ctaFrame.fileName}` : null,
        inputImage1Path,
        inputImage2Path,
        jobId: job.id,
      })

      await cancelCredits(supabase, user.id, creditIdempotencyKey, 'studio_hero_failed')
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: `${diagnosticStage}: ${safeDiagnosticMessage(error)}`.slice(0, 500),
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      return jsonResponse({
        success: false,
        job_id: job.id,
        status: 'failed',
        error: `Falha em ${diagnosticStage}: ${safeDiagnosticMessage(error)}`,
      }, 503)
    }
  } catch (error) {
    const diagnosticError = formatDiagnosticError(error)
    console.error(`[${reqId}] criar-video-ia erro inesperado detalhado`, {
      stage: diagnosticStage,
      context: diagnosticContext,
      error: diagnosticError,
      bucket: VIDEO_BUCKET,
    })
    return jsonResponse({
      success: false,
      error: `Falha em ${diagnosticStage}: ${safeDiagnosticMessage(error)}`,
    }, 500)
  }
})

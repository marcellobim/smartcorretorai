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
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
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

function buildVoiceoverFactsText(values: unknown[]) {
  return values
    .map((value) => normalizeText(value, 120))
    .filter(Boolean)
    .join('. ')
    .slice(0, 900)
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
    creativeMode: getBriefingValue(briefing, 'creativeMode', 'cinematic'),
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
  model: string
  aspectRatio: string
  durationSeconds: number
  resolution: string
  sampleCount: number
  promptMode: string
  image1Path: string
  image2Path: string
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
    const imageMimeType = inferSupportedImageMimeType(input.image1Path)
    const lastFrameMimeType = inferSupportedImageMimeType(input.image2Path)
    const metaPath = `${input.userId}/${input.jobId}/debug/payload-meta.json`

    console.info('[DIAGNOSTICO] Studio Hero debug paths', {
      promptPath,
      metaPath,
      promptLength: input.prompt.length,
    })

    const promptUpload = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(promptPath, new TextEncoder().encode(input.prompt), {
        contentType: 'text/plain',
        upsert: true,
      })

    if (promptUpload.error) {
      console.error('[DIAGNOSTICO] upload prompt error', {
        promptPath,
        error: promptUpload.error.message,
      })
    } else {
      console.info('[DIAGNOSTICO] upload prompt success', { promptPath })
    }

    const metaPayload = {
      model: input.model,
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: input.resolution,
      sampleCount: input.sampleCount,
      hasImage: Boolean(input.image1Path),
      hasLastFrame: Boolean(input.image2Path),
      imageMimeType,
      lastFrameMimeType,
      promptLength: input.prompt.length,
      promptMode: input.promptMode || 'champion_library',
    }

    const metaUpload = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(metaPath, new TextEncoder().encode(JSON.stringify(metaPayload, null, 2)), {
        contentType: 'application/json',
        upsert: true,
      })

    if (metaUpload.error) {
      console.error('[DIAGNOSTICO] upload meta error', {
        metaPath,
        error: metaUpload.error.message,
      })
    } else {
      console.info('[DIAGNOSTICO] upload meta success', { metaPath })
    }

    console.info('[DIAGNOSTICO] Studio Hero debug concluido', {
      promptUploaded: !promptUpload.error,
      metaUploaded: !metaUpload.error,
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

  try {
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
    const inputImage1Path = normalizeStoragePath(body.inputImage1Path, user.id)
    const inputImage2Path = inputImage1Path
    const requestedJobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()

    if (!inputImage1Path) {
      return jsonResponse({
        success: false,
        error: 'Envie a melhor foto do imovel antes de gerar.',
      }, 400)
    }

    if (!isSupportedImagePath(inputImage1Path)) {
      return jsonResponse({
        success: false,
        error: 'Para este teste, envie imagens JPG ou PNG.',
      }, 400)
    }

    const expectedPrefix = `${user.id}/${requestedJobId}/`
    if (!inputImage1Path.startsWith(expectedPrefix)) {
      return jsonResponse({
        success: false,
        error: 'Nao foi possivel validar as imagens enviadas.',
      }, 400)
    }

    const model = Deno.env.get('VEO_MODEL_ID') || DEFAULT_MODEL
    const veoEnabled = Deno.env.get('VEO_ENABLED') === 'true'

    const { data: job, error: insertError } = await supabase
      .from('video_jobs')
      .insert({
        id: requestedJobId,
        user_id: user.id,
        status: 'pending',
        mode: 'dynamic_reel',
        style,
        model,
        prompt_final: null,
        input_image_1_path: inputImage1Path,
        input_image_2_path: inputImage2Path,
        tokens_reserved: 0,
      })
      .select('id')
      .single()

    if (insertError || !job?.id) {
      console.warn(`[${reqId}] video_jobs insert falhou:`, insertError?.message)
      return jsonResponse({ success: false, error: 'Nao foi possivel iniciar o video.' }, 500)
    }

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
        error: 'Nao foi possivel gerar o video neste momento.',
      }, 503)
    }

    const tokenCost = isAdminBypass ? 0 : getTokenCost()
    let creditIdempotencyKey = ''

    try {
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

      const briefing = buildStructuredStudioHeroBriefing(body)
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
          briefing.finalFeatures,
          ...briefing.differentials,
          briefing.offer,
          briefing.cta,
        ]),
      }
      const promptMode = Deno.env.get('STUDIO_HERO_PROMPT_MODE') || ''
      let promptFinal = ''
      let promptProfileKey = 'champion_library'
      let visibleTextCount = 0

      if (promptMode === 'static_champion') {
        console.log('[DIAGNOSTICO] Ativando Modo Prompt Campeao Estatico. Ignorando OpenAI e Creative Director.')
        promptFinal = buildStaticChampionPrompt(metadataChat.bairro, metadataChat.cta, metadataChat.dadosImovelText)
        promptProfileKey = 'static_champion'
        visibleTextCount = 2
      } else if (promptMode === 'purist_two_texts') {
        console.log('[DIAGNOSTICO] Ativando Modo Purista Dois Textos. Mantendo narracao somente no prompt.')
        promptFinal = buildStaticChampionPrompt(metadataChat.bairro, metadataChat.cta, metadataChat.dadosImovelText)
        promptProfileKey = 'purist_two_texts'
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
        promptProfileKey = championPrompt.profileKey
        visibleTextCount = championPrompt.visibleTexts.length
      }

      if (promptFinal.includes('{') || promptFinal.includes('}')) {
        throw new Error('prompt_placeholder_detected')
      }

      console.info(`[${reqId}] Studio Hero prompt preparado`, {
        promptMode: promptMode || 'champion_library',
        profileKey: promptProfileKey,
        promptLength: promptFinal.length,
        visibleTextCount,
        hasImage: true,
      })

      await uploadStudioHeroPromptDebug(supabase, {
        userId: user.id,
        jobId: job.id,
        prompt: promptFinal,
        model,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        sampleCount: 1,
        promptMode: promptMode || 'champion_library',
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
      })

      const veoResult = await startVeoVideo({
        prompt: promptFinal,
        image1Path: inputImage1Path,
        image2Path: inputImage2Path,
        aspectRatio: '9:16',
        durationSeconds: 8,
        resolution: '720p',
        userId: user.id,
        jobId: job.id,
        bucket: VIDEO_BUCKET,
        supabase,
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
      await cancelCredits(supabase, user.id, creditIdempotencyKey, 'studio_hero_failed')
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
        })
        .eq('id', job.id)
        .eq('user_id', user.id)

      console.warn(`[${reqId}] Studio Hero falhou:`, error instanceof Error ? error.message : String(error))
      return jsonResponse({
        success: false,
        job_id: job.id,
        status: 'failed',
        error: 'Nao foi possivel gerar o video neste momento.',
      }, 503)
    }
  } catch (error) {
    console.error(`[${reqId}] criar-video-ia erro inesperado:`, error instanceof Error ? error.message : String(error))
    return jsonResponse({ success: false, error: 'Erro inesperado ao preparar o video.' }, 500)
  }
})

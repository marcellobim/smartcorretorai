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

function normalizePromptText(value: unknown, maxLength = 48) {
  return normalizeText(value, maxLength)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[{}]/g, '')
    .replace(/[^\w\s.,:;!?%$/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
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

  const prompt = `Create one single vertical cinematic real estate commercial for Studio Hero Premium.

Format: 9:16.
Duration: 8 seconds.
Resolution target: 720p.

Main goal:
This is not an informative video.
This is a high-impact advertising piece.
Its function is to stop the scroll, create emotion, create curiosity and lead to a click.
Complete property information belongs to Landing Page, WhatsApp or listing portals, not this video.
Create a cinematic real estate commercial inspired by the uploaded images and by the broker's creative choices.

Use the two uploaded property images as the visual foundation and source of truth.
Image 1 is the opening and initial development.
Image 2 is the mandatory final scene and must have clear protagonism.

Controlled narrative:
Open on image 1 with cinematic movement and depth.
Develop image 1 with realistic camera motion, light and atmosphere.
Transition from image 1 to image 2 without inventing any new environment.
Reveal image 2 as the strongest and most important visual moment.
End on image 2 with a clean cinematic final frame.
Do not create any additional visual scene between image 1 and image 2.

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

Image 2 rules:
Image 2 must not be only a background.
Image 2 must receive visual focus and text information.
Image 2 must receive cinematic movement, premium lighting, depth and atmosphere.
Image 2 must occupy the final part of the video.
The last commercial information must appear on image 2.
The final scene on image 2 must be the strongest moment of the video.

Text rules:
Maximum two text moments generated by Veo in the entire video.
Each text moment must contain only one word, or exceptionally two very short words.
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
The camera should feel present and organic.
Avoid simple slow zoom as the only motion.
Use stronger cinematic movement when appropriate: zoom, travelling, pan, dolly, depth, parallax, foreground and background movement.
The camera must feel alive, as if it is exploring the property with intention.
Use cinematic transitions and short commercial pacing.
Use light, subtle particles, atmosphere, natural reflections, elegant lens flare, atmospheric depth, moving shadows and realistic window lighting.
Allow premium cinematic soundtrack, elegant sound design and natural commercial atmosphere.
Do not use narration.
The result must feel like a polished real estate social video, while remaining faithful to the two uploaded images.`

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
  if (PROMPT_TEST_MODE === 'controlled_narrative') {
    return buildStudioHeroVeoPromptControlledNarrativeTest(input)
  }
  if (PROMPT_TEST_MODE === 'narrative') {
    return buildStudioHeroVeoPromptNarrativeTest(input)
  }
  return buildPromptFinal(input)
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
    const bairro = normalizeText(body.bairro, 40).toUpperCase() || 'MOEMA'
    const caracteristica = normalizeText(body.caracteristica, 50).toUpperCase() || '4 SUITES'
    const oferta = normalizeText(body.oferta, 40).toUpperCase() || 'A VENDA'
    const cta = normalizeText(body.cta, 60).toUpperCase() || 'AGENDE SUA VISITA'
    const inputImage1Path = normalizeStoragePath(body.inputImage1Path, user.id)
    const inputImage2Path = normalizeStoragePath(body.inputImage2Path, user.id)
    const requestedJobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()

    if (!inputImage1Path || !inputImage2Path) {
      return jsonResponse({
        success: false,
        error: 'Envie as duas imagens do video antes de gerar.',
      }, 400)
    }

    if (!isSupportedImagePath(inputImage1Path) || !isSupportedImagePath(inputImage2Path)) {
      return jsonResponse({
        success: false,
        error: 'Para este teste, envie imagens JPG ou PNG.',
      }, 400)
    }

    const expectedPrefix = `${user.id}/${requestedJobId}/`
    if (!inputImage1Path.startsWith(expectedPrefix) || !inputImage2Path.startsWith(expectedPrefix)) {
      return jsonResponse({
        success: false,
        error: 'Nao foi possivel validar as imagens enviadas.',
      }, 400)
    }

    const promptFinal = buildActiveStudioHeroPrompt({ bairro, caracteristica, oferta, cta, style })
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

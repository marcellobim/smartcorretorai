import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkVeoVideoStatus, startVeoVideo } from '../_shared/veoClient.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

const VIDEO_BUCKET = 'studio-videos'
const MAX_IMAGES = 9
const MIN_IMAGES = 1
const MOTION_CLIP_SECONDS = 8
const MOTION_VEO_MODEL = 'veo-3.1-lite-generate-preview'
const MOTION_POLL_INTERVAL_MS = 5000
const MOTION_POLL_TIMEOUT_MS = 120000
const SUPPORTED_IMAGE_PATH = /\.(jpe?g|png)$/i
const SAFE_TEXT_PATTERN = /[^A-Z0-9\s/-]/g

type JsonRecord = Record<string, unknown>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeText(value: unknown, maxLength = 80) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SAFE_TEXT_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
}

function normalizeModeToken(value: unknown, maxLength = 80) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s_/-]/g, ' ')
    .replace(/[\s/-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, maxLength)
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function normalizeStoragePath(value: unknown, userId: string, jobId: string) {
  const raw = String(value || '').trim().replace(/^\/+/, '')
  if (!raw || raw.includes('..') || raw.includes('\\')) return ''
  if (!raw.startsWith(`${userId}/${jobId}/`)) return ''
  if (!SUPPORTED_IMAGE_PATH.test(raw)) return ''
  return raw
}

function normalizeImagePaths(value: unknown, userId: string, jobId: string) {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const item of value) {
    const path = normalizeStoragePath(item, userId, jobId)
    if (path) unique.add(path)
  }
  return Array.from(unique).slice(0, MAX_IMAGES)
}

function buildMotionPrompt(input: {
  pairLabel: string
  fidelityMode: string
  movement: string
  lighting: string
  atmosphere: string
  rhythm: string
  cinematicEffects: string
}) {
  return [
    'Create a vertical 9:16 cinematic motion video.',
    '',
    `Use ${input.pairLabel}.`,
    `Duration: ${MOTION_CLIP_SECONDS} seconds.`,
    '',
    'Preserve the real property identity, architecture, layout, furniture, materials, colors and proportions.',
    'Keep the result realistic and visually coherent with the uploaded property images.',
    '',
    'Visual direction:',
    `- fidelity mode: ${input.fidelityMode}`,
    `- camera movement: ${input.movement}`,
    `- lighting: ${input.lighting}`,
    `- atmosphere: ${input.atmosphere}`,
    `- rhythm: ${input.rhythm}`,
    `- cinematic effects: ${input.cinematicEffects}`,
    '',
    'Use smooth transitions, natural depth, subtle parallax, consistent exposure and coherent color grading.',
    'Maintain realistic scale, stable geometry and continuous camera flow.',
    'Do not add text, captions, CTA, narration, music, sound effects, logos, brand marks or branding.',
  ].join('\n')
}

function buildMotionJobs(input: {
  imagePaths: string[]
  fidelityMode: string
  movement: string
  lighting: string
  atmosphere: string
  rhythm: string
  cinematicEffects: string
}) {
  const jobs = []
  const { imagePaths } = input
  for (let index = 0; index < imagePaths.length - 1; index += 1) {
    jobs.push({
      index: index + 1,
      from: imagePaths[index],
      to: imagePaths[index + 1],
      role: 'motion_pair',
      durationSeconds: MOTION_CLIP_SECONDS,
      prompt: buildMotionPrompt({
        ...input,
        pairLabel: `image ${index + 1} as the opening frame and image ${index + 2} as the ending frame`,
      }),
    })
  }

  jobs.push({
    index: imagePaths.length,
    from: imagePaths[imagePaths.length - 1],
    to: '',
    role: 'single_image_motion',
    durationSeconds: MOTION_CLIP_SECONDS,
    prompt: buildMotionPrompt({
      ...input,
      pairLabel: `image ${imagePaths.length} as the opening frame only`,
    }),
  })

  return jobs
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeProviderError(value: unknown, maxLength = 500) {
  return String(value || '')
    .replace(/key=[A-Za-z0-9._~-]+/gi, 'key=[redacted]')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_api_key]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

async function createSignedVideoUrl(supabase: ReturnType<typeof createClient>, path: string) {
  const { data, error } = await supabase.storage
    .from(VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 10)
  if (error || !data?.signedUrl) throw new Error(`motion_signed_url_failed:${error?.message || 'empty_url'}`)
  return data.signedUrl
}

async function waitForMotionVideo(providerJobId: string) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < MOTION_POLL_TIMEOUT_MS) {
    const status = await checkVeoVideoStatus(providerJobId)
    if (status.status !== 'processing') return status
    await sleep(MOTION_POLL_INTERVAL_MS)
  }

  return {
    status: 'failed' as const,
    errorMessage: 'veo_poll_timeout',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Metodo nao permitido.' }, 405)
    }

    if (String(Deno.env.get('STUDIO_HERO_MULTI_IMAGE_ENABLED') || '').toLowerCase() !== 'true') {
      return jsonResponse({ success: false, error: 'Este modo ainda nao esta ativo neste ambiente.' }, 404)
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
      return jsonResponse({ success: false, error: 'Sessao invalida.' }, 401)
    }

    const body = await req.json().catch(() => ({})) as JsonRecord
    const jobId = isUuid(body.jobId) ? String(body.jobId) : crypto.randomUUID()
    const variant = normalizeModeToken(body.variant, 24)
    const requestedMode = normalizeModeToken(body.mode, 40)
    const isMotionRequest = requestedMode === 'STUDIO_HERO_MOTION' && variant === 'CLEAN'

    if (!isMotionRequest) {
      return jsonResponse({
        success: false,
        error: 'Neste MVP, o modo multi-imagens disponivel e Motion sem textos.',
      }, 501)
    }

    const imagePaths = normalizeImagePaths(body.imagePaths, user.id, jobId)
    const veoEnabled = Deno.env.get('VEO_ENABLED') === 'true'
    const motionStartVeo = String(Deno.env.get('STUDIO_HERO_MOTION_START_VEO') || '').toLowerCase() === 'true'
    const shouldStartVeo = veoEnabled && motionStartVeo
    const fidelityMode = normalizeText(body.fidelityMode, 48) || 'HIGH_FIDELITY'
    const movement = normalizeText(body.movement, 80) || 'SMOOTH CINEMATIC CAMERA MOVEMENT'
    const lighting = normalizeText(body.lighting, 80) || 'SOFT PREMIUM NATURAL LIGHT'
    const atmosphere = normalizeText(body.atmosphere, 80) || 'CLEAN CINEMATIC REAL ESTATE ATMOSPHERE'
    const rhythm = normalizeText(body.rhythm, 80) || 'CALM BALANCED MOTION'
    const cinematicEffects = normalizeText(body.cinematicEffects, 80) || 'SUBTLE DEPTH REFLECTIONS AND LIGHT SWEEP'

    if (imagePaths.length < MIN_IMAGES) {
      return jsonResponse({ success: false, error: 'Envie uma imagem JPG ou PNG.' }, 400)
    }

    if (imagePaths.length !== 1) {
      return jsonResponse({
        success: false,
        error: 'Neste primeiro teste do Motion, envie exatamente uma imagem.',
      }, 400)
    }

    for (const path of imagePaths) {
      const { data, error } = await supabase.storage.from(VIDEO_BUCKET).download(path)
      if (error || !data) {
        return jsonResponse({ success: false, error: 'Nao foi possivel validar uma das imagens enviadas.' }, 400)
      }
    }

    const jobs = buildMotionJobs({
      imagePaths,
      fidelityMode,
      movement,
      lighting,
      atmosphere,
      rhythm,
      cinematicEffects,
    })
    const totalDurationSeconds = jobs.length * MOTION_CLIP_SECONDS
    const reportPath = `${user.id}/${jobId}/motion-plan.json`
    const outputPath = `${user.id}/${jobId}/motion-final.mp4`
    const veoJobs = []
    const clipResults = jobs.map((job) => ({
      index: job.index,
      role: job.role,
      status: 'pending',
      providerJobId: '',
      clipPath: `${user.id}/${jobId}/clips/clip-${String(job.index).padStart(2, '0')}.mp4`,
      durationSeconds: job.durationSeconds,
    }))

    const { error: jobInsertError } = await supabase
      .from('video_jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        status: 'generating',
        mode: 'studio_hero_motion',
        style: 'motion_sem_textos',
        model: MOTION_VEO_MODEL,
        prompt_final: jobs.map((job) => `# Clip ${job.index}\n${job.prompt}`).join('\n\n---\n\n'),
        input_image_1_path: imagePaths[0] || null,
        input_image_2_path: null,
        tokens_reserved: 0,
      })

    if (jobInsertError) {
      return jsonResponse({ success: false, error: `Falha ao criar job Motion: ${jobInsertError.message}` }, 500)
    }

    if (shouldStartVeo) {
      const job = jobs[0]
      try {
        const veoResult = await startVeoVideo({
          prompt: job.prompt,
          image1Path: job.from,
          image2Path: job.to || undefined,
          aspectRatio: '9:16',
          durationSeconds: MOTION_CLIP_SECONDS,
          resolution: '720p',
          modelId: MOTION_VEO_MODEL,
          userId: user.id,
          jobId: `${jobId}-clip-${job.index}`,
          bucket: VIDEO_BUCKET,
          supabase,
        })

        veoJobs.push({
          index: job.index,
          role: job.role,
          providerJobId: veoResult.providerJobId,
          status: 'generating',
        })
        const clipResult = clipResults.find((item) => item.index === job.index)
        if (clipResult) {
          clipResult.providerJobId = veoResult.providerJobId
          clipResult.status = 'generating'
        }

        await supabase
          .from('video_jobs')
          .update({
            provider_job_id: veoResult.providerJobId,
          })
          .eq('id', jobId)
          .eq('user_id', user.id)

        const providerStatus = await waitForMotionVideo(veoResult.providerJobId)
        if (providerStatus.status === 'failed') {
          const errorMessage = sanitizeProviderError(providerStatus.errorMessage)
          await supabase
            .from('video_jobs')
            .update({
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', jobId)
            .eq('user_id', user.id)

          return jsonResponse({
            ok: false,
            success: false,
            jobId,
            job_id: jobId,
            status: 'failed',
            error: 'Nao foi possivel gerar o Motion neste momento.',
            errorMessage,
          }, errorMessage === 'veo_poll_timeout' ? 504 : 502)
        }

        const { error: uploadError } = await supabase.storage
          .from(VIDEO_BUCKET)
          .upload(outputPath, providerStatus.videoBytes, {
            contentType: providerStatus.contentType || 'video/mp4',
            cacheControl: '3600',
            upsert: true,
          })
        if (uploadError) throw new Error(`motion_video_upload_failed:${uploadError.message}`)

        const signedVideoUrl = await createSignedVideoUrl(supabase, outputPath)
        await supabase
          .from('video_jobs')
          .update({
            status: 'completed',
            output_video_path: outputPath,
            signed_video_url: signedVideoUrl,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .eq('user_id', user.id)

        const completedClipResult = clipResults.find((item) => item.index === job.index)
        if (completedClipResult) {
          completedClipResult.status = 'completed'
          completedClipResult.clipPath = outputPath
        }
      } catch (error) {
        const errorMessage = sanitizeProviderError(error instanceof Error ? error.message : String(error))
        await supabase
          .from('video_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', jobId)
          .eq('user_id', user.id)

        return jsonResponse({
          ok: false,
          success: false,
          jobId,
          job_id: jobId,
          status: 'failed',
          error: 'Nao foi possivel gerar o Motion neste momento.',
          errorMessage,
        }, 502)
      }
    }

    const report = {
      mode: 'studio_hero_motion',
      jobId,
      userId: user.id,
      bucket: VIDEO_BUCKET,
      imagePaths,
      durationSecondsPerClip: MOTION_CLIP_SECONDS,
      totalDurationSeconds,
      outputPath,
      reportPath,
      jobs,
      veoJobs,
      clipResults,
      merge: {
        status: shouldStartVeo ? 'not_required_single_clip' : 'pending_worker',
        required: !shouldStartVeo,
        strategy: shouldStartVeo ? 'single_clip_saved_as_final_mp4' : 'download_completed_clips_then_concat_to_single_mp4',
        inputClipPaths: clipResults.map((clip) => clip.clipPath),
        outputPath,
      },
      textPolicy: {
        text: false,
        cta: false,
        narration: false,
        music: false,
        logo: false,
        branding: false,
      },
    }

    if (shouldStartVeo) {
      const signedVideoUrl = await createSignedVideoUrl(supabase, outputPath)
      return jsonResponse({
        ok: true,
        success: true,
        jobId,
        job_id: jobId,
        status: 'ready',
        renderStatus: 'ready',
        ready: true,
        renderReady: true,
        message: 'Seu Motion esta pronto.',
        bucket: VIDEO_BUCKET,
        outputPath,
        storagePath: outputPath,
        videoPath: outputPath,
        signedVideoUrl,
        signed_url: signedVideoUrl,
        signedUrl: signedVideoUrl,
        videoUrl: signedVideoUrl,
        imagePaths,
        durationSeconds: MOTION_CLIP_SECONDS,
        durationSecondsPerClip: MOTION_CLIP_SECONDS,
        totalDurationSeconds,
        jobs,
        veoJobs,
        clipResults,
        report,
        warnings: [
          'Motion real gerado com 1 imagem inicial, sem lastFrame.',
          'Textos, CTA, narracao, musica, sons e branding permaneceram desativados.',
        ],
      })
    }

    return jsonResponse({
      ok: true,
      success: true,
      jobId,
      job_id: jobId,
      status: 'planned',
      message: 'Seu Motion foi preparado para processamento.',
      renderReady: false,
      bucket: VIDEO_BUCKET,
      imagePaths,
      durationSecondsPerClip: MOTION_CLIP_SECONDS,
      totalDurationSeconds,
      jobs,
      veoJobs,
      clipResults,
      mergeInput: {
        clipPaths: clipResults.map((clip) => clip.clipPath),
        outputPath,
      },
      outputPath,
      reportPath,
      report,
      warnings: [
        'Motion MVP: textos, CTA, narracao, musica, sons e branding desativados.',
        'A funcao valida entradas, salva frame neutro e monta jobs de 4s automaticamente.',
        'O merge final em MP4 unico deve ser executado por worker/renderizador com FFmpeg quando os clipes estiverem prontos.',
      ],
    })
  } catch (error) {
    console.error('[criar-video-ia-multi] erro inesperado:', error)
    return jsonResponse({ success: false, error: 'Nao foi possivel preparar este tour.' }, 500)
  }
})

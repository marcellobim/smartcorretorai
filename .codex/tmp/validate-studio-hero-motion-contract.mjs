import { createStudioHeroMotionPlan } from '../../core/smart-motion-engine/planner.ts'

const forbiddenPromptTerms = [
  'text',
  'caption',
  'hard word',
  'cta',
  'logo',
  'watermark',
  'phone',
  'address',
  'narration',
  'voiceover',
  'music',
  'audio',
  'sound',
  'branding',
  'marketing',
  'commercial offer',
]

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function normalizeStoragePath(value, userId, jobId) {
  const raw = String(value || '').trim().replace(/^\/+/, '')
  if (!raw || raw.includes('..') || raw.includes('\\')) return ''
  if (!raw.startsWith(`${userId}/${jobId}/`)) return ''
  if (!/\.(jpe?g|png)$/i.test(raw)) return ''
  return raw
}

function findForbiddenPromptTerms(prompt) {
  const lower = prompt.toLowerCase()
  return forbiddenPromptTerms.filter((term) => lower.includes(term))
}

function simulateEdgeContract(payload, options = {}) {
  const userId = options.userId || '11111111-1111-4111-8111-111111111111'
  if (!options.authenticated) {
    return { ok: false, statusCode: 401, error: 'Sessao invalida.' }
  }

  const jobId = isUuid(payload.jobId) ? payload.jobId : '22222222-2222-4222-8222-222222222222'
  const variant = String(payload.variant || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const mode = String(payload.mode || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const isMotionRequest = variant === 'CLEAN'
    || mode === 'MULTI_IMAGE_TOUR'
    || mode === 'STUDIO_HERO_MOTION'
    || mode === 'MOTION'

  if (!isMotionRequest) {
    return { ok: false, statusCode: 501, error: 'Neste MVP, o modo multi-imagens disponivel e Motion sem textos.' }
  }

  const imagePaths = Array.isArray(payload.imagePaths)
    ? payload.imagePaths.map((item) => normalizeStoragePath(item, userId, jobId)).filter(Boolean).slice(0, 9)
    : []

  if (imagePaths.length < 1) {
    return { ok: false, statusCode: 400, error: 'Envie pelo menos uma imagem JPG ou PNG.' }
  }
  if (Array.isArray(payload.imagePaths) && payload.imagePaths.length > 9) {
    return { ok: false, statusCode: 400, error: 'studio_hero_motion_max_9_images' }
  }
  if (Array.isArray(payload.imagePaths) && imagePaths.length !== payload.imagePaths.length) {
    return { ok: false, statusCode: 400, error: 'Nao foi possivel validar uma das imagens enviadas.' }
  }

  const neutralFramePath = `${userId}/${jobId}/system-neutral-final-frame.png`
  const plan = createStudioHeroMotionPlan({
    userId,
    jobId,
    imagePaths,
    neutralFramePath,
    fidelityMode: 'high_fidelity',
    movement: 'smooth cinematic camera movement',
    lighting: 'soft premium natural light',
    atmosphere: 'clean cinematic real estate atmosphere',
    rhythm: 'calm balanced motion',
    cinematicEffects: 'subtle depth reflections and light sweep',
  })
  const clipResults = plan.jobs.map((job) => ({
    index: job.index,
    role: job.role,
    status: 'pending',
    providerJobId: '',
    clipPath: `${userId}/${jobId}/clips/clip-${String(job.index).padStart(2, '0')}.mp4`,
    durationSeconds: job.durationSeconds,
  }))

  return {
    ok: true,
    statusCode: 200,
    jobId,
    job_id: jobId,
    status: 'planned',
    renderReady: false,
    jobs: plan.jobs,
    veoJobs: [],
    clipResults,
    mergeInput: {
      clipPaths: clipResults.map((clip) => clip.clipPath),
      outputPath: `${userId}/${jobId}/motion-final.mp4`,
    },
    promptValidationOk: plan.jobs.every((job) => findForbiddenPromptTerms(job.prompt).length === 0),
    forbiddenPromptTermsFound: plan.jobs.flatMap((job) => findForbiddenPromptTerms(job.prompt)),
    veoStarted: false,
  }
}

const userId = '11111111-1111-4111-8111-111111111111'
const cases = [1, 2, 5, 9].map((count) => {
  const jobId = `${String(count).repeat(8)}-${String(count).repeat(4)}-4${String(count).repeat(3)}-8${String(count).repeat(3)}-${String(count).repeat(12)}`
  return {
    label: `${count}_images`,
    payload: {
      mode: 'studio_hero_motion',
      variant: 'clean',
      jobId,
      imagePaths: Array.from({ length: count }, (_, index) => `${userId}/${jobId}/input-${index + 1}.jpg`),
    },
  }
})

const negativeCases = [
  {
    label: '0_images',
    payload: { mode: 'studio_hero_motion', variant: 'clean', jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', imagePaths: [] },
    authenticated: true,
  },
  {
    label: '10_images',
    payload: {
      mode: 'studio_hero_motion',
      variant: 'clean',
      jobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      imagePaths: Array.from({ length: 10 }, (_, index) => `${userId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/input-${index + 1}.jpg`),
    },
    authenticated: true,
  },
  {
    label: 'invalid_file',
    payload: { mode: 'studio_hero_motion', variant: 'clean', jobId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', imagePaths: [`${userId}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/input-1.gif`] },
    authenticated: true,
  },
  {
    label: 'unknown_mode',
    payload: { mode: 'unknown', variant: 'unknown', jobId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', imagePaths: [`${userId}/dddddddd-dddd-4ddd-8ddd-dddddddddddd/input-1.jpg`] },
    authenticated: true,
  },
  {
    label: 'unauthenticated',
    payload: { mode: 'studio_hero_motion', variant: 'clean', jobId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', imagePaths: [`${userId}/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/input-1.jpg`] },
    authenticated: false,
  },
]

const positiveResults = cases.map((testCase) => {
  const result = simulateEdgeContract(testCase.payload, { authenticated: true, userId })
  return {
    label: testCase.label,
    ok: result.ok,
    status: result.status,
    jobId: result.jobId,
    jobs: result.jobs?.length,
    veoJobs: result.veoJobs?.length,
    clipResults: result.clipResults?.length,
    mergeInputClipPaths: result.mergeInput?.clipPaths?.length,
    parentJob: Boolean(result.jobId),
    veoStarted: result.veoStarted,
    durations: result.jobs?.map((job) => job.durationSeconds),
    lastJob: result.jobs?.at(-1),
    promptValidationOk: result.promptValidationOk,
    forbiddenPromptTermsFound: [...new Set(result.forbiddenPromptTermsFound || [])],
  }
})

const negativeResults = negativeCases.map((testCase) => ({
  label: testCase.label,
  ...simulateEdgeContract(testCase.payload, { authenticated: testCase.authenticated, userId }),
}))

console.log(JSON.stringify({
  ok: positiveResults.every((item) => item.ok && item.promptValidationOk && item.veoStarted === false)
    && negativeResults.every((item) => item.ok === false),
  positiveResults,
  negativeResults: negativeResults.map((item) => ({
    label: item.label,
    ok: item.ok,
    statusCode: item.statusCode,
    error: item.error,
  })),
}, null, 2))

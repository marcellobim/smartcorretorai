import {
  registerCompletedCreation,
  type CreationRegistrationResult,
  type CreationStore,
  type RegisterCompletedCreationInput,
} from '../_shared/creations.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STUDIO_PRODUCT_BY_MODE = {
  dynamic_reel: {
    productKey: 'studio_comercial',
    downloadName: 'comercial-imobiliario.mp4',
  },
  free_ai: {
    productKey: 'studio_video_criativo',
    downloadName: 'video-criativo.mp4',
  },
} as const

export type StudioCreationJob = {
  id: string
  user_id: string
  status: string
  mode: string
  output_video_path: string | null
  completed_at: string | null
}

export class StudioCreationError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'StudioCreationError'
    this.code = code
  }
}

function validUuid(value: string) {
  return UUID_PATTERN.test(String(value || '').trim())
}

function normalizeCompletedAt(value: string | null) {
  const normalized = String(value || '').trim()
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) || !Number.isFinite(Date.parse(normalized))) {
    throw new StudioCreationError('invalid_studio_completed_at')
  }
  return new Date(normalized).toISOString()
}

export function buildStudioCreationInput(job: StudioCreationJob): RegisterCompletedCreationInput | null {
  if (job.status !== 'completed') return null
  const product = STUDIO_PRODUCT_BY_MODE[job.mode as keyof typeof STUDIO_PRODUCT_BY_MODE]
  if (!product) return null
  if (!validUuid(job.id)) throw new StudioCreationError('invalid_studio_job_id')
  if (!validUuid(job.user_id)) throw new StudioCreationError('invalid_studio_user_id')

  const expectedPath = `${job.user_id}/${job.id}/video.mp4`
  if (job.output_video_path !== expectedPath) throw new StudioCreationError('invalid_studio_output_path')

  return {
    user_id: job.user_id,
    product_key: product.productKey,
    source_ref: job.id,
    title: null,
    delivery_kind: 'file',
    result_manifest: {
      version: 1,
      files: [{
        bucket: 'studio-videos',
        path: expectedPath,
        name: product.downloadName,
        mime_type: 'video/mp4',
      }],
    },
    completed_at: normalizeCompletedAt(job.completed_at),
  }
}

export async function registerStudioCreation(
  store: CreationStore,
  job: StudioCreationJob,
): Promise<CreationRegistrationResult | null> {
  const input = buildStudioCreationInput(job)
  return input ? registerCompletedCreation(store, input) : null
}

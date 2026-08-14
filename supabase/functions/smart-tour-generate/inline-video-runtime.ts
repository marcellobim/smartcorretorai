type InlineVideoPersistenceInput = {
  userId: string
  jobId: string
  interactionId: string
  videoBytes: Uint8Array
  contentType: 'video/mp4'
}

type InlineVideoPersistenceDependencies = {
  upload(path: string, videoBytes: Uint8Array, contentType: 'video/mp4'): Promise<void>
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>
  persistCompleted(input: {
    interactionId: string
    outputPath: string
    completedAt: string
  }): Promise<void>
  now?: () => Date
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const SMART_TOUR_INLINE_REQUEST_BUDGET_MS = 120_000
export const SMART_TOUR_INLINE_MIN_PROVIDER_TIMEOUT_MS = 60_000

export function resolveSmartTourInlineProviderTimeout(elapsedMs: number, maximumProviderTimeoutMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(maximumProviderTimeoutMs) || maximumProviderTimeoutMs <= 0) {
    throw new Error('inline_video_timeout_budget_invalid')
  }
  const remainingMs = SMART_TOUR_INLINE_REQUEST_BUDGET_MS - elapsedMs
  if (remainingMs < SMART_TOUR_INLINE_MIN_PROVIDER_TIMEOUT_MS) throw new Error('inline_video_timeout_budget_exhausted')
  return Math.min(remainingMs, maximumProviderTimeoutMs)
}

export async function persistSmartTourInlineVideo(
  input: InlineVideoPersistenceInput,
  dependencies: InlineVideoPersistenceDependencies,
) {
  if (!UUID_PATTERN.test(input.userId) || !UUID_PATTERN.test(input.jobId)) throw new Error('inline_video_owner_invalid')
  if (!input.interactionId || input.interactionId.includes('/') || /[\u0000-\u0020\u007f]/.test(input.interactionId)) {
    throw new Error('inline_video_interaction_invalid')
  }
  if (input.contentType !== 'video/mp4' || !input.videoBytes.byteLength) throw new Error('inline_video_output_invalid')
  const outputPath = `${input.userId}/${input.jobId}/smart-tour.mp4`
  await dependencies.upload(outputPath, input.videoBytes, input.contentType)
  const signedVideoUrl = await dependencies.createSignedUrl(outputPath, 3600)
  if (!signedVideoUrl) throw new Error('inline_video_signed_url_missing')
  const completedAt = (dependencies.now?.() || new Date()).toISOString()
  await dependencies.persistCompleted({ interactionId: input.interactionId, outputPath, completedAt })
  return { outputPath, completedAt, signedVideoUrl }
}

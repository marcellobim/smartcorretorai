type VirtualSpaceInlineVideoInput = {
  userId: string
  jobId: string
  interactionId: string
  videoBytes: Uint8Array
  contentType: 'video/mp4'
  requiresCaptionRender: boolean
}

type VirtualSpaceInlineVideoDependencies = {
  upload(path: string, videoBytes: Uint8Array, contentType: 'video/mp4'): Promise<void>
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>
  startCaptionRender(videoUrl: string): Promise<string>
  persistCaptionRender(providerJobId: string): Promise<void>
  persistCompleted(input: {
    interactionId: string
    outputPath: string
    completedAt: string
  }): Promise<void>
  now?: () => Date
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const VIRTUAL_SPACE_INLINE_REQUEST_BUDGET_MS = 120_000
export const VIRTUAL_SPACE_INLINE_MIN_PROVIDER_TIMEOUT_MS = 60_000
export const VIRTUAL_SPACE_INLINE_POST_PROVIDER_RESERVE_MS = 10_000

export function resolveVirtualSpaceInlineProviderTimeout(elapsedMs: number, maximumProviderTimeoutMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(maximumProviderTimeoutMs) || maximumProviderTimeoutMs <= 0) {
    throw new Error('virtual_space_inline_timeout_budget_invalid')
  }
  const remainingMs = VIRTUAL_SPACE_INLINE_REQUEST_BUDGET_MS - elapsedMs - VIRTUAL_SPACE_INLINE_POST_PROVIDER_RESERVE_MS
  if (remainingMs < VIRTUAL_SPACE_INLINE_MIN_PROVIDER_TIMEOUT_MS) throw new Error('virtual_space_inline_timeout_budget_exhausted')
  return Math.min(remainingMs, maximumProviderTimeoutMs)
}

export async function persistVirtualSpaceInlineVideo(
  input: VirtualSpaceInlineVideoInput,
  dependencies: VirtualSpaceInlineVideoDependencies,
) {
  if (!UUID_PATTERN.test(input.userId) || !UUID_PATTERN.test(input.jobId)) throw new Error('virtual_space_inline_owner_invalid')
  if (!input.interactionId || input.interactionId.includes('/') || /[\u0000-\u0020\u007f]/.test(input.interactionId)) {
    throw new Error('virtual_space_inline_interaction_invalid')
  }
  if (input.contentType !== 'video/mp4' || !input.videoBytes.byteLength) throw new Error('virtual_space_inline_output_invalid')

  if (input.requiresCaptionRender) {
    const rawPath = `${input.userId}/${input.jobId}/virtual-staging-gemini.mp4`
    await dependencies.upload(rawPath, input.videoBytes, input.contentType)
    const rawUrl = await dependencies.createSignedUrl(rawPath, 21_600)
    if (!rawUrl) throw new Error('virtual_space_inline_raw_url_missing')
    const providerJobId = await dependencies.startCaptionRender(rawUrl)
    if (!providerJobId) throw new Error('virtual_space_inline_caption_job_missing')
    await dependencies.persistCaptionRender(providerJobId)
    return { status: 'generating' as const, rawPath }
  }

  const outputPath = `${input.userId}/${input.jobId}/virtual-staging.mp4`
  await dependencies.upload(outputPath, input.videoBytes, input.contentType)
  const signedVideoUrl = await dependencies.createSignedUrl(outputPath, 3600)
  if (!signedVideoUrl) throw new Error('virtual_space_inline_signed_url_missing')
  const completedAt = (dependencies.now?.() || new Date()).toISOString()
  await dependencies.persistCompleted({ interactionId: input.interactionId, outputPath, completedAt })
  return { status: 'completed' as const, outputPath, completedAt, signedVideoUrl }
}

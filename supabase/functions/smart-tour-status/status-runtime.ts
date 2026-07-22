export const SMART_TOUR_STATUS_TIMEOUT_MS = 25_000

const RETRIABLE_HTTP_STATUSES = new Set([404, 408, 409, 425, 429, 500, 502, 503, 504])

export type SmartTourStatusStage =
  | 'job_lookup'
  | 'completed_url'
  | 'interaction_poll'
  | 'failed_persist'
  | 'video_upload'
  | 'completed_persist'
  | 'result_url'

export type SmartTourStatusDiagnostic = {
  stage: SmartTourStatusStage
  kind: string
  providerStatus: number | null
  retriable: boolean
}

export function classifySmartTourStatusError(error: unknown, stage: SmartTourStatusStage): SmartTourStatusDiagnostic {
  const message = error instanceof Error ? error.message : String(error || '')
  const providerMatch = message.match(/gemini_omni_(?:api_failed|video_download_failed):(\d{3})/)
  const providerStatus = providerMatch ? Number(providerMatch[1]) : null
  const timedOut = message === 'smart_tour_status_timeout'
  const kind = timedOut
    ? 'interaction_timeout'
    : message.startsWith('gemini_omni_api_failed:')
      ? 'interaction_api_error'
      : message.startsWith('gemini_omni_video_download_failed:')
        ? 'video_download_error'
        : message.startsWith('status_')
          ? message.split(':')[0]
          : 'unexpected_error'
  const retriable = stage === 'interaction_poll'
    && (timedOut || (providerStatus !== null && RETRIABLE_HTTP_STATUSES.has(providerStatus)))

  return { stage, kind, providerStatus, retriable }
}

export async function withSmartTourStatusTimeout<T>(operation: Promise<T>, timeoutMs = SMART_TOUR_STATUS_TIMEOUT_MS) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('smart_tour_status_timeout')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

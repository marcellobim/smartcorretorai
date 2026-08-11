export const INSTAGRAM_OAUTH_STAGES = Object.freeze([
  'state',
  'short_token',
  'long_token',
  'pages',
  'eligible_count',
  'username',
  'database',
  'success',
] as const)

export type InstagramOAuthStage = typeof INSTAGRAM_OAUTH_STAGES[number]

export type InstagramOAuthTelemetryInput = {
  stage: InstagramOAuthStage
  http_status?: unknown
  meta_code?: unknown
  meta_subcode?: unknown
  pages_count?: unknown
  eligible_count?: unknown
  supabase_code?: unknown
}

export type InstagramOAuthTelemetryEvent = {
  event: 'instagram_oauth'
  stage: InstagramOAuthStage
  http_status?: number
  meta_code?: number
  meta_subcode?: number
  pages_count?: number
  eligible_count?: number
  supabase_code?: string
}

const safeInteger = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
  const number = typeof value === 'number' ? value : Number.NaN
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : undefined
}

const safeSupabaseCode = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const code = value.trim()
  return /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : undefined
}

export function createInstagramOAuthTelemetryEvent(input: InstagramOAuthTelemetryInput): InstagramOAuthTelemetryEvent {
  const event: InstagramOAuthTelemetryEvent = { event: 'instagram_oauth', stage: input.stage }
  const httpStatus = safeInteger(input.http_status, 100, 599)
  const metaCode = safeInteger(input.meta_code)
  const metaSubcode = safeInteger(input.meta_subcode)
  const pagesCount = safeInteger(input.pages_count)
  const eligibleCount = safeInteger(input.eligible_count)
  const supabaseCode = safeSupabaseCode(input.supabase_code)

  if (httpStatus !== undefined) event.http_status = httpStatus
  if (metaCode !== undefined) event.meta_code = metaCode
  if (metaSubcode !== undefined) event.meta_subcode = metaSubcode
  if (pagesCount !== undefined) event.pages_count = pagesCount
  if (eligibleCount !== undefined) event.eligible_count = eligibleCount
  if (supabaseCode !== undefined) event.supabase_code = supabaseCode
  return event
}

export class InstagramOAuthTelemetryError extends Error {
  readonly telemetry: InstagramOAuthTelemetryEvent

  constructor(input: InstagramOAuthTelemetryInput) {
    super('instagram_oauth_failed')
    this.name = 'InstagramOAuthTelemetryError'
    this.telemetry = createInstagramOAuthTelemetryEvent(input)
  }
}

export function getInstagramOAuthFailure(error: unknown, fallbackStage: InstagramOAuthStage = 'state') {
  return error instanceof InstagramOAuthTelemetryError
    ? error.telemetry
    : createInstagramOAuthTelemetryEvent({ stage: fallbackStage })
}

export function logInstagramOAuthEvent(
  sink: (message: string) => void,
  input: InstagramOAuthTelemetryInput | InstagramOAuthTelemetryEvent,
) {
  sink(JSON.stringify(createInstagramOAuthTelemetryEvent(input)))
}

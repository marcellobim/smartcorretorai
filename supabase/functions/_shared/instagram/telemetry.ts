export const INSTAGRAM_OAUTH_STAGES = Object.freeze([
  'state',
  'short_token',
  'long_token',
  'permissions',
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
  instagram_basic?: unknown
  instagram_content_publish?: unknown
  pages_show_list?: unknown
  pages_read_engagement?: unknown
  page_target_count?: unknown
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
  instagram_basic?: boolean
  instagram_content_publish?: boolean
  pages_show_list?: boolean
  pages_read_engagement?: boolean
  page_target_count?: number
  pages_count?: number
  eligible_count?: number
  supabase_code?: string
}

const safeInteger = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
  const number = typeof value === 'number' ? value : Number.NaN
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : undefined
}

const safeBoolean = (value: unknown) => typeof value === 'boolean' ? value : undefined

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
  const instagramBasic = safeBoolean(input.instagram_basic)
  const instagramContentPublish = safeBoolean(input.instagram_content_publish)
  const pagesShowList = safeBoolean(input.pages_show_list)
  const pagesReadEngagement = safeBoolean(input.pages_read_engagement)
  const pageTargetCount = safeInteger(input.page_target_count)
  const pagesCount = safeInteger(input.pages_count)
  const eligibleCount = safeInteger(input.eligible_count)
  const supabaseCode = safeSupabaseCode(input.supabase_code)

  if (httpStatus !== undefined) event.http_status = httpStatus
  if (metaCode !== undefined) event.meta_code = metaCode
  if (metaSubcode !== undefined) event.meta_subcode = metaSubcode
  if (instagramBasic !== undefined) event.instagram_basic = instagramBasic
  if (instagramContentPublish !== undefined) event.instagram_content_publish = instagramContentPublish
  if (pagesShowList !== undefined) event.pages_show_list = pagesShowList
  if (pagesReadEngagement !== undefined) event.pages_read_engagement = pagesReadEngagement
  if (pageTargetCount !== undefined) event.page_target_count = pageTargetCount
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

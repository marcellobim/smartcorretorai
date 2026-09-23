export const TIKTOK_OAUTH_STAGES = Object.freeze([
  'authorization',
  'state',
  'token_exchange',
  'token_refresh',
  'token_revoke',
  'account',
  'database',
  'success',
] as const)

export type TikTokOAuthStage = typeof TIKTOK_OAUTH_STAGES[number]

export type TikTokOAuthTelemetryInput = {
  stage: TikTokOAuthStage
  http_status?: unknown
  provider_code?: unknown
  scope_count?: unknown
  state_consumed?: unknown
  token_rotated?: unknown
  account_resolved?: unknown
  supabase_code?: unknown
}

export type TikTokOAuthTelemetryEvent = {
  event: 'tiktok_oauth'
  stage: TikTokOAuthStage
  http_status?: number
  provider_code?: string
  scope_count?: number
  state_consumed?: boolean
  token_rotated?: boolean
  account_resolved?: boolean
  supabase_code?: string
}

const safeInteger = (value: unknown, minimum: number, maximum: number) => (
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : undefined
)
const safeBoolean = (value: unknown) => typeof value === 'boolean' ? value : undefined
const safeCode = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const code = value.trim()
  return /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : undefined
}

export function createTikTokOAuthTelemetryEvent(input: TikTokOAuthTelemetryInput): TikTokOAuthTelemetryEvent {
  if (!TIKTOK_OAUTH_STAGES.includes(input.stage)) throw new Error('invalid_tiktok_oauth_telemetry_stage')
  const event: TikTokOAuthTelemetryEvent = { event: 'tiktok_oauth', stage: input.stage }
  const httpStatus = safeInteger(input.http_status, 100, 599)
  const providerCode = safeCode(input.provider_code)
  const scopeCount = safeInteger(input.scope_count, 0, 100)
  const stateConsumed = safeBoolean(input.state_consumed)
  const tokenRotated = safeBoolean(input.token_rotated)
  const accountResolved = safeBoolean(input.account_resolved)
  const supabaseCode = safeCode(input.supabase_code)
  if (httpStatus !== undefined) event.http_status = httpStatus
  if (providerCode !== undefined) event.provider_code = providerCode
  if (scopeCount !== undefined) event.scope_count = scopeCount
  if (stateConsumed !== undefined) event.state_consumed = stateConsumed
  if (tokenRotated !== undefined) event.token_rotated = tokenRotated
  if (accountResolved !== undefined) event.account_resolved = accountResolved
  if (supabaseCode !== undefined) event.supabase_code = supabaseCode
  return Object.freeze(event)
}

export class TikTokOAuthTelemetryError extends Error {
  readonly telemetry: TikTokOAuthTelemetryEvent

  constructor(input: TikTokOAuthTelemetryInput) {
    super('tiktok_oauth_failed')
    this.name = 'TikTokOAuthTelemetryError'
    this.telemetry = createTikTokOAuthTelemetryEvent(input)
  }
}

export function getTikTokOAuthFailure(error: unknown, fallbackStage: TikTokOAuthStage = 'state') {
  return error instanceof TikTokOAuthTelemetryError
    ? error.telemetry
    : createTikTokOAuthTelemetryEvent({ stage: fallbackStage })
}

export function logTikTokOAuthEvent(
  sink: (message: string) => void,
  input: TikTokOAuthTelemetryInput | TikTokOAuthTelemetryEvent,
) {
  sink(JSON.stringify(createTikTokOAuthTelemetryEvent(input)))
}

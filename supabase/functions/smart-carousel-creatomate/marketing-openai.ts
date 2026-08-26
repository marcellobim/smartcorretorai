export const MARKETING_OPENAI_MAX_CALLS = 2

export type MarketingOpenAIStage = 'initial' | 'revision'
export type MarketingOpenAIErrorCode =
  | 'marketing_openai_http_error'
  | 'marketing_openai_timeout'
  | 'marketing_openai_network_error'
  | 'marketing_empty_response'
  | 'marketing_invalid_json'
  | 'marketing_schema_invalid'
  | 'marketing_revision_invalid'
  | 'marketing_call_budget_exhausted'
  | 'marketing_local_deterministic_error'
  | 'marketing_unknown_error'

export type MarketingOpenAIDiagnostic = Readonly<{
  event: 'smart_carousel_marketing_openai'
  job_id: string
  stage: MarketingOpenAIStage
  code: MarketingOpenAIErrorCode | 'marketing_openai_ok'
  provider_status: number | null
  attempt: number
  duration_ms: number
  content_present: boolean
  failure_type: string | null
  will_retry: boolean
  stack: string | null
}>

export type MarketingOpenAICallBudget = {
  calls: number
  readonly maxCalls: number
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type MarketingOpenAIDependencies = Readonly<{
  fetcher?: FetchLike
  logger?: (diagnostic: MarketingOpenAIDiagnostic) => void
  now?: () => number
  sleep?: (milliseconds: number) => Promise<void>
}>

type MarketingOpenAIRequest<T> = Readonly<{
  jobId: string
  stage: MarketingOpenAIStage
  budget: MarketingOpenAICallBudget
  url: string
  init: RequestInit
  timeoutMs: number
  validate: (value: unknown) => T
  dependencies?: MarketingOpenAIDependencies
}>

type MarketingOpenAIErrorInput = Readonly<{
  code: MarketingOpenAIErrorCode
  stage: MarketingOpenAIStage
  retryable: boolean
  providerStatus?: number | null
  contentPresent?: boolean
  failureType?: string | null
  publicErrorCode?: string | null
}>

export class MarketingOpenAIError extends Error {
  readonly code: MarketingOpenAIErrorCode
  readonly stage: MarketingOpenAIStage
  readonly retryable: boolean
  readonly providerStatus: number | null
  readonly contentPresent: boolean
  readonly failureType: string | null
  readonly publicErrorCode: string | null

  constructor(input: MarketingOpenAIErrorInput) {
    super(input.code)
    this.name = 'MarketingOpenAIError'
    this.code = input.code
    this.stage = input.stage
    this.retryable = input.retryable
    this.providerStatus = input.providerStatus ?? null
    this.contentPresent = input.contentPresent === true
    this.failureType = input.failureType ?? null
    this.publicErrorCode = input.publicErrorCode ?? null
  }
}

export function createMarketingOpenAICallBudget(maxCalls = MARKETING_OPENAI_MAX_CALLS): MarketingOpenAICallBudget {
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > MARKETING_OPENAI_MAX_CALLS) {
    throw new Error('invalid_marketing_openai_call_budget')
  }
  return { calls: 0, maxCalls }
}

function sanitizeStack(error: MarketingOpenAIError) {
  return String(error.stack || '')
    .split('\n')
    .slice(0, 4)
    .map(line => line.replace(/(?:file:\/\/)?[^\s()]*smart-carousel-creatomate[\\/]/gi, 'smart-carousel-creatomate/'))
    .join(' | ')
    .slice(0, 600) || null
}

function defaultLogger(diagnostic: MarketingOpenAIDiagnostic) {
  const serialized = JSON.stringify(diagnostic)
  if (diagnostic.code === 'marketing_openai_ok') console.info(serialized)
  else console.warn(serialized)
}

function diagnosticFor(
  jobId: string,
  error: MarketingOpenAIError,
  attempt: number,
  durationMs: number,
  willRetry: boolean,
): MarketingOpenAIDiagnostic {
  return Object.freeze({
    event: 'smart_carousel_marketing_openai',
    job_id: jobId,
    stage: error.stage,
    code: error.code,
    provider_status: error.providerStatus,
    attempt,
    duration_ms: Math.max(0, Math.round(durationMs)),
    content_present: error.contentPresent,
    failure_type: error.failureType,
    will_retry: willRetry,
    stack: sanitizeStack(error),
  })
}

function classifyThrownError(error: unknown, stage: MarketingOpenAIStage) {
  if (error instanceof MarketingOpenAIError) return error
  const name = error instanceof Error ? error.name : ''
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new MarketingOpenAIError({
      code: 'marketing_openai_timeout', stage, retryable: true, failureType: 'timeout',
    })
  }
  if (error instanceof TypeError) {
    return new MarketingOpenAIError({
      code: 'marketing_openai_network_error', stage, retryable: true, failureType: 'network',
    })
  }
  return new MarketingOpenAIError({
    code: 'marketing_unknown_error', stage, retryable: false, failureType: 'unknown',
  })
}

function responseContent(body: unknown) {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const choices = Array.isArray(record.choices) ? record.choices : []
  const choice = choices[0] && typeof choices[0] === 'object' && !Array.isArray(choices[0])
    ? choices[0] as Record<string, unknown>
    : {}
  const message = choice.message && typeof choice.message === 'object' && !Array.isArray(choice.message)
    ? choice.message as Record<string, unknown>
    : {}
  return typeof message.content === 'string' ? message.content.trim() : ''
}

function validationError(stage: MarketingOpenAIStage) {
  return new MarketingOpenAIError({
    code: stage === 'revision' ? 'marketing_revision_invalid' : 'marketing_schema_invalid',
    stage,
    retryable: stage === 'initial',
    contentPresent: true,
    failureType: 'schema',
  })
}

function isKnownSchemaValidationError(error: unknown) {
  if (!(error instanceof Error)) return false
  return error.message === 'invalid_marketing_response'
    || error.message === 'invalid_google_ads'
    || error.message.startsWith('invalid_google_ads_')
}

export function logMarketingLocalFailure(input: Readonly<{
  jobId: string
  stage: MarketingOpenAIStage
  code: MarketingOpenAIErrorCode
  attempt: number
  failureType: string
  dependencies?: MarketingOpenAIDependencies
}>) {
  const error = new MarketingOpenAIError({
    code: input.code,
    stage: input.stage,
    retryable: false,
    failureType: input.failureType,
    publicErrorCode: input.failureType === 'narration_duration_out_of_range' ? input.failureType : null,
  })
  const logger = input.dependencies?.logger || defaultLogger
  logger(diagnosticFor(input.jobId, error, input.attempt, 0, false))
  return error
}

export async function requestMarketingOpenAIJson<T>(input: MarketingOpenAIRequest<T>): Promise<T> {
  const fetcher = input.dependencies?.fetcher || fetch
  const logger = input.dependencies?.logger || defaultLogger
  const now = input.dependencies?.now || Date.now
  const sleep = input.dependencies?.sleep || ((milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds)))

  while (input.budget.calls < input.budget.maxCalls) {
    input.budget.calls += 1
    const attempt = input.budget.calls
    const startedAt = now()
    let providerStatus: number | null = null
    let contentPresent = false

    try {
      const response = await fetcher(input.url, {
        ...input.init,
        signal: AbortSignal.timeout(input.timeoutMs),
      })
      providerStatus = response.status
      if (!response.ok) {
        throw new MarketingOpenAIError({
          code: 'marketing_openai_http_error',
          stage: input.stage,
          retryable: response.status === 429 || response.status >= 500,
          providerStatus: response.status,
          failureType: `http_${response.status}`,
        })
      }
      const body = await response.json().catch(() => {
        throw new MarketingOpenAIError({
          code: 'marketing_invalid_json', stage: input.stage, retryable: true,
          providerStatus, failureType: 'provider_envelope_json',
        })
      })

      const content = responseContent(body)
      contentPresent = Boolean(content)
      if (!content) {
        throw new MarketingOpenAIError({
          code: 'marketing_empty_response', stage: input.stage, retryable: true,
          providerStatus, failureType: 'empty_content',
        })
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        throw new MarketingOpenAIError({
          code: 'marketing_invalid_json', stage: input.stage, retryable: true,
          providerStatus, contentPresent: true, failureType: 'content_json',
        })
      }

      let validated: T
      try {
        validated = input.validate(parsed)
      } catch (error) {
        if (error instanceof MarketingOpenAIError) throw error
        if (isKnownSchemaValidationError(error)) throw validationError(input.stage)
        throw new MarketingOpenAIError({
          code: 'marketing_local_deterministic_error', stage: input.stage, retryable: false,
          providerStatus, contentPresent: true, failureType: 'local_validation',
        })
      }

      logger(Object.freeze({
        event: 'smart_carousel_marketing_openai', job_id: input.jobId, stage: input.stage,
        code: 'marketing_openai_ok', provider_status: providerStatus, attempt,
        duration_ms: Math.max(0, Math.round(now() - startedAt)), content_present: true,
        failure_type: null, will_retry: false, stack: null,
      }))
      return validated
    } catch (caughtError) {
      const error = classifyThrownError(caughtError, input.stage)
      const willRetry = error.retryable && input.budget.calls < input.budget.maxCalls
      logger(diagnosticFor(input.jobId, new MarketingOpenAIError({
        code: error.code,
        stage: error.stage,
        retryable: error.retryable,
        providerStatus: error.providerStatus ?? providerStatus,
        contentPresent: error.contentPresent || contentPresent,
        failureType: error.failureType,
        publicErrorCode: error.publicErrorCode,
      }), attempt, now() - startedAt, willRetry))
      if (!willRetry) throw error
      await sleep(250 * attempt)
    }
  }

  const exhaustedError = new MarketingOpenAIError({
    code: 'marketing_call_budget_exhausted', stage: input.stage, retryable: false,
    failureType: 'call_budget',
  })
  logger(diagnosticFor(input.jobId, exhaustedError, input.budget.calls, 0, false))
  throw exhaustedError
}

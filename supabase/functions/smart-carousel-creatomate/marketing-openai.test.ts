import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  MARKETING_OPENAI_MAX_CALLS,
  MarketingOpenAIError,
  createMarketingOpenAICallBudget,
  requestMarketingOpenAIJson,
  type MarketingOpenAIDiagnostic,
} from './marketing-openai.ts'

const JOB_ID = '200bd757-3c6f-425e-81ee-a4653536b54f'
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const resilienceSource = readFileSync(new URL('./marketing-openai.ts', import.meta.url), 'utf8')

function chatResponse(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sequenceFetcher(responses: Array<Response | Error>) {
  let calls = 0
  return {
    get calls() { return calls },
    fetcher: async () => {
      const response = responses[calls++]
      if (response instanceof Error) throw response
      if (!response) throw new Error('unexpected_extra_openai_call')
      return response
    },
  }
}

async function executeSequence(
  responses: Array<Response | Error>,
  validate: (value: unknown) => unknown = value => value,
) {
  const sequence = sequenceFetcher(responses)
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  const budget = createMarketingOpenAICallBudget()
  const result = await requestMarketingOpenAIJson({
    jobId: JOB_ID,
    stage: 'initial',
    budget,
    url: 'https://api.openai.test/v1/chat/completions',
    timeoutMs: 100,
    init: { method: 'POST' },
    validate,
    dependencies: {
      fetcher: sequence.fetcher,
      logger: diagnostic => diagnostics.push(diagnostic),
      sleep: async () => {},
    },
  })
  return { result, calls: sequence.calls, budget, diagnostics }
}

test('A: valid first response succeeds with one OpenAI call', async () => {
  const run = await executeSequence([chatResponse('{"ready":true}')])
  assert.deepEqual(run.result, { ready: true })
  assert.equal(run.calls, 1)
  assert.equal(run.diagnostics.at(-1)?.code, 'marketing_openai_ok')
})

test('B: empty response retries once and accepts a valid second response', async () => {
  const run = await executeSequence([
    chatResponse(''),
    chatResponse('{"ready":true}'),
  ])
  assert.equal(run.calls, 2)
  assert.equal(run.diagnostics[0].code, 'marketing_empty_response')
  assert.equal(run.diagnostics[0].will_retry, true)
})

test('C: invalid content JSON retries once and succeeds', async () => {
  const run = await executeSequence([
    chatResponse('{invalid'),
    chatResponse('{"ready":true}'),
  ])
  assert.equal(run.calls, 2)
  assert.equal(run.diagnostics[0].code, 'marketing_invalid_json')
  assert.equal(run.diagnostics[0].failure_type, 'content_json')
})

test('D: initial schema failure is recoverable once', async () => {
  let validations = 0
  const run = await executeSequence([
    chatResponse('{"ready":false}'),
    chatResponse('{"ready":true}'),
  ], value => {
    validations += 1
    if ((value as { ready?: boolean }).ready !== true) throw new Error('invalid_marketing_response')
    return value
  })
  assert.equal(run.calls, 2)
  assert.equal(validations, 2)
  assert.equal(run.diagnostics[0].code, 'marketing_schema_invalid')
})

for (const status of [429, 500, 503]) {
  test(`E/F: HTTP ${status} retries once`, async () => {
    const run = await executeSequence([
      chatResponse('provider body is ignored', status),
      chatResponse('{"ready":true}'),
    ])
    assert.equal(run.calls, 2)
    assert.equal(run.diagnostics[0].provider_status, status)
    assert.equal(run.diagnostics[0].will_retry, true)
  })
}

for (const status of [401, 403]) {
  test(`G: HTTP ${status} never retries, even with a non-JSON body`, async () => {
    const sequence = sequenceFetcher([new Response('not-json', { status })])
    await assert.rejects(
      requestMarketingOpenAIJson({
        jobId: JOB_ID,
        stage: 'initial',
        budget: createMarketingOpenAICallBudget(),
        url: 'https://api.openai.test',
        timeoutMs: 100,
        init: {},
        validate: value => value,
        dependencies: { fetcher: sequence.fetcher, logger: () => {}, sleep: async () => {} },
      }),
      (error: unknown) => error instanceof MarketingOpenAIError
        && error.code === 'marketing_openai_http_error'
        && error.providerStatus === status,
    )
    assert.equal(sequence.calls, 1)
  })
}

test('HTTP 400 structural failure never retries', async () => {
  const sequence = sequenceFetcher([chatResponse('{"error":"invalid request"}', 400)])
  await assert.rejects(
    requestMarketingOpenAIJson({
      jobId: JOB_ID,
      stage: 'initial',
      budget: createMarketingOpenAICallBudget(),
      url: 'https://api.openai.test',
      timeoutMs: 100,
      init: {},
      validate: value => value,
      dependencies: { fetcher: sequence.fetcher, logger: () => {}, sleep: async () => {} },
    }),
    (error: unknown) => error instanceof MarketingOpenAIError
      && error.code === 'marketing_openai_http_error'
      && error.providerStatus === 400,
  )
  assert.equal(sequence.calls, 1)
})

test('provider timeout retries once and succeeds', async () => {
  const timeout = new Error('private timeout detail')
  timeout.name = 'TimeoutError'
  const run = await executeSequence([timeout, chatResponse('{"ready":true}')])
  assert.equal(run.calls, 2)
  assert.equal(run.diagnostics[0].code, 'marketing_openai_timeout')
  assert.equal(run.diagnostics[0].will_retry, true)
})

test('H: deterministic local validation failure never retries', async () => {
  const sequence = sequenceFetcher([chatResponse('{"ready":true}')])
  await assert.rejects(
    requestMarketingOpenAIJson({
      jobId: JOB_ID,
      stage: 'initial',
      budget: createMarketingOpenAICallBudget(),
      url: 'https://api.openai.test',
      timeoutMs: 100,
      init: {},
      validate: () => {
        throw new Error('unexpected_local_validator_failure')
      },
      dependencies: { fetcher: sequence.fetcher, logger: () => {}, sleep: async () => {} },
    }),
    (error: unknown) => error instanceof MarketingOpenAIError
      && error.code === 'marketing_local_deterministic_error',
  )
  assert.equal(sequence.calls, 1)
})

test('I/J: two recoverable failures are terminal and the per-job ceiling is two calls', async () => {
  const sequence = sequenceFetcher([chatResponse(''), chatResponse('')])
  const budget = createMarketingOpenAICallBudget()
  await assert.rejects(
    requestMarketingOpenAIJson({
      jobId: JOB_ID,
      stage: 'initial',
      budget,
      url: 'https://api.openai.test',
      timeoutMs: 100,
      init: {},
      validate: value => value,
      dependencies: { fetcher: sequence.fetcher, logger: () => {}, sleep: async () => {} },
    }),
    (error: unknown) => error instanceof MarketingOpenAIError
      && error.code === 'marketing_empty_response',
  )
  assert.equal(sequence.calls, MARKETING_OPENAI_MAX_CALLS)
  assert.equal(budget.calls, MARKETING_OPENAI_MAX_CALLS)
})

test('the initial generation and optional narration revision share one two-call budget', () => {
  assert.match(source, /const callBudget = createMarketingOpenAICallBudget\(\)/)
  assert.equal((source.match(/budget: callBudget/g) || []).length, 2)
  assert.match(resilienceSource, /MARKETING_OPENAI_MAX_CALLS = 2/)
})

test('shared budget blocks a third call across initial generation and revision', async () => {
  const sequence = sequenceFetcher([
    chatResponse('{"ready":true}'),
    chatResponse(''),
  ])
  const budget = createMarketingOpenAICallBudget()
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  const common = {
    jobId: JOB_ID,
    budget,
    url: 'https://api.openai.test',
    timeoutMs: 100,
    init: {},
    validate: (value: unknown) => value,
    dependencies: {
      fetcher: sequence.fetcher,
      logger: (diagnostic: MarketingOpenAIDiagnostic) => diagnostics.push(diagnostic),
      sleep: async () => {},
    },
  }
  await requestMarketingOpenAIJson({ ...common, stage: 'initial' })
  await assert.rejects(
    requestMarketingOpenAIJson({ ...common, stage: 'revision' }),
    (error: unknown) => error instanceof MarketingOpenAIError
      && error.code === 'marketing_empty_response',
  )
  await assert.rejects(
    requestMarketingOpenAIJson({ ...common, stage: 'revision' }),
    (error: unknown) => error instanceof MarketingOpenAIError
      && error.code === 'marketing_call_budget_exhausted',
  )
  assert.equal(sequence.calls, 2)
  assert.equal(diagnostics.at(-1)?.code, 'marketing_call_budget_exhausted')
})

test('K-M: internal retry cannot create another job, reservation or settlement', () => {
  assert.doesNotMatch(resilienceSource, /claimSmartCarouselEconomy|settleSmartCarouselEconomy|clientRequestId|jobId\s*=/)
  assert.equal((source.match(/await claimSmartCarouselEconomy/g) || []).length, 1)
  const claimAt = source.indexOf('await claimSmartCarouselEconomy')
  const marketingAt = source.indexOf('await buildPresentationPlan', claimAt)
  const terminalRefundAt = source.indexOf("status: 'failed'", marketingAt)
  assert.ok(claimAt > 0 && marketingAt > claimAt && terminalRefundAt > marketingAt)
})

test('N: Creatomate remains after valid marketing construction', () => {
  const marketingAt = source.indexOf('await buildPresentationPlan')
  const creatomateAt = source.indexOf("fetch('https://api.creatomate.com/v2/renders'", marketingAt)
  assert.ok(marketingAt > 0 && creatomateAt > marketingAt)
})

test('O: diagnostics omit secrets, personal data, prompts and raw provider content', async () => {
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  const secret = 'private-test-token-value'
  const email = 'usuario@example.com'
  const phone = '+55 11 99999-9999'
  const rawContent = `${email} ${phone}`
  const sequence = sequenceFetcher([
    chatResponse(rawContent),
    chatResponse('{"ready":true}'),
  ])
  await requestMarketingOpenAIJson({
    jobId: JOB_ID,
    stage: 'initial',
    budget: createMarketingOpenAICallBudget(),
    url: 'https://api.openai.test',
    timeoutMs: 100,
    init: {
      headers: { Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ prompt: `${email} ${phone}` }),
    },
    validate: value => value,
    dependencies: {
      fetcher: sequence.fetcher,
      logger: diagnostic => diagnostics.push(diagnostic),
      sleep: async () => {},
    },
  })
  const serialized = JSON.stringify(diagnostics)
  assert.equal(serialized.includes(secret), false)
  assert.equal(serialized.includes(email), false)
  assert.equal(serialized.includes(phone), false)
  assert.equal(serialized.includes(rawContent), false)
  assert.match(serialized, /marketing_invalid_json/)
})

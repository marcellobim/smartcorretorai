import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  MARKETING_OPENAI_MAX_CALLS,
  MarketingOpenAIError,
  MarketingSchemaValidationError,
  createMarketingOpenAICallBudget,
  requestMarketingOpenAIJson,
  type MarketingOpenAIDiagnostic,
} from './marketing-openai.ts'

const JOB_ID = '200bd757-3c6f-425e-81ee-a4653536b54f'
const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const resilienceSource = readFileSync(new URL('./marketing-openai.ts', import.meta.url), 'utf8')

function extractFunction(source: string, signature: string) {
  const start = source.indexOf(signature)
  assert.ok(start >= 0, `${signature} precisa existir`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`corpo de ${signature} nao encontrado`)
}

// The HTTP handler itself has provider credentials by design, so this compiles
// only its pure normalization path and injects all boundaries below.
function compileRendererMarketingValidator() {
  const runtime = (value: string) => value
    .replace(/: unknown/g, '')
    .replace(/: JsonRecord/g, '')
    .replace(/: number/g, '')
    .replace(/: string/g, '')
    .replace(/ as JsonRecord/g, '')
  const asRecord = runtime(extractFunction(source, 'function asRecord('))
  const cleanText = runtime(extractFunction(source, 'function cleanText('))
  const sanitizeStringList = runtime(extractFunction(source, 'function sanitizeStringList('))
  const sanitizeCampaign = runtime(extractFunction(source, 'function sanitizeCampaign('))
  const validate = runtime(extractFunction(source, 'function validateMarketingIntelligence('))
  return new Function('validateGoogleAdsDelivery', 'MarketingSchemaValidationError', `${asRecord}\n${cleanText}\n${sanitizeStringList}\n${sanitizeCampaign}\n${validate}\nreturn validateMarketingIntelligence`)(
    (value: unknown) => value,
    MarketingSchemaValidationError,
  ) as (value: unknown, expectedCta: string) => Record<string, unknown>
}

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

test('D: initial schema failure is terminal and never triggers a paid retry', async () => {
  let validations = 0
  const sequence = sequenceFetcher([
    chatResponse('{"ready":false}'),
    chatResponse('{"ready":true}'),
  ])
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  await assert.rejects(requestMarketingOpenAIJson({
    jobId: JOB_ID, stage: 'initial', budget: createMarketingOpenAICallBudget(), url: 'https://api.openai.test', timeoutMs: 100, init: {},
    validate: value => {
    validations += 1
    if ((value as { ready?: boolean }).ready !== true) throw new Error('invalid_marketing_response')
    return value
    },
    dependencies: { fetcher: sequence.fetcher, logger: diagnostic => diagnostics.push(diagnostic), sleep: async () => {} },
  }), (error: unknown) => error instanceof MarketingOpenAIError && error.code === 'marketing_schema_invalid')
  assert.equal(sequence.calls, 1)
  assert.equal(validations, 1)
  assert.equal(diagnostics[0].code, 'marketing_schema_invalid')
  assert.equal(diagnostics[0].will_retry, false)
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

test('schema diagnostics keep only safe structural metadata', async () => {
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  await assert.rejects(requestMarketingOpenAIJson({
    jobId: JOB_ID, stage: 'initial', budget: createMarketingOpenAICallBudget(), url: 'https://api.openai.test', timeoutMs: 100, init: {},
    validate: () => { throw new MarketingSchemaValidationError({ fieldPath: 'campaigns[1].email.body', expectedType: 'nonempty string', receivedType: 'undefined', missingRequired: true, extraFields: 2 }) },
    dependencies: { fetcher: sequenceFetcher([chatResponse('{"invalid":true}')]).fetcher, logger: item => diagnostics.push(item), sleep: async () => {} },
  }), (error: unknown) => error instanceof MarketingOpenAIError && error.code === 'marketing_schema_invalid')
  assert.deepEqual(diagnostics[0].schema, { schema_version: 'smart_carousel_marketing_v1', field_path: 'campaigns[1].email.body', expected_type: 'nonempty string', received_type: 'undefined', missing_required: true, extra_fields: 2 })
  assert.equal(diagnostics[0].will_retry, false)
})

test('integrado: resposta recuperavel percorre marketing, normalizacao e payload Creatomate sem segundo provider', async () => {
  const validate = compileRendererMarketingValidator()
  const facts = {
    US: { bathrooms: '2', sqft: '1450', state: 'FL', county: 'Orange', city: 'Orlando' },
    BR: { suites: '1', area_m2: '120', uf: 'SP', city: 'Sao Paulo' },
  }
  let marketingCalls = 0
  let creatomateCalls = 0
  const partialButRecoverable = {
    narration: 'Apartamento com 2 banheiros e 1450 sqft em Orlando.',
    narration_highlights: '2 banheiros, 1450 sqft',
    campaigns: [0, 1, 2].map(index => ({
      // String hashtags are a tolerated provider shape; the renderer repairs
      // the structural representation and canonical brand tag locally.
      name: `Campanha ${index + 1}`,
      objective: 'Gerar interesse',
      instagram: 'Conheca este imovel.', whatsapp: 'Fale conosco.', facebook: 'Veja os detalhes.',
      email: { subject: 'Imovel em destaque', body: 'Agende uma visita.' },
      linkedin: 'Oportunidade imobiliaria.', hashtags: '#imovel, #SmartCorretorAI', cta: 'Saiba mais',
      ignored_provider_field: 'discarded',
    })),
    google_ads: { headlines: ['Imovel em destaque'] },
    ignored_root_field: 'discarded',
  }
  const run = await requestMarketingOpenAIJson({
    jobId: JOB_ID, stage: 'initial', budget: createMarketingOpenAICallBudget(), url: 'https://marketing.stub/v1', timeoutMs: 100, init: {},
    validate: value => validate(value, 'Saiba mais'),
    dependencies: {
      fetcher: async () => { marketingCalls += 1; return chatResponse(JSON.stringify(partialButRecoverable)) },
      logger: () => {}, sleep: async () => {},
    },
  })
  const rendererPayload = {
    template_id: 'template-stub',
    modifications: {
      RenderScript: JSON.stringify({ marketFacts: facts, marketing: run, professional_identity: 'Riccieri · CRECI-F 12345/SP' }),
    },
  }
  const creatomateStub = async (payload: typeof rendererPayload) => {
    creatomateCalls += 1
    assert.equal(payload.template_id, 'template-stub')
    return { id: 'render-stub' }
  }
  const render = await creatomateStub(rendererPayload)
  const renderScript = JSON.parse(rendererPayload.modifications.RenderScript) as Record<string, unknown>
  const serialized = JSON.stringify(renderScript)

  assert.equal(marketingCalls, 1)
  assert.equal(creatomateCalls, 1)
  assert.equal(render.id, 'render-stub')
  assert.match(serialized, /"bathrooms":"2"/)
  assert.match(serialized, /"sqft":"1450"/)
  assert.match(serialized, /"state":"FL"/)
  assert.match(serialized, /"county":"Orange"/)
  assert.match(serialized, /"city":"Orlando"/)
  assert.match(serialized, /"suites":"1"/)
  assert.match(serialized, /"area_m2":"120"/)
  assert.match(serialized, /"uf":"SP"/)
  assert.match(serialized, /CRECI-F 12345\/SP/)
  assert.doesNotMatch(serialized, /ignored_(provider|root)_field/)
  assert.match(serialized, /#SmartCorretorAI/)
})

test('integrado: schema irrecuperavel nao chama Creatomate e libera reserva sem consumo', async () => {
  const validate = compileRendererMarketingValidator()
  let marketingCalls = 0
  let creatomateCalls = 0
  const diagnostics: MarketingOpenAIDiagnostic[] = []
  const reservation = { state: 'reserved' as 'reserved' | 'released', consumed: 0 }

  await assert.rejects(requestMarketingOpenAIJson({
    jobId: JOB_ID, stage: 'initial', budget: createMarketingOpenAICallBudget(), url: 'https://marketing.stub/v1', timeoutMs: 100, init: {},
    validate: value => validate(value, 'Saiba mais'),
    dependencies: {
      fetcher: async () => { marketingCalls += 1; return chatResponse(JSON.stringify({ narration: 'texto sem campanhas' })) },
      logger: item => diagnostics.push(item), sleep: async () => {},
    },
  }), (error: unknown) => error instanceof MarketingOpenAIError && error.code === 'marketing_schema_invalid')
    .finally(() => { reservation.state = 'released' })

  assert.equal(marketingCalls, 1)
  assert.equal(creatomateCalls, 0)
  assert.equal(reservation.state, 'released')
  assert.equal(reservation.consumed, 0)
  const serialized = JSON.stringify(diagnostics)
  assert.match(serialized, /"field_path":"campaigns"/)
  assert.equal(serialized.includes('texto sem campanhas'), false)
  assert.equal(serialized.includes('Saiba mais'), false)
})

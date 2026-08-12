import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveInstagramConnection } from '../meta-client.ts'
import {
  createInstagramOAuthTelemetryEvent,
  InstagramOAuthTelemetryError,
  logInstagramOAuthEvent,
  type InstagramOAuthTelemetryEvent,
  type InstagramOAuthTelemetryInput,
} from '../telemetry.ts'
import { handleInstagramCallback } from '../../../instagram-callback/runtime.ts'

const USER_ID = '7a66d5cb-16de-4d31-a718-c98f4917af72'
const CALLBACK_URL = 'https://local/callback?code=private-code&state=private-state'
const CONNECTED_REDIRECT = 'https://app.smartcorretor.example/configuracoes?instagram=conectado'
const ERROR_REDIRECT = 'https://app.smartcorretor.example/configuracoes?instagram=erro'

const baseInput = {
  code: 'private-code',
  userId: USER_ID,
  appId: '1166177798972049',
  appSecret: 'private-app-secret',
  redirectUri: 'https://project.supabase.co/functions/v1/instagram-callback',
  graphApiVersion: 'v99.0',
}

const ALL_PERMISSIONS = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
]

const debugTokenResponse = (
  scopes: string[] = ALL_PERMISSIONS,
  granularScopes: unknown[] = [],
) => Response.json({ data: { scopes, granular_scopes: granularScopes } })

const callbackEvents = async (completeConnection: () => Promise<void>) => {
  const events: InstagramOAuthTelemetryEvent[] = []
  const response = await handleInstagramCallback(new Request(CALLBACK_URL), {
    connectedRedirect: CONNECTED_REDIRECT,
    errorRedirect: ERROR_REDIRECT,
    completeConnection,
    log: event => events.push(event),
  })
  return { events, response }
}

const metaFailure = (stage: 'short_token' | 'long_token' | 'pages') => {
  let call = 0
  return (async () => {
    call += 1
    if ((stage === 'short_token' && call === 1) || (stage === 'long_token' && call === 2) || (stage === 'pages' && call === 4)) {
      return Response.json({ error: { message: 'raw-sensitive-message', code: 190, error_subcode: 460 } }, { status: 400 })
    }
    if (call === 1) return Response.json({ access_token: 'short-sensitive-token' })
    if (call === 2) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (call === 3) return debugTokenResponse()
    return Response.json({ data: [] })
  }) as typeof fetch
}

for (const stage of ['short_token', 'long_token', 'pages'] as const) {
  test(`Meta failure records only sanitized ${stage} telemetry`, async () => {
    const { events, response } = await callbackEvents(async () => {
      await resolveInstagramConnection({ ...baseInput, fetcher: metaFailure(stage) })
    })
    assert.equal(response.headers.get('location'), ERROR_REDIRECT)
    assert.deepEqual(events, [{ event: 'instagram_oauth', stage, http_status: 400, meta_code: 190, meta_subcode: 460 }])
    assert.doesNotMatch(JSON.stringify(events), /sensitive|private-code|private-state|raw-sensitive-message/i)
  })
}

test('network failure keeps the current Meta stage without raw error text', async () => {
  const { events } = await callbackEvents(async () => {
    await resolveInstagramConnection({
      ...baseInput,
      fetcher: (async () => { throw new Error('network URL with secret query') }) as typeof fetch,
    })
  })
  assert.deepEqual(events, [{ event: 'instagram_oauth', stage: 'short_token' }])
  assert.doesNotMatch(JSON.stringify(events), /network|secret|query/i)
})

test('state failure records only stage=state', async () => {
  const { events, response } = await callbackEvents(async () => {
    throw new InstagramOAuthTelemetryError({ stage: 'state' })
  })
  assert.equal(response.headers.get('location'), ERROR_REDIRECT)
  assert.deepEqual(events, [{ event: 'instagram_oauth', stage: 'state' }])
})

test('pages and eligible counts are recorded without identifiers', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse()
    return Response.json({ data: [
      { id: 'page-private', access_token: 'page-sensitive-token', instagram_business_account: { id: 'ig-private', username: 'private_username' } },
      { id: 'page-without-instagram', access_token: 'page-other-token' },
    ] })
  }) as typeof fetch

  await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry, [
    {
      stage: 'permissions', instagram_basic: true, instagram_content_publish: true,
      pages_show_list: true, pages_read_engagement: true, page_target_count: 0,
    },
    { stage: 'page_target_probe', target_count: 0 },
    { stage: 'pages', pages_count: 2 },
    { stage: 'eligible_count', eligible_count: 1 },
  ])
  assert.doesNotMatch(JSON.stringify(telemetry), /page-private|ig-private|private_username|sensitive-token/i)
})

test('permissions telemetry reports all grants and deduplicates only Page targets', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  let directProbeCalls = 0
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) {
      assert.match(new Headers(init?.headers).get('Authorization') || '', /^Bearer [^|]+\|[^|]+$/)
      return debugTokenResponse(ALL_PERMISSIONS, [
        { scope: 'pages_show_list', target_ids: ['page-private-a', 'page-private-b'] },
        { scope: 'pages_read_engagement', target_ids: ['page-private-b'] },
        { scope: 'instagram_basic', target_ids: ['instagram-private'] },
      ])
    }
    if (!url.pathname.endsWith('/me/accounts')) directProbeCalls += 1
    return Response.json({ data: [{ id: 'page-private-a', access_token: 'page-sensitive-token', instagram_business_account: { id: 'ig-private', username: 'private_username' } }] })
  }) as typeof fetch

  await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry[0], {
    stage: 'permissions', instagram_basic: true, instagram_content_publish: true,
    pages_show_list: true, pages_read_engagement: true, page_target_count: 2,
  })
  assert.deepEqual(telemetry[1], { stage: 'page_target_probe', target_count: 2 })
  assert.equal(directProbeCalls, 0)
  assert.doesNotMatch(JSON.stringify(telemetry), /page-private|instagram-private|sensitive-token|private_username/i)
})

test('permissions telemetry reports missing grants and zero Page targets without blocking pages', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(['instagram_basic'])
    return Response.json({ data: [{ id: 'page-private', access_token: 'page-sensitive-token', instagram_business_account: { id: 'ig-private' } }] })
  }) as typeof fetch

  await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry[0], {
    stage: 'permissions', instagram_basic: true, instagram_content_publish: false,
    pages_show_list: false, pages_read_engagement: false, page_target_count: 0,
  })
  assert.deepEqual(telemetry.slice(1), [
    { stage: 'page_target_probe', target_count: 0 },
    { stage: 'pages', pages_count: 1 },
    { stage: 'eligible_count', eligible_count: 1 },
  ])
})

test('single complete Page target is used only when /me/accounts returns no pages', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) {
      return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_show_list', target_ids: ['page-private-target'] }])
    }
    if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [] })
    if (url.pathname.endsWith('/me')) return Response.json({ id: 'user-private' })
    assert.equal(url.searchParams.get('fields'), 'id,access_token,instagram_business_account{id,username}')
    return Response.json({
      id: 'page-private-target',
      access_token: 'target-page-sensitive-token',
      instagram_business_account: { id: 'ig-private', username: 'private_target_username' },
    })
  }) as typeof fetch

  const connection = await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry, [
    {
      stage: 'permissions', instagram_basic: true, instagram_content_publish: true,
      pages_show_list: true, pages_read_engagement: true, page_target_count: 1,
    },
    {
      stage: 'page_target_capabilities', target_count: 1,
      has_page_id: true, has_page_access_token: true,
      has_instagram_business_account: true, has_instagram_username: true,
    },
    {
      stage: 'page_target_probe', target_count: 1, token_user_resolved: true,
      target_accessible: true, has_instagram_business_account: true,
    },
    { stage: 'pages', pages_count: 0 },
    { stage: 'pages_fallback', used: true },
    { stage: 'eligible_count', eligible_count: 1 },
  ])
  assert.equal(connection.page_id, 'page-private-target')
  assert.equal(connection.page_access_token, 'target-page-sensitive-token')
  assert.equal(connection.ig_user_id, 'ig-private')
  assert.equal(connection.ig_username, 'private_target_username')
  assert.doesNotMatch(JSON.stringify(telemetry), /page-private|user-private|ig-private|private_target_username|sensitive-token/i)
})

test('/me/accounts remains authoritative when it returns an eligible page', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_show_list', target_ids: ['target-page-private'] }])
    if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [{
      id: 'accounts-page-private', access_token: 'accounts-page-sensitive-token',
      instagram_business_account: { id: 'accounts-ig-private', username: 'accounts_private_username' },
    }] })
    if (url.pathname.endsWith('/me')) return Response.json({ id: 'user-private' })
    return Response.json({
      id: 'target-page-private', access_token: 'target-page-sensitive-token',
      instagram_business_account: { id: 'target-ig-private', username: 'target_private_username' },
    })
  }) as typeof fetch

  const connection = await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.equal(connection.page_id, 'accounts-page-private')
  assert.equal(connection.page_access_token, 'accounts-page-sensitive-token')
  assert.equal(connection.ig_user_id, 'accounts-ig-private')
  assert.equal(connection.ig_username, 'accounts_private_username')
  assert.equal(telemetry.some(event => event.stage === 'pages_fallback'), false)
})

test('single Page target probe reports accessible target without Instagram account', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_read_engagement', target_ids: ['page-private-target'] }])
    if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [{ id: 'page-returned', access_token: 'page-token', instagram_business_account: { id: 'ig-returned' } }] })
    if (url.pathname.endsWith('/me')) return Response.json({ id: 'user-private' })
    return Response.json({ id: 'page-private-target', access_token: 'target-page-sensitive-token' })
  }) as typeof fetch

  await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry[1], {
    stage: 'page_target_capabilities', target_count: 1,
    has_page_id: true, has_page_access_token: true,
    has_instagram_business_account: false, has_instagram_username: false,
  })
  assert.deepEqual(telemetry[2], {
    stage: 'page_target_probe', target_count: 1, token_user_resolved: true,
    target_accessible: true, has_instagram_business_account: false,
  })
})

test('target probe failure logs only sanitized Meta fields and still calls user and /me/accounts', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  let userProbeCalled = false
  let accountsCalled = false
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_show_list', target_ids: ['page-private-target'] }])
    if (url.pathname.endsWith('/me/accounts')) { accountsCalled = true; return Response.json({ data: [] }) }
    if (url.pathname.endsWith('/me')) { userProbeCalled = true; return Response.json({ id: 'user-private' }) }
    return Response.json({ error: { message: 'raw target body', code: 100, error_subcode: 33 } }, { status: 404 })
  }) as typeof fetch

  await assert.rejects(() => resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) }))
  assert.deepEqual(telemetry[1], {
    event: 'instagram_oauth', stage: 'page_target_capabilities',
    http_status: 404, meta_code: 100, meta_subcode: 33,
  })
  assert.equal(userProbeCalled, true)
  assert.equal(accountsCalled, true)
  assert.equal(telemetry.some(event => event.stage === 'pages_fallback'), false)
  assert.doesNotMatch(JSON.stringify(telemetry), /raw target|page-private|user-private|sensitive-token/i)
})

test('user probe failure logs only sanitized Meta fields and leaves /me/accounts authoritative', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  let accountsCalled = false
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_show_list', target_ids: ['page-private-target'] }])
    if (url.pathname.endsWith('/me/accounts')) { accountsCalled = true; return Response.json({ data: [] }) }
    if (url.pathname.endsWith('/me')) return Response.json({ error: { message: 'raw user body', code: 190, error_subcode: 463 } }, { status: 400 })
    return Response.json({
      id: 'page-private-target', access_token: 'target-page-sensitive-token',
      instagram_business_account: { id: 'ig-private', username: 'private_target_username' },
    })
  }) as typeof fetch

  await assert.rejects(() => resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) }))
  assert.deepEqual(telemetry[1], {
    stage: 'page_target_capabilities', target_count: 1,
    has_page_id: true, has_page_access_token: true,
    has_instagram_business_account: true, has_instagram_username: true,
  })
  assert.deepEqual(telemetry[2], {
    event: 'instagram_oauth', stage: 'page_target_probe', probe: 'user',
    http_status: 400, meta_code: 190, meta_subcode: 463,
  })
  assert.equal(accountsCalled, true)
  assert.equal(telemetry.some(event => event.stage === 'pages_fallback'), false)
  assert.doesNotMatch(JSON.stringify(telemetry), /raw user|page-private|ig-private|private_target_username|sensitive-token/i)
})

for (const scenario of [
  {
    name: 'Page ID',
    target: { access_token: 'target-page-sensitive-token', instagram_business_account: { id: 'target-ig-private', username: 'target_private_username' } },
    expected: { has_page_id: false, has_page_access_token: true, has_instagram_business_account: true, has_instagram_username: true },
  },
  {
    name: 'Page access token',
    target: { id: 'target-page-private', instagram_business_account: { id: 'target-ig-private', username: 'target_private_username' } },
    expected: { has_page_id: true, has_page_access_token: false, has_instagram_business_account: true, has_instagram_username: true },
  },
  {
    name: 'Instagram ID',
    target: { id: 'target-page-private', access_token: 'target-page-sensitive-token', instagram_business_account: { username: 'target_private_username' } },
    expected: { has_page_id: true, has_page_access_token: true, has_instagram_business_account: false, has_instagram_username: true },
  },
  {
    name: 'Instagram username',
    target: { id: 'target-page-private', access_token: 'target-page-sensitive-token', instagram_business_account: { id: 'target-ig-private' } },
    expected: { has_page_id: true, has_page_access_token: true, has_instagram_business_account: true, has_instagram_username: false },
  },
] as const) {
  test(`empty /me/accounts does not fall back when target is missing ${scenario.name}`, async () => {
    const telemetry: InstagramOAuthTelemetryInput[] = []
    const fetcher = (async (input: URL | RequestInfo) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
      if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
      if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{ scope: 'pages_show_list', target_ids: ['target-page-private'] }])
      if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [] })
      if (url.pathname.endsWith('/me')) return Response.json({ id: 'user-private' })
      return Response.json(scenario.target)
    }) as typeof fetch

    await assert.rejects(
      () => resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) }),
      error => (error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.stage === 'eligible_count',
    )
    assert.deepEqual(telemetry[1], { stage: 'page_target_capabilities', target_count: 1, ...scenario.expected })
    assert.equal(telemetry.some(event => event.stage === 'pages_fallback'), false)
    assert.doesNotMatch(JSON.stringify(telemetry), /target-page-private|target-ig-private|target_private_username|sensitive-token/i)
  })
}

test('empty /me/accounts does not choose among multiple granular targets', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  let directTargetCalls = 0
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse(ALL_PERMISSIONS, [{
      scope: 'pages_show_list', target_ids: ['target-page-private-a', 'target-page-private-b'],
    }])
    if (url.pathname.endsWith('/me/accounts')) return Response.json({ data: [] })
    directTargetCalls += 1
    return Response.json({})
  }) as typeof fetch

  await assert.rejects(
    () => resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) }),
    error => (error as { telemetry?: InstagramOAuthTelemetryEvent }).telemetry?.stage === 'eligible_count',
  )
  assert.equal(directTargetCalls, 0)
  assert.equal(telemetry.some(event => event.stage === 'pages_fallback'), false)
})

test('debug_token failure is sanitized and does not block the existing pages flow', async () => {
  const telemetry: InstagramOAuthTelemetryInput[] = []
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) {
      return Response.json({ error: { message: 'raw token and target response', code: 190, error_subcode: 463 } }, { status: 400 })
    }
    return Response.json({ data: [{ id: 'page-private', access_token: 'page-sensitive-token', instagram_business_account: { id: 'ig-private' } }] })
  }) as typeof fetch

  await resolveInstagramConnection({ ...baseInput, fetcher, telemetry: event => telemetry.push(event) })
  assert.deepEqual(telemetry, [
    { event: 'instagram_oauth', stage: 'permissions', http_status: 400, meta_code: 190, meta_subcode: 463 },
    { stage: 'pages', pages_count: 1 },
    { stage: 'eligible_count', eligible_count: 1 },
  ])
  assert.doesNotMatch(JSON.stringify(telemetry), /raw token|target response|page-private|sensitive-token/i)
})

test('username processing failure records stage=username', async () => {
  const instagram = { id: 'ig-private' } as Record<string, unknown>
  Object.defineProperty(instagram, 'username', { get: () => { throw new Error('raw username error') } })
  const fetcher = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/oauth/access_token') && url.searchParams.has('code')) return Response.json({ access_token: 'short-sensitive-token' })
    if (url.pathname.endsWith('/oauth/access_token')) return Response.json({ access_token: 'long-sensitive-token', expires_in: 3600 })
    if (url.pathname.endsWith('/debug_token')) return debugTokenResponse()
    return { ok: true, status: 200, json: async () => ({ data: [{ id: 'page-private', access_token: 'page-sensitive-token', instagram_business_account: instagram }] }) } as Response
  }) as typeof fetch

  const { events } = await callbackEvents(async () => {
    await resolveInstagramConnection({ ...baseInput, fetcher })
  })
  assert.deepEqual(events, [{ event: 'instagram_oauth', stage: 'username' }])
})

test('database failure records only stage and sanitized Supabase code', async () => {
  const { events } = await callbackEvents(async () => {
    throw new InstagramOAuthTelemetryError({ stage: 'database', supabase_code: '23505', raw_body: 'forbidden' } as InstagramOAuthTelemetryInput)
  })
  assert.deepEqual(events, [{ event: 'instagram_oauth', stage: 'database', supabase_code: '23505' }])
})

test('success records stage=success and preserves the connected redirect', async () => {
  const { events, response } = await callbackEvents(async () => {})
  assert.deepEqual(events, [{ event: 'instagram_oauth', stage: 'success' }])
  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), CONNECTED_REDIRECT)
})

test('central logger allowlists fields and never serializes raw OAuth data', () => {
  const messages: string[] = []
  logInstagramOAuthEvent(message => messages.push(message), {
    stage: 'pages_fallback',
    http_status: 400,
    meta_code: 190,
    meta_subcode: 460,
    instagram_basic: true,
    instagram_content_publish: true,
    pages_show_list: true,
    pages_read_engagement: true,
    page_target_count: 2,
    probe: 'target',
    target_count: 1,
    token_user_resolved: true,
    target_accessible: true,
    has_instagram_business_account: true,
    has_page_id: true,
    has_page_access_token: true,
    has_instagram_username: true,
    pages_count: 5,
    used: true,
    eligible_count: 1,
    supabase_code: 'PGRST204',
    access_token: 'forbidden',
    page_access_token: 'forbidden',
    code: 'forbidden',
    state: 'forbidden',
    page_id: 'forbidden',
    ig_user_id: 'forbidden',
    Authorization: 'forbidden',
    META_APP_SECRET: 'forbidden',
    SUPABASE_SERVICE_ROLE_KEY: 'forbidden',
    raw_body: 'forbidden',
    target_ids: ['forbidden'],
  } as InstagramOAuthTelemetryInput)

  assert.deepEqual(JSON.parse(messages[0]), {
    event: 'instagram_oauth', stage: 'pages_fallback', http_status: 400, meta_code: 190, meta_subcode: 460,
    instagram_basic: true, instagram_content_publish: true, pages_show_list: true,
    pages_read_engagement: true, page_target_count: 2,
    probe: 'target', target_count: 1, token_user_resolved: true,
    target_accessible: true, has_instagram_business_account: true,
    has_page_id: true, has_page_access_token: true, has_instagram_username: true,
    pages_count: 5, used: true, eligible_count: 1, supabase_code: 'PGRST204',
  })
  assert.doesNotMatch(messages[0], /forbidden|"access_token":|"page_access_token":|code OAuth|state|"page_id":|ig_user_id|target_ids|Authorization|SECRET|raw_body/i)
})

test('callback implementation keeps redirects and contains no raw error logging', () => {
  const files = [
    new URL('../telemetry.ts', import.meta.url),
    new URL('../meta-client.ts', import.meta.url),
    new URL('../../../instagram-callback/index.ts', import.meta.url),
    new URL('../../../instagram-callback/runtime.ts', import.meta.url),
  ]
  const source = files.map(file => readFileSync(file, 'utf8')).join('\n')
  assert.match(source, /Response\.redirect\(dependencies\.connectedRedirect, 303\)/)
  assert.match(source, /Response\.redirect\(dependencies\.errorRedirect, 303\)/)
  assert.doesNotMatch(source, /console\.(?:info|log|warn|error)\([^\n]*(?:error\.message|access_token|page_access_token|page_id|ig_user_id|Authorization)/i)
  assert.doesNotMatch(source, /media_publish|instagram-publish/i)
})

test('telemetry event factory ignores invalid or uncontrolled values', () => {
  assert.deepEqual(createInstagramOAuthTelemetryEvent({
    stage: 'database', http_status: 999, meta_code: '190', meta_subcode: -1,
    pages_count: -2, eligible_count: 1.5, supabase_code: 'unsafe code with spaces',
  }), { event: 'instagram_oauth', stage: 'database' })
})

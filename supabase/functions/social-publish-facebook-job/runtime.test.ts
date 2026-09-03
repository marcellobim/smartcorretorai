import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { publishFacebookPagePhoto } from '../_shared/facebook/publish-client.ts'
import { handleFacebookJobPublish, type FacebookJobPublishDependencies } from './runtime.ts'

const JOB_ID = 'cad35ada-6bef-4e0c-9f22-80433a36f60b'
const CLAIM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOCIAL_ACCOUNT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CAP = '0123456789abcdef0123456789abcdef0123456789a'
const HASH = 'capability-hash'
const PAGE_ID = '123456789012345'
const POST_ID = `${PAGE_ID}_987654321098765`
const CAPTION = 'Criado com o Banner Imobiliário do SmartCorretorAI.\n\nUma forma rápida e profissional de transformar as informações do imóvel em uma peça pronta para divulgação.'

const request = (overrides = {}) => new Request('https://local/social-publish-facebook-job', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ job_id: JOB_ID, claim_token: CLAIM, lease_capability: CAP, ...overrides }),
})

function setup() {
  const calls = {
    capability: 0,
    begin: 0,
    publish: 0,
    complete: 0,
    reconcile: 0,
    stages: [] as string[],
  }
  const dependencies: FacebookJobPublishDependencies = {
    getJob: async () => ({
      id: JOB_ID,
      userId: 'owner-a',
      connectionId: 'connection-a',
      socialAccountId: SOCIAL_ACCOUNT_ID,
      platform: 'facebook',
      caption: CAPTION,
      claimToken: CLAIM,
    }),
    getLease: async () => ({
      id: 'lease-a',
      jobId: JOB_ID,
      capabilityHash: HASH,
      expiresAt: '2026-08-31T18:00:00.000Z',
      contentType: 'image/jpeg',
      contentLength: 166013,
    }),
    hashCapability: async () => HASH,
    validateLeaseUrl: async () => true,
    getActiveAccount: async () => ({
      socialAccountId: SOCIAL_ACCOUNT_ID,
      pageId: PAGE_ID,
      pageName: 'SmartCorretorAI',
      pageAccessToken: 'page-token-private',
      userAccessToken: 'user-token-private',
    }),
    validateCapability: async () => { calls.capability += 1; return true },
    recordConnectionValidation: async () => true,
    beginExternalPublish: async () => { calls.begin += 1; calls.stages.push('begin'); return true },
    publishPhoto: async input => {
      calls.publish += 1
      calls.stages.push('post')
      assert.equal(input.caption, CAPTION)
      assert.equal(input.pageId, PAGE_ID)
      assert.equal(input.imageUrl, `https://project/functions/v1/social-media-lease/${CAP}`)
      return { postId: POST_ID, permalink: `https://www.facebook.com/${POST_ID}` }
    },
    completeJob: async input => {
      calls.complete += 1
      calls.stages.push('complete')
      assert.equal(input.postId, POST_ID)
      return true
    },
    markReconciliationRequired: async () => { calls.reconcile += 1; return true },
    buildLeaseUrl: capability => `https://project/functions/v1/social-media-lease/${capability}`,
    now: () => Date.parse('2026-08-31T12:00:00.000Z'),
    log: stage => calls.stages.push(`log:${stage}`),
  }
  return { dependencies, calls }
}

test('sucesso marca início irreversível antes de um único POST e conclui published', async () => {
  const context = setup()
  const response = await handleFacebookJobPublish(request(), context.dependencies)
  assert.equal(response.status, 200)
  assert.deepEqual(context.calls, {
    capability: 1,
    begin: 1,
    publish: 1,
    complete: 1,
    reconcile: 0,
    stages: ['begin', 'log:external_publish_started', 'post', 'complete', 'log:published'],
  })
  assert.deepEqual(await response.json(), {
    ok: true,
    job_id: JOB_ID,
    destination: 'facebook',
    page_name: 'SmartCorretorAI',
    post_id: POST_ID,
    final_status: 'published',
    lease_closed: true,
    publish_count: 1,
  })
})

test('scope ausente exige reconexão antes do início externo', async () => {
  const context = setup()
  context.dependencies.validateCapability = async () => false
  const response = await handleFacebookJobPublish(request(), context.dependencies)
  assert.equal(response.status, 401)
  assert.equal((await response.json()).code, 'facebook_reconnect_required')
  assert.equal(context.calls.begin, 0)
  assert.equal(context.calls.publish, 0)
})

test('Page diferente da social_account fixada no job é bloqueada', async () => {
  const context = setup()
  context.dependencies.getActiveAccount = async () => ({
    socialAccountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    pageId: '999999999999999',
    pageName: 'Outra Página',
    pageAccessToken: 'page-token-private',
    userAccessToken: 'user-token-private',
  })
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 409)
  assert.equal(context.calls.publish, 0)
})

test('owner errado não obtém o job nem inicia publicação', async () => {
  const context = setup()
  context.dependencies.getJob = async () => null
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 404)
  assert.equal(context.calls.publish, 0)
})

test('lease inválido ou capability divergente bloqueia antes do POST', async () => {
  const context = setup()
  context.dependencies.validateLeaseUrl = async () => false
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 409)
  assert.equal(context.calls.capability, 0)
  assert.equal(context.calls.publish, 0)
})

test('caption_snapshot chega ao Graph exatamente como persistido', async () => {
  const context = setup()
  let receivedCaption = ''
  context.dependencies.publishPhoto = async input => {
    context.calls.publish += 1
    receivedCaption = input.caption
    return { postId: POST_ID, permalink: `https://www.facebook.com/${POST_ID}` }
  }
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 200)
  assert.equal(receivedCaption, CAPTION)
})

test('timeout ambíguo após o POST não repete e exige reconciliation', async () => {
  const context = setup()
  context.dependencies.publishPhoto = async () => {
    context.calls.publish += 1
    throw new Error('timeout')
  }
  const response = await handleFacebookJobPublish(request(), context.dependencies)
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'facebook_publish_ambiguous')
  assert.equal(context.calls.publish, 1)
  assert.equal(context.calls.complete, 0)
  assert.equal(context.calls.reconcile, 1)
})

test('replay de job já consumido não produz segundo POST', async () => {
  const context = setup()
  let available = true
  context.dependencies.getJob = async () => {
    if (!available) return null
    available = false
    return {
      id: JOB_ID, userId: 'owner-a', connectionId: 'connection-a', socialAccountId: SOCIAL_ACCOUNT_ID,
      platform: 'facebook', caption: CAPTION, claimToken: CLAIM,
    }
  }
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 200)
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 404)
  assert.equal(context.calls.publish, 1)
})

test('disconnect torna conta indisponível antes do POST', async () => {
  const context = setup()
  context.dependencies.getActiveAccount = async () => null
  assert.equal((await handleFacebookJobPublish(request(), context.dependencies)).status, 409)
  assert.equal(context.calls.publish, 0)
})

test('cliente Graph usa somente POST /{page_id}/photos e não altera a legenda', async () => {
  let calls = 0
  const result = await publishFacebookPagePhoto({
    pageId: PAGE_ID,
    pageAccessToken: 'page-token-private',
    imageUrl: 'https://project.supabase.co/functions/v1/social-media-lease/opaque',
    caption: CAPTION,
    graphApiVersion: 'v26.0',
    fetcher: async (input, init) => {
      calls += 1
      assert.equal(String(input), `https://graph.facebook.com/v26.0/${PAGE_ID}/photos`)
      assert.equal(init?.method, 'POST')
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer page-token-private')
      assert.doesNotMatch(String(input), /token/i)
      const body = init?.body as URLSearchParams
      assert.equal(body.get('caption'), CAPTION)
      assert.equal(body.get('published'), 'true')
      return Response.json({ id: '987654321098765', post_id: POST_ID })
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.postId, POST_ID)
})

test('recovery permanece owner-scoped, read-only e expõe external_post_id só em published', () => {
  const migration = readFileSync(new URL('../../migrations/20260831010000_prepare_facebook_photo_publish_worker.sql', import.meta.url), 'utf8')
  const recovery = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.get_social_publish_job_recovery'))
  assert.match(recovery, /j\.user_id = auth\.uid\(\)/)
  assert.match(recovery, /CASE WHEN j\.status = 'published' THEN j\.external_post_id ELSE NULL END/)
  assert.doesNotMatch(recovery, /access_token|ciphertext|credential_nonce|auth_tag/i)
  assert.doesNotMatch(recovery, /INSERT INTO|UPDATE public\.social_publish_jobs|media_publish|\/photos/i)
})

test('migration fixa social_account e preserva guards/grants server-side', () => {
  const migration = readFileSync(new URL('../../migrations/20260831010000_prepare_facebook_photo_publish_worker.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN IF NOT EXISTS social_account_id UUID/)
  assert.match(migration, /FOREIGN KEY \(social_account_id, user_id, social_connection_id\)[\s\S]*?REFERENCES public\.social_accounts\(id, user_id, social_connection_id\)/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.start_facebook_photo_publish/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.complete_facebook_photo_publish/)
  assert.match(migration, /SECURITY DEFINER[\s\S]*?SET search_path = ''/)
  assert.match(migration, /j\.claim_token = p_claim_token[\s\S]*?j\.status = 'processing'[\s\S]*?j\.platform = 'facebook'/)
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.start_facebook_photo_publish[\s\S]*?FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.start_facebook_photo_publish[\s\S]*?TO service_role/)
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.start_facebook_photo_publish[^;]*TO authenticated/)
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.complete_facebook_photo_publish[^;]*TO authenticated/)
})

test('tokens nunca aparecem em logs ou resposta pública', async () => {
  const context = setup()
  const logs: string[] = []
  context.dependencies.log = (stage, details) => logs.push(JSON.stringify({ stage, details }))
  const response = await handleFacebookJobPublish(request(), context.dependencies)
  const serialized = JSON.stringify({ body: await response.json(), logs })
  assert.doesNotMatch(serialized, /page-token-private|user-token-private|access_token|ciphertext|auth_tag|nonce/i)
})

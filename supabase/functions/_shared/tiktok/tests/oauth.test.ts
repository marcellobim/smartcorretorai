import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTikTokAuthorizationUrl, createTikTokOAuthState, consumeTikTokOAuthState } from '../oauth.ts'
import type { TikTokOAuthStateRepository, TikTokOAuthStateRecord } from '../types.ts'
import type { TikTokIdentity } from '../environment.ts'

const USER_ID = '7a66d5cb-16de-4d31-a718-c98f4917af72'
const REDIRECT_URI = 'https://project.supabase.co/functions/v1/tiktok-callback'
const identity: TikTokIdentity = { environment: 'sandbox', appId: 'a'.repeat(64) }
const NOW = Date.UTC(2026, 8, 20)
function repository() {
  let dbNow = NOW
  const records = new Map<string, TikTokOAuthStateRecord & { expiresAt: number; consumed: boolean }>()
  const repo: TikTokOAuthStateRepository = {
    async persistChallenge(record) {
      if (records.has(record.stateHash)) throw new Error('duplicate_state')
      records.set(record.stateHash, { ...record, expiresAt: dbNow + 300_000, consumed: false })
    },
    async consumeChallenge(input) {
      const row = records.get(input.stateHash)
      if (!row || row.consumed || row.expiresAt <= dbNow || row.environment !== input.environment
          || row.appId !== input.appId || row.redirectUriHash !== input.redirectUriHash) return null
      row.consumed = true
      return { userId: row.userId }
    },
  }
  return { repo, records, advance: (ms: number) => { dbNow += ms } }
}
const issue = (repo: TikTokOAuthStateRepository, id = identity) => createTikTokOAuthState({ userId: USER_ID, redirectUri: REDIRECT_URI, identity: id }, repo)
const consume = (repo: TikTokOAuthStateRepository, state: string, id = identity) => consumeTikTokOAuthState({ state, expectedRedirectUri: REDIRECT_URI, identity: id }, repo)

test('OAuth requests exactly user.info.basic and rejects posting scopes and unsafe redirects', () => {
  const input = { clientKey: 'client-key-123', redirectUri: REDIRECT_URI, state: 'A'.repeat(43) }
  const url = new URL(buildTikTokAuthorizationUrl(input))
  assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/')
  assert.equal(url.searchParams.get('scope'), 'user.info.basic')
  assert.equal(url.searchParams.has('client_secret'), false)
  for (const scopes of [[], ['video.upload'], ['user.info.basic', 'video.publish']])
    assert.throws(() => buildTikTokAuthorizationUrl({ ...input, scopes }), /invalid_tiktok_login_scopes/)
  for (const redirectUri of ['http://example.com/x', 'https://example.com/x?a=b', 'https://example.com/x#x'])
    assert.throws(() => buildTikTokAuthorizationUrl({ ...input, redirectUri }), /invalid_tiktok_redirect_uri/)
})

test('state stores hashes, user, environment and app; never application expiry or clock', async () => {
  const { repo, records } = repository()
  let sent: unknown
  const skewedInput = { userId: USER_ID, redirectUri: REDIRECT_URI, identity, now: 0 }
  const issued = await createTikTokOAuthState(skewedInput, { ...repo, async persistChallenge(row) { sent = row; await repo.persistChallenge(row) } })
  const row = [...records.values()][0]
  assert.match(row.stateHash, /^[0-9a-f]{64}$/)
  assert.match(row.redirectUriHash, /^[0-9a-f]{64}$/)
  assert.equal(row.expiresAt, NOW + 300_000)
  assert.equal(row.environment, 'sandbox')
  assert.equal(row.appId, identity.appId)
  assert.doesNotMatch(JSON.stringify(sent), /expiresAt|"now"/)
  assert.equal(JSON.stringify(sent).includes(issued.state), false)
})
for (const environment of ['sandbox', 'production'] as const) {
  test(environment + ' state cannot be consumed in the other environment or app', async () => {
    const { repo } = repository()
    const id = { ...identity, environment }
    const { state } = await issue(repo, id)
    await assert.rejects(() => consume(repo, state, { ...id, environment: environment === 'sandbox' ? 'production' : 'sandbox' }), /not_available/)
    await assert.rejects(() => consume(repo, state, { ...id, appId: 'b'.repeat(64) }), /not_available/)
    assert.deepEqual(await consume(repo, state, id), { userId: USER_ID })
    await assert.rejects(() => consume(repo, state, id), /not_available/)
  })
}
test('database time enforces TTL; redirects and replay fail closed', async () => {
  const { repo, advance } = repository()
  const { state } = await issue(repo)
  await assert.rejects(() => consumeTikTokOAuthState({ state, expectedRedirectUri: 'https://example.com/other', identity }, repo), /not_available/)
  advance(300_000)
  await assert.rejects(() => consume(repo, state), /not_available/)
})
test('simulated concurrent consumption has one winner', async () => {
  const { repo } = repository(), { state } = await issue(repo)
  const outcomes = await Promise.allSettled([consume(repo, state), consume(repo, state)])
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1)
})
test('invalid environment fails before persistence/consumption', async () => {
  const { repo } = repository()
  await assert.rejects(() => issue(repo, { ...identity, environment: 'invalid' as never }), /invalid_tiktok_identity/)
  await assert.rejects(() => consume(repo, 'A'.repeat(43), { ...identity, appId: '' }), /invalid_tiktok_identity/)
})

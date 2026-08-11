import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  deleteInstagramConnection,
  getInstagramConnection,
  normalizeInstagramConnection,
  startInstagramConnection,
  validateInstagramAuthorizationUrl,
} from '../src/lib/instagram-connection.js'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pageSource = await readFile(path.join(frontendRoot, 'src/pages/Configuracoes.jsx'), 'utf8')

const officialAuthorizationUrl = 'https://www.facebook.com/v26.0/dialog/oauth?client_id=1166177798972049&redirect_uri=https%3A%2F%2Fsfbowejaevlmhcvsxhbk.supabase.co%2Ffunctions%2Fv1%2Finstagram-callback&state=signed-state&scope=instagram_basic%2Cinstagram_content_publish%2Cpages_show_list%2Cpages_read_engagement'

const clientFor = (responses, calls = []) => ({
  functions: {
    invoke: async (name, options) => {
      calls.push({ name, options })
      return responses[options.method]
    },
  },
})

test('keeps existing public social links and adds a separate Instagram publishing panel', () => {
  for (const field of ['instagram', 'facebook', 'linkedin', 'site']) {
    assert.match(pageSource, new RegExp(`(?:^|\\n)  ${field}: \\{`))
  }
  assert.match(pageSource, /Object\.keys\(SOCIAL_LINK_CONFIG\)/)
  assert.match(pageSource, /registration=\{regPerfil\(network/)
  assert.match(pageSource, /Publicação no Instagram/)
  assert.match(pageSource, /Conectar Instagram/)
  assert.match(pageSource, /Nunca pediremos sua senha/)
})

test('GET renders a normalized disconnected or connected state without internal identifiers', async () => {
  const disconnected = await getInstagramConnection(clientFor({ GET: { data: { ok: true, connected: false }, error: null } }))
  assert.deepEqual(disconnected, normalizeInstagramConnection())

  const connected = await getInstagramConnection(clientFor({ GET: { data: {
    ok: true,
    connected: true,
    instagram_username: '@conta_profissional',
    token_expires_at: '2026-10-10T00:00:00.000Z',
    access_token: 'must-not-reach-ui',
    page_access_token: 'must-not-reach-ui',
    page_id: 'internal-page',
    ig_user_id: 'internal-user',
  }, error: null } }))

  assert.deepEqual(connected, {
    connected: true,
    instagramUsername: 'conta_profissional',
    tokenExpiresAt: '2026-10-10T00:00:00.000Z',
    status: 'connected',
  })
  assert.doesNotMatch(JSON.stringify(connected), /must-not-reach-ui|internal-page|internal-user/)
  assert.match(pageSource, /Instagram conectado/)
  assert.match(pageSource, /Status: Conectado/)
})

test('POST runs only from the connect handler and navigates to the returned official OAuth URL', async () => {
  const calls = []
  const navigated = []
  await startInstagramConnection(clientFor({ POST: { data: { ok: true, authorization_url: officialAuthorizationUrl }, error: null } }, calls), value => navigated.push(value))

  assert.deepEqual(calls, [{ name: 'instagram-connection', options: { method: 'POST' } }])
  assert.deepEqual(navigated, [officialAuthorizationUrl])
  assert.match(pageSource, /onClick=\{handleConnectInstagram\}/)
  assert.match(pageSource, /window\.location\.assign\(authorizationUrl\)/)
})

test('rejects an absent or unofficial authorization URL with a safe message', async () => {
  assert.throws(() => validateInstagramAuthorizationUrl('https://example.test/oauth?state=x'), /Não foi possível iniciar/)
  await assert.rejects(
    startInstagramConnection(clientFor({ POST: { data: { ok: true }, error: null } }), () => {}),
    /Não foi possível iniciar/,
  )
  assert.doesNotMatch(pageSource, /error\.message.*access_token|console\.(?:log|info).*session/i)
})

test('DELETE is confirmation-gated and updates the local disconnected state', async () => {
  const calls = []
  assert.deepEqual(
    await deleteInstagramConnection(clientFor({ DELETE: { data: { ok: true, connected: false }, error: null } }, calls)),
    normalizeInstagramConnection(),
  )
  assert.deepEqual(calls, [{ name: 'instagram-connection', options: { method: 'DELETE' } }])
  assert.match(pageSource, /window\.confirm\('Desconectar o Instagram profissional do SmartCorretorAI\?'\)/)
  assert.match(pageSource, /setInstagramConnection\(disconnected\)/)
})

test('callback query feedback refreshes status and removes only callback parameters', () => {
  assert.match(pageSource, /igStatus === 'conectado'/)
  assert.match(pageSource, /Instagram conectado com sucesso\./)
  assert.match(pageSource, /igStatus === 'erro'/)
  assert.match(pageSource, /Não foi possível conectar o Instagram/)
  assert.match(pageSource, /nextParams\.delete\('instagram'\)/)
  assert.match(pageSource, /setSearchParams\(nextParams, \{ replace: true \}\)/)
  assert.match(pageSource, /activeTab !== 'redes'/)
  assert.match(pageSource, /getInstagramConnection\(supabase\)/)
})

test('does not implement publishing, token storage or SharePublishActions', async () => {
  const helperSource = await readFile(path.join(frontendRoot, 'src/lib/instagram-connection.js'), 'utf8')
  const combined = `${pageSource}\n${helperSource}`
  assert.doesNotMatch(combined, /media_publish|['"]instagram-publish['"]|SharePublishActions/)
  assert.doesNotMatch(combined, /localStorage|sessionStorage|service_role/i)
  assert.doesNotMatch(pageSource, /password.*Instagram|senha.*input/i)
})

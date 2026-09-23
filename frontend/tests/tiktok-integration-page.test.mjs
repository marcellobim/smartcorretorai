import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/TikTokIntegration.jsx', import.meta.url), 'utf8')

test('page implements every approved visual state without disconnect controls', () => {
  assert.match(page, /status: status.status/)
  assert.match(page, /access_token_expired/)
  assert.match(page, /reconnect_required/)
  for (const status of ['loading', 'connecting', 'confirming', 'connected', 'error']) {
    assert.match(page, new RegExp(`status: '${status}'`), status)
  }
  for (const label of [
    'Consultando sua conexão...',
    'TikTok não conectado',
    'Iniciando conexão segura...',
    'Conexão recebida. Confirmando...',
    'TikTok conectado',
    'Não foi possível conectar o TikTok',
  ]) assert.ok(page.includes(label), label)
  assert.doesNotMatch(page, /Desconectar TikTok/)
})

test('connected callback confirms through GET before showing connected', () => {
  const callbackBranch = page.indexOf("outcome === 'connected'")
  const confirming = page.indexOf("status: 'confirming'", callbackBranch)
  const getStatus = page.indexOf('void loadStatus()', confirming)
  const connected = page.indexOf("status: 'connected'")
  assert.ok(callbackBranch >= 0)
  assert.ok(confirming > callbackBranch)
  assert.ok(getStatus > confirming)
  assert.ok(connected >= 0)
  assert.match(page, /getTikTokConnectionStatus\(supabase\)/)
})

test('callback errors use allowlisted messages and never render raw reason', () => {
  for (const reason of [
    'authorization_denied', 'callback_invalid', 'code_missing', 'scope_missing', 'state_invalid',
  ]) assert.match(page, new RegExp(`\\b${reason}:`), reason)
  assert.match(page, /CALLBACK_MESSAGES\[reason\] \?\?/)
  assert.doesNotMatch(page, /\{reason\}/)
  assert.doesNotMatch(page, /setView\([^)]*message:\s*reason/)
})

test('callback query parameters are removed with replace while preserving unrelated parameters', () => {
  assert.match(page, /searchParams\.delete\('tiktok'\)/)
  assert.match(page, /searchParams\.delete\('reason'\)/)
  assert.match(page, /history\.replaceState\(/)
})

test('page uses only the isolated TikTok client and contains no Meta dependency or credential', () => {
  assert.match(page, /from '\.\.\/lib\/tiktok-oauth-connection'/)
  assert.doesNotMatch(page, /meta-oauth|instagram|facebook/i)
  assert.doesNotMatch(page.replaceAll('access_token_expired', ''), /CLIENT_SECRET|access_token|refresh_token|keyring|cryptographic/i)
})

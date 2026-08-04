import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const authSource = readFileSync(new URL('../src/lib/auth-context.jsx', import.meta.url), 'utf8')

test('authentication diagnostics are DEV-only and contain no persistent identifiers', () => {
  assert.match(authSource, /if \(!import\.meta\.env\.DEV\) return/)
  assert.doesNotMatch(authSource, /console\.(?:log|warn|error)\(`[^`]*(?:uid|userId|email|nome|token)[^`]*\$\{/i)
  assert.doesNotMatch(authSource, /console\.(?:log|warn|error)\([^\n]*(?:data\.nome|data\.full_name|sessionUser\?\.id|\buid\b)/)
  assert.doesNotMatch(authSource, /devAuthLog\([^\n]*(?:data\.nome|data\.full_name|sessionUser\?\.id|\buid\b|\bemail\b|access_token)/)
  assert.match(authSource, /profile load success/)
  assert.match(authSource, /session present:/)
  assert.match(authSource, /token present:/)
})

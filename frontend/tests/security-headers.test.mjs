import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const globalRule = config.headers?.find(rule => rule.source === '/(.*)')
const headers = Object.fromEntries((globalRule?.headers || []).map(header => [header.key.toLowerCase(), header.value]))

test('all routes receive baseline browser security headers', () => {
  assert.equal(headers['x-content-type-options'], 'nosniff')
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin')
  assert.equal(headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()')
})

test('clickjacking is blocked by modern CSP and legacy compatibility header', () => {
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/)
  assert.match(headers['content-security-policy'], /object-src 'none'/)
  assert.equal(headers['x-frame-options'], 'DENY')
})

test('compatibility CSP is report-only, explicit and contains no unsafe eval', () => {
  const policy = headers['content-security-policy-report-only']
  assert.match(policy, /script-src 'self'/)
  assert.match(policy, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co https:\/\/servicodados\.ibge\.gov\.br/)
  assert.match(policy, /img-src 'self' data: blob: https:/)
  assert.match(policy, /media-src 'self' blob: https:/)
  assert.match(policy, /frame-src https:\/\/js\.stripe\.com https:\/\/hooks\.stripe\.com https:\/\/checkout\.stripe\.com/)
  assert.doesNotMatch(policy, /'unsafe-eval'/)
  assert.doesNotMatch(policy, /default-src \*/)
})

test('security headers live only in the tracked root deployment configuration', () => {
  assert.equal(config.framework, 'vite')
  assert.ok(Array.isArray(config.rewrites))
})

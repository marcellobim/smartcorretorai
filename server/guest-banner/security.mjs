import { createHmac, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'

export const SESSION_COOKIE = '__Host-sca-guest'
export const CLAIM_COOKIE = '__Host-sca-guest-claim'
export const GENERATION_ENABLED = true // Existing SQL policy/cap remains authoritative.
export const CLAIM_ENABLED = true // Existing authenticated claim RPC owns the transition.
export const ENTRY_EVENTS = new Set(['guest_landing_started', 'guest_banner_started'])
const OPAQUE = /^[A-Za-z0-9_-]{43}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const newOpaqueToken = () => randomBytes(32).toString('base64url')
export function digest(secret, purpose, value) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('guest_configuration_required')
  return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest('hex')
}
// Future completion adapter retains the plaintext only in a host-only HttpOnly
// claim cookie. Only this digest is passed to guest_banner_finish; never analytics.
export function newClaimCredential(secret) {
  const token = newOpaqueToken()
  return { token, hash: digest(secret, 'claim', token) }
}
export function readCookie(header, name) {
  if (typeof header !== 'string' || header.length > 8192) return null
  const matches = header.split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`))
  if (matches.length !== 1) return null
  const token = matches[0].slice(name.length + 1)
  return OPAQUE.test(token) ? token : null
}
export function sessionCookie(token, expiresAt, now = Date.now()) {
  if (!OPAQUE.test(token)) throw new Error('invalid_cookie')
  const maxAge = Math.max(0, Math.min(604800, Math.floor((Date.parse(expiresAt) - now) / 1000)))
  if (!Number.isFinite(maxAge) || maxAge === 0) throw new Error('invalid_expiry')
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}
export function networkSignal(headers, env, now = Date.now()) {
  // Only a Vercel ingress-owned header is trusted. No client body or arbitrary XFF fallback.
  // Moving hosts/reverse proxies requires a new trust-boundary review, not a fallback.
  if (env.VERCEL !== '1') throw new Error('trusted_ingress_required')
  const raw = headers['x-vercel-forwarded-for']
  if (typeof raw !== 'string' || !isIP(raw.trim())) throw new Error('trusted_ingress_required')
  // URL parsing normalizes equivalent IPv6 representations. Raw IP lives only in memory.
  const ip = isIP(raw.trim()) === 6 ? new URL(`http://[${raw.trim()}]`).hostname : raw.trim()
  return digest(env.GUEST_NETWORK_HMAC_SECRET, `network:${new Date(now).toISOString().slice(0, 10)}`, ip)
}
export function validOrigin(headers, env) {
  try {
    const expected = new URL(env.GUEST_APP_ORIGIN || 'https://www.smartcorretorai.com')
    return expected.protocol === 'https:' && headers.origin === expected.origin &&
      headers.host === expected.host && (!headers['sec-fetch-site'] || headers['sec-fetch-site'] === 'same-origin')
  } catch { return false }
}
export function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request')
  const fields = {
    event: ['action', 'eventType'],
    generate: ['action', 'clientRequestId', 'banner'],
    status: ['action'],
    claim: ['action'],
  }[body.action]
  if (!fields || Object.keys(body).some(key => !fields.includes(key))) throw new Error('invalid_request')
  if (body.action === 'event' && !ENTRY_EVENTS.has(body.eventType)) throw new Error('invalid_request')
  if (body.action === 'generate' && (!UUID.test(body.clientRequestId || '') ||
    !body.banner || typeof body.banner !== 'object' || Array.isArray(body.banner))) throw new Error('invalid_request')
  return body
}

// Prepared cost gate, intentionally NOT routed to any provider/public generate action.
// Internal callers must pass a cookie-derived session hash. RPCs remain authoritative.
export async function preparePromotion({ sessionHash, networkHash, clientRequestId, turnstileToken, hostname }, deps) {
  if (!sessionHash || !UUID.test(clientRequestId || '') || typeof turnstileToken !== 'string' ||
    !turnstileToken.length || turnstileToken.length > 2048) return { error: 'invalid_request' }
  if (!await deps.rpc('guest_banner_rate_take', { p_scope: 'generation_attempt', p_hash: sessionHash })) return { error: 'rate_limited' }
  // Session-scoped, deterministic UUID prevents a caller sharing verification retries across sessions.
  const hash = digest(deps.secret, 'turnstile-retry', `${sessionHash}:${clientRequestId}`)
  const verificationKey = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  const verified = await deps.verify({ token: turnstileToken, idempotencyKey: verificationKey })
  if (verified?.success !== true || verified.hostname !== hostname || verified.action !== 'guest_banner_generate') return { error: 'challenge_required' }
  return deps.rpc('guest_banner_reserve', { p_session_hash: sessionHash, p_network_hash: networkHash, p_client_request_id: clientRequestId })
}

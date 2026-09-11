import {
  GENERATION_ENABLED, CLAIM_ENABLED, SESSION_COOKIE, digest, newOpaqueToken,
  networkSignal, readCookie, sessionCookie, validOrigin, validateBody,
} from './security.mjs'
import { createGuestTransport } from './transport.mjs'

export function createGuestHandler({ env = process.env, transport, clock = Date.now, tokenFactory = newOpaqueToken } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('CDN-Cache-Control', 'no-store')
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    const reply = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)) }
    if (req.method === 'GET') return reply(200, { generationEnabled: GENERATION_ENABLED, claimEnabled: CLAIM_ENABLED })
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(405, { error: 'method_not_allowed' }) }
    // Same-origin JSON-only writes + host-only SameSite cookie; no CORS credential sharing.
    if (!validOrigin(req.headers, env)) return reply(403, { error: 'origin_not_allowed' })
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415, { error: 'json_required' })
    if (Number(req.headers['content-length']) > 4 * 1024 * 1024) return reply(413, { error: 'request_too_large' })
    let body
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      if (!raw || Buffer.byteLength(raw) > 4 * 1024 * 1024) return reply(413, { error: 'request_too_large' })
      body = validateBody(JSON.parse(raw))
    } catch { return reply(400, { error: 'invalid_request' }) }
    // Application gates precede every backend call; the DB also enforces eligibility.
    if (body.action === 'generate' && !GENERATION_ENABLED) return reply(423, { error: 'guest_generation_disabled' })
    if (body.action === 'claim' && !CLAIM_ENABLED) return reply(423, { error: 'guest_claim_disabled' })
    try {
      const now = clock()
      const networkHash = networkSignal(req.headers, env, now)
      const previous = readCookie(req.headers.cookie, SESSION_COOKIE)
      const token = tokenFactory()
      const hashToken = value => digest(env.GUEST_SESSION_HMAC_SECRET, 'session', value)
      const client = transport || createGuestTransport(env)
      if (body.action !== 'event') {
        if (!previous) return reply(401,{error:'session_required'})
        const accessToken = body.action === 'claim' ? String(req.headers.authorization || '').replace(/^Bearer\s+/i,'') : undefined
        if (body.action === 'claim' && !accessToken) return reply(401,{error:'authentication_required'})
        const result = await client.banner({action:`guest_${body.action}`,sessionHash:hashToken(previous),networkHash,
          claimHash:digest(env.GUEST_SESSION_HMAC_SECRET,'claim',previous),
          ...(body.action==='generate'?{clientRequestId:body.clientRequestId,banner:body.banner}:{}),
          ...(accessToken?{accessToken}:{}),
        })
        return reply(200,result)
      }
      const result = await client.rpc('guest_banner_open', {
        p_existing_hash: previous ? hashToken(previous) : null,
        p_new_hash: hashToken(token), p_network_hash: networkHash, p_event_type: body.eventType,
      })
      if (!result?.allowed) { res.setHeader('Retry-After', '3600'); return reply(429, { error: 'rate_limited' }) }
      res.setHeader('Set-Cookie', sessionCookie(result.newSession ? token : previous, result.expiresAt, now))
      return reply(200, { ok: true, generationEnabled: GENERATION_ENABLED })
    } catch {
      // Do not echo backend errors: they can contain hashes, credentials or query values.
      return reply(503, { error: 'guest_unavailable' })
    }
  }
}

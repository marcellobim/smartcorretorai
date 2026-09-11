// Server-only fetch clients. Never imported by frontend; no request/response logging.
export function createGuestTransport(env, fetchImpl = fetch) {
  const base = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key || new URL(base).protocol !== 'https:') throw new Error('guest_configuration_required')
  return {
    async banner(payload) {
      const response = await fetchImpl(`${base.replace(/\/$/, '')}/functions/v1/gerar-hero-ia`, {
        method:'POST', headers:{apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json','x-sca-guest-action':'1'},
        body:JSON.stringify(payload), signal:AbortSignal.timeout(45000),redirect:'error',
      })
      if (!response.ok) throw new Error('guest_unavailable')
      return response.json()
    },
    async rpc(name, args, bearer = key) {
      const response = await fetchImpl(`${base.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('guest_storage_unavailable')
      return response.json()
    },
    async verify({ token, idempotencyKey }) {
      if (!env.GUEST_TURNSTILE_SECRET_KEY) throw new Error('guest_configuration_required')
      const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // remoteip intentionally omitted: no raw IP transmitted from application code.
        body: JSON.stringify({ secret: env.GUEST_TURNSTILE_SECRET_KEY, response: token, idempotency_key: idempotencyKey }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('challenge_unavailable')
      return response.json()
    },
  }
}

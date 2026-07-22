export const corsHeaders = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': [
    'authorization',
    'Authorization',
    'x-client-info',
    'X-Client-Info',
    'apikey',
    'ApiKey',
    'content-type',
    'Content-Type',
    'prefer',
    'Prefer',
    'x-supabase-api-version',
    'X-Supabase-Api-Version',
    'x-supabase-authorization',
    'X-Supabase-Authorization',
    'accept',
    'Accept',
  ].join(', '),
  'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
  'Access-Control-Max-Age': '86400',
})

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ensureCors(response: Response) {
  for (const [header, value] of Object.entries(corsHeaders)) response.headers.set(header, value)
  return response
}

export function withCors(handler: (request: Request) => Response | Promise<Response>) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
    if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)

    try {
      return ensureCors(await handler(request))
    } catch {
      return jsonResponse({ ok: false, error: 'Não foi possível processar sua solicitação.' }, 500)
    }
  }
}

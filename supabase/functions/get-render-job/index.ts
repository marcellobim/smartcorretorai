import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function readJobId(req: Request) {
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('jobId') || url.searchParams.get('job_id')
  if (fromQuery) return fromQuery

  if (req.method === 'GET') return ''

  const payload = await req.json().catch(() => ({}))
  const jobId = (payload as Record<string, unknown>).jobId || (payload as Record<string, unknown>).job_id
  return typeof jobId === 'string' ? jobId : ''
}

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Variaveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return jsonResponse({ error: 'Nao autorizado: token ausente' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.warn(`[${reqId}] token invalido:`, authError?.message)
      return jsonResponse({ error: 'Nao autorizado: token invalido' }, 401)
    }

    const jobId = await readJobId(req)
    if (!jobId) {
      return jsonResponse({ error: 'jobId e obrigatorio' }, 400)
    }

    const { data: job, error: jobError } = await supabase
      .from('render_jobs')
      .select(`
        id,
        status,
        total,
        completed,
        failed,
        failed_templates,
        renders,
        error,
        created_at,
        updated_at,
        started_at,
        finished_at
      `)
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (jobError) {
      console.error(`[${reqId}] render_jobs select error:`, jobError)
      return jsonResponse({ error: jobError.message }, 500)
    }

    if (!job) {
      return jsonResponse({ error: 'Job nao encontrado' }, 404)
    }

    return jsonResponse({
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      failedTemplates: job.failed_templates,
      renders: job.renders,
      error: job.error,
      created_at: job.created_at,
      updated_at: job.updated_at,
      started_at: job.started_at,
      finished_at: job.finished_at,
    }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

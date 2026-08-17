import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  AdminAuthorizationError,
  requireAuthorizedAdmin,
} from '../_shared/admin-authorization.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_PLANS = new Set(['starter', 'pro', 'enterprise', 'imobiliaria'])

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error('Configuracao administrativa indisponivel.')
  return value
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido.' }, 405)

  try {
    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )

    const authorization = req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authorization)) {
      return jsonResponse({ error: 'Sessao invalida.' }, 401)
    }

    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) return jsonResponse({ error: 'Sessao invalida.' }, 401)

    // Mandatory server-side gate before reading the requested action or data.
    await requireAuthorizedAdmin(supabase, user.id)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action || '')

    if (action === 'overview') {
      const [profiles, campaigns] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }),
      ])
      if (profiles.error || campaigns.error) throw new Error('Falha ao carregar resumo administrativo.')
      return jsonResponse({ totalUsers: profiles.count || 0, totalCampaigns: campaigns.count || 0 })
    }

    if (action === 'list_users') {
      const [{ data: profiles, error: profilesError }, { data: admins, error: adminsError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nome, email, plano, saldo_creditos, creditos_avulsos, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('admin_users').select('user_id'),
      ])
      if (profilesError || adminsError) throw new Error('Falha ao carregar usuarios.')
      const adminIds = new Set((admins || []).map((admin) => admin.user_id))
      return jsonResponse({ users: (profiles || []).map((profile) => ({
        ...profile,
        is_admin: adminIds.has(profile.id),
        totalCampaigns: 0,
      })) })
    }

    if (action === 'list_campaigns') {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, user_id, titulo, status, created_at, profiles(nome, email)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw new Error('Falha ao carregar campanhas.')
      return jsonResponse({ campaigns: data || [] })
    }

    if (action === 'get_user') {
      const userId = String(body.userId || '')
      if (!UUID_PATTERN.test(userId)) return jsonResponse({ error: 'Usuario invalido.' }, 400)
      const [{ data: profile, error }, { data: admin }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nome, email, plano, saldo_creditos, creditos_avulsos, created_at')
          .eq('id', userId)
          .maybeSingle(),
        supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
      ])
      if (error || !profile) return jsonResponse({ error: 'Usuario nao encontrado.' }, 404)
      return jsonResponse({
        user: { ...profile, is_admin: admin?.user_id === userId },
        stats: { totalCampaigns: 0, totalProperties: 0 },
      })
    }

    if (action === 'update_user_plan') {
      const userId = String(body.userId || '')
      const plan = String(body.plan || '').toLowerCase()
      if (!UUID_PATTERN.test(userId) || !ALLOWED_PLANS.has(plan)) {
        return jsonResponse({ error: 'Alteracao invalida.' }, 400)
      }
      const { error } = await supabase.from('profiles').update({ plano: plan }).eq('id', userId)
      if (error) throw new Error('Falha ao atualizar plano.')
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Acao administrativa invalida.' }, 400)
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return jsonResponse({ error: error.message }, error.status)
    }
    console.error('admin-api failure', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Operacao administrativa indisponivel.' }, 500)
  }
})

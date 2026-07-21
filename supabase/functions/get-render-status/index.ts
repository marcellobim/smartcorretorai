import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
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
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const normalizeRenderId = (value: unknown) => (
  typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value.trim())
    ? value.trim()
    : null
)

const READY_STATUSES = new Set(['succeeded', 'completed'])
const ERROR_STATUSES = new Set(['failed', 'error', 'canceled', 'timeout'])
const FINAL_STATUSES = new Set([...READY_STATUSES, ...ERROR_STATUSES])

const normalizeStatus = (value: unknown) => String(value || 'planned').toLowerCase()
const serializeErrorForLog = (error: unknown) => {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  return {
    message: error instanceof Error ? error.message : String(error),
    code: value.code || null,
    details: value.details || value.cause || null,
    stack: error instanceof Error ? error.stack || null : value.stack || null,
  }
}
const toPositiveInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
  }
  return 0
}

type StoredRender = Record<string, unknown>

async function finalizePieceCredit(
  supabase: ReturnType<typeof createClient>,
  reqId: string,
  userId: string,
  storedRender: StoredRender | undefined,
  status: string,
) {
  const creditKey = typeof storedRender?.credit_idempotency_key === 'string'
    ? storedRender.credit_idempotency_key
    : ''
  const creditAmount = toPositiveInteger(storedRender?.credit_amount)
  const currentCreditStatus = typeof storedRender?.credit_status === 'string'
    ? storedRender.credit_status
    : ''

  if (!creditKey || creditAmount <= 0) return currentCreditStatus || 'not_required'
  if (currentCreditStatus === 'consumed' || currentCreditStatus === 'cancelled') return currentCreditStatus
  if (!FINAL_STATUSES.has(status)) return currentCreditStatus || 'reserved'

  if (READY_STATUSES.has(status)) {
    const { data, error } = await supabase.rpc('consume_reserved_credits', {
      p_user_id: userId,
      p_idempotency_key: creditKey,
      p_observacao: 'Consumo de créditos por peça visual entregue',
      p_metadata: {
        render_id: storedRender?.render_id || null,
        template_id: storedRender?.template_id || null,
        template_nome: storedRender?.template_nome || null,
        render_status: status,
        credit_amount: creditAmount,
        credit_scope: 'visual_piece',
      },
    })
    if (error) {
      console.warn(`[${reqId}] falha ao consumir crédito da peça ${storedRender?.render_id}:`, error.message)
      return currentCreditStatus || 'reserved'
    }
    const reservation = Array.isArray(data) ? data[0] : data
    return typeof reservation?.status === 'string' ? reservation.status : 'consumed'
  }

  const { data, error } = await supabase.rpc('cancel_credit_reservation', {
    p_user_id: userId,
    p_idempotency_key: creditKey,
    p_reason: `render_${status}`,
  })
  if (error) {
    console.warn(`[${reqId}] falha ao cancelar crédito da peça ${storedRender?.render_id}:`, error.message)
    return currentCreditStatus || 'reserved'
  }
  const reservation = Array.isArray(data) ? data[0] : data
  return typeof reservation?.status === 'string' ? reservation.status : 'cancelled'
}

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY')

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }, 500)
    }
    if (!CREATOMATE_API_KEY) {
      return jsonResponse({ error: 'CREATOMATE_API_KEY não configurada' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization header ausente ou inválido' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (!user || authError) {
      console.warn(`[${reqId}] token inválido:`, authError?.message)
      return jsonResponse({ error: 'Não autorizado' }, 401)
    }

    const payload = await req.json().catch(() => ({})) as Record<string, unknown>
    const rawIds = Array.isArray(payload.render_ids)
      ? payload.render_ids
      : Array.isArray(payload.renderIds)
        ? payload.renderIds
        : []
    const renderIds = rawIds.map(normalizeRenderId).filter(Boolean) as string[]
    const payloadRenders = Array.isArray(payload.renders) ? payload.renders as StoredRender[] : []

    if (renderIds.length === 0) {
      return jsonResponse({ error: 'render_ids obrigatório' }, 400)
    }
    if (renderIds.length > 30) {
      return jsonResponse({ error: 'Limite de 30 renders por consulta' }, 400)
    }

    const campaignId = typeof payload.campaign_id === 'string' ? payload.campaign_id : ''
    const markTimeout = payload.mark_timeout === true || payload.force_timeout === true
    const refreshUrls = payload.refresh_urls === true || payload.refreshUrls === true
    let campaignBanners: StoredRender[] = []
    if (campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, banners')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (campaignError) {
        console.warn(`[${reqId}] erro ao validar campanha:`, campaignError.message)
        return jsonResponse({ error: 'Falha ao validar campanha' }, 500)
      }
      if (!campaign) {
        return jsonResponse({ error: 'Campanha não encontrada' }, 404)
      }
      campaignBanners = Array.isArray(campaign.banners) ? campaign.banners as StoredRender[] : []
    }

    console.log(`[${reqId}] get-render-status renders=${renderIds.length}`)

    const renders = await Promise.all(renderIds.map(async (renderId) => {
      const storedRender =
        campaignBanners.find(item => item?.render_id === renderId)
        || payloadRenders.find(item => item?.render_id === renderId)
      let respostaHttp: Record<string, unknown> | null = null
      let corpoResposta: unknown = null
      try {
        if (markTimeout) {
          const status = 'timeout'
          const creditStatus = await finalizePieceCredit(supabase, reqId, user.id, storedRender, status)
          return {
            ...(storedRender || {}),
            render_id: renderId,
            status,
            erro: 'Tempo limite de processamento atingido.',
            credit_status: creditStatus,
          }
        }

        const response = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(renderId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${CREATOMATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15000),
        })
        respostaHttp = {
          status: response.status,
          status_text: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        }
        const responseText = await response.text()
        corpoResposta = responseText

        if (!response.ok) {
          console.error(`[${reqId}] Creatomate status falhou:\n${JSON.stringify({
            render_id: renderId,
            template_id: storedRender?.template_id || null,
            template_name: storedRender?.template_name || storedRender?.template_nome || null,
            status: response.status,
            payload_enviado: storedRender?.payload_enviado || null,
            resposta_http: respostaHttp,
            corpo_resposta: responseText,
          }, null, 2)}`)
          const status = response.status === 404 ? 'failed' : normalizeStatus(storedRender?.status || 'rendering')
          const creditStatus = await finalizePieceCredit(supabase, reqId, user.id, storedRender, status)
          return {
            ...(storedRender || {}),
            render_id: renderId,
            status,
            url: null,
            download_url: null,
            preview_url: null,
            snapshot_url: null,
            ...(response.status === 404
              ? { erro: `Creatomate ${response.status}: ${responseText}` }
              : { erro: null, error_message: null, poll_warning: `Creatomate ${response.status}` }),
            resposta_http: respostaHttp,
            corpo_resposta: responseText,
            credit_status: creditStatus,
          }
        }

        const data = JSON.parse(responseText)
        corpoResposta = data
        const status = normalizeStatus(data.status || 'planned')
        const ready = READY_STATUSES.has(status)
        const finalUrl = ready && typeof data.url === 'string' && data.url.trim()
          ? data.url.trim()
          : null
        console.log(`[${reqId}] render lifecycle`, {
          render_id: data.id || renderId,
          status,
          final_url_requested: ready,
          refresh_urls: refreshUrls,
          final_url_available: Boolean(finalUrl),
        })
        if (ERROR_STATUSES.has(status) || data.error || data.error_message) {
          console.error(`[${reqId}] Creatomate render falhou:\n${JSON.stringify({
            render_id: data.id || renderId,
            template_id: storedRender?.template_id || data.template_id || null,
            template_name: storedRender?.template_name || storedRender?.template_nome || null,
            status,
            payload_enviado: storedRender?.payload_enviado || null,
            resposta_http: respostaHttp,
            corpo_resposta: data,
            error_message: data.error_message || data.error?.message || data.error || null,
            error_code: data.error_code || data.error?.code || null,
            error_details: data.error_details || data.error?.details || null,
            error_stack: data.stack || data.error?.stack || null,
          }, null, 2)}`)
        }
        const creditStatus = await finalizePieceCredit(supabase, reqId, user.id, storedRender, status)
        return {
          ...(storedRender || {}),
          render_id: data.id || renderId,
          status,
          url: finalUrl,
          download_url: finalUrl,
          preview_url: finalUrl,
          snapshot_url: ready ? finalUrl : null,
          final_url_requested_at: ready ? new Date().toISOString() : null,
          erro: null,
          error_message: data.error_message || data.error || null,
          error_code: data.error_code || data.error?.code || null,
          error_details: data.error_details || data.error?.details || null,
          error_stack: data.stack || data.error?.stack || null,
          resposta_http: respostaHttp,
          corpo_resposta: data,
          poll_warning: null,
          credit_status: creditStatus,
        }
      } catch (error) {
        const serializedError = serializeErrorForLog(error)
        console.error(`[${reqId}] erro ao consultar render:\n${JSON.stringify({
          render_id: renderId,
          template_id: storedRender?.template_id || null,
          template_name: storedRender?.template_name || storedRender?.template_nome || null,
          status: storedRender?.status || null,
          payload_enviado: storedRender?.payload_enviado || null,
          resposta_http: respostaHttp,
          corpo_resposta: corpoResposta,
          error_message: serializedError.message,
          error_code: serializedError.code,
          error_details: serializedError.details,
          error_stack: serializedError.stack,
        }, null, 2)}`)
        const storedStatus = normalizeStatus(storedRender?.status || 'rendering')
        const status = FINAL_STATUSES.has(storedStatus) ? storedStatus : 'rendering'
        const creditStatus = await finalizePieceCredit(supabase, reqId, user.id, storedRender, status)
        return {
          ...(storedRender || {}),
          render_id: renderId,
          status,
          url: null,
          download_url: null,
          preview_url: null,
          snapshot_url: null,
          erro: null,
          error_message: serializedError.message,
          error_code: serializedError.code,
          error_details: serializedError.details,
          error_stack: serializedError.stack,
          resposta_http: respostaHttp,
          corpo_resposta: corpoResposta,
          poll_warning: error instanceof Error ? error.message : String(error),
          credit_status: creditStatus,
        }
      }
    }))

    if (campaignId && campaignBanners.length > 0) {
      const updatesById = new Map(renders.map(render => [render.render_id, render]))
      const nextBanners = campaignBanners.map(item => {
        const renderId = typeof item?.render_id === 'string' ? item.render_id : ''
        const update = updatesById.get(renderId)
        return update ? { ...item, ...update } : item
      })

      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ banners: nextBanners })
        .eq('id', campaignId)
        .eq('user_id', user.id)

      if (updateError) {
        console.warn(`[${reqId}] falha ao persistir status de renders:`, updateError.message)
      }
    }

    return jsonResponse({ success: true, renders }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

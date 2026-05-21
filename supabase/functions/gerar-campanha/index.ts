import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `Você é um especialista em marketing imobiliário brasileiro. Gere conteúdo persuasivo e específico em português para o imóvel descrito pelo usuário.

Responda APENAS com um objeto JSON válido (sem markdown, sem texto fora do JSON), no formato EXATO abaixo, preenchendo TODOS os 6 campos com conteúdo real e específico para o imóvel informado:

{
  "titulo_campanha": "Título curto e memorável do imóvel",
  "descricao_portal": "Texto técnico e detalhado para portais (ZAP/VivaReal) com [Inserir CRECI].",
  "post_instagram": "Texto persuasivo com emojis, gatilhos de exclusividade e 5 a 10 hashtags estratégicas.",
  "script_video_reels": "Roteiro de 30-60s: [0-5s Gancho], [5-20s Tour pelo Imóvel], [20-30s CTA].",
  "carrossel_passo_a_passo": [
    "Slide 1 (Capa): Título com gatilho de curiosidade.",
    "Slide 2: Benefício principal do imóvel.",
    "Slide 3: Detalhe surpreendente.",
    "Slide 4: Localização e região.",
    "Slide 5 (CTA): Chamada para ação."
  ],
  "mensagem_whatsapp": "Texto curto e amigável para WhatsApp."
}`

serve(async (req) => {
  const reqId = crypto.randomUUID().slice(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    console.log(`[${reqId}] ENV check:`, {
      SUPABASE_URL: !!SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
      OPENAI_API_KEY: !!OPENAI_API_KEY,
      OPENAI_API_KEY_length: OPENAI_API_KEY?.length ?? 0,
    })

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }, 500)
    }
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: 'OPENAI_API_KEY não configurada' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const payload = await req.json().catch(() => ({}))
    const {
      categoria,
      tipo,
      dados,
      fotos_urls,
      redes_sociais,
      user_id: payloadUserId,
    } = payload as Record<string, unknown>

    // === Auth opcional (mantida intacta) =============================
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (user && !authError) {
        userId = user.id
      } else {
        console.warn(`[${reqId}] token inválido, fallback para payload.user_id:`, authError?.message)
      }
    }

    if (!userId && typeof payloadUserId === 'string' && payloadUserId.length > 0) {
      userId = payloadUserId
    }

    if (!userId) {
      return jsonResponse({ error: 'Não autorizado: forneça token válido ou user_id no payload' }, 401)
    }

    if (!tipo) {
      return jsonResponse({ error: 'Payload inválido: `tipo` é obrigatório' }, 400)
    }

    console.log(`[${reqId}] userId=${userId} tipo=${tipo} categoria=${categoria}`)

    // === Chamada DIRETA à OpenAI (fetch nativo, single shot, 45s) ====
    const dadosObj = (dados as Record<string, unknown> | null) || {}
    const diferenciaisRaw = Array.isArray(dadosObj.diferenciais)
      ? (dadosObj.diferenciais as unknown[])
      : []
    const diferenciaisSanitizados = diferenciaisRaw
      .map((d) =>
        String(d ?? '')
          .replace(new RegExp('[\\x00-\\x1f\\x7f]', 'g'), '') // remove control chars
          .replace(/[\\"`]/g, '')                 // remove \, ", `
          .replace(/\s+/g, ' ')                   // normaliza espaços
          .trim()
      )
      .filter(Boolean)
    const diferenciaisStr = diferenciaisSanitizados.join(', ')

    const { diferenciais: _omitDif, ...dadosSemDif } = dadosObj

    const userPrompt = `Imóvel:
- Tipo: ${tipo}
- Categoria: ${categoria || 'não informada'}
- Diferenciais: ${diferenciaisStr || 'nenhum informado'}
- Dados: ${JSON.stringify(dadosSemDif, null, 2)}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        stream: false,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text()
      console.error(`[${reqId}] OpenAI ${openaiRes.status}:`, errBody.slice(0, 300))
      return jsonResponse(
        { error: `OpenAI retornou ${openaiRes.status}: ${errBody.slice(0, 300)}` },
        502,
      )
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData?.choices?.[0]?.message?.content
    if (!rawContent) {
      return jsonResponse({ error: 'OpenAI retornou resposta sem conteúdo' }, 502)
    }

    let textos_gerados: Record<string, unknown>
    try {
      textos_gerados = JSON.parse(rawContent)
    } catch (e) {
      console.error(`[${reqId}] JSON parse error`, e, rawContent.slice(0, 300))
      return jsonResponse({ error: 'Resposta da OpenAI não é JSON válido' }, 502)
    }

    const titulo = (textos_gerados.titulo_campanha as string) || `Imóvel ${tipo}`
    console.log(`[${reqId}] OpenAI OK | titulo="${titulo}"`)

    // === Insert APENAS em colunas garantidas pelo schema base ========
    // Schema base (001_initial_schema.sql) garante: user_id, titulo, status,
    // dados_imovel (JSONB), redes_sociais (TEXT[]), textos_gerados (JSONB).
    // Campos opcionais (categoria, fotos_urls) vão DENTRO de dados_imovel
    // para evitar "column does not exist" caso a migration 20260518 não tenha rodado.
    const { data: campanha, error: dbError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        titulo,
        status: 'concluido',
        dados_imovel: {
          tipo,
          categoria,
          fotos_urls: (fotos_urls as string[]) || [],
          ...(dados as object || {}),
        },
        redes_sociais: (redes_sociais as string[]) || [],
        textos_gerados,
      })
      .select()
      .single()

    if (dbError) {
      console.error(`[${reqId}] insert error`, JSON.stringify(dbError))
      // Devolve os textos mesmo com falha de DB para o frontend não perder o trabalho da OpenAI
      return jsonResponse({
        error: `Erro ao salvar campanha: ${dbError.message}`,
        code: dbError.code,
        hint: dbError.hint,
        textos: textos_gerados,
      }, 500)
    }

    console.log(`[${reqId}] OK id=${campanha?.id}`)
    return jsonResponse({ success: true, campanha, textos: textos_gerados }, 200)

  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

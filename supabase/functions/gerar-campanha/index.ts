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

const SYSTEM_PROMPT = `Você é um especialista em marketing imobiliário brasileiro. Gere conteúdo persuasivo, específico e em português para o imóvel descrito pelo usuário.

Responda APENAS com um objeto JSON válido (sem markdown, sem texto fora do JSON), no formato EXATO abaixo, preenchendo TODOS os 7 campos com conteúdo real e específico para o imóvel informado:

{
  "titulo_campanha": "Título curto e memorável do imóvel",
  "descricao_portal": "Texto técnico e detalhado para portais (ZAP/VivaReal). Se o CRECI real não for informado, não mencione CRECI e não use placeholders. Não inclua hashtags.",
  "post_instagram": "Texto persuasivo para Instagram com gatilhos comerciais e CTA. Não inclua hashtags no corpo do texto.",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
  "script_video_reels": "Roteiro de 30-60s: [0-5s Gancho], [5-20s Tour pelo Imóvel], [20-30s CTA]. Não inclua hashtags.",
  "carrossel_passo_a_passo": [
    "Slide 1 (Capa): Título com gatilho de curiosidade.",
    "Slide 2: Benefício principal do imóvel.",
    "Slide 3: Detalhe surpreendente.",
    "Slide 4: Localização e região.",
    "Slide 5 (CTA): Chamada para ação."
  ],
  "mensagem_whatsapp": "Texto curto e amigável para WhatsApp. Não inclua hashtags."
}

REGRAS PARA HASHTAGS:
- Gere de 12 a 15 hashtags relevantes, prontas para copiar.
- Prefira hashtags sem acentos e sem cedilha: use #ImoveisSP, #SaoPauloImoveis, #ApartamentoAVenda.
- Não use palavras estranhas, traduções ruins ou termos inexistentes como #AparelhoImobiliario.
- Não use Premium, Luxo, AltoPadrao ou similares se a categoria/perfil não for luxo, alto padrão ou premium.
- Considere tipo do imóvel, finalidade de venda, cidade, bairro, mercado imobiliário e diferenciais informados.
- Evite hashtags genéricas demais e não invente condições como financiamento, metrô ou vista se não estiverem nos dados.
- Não misture hashtags em descricao_portal, mensagem_whatsapp, script_video_reels ou post_instagram.
- Nunca invente CRECI, telefone, e-mail ou dados do corretor. Se não forem informados, omita.

REGRAS PARA MENSAGEM WHATSAPP:
- Escreva como mensagem pronta do corretor para enviar ao lead.
- Nunca escreva como se fosse o cliente perguntando.
- Não use "Estou interessado", "Tenho interesse" ou variações em primeira pessoa do lead.
- Exemplo de tom: "Olá, tudo bem? Tenho um apartamento à venda na Lapa com 120m², 2 quartos e 1 vaga. Posso te enviar mais detalhes ou agendar uma visita?"

REGRAS DE VERACIDADE:
- Não invente metrô, escola, shopping, transporte público, lazer, cultura, vista, financiamento, condomínio, segurança ou qualquer diferencial não informado.
- Só cite diferenciais, condições e facilidades que estejam claramente nos dados ou nos diferenciais informados.
- Médio Padrão: linguagem clara, comercial e direta.
- Alto Padrão/Luxo: linguagem mais sofisticada.
- Minha Casa Minha Vida: foco em oportunidade, entrada, financiamento ou subsídio apenas se informado.
- MVP atual: sempre trate o imóvel como imóvel à venda. Não gere textos de aluguel, locação, temporada ou Airbnb.`

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function toHashtag(value: string) {
  const clean = stripDiacritics(value)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
  return clean ? `#${clean}` : ''
}

function normalizeHashtags(input: unknown, dados: Record<string, unknown>, tipo: unknown, categoria: unknown) {
  const categoriaTexto = String(categoria || '').toLowerCase()
  const isLuxury = /luxo|alto\s*padrao|alto\s*padr[aã]o|premium/.test(categoriaTexto)
  const cidade = String(dados.cidade || '').trim()
  const bairro = String(dados.bairro || '').trim()
  const tipoImovel = String(tipo || dados.tipo || 'Imovel').trim()
  const diferenciaisTexto = [
    dados.diferenciais,
    dados.descricao,
    dados.observacoes,
  ].flat().filter(Boolean).join(' ').toLowerCase()

  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/\s+/)
      : []

  const blocked = [
    /aparelho/i,
    /premium|luxo|altopadrao|alto_padrao|alto-padrao/i,
  ]
  const normalized: string[] = []
  for (const item of raw) {
    const tag = toHashtag(String(item).replace(/^#/, ''))
    if (!tag) continue
    if (blocked[0].test(tag)) continue
    if (!isLuxury && blocked[1].test(tag)) continue
    if (/financiamento|subsidio|entrada/i.test(tag) && !/financiamento|subs[ií]dio|entrada/.test(diferenciaisTexto)) continue
    if (!normalized.includes(tag)) normalized.push(tag)
  }

  const fallback = [
    toHashtag(`${tipoImovel} a venda`),
    cidade ? toHashtag(`${tipoImovel} ${cidade}`) : '',
    cidade ? toHashtag(`Imoveis ${cidade}`) : '',
    bairro && cidade ? toHashtag(`${bairro} ${cidade}`) : '',
    bairro ? toHashtag(`Imoveis na ${bairro}`) : '',
    toHashtag(`Venda de ${tipoImovel}`),
    '#MercadoImobiliario',
    '#CorretorDeImoveis',
    '#ImovelAVenda',
    bairro ? toHashtag(`Morar na ${bairro}`) : '',
    cidade ? toHashtag(`${cidade} Imoveis`) : '',
    /financiamento|subs[ií]dio|entrada/.test(diferenciaisTexto) ? '#FinanciamentoImobiliario' : '',
  ].filter(Boolean)

  for (const tag of fallback) {
    if (normalized.length >= 15) break
    if (!normalized.includes(tag)) normalized.push(tag)
  }

  const genericRelevant = [
    '#Imoveis',
    '#Imobiliaria',
    '#NegociosImobiliarios',
    '#AnuncioImobiliario',
    '#DivulgacaoImobiliaria',
    '#OportunidadeImobiliaria',
  ]
  for (const tag of genericRelevant) {
    if (normalized.length >= 12) break
    if (!normalized.includes(tag)) normalized.push(tag)
  }

  return normalized.slice(0, 15)
}

function buildWhatsappFallback(dados: Record<string, unknown>, tipo: unknown) {
  const tipoImovel = String(tipo || dados.tipo || 'imóvel').toLowerCase()
  const acao = 'à venda'
  const bairro = String(dados.bairro || '').trim()
  const area = dados.area ? `${dados.area}m²` : ''
  const quartos = dados.quartos ? `${dados.quartos} quarto${Number(dados.quartos) === 1 ? '' : 's'}` : ''
  const vagas = dados.vagas ? `${dados.vagas} vaga${Number(dados.vagas) === 1 ? '' : 's'}` : ''
  const detalhes = [bairro ? `na ${bairro}` : '', area ? `com ${area}` : '', quartos, vagas].filter(Boolean).join(', ')
  return `Olá, tudo bem? Tenho um ${tipoImovel} ${acao}${detalhes ? ` ${detalhes}` : ''}. Posso te enviar mais detalhes ou agendar uma visita?`
}

function normalizeSpaces(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function capitalizePtWord(word: string) {
  if (!word) return ''
  return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')
}

function normalizeBairro(value: unknown) {
  const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return normalizeSpaces(value)
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase('pt-BR')
      return index > 0 && connectors.has(lower) ? lower : capitalizePtWord(lower)
    })
    .join(' ')
}

function normalizeShortFreeText(value: unknown, maxLength = 120) {
  const cleaned = normalizeSpaces(value).slice(0, maxLength)
  return cleaned ? cleaned.charAt(0).toLocaleUpperCase('pt-BR') + cleaned.slice(1) : ''
}

function normalizeMasterPropertyInput(dados: Record<string, unknown>) {
  const destaquesSelecionados = Array.isArray(dados.destaques_selecionados)
    ? dados.destaques_selecionados.map((item) => normalizeShortFreeText(item, 80)).filter(Boolean)
    : []
  const destaquePersonalizado = normalizeShortFreeText(dados.destaque_personalizado, 120)
  const diferenciais = Array.isArray(dados.diferenciais)
    ? dados.diferenciais.map((item) => normalizeShortFreeText(item, 120)).filter(Boolean)
    : []
  const mergedDestaques = Array.from(new Set([
    ...destaquesSelecionados,
    ...(destaquePersonalizado ? [destaquePersonalizado] : []),
    ...diferenciais,
  ])).slice(0, 8)

  return {
    ...dados,
    finalidade: 'venda',
    negocio: 'venda',
    bairro: normalizeBairro(dados.bairro),
    destaques_selecionados: destaquesSelecionados,
    destaque_personalizado: destaquePersonalizado || null,
    diferenciais: mergedDestaques,
  }
}

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
    } = payload as Record<string, unknown>

    // JWT obrigatório: a identidade nunca vem do payload.
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authorization header ausente ou inválido' }, 401)
    }
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (!user || authError) {
      console.warn(`[${reqId}] token inválido:`, authError?.message)
      return jsonResponse({ error: 'Não autorizado' }, 401)
    }
    const userId = user.id

    if (!tipo) {
      return jsonResponse({ error: 'Payload inválido: `tipo` é obrigatório' }, 400)
    }

    console.log(`[${reqId}] gerar-campanha autenticada | tipo=${tipo} categoria=${categoria}`)

    // === Chamada DIRETA à OpenAI (fetch nativo, single shot, 45s) ====
    const dadosObj = normalizeMasterPropertyInput((dados as Record<string, unknown> | null) || {})
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
      return jsonResponse({ error: `OpenAI retornou ${openaiRes.status}` }, 502)
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

    if (!Array.isArray(textos_gerados.hashtags)) {
      const postInstagram = String(textos_gerados.post_instagram || '')
      const extracted = postInstagram.match(/#[\p{L}\p{N}_]+/gu) || []
      textos_gerados.hashtags = extracted.slice(0, 20)
    }
    textos_gerados.hashtags = normalizeHashtags(textos_gerados.hashtags, dadosObj, tipo, categoria)
    const whatsappText = String(textos_gerados.mensagem_whatsapp || '')
    if (/\b(estou|tenho)\s+(interessad[oa]|interesse)\b/i.test(whatsappText)) {
      textos_gerados.mensagem_whatsapp = buildWhatsappFallback(dadosObj, tipo)
    }
    const titulo = (textos_gerados.titulo_campanha as string) || `Imóvel ${tipo}`
    console.log(`[${reqId}] OpenAI OK`)

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
          ...dadosObj,
        },
        redes_sociais: (redes_sociais as string[]) || [],
        textos_gerados,
      })
      .select()
      .single()

    if (dbError) {
      console.error(`[${reqId}] insert error`, dbError.code, dbError.message)
      // Devolve os textos mesmo com falha de DB para o frontend não perder o trabalho da OpenAI
      return jsonResponse({
        error: `Erro ao salvar campanha: ${dbError.message}`,
        code: dbError.code,
        hint: dbError.hint,
        textos: textos_gerados,
      }, 500)
    }

    console.log(`[${reqId}] OK`)
    return jsonResponse({ success: true, campanha, textos: textos_gerados }, 200)

  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

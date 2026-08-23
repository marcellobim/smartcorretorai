import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProduct3PurposeLabel, normalizeProduct3Purpose } from '../_shared/product3-contract.ts'
import { normalizeOfficialHashtags } from '../_shared/official-hashtags.ts'
import { GOOGLE_ADS_PROMPT_RULES, validateGoogleAdsDelivery } from '../_shared/google-ads.ts'

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

ENTREGA ADICIONAL OBRIGATORIA:
${GOOGLE_ADS_PROMPT_RULES}
Acrescente ao objeto raiz o campo "google_ads" com exatamente: headlines, long_headline, descriptions, cta e suggested_keywords.

REGRAS PARA HASHTAGS:
- Gere de 12 a 15 hashtags relevantes, prontas para copiar.
- Pense como um estrategista de marketing imobiliário: combine naturalmente localização, tipo, finalidade, estilo de vida sustentado, diferenciais reais e intenção de busca.
- Misture hashtags amplas, médias e específicas sem apenas colocar # na frente dos campos recebidos.
- Varie a seleção e as combinações entre imóveis semelhantes.
- Não repita hashtags e evite excesso de #Imoveis, #CorretorDeImoveis e #MercadoImobiliario.
- Inclua #SmartCorretorAI naturalmente no meio da lista, nunca no início ou no final.
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

const PRODUCT_3_PURPOSE_PROMPT = `
REGRAS DE FINALIDADE (estas regras substituem qualquer regra anterior conflitante):
- Respeite exatamente a finalidade canonica informada: sale significa venda; rental significa locacao.
- Em rental, use exclusivamente linguagem de locacao, valor mensal e disponibilidade. Nunca use "a venda", compra, financiamento, entrada de compra ou hashtags de venda.
- Em sale, use exclusivamente linguagem de venda e nunca use badge ou linguagem de locacao.
- Em imovel comercial, use linguagem empresarial e nunca "novo lar", "familia" ou "pronto para morar".
- Preserve literalmente a disponibilidade, o condominio e o IPTU quando informados; nao invente periodicidade para IPTU.
- Nao inclua hashtags no corpo dos textos. Inclua #SmartCorretorAI no bloco de hashtags.`

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
  const purpose = normalizeProduct3Purpose(dados.finalidade ?? dados.negocio)
  const isRental = purpose === 'rental'
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
    if (isRental && /avenda|vendadeimoveis|compra|financiamento/i.test(tag)) continue
    if (!isRental && /paraalugar|paralocacao|aluguel|locacaodeimoveis/i.test(tag)) continue
    if (/financiamento|subsidio|entrada/i.test(tag) && !/financiamento|subs[ií]dio|entrada/.test(diferenciaisTexto)) continue
    if (!normalized.includes(tag)) normalized.push(tag)
  }

  const fallback = [
    toHashtag(`${tipoImovel} ${isRental ? 'para alugar' : 'a venda'}`),
    cidade ? toHashtag(`${tipoImovel} ${cidade}`) : '',
    cidade ? toHashtag(`Imoveis ${cidade}`) : '',
    bairro && cidade ? toHashtag(`${bairro} ${cidade}`) : '',
    bairro ? toHashtag(`Imoveis na ${bairro}`) : '',
    toHashtag(`${isRental ? 'Locacao de' : 'Venda de'} ${tipoImovel}`),
    '#MercadoImobiliario',
    '#CorretorDeImoveis',
    isRental ? '#ImovelParaLocacao' : '#ImovelAVenda',
    isRental ? '#Aluguel' : '',
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

  const brandIndex = normalized.findIndex((tag) => tag.toLocaleLowerCase('pt-BR') === '#smartcorretorai')
  if (brandIndex >= 0) normalized.splice(brandIndex, 1)
  normalized.splice(Math.floor(normalized.length / 2), 0, '#SmartCorretorAI')

  return normalized.slice(0, 15)
}

const CAMPAIGN_PUBLIC_ERROR = 'Não foi possível concluir esta criação. Revise os dados ou tente novamente em alguns instantes.'
const CAMPAIGN_SAVE_WARNING = 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'

function buildWhatsappFallback(dados: Record<string, unknown>, tipo: unknown) {
  const tipoImovel = String(tipo || dados.tipo || 'imóvel').toLowerCase()
  const acao = normalizeProduct3Purpose(dados.finalidade ?? dados.negocio) === 'rental' ? 'para locação' : 'à venda'
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

function normalizeCampaignPropertyInput(dados: Record<string, unknown>) {
  const purpose = normalizeProduct3Purpose(dados.finalidade ?? dados.negocio)
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
    finalidade: purpose,
    negocio: purpose,
    bairro: normalizeBairro(dados.bairro),
    destaques_selecionados: destaquesSelecionados,
    destaque_personalizado: destaquePersonalizado || null,
    diferenciais: mergedDestaques,
  }
}

function validateGeneratedPurpose(texts: Record<string, unknown>, dados: Record<string, unknown>) {
  const purpose = normalizeProduct3Purpose(dados.finalidade ?? dados.negocio)
  const prose = stripDiacritics(Object.entries(texts)
    .filter(([key]) => key !== 'hashtags')
    .map(([, value]) => typeof value === 'string' ? value : JSON.stringify(value))
    .join(' ')).toLocaleLowerCase('pt-BR')
  const commercial = /comercial|corporativ|sala|conjunto|loja|laje|galpao/i.test(stripDiacritics(String(dados.tipo || '')))
  if (purpose === 'rental' && /a venda|oportunidade de compra|financiamento|condicoes de compra/i.test(prose)) {
    throw new Error('Conteudo inconsistente: a campanha de locacao recebeu linguagem de venda')
  }
  if (purpose === 'sale' && /para locacao|para alugar/i.test(prose)) {
    throw new Error('Conteudo inconsistente: a campanha de venda recebeu linguagem de locacao')
  }
  if (commercial && /pronto para morar|novo lar|sua familia/i.test(prose)) {
    throw new Error('Conteudo inconsistente: o imovel comercial recebeu linguagem residencial')
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
    const dadosObj = normalizeCampaignPropertyInput((dados as Record<string, unknown> | null) || {})
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
- Finalidade canônica: ${dadosObj.finalidade} (${getProduct3PurposeLabel(dadosObj.finalidade)})
- Disponibilidade: ${dadosObj.situacao || dadosObj.disponibilidade || 'não informada'}
- Valor: ${dadosObj.preco_exibicao || dadosObj.preco || 'não informado'}
- Condomínio: ${dadosObj.condominio_exibicao || dadosObj.condominio || 'não informado'}
- IPTU: ${dadosObj.iptu_exibicao || dadosObj.iptu || 'não informado'}
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
          { role: 'system', content: `${SYSTEM_PROMPT}\n${PRODUCT_3_PURPOSE_PROMPT}` },
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
      console.error(`[${reqId}] internal_code=CAMPAIGN_PROVIDER_HTTP_ERROR status=${openaiRes.status}`, errBody.slice(0, 300))
      return jsonResponse({ error: CAMPAIGN_PUBLIC_ERROR }, 502)
    }

    const openaiData = await openaiRes.json()
    const rawContent = openaiData?.choices?.[0]?.message?.content
    if (!rawContent) {
      console.error(`[${reqId}] internal_code=CAMPAIGN_PROVIDER_EMPTY_RESPONSE`)
      return jsonResponse({ error: CAMPAIGN_PUBLIC_ERROR }, 502)
    }

    let textos_gerados: Record<string, unknown>
    try {
      textos_gerados = JSON.parse(rawContent)
    } catch (e) {
      console.error(`[${reqId}] internal_code=CAMPAIGN_PROVIDER_JSON_PARSE_ERROR`, e, rawContent.slice(0, 300))
      return jsonResponse({ error: CAMPAIGN_PUBLIC_ERROR }, 502)
    }

    const campaignRecord = dadosObj as Record<string, unknown>
    const campaignCta = String(campaignRecord.cta || campaignRecord.cta_text || '').trim()
    try {
      textos_gerados.google_ads = validateGoogleAdsDelivery(textos_gerados.google_ads, { expectedCta: campaignCta })
    } catch (error) {
      console.error(`[${reqId}] internal_code=CAMPAIGN_GOOGLE_ADS_INVALID_RESPONSE`, error instanceof Error ? error.message : String(error))
      return jsonResponse({ error: CAMPAIGN_PUBLIC_ERROR }, 502)
    }

    if (!Array.isArray(textos_gerados.hashtags)) {
      const postInstagram = String(textos_gerados.post_instagram || '')
      const extracted = postInstagram.match(/#[\p{L}\p{N}_]+/gu) || []
      textos_gerados.hashtags = extracted.slice(0, 20)
    }
    textos_gerados.hashtags = normalizeOfficialHashtags(
      normalizeHashtags(textos_gerados.hashtags, dadosObj, tipo, categoria),
      { purpose:dadosObj.finalidade ?? dadosObj.negocio, propertyType:tipo ?? dadosObj.tipo, propertyStage:dadosObj.situacao ?? dadosObj.disponibilidade, city:dadosObj.cidade, district:dadosObj.bairro, state:dadosObj.estado ?? dadosObj.uf, bedrooms:dadosObj.quartos ?? dadosObj.dormitorios, suites:dadosObj.suites, parkingSpaces:dadosObj.vagas, highlights:dadosObj.diferenciais, cta:textos_gerados.cta },
    )
    const whatsappText = String(textos_gerados.mensagem_whatsapp || '')
    if (/\b(estou|tenho)\s+(interessad[oa]|interesse)\b/i.test(whatsappText)) {
      textos_gerados.mensagem_whatsapp = buildWhatsappFallback(dadosObj, tipo)
    }
    validateGeneratedPurpose(textos_gerados, { ...dadosObj, tipo })
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
        error: CAMPAIGN_SAVE_WARNING,
        textos: textos_gerados,
      }, 500)
    }

    console.log(`[${reqId}] OK`)
    return jsonResponse({ success: true, campanha, textos: textos_gerados }, 200)

  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    return jsonResponse({ error: CAMPAIGN_PUBLIC_ERROR }, 500)
  }
})

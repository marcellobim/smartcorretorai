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

const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY') ?? ''

type TemplateMeta = {
  id: string
  nome: string
  categoria: 'banner' | 'story' | 'reels' | 'video' | 'carousel' | 'card' | 'social' | 'detailed'
  perfil: string[]
  formato: string
}

const TEMPLATES: TemplateMeta[] = [
  { id: '74097a36-5b5d-434a-8db7-4038e4c76f55', nome: 'SC_Banner_Luxo_01',         categoria: 'banner',   perfil: ['alto_padrao', 'lancamento'],                                  formato: 'banner-quadrado' },
  { id: 'a637acac-6a7b-42f8-b7d8-e25361eff207', nome: 'SC_Banner_Popular_01',      categoria: 'banner',   perfil: ['popular_mcmv', 'medio_padrao'],                               formato: 'banner-quadrado' },
  { id: 'd8310f54-5c9d-4606-ae6a-dacb8c4455ae', nome: 'SC_Reels_Moderno_01',       categoria: 'reels',    perfil: ['alto_padrao', 'medio_padrao', 'lancamento', 'em_construcao'], formato: 'vertical-9x16' },
  { id: '13008c2d-9e7e-4515-a2ac-649c9ea18409', nome: 'SC_Story_Premium_01',       categoria: 'story',    perfil: ['alto_padrao', 'lancamento'],                                  formato: 'vertical-9x16' },
  { id: '13696443-a295-4019-802b-d504e9d3c2ac', nome: 'SC_Video_Cinematic_01',     categoria: 'video',    perfil: ['alto_padrao', 'lancamento'],                                  formato: 'horizontal-16x9' },
  { id: '7ab695ae-e12b-4322-87dc-eb085760dd01', nome: 'Real Estate Banner',        categoria: 'banner',   perfil: ['todos'],                                                      formato: 'banner-quadrado' },
  { id: 'b0438295-5282-4a5e-b4eb-4fcd3d8d287b', nome: 'Real Estate Card',          categoria: 'card',     perfil: ['todos'],                                                      formato: 'card-quadrado' },
  { id: 'f6054e9d-0d28-40b2-81a9-21d291a9897b', nome: 'Real Estate Detailed',      categoria: 'detailed', perfil: ['todos'],                                                      formato: 'detalhado-quadrado' },
  { id: 'c5338ec4-1f93-476a-a81c-ff0e7f2e91cf', nome: 'Real Estate Video Montage', categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-horizontal' },
  { id: '96a25196-5a64-4f65-9b3e-c9c8b0d871f2', nome: 'Triple Slide Carousel',     categoria: 'carousel', perfil: ['todos'],                                                      formato: 'carrossel-quadrado' },
  { id: 'ad9f8382-ea38-4ef6-84cc-049f1b289345', nome: 'New Listing Story',         categoria: 'story',    perfil: ['lancamento', 'em_construcao'],                                formato: 'vertical-9x16' },
  { id: '7fc36174-64a6-4dbb-bb92-bb957471577e', nome: 'Photo Montage',             categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-quadrado' },
  { id: '3d72b111-76a7-4c7d-a594-1f75f70be2d2', nome: 'Polaroid Photos',           categoria: 'card',     perfil: ['todos'],                                                      formato: 'criativo-quadrado' },
  { id: '792ad84a-0ab8-4e6c-bda1-400fe9c040cc', nome: 'Animated Review',           categoria: 'social',   perfil: ['todos'],                                                      formato: 'vertical-9x16' },
  { id: 'a03e7b27-0747-497c-ae84-5b048fa31915', nome: 'Searchlight Reveal',        categoria: 'social',   perfil: ['todos'],                                                      formato: 'criativo-vertical' },
  { id: 'f4b5c0e9-80fe-408a-b139-f7db7dfbbc89', nome: 'Chat w/ Photos',            categoria: 'social',   perfil: ['todos'],                                                      formato: 'criativo-vertical' },
  { id: '57c55de1-e116-4cad-8470-54c68f023f6b', nome: 'Image Slideshow',           categoria: 'video',    perfil: ['todos'],                                                      formato: 'slideshow-horizontal' },
  { id: 'ba3afcf4-01cc-48e3-919a-8bc6d2dd4ca4', nome: 'Video Compilation',         categoria: 'video',    perfil: ['todos'],                                                      formato: 'video-horizontal' },
]

const PICK_SYSTEM_PROMPT = `Você é um diretor de arte de marketing imobiliário. Recebe o perfil de um imóvel e uma lista de templates Creatomate e seleciona entre 4 e 6 templates apropriados.

Responda APENAS com um objeto JSON válido (sem markdown), no formato:
{ "template_ids": ["uuid1", "uuid2", "uuid3", "uuid4"] }

REGRAS:
- Selecione APENAS template_ids que existem na lista fornecida.
- Para alto_padrao priorize: SC_Banner_Luxo_01, SC_Story_Premium_01, SC_Video_Cinematic_01, Real Estate Detailed.
- Para popular_mcmv ou medio_padrao priorize: SC_Banner_Popular_01, Real Estate Banner, Real Estate Card, Photo Montage.
- Para lancamento ou em_construcao inclua: New Listing Story, SC_Reels_Moderno_01, Triple Slide Carousel.
- Diversifique formatos: pelo menos 1 banner, 1 story/vertical, 1 vídeo e 1 carrossel quando possível.
- Não escolha mais que 6.`

const FILL_SYSTEM_PROMPT = `Você produz objetos "modifications" do Creatomate para uma lista de templates já selecionados. Para cada template, você recebe o NOME REAL de cada elemento modificável e seu TIPO (text, image, video, audio).

Responda APENAS com um objeto JSON válido (sem markdown), no formato:
{
  "selecoes": [
    {
      "template_id": "uuid",
      "modifications": {
        "<nome do elemento>.text": "texto",
        "<nome do elemento>.source": "https://url-da-imagem-ou-video"
      }
    }
  ]
}

REGRAS:
- Use SOMENTE chaves no formato "<nome>.text" (para elementos type=text) ou "<nome>.source" (para image/video/audio).
- O <nome> deve ser EXATAMENTE um dos nomes listados em "elementos reais". Não invente nomes.
- Se um nome aparece duas vezes, use ambos com valores diferentes.
- Distribua fotos_urls pelos elementos de imagem na ordem em que aparecem (primeira foto no primeiro elemento de imagem, etc.). Se faltarem fotos, repita a última disponível.
- Para elementos de vídeo: use uma foto como source se não houver vídeos; o Creatomate aceita imagens em slots de vídeo na maioria dos casos. Em último caso, omita.
- Para textos: combine título, preço, endereço, descrição curta, CTA, marca, nome do corretor conforme o significado parece adequado dado o nome e o valor padrão do elemento. Se o nome contém "price", "valor", coloque o preço. Se contém "address", "location", coloque o endereço. Se contém "title", "headline", "head", coloque o título. Se contém "cta", "button", coloque CTA. Se contém "agent", "broker", coloque o corretor. Se contém "brand", "company", "logo" (text), coloque a marca.
- Tom: alto_padrao = sofisticado e exclusivo; popular_mcmv/medio_padrao = acolhedor e acessível; lancamento = urgência e novidade; em_construcao = transparência e valorização.
- Não invente dados. Se uma informação não foi fornecida, omita a chave correspondente.
- Mantenha textos curtos para caber no template (Headline ≤ 40 chars, Subhead ≤ 60 chars, Description ≤ 120 chars, CTA ≤ 20 chars).`

type ElementInfo = { name: string; type: string; defaultValue?: string }

function extractElements(node: unknown, out: ElementInfo[] = []): ElementInfo[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) extractElements(item, out)
    return out
  }
  const n = node as Record<string, unknown>
  if (typeof n.name === 'string' && typeof n.type === 'string') {
    if (['text', 'image', 'video', 'audio'].includes(n.type)) {
      const defaultValue =
        typeof n.text === 'string' ? n.text :
        typeof n.source === 'string' ? n.source :
        undefined
      out.push({ name: n.name, type: n.type, defaultValue })
    }
  }
  if (Array.isArray(n.elements)) extractElements(n.elements, out)
  return out
}

async function fetchTemplateElements(reqId: string, templateId: string): Promise<{ id: string; name: string; elements: ElementInfo[]; erro?: string }> {
  try {
    const res = await fetch(`https://api.creatomate.com/v1/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[${reqId}] GET template ${templateId} ${res.status}:`, body.slice(0, 200))
      return { id: templateId, name: '', elements: [], erro: `GET ${res.status}` }
    }
    const body = await res.json()
    const elements = extractElements(body?.source)
    // Dedup by name+type while preserving order (some templates repeat element names)
    const seen = new Set<string>()
    const uniq: ElementInfo[] = []
    for (const e of elements) {
      const key = `${e.name}|${e.type}`
      if (seen.has(key)) continue
      seen.add(key)
      uniq.push(e)
    }
    return { id: templateId, name: String(body?.name || ''), elements: uniq }
  } catch (err) {
    console.error(`[${reqId}] GET template ${templateId} erro:`, err)
    return { id: templateId, name: '', elements: [], erro: err instanceof Error ? err.message : String(err) }
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

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' }, 500)
    }
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: 'OPENAI_API_KEY não configurada' }, 500)
    }
    if (!CREATOMATE_API_KEY) {
      return jsonResponse({ error: 'CREATOMATE_API_KEY não configurada' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const payload = await req.json().catch(() => ({}))
    const {
      campaign_id,
      fotos_urls = [],
      titulo,
      descricao,
      preco,
      endereco,
      tipo_imovel,
      corretor_nome,
      marca_imovel,
    } = payload as Record<string, unknown>

    const fotosArr = Array.isArray(fotos_urls) ? (fotos_urls as string[]).filter(Boolean) : []
    const hasCampaignId = typeof campaign_id === 'string' && campaign_id.length > 0

    console.log(`[${reqId}] gerar-banners | campaign=${hasCampaignId ? campaign_id : '(sem id)'} | fotos=${fotosArr.length}`)

    // Buscar dados da campanha (opcional — se foi passado um campaign_id, enriquecemos)
    let campaignRow: { titulo?: string; dados_imovel?: Record<string, unknown>; textos_gerados?: Record<string, unknown> } | null = null
    if (hasCampaignId) {
      const { data } = await supabase
        .from('campaigns')
        .select('id, titulo, dados_imovel, textos_gerados')
        .eq('id', campaign_id)
        .maybeSingle()
      campaignRow = data as typeof campaignRow
    }

    const dadosImovel = (campaignRow?.dados_imovel as Record<string, unknown>) || {}
    const categoria = String(dadosImovel.categoria || tipo_imovel || 'medio_padrao')

    // Bloco compartilhado com os dois prompts
    const dadosImovelBloco = `DADOS DO IMÓVEL:
- Título: ${titulo || campaignRow?.titulo || 'Imóvel'}
- Categoria/Perfil: ${categoria}
- Tipo de imóvel: ${tipo_imovel || dadosImovel.tipo || 'não informado'}
- Descrição: ${descricao || ''}
- Preço: ${preco || dadosImovel.preco || ''}
- Endereço: ${endereco || `${dadosImovel.bairro || ''}${dadosImovel.cidade ? ', ' + dadosImovel.cidade : ''}${dadosImovel.estado ? ' - ' + dadosImovel.estado : ''}`}
- Marca/Imobiliária: ${marca_imovel || ''}
- Corretor: ${corretor_nome || ''}
- Fotos disponíveis (${fotosArr.length}): ${JSON.stringify(fotosArr)}`

    // === ESTÁGIO 1: IA seleciona os template_ids ==========================
    const pickUserPrompt = `${dadosImovelBloco}

TEMPLATES DISPONÍVEIS:
${TEMPLATES.map((t) => `- ${t.nome} (id: ${t.id}) [perfil: ${t.perfil.join(', ')}] [formato: ${t.formato}]`).join('\n')}

Selecione entre 4 e 6 templates apropriados e retorne só os IDs no JSON.`

    const pickRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PICK_SYSTEM_PROMPT },
          { role: 'user', content: pickUserPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!pickRes.ok) {
      const errBody = await pickRes.text()
      console.error(`[${reqId}] pick OpenAI ${pickRes.status}:`, errBody.slice(0, 300))
      return jsonResponse({ error: `OpenAI (pick) ${pickRes.status}: ${errBody.slice(0, 300)}` }, 502)
    }

    let pickedIds: string[] = []
    try {
      const pickData = await pickRes.json()
      const raw = pickData?.choices?.[0]?.message?.content
      const parsed = JSON.parse(raw)
      pickedIds = Array.isArray(parsed.template_ids) ? parsed.template_ids.filter((x: unknown) => typeof x === 'string') : []
    } catch (e) {
      console.error(`[${reqId}] pick parse:`, e)
      return jsonResponse({ error: 'OpenAI (pick) retornou JSON inválido' }, 502)
    }

    const validIds = new Map(TEMPLATES.map((t) => [t.id, t]))
    pickedIds = pickedIds.filter((id) => validIds.has(id)).slice(0, 6)

    if (pickedIds.length === 0) {
      return jsonResponse({ error: 'IA não selecionou nenhum template válido' }, 502)
    }

    console.log(`[${reqId}] estágio 1: ${pickedIds.length} templates selecionados`)

    // === ESTÁGIO 2: GET de cada template para descobrir elementos reais ===
    const schemas = await Promise.all(pickedIds.map((id) => fetchTemplateElements(reqId, id)))
    const schemasComElementos = schemas.filter((s) => s.elements.length > 0)

    if (schemasComElementos.length === 0) {
      return jsonResponse({ error: 'Não foi possível obter elementos de nenhum template' }, 502)
    }

    console.log(`[${reqId}] estágio 2: ${schemasComElementos.length} templates com elementos reais`)

    // === ESTÁGIO 3: IA produz modifications usando elementos REAIS ========
    const elementosBloco = schemasComElementos.map((s) => {
      const meta = validIds.get(s.id)
      const lista = s.elements
        .map((e) => `  - "${e.name}" (${e.type})${e.defaultValue ? ` [default: ${JSON.stringify(e.defaultValue.slice(0, 80))}]` : ''}`)
        .join('\n')
      return `TEMPLATE id="${s.id}" nome="${s.name || meta?.nome || ''}" formato="${meta?.formato || ''}"
Elementos reais:
${lista}`
    }).join('\n\n')

    const fillUserPrompt = `${dadosImovelBloco}

TEMPLATES SELECIONADOS COM ELEMENTOS REAIS:
${elementosBloco}

Para cada template, gere um objeto "modifications" usando APENAS os nomes de elementos listados acima.`

    const fillRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: FILL_SYSTEM_PROMPT },
          { role: 'user', content: fillUserPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3500,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!fillRes.ok) {
      const errBody = await fillRes.text()
      console.error(`[${reqId}] fill OpenAI ${fillRes.status}:`, errBody.slice(0, 300))
      return jsonResponse({ error: `OpenAI (fill) ${fillRes.status}: ${errBody.slice(0, 300)}` }, 502)
    }

    let plano: { selecoes?: Array<{ template_id: string; modifications?: Record<string, unknown> }> }
    try {
      const fillData = await fillRes.json()
      const raw = fillData?.choices?.[0]?.message?.content
      plano = JSON.parse(raw)
    } catch (e) {
      console.error(`[${reqId}] fill parse:`, e)
      return jsonResponse({ error: 'OpenAI (fill) retornou JSON inválido' }, 502)
    }

    const aprovadas = (Array.isArray(plano.selecoes) ? plano.selecoes : [])
      .filter((s) => s.template_id && validIds.has(s.template_id))

    if (aprovadas.length === 0) {
      return jsonResponse({ error: 'IA (fill) não produziu modifications para nenhum template' }, 502)
    }

    // Validar/filtrar as modifications para conter SOMENTE chaves de elementos reais
    const elementosPorTemplate = new Map<string, Map<string, ElementInfo>>()
    for (const s of schemasComElementos) {
      const m = new Map<string, ElementInfo>()
      for (const e of s.elements) m.set(e.name, e)
      elementosPorTemplate.set(s.id, m)
    }

    const aprovadasLimpas = aprovadas.map((sel) => {
      const elementos = elementosPorTemplate.get(sel.template_id)
      const mods: Record<string, unknown> = {}
      if (elementos && sel.modifications && typeof sel.modifications === 'object') {
        for (const [k, v] of Object.entries(sel.modifications)) {
          // Espera chave no formato "<name>.text" ou "<name>.source"
          const dot = k.lastIndexOf('.')
          if (dot < 0) continue
          const name = k.slice(0, dot)
          const prop = k.slice(dot + 1)
          const elem = elementos.get(name)
          if (!elem) continue
          const expectedProp = elem.type === 'text' ? 'text' : 'source'
          if (prop !== expectedProp) continue
          if (typeof v !== 'string' || !v.trim()) continue
          mods[k] = v
        }
      }
      return { template_id: sel.template_id, modifications: mods }
    }).filter((s) => Object.keys(s.modifications).length > 0)

    if (aprovadasLimpas.length === 0) {
      return jsonResponse({
        error: 'Nenhuma modification válida sobrou após validação contra elementos reais',
      }, 502)
    }

    console.log(`[${reqId}] estágio 3: ${aprovadasLimpas.length} templates prontos para render`)

    // === Disparar renders no Creatomate (paralelo) ========================
    const renders: Array<Record<string, unknown>> = []

    await Promise.all(aprovadasLimpas.map(async (sel) => {
      const meta = validIds.get(sel.template_id)!
      try {
        const createRes = await fetch('https://api.creatomate.com/v1/renders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CREATOMATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: sel.template_id,
            modifications: sel.modifications,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (!createRes.ok) {
          const errBody = await createRes.text()
          console.error(`[${reqId}] Creatomate render ${createRes.status} em ${meta.nome}:`, errBody.slice(0, 200))
          renders.push({
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            erro: `Creatomate ${createRes.status}: ${errBody.slice(0, 200)}`,
          })
          return
        }

        const body = await createRes.json()
        const items = Array.isArray(body) ? body : [body]
        for (const item of items) {
          renders.push({
            render_id: item.id,
            template_id: sel.template_id,
            template_nome: meta.nome,
            categoria: meta.categoria,
            formato: meta.formato,
            status: item.status || 'planned',
            url: item.url || null,
            snapshot_url: item.snapshot_url || null,
          })
        }
      } catch (err) {
        console.error(`[${reqId}] erro ao chamar Creatomate para ${meta.nome}:`, err)
        renders.push({
          template_id: sel.template_id,
          template_nome: meta.nome,
          categoria: meta.categoria,
          erro: err instanceof Error ? err.message : String(err),
        })
      }
    }))

    // === Persistir em campaigns.banners (jsonb) — somente se campaign_id ==
    if (hasCampaignId) {
      const { error: updErr } = await supabase
        .from('campaigns')
        .update({ banners: renders })
        .eq('id', campaign_id)

      if (updErr) {
        console.error(`[${reqId}] falha ao salvar banners:`, updErr)
        return jsonResponse({
          warning: `Renders disparados, mas não foi possível salvar em campaigns.banners: ${updErr.message}`,
          renders,
        }, 200)
      }
    }

    console.log(`[${reqId}] OK | ${renders.length} renders disparados`)
    return jsonResponse({ success: true, renders }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

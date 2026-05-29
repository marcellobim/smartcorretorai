import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const EdgeRuntime: {
  waitUntil?: (promise: Promise<unknown>) => void
}

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

const BATCH_SIZE = 8
const CREATOMATE_API_KEY = Deno.env.get('CREATOMATE_API_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''

type TemplateMeta = {
  id: string
  nome?: string
  categoria?: string
  formato?: string
  family?: string
}

type ElementInfo = {
  name: string
  type: string
  id?: string
  virtualLabel?: string
  defaultValue?: string
}

type FailedTemplate = {
  template_id: string
  template_nome?: string
  reason: string
}

type RenderRecord = Record<string, unknown>

type SanitizeContext = {
  preco?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  corretor_nome?: string
  corretor_email?: string
  corretor_creci?: string
  marca_imovel?: string
  telefone_contato?: string
  whatsapp?: string
  site?: string
  instagram?: string
  titulo?: string
}

const FILL_SYSTEM_PROMPT = `Voce produz objetos "modifications" do Creatomate para uma lista de templates ja selecionados.
Responda APENAS com JSON valido no formato:
{
  "selecoes": [
    { "template_id": "uuid", "modifications": { "Element.text": "texto", "Photo.source": "https://..." } }
  ]
}

REGRAS:
- Use apenas os nomes de elementos recebidos.
- Para texto, escreva em portugues brasileiro.
- Nao invente nomes, telefones, emails, CRECI, enderecos ou dados de corretor.
- Se faltar dado real, omita o elemento ou use string vazia.
- Para elementos de imagem/video de pessoas, nao use fotos falsas.
- CTAs permitidos: "Saiba Mais", "Me Ligue", "Descricao abaixo".
- Textos devem ser curtos para caber no template.`

function templateIdFromEntry(entry: unknown): string {
  if (typeof entry === 'string') return entry
  if (!entry || typeof entry !== 'object') return ''
  const obj = entry as Record<string, unknown>
  const id = obj.id || obj.template_id || obj.templateId
  return typeof id === 'string' ? id : ''
}

function templateMetaFromEntry(entry: unknown): TemplateMeta | null {
  const id = templateIdFromEntry(entry)
  if (!id) return null
  if (!entry || typeof entry !== 'object') return { id }
  const obj = entry as Record<string, unknown>
  return {
    id,
    nome: typeof obj.nome === 'string' ? obj.nome : typeof obj.name === 'string' ? obj.name : undefined,
    categoria: typeof obj.categoria === 'string' ? obj.categoria : undefined,
    formato: typeof obj.formato === 'string' ? obj.formato : undefined,
    family: typeof obj.family === 'string' ? obj.family : undefined,
  }
}

function normalizeSelectedTemplates(input: unknown): { ids: string[]; metaById: Map<string, TemplateMeta> } {
  const raw = Array.isArray(input) ? input : []
  const metaById = new Map<string, TemplateMeta>()
  const ids: string[] = []
  for (const item of raw) {
    const meta = templateMetaFromEntry(item)
    if (!meta || !meta.id) continue
    if (!metaById.has(meta.id)) ids.push(meta.id)
    metaById.set(meta.id, { ...metaById.get(meta.id), ...meta })
  }
  return { ids, metaById }
}

function isCtaElement(elementName: string): boolean {
  return /cta|button|action/i.test(elementName)
}

function ctaForTemplate(meta?: TemplateMeta): string {
  const family = `${meta?.family || ''} ${meta?.nome || ''}`.toLowerCase()
  const categoria = (meta?.categoria || '').toLowerCase()
  if (/chat|contact|phone|whatsapp/.test(family)) return 'Me Ligue'
  if (/story|reels|social|frase|avaliacao|momentos/.test(family) || /story|reels|social/.test(categoria)) {
    return 'Descricao abaixo'
  }
  return 'Saiba Mais'
}

function isPhoneTextElement(name: string): boolean {
  return /^(agent_phone|broker_phone|phone|telefone|whatsapp|broker_whatsapp)$/i.test(name)
    || /\b(agent|broker|corretor)?[_ -]?(phone|telefone|tel|whatsapp)\b/i.test(name)
}

function isPersonMediaSlot(name: string): boolean {
  return /avatar|agent|broker|realtor|person|headshot|profile|client[_ -]?photo|customer[_ -]?photo/i.test(name)
}

function isReviewTextElement(name: string): boolean {
  return /review|testimonial|depoimento|avaliacao|quote/i.test(name)
}

function capText(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  const sliced = compact.slice(0, max + 1)
  const lastSpace = sliced.lastIndexOf(' ')
  const base = (lastSpace > 40 ? sliced.slice(0, lastSpace) : compact.slice(0, max)).trim()
  return `${base.replace(/[.,;:!?]+$/, '')}...`
}

function isPropertyPhotoSlot(name: string): boolean {
  const lower = name.toLowerCase()
  if (/logo|brand/.test(lower)) return false
  if (/avatar|agent|broker|realtor|person|headshot|profile/.test(lower)) return false
  return true
}

function sanitizeTemplateText(input: unknown, ctx: SanitizeContext): string {
  if (typeof input !== 'string') return ''
  let s = input.replace(/\s+/g, ' ').trim()
  if (!s) return ''

  const enderecoFinal = (ctx.endereco || [ctx.bairro, ctx.cidade, ctx.estado].filter(Boolean).join(', ')).trim()
  const phoneReal = ctx.whatsapp || ctx.telefone_contato || ''

  s = s
    .replace(/\bNEW\s+YORK\s*,\s*NY\b/gi, enderecoFinal)
    .replace(/\bNEW\s+YORK\b/gi, ctx.cidade || '')
    .replace(/\bNEW\s+ON\s+SALE\b/gi, 'Novo a Venda')
    .replace(/\bJUST\s+LISTED\b/gi, 'Recem-Anunciado')
    .replace(/\bFOR\s+SALE\b/gi, 'A Venda')
    .replace(/\bFOR\s+RENT\b/gi, 'Para Alugar')
    .replace(/\bOpen\s+House\b/gi, 'Visitacao')
    .replace(/\bplease\s+join\s+us\s+for\s+(?:an?\s+)?open\s+house\b/gi, 'Agende sua visita')
    .replace(/[A-Za-z0-9._%+-]+@(example|mybrand|yourbrand|brand|company|realestate|realtors|realty|website|sample|test|placeholder)\.[A-Za-z]{2,}/gi, ctx.corretor_email || '')
    .replace(/(?:https?:\/\/)?(?:www\.)?(example|mybrand|yourbrand|brand|company|realestate|realtors|realty|website|sample|test|placeholder)\.[A-Za-z]{2,}(?:\/\S*)?/gi, ctx.site || ctx.marca_imovel || '')
    .replace(/\+?1?[\s.()-]*\d{3}[\s.()-]*555[\s.()-]*\d{4}/g, phoneReal)
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,;:\-|]+|[\s,;:\-|]+$/g, '')
    .trim()

  return s
}

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
      const id = typeof n.id === 'string' ? n.id : undefined
      out.push({ name: n.name, type: n.type, id, defaultValue })
    }
  }
  if (Array.isArray(n.elements)) extractElements(n.elements, out)
  return out
}

async function fetchTemplateElements(reqId: string, templateId: string): Promise<{ id: string; name: string; elements: ElementInfo[] }> {
  try {
    const res = await fetch(`https://api.creatomate.com/v1/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${CREATOMATE_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[${reqId}] GET template ${templateId} ${res.status}:`, body.slice(0, 200))
      return { id: templateId, name: '', elements: [] }
    }
    const body = await res.json()
    const elements = extractElements(body?.source)
    const counts = new Map<string, number>()
    for (const e of elements) {
      const key = `${e.name}|${e.type}`
      const idx = (counts.get(key) || 0) + 1
      counts.set(key, idx)
      e.virtualLabel = idx === 1 ? e.name : `${e.name}-${idx}`
    }
    return { id: templateId, name: String(body?.name || ''), elements }
  } catch (err) {
    console.error(`[${reqId}] GET template ${templateId} erro:`, err)
    return { id: templateId, name: '', elements: [] }
  }
}

function uniqueFailed(failedTemplates: FailedTemplate[], renders: RenderRecord[]): FailedTemplate[] {
  const succeededIds = new Set(
    renders
      .filter((r) => r.render_id && !r.erro)
      .map((r) => String(r.template_id || ''))
      .filter(Boolean)
  )
  const byId = new Map<string, FailedTemplate>()
  for (const f of failedTemplates) byId.set(f.template_id, f)
  return Array.from(byId.values()).filter((f) => !succeededIds.has(f.template_id))
}

function succeededCount(renders: RenderRecord[]): number {
  return new Set(
    renders
      .filter((r) => r.render_id && !r.erro)
      .map((r) => String(r.template_id || ''))
      .filter(Boolean)
  ).size
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
    if (!OPENAI_API_KEY) {
      return jsonResponse({ error: 'OPENAI_API_KEY nao configurada' }, 500)
    }
    if (!CREATOMATE_API_KEY) {
      return jsonResponse({ error: 'CREATOMATE_API_KEY nao configurada' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return jsonResponse({ error: 'Authorization header ausente ou invalido' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authUser) {
      console.warn(`[${reqId}] JWT invalido:`, authErr?.message)
      return jsonResponse({ error: 'Token invalido ou expirado' }, 401)
    }

    const requestPayload = await req.json().catch(() => ({}))
    const jobId = (requestPayload as Record<string, unknown>).jobId || (requestPayload as Record<string, unknown>).job_id
    if (typeof jobId !== 'string' || !jobId) {
      return jsonResponse({ error: 'jobId e obrigatorio' }, 400)
    }

    const { data: job, error: jobError } = await supabase
      .from('render_jobs')
      .select('id, user_id, status, total, completed, failed, selected_templates, failed_templates, renders, payload, error, started_at')
      .eq('id', jobId)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (jobError) {
      console.error(`[${reqId}] render_jobs select error:`, jobError)
      return jsonResponse({ error: jobError.message }, 500)
    }
    if (!job) {
      return jsonResponse({ error: 'Job nao encontrado' }, 404)
    }

    if (['completed', 'partial_success', 'failed'].includes(String(job.status))) {
      return jsonResponse({
        jobId: job.id,
        status: job.status,
        total: job.total,
        completed: job.completed,
        failed: job.failed,
        failedTemplates: job.failed_templates || [],
        renders: job.renders || [],
        error: job.error || null,
      }, 200)
    }

    const now = new Date().toISOString()
    const { error: startError } = await supabase
      .from('render_jobs')
      .update({
        status: 'processing',
        started_at: job.started_at || now,
        updated_at: now,
      })
      .eq('id', job.id)
      .eq('user_id', authUser.id)

    if (startError) {
      console.error(`[${reqId}] render_jobs start update error:`, startError)
      return jsonResponse({ error: startError.message }, 500)
    }

    const jobPayload = (job.payload && typeof job.payload === 'object' ? job.payload : {}) as Record<string, unknown>
    const { ids: pickedIds, metaById } = normalizeSelectedTemplates(job.selected_templates)

    if (pickedIds.length === 0) {
      const finishedAt = new Date().toISOString()
      await supabase
        .from('render_jobs')
        .update({
          status: 'failed',
          total: 0,
          completed: 0,
          failed: 0,
          error: 'Nenhum template selecionado no job',
          finished_at: finishedAt,
          updated_at: finishedAt,
        })
        .eq('id', job.id)
        .eq('user_id', authUser.id)
      return jsonResponse({ jobId: job.id, status: 'failed', error: 'Nenhum template selecionado no job' }, 200)
    }

    const {
      campaign_id,
      fotos_urls = [],
      foto_principal,
      titulo,
      descricao,
      preco,
      endereco,
      tipo_imovel,
      corretor_nome,
      corretor_avatar_url,
      telefone_contato,
      whatsapp,
      marca_imovel,
    } = jobPayload

    const fotosRaw = Array.isArray(fotos_urls) ? (fotos_urls as string[]).filter(Boolean) : []
    const fotosArr = (() => {
      const principal = typeof foto_principal === 'string' && foto_principal.length > 0 ? foto_principal : ''
      if (!principal) return fotosRaw
      if (fotosRaw[0] === principal) return fotosRaw
      return [principal, ...fotosRaw.filter((u) => u !== principal)]
    })()

    const hasCampaignId = typeof campaign_id === 'string' && campaign_id.length > 0
    let campaignRow: { titulo?: string; dados_imovel?: Record<string, unknown>; user_id?: string } | null = null
    if (hasCampaignId) {
      const { data } = await supabase
        .from('campaigns')
        .select('id, titulo, dados_imovel, user_id')
        .eq('id', campaign_id)
        .eq('user_id', authUser.id)
        .maybeSingle()
      campaignRow = data as typeof campaignRow
    }

    type ProfileRow = {
      nome?: string
      email?: string
      creci?: string
      telefone?: string
      whatsapp?: string
      imobiliaria?: string
      site?: string
      instagram?: string
      avatar_url?: string
      logo_url?: string
    }
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('nome, email, creci, telefone, whatsapp, imobiliaria, site, instagram, avatar_url, logo_url')
      .eq('id', authUser.id)
      .maybeSingle()
    if (profileErr) console.warn(`[${reqId}] profile fetch erro:`, profileErr.message)
    const profileRow = (profileData as ProfileRow) || null

    const dadosImovel = (campaignRow?.dados_imovel as Record<string, unknown>) || {}
    const categoria = String(dadosImovel.categoria || tipo_imovel || 'medio_padrao')
    const corretorNomeFinal = profileRow?.nome || (typeof corretor_nome === 'string' ? corretor_nome : '') || ''
    const corretorEmail = profileRow?.email || ''
    const corretorCRECI = profileRow?.creci || ''
    const telefonePayload = typeof telefone_contato === 'string' ? telefone_contato : ''
    const whatsappPayload = typeof whatsapp === 'string' ? whatsapp : ''
    const corretorTelefone = profileRow?.telefone || telefonePayload || String(dadosImovel.telefone_contato || '')
    const corretorWhatsApp = profileRow?.whatsapp || whatsappPayload || corretorTelefone
    const marcaFinal = profileRow?.imobiliaria || (typeof marca_imovel === 'string' ? marca_imovel : '') || ''
    const siteFinal = profileRow?.site || ''
    const instagramFinal = profileRow?.instagram || ''
    const avatarFromPayload = typeof corretor_avatar_url === 'string' ? corretor_avatar_url : ''
    const avatarUrl = profileRow?.avatar_url
      ? profileRow.avatar_url
      : (avatarFromPayload && avatarFromPayload !== 'REMOVER_ELEMENTO' ? avatarFromPayload : '')

    const dadosImovelBloco = `DADOS DO IMOVEL:
- Titulo: ${titulo || campaignRow?.titulo || 'Imovel'}
- Categoria/Perfil: ${categoria}
- Tipo de imovel: ${tipo_imovel || dadosImovel.tipo || 'nao informado'}
- Descricao: ${descricao || ''}
- Preco: ${preco || dadosImovel.preco || ''}
- Endereco: ${endereco || `${dadosImovel.bairro || ''}${dadosImovel.cidade ? ', ' + dadosImovel.cidade : ''}${dadosImovel.estado ? ' - ' + dadosImovel.estado : ''}`}
- Fotos do imovel (${fotosArr.length}): ${JSON.stringify(fotosArr)}

DADOS DO CORRETOR:
- Nome: ${corretorNomeFinal || '(nao informado)'}
- CRECI: ${corretorCRECI || 'REMOVER_ELEMENTO'}
- Telefone: ${corretorTelefone || '(nao informado)'}
- WhatsApp: ${corretorWhatsApp || 'REMOVER_ELEMENTO'}
- Email: ${corretorEmail || 'REMOVER_ELEMENTO'}
- Imobiliaria/Marca: ${marcaFinal || 'REMOVER_ELEMENTO'}
- Site: ${siteFinal || 'REMOVER_ELEMENTO'}
- Instagram: ${instagramFinal || 'REMOVER_ELEMENTO'}
- Foto do corretor: ${avatarUrl || 'REMOVER_ELEMENTO'}`

    const sanitizeCtx: SanitizeContext = {
      preco: preco != null ? String(preco) : (dadosImovel.preco != null ? String(dadosImovel.preco) : ''),
      endereco: typeof endereco === 'string' && endereco.trim()
        ? endereco
        : [dadosImovel.bairro, dadosImovel.cidade, dadosImovel.estado].filter(Boolean).join(', '),
      bairro: String(dadosImovel.bairro || ''),
      cidade: String(dadosImovel.cidade || ''),
      estado: String(dadosImovel.estado || ''),
      corretor_nome: corretorNomeFinal,
      corretor_email: corretorEmail,
      corretor_creci: corretorCRECI,
      marca_imovel: marcaFinal,
      telefone_contato: corretorTelefone,
      whatsapp: corretorWhatsApp,
      site: siteFinal,
      instagram: instagramFinal,
      titulo: typeof titulo === 'string' && titulo ? titulo : (campaignRow?.titulo || ''),
    }

    const renders: RenderRecord[] = Array.isArray(job.renders) ? [...job.renders] : []
    const failedTemplates: FailedTemplate[] = Array.isArray(job.failed_templates) ? [...job.failed_templates] : []
    const alreadyProcessed = Math.min(
      pickedIds.length,
      Math.max(0, Number(job.completed || 0) + Number(job.failed || 0)),
    )
    const batchIds = pickedIds.slice(alreadyProcessed, alreadyProcessed + BATCH_SIZE)
    const chunkIndex = Math.floor(alreadyProcessed / BATCH_SIZE)
    const totalChunks = Math.ceil(pickedIds.length / BATCH_SIZE)

    if (batchIds.length > 0) {
      console.log(`[${reqId}] process-render-job ${job.id} lote ${chunkIndex + 1}/${totalChunks}: ${batchIds.length}`)

      try {
        const schemas = await Promise.all(batchIds.map((id) => fetchTemplateElements(reqId, id)))
        for (const schema of schemas) {
          const current = metaById.get(schema.id) || { id: schema.id }
          if (schema.name && !current.nome) metaById.set(schema.id, { ...current, nome: schema.name })
        }

        const schemasComElementos = schemas.filter((s) => s.elements.length > 0)
        const schemasIds = new Set(schemasComElementos.map((s) => s.id))
        for (const id of batchIds.filter((id) => !schemasIds.has(id))) {
          failedTemplates.push({
            template_id: id,
            template_nome: metaById.get(id)?.nome,
            reason: 'Nao foi possivel obter elementos do template',
          })
        }
        if (schemasComElementos.length > 0) {
          const elementosBloco = schemasComElementos.map((s) => {
            const meta = metaById.get(s.id)
            const lista = s.elements
              .map((e) => `  - "${e.virtualLabel || e.name}" (${e.type})${e.defaultValue ? ` [default: ${JSON.stringify(e.defaultValue.slice(0, 80))}]` : ''}`)
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
            const reason = `OpenAI (fill) ${fillRes.status}: ${errBody.slice(0, 200)}`
            for (const id of schemasComElementos.map((s) => s.id)) {
              failedTemplates.push({ template_id: id, template_nome: metaById.get(id)?.nome, reason })
            }
          } else {
            let plano: { selecoes?: Array<{ template_id: string; modifications?: Record<string, unknown> }> }
            try {
              const fillData = await fillRes.json()
              const raw = fillData?.choices?.[0]?.message?.content
              plano = JSON.parse(raw)
            } catch (e) {
              const reason = 'OpenAI (fill) retornou JSON invalido'
              console.error(`[${reqId}] lote ${chunkIndex + 1} fill parse:`, e)
              for (const id of schemasComElementos.map((s) => s.id)) {
                failedTemplates.push({ template_id: id, template_nome: metaById.get(id)?.nome, reason })
              }
              plano = { selecoes: [] }
            }

            const batchValidIds = new Set(schemasComElementos.map((s) => s.id))
            const aprovadas = (Array.isArray(plano.selecoes) ? plano.selecoes : [])
              .filter((s) => s.template_id && batchValidIds.has(s.template_id))
            const aprovadasIds = new Set(aprovadas.map((s) => s.template_id))
            for (const id of [...batchValidIds].filter((id) => !aprovadasIds.has(id))) {
              failedTemplates.push({
                template_id: id,
                template_nome: metaById.get(id)?.nome,
                reason: 'IA (fill) nao produziu modifications para este template',
              })
            }

            const elementosPorTemplate = new Map<string, Map<string, ElementInfo>>()
            for (const s of schemasComElementos) {
              const m = new Map<string, ElementInfo>()
              for (const e of s.elements) m.set(e.virtualLabel || e.name, e)
              elementosPorTemplate.set(s.id, m)
            }

            const aprovadasLimpas = aprovadas.map((sel) => {
              const meta = metaById.get(sel.template_id)
              const elementos = elementosPorTemplate.get(sel.template_id)
              const mods: Record<string, unknown> = {}
              if (elementos && sel.modifications && typeof sel.modifications === 'object') {
                for (const [k, v] of Object.entries(sel.modifications)) {
                  const dot = k.lastIndexOf('.')
                  if (dot < 0) continue
                  const label = k.slice(0, dot)
                  const prop = k.slice(dot + 1)
                  const elem = elementos.get(label)
                  if (!elem) continue
                  const keyBase = elem.id || elem.name
                  const finalKey = `${keyBase}.${prop}`

                  if (prop === 'track') {
                    if (typeof v === 'boolean') mods[finalKey] = v
                    continue
                  }

                  const expectedProp = elem.type === 'text' ? 'text' : 'source'
                  if (prop !== expectedProp || typeof v !== 'string') continue
                  if (v === '') {
                    mods[finalKey] = ''
                    continue
                  }
                  if (!v.trim()) continue

                  if (prop === 'text') {
                    const limpo = sanitizeTemplateText(v, sanitizeCtx)
                    if (!limpo) continue
                    if (isCtaElement(elem.name)) mods[finalKey] = ctaForTemplate(meta)
                    else if (isReviewTextElement(elem.name)) mods[finalKey] = capText(limpo, 86)
                    else mods[finalKey] = limpo
                  } else {
                    mods[finalKey] = v
                  }
                }
              }

              if (elementos) {
                for (const elem of elementos.values()) {
                  const keyBase = elem.id || elem.name
                  if (elem.type === 'text' && isPhoneTextElement(elem.name)) {
                    const phoneValue = corretorWhatsApp || corretorTelefone
                    mods[`${keyBase}.text`] = phoneValue || ''
                    if (!phoneValue) mods[`${keyBase}.track`] = false
                  }
                  if (elem.type === 'text' && isCtaElement(elem.name)) {
                    mods[`${keyBase}.text`] = ctaForTemplate(meta)
                  }
                  if (elem.type === 'text' && isReviewTextElement(elem.name)) {
                    const textKey = `${keyBase}.text`
                    if (typeof mods[textKey] === 'string') mods[textKey] = capText(mods[textKey], 86)
                  }
                  if ((elem.type === 'image' || elem.type === 'video') && isPersonMediaSlot(elem.name)) {
                    const sourceKey = `${keyBase}.source`
                    const trackKey = `${keyBase}.track`
                    if (avatarUrl && !/client|customer|review|testimonial/i.test(elem.name)) {
                      mods[sourceKey] = avatarUrl
                    } else {
                      mods[sourceKey] = ''
                      mods[trackKey] = false
                    }
                  }
                }
              }

              return { template_id: sel.template_id, modifications: mods }
            }).filter((s) => Object.keys(s.modifications).length > 0)

            const limpasIds = new Set(aprovadasLimpas.map((s) => s.template_id))
            for (const id of aprovadas.map((s) => s.template_id).filter((id) => !limpasIds.has(id))) {
              failedTemplates.push({
                template_id: id,
                template_nome: metaById.get(id)?.nome,
                reason: 'Nenhuma modification valida sobrou apos validacao contra elementos reais',
              })
            }

            if (fotosArr.length > 0) {
              const elementosArrPorTemplate = new Map<string, ElementInfo[]>()
              for (const s of schemasComElementos) elementosArrPorTemplate.set(s.id, s.elements)
              for (const sel of aprovadasLimpas) {
                const els = elementosArrPorTemplate.get(sel.template_id) || []
                const propertySlots = els.filter(
                  (e) => (e.type === 'image' || e.type === 'video') && isPropertyPhotoSlot(e.name)
                )
                let fotoIdx = 0
                for (const slot of propertySlots) {
                  const keyBase = slot.id || slot.name
                  const sourceKey = `${keyBase}.source`
                  const trackKey = `${keyBase}.track`
                  if (sel.modifications[trackKey] === false) continue
                  const existing = sel.modifications[sourceKey]
                  if (typeof existing === 'string' && /^https?:\/\//i.test(existing.trim())) {
                    fotoIdx++
                    continue
                  }
                  sel.modifications[sourceKey] = fotosArr[Math.min(fotoIdx, fotosArr.length - 1)]
                  fotoIdx++
                }
              }
            }

            await Promise.all(aprovadasLimpas.map(async (sel) => {
              const meta = metaById.get(sel.template_id) || { id: sel.template_id }
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
                  const reason = `Creatomate ${createRes.status}: ${errBody.slice(0, 200)}`
                  failedTemplates.push({ template_id: sel.template_id, template_nome: meta.nome, reason })
                  renders.push({
                    template_id: sel.template_id,
                    template_nome: meta.nome,
                    categoria: meta.categoria,
                    erro: reason,
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
                const reason = err instanceof Error ? err.message : String(err)
                failedTemplates.push({ template_id: sel.template_id, template_nome: meta.nome, reason })
                renders.push({
                  template_id: sel.template_id,
                  template_nome: meta.nome,
                  categoria: meta.categoria,
                  erro: reason,
                })
              }
            }))
          }
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.error(`[${reqId}] lote ${chunkIndex + 1} falhou:`, err)
        for (const id of batchIds) {
          failedTemplates.push({ template_id: id, template_nome: metaById.get(id)?.nome, reason })
        }
      }

      const failedTemplatesUnique = uniqueFailed(failedTemplates, renders)
      const progressAt = new Date().toISOString()
      const { error: progressError } = await supabase
        .from('render_jobs')
        .update({
          total: pickedIds.length,
          completed: succeededCount(renders),
          failed: failedTemplatesUnique.length,
          renders,
          failed_templates: failedTemplatesUnique,
          updated_at: progressAt,
        })
        .eq('id', job.id)
        .eq('user_id', authUser.id)

      if (progressError) {
        console.error(`[${reqId}] render_jobs progress update error:`, progressError)
        return jsonResponse({ error: progressError.message }, 500)
      }
    }

    const progressFailedTemplatesUnique = uniqueFailed(failedTemplates, renders)
    const progressSucceeded = succeededCount(renders)
    const progressFailed = progressFailedTemplatesUnique.length
    const processedAfterChunk = progressSucceeded + progressFailed

    if (processedAfterChunk < pickedIds.length) {
      const processUrl = `${SUPABASE_URL}/functions/v1/process-render-job`
      const kickoff = fetch(processUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.text()
          console.error(`[${reqId}] proximo process-render-job ${res.status}:`, body.slice(0, 300))
        }
      }).catch((err) => {
        console.error(`[${reqId}] proximo process-render-job falhou:`, err)
      })

      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        EdgeRuntime.waitUntil(kickoff)
      } else {
        console.warn(`[${reqId}] EdgeRuntime.waitUntil indisponivel; job ficara processing ate novo disparo`)
      }

      return jsonResponse({
        jobId: job.id,
        status: 'processing',
        total: pickedIds.length,
        completed: progressSucceeded,
        failed: progressFailed,
        failedTemplates: progressFailedTemplatesUnique,
        renders,
      }, 200)
    }

    const failedTemplatesUnique = uniqueFailed(failedTemplates, renders)
    const totalSucceeded = succeededCount(renders)
    const totalFailed = failedTemplatesUnique.length
    const finalStatus =
      totalSucceeded > 0 && totalFailed === 0 ? 'completed' :
      totalSucceeded > 0 && totalFailed > 0 ? 'partial_success' :
      'failed'
    const finishedAt = new Date().toISOString()

    const { error: finishError } = await supabase
      .from('render_jobs')
      .update({
        status: finalStatus,
        total: pickedIds.length,
        completed: totalSucceeded,
        failed: totalFailed,
        renders,
        failed_templates: failedTemplatesUnique,
        error: finalStatus === 'failed' ? 'Nenhum render foi disparado com sucesso' : null,
        finished_at: finishedAt,
        updated_at: finishedAt,
      })
      .eq('id', job.id)
      .eq('user_id', authUser.id)

    if (finishError) {
      console.error(`[${reqId}] render_jobs finish update error:`, finishError)
      return jsonResponse({ error: finishError.message }, 500)
    }

    return jsonResponse({
      jobId: job.id,
      status: finalStatus,
      total: pickedIds.length,
      completed: totalSucceeded,
      failed: totalFailed,
      failedTemplates: failedTemplatesUnique,
      renders,
    }, 200)
  } catch (error) {
    console.error(`[${reqId}] unhandled`, error)
    const msg = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: msg }, 500)
  }
})

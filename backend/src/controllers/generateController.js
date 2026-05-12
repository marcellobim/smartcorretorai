const crypto = require('crypto')
const supabase = require('../services/supabase')
const { gerarTextosCampanha } = require('../services/claude')
const { success, error } = require('../utils/response')

const MONTHLY_LIMITS = {
  free: 1, teste: 1,
  start: 15, starter: 15,
  pro: 35,
  enterprise: 80,
}

// Normaliza os dados do imóvel e gera um hash SHA-256 para cache
function computeContentHash(body) {
  const key = JSON.stringify({
    categoria: body.categoria ?? '',
    tipo: body.tipo ?? '',
    finalidade: body.finalidade ?? '',
    quartos: body.quartos ?? 0,
    banheiros: body.banheiros ?? 0,
    vagas: body.vagas ?? 0,
    area: body.area ?? '',
    preco: String(body.preco ?? ''),
    bairro: (body.bairro || '').toLowerCase().trim(),
    cidade: (body.cidade || '').toLowerCase().trim(),
    diferenciais: [...(body.diferenciais || [])].sort(),
    n_fotos: (body.fotos || []).length,
    telefone: body.telefone_contato ?? '',
    descricao_livre: (body.descricao_livre || '').trim(),
  })
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 32)
}

// Retorna créditos disponíveis do usuário (mensal + avulso)
async function credits(req, res, next) {
  try {
    const user = req.user

    // Se for sub-usuário Enterprise, usa os limites do dono
    const ownerId = user.enterprise_owner_id || user.id
    let plano = user.plano || 'free'
    if (user.enterprise_owner_id) {
      const { data: owner } = await supabase.from('profiles').select('plano').eq('id', ownerId).single()
      plano = owner?.plano || plano
    }

    const limite = MONTHLY_LIMITS[plano] ?? 1

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: usadosMes } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())
      .not('status', 'eq', 'erro')

    const restantesMes = Math.max(0, limite - (usadosMes || 0))

    return success(res, {
      plano,
      limite_mensal: limite,
      usados_mes: usadosMes || 0,
      restantes_mes: restantesMes,
      creditos_avulsos: user.creditos_avulsos || 0,
      total_disponivel: restantesMes + (user.creditos_avulsos || 0),
    })
  } catch (err) {
    next(err)
  }
}

async function campaign(req, res, next) {
  try {
    const user = req.user

    // Resolve plano (Enterprise sub-usuários herdam do dono)
    let plano = user.plano || 'free'
    if (user.enterprise_owner_id) {
      const { data: owner } = await supabase.from('profiles').select('plano').eq('id', user.enterprise_owner_id).single()
      plano = owner?.plano || plano
    }

    const limite = MONTHLY_LIMITS[plano] ?? 1

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count: usadosMes } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())
      .not('status', 'eq', 'erro')

    const restantesMes = Math.max(0, limite - (usadosMes || 0))
    const avulsosDisponiveis = user.creditos_avulsos || 0

    if (restantesMes === 0 && avulsosDisponiveis === 0) {
      return error(
        res,
        `Você não tem anúncios disponíveis. Restam ${restantesMes} anúncios no plano este mês e ${avulsosDisponiveis} anúncios avulsos. Faça upgrade ou compre anúncios avulsos.`,
        403
      )
    }

    const usarAvulso = restantesMes === 0

    // ── Cache por hash de conteúdo ──────────────────────────────
    const contentHash = computeContentHash(req.body)

    const { data: cached } = await supabase
      .from('campaigns')
      .select('id, status, titulo, preview_url, redes_sociais, textos_gerados, created_at')
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .eq('status', 'concluido')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      return res.status(202).json({
        success: true,
        campaign: cached,
        cached: true,
        message: 'Resultado recuperado do cache — nenhum anúncio consumido',
      })
    }

    // ── Debita crédito avulso antes de criar (evita race condition) ──
    if (usarAvulso) {
      const { error: decrErr } = await supabase
        .from('profiles')
        .update({ creditos_avulsos: avulsosDisponiveis - 1, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .eq('creditos_avulsos', avulsosDisponiveis) // CAS: só atualiza se o valor não mudou

      if (decrErr) {
        return error(res, 'Não foi possível debitar o anúncio avulso. Tente novamente.', 409)
      }
    }

    // ── Cria campanha ────────────────────────────────────────────
    const { fotos: _fotos, ...dadosSemFotos } = req.body

    const titulo =
      req.body.titulo ||
      [req.body.tipo, req.body.quartos && `${req.body.quartos} quartos`, req.body.bairro, req.body.cidade]
        .filter(Boolean)
        .join(' · ') ||
      'Novo anúncio'

    const { data: campanha, error: createError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        titulo,
        status: 'gerando',
        dados_imovel: dadosSemFotos,
        redes_sociais: req.body.redes_sociais || ['instagram_feed', 'instagram_stories', 'whatsapp', 'facebook'],
        content_hash: contentHash,
      })
      .select()
      .single()

    if (createError) throw createError

    res.status(202).json({ success: true, campaign: campanha, message: 'Seus anúncios estão sendo criados' })

    // ── Geração em background ────────────────────────────────────
    try {
      const textos = await gerarTextosCampanha(req.body)

      await supabase
        .from('campaigns')
        .update({
          status: 'concluido',
          titulo: textos.titulo_campanha || titulo,
          textos_gerados: textos.textos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campanha.id)
    } catch (procErr) {
      console.error('Erro ao gerar anúncios:', procErr.message)

      // Devolve crédito avulso se a geração falhou
      if (usarAvulso) {
        await supabase
          .from('profiles')
          .update({ creditos_avulsos: avulsosDisponiveis, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      }

      await supabase
        .from('campaigns')
        .update({ status: 'erro', updated_at: new Date().toISOString() })
        .eq('id', campanha.id)
    }
  } catch (err) {
    next(err)
  }
}

async function status(req, res, next) {
  try {
    const { id } = req.params
    const { data, error: dbError } = await supabase
      .from('campaigns')
      .select('id, status, titulo, preview_url, redes_sociais, textos_gerados, created_at')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (dbError || !data) return error(res, 'Anúncio não encontrado', 404)
    return success(res, { campaign: data })
  } catch (err) {
    next(err)
  }
}

module.exports = { campaign, status, credits }

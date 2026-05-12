const supabase = require('../services/supabase')
const { success, error } = require('../utils/response')

const PLAN_LIMITS = { starter: 3, pro: Infinity, enterprise: Infinity }

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, finalidade, tipo } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (finalidade) query = query.eq('finalidade', finalidade)
    if (tipo) query = query.eq('tipo', tipo)

    const { data, count, error: dbError } = await query
    if (dbError) throw dbError

    return success(res, { properties: data, total: count, page: Number(page), limit: Number(limit) })
  } catch (err) {
    next(err)
  }
}

async function create(req, res, next) {
  try {
    const { data: count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    const planLimit = PLAN_LIMITS[req.user.plano || 'starter']
    if (count >= planLimit) {
      return error(res, `Limite de imóveis do plano ${req.user.plano || 'Starter'} atingido. Faça upgrade para continuar.`, 403)
    }

    const payload = {
      ...req.body,
      user_id: req.user.id,
      preco: Number(req.body.preco),
      area: req.body.area ? Number(req.body.area) : null,
      quartos: req.body.quartos ? Number(req.body.quartos) : 0,
      banheiros: req.body.banheiros ? Number(req.body.banheiros) : 0,
      vagas: req.body.vagas ? Number(req.body.vagas) : 0,
    }

    const { data, error: dbError } = await supabase
      .from('properties')
      .insert(payload)
      .select()
      .single()

    if (dbError) throw dbError
    return success(res, { property: data }, 201)
  } catch (err) {
    next(err)
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params

    const { data: existing } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== req.user.id) {
      return error(res, 'Imóvel não encontrado', 404)
    }

    const { data, error: dbError } = await supabase
      .from('properties')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw dbError
    return success(res, { property: data })
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params

    const { data: existing } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== req.user.id) {
      return error(res, 'Imóvel não encontrado', 404)
    }

    await supabase.from('properties').delete().eq('id', id)
    return success(res, { message: 'Imóvel excluído' })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, create, update, remove }

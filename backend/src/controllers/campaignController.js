const supabase = require('../services/supabase')
const { success, error } = require('../utils/response')

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)

    const { data, count, error: dbError } = await query
    if (dbError) throw dbError

    return success(res, { campaigns: data, total: count })
  } catch (err) {
    next(err)
  }
}

async function getOne(req, res, next) {
  try {
    const { id } = req.params
    const { data, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (dbError || !data) return error(res, 'Campanha não encontrada', 404)
    return success(res, { campaign: data })
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params

    const { data: existing } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== req.user.id) {
      return error(res, 'Campanha não encontrada', 404)
    }

    await supabase.from('campaigns').delete().eq('id', id)
    return success(res, { message: 'Campanha excluída' })
  } catch (err) {
    next(err)
  }
}

module.exports = { list, getOne, remove }

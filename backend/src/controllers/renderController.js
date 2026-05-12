const supabase = require('../services/supabase')
const { gerarPacoteCreatomate } = require('../services/creatomate')
const { success, error } = require('../utils/response')

async function render(req, res, next) {
  try {
    const { id } = req.params

    const { data: camp, error: dbErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (dbErr || !camp) return error(res, 'Campanha não encontrada', 404)
    if (camp.status !== 'concluido') return error(res, 'Campanha ainda não concluída', 400)

    const renders = camp.textos_gerados?._renders
    if (renders) {
      const emAndamento = Object.values(renders).some(
        r => r.status === 'planned' || r.status === 'rendering'
      )
      if (emAndamento) return error(res, 'Renders já em andamento para esta campanha', 409)
    }

    res.status(202).json({ success: true, message: 'Geração de banners e vídeos iniciada' })

    gerarPacoteCreatomate(camp, req.body.fotos || []).catch(err =>
      console.error(`[render] Erro campanha ${id}:`, err.message)
    )
  } catch (err) {
    next(err)
  }
}

async function statusRender(req, res, next) {
  try {
    const { id } = req.params

    const { data: camp, error: dbErr } = await supabase
      .from('campaigns')
      .select('textos_gerados')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single()

    if (dbErr || !camp) return error(res, 'Campanha não encontrada', 404)

    const renders = camp.textos_gerados?._renders || null
    return success(res, { renders })
  } catch (err) {
    next(err)
  }
}

module.exports = { render, statusRender }

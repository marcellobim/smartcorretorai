const bcrypt = require('bcryptjs')
const supabase = require('../services/supabase')
const { success, error } = require('../utils/response')

async function getMe(req, res) {
  const { senha_hash, ...user } = req.user
  return success(res, { user })
}

async function updateMe(req, res, next) {
  try {
    const allowedFields = ['nome', 'creci', 'estado', 'telefone']
    const updates = {}
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f]
    })
    updates.updated_at = new Date().toISOString()

    const { data, error: dbError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()

    if (dbError) throw dbError

    const { senha_hash, ...user } = data
    return success(res, { user })
  } catch (err) {
    next(err)
  }
}

async function updatePassword(req, res, next) {
  try {
    const { senha_atual, nova_senha } = req.body

    const senhaCorreta = await bcrypt.compare(senha_atual, req.user.senha_hash)
    if (!senhaCorreta) {
      return error(res, 'Senha atual incorreta', 400)
    }

    const nova_hash = await bcrypt.hash(nova_senha, 12)
    await supabase
      .from('profiles')
      .update({ senha_hash: nova_hash, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    return success(res, { message: 'Senha alterada com sucesso' })
  } catch (err) {
    next(err)
  }
}

module.exports = { getMe, updateMe, updatePassword }

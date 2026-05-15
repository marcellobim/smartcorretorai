const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const supabase = require('../services/supabase')
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService')
const { success, error } = require('../utils/response')

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}

async function register(req, res, next) {
  try {
    const { nome, email, senha, creci, estado } = req.body

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return error(res, 'E-mail já cadastrado', 409)
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (authError) throw authError

    const senhaHash = await bcrypt.hash(senha, 12)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        nome,
        email,
        senha_hash: senhaHash,
        creci: creci || null,
        estado: estado || null,
        plano: 'starter',
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (profileError) throw profileError

    const token = generateToken(profile.id)

    sendWelcomeEmail(email, nome).catch(console.error)

    return success(res, {
      message: 'Conta criada com sucesso',
      user: { id: profile.id, nome: profile.nome, email: profile.email, plano: profile.plano },
      token,
    }, 201)
  } catch (err) {
    next(err)
  }
}

async function login(req, res, next) {
  try {
    const { email, senha, password } = req.body 
    const senhaFinal = senha || password
    const { data: user, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !user) {
      return error(res, 'E-mail ou senha incorretos', 401)
    }

    const senhaCorreta = await bcrypt.compare(senhaFinal, user.senha_hash)
    if (!senhaCorreta) {
      return error(res, 'E-mail ou senha incorretos', 401)
    }

    

    const token = generateToken(user.id)

    return success(res, {
      user: { id: user.id, nome: user.nome, email: user.email, plano: user.plano, creci: user.creci, estado: user.estado, role: user.role },
      token,
    })
  } catch (err) {
    next(err)
  }
}

async function me(req, res) {
  const { senha_hash, ...user } = req.user
  return success(res, { user })
}

async function logout(req, res) {
  return success(res, { message: 'Logout realizado' })
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body

    const { data: user } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('email', email)
      .single()

    if (!user) {
      return success(res, { message: 'Se o e-mail existir, você receberá as instruções.' })
    }

    const resetToken = uuidv4()
    const expiresAt = new Date(Date.now() + 3600000).toISOString()

    await supabase.from('password_resets').insert({ user_id: user.id, token: resetToken, expires_at: expiresAt })

    const resetUrl = `${process.env.FRONTEND_URL}/redefinir-senha?token=${resetToken}`
    await sendPasswordResetEmail(email, resetUrl)

    return success(res, { message: 'Se o e-mail existir, você receberá as instruções.' })
  } catch (err) {
    next(err)
  }
}

async function resendConfirmation(req, res, next) {
  try {
    const { email } = req.body

    if (!email) {
      return error(res, 'E-mail é obrigatório', 400)
    }

    // Verificar se o usuário existe
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (!user) {
      return success(res, { message: 'Se o e-mail existir, você receberá o link de confirmação.' })
    }

    // Verificar se já está confirmado
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id)
    
    if (authUser && authUser.user.email_confirmed_at) {
      return error(res, 'Este e-mail já está confirmado', 400)
    }

    // Reenviar email de confirmação
    const { error: resendError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
    })

    if (resendError) {
      console.error('Erro ao reenviar confirmação:', resendError)
      throw resendError
    }

    return success(res, { message: 'E-mail de confirmação reenviado com sucesso' })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, me, logout, forgotPassword, resendConfirmation }

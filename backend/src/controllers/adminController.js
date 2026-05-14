const supabase = require('../services/supabase')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { success, error } = require('../utils/response')

/**
 * GET /admin/stats
 * Retorna estatísticas gerais da plataforma
 */
async function getStats(req, res, next) {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Total de usuários cadastrados
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    // Usuários online (ativos nos últimos 5 minutos)
    const { count: onlineUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', fiveMinutesAgo.toISOString())

    // Novos usuários hoje
    const { count: newUsersToday } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Novos usuários este mês
    const { count: newUsersMonth } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString())

    // Total de campanhas geradas (all time)
    const { count: totalCampaigns } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'concluido')

    // Campanhas geradas hoje
    const { count: campaignsToday } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'concluido')
      .gte('created_at', today.toISOString())

    // Campanhas geradas este mês
    const { count: campaignsMonth } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'concluido')
      .gte('created_at', startOfMonth.toISOString())

    // Campanhas geradas este ano
    const { count: campaignsYear } = await supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'concluido')
      .gte('created_at', startOfYear.toISOString())

    // Usuários por plano
    const { data: usersByPlan } = await supabase
      .from('profiles')
      .select('plano')

    const planCounts = usersByPlan.reduce((acc, user) => {
      const plan = user.plano || 'starter'
      acc[plan] = (acc[plan] || 0) + 1
      return acc
    }, {})

    // Receita via Stripe (últimas 1000 transações)
    let revenueToday = 0
    let revenueMonth = 0
    let revenueYear = 0
    let revenueByPlan = { start: 0, pro: 0, imobiliaria: 0 }
    let avulsoSales = { avulso5: { count: 0, revenue: 0 }, avulso10: { count: 0, revenue: 0 } }
    let mrr = 0

    try {
      // Buscar pagamentos bem-sucedidos
      const charges = await stripe.charges.list({ limit: 100 })
      
      charges.data.forEach((charge) => {
        if (charge.status === 'succeeded') {
          const amount = charge.amount / 100 // Stripe usa centavos
          const chargeDate = new Date(charge.created * 1000)

          // Receita por período
          if (chargeDate >= today) revenueToday += amount
          if (chargeDate >= startOfMonth) revenueMonth += amount
          if (chargeDate >= startOfYear) revenueYear += amount
        }
      })

      // Buscar assinaturas ativas para calcular MRR
      const subscriptions = await stripe.subscriptions.list({ status: 'active', limit: 100 })
      
      subscriptions.data.forEach((sub) => {
        if (sub.items.data[0]) {
          const amount = sub.items.data[0].price.unit_amount / 100
          mrr += amount
        }
      })

      // Buscar invoices para categorizar receita por plano
      const invoices = await stripe.invoices.list({ limit: 100 })
      
      invoices.data.forEach((invoice) => {
        if (invoice.status === 'paid' && invoice.metadata) {
          const amount = invoice.amount_paid / 100
          const planId = invoice.metadata.plan_id

          if (planId === 'start') revenueByPlan.start += amount
          else if (planId === 'pro') revenueByPlan.pro += amount
          else if (planId === 'imobiliaria') revenueByPlan.imobiliaria += amount
          else if (planId === 'avulso5') {
            avulsoSales.avulso5.count++
            avulsoSales.avulso5.revenue += amount
          } else if (planId === 'avulso10') {
            avulsoSales.avulso10.count++
            avulsoSales.avulso10.revenue += amount
          }
        }
      })
    } catch (stripeError) {
      console.error('Erro ao buscar dados do Stripe:', stripeError)
      // Continua mesmo se o Stripe falhar
    }

    return success(res, {
      users: {
        total: totalUsers || 0,
        online: onlineUsers || 0,
        newToday: newUsersToday || 0,
        newThisMonth: newUsersMonth || 0,
        byPlan: planCounts,
      },
      campaigns: {
        total: totalCampaigns || 0,
        today: campaignsToday || 0,
        thisMonth: campaignsMonth || 0,
        thisYear: campaignsYear || 0,
      },
      revenue: {
        today: revenueToday,
        month: revenueMonth,
        year: revenueYear,
        mrr: mrr,
        byPlan: revenueByPlan,
        avulsoSales: avulsoSales,
      },
    })
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err)
    next(err)
  }
}

/**
 * GET /admin/users
 * Lista todos os usuários com informações detalhadas
 */
async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 50, search, plano, role } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('profiles')
      .select('id, nome, email, plano, role, created_at, updated_at, creditos_avulsos', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1)

    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (plano) {
      query = query.eq('plano', plano)
    }

    if (role) {
      query = query.eq('role', role)
    }

    const { data: users, count, error: dbError } = await query

    if (dbError) throw dbError

    // Buscar total de campanhas para cada usuário
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const { count: campaignCount } = await supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'concluido')

        return {
          ...user,
          totalCampaigns: campaignCount || 0,
        }
      })
    )

    return success(res, {
      users: usersWithStats,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    })
  } catch (err) {
    console.error('Erro ao listar usuários:', err)
    next(err)
  }
}

/**
 * GET /admin/users/:id
 * Retorna detalhes completos de um usuário específico
 */
async function getUserDetails(req, res, next) {
  try {
    const { id } = req.params

    const { data: user, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (dbError || !user) {
      return error(res, 'Usuário não encontrado', 404)
    }

    // Buscar campanhas do usuário
    const { data: campaigns, count: campaignCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Buscar assinatura ativa
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', id)
      .eq('status', 'ativo')
      .single()

    // Buscar propriedades
    const { count: propertyCount } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)

    // Remover senha do retorno
    const { senha_hash, ...userWithoutPassword } = user

    return success(res, {
      user: userWithoutPassword,
      stats: {
        totalCampaigns: campaignCount || 0,
        totalProperties: propertyCount || 0,
      },
      recentCampaigns: campaigns || [],
      subscription: subscription || null,
    })
  } catch (err) {
    console.error('Erro ao buscar detalhes do usuário:', err)
    next(err)
  }
}

/**
 * PUT /admin/users/:id
 * Edita informações de um usuário (role, créditos, plano)
 */
async function updateUser(req, res, next) {
  try {
    const { id } = req.params
    const { role, creditos_avulsos, plano } = req.body

    const updates = {}
    if (role !== undefined) updates.role = role
    if (creditos_avulsos !== undefined) updates.creditos_avulsos = parseInt(creditos_avulsos)
    if (plano !== undefined) updates.plano = plano
    updates.updated_at = new Date().toISOString()

    const { data, error: dbError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw dbError

    const { senha_hash, ...userWithoutPassword } = data

    return success(res, {
      message: 'Usuário atualizado com sucesso',
      user: userWithoutPassword,
    })
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err)
    next(err)
  }
}

/**
 * DELETE /admin/users/:id
 * Remove um usuário do sistema
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params

    // Verificar se o usuário existe
    const { data: user } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', id)
      .single()

    if (!user) {
      return error(res, 'Usuário não encontrado', 404)
    }

    // Não permitir deletar o próprio admin
    if (user.id === req.user.id) {
      return error(res, 'Você não pode deletar sua própria conta de administrador', 400)
    }

    // Deletar usuário (cascade vai remover campanhas, propriedades, etc)
    const { error: dbError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (dbError) throw dbError

    return success(res, {
      message: `Usuário ${user.email} removido com sucesso`,
    })
  } catch (err) {
    console.error('Erro ao deletar usuário:', err)
    next(err)
  }
}

/**
 * POST /admin/users/:id/credits
 * Adiciona ou remove créditos manualmente
 */
async function adjustCredits(req, res, next) {
  try {
    const { id } = req.params
    const { amount, operation } = req.body // operation: 'add' ou 'remove'

    if (!amount || !operation) {
      return error(res, 'Parâmetros inválidos. Envie amount e operation (add/remove)', 400)
    }

    const { data: user } = await supabase
      .from('profiles')
      .select('creditos_avulsos')
      .eq('id', id)
      .single()

    if (!user) {
      return error(res, 'Usuário não encontrado', 404)
    }

    const currentCredits = user.creditos_avulsos || 0
    let newCredits = currentCredits

    if (operation === 'add') {
      newCredits = currentCredits + parseInt(amount)
    } else if (operation === 'remove') {
      newCredits = Math.max(0, currentCredits - parseInt(amount))
    } else {
      return error(res, 'Operação inválida. Use "add" ou "remove"', 400)
    }

    const { data, error: dbError } = await supabase
      .from('profiles')
      .update({ creditos_avulsos: newCredits, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (dbError) throw dbError

    return success(res, {
      message: `Créditos ${operation === 'add' ? 'adicionados' : 'removidos'} com sucesso`,
      previousCredits: currentCredits,
      newCredits: newCredits,
      user: data,
    })
  } catch (err) {
    console.error('Erro ao ajustar créditos:', err)
    next(err)
  }
}

/**
 * GET /admin/campaigns
 * Lista todas as campanhas geradas com filtros
 */
async function listCampaigns(req, res, next) {
  try {
    const { page = 1, limit = 50, status, user_id } = req.query
    const offset = (page - 1) * limit

    let query = supabase
      .from('campaigns')
      .select('*, profiles!inner(nome, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data: campaigns, count, error: dbError } = await query

    if (dbError) throw dbError

    return success(res, {
      campaigns: campaigns || [],
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    })
  } catch (err) {
    console.error('Erro ao listar campanhas:', err)
    next(err)
  }
}

/**
 * GET /admin/revenue
 * Histórico de receita por dia/mês/ano
 */
async function getRevenue(req, res, next) {
  try {
    const { period = 'month' } = req.query // day, month, year

    let startDate
    const now = new Date()

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      return error(res, 'Período inválido. Use: day, month ou year', 400)
    }

    const startTimestamp = Math.floor(startDate.getTime() / 1000)

    try {
      // Buscar charges do Stripe
      const charges = await stripe.charges.list({
        created: { gte: startTimestamp },
        limit: 100,
      })

      const revenueData = charges.data
        .filter((charge) => charge.status === 'succeeded')
        .map((charge) => ({
          id: charge.id,
          amount: charge.amount / 100,
          currency: charge.currency,
          date: new Date(charge.created * 1000),
          description: charge.description,
          customer: charge.customer,
        }))

      const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0)

      return success(res, {
        period,
        startDate: startDate.toISOString(),
        totalRevenue,
        transactions: revenueData,
        count: revenueData.length,
      })
    } catch (stripeError) {
      console.error('Erro ao buscar receita do Stripe:', stripeError)
      return error(res, 'Erro ao buscar dados de receita', 500)
    }
  } catch (err) {
    console.error('Erro ao buscar receita:', err)
    next(err)
  }
}

/**
 * GET /admin/costs
 * Custos operacionais registrados (placeholder - pode ser expandido)
 */
async function getCosts(req, res, next) {
  try {
    // Placeholder para custos operacionais
    // Pode ser expandido para incluir custos de API, infraestrutura, etc.
    
    return success(res, {
      message: 'Funcionalidade de custos em desenvolvimento',
      costs: {
        anthropic: 'A calcular',
        stripe: 'A calcular',
        infrastructure: 'A calcular',
      },
    })
  } catch (err) {
    console.error('Erro ao buscar custos:', err)
    next(err)
  }
}

module.exports = {
  getStats,
  listUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  adjustCredits,
  listCampaigns,
  getRevenue,
  getCosts,
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const supabase = require('../services/supabase')
const { success, error } = require('../utils/response')

// Planos recorrentes
const PRICE_IDS = {
  start: process.env.STRIPE_PRICE_START,
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
}

// Pacotes avulsos (pagamento único)
const AVULSO_PACKS = {
  avulso1: { priceId: process.env.STRIPE_PRICE_AVULSO1, creditos: 5 },
  avulso2: { priceId: process.env.STRIPE_PRICE_AVULSO2, creditos: 10 },
}

async function checkout(req, res, next) {
  try {
    const { plan_id } = req.body
    const user = req.user

    // Pacote avulso (pagamento único)
    if (AVULSO_PACKS[plan_id]) {
      const pack = AVULSO_PACKS[plan_id]
      if (!pack.priceId) {
        return error(res, 'Pacote avulso não configurado ainda. Aguarde.', 503)
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: user.email,
        line_items: [{ price: pack.priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=success`,
        cancel_url: `${process.env.FRONTEND_URL}/planos?canceled=true`,
        metadata: { user_id: user.id, plan_id, creditos: String(pack.creditos) },
      })
      return success(res, { checkout_url: session.url })
    }

    // Assinatura recorrente
    if (!PRICE_IDS[plan_id]) {
      return error(res, 'Plano inválido', 400)
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: PRICE_IDS[plan_id], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/planos?canceled=true`,
      metadata: { user_id: user.id, plan_id },
    })

    return success(res, { checkout_url: session.url })
  } catch (err) {
    next(err)
  }
}

async function webhook(req, res) {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return res.status(400).send('Webhook inválido')
  }

  // Assinatura paga / renovada
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { user_id, plan_id, creditos } = session.metadata

    if (creditos) {
      // Pacote avulso: soma créditos ao saldo existente
      const { data: profile } = await supabase.from('profiles').select('creditos_avulsos').eq('id', user_id).single()
      const atual = profile?.creditos_avulsos || 0
      await supabase
        .from('profiles')
        .update({ creditos_avulsos: atual + Number(creditos), updated_at: new Date().toISOString() })
        .eq('id', user_id)
    } else {
      // Plano recorrente: atualiza plano
      await supabase
        .from('profiles')
        .update({ plano: plan_id, stripe_customer_id: session.customer, updated_at: new Date().toISOString() })
        .eq('id', user_id)

      await supabase.from('subscriptions').upsert({
        user_id,
        plan_id,
        stripe_subscription_id: session.subscription,
        status: 'ativo',
      })
    }
  }

  // Assinatura cancelada
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelado' })
      .eq('stripe_subscription_id', sub.id)

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .single()

    if (data) {
      await supabase.from('profiles').update({ plano: 'free', updated_at: new Date().toISOString() }).eq('id', data.id)
    }
  }

  res.json({ received: true })
}

async function currentPlan(req, res, next) {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'ativo')
      .single()

    return success(res, {
      subscription: data,
      plano: req.user.plano,
      creditos_avulsos: req.user.creditos_avulsos || 0,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { checkout, webhook, currentPlan }

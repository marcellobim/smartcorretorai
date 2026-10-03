import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleStripeCustomerPortal } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error('stripe_customer_portal_configuration_missing')
  return value
}

const customerPortalReturnUrl = () => {
  const successUrl = new URL(requiredEnv('STRIPE_CHECKOUT_SUCCESS_URL'))
  return new URL('/planos', successUrl.origin).toString()
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  try {
    const supabase = createClient(requiredEnv('SUPABASE_URL'), resolveSupabaseAdminCredential().key, {
      auth: { persistSession: false },
    })
    const response = await handleStripeCustomerPortal(request, {
      returnUrl: customerPortalReturnUrl(),
      authenticate: async token => {
        const { data: { user }, error } = await supabase.auth.getUser(token)
        return error || !user?.id ? null : { id: user.id }
      },
      findActiveStripeCustomerId: async userId => {
        const { data, error } = await supabase.from('subscriptions')
          .select('stripe_customer_id')
          .eq('user_id', userId)
          .eq('status', 'ativo')
          .maybeSingle()
        if (error) throw new Error('stripe_customer_portal_subscription_lookup_failed')
        const customerId = typeof data?.stripe_customer_id === 'string' ? data.stripe_customer_id.trim() : ''
        return customerId || null
      },
      createPortalSession: async params => {
        const stripeResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        })
        if (!stripeResponse.ok) throw new Error('stripe_customer_portal_request_failed')
        return await stripeResponse.json() as { url: string | null }
      },
    })
    for (const [key, value] of Object.entries(corsHeaders)) response.headers.set(key, value)
    return response
  } catch (error) {
    console.error('[stripe-customer-portal]', error instanceof Error ? error.message : 'unknown_failure')
    return new Response(JSON.stringify({ ok: false, error: 'Não foi possível abrir o portal da assinatura.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

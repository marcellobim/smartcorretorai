import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleStripeCheckout } from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error('stripe_checkout_configuration_missing')
  return value
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  try {
    const supabase = createClient(requiredEnv('SUPABASE_URL'), resolveSupabaseAdminCredential().key, {
      auth: { persistSession: false },
    })
    const response = await handleStripeCheckout(request, {
      readEnv: name => Deno.env.get(name),
      authenticate: async token => {
        const { data: { user }, error } = await supabase.auth.getUser(token)
        return error || !user?.id ? null : { id: user.id }
      },
      findStripeCustomerId: async userId => {
        const { data, error } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
        if (error) throw new Error('stripe_customer_lookup_failed')
        return typeof data?.stripe_customer_id === 'string' ? data.stripe_customer_id : null
      },
      createCheckoutSession: async params => {
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        })
        if (!stripeResponse.ok) throw new Error('stripe_checkout_request_failed')
        return await stripeResponse.json() as { id: string; url: string | null }
      },
    })
    for (const [key, value] of Object.entries(corsHeaders)) response.headers.set(key, value)
    return response
  } catch (error) {
    console.error('[stripe-checkout]', error instanceof Error ? error.message : 'unknown_failure')
    return new Response(JSON.stringify({ ok: false, error: 'Não foi possível iniciar o checkout.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

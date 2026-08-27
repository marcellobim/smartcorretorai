import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { grantFinancialLot } from '../_shared/stripe-commerce.ts'
import { buildTransactionalEmail, sendTransactionalEmail } from '../_shared/transactional-email.ts'
import {
  handleStripeWebhook,
  subscriptionPersistence,
  type StripeEmailNotification,
  type SubscriptionSyncRecord,
} from './runtime.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error('stripe_webhook_configuration_missing')
  return value
}

const stripeGet = async (path: string) => {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}` },
  })
  if (!response.ok) throw new Error('stripe_resource_request_failed')
  return await response.json() as Record<string, unknown>
}

const retrieveInvoiceForEmail = (id: string) => {
  const query = new URLSearchParams()
  query.append('expand[]', 'discounts')
  query.append('expand[]', 'discounts.promotion_code')
  query.append('expand[]', 'discounts.promotion_code.promotion.coupon')
  query.append('expand[]', 'discounts.source.coupon')
  return stripeGet(`/invoices/${encodeURIComponent(id)}?${query.toString()}`)
}

serve(async (request) => {
  try {
    const supabase = createClient(requiredEnv('SUPABASE_URL'), resolveSupabaseAdminCredential().key, {
      auth: { persistSession: false },
    })
    const notify = async (notification: StripeEmailNotification) => {
      let claimed = false
      try {
        const { data: claim, error: claimError } = await supabase.rpc('claim_stripe_transactional_email', {
          p_idempotency_key: notification.idempotencyKey,
          p_stripe_event_id: notification.stripeEventId,
          p_user_id: notification.userId,
          p_template: notification.kind,
        })
        if (claimError) throw new Error('transactional_email_claim_failed')
        claimed = claim === true
        if (!claimed) return 'already_processed'

        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(notification.userId)
        const recipient = String(userData?.user?.email ?? '').trim()
        if (userError || !recipient) throw new Error('transactional_email_recipient_missing')

        const content = buildTransactionalEmail(notification)
        const providerMessageId = await sendTransactionalEmail({
          ...content,
          to: recipient,
          idempotencyKey: notification.idempotencyKey,
        })
        const { error: completeError } = await supabase.rpc('complete_stripe_transactional_email', {
          p_idempotency_key: notification.idempotencyKey,
          p_succeeded: true,
          p_provider_message_id: providerMessageId,
        })
        if (completeError) throw new Error('transactional_email_complete_failed')
        return 'sent'
      } catch {
        if (claimed) {
          try {
            await supabase.rpc('complete_stripe_transactional_email', {
              p_idempotency_key: notification.idempotencyKey,
              p_succeeded: false,
              p_provider_message_id: null,
            })
          } catch {
            // The financial webhook must still finish even if delivery-state persistence is unavailable.
          }
        }
        throw new Error('transactional_email_delivery_failed')
      }
    }
    return await handleStripeWebhook(request, {
      webhookSecret: requiredEnv('STRIPE_WEBHOOK_SECRET'),
      retrieveSubscription: id => stripeGet(`/subscriptions/${encodeURIComponent(id)}`),
      retrieveInvoice: retrieveInvoiceForEmail,
      grant: request => grantFinancialLot(request, supabase),
      notify,
      logEmailFailure: code => console.error('[stripe-webhook-email]', code),
      syncSubscription: async (record: SubscriptionSyncRecord) => {
        const persistence = subscriptionPersistence(record)
        const { error: subscriptionError } = await supabase.from('subscriptions')
          .upsert(persistence.subscription, { onConflict: 'user_id' })
        if (subscriptionError) throw new Error('subscription_sync_failed')
        const { error: profileError } = await supabase.from('profiles')
          .update(persistence.profile)
          .eq('id', record.userId)
        if (profileError) throw new Error('stripe_profile_sync_failed')
      },
    })
  } catch (error) {
    console.error('[stripe-webhook]', error instanceof Error ? error.message : 'unknown_failure')
    return new Response(JSON.stringify({ ok: false, error: 'Falha ao processar webhook.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

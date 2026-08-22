import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, withCors } from '../_shared/cors.ts'
import { deliverTestimonialEmail } from '../_shared/testimonial-email.ts'
import {
  TestimonialRequestError,
  handleTestimonialSubmission,
  type ValidTestimonialSubmission,
} from './runtime.ts'

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error('testimonial_api_configuration_missing')
  return value
}

function sameSubmission(row: Record<string, unknown>, input: ValidTestimonialSubmission) {
  return row.body === input.body
    && (row.profession_label ?? null) === input.professionLabel
    && row.publication_consent === input.publicationConsent
    && row.attribution_consent === input.attributionConsent
}

serve(withCors(async request => {
  try {
    const client = createClient(
      requiredEnv('SUPABASE_URL'),
      requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )
    const payload = await request.json().catch(() => null)
    const response = await handleTestimonialSubmission(
      request.headers.get('authorization') ?? '',
      payload,
      {
        authenticate: async token => {
          const result = await client.auth.getUser(token)
          return result.error || !result.data.user?.id ? null : { id: result.data.user.id }
        },
        persist: async (userId, input) => {
          const values = {
            user_id: userId,
            body: input.body,
            profession_label: input.professionLabel,
            publication_consent: input.publicationConsent,
            attribution_consent: input.attributionConsent,
            status: 'pending',
            submission_idempotency_key: input.requestId,
          }
          const inserted = await client.from('testimonials').insert(values)
            .select('id,status,submitted_at').single()
          if (!inserted.error) {
            return {
              id: inserted.data.id,
              status: 'pending' as const,
              submittedAt: inserted.data.submitted_at,
              created: true,
            }
          }
          if (inserted.error.code !== '23505') throw new Error('testimonial_persistence_failed')

          const existing = await client.from('testimonials')
            .select('id,status,submitted_at,body,profession_label,publication_consent,attribution_consent')
            .eq('user_id', userId)
            .eq('submission_idempotency_key', input.requestId)
            .maybeSingle()
          if (existing.error || !existing.data) throw new Error('testimonial_idempotency_lookup_failed')
          if (!sameSubmission(existing.data, input)) {
            throw new TestimonialRequestError('Identificador já usado em outra submissão.', 409)
          }
          return {
            id: existing.data.id,
            status: existing.data.status,
            submittedAt: existing.data.submitted_at,
            created: false,
          }
        },
        notify: (testimonialId, userId) => deliverTestimonialEmail(client, {
          testimonialId,
          userId,
          template: 'received',
        }),
      },
    )
    return jsonResponse(response)
  } catch (error) {
    if (error instanceof TestimonialRequestError) {
      return jsonResponse({ error: error.message }, error.status)
    }
    console.error('testimonial-api failure', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Não foi possível receber o depoimento.' }, 500)
  }
}))

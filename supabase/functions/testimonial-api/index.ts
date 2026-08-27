import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import { jsonResponse, withCors } from '../_shared/cors.ts'
import { deliverTestimonialEmail } from '../_shared/testimonial-email.ts'
import {
  TestimonialRequestError,
  handleTestimonialSubmission,
  handleTestimonialStatusRequest,
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
      resolveSupabaseAdminCredential().key,
      { auth: { persistSession: false } },
    )
    const payload = await request.json().catch(() => null)
    const authenticate = async (token: string) => {
      const result = await client.auth.getUser(token)
      return result.error || !result.data.user?.id ? null : { id: result.data.user.id }
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)
        && (payload as Record<string, unknown>).action === 'status') {
      if (Object.keys(payload as Record<string, unknown>).some(key => key !== 'action')) {
        throw new TestimonialRequestError('Consulta de depoimento inválida.', 400)
      }
      const response = await handleTestimonialStatusRequest(
        request.headers.get('authorization') ?? '',
        {
          authenticate,
          loadLatest: async userId => {
            const result = await client.from('testimonials').select('status,submitted_at')
              .eq('user_id', userId).order('submitted_at', { ascending: false }).limit(1).maybeSingle()
            if (result.error) throw new Error('testimonial_status_lookup_failed')
            return result.data
              ? { status: result.data.status, submittedAt: result.data.submitted_at }
              : null
          },
        },
      )
      return jsonResponse(response)
    }
    const response = await handleTestimonialSubmission(
      request.headers.get('authorization') ?? '',
      payload,
      {
        authenticate,
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

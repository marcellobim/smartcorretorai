import {
  buildTransactionalEmail,
  sendTransactionalEmail,
} from './transactional-email.ts'

export type TestimonialEmailTemplate = 'received' | 'bonus_granted'

type DeliveryClient = Readonly<{
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
  auth: { admin: { getUserById(userId: string): Promise<{ data: { user: { email?: string } | null }; error: unknown }> } }
}>

type DeliveryDependencies = Readonly<{
  send?: typeof sendTransactionalEmail
}>

export type TestimonialEmailResult = 'sent' | 'already_processed' | 'failed'

function safeErrorCode(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  return /^(resend_|transactional_email_)[a-z_]+$/.test(code)
    ? code.slice(0, 100)
    : 'testimonial_email_delivery_failed'
}

export async function deliverTestimonialEmail(
  client: DeliveryClient,
  input: Readonly<{
    testimonialId: string
    userId: string
    template: TestimonialEmailTemplate
    smartTokenBalance?: number
  }>,
  dependencies: DeliveryDependencies = {},
): Promise<TestimonialEmailResult> {
  const claim = await client.rpc('claim_testimonial_email', {
    p_testimonial_id: input.testimonialId,
    p_template: input.template,
  })
  if (claim.error) throw new Error('testimonial_email_claim_failed')
  if (claim.data !== true) return 'already_processed'

  try {
    const recipient = await client.auth.admin.getUserById(input.userId)
    const email = String(recipient.data.user?.email ?? '').trim()
    if (recipient.error || !email) throw new Error('transactional_email_recipient_invalid')
    const message = buildTransactionalEmail(input.template === 'received'
      ? { kind: 'testimonial_received' }
      : { kind: 'testimonial_bonus_granted', smartTokenBalance: input.smartTokenBalance })
    const providerMessageId = await (dependencies.send ?? sendTransactionalEmail)({
      ...message,
      to: email,
      idempotencyKey: `testimonial-email:${input.template}:${input.testimonialId}`,
    })
    const completion = await client.rpc('complete_testimonial_email', {
      p_testimonial_id: input.testimonialId,
      p_template: input.template,
      p_succeeded: true,
      p_provider_message_id: providerMessageId,
      p_error_code: null,
    })
    if (completion.error) throw new Error('testimonial_email_completion_failed')
    return 'sent'
  } catch (error) {
    try {
      await client.rpc('complete_testimonial_email', {
        p_testimonial_id: input.testimonialId,
        p_template: input.template,
        p_succeeded: false,
        p_provider_message_id: null,
        p_error_code: safeErrorCode(error),
      })
    } catch {
      // Delivery failure must not affect the already completed business operation.
    }
    return 'failed'
  }
}

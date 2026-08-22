import assert from 'node:assert/strict'
import test from 'node:test'
import { deliverTestimonialEmail } from '../testimonial-email.ts'
import { buildTransactionalEmail } from '../transactional-email.ts'

function client(options: { claim?: boolean; email?: string } = {}) {
  const calls: Array<{ name: string; parameters: Record<string, unknown> }> = []
  return {
    calls,
    value: {
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        calls.push({ name, parameters })
        return { data: name === 'claim_testimonial_email' ? options.claim ?? true : null, error: null }
      },
      auth: { admin: { getUserById: async () => ({
        data: { user: { email: options.email ?? 'login@example.com' } }, error: null,
      }) } },
    },
  }
}

test('testimonial templates use safe campaign language and optional confirmed balance', () => {
  const received = buildTransactionalEmail({ kind: 'testimonial_received' })
  const bonus = buildTransactionalEmail({ kind: 'testimonial_bonus_granted', smartTokenBalance: 1250 })
  assert.equal(received.subject, 'Recebemos seu depoimento')
  assert.match(received.text, /será analisado/)
  assert.match(received.text, /poderá receber 500 Smart Tokens/)
  assert.doesNotMatch(received.text, /avaliação positiva|garantido/i)
  assert.equal(bonus.subject, 'Você ganhou 500 Smart Tokens')
  assert.match(bonus.text, /Concedemos 500 Smart Tokens/)
  assert.match(bonus.text, /Saldo confirmado: 1\.250 ST/)
  assert.doesNotMatch(bonus.text, /positivo|elogio/i)
})

test('received delivery resolves auth user server-side, sends once and marks sent', async () => {
  const mock = client()
  let recipient = ''
  const result = await deliverTestimonialEmail(mock.value, {
    testimonialId: 'testimonial-1', userId: 'auth-user-1', template: 'received',
  }, {
    send: async message => {
      recipient = message.to
      assert.equal(message.idempotencyKey, 'testimonial-email:received:testimonial-1')
      return 'provider-message-1'
    },
  })
  assert.equal(result, 'sent')
  assert.equal(recipient, 'login@example.com')
  assert.deepEqual(mock.calls.map(call => call.name), ['claim_testimonial_email', 'complete_testimonial_email'])
  assert.equal(mock.calls[1].parameters.p_succeeded, true)
})

test('provider failure marks failed with a sanitized code and never throws provider detail', async () => {
  const mock = client()
  const result = await deliverTestimonialEmail(mock.value, {
    testimonialId: 'testimonial-1', userId: 'auth-user-1', template: 'received',
  }, {
    send: async () => { throw new Error('private provider response with credentials') },
  })
  assert.equal(result, 'failed')
  assert.equal(mock.calls[1].parameters.p_succeeded, false)
  assert.equal(mock.calls[1].parameters.p_error_code, 'testimonial_email_delivery_failed')
})

test('an existing sent or active claim prevents a duplicate provider call', async () => {
  const mock = client({ claim: false })
  let sends = 0
  const result = await deliverTestimonialEmail(mock.value, {
    testimonialId: 'testimonial-1', userId: 'auth-user-1', template: 'received',
  }, { send: async () => { sends += 1; return 'unexpected' } })
  assert.equal(result, 'already_processed')
  assert.equal(sends, 0)
  assert.equal(mock.calls.length, 1)
})

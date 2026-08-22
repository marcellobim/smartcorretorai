import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TestimonialRequestError,
  handleTestimonialSubmission,
  handleTestimonialStatusRequest,
  validateTestimonialSubmission,
} from './runtime.ts'

const requestId = '11111111-1111-4111-8111-111111111111'
const validInput = () => ({
  body: 'O produto ajudou no meu trabalho.',
  profession_label: 'Corretor de imóveis',
  publication_consent: true,
  attribution_consent: false,
  requestId,
})

test('submission validation rejects forbidden identity and administrative fields', () => {
  for (const field of ['user_id', 'status', 'bonus_adjustment_id', 'approved_by', 'published_by']) {
    assert.throws(
      () => validateTestimonialSubmission({ ...validInput(), [field]: 'forbidden' }),
      (error: unknown) => error instanceof TestimonialRequestError && error.status === 400,
    )
  }
})

test('submission validation enforces body, profession, consents and request id limits', () => {
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), body: '  ' }), /obrigatório/)
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), body: 'x'.repeat(3001) }), /limite/)
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), profession_label: 'x'.repeat(121) }), /Profissão/)
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), publication_consent: 'true' }), /Consentimentos/)
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), attribution_consent: 1 }), /Consentimentos/)
  assert.throws(() => validateTestimonialSubmission({ ...validInput(), requestId: 'not-a-uuid' }), /Identificador/)
})

test('missing JWT is rejected before persistence', async () => {
  let persisted = false
  await assert.rejects(() => handleTestimonialSubmission('', validInput(), {
    authenticate: async () => ({ id: 'should-not-run' }),
    persist: async () => { persisted = true; throw new Error('unexpected') },
    notify: async () => 'sent',
  }), (error: unknown) => error instanceof TestimonialRequestError && error.status === 401)
  assert.equal(persisted, false)
})

test('authenticated submission persists as pending before notification and returns sanitized data', async () => {
  const events: string[] = []
  const response = await handleTestimonialSubmission('Bearer valid-token', validInput(), {
    authenticate: async token => {
      assert.equal(token, 'valid-token')
      return { id: 'server-auth-user' }
    },
    persist: async (userId, submission) => {
      events.push('persist')
      assert.equal(userId, 'server-auth-user')
      assert.equal(submission.body, validInput().body)
      return { id: 'testimonial-1', status: 'pending', submittedAt: '2026-08-22T12:00:00Z', created: true }
    },
    notify: async (testimonialId, userId) => {
      events.push('notify')
      assert.equal(testimonialId, 'testimonial-1')
      assert.equal(userId, 'server-auth-user')
      return 'sent'
    },
  })
  assert.deepEqual(events, ['persist', 'notify'])
  assert.deepEqual(Object.keys(response).sort(), [
    'notificationSent', 'status', 'submitted_at', 'testimonialCreated', 'testimonial_id',
  ])
  assert.equal(response.status, 'pending')
  assert.equal(response.notificationSent, true)
})

test('email failure does not invalidate the persisted testimonial', async () => {
  let saved = false
  const response = await handleTestimonialSubmission('Bearer valid-token', validInput(), {
    authenticate: async () => ({ id: 'server-auth-user' }),
    persist: async () => {
      saved = true
      return { id: 'testimonial-1', status: 'pending', submittedAt: 'now', created: true }
    },
    notify: async () => { throw new Error('provider detail') },
  })
  assert.equal(saved, true)
  assert.equal(response.testimonialCreated, true)
  assert.equal(response.notificationSent, false)
})

test('same user and idempotency key reuse one persisted testimonial', async () => {
  const stored = new Map<string, { id: string; input: ReturnType<typeof validateTestimonialSubmission> }>()
  let inserts = 0
  const dependencies = {
    authenticate: async () => ({ id: 'server-auth-user' }),
    persist: async (userId: string, input: ReturnType<typeof validateTestimonialSubmission>) => {
      const key = `${userId}:${input.requestId}`
      const existing = stored.get(key)
      if (existing) return { id: existing.id, status: 'pending' as const, submittedAt: 'now', created: false }
      inserts += 1
      stored.set(key, { id: 'testimonial-1', input })
      return { id: 'testimonial-1', status: 'pending' as const, submittedAt: 'now', created: true }
    },
    notify: async () => 'already_processed' as const,
  }
  const first = await handleTestimonialSubmission('Bearer valid-token', validInput(), dependencies)
  const second = await handleTestimonialSubmission('Bearer valid-token', validInput(), dependencies)
  assert.equal(inserts, 1)
  assert.equal(first.testimonial_id, second.testimonial_id)
  assert.equal(second.testimonialCreated, false)
})

test('authenticated status lookup returns only the latest submission summary', async () => {
  const response = await handleTestimonialStatusRequest('Bearer valid-token', {
    authenticate: async token => token === 'valid-token' ? { id: 'server-auth-user' } : null,
    loadLatest: async userId => {
      assert.equal(userId, 'server-auth-user')
      return { status: 'pending', submittedAt: '2026-08-22T12:00:00Z' }
    },
  })
  assert.deepEqual(response, { hasSubmitted: true, status: 'pending', submittedAt: '2026-08-22T12:00:00Z' })
  assert.deepEqual(Object.keys(response), ['hasSubmitted', 'status', 'submittedAt'])
})

test('status lookup rejects anonymous users and reports no submission safely', async () => {
  await assert.rejects(() => handleTestimonialStatusRequest('', {
    authenticate: async () => null,
    loadLatest: async () => null,
  }), (error: unknown) => error instanceof TestimonialRequestError && error.status === 401)
  const response = await handleTestimonialStatusRequest('Bearer valid-token', {
    authenticate: async () => ({ id: 'server-auth-user' }),
    loadLatest: async () => null,
  })
  assert.deepEqual(response, { hasSubmitted: false, status: null, submittedAt: null })
})

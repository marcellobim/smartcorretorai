import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  TESTIMONIAL_BODY_MAX_LENGTH,
  TESTIMONIAL_PROFESSION_MAX_LENGTH,
  TestimonialFormError,
  buildTestimonialPayload,
  canShowTestimonialInvite,
  validateTestimonialForm,
} from '../src/components/testimonials/testimonial-invite-runtime.js'

const component = readFileSync(new URL('../src/components/testimonials/TestimonialInvite.jsx', import.meta.url), 'utf8')
const campaignPackage = readFileSync(new URL('../src/components/campaign/CampaignPackage.jsx', import.meta.url), 'utf8')
const testimonialApi = readFileSync(new URL('../../supabase/functions/testimonial-api/index.ts', import.meta.url), 'utf8')

const valid = overrides => ({
  body: 'O SmartCorretorAI agilizou minha rotina.',
  professionLabel: 'Corretora de imóveis',
  publicationConsent: false,
  attributionConsent: false,
  ...overrides,
})

test('form validation follows backend limits and requires testimonial body', () => {
  assert.equal(TESTIMONIAL_BODY_MAX_LENGTH, 3000)
  assert.equal(TESTIMONIAL_PROFESSION_MAX_LENGTH, 120)
  assert.throws(() => validateTestimonialForm(valid({ body: '   ' })), TestimonialFormError)
  assert.throws(() => validateTestimonialForm(valid({ body: 'x'.repeat(3001) })), TestimonialFormError)
  assert.throws(() => validateTestimonialForm(valid({ professionLabel: 'x'.repeat(121) })), TestimonialFormError)
  assert.equal(validateTestimonialForm(valid({ professionLabel: '  ' })).professionLabel, null)
})

test('consents remain independent in the exact sanitized payload', () => {
  const requestId = '11111111-1111-4111-8111-111111111111'
  for (const publicationConsent of [false, true]) {
    for (const attributionConsent of [false, true]) {
      const payload = buildTestimonialPayload(valid({ publicationConsent, attributionConsent }), requestId)
      assert.equal(payload.publication_consent, publicationConsent)
      assert.equal(payload.attribution_consent, attributionConsent)
      assert.deepEqual(Object.keys(payload), [
        'body', 'profession_label', 'publication_consent', 'attribution_consent', 'requestId',
      ])
      assert.equal(JSON.stringify(payload).includes('user_id'), false)
      assert.equal(JSON.stringify(payload).includes('amount'), false)
      assert.equal(JSON.stringify(payload).includes('status'), false)
      assert.equal(payload.requestId, requestId)
    }
  }
})

test('eligibility requires authentication and a successful server status without prior submission', () => {
  assert.equal(canShowTestimonialInvite({ isAuthenticated: true, dismissed: false, statusLoaded: true, hasSubmitted: false }), true)
  assert.equal(canShowTestimonialInvite({ isAuthenticated: false, dismissed: false, statusLoaded: true, hasSubmitted: false }), false)
  assert.equal(canShowTestimonialInvite({ isAuthenticated: true, dismissed: false, statusLoaded: false, hasSubmitted: false }), false)
  assert.equal(canShowTestimonialInvite({ isAuthenticated: true, dismissed: false, statusLoaded: true, hasSubmitted: true }), false)
  assert.equal(canShowTestimonialInvite({ isAuthenticated: true, dismissed: true, statusLoaded: true, hasSubmitted: false }), false)
})

test('invite sits after completed CampaignPackage content and does not replace downloads', () => {
  assert.match(campaignPackage, /<TestimonialInvite \/>/)
  assert.match(campaignPackage, /downloadFileFromPrivateUrl/)
  assert.match(campaignPackage, /<TestimonialInvite \/>[\s\S]*onCreateNew/)
  assert.doesNotMatch(component, /onCreateNew|downloadFileFromPrivateUrl/)
})

test('component queries server eligibility, suppresses only in memory and blocks duplicate sending', () => {
  assert.match(component, /body: \{ action: 'status' \}/)
  assert.match(testimonialApi, /handleTestimonialStatusRequest/)
  assert.match(component, /const dismissedInviteUsers = new Set\(\)/)
  assert.doesNotMatch(component, /localStorage|sessionStorage/)
  assert.match(component, /if \(submissionState === 'sending'\) return/)
  assert.match(component, /setRequestId\(current => current \|\| crypto\.randomUUID\(\)\)/)
})

test('success ignores notification delivery state and errors expose only fixed copy', () => {
  assert.match(component, /!data\?\.testimonial_id/)
  assert.doesNotMatch(component, /notificationSent/)
  assert.match(component, /Depoimento recebido/)
  assert.match(component, /Não foi possível enviar seu depoimento agora\. Tente novamente\./)
  assert.doesNotMatch(component, /data\?\.error\.message|error\.context|error\.stack|RESEND/)
})

test('copy is neutral and modal uses responsive scrolling without ratings', () => {
  assert.match(component, /O bônus não depende de avaliação positiva/)
  assert.match(component, /max-h-\[72vh\] overflow-y-auto/)
  assert.doesNotMatch(component, /estrela|rating|NPS|5 estrelas/i)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8')
const adminApi = readFileSync(new URL('../../supabase/functions/admin-api/index.ts', import.meta.url), 'utf8')

test('existing Admin gains one testimonials area with canonical status filters', () => {
  assert.match(dashboard, /\['testimonials', 'Depoimentos'\]/)
  for (const status of ['pending', 'approved', 'published', 'rejected']) {
    assert.match(dashboard, new RegExp(`\\['${status}',`))
  }
  assert.match(dashboard, /adminRequest\('list_testimonials'/)
  assert.match(dashboard, /adminRequest\('get_testimonial'/)
})

test('testimonial list and detail show consent, audit and bonus without technical ids', () => {
  assert.match(dashboard, /publicationConsent/)
  assert.match(dashboard, /attributionConsent/)
  assert.match(dashboard, /approvedAt/)
  assert.match(dashboard, /rejectedAt/)
  assert.match(dashboard, /publishedAt/)
  assert.match(dashboard, /adjustment\.amount/)
  assert.doesNotMatch(dashboard, /bonus_adjustment_id|approved_by|rejected_by|published_by/)
})

test('economic button sends no amount, balance or user id from the browser', () => {
  const start = dashboard.indexOf('const approveWithBonus')
  const end = dashboard.indexOf('\n  const periodLabel', start)
  const handler = dashboard.slice(start, end)
  assert.match(handler, /adminRequest\('approve_testimonial_and_grant_bonus'/)
  assert.match(handler, /testimonialId: testimonialDetail\.id/)
  assert.match(handler, /requestId: crypto\.randomUUID\(\)/)
  assert.doesNotMatch(handler, /amount|userId|smartTokenBalance:/)
  assert.match(dashboard, /Conceder 500 Smart Tokens para esta conta\?/)
})

test('approval, rejection and publication use only protected admin actions', () => {
  for (const action of ['approve_testimonial', 'reject_testimonial', 'publish_testimonial']) {
    assert.match(dashboard, new RegExp(`'${action}'`))
    assert.match(adminApi, new RegExp(`action === '${action}'`))
  }
  assert.match(dashboard, /reason: rejectionReason/)
  assert.match(dashboard, /testimonialDetail\.publicationConsent/)
})

test('bonus reuse and notification failure are non-economic UI outcomes', () => {
  assert.match(dashboard, /result\.result === 'bonus_already_granted'/)
  assert.match(dashboard, /Esta conta já recebeu o bônus da campanha/)
  assert.match(dashboard, /Crédito confirmado; a notificação por e-mail falhou ou já foi processada/)
})

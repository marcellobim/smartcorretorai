import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRODUCT_METRIC_DEFINITIONS,
  AdminInputError,
  adminPlanLabel,
  finalizeProductMetrics,
  normalizeAdminPeriod,
  profilePlanValues,
  publicAdminAdjustment,
  publicAdminClient,
  publicCreditLot,
  sanitizeAdminSearch,
  theoreticalMonthlyBrlCents,
  validateAdminCreditInput,
  executeTestimonialBonus,
  validateTestimonialBonusInput,
} from './runtime.ts'

test('Admin plan mapping uses the current commercial labels', () => {
  assert.equal(adminPlanLabel('free'), 'FREE')
  assert.equal(adminPlanLabel('starter'), 'FREE')
  assert.equal(adminPlanLabel('start'), 'START')
  assert.equal(adminPlanLabel('pro'), 'PRO')
  assert.equal(adminPlanLabel('imobiliaria'), 'ELITE')
  assert.equal(adminPlanLabel('elite'), 'ELITE')
  assert.equal(adminPlanLabel('enterprise'), 'ELITE')
  assert.deepEqual(profilePlanValues('elite'), ['imobiliaria', 'elite', 'enterprise'])
})

test('period and search inputs are bounded before reaching PostgREST filters', () => {
  assert.equal(normalizeAdminPeriod(7), 7)
  assert.equal(normalizeAdminPeriod('30'), 30)
  assert.equal(normalizeAdminPeriod('unexpected'), 30)
  assert.equal(sanitizeAdminSearch(" nome,_%('teste') "), 'nome teste')
  assert.equal(sanitizeAdminSearch('a'.repeat(100)).length, 80)
})

test('product metrics are derived from persisted counts and canonical ST costs', () => {
  const metrics = finalizeProductMetrics([
    { key: 'text', label: 'Campanha de Textos', total: 4, success: 3, failures: 1, smartTokensConsumed: 75 },
    { key: 'video', label: 'Vídeo Imobiliário', total: 2, success: 1, failures: 1, smartTokensConsumed: 325 },
    { key: 'quick', label: 'Banners Rápidos', total: 1, success: 1, failures: 0, smartTokensConsumed: null },
  ])
  assert.equal(metrics[0].key, 'text')
  assert.equal(metrics[0].smartTokensConsumed, 75)
  assert.equal(metrics[0].participationPercent, 57.1)
  assert.equal(metrics[1].smartTokensConsumed, 325)
  assert.equal(metrics[2].smartTokensConsumed, null)
  const officialModules = Object.fromEntries(PRODUCT_METRIC_DEFINITIONS.filter(item => item.modules).map(item => [item.key, item.modules?.map(module => module.label)]))
  assert.deepEqual(officialModules.video_imobiliario, ['Fotos em Movimento', 'Legendas na Tela', 'Narração Profissional', 'Corretor Virtual IA', 'Short Videos'])
  assert.deepEqual(officialModules.studio_ia, ['Comercial Imobiliário', 'Vídeo Criativo', 'Carrossel de Anúncios'])
  assert.deepEqual(officialModules.virtual_space, ['Virtual Staging', 'Vida no Imóvel', 'Apresentação pelo Corretor'])
  assert.equal(PRODUCT_METRIC_DEFINITIONS.find(item => item.key === 'banner_imobiliario')?.modules, undefined)
  assert.equal(PRODUCT_METRIC_DEFINITIONS.find(item => item.key === 'banners_rapidos')?.modules, undefined)
  assert.equal(PRODUCT_METRIC_DEFINITIONS.find(item => item.key === 'campanha_textos')?.modules, undefined)
  assert.equal(JSON.stringify(PRODUCT_METRIC_DEFINITIONS).includes('Google Ads'), false)
})

test('ambiguous module history is explicitly marked and does not receive invented ST attribution', () => {
  const video = PRODUCT_METRIC_DEFINITIONS.find(item => item.key === 'video_imobiliario')
  const captions = video?.modules?.find(item => item.key === 'captions')
  const presenter = video?.modules?.find(item => item.key === 'virtual_broker')
  assert.equal(captions?.historicalCoverage, 'new_only')
  assert.equal(presenter?.historicalCoverage, 'new_only')
  assert.equal(captions?.sources[0].tokenColumn, undefined)
  assert.equal(presenter?.sources[0].tokenColumn, undefined)
})

test('theoretical monthly value is explicit catalog math, not real revenue', () => {
  assert.equal(theoreticalMonthlyBrlCents({ start: 1, pro: 1, elite: 1 }), 89_100)
})

test('client response exposes only the operational allowlist', () => {
  const client = publicAdminClient({
    id: 'user-id', nome: 'Cliente', email: 'cliente@example.test', plano: 'imobiliaria',
    saldo_creditos: 2_000, created_at: '2026-08-20T00:00:00Z',
    stripe_customer_id: 'cus_private', role: 'admin', senha_hash: 'private',
    subscriptions: [{ status: 'ativo', current_period_end: '2026-09-20T00:00:00Z', stripe_customer_id: 'cus_private' }],
  }, { subscription_granted: 6350, purchase_granted: 2000, purchase_count: 1, purchase_catalog_cents: 4990 }, { generations: 3, failures: 1, last_generation_at: '2026-08-20T01:00:00Z' })
  assert.deepEqual(Object.keys(client), [
    'id', 'name', 'email', 'plan', 'subscriptionStatus', 'smartTokenBalance',
    'createdAt', 'currentPeriodEnd', 'hasStripeCustomer', 'subscriptionGranted',
    'purchaseGranted', 'adminGranted', 'purchaseRemaining', 'rechargeCount',
    'rechargeCatalogCents', 'totalGenerations', 'failedGenerations', 'lastGenerationAt',
  ])
  assert.equal(client.plan, 'ELITE')
  assert.equal(client.smartTokenBalance, 2_000)
  assert.equal(client.hasStripeCustomer, true)
  assert.equal(client.subscriptionGranted, 6350)
  assert.equal(client.purchaseGranted, 2000)
  assert.equal(client.totalGenerations, 3)
  assert.equal(JSON.stringify(client).includes('cus_private'), false)
  assert.equal(JSON.stringify(client).includes('senha_hash'), false)
})

test('admin credit input is strictly bounded and requires an auditable reason', () => {
  const valid = validateAdminCreditInput({
    userId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
    amount: 500,
    reason: 'Compensação por falha confirmada',
  })
  assert.equal(valid.amount, 500)
  assert.equal(validateAdminCreditInput({ ...valid, amount: 1 }).amount, 1)
  assert.equal(validateAdminCreditInput({ ...valid, amount: 10_000 }).amount, 10_000)
  assert.throws(() => validateAdminCreditInput({ ...valid, amount: 0 }), AdminInputError)
  assert.throws(() => validateAdminCreditInput({ ...valid, amount: 10_001 }), AdminInputError)
  assert.throws(() => validateAdminCreditInput({ ...valid, reason: 'curto' }), AdminInputError)
  assert.throws(() => validateAdminCreditInput({ ...valid, userId: 'invalid' }), AdminInputError)
})

test('lot and audit responses expose only operational fields', () => {
  const lot = publicCreditLot({ id: 'lot', source: 'admin', original_amount: 500, remaining_amount: 500, status: 'active', created_at: 'now', metadata: { secret: true } })
  const adjustment = publicAdminAdjustment({ id: 'adj', amount: 500, reason: 'Motivo suficiente', created_at: 'now', admin_user_id: 'admin', idempotency_key: 'private' }, { nome: 'Suporte', email: 'suporte@example.test' })
  assert.equal(JSON.stringify(lot).includes('secret'), false)
  assert.equal(lot.source, 'admin')
  assert.equal(lot.expiresAt, null)
  assert.equal(JSON.stringify(adjustment).includes('idempotency_key'), false)
})

test('missing optional admin migration metrics remain unavailable instead of becoming fake zeros', () => {
  const client = publicAdminClient({
    id: 'user-id', nome: 'Cliente', email: 'cliente@example.test', plano: 'free',
    saldo_creditos: 0, created_at: '2026-08-20T00:00:00Z', subscriptions: [],
  })
  assert.equal(client.subscriptionGranted, null)
  assert.equal(client.purchaseGranted, null)
  assert.equal(client.totalGenerations, null)
})

test('testimonial bonus input accepts only valid operation identifiers', () => {
  const valid = validateTestimonialBonusInput({
    testimonialId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
  })
  assert.equal(valid.testimonialId, '11111111-1111-4111-8111-111111111111')
  assert.throws(() => validateTestimonialBonusInput({ ...valid, testimonialId: 'invalid' }), AdminInputError)
  assert.throws(() => validateTestimonialBonusInput({ ...valid, requestId: 'invalid' }), AdminInputError)
})

test('testimonial bonus email runs only after confirmed economic success', async () => {
  const events: string[] = []
  const response = await executeTestimonialBonus({
    testimonialId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
  }, '33333333-3333-4333-8333-333333333333', {
    grant: async () => {
      events.push('grant')
      return {
        result: 'created', testimonial_id: '11111111-1111-4111-8111-111111111111',
        adjustment_id: 'adjustment-1', saldo_creditos: 1500,
      }
    },
    loadTestimonial: async () => {
      events.push('confirm')
      return { userId: 'auth-user-1', bonusAdjustmentId: 'adjustment-1' }
    },
    notify: async input => {
      events.push('notify')
      assert.equal(input.smartTokenBalance, 1500)
      return 'sent'
    },
  })
  assert.deepEqual(events, ['grant', 'confirm', 'notify'])
  assert.equal(response.notificationSent, true)
  assert.equal(response.smartTokenBalance, 1500)
})

test('failed economic operation never attempts bonus email', async () => {
  let notified = false
  await assert.rejects(() => executeTestimonialBonus({
    testimonialId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
  }, '33333333-3333-4333-8333-333333333333', {
    grant: async () => { throw new Error('economic failure') },
    loadTestimonial: async () => { throw new Error('unexpected') },
    notify: async () => { notified = true; return 'sent' },
  }), /economic failure/)
  assert.equal(notified, false)
})

test('email failure leaves confirmed bonus result successful', async () => {
  let grants = 0
  const dependencies = {
    grant: async () => {
      grants += 1
      return {
        result: grants === 1 ? 'created' : 'already_processed',
        testimonial_id: '11111111-1111-4111-8111-111111111111',
        adjustment_id: 'adjustment-1', saldo_creditos: 500,
      }
    },
    loadTestimonial: async () => ({ userId: 'auth-user-1', bonusAdjustmentId: 'adjustment-1' }),
    notify: async () => 'failed' as const,
  }
  const input = {
    testimonialId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
  }
  const first = await executeTestimonialBonus(input, '33333333-3333-4333-8333-333333333333', dependencies)
  const repeated = await executeTestimonialBonus(input, '33333333-3333-4333-8333-333333333333', dependencies)
  assert.equal(first.result, 'created')
  assert.equal(repeated.result, 'already_processed')
  assert.equal(first.smartTokenBalance, 500)
  assert.equal(first.notificationSent, false)
  assert.equal(grants, 2)
})

test('a different testimonial with an account bonus does not send another email', async () => {
  let notified = false
  const response = await executeTestimonialBonus({
    testimonialId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
  }, '33333333-3333-4333-8333-333333333333', {
    grant: async () => ({ result: 'bonus_already_granted', saldo_creditos: 500 }),
    loadTestimonial: async () => { throw new Error('unexpected') },
    notify: async () => { notified = true; return 'sent' },
  })
  assert.equal(response.result, 'bonus_already_granted')
  assert.equal(response.notificationSent, false)
  assert.equal(notified, false)
})

export const ADMIN_PERIODS = Object.freeze([7, 30, 0] as const)

export type AdminPeriod = typeof ADMIN_PERIODS[number]

export type ProductMetricDefinition = Readonly<{
  key: string
  label: string
  sources: readonly ProductMetricSource[]
  modules?: readonly ProductModuleMetricDefinition[]
}>

export type ProductMetricSource = Readonly<{
  table: string
  filters?: readonly Readonly<{ column: string; value: string | readonly string[] }>[]
  includedStatuses: readonly string[]
  successStatus: string
  failureStatus: string
  tokenColumn?: string
  tokenTable?: string
  tokenFilters?: readonly Readonly<{ column: string; value: string | readonly string[] }>[]
  tokenPerSuccess?: number
  provider?: string
  model?: string
  providerColumn?: string
  modelColumn?: string
}>

export type ProductModuleMetricDefinition = Readonly<{
  key: string
  label: string
  sources: readonly ProductMetricSource[]
  historicalCoverage: 'complete' | 'partial' | 'new_only'
}>

const source = (value: ProductMetricSource) => Object.freeze(value)
const module = (value: ProductModuleMetricDefinition) => Object.freeze(value)

const gemini = (productCode: string, extraFilters: ProductMetricSource['filters'] = [], tokenColumn: string | null = 'smart_tokens_consumed') => source({
  table: 'gemini_video_economy_requests',
  filters: [{ column: 'product_code', value: productCode }, ...extraFilters],
  includedStatuses: ['processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed',
  tokenColumn: tokenColumn ?? undefined, provider: 'Google', model: 'gemini-omni-flash-preview', providerColumn: 'provider', modelColumn: 'model',
})

const veo = (productCode: string) => source({
  table: 'veo_video_economy_requests',
  filters: [{ column: 'product_code', value: productCode }, { column: 'admin_bypass', value: 'false' }],
  includedStatuses: ['processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed',
  tokenColumn: 'smart_tokens_consumed', provider: 'Google', providerColumn: 'provider', modelColumn: 'model',
})

export const PRODUCT_METRIC_DEFINITIONS: readonly ProductMetricDefinition[] = Object.freeze([
  Object.freeze({
    key: 'video_imobiliario', label: 'Vídeo Imobiliário',
    sources: [gemini('real_estate_video'), gemini('short_videos')],
    modules: [
      module({ key: 'moving_photos', label: 'Fotos em Movimento', sources: [gemini('real_estate_video')], historicalCoverage: 'complete' }),
      module({ key: 'captions', label: 'Legendas na Tela', sources: [gemini('real_estate_video', [{ column: 'metadata->>captions', value: 'true' }], null), gemini('short_videos', [{ column: 'metadata->>captions', value: 'true' }], null)], historicalCoverage: 'new_only' }),
      module({ key: 'narration', label: 'Narração Profissional', sources: [gemini('real_estate_video', [{ column: 'metadata->>audio', value: 'true' }], null), gemini('short_videos', [{ column: 'metadata->>audio', value: 'true' }], null)], historicalCoverage: 'complete' }),
      module({ key: 'virtual_broker', label: 'Corretor Virtual IA', sources: [gemini('real_estate_video', [{ column: 'metadata->>presenter', value: 'true' }], null)], historicalCoverage: 'new_only' }),
      module({ key: 'short_videos', label: 'Short Videos', sources: [gemini('short_videos')], historicalCoverage: 'complete' }),
    ],
  }),
  Object.freeze({
    key: 'studio_ia', label: 'Studio IA',
    sources: [veo('real_estate_commercial'), veo('creative_video'), source({ table: 'smart_carousel_economy_requests', includedStatuses: ['processing', 'succeeded', 'failed'], successStatus: 'succeeded', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', provider: 'Creatomate + OpenAI', model: 'Creatomate / gpt-4.1 / tts-1' })],
    modules: [
      module({ key: 'real_estate_commercial', label: 'Comercial Imobiliário', sources: [veo('real_estate_commercial')], historicalCoverage: 'complete' }),
      module({ key: 'creative_video', label: 'Vídeo Criativo', sources: [veo('creative_video')], historicalCoverage: 'complete' }),
      module({ key: 'smart_carousel', label: 'Carrossel de Anúncios', sources: [source({ table: 'smart_carousel_economy_requests', includedStatuses: ['processing', 'succeeded', 'failed'], successStatus: 'succeeded', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', provider: 'Creatomate + OpenAI', model: 'Creatomate / gpt-4.1 / tts-1' })], historicalCoverage: 'complete' }),
    ],
  }),
  Object.freeze({
    key: 'virtual_space', label: 'Virtual Space',
    sources: [source({ table: 'virtual_staging_image_items', includedStatuses: ['pending', 'processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', provider: 'OpenAI', model: 'gpt-image-2', providerColumn: 'provider', modelColumn: 'model' }), gemini('life_in_property'), gemini('broker_presentation')],
    modules: [
      module({ key: 'virtual_staging', label: 'Virtual Staging', sources: [source({ table: 'virtual_staging_image_items', includedStatuses: ['pending', 'processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', provider: 'OpenAI', model: 'gpt-image-2', providerColumn: 'provider', modelColumn: 'model' })], historicalCoverage: 'new_only' }),
      module({ key: 'life_in_property', label: 'Vida no Imóvel', sources: [gemini('life_in_property')], historicalCoverage: 'complete' }),
      module({ key: 'broker_presentation', label: 'Apresentação pelo Corretor', sources: [gemini('broker_presentation')], historicalCoverage: 'complete' }),
    ],
  }),
  Object.freeze({
    key: 'banner_imobiliario', label: 'Banner Imobiliário', sources: [source({ table: 'real_estate_banner_items', includedStatuses: ['pending', 'processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', tokenTable: 'real_estate_banner_requests', provider: 'OpenAI', modelColumn: 'provider_model' })],
  }),
  Object.freeze({
    key: 'banners_rapidos', label: 'Banners Rápidos', sources: [source({ table: 'quick_banner_delivery_items', includedStatuses: ['pending', 'rendering', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed', tokenColumn: 'smart_tokens_consumed', tokenTable: 'quick_banner_delivery_requests', provider: 'Creatomate' })],
  }),
  Object.freeze({
    key: 'campanha_textos', label: 'Campanha de Textos', sources: [source({ table: 'text_campaign_delivery_requests', includedStatuses: ['processing', 'completed', 'failed'], successStatus: 'completed', failureStatus: 'failed', tokenPerSuccess: 25, provider: 'OpenAI', model: 'gpt-4.1' })],
  }),
])

export function normalizeAdminPeriod(value: unknown): AdminPeriod {
  const parsed = Number(value)
  return ADMIN_PERIODS.includes(parsed as AdminPeriod) ? parsed as AdminPeriod : 30
}

export function periodStartIso(period: AdminPeriod, now = new Date()) {
  if (period === 0) return null
  return new Date(now.getTime() - period * 86_400_000).toISOString()
}

export function adminPlanLabel(value: unknown) {
  const plan = String(value ?? '').trim().toLowerCase()
  if (plan === 'start') return 'START'
  if (plan === 'pro') return 'PRO'
  if (plan === 'imobiliaria' || plan === 'elite' || plan === 'enterprise') return 'ELITE'
  return 'FREE'
}

export function profilePlanValues(filter: unknown): readonly string[] | null {
  const normalized = String(filter ?? '').trim().toLowerCase()
  if (normalized === 'free') return ['free', 'starter']
  if (normalized === 'start') return ['start']
  if (normalized === 'pro') return ['pro']
  if (normalized === 'elite') return ['imobiliaria', 'elite', 'enterprise']
  return null
}

export function sanitizeAdminSearch(value: unknown) {
  return String(value ?? '')
    .trim()
    .slice(0, 80)
    .replace(/[,%_()."']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type RawProductMetric = Readonly<{
  key: string
  label: string
  total: number
  success: number
  failures: number
  smartTokensConsumed: number | null
  modules?: readonly RawProductMetric[]
  providers?: readonly string[]
  models?: readonly string[]
  historicalCoverage?: string
}>

export function finalizeProductMetrics(rows: readonly RawProductMetric[]) {
  const totalUsage = rows.reduce((sum, row) => sum + row.total, 0)
  return rows
    .map(row => Object.freeze({
      key: row.key,
      label: row.label,
      generations: row.total,
      success: row.success,
      failures: row.failures,
      smartTokensConsumed: row.smartTokensConsumed,
      participationPercent: totalUsage > 0 ? Number(((row.total / totalUsage) * 100).toFixed(1)) : 0,
      providers: row.providers ?? [], models: row.models ?? [], historicalCoverage: row.historicalCoverage ?? 'complete',
      modules: (row.modules ?? []).map(item => Object.freeze({
        key: item.key, label: item.label, generations: item.total, success: item.success, failures: item.failures,
        smartTokensConsumed: item.smartTokensConsumed, providers: item.providers ?? [], models: item.models ?? [],
        historicalCoverage: item.historicalCoverage ?? 'complete',
        participationPercent: row.total > 0 ? Number(((item.total / row.total) * 100).toFixed(1)) : 0,
      })),
    }))
    .sort((a, b) => b.generations - a.generations || a.label.localeCompare(b.label, 'pt-BR'))
}

export function theoreticalMonthlyBrlCents(activeByPlan: Readonly<Record<string, number>>) {
  return (activeByPlan.start ?? 0) * 12_700
    + (activeByPlan.pro ?? 0) * 21_700
    + (activeByPlan.elite ?? 0) * 54_700
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const TESTIMONIAL_ADMIN_STATUSES = Object.freeze(['pending', 'approved', 'published', 'rejected'] as const)

export class AdminInputError extends Error {}

export function validateAdminCreditInput(input: Record<string, unknown>) {
  const userId = String(input.userId ?? '').trim()
  const requestId = String(input.requestId ?? '').trim()
  const amount = Number(input.amount)
  const reason = String(input.reason ?? '').trim().replace(/\s+/g, ' ')
  if (!UUID_PATTERN.test(userId)) throw new AdminInputError('Cliente inválido.')
  if (!UUID_PATTERN.test(requestId)) throw new AdminInputError('Identificador da operação inválido.')
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000) {
    throw new AdminInputError('A quantidade deve estar entre 1 e 10.000 ST.')
  }
  if (reason.length < 10 || reason.length > 500) {
    throw new AdminInputError('Informe um motivo entre 10 e 500 caracteres.')
  }
  return Object.freeze({ userId, requestId, amount, reason })
}

export function validateAdminCourtesyInput(input: Record<string, unknown>) {
  const userId = String(input.userId ?? '').trim()
  const requestId = String(input.requestId ?? '').trim()
  const active = input.active
  const reason = String(input.reason ?? '').trim().replace(/\s+/g, ' ')
  if (!UUID_PATTERN.test(userId)) throw new AdminInputError('Cliente inválido.')
  if (!UUID_PATTERN.test(requestId)) throw new AdminInputError('Identificador da operação inválido.')
  if (typeof active !== 'boolean') throw new AdminInputError('Estado de cortesia inválido.')
  if (active && (reason.length < 10 || reason.length > 500)) {
    throw new AdminInputError('Informe um motivo entre 10 e 500 caracteres.')
  }
  return Object.freeze({ userId, requestId, active, reason: active ? reason : '' })
}

export function validateTestimonialBonusInput(input: Record<string, unknown>) {
  const testimonialId = String(input.testimonialId ?? '').trim()
  const requestId = String(input.requestId ?? '').trim()
  if (!UUID_PATTERN.test(testimonialId)) throw new AdminInputError('Depoimento inválido.')
  if (!UUID_PATTERN.test(requestId)) throw new AdminInputError('Identificador da operação inválido.')
  return Object.freeze({ testimonialId, requestId })
}

export function validateTestimonialListInput(input: Record<string, unknown>) {
  const status = String(input.status ?? '').trim()
  const page = Math.max(1, Number.parseInt(String(input.page ?? '1'), 10) || 1)
  if (status && !TESTIMONIAL_ADMIN_STATUSES.includes(status as typeof TESTIMONIAL_ADMIN_STATUSES[number])) {
    throw new AdminInputError('Status de depoimento inválido.')
  }
  return Object.freeze({ status, page })
}

export function validateTestimonialIdInput(input: Record<string, unknown>) {
  const testimonialId = String(input.testimonialId ?? '').trim()
  if (!UUID_PATTERN.test(testimonialId)) throw new AdminInputError('Depoimento inválido.')
  return Object.freeze({ testimonialId })
}

export function validateTestimonialRejectionInput(input: Record<string, unknown>) {
  const { testimonialId } = validateTestimonialIdInput(input)
  const reason = typeof input.reason === 'string' ? input.reason.trim().replace(/\s+/g, ' ') : ''
  if (!reason || reason.length > 1000) throw new AdminInputError('Informe um motivo de recusa válido.')
  return Object.freeze({ testimonialId, reason })
}

export function testimonialApprovalTransition(current: Record<string, unknown>) {
  if (current.status === 'approved') return 'unchanged' as const
  if (current.status !== 'pending') throw new AdminInputError('Somente depoimentos pendentes podem ser aprovados.')
  return 'approve' as const
}

export function assertTestimonialCanBeRejected(current: Record<string, unknown>) {
  if (current.bonus_adjustment_id) throw new AdminInputError('Depoimento com bônus concedido não pode ser recusado.')
  if (!['pending', 'approved'].includes(String(current.status ?? ''))) {
    throw new AdminInputError('Este depoimento não pode ser recusado no estado atual.')
  }
}

export function testimonialPublicationTransition(current: Record<string, unknown>) {
  if (current.publication_consent !== true) throw new AdminInputError('Publicação não autorizada pelo cliente.')
  if (current.status === 'published') return 'unchanged' as const
  if (current.status !== 'approved') throw new AdminInputError('Somente depoimentos aprovados podem ser publicados.')
  return 'publish' as const
}

export function publicAdminTestimonial(
  row: Record<string, any>,
  profile: Record<string, any> = {},
  loginEmail = '',
  accountBonusGranted = false,
) {
  return Object.freeze({
    id: row.id,
    client: Object.freeze({
      name: profile.nome || 'Sem nome',
      email: loginEmail,
      plan: adminPlanLabel(profile.plano),
    }),
    excerpt: String(row.body ?? '').slice(0, 180),
    submittedAt: row.submitted_at,
    status: row.status,
    publicationConsent: row.publication_consent === true,
    attributionConsent: row.attribution_consent === true,
    bonusGranted: Boolean(row.bonus_adjustment_id) || accountBonusGranted,
    bonusLinkedToTestimonial: Boolean(row.bonus_adjustment_id),
    emailStatusAvailable: false,
  })
}

export function publicAdminTestimonialDetail(
  row: Record<string, any>,
  profile: Record<string, any> = {},
  loginEmail = '',
  audit: Readonly<{ approvedBy?: string; rejectedBy?: string; publishedBy?: string }> = {},
  adjustment: Record<string, any> | null = null,
  accountBonusGranted = false,
) {
  return Object.freeze({
    ...publicAdminTestimonial(row, profile, loginEmail, accountBonusGranted),
    body: row.body,
    professionLabel: row.profession_label ?? null,
    approvedAt: row.approved_at ?? null,
    approvedBy: audit.approvedBy ?? null,
    rejectedAt: row.rejected_at ?? null,
    rejectedBy: audit.rejectedBy ?? null,
    rejectionReason: row.rejection_reason ?? null,
    publishedAt: row.published_at ?? null,
    publishedBy: audit.publishedBy ?? null,
    adjustment: adjustment ? Object.freeze({
      amount: Number(adjustment.amount ?? 0),
      reason: adjustment.reason,
      createdAt: adjustment.created_at,
    }) : null,
    emailDeliveries: Object.freeze({ available: false, received: null, bonusGranted: null }),
  })
}

type TestimonialBonusDependencies = Readonly<{
  grant(input: Readonly<{ testimonialId: string; adminUserId: string; requestId: string }>): Promise<Record<string, unknown>>
  loadTestimonial(testimonialId: string): Promise<Readonly<{ userId: string; bonusAdjustmentId: string | null }>>
  notify(input: Readonly<{ testimonialId: string; userId: string; smartTokenBalance: number }>): Promise<'sent' | 'already_processed' | 'failed'>
}>

export async function executeTestimonialBonus(
  input: Record<string, unknown>,
  adminUserId: string,
  dependencies: TestimonialBonusDependencies,
) {
  const validated = validateTestimonialBonusInput(input)
  const economic = await dependencies.grant({ ...validated, adminUserId })
  const result = String(economic.result ?? '')
  if (!['created', 'already_processed', 'bonus_already_granted'].includes(result)) {
    throw new Error('testimonial_bonus_result_invalid')
  }
  const smartTokenBalance = Number(economic.saldo_creditos ?? 0)
  let notification: 'sent' | 'already_processed' | 'failed' | 'not_applicable' = 'not_applicable'

  if (result === 'created' || result === 'already_processed') {
    const testimonial = await dependencies.loadTestimonial(validated.testimonialId)
    if (!testimonial.bonusAdjustmentId
        || testimonial.bonusAdjustmentId !== String(economic.adjustment_id ?? '')) {
      throw new Error('testimonial_bonus_confirmation_failed')
    }
    try {
      notification = await dependencies.notify({
        testimonialId: validated.testimonialId,
        userId: testimonial.userId,
        smartTokenBalance,
      })
    } catch {
      notification = 'failed'
    }
  }

  return Object.freeze({
    result,
    testimonialId: String(economic.testimonial_id ?? validated.testimonialId),
    adjustmentId: economic.adjustment_id ?? null,
    smartTokenBalance,
    notificationSent: notification === 'sent',
  })
}

export function publicAdminClient(
  profile: Record<string, any>,
  credit: Record<string, any> = {},
  activity: Record<string, any> = {},
  courtesy: Record<string, any> = {},
  usage: Record<string, any> | null = null,
) {
  const subscriptions = Array.isArray(profile.subscriptions)
    ? profile.subscriptions
    : profile.subscriptions ? [profile.subscriptions] : []
  const subscription = subscriptions.find((item: any) => item.status === 'ativo') ?? subscriptions[0] ?? null
  const creditMetricsAvailable = Boolean(credit && Object.keys(credit).length)
  const activityMetricsAvailable = Boolean(activity && Object.keys(activity).length)
  const accountAnalyticsAvailable = usage !== null
  const courtesyActive = courtesy?.action === 'granted'
  const paidAccess = subscription?.status === 'ativo'
    || (creditMetricsAvailable && (Number(credit.subscription_granted ?? 0) > 0 || Number(credit.purchase_granted ?? 0) > 0))
  return Object.freeze({
    id: profile.id,
    name: profile.nome || '',
    email: profile.email || '',
    plan: adminPlanLabel(profile.plano),
    subscriptionStatus: subscription?.status ?? 'sem_assinatura',
    smartTokenBalance: Number(profile.saldo_creditos ?? 0),
    createdAt: profile.created_at,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    hasStripeCustomer: Boolean(profile.stripe_customer_id || subscription?.stripe_customer_id),
    subscriptionGranted: creditMetricsAvailable ? Number(credit.subscription_granted ?? 0) : null,
    purchaseGranted: creditMetricsAvailable ? Number(credit.purchase_granted ?? 0) : null,
    adminGranted: creditMetricsAvailable ? Number(credit.admin_granted ?? 0) : null,
    purchaseRemaining: creditMetricsAvailable ? Number(credit.purchase_remaining ?? 0) : null,
    rechargeCount: creditMetricsAvailable ? Number(credit.purchase_count ?? 0) : null,
    rechargeCatalogCents: !creditMetricsAvailable || credit.purchase_catalog_cents == null ? null : Number(credit.purchase_catalog_cents),
    totalGenerations: activityMetricsAvailable ? Number(activity.generations ?? 0) : null,
    failedGenerations: activityMetricsAvailable ? Number(activity.failures ?? 0) : null,
    lastGenerationAt: activityMetricsAvailable ? activity.last_generation_at ?? null : null,
    lastLoginAt: accountAnalyticsAvailable ? usage?.last_login_at ?? null : null,
    lastActivityAt: accountAnalyticsAvailable ? usage?.last_activity_at ?? null : null,
    lastProductId: accountAnalyticsAvailable ? usage?.last_product_id ?? null : null,
    productsOpened: accountAnalyticsAvailable ? Number(usage?.products_opened ?? 0) : null,
    trackingStartedAt: accountAnalyticsAvailable ? usage?.tracking_started_at ?? null : null,
    hasTracking: accountAnalyticsAvailable && usage?.has_tracking === true,
    accountAnalyticsAvailable,
    courtesyActive,
    catalogAccess: courtesyActive ? 'courtesy' : paidAccess ? 'paid' : 'trial',
  })
}

export function publicAdminActivityEvent(row: Record<string, any>) {
  return Object.freeze({
    eventType: String(row.event_type ?? ''),
    productId: row.product_id ?? null,
    stepId: row.step_id ?? null,
    occurredAt: row.occurred_at ?? null,
    source: ['generation_backend', 'auth'].includes(row.source) ? row.source : 'account_analytics',
  })
}

export function buildClientFunnel(client: Record<string, any>, timeline: readonly Record<string, any>[]) {
  const has = (eventType: string, predicate: (event: Record<string, any>) => boolean = () => true) =>
    timeline.some(event => event.eventType === eventType && predicate(event))
  const stages = [
    { id: 'registered', label: 'Cadastro', proven: Boolean(client.createdAt), occurredAt: client.createdAt ?? null },
    { id: 'login', label: 'Login', proven: Boolean(client.lastLoginAt), occurredAt: client.lastLoginAt ?? null },
    { id: 'product_opened', label: 'Produto aberto', proven: has('product_opened'), occurredAt: null },
    { id: 'flow_started', label: 'Fluxo iniciado', proven: has('flow_step_reached', event => event.stepId === 'flow_started'), occurredAt: null },
    { id: 'steps', label: 'Etapas', proven: has('flow_step_reached'), occurredAt: null },
    { id: 'review', label: 'Revisão', proven: has('flow_step_reached', event => event.stepId === 'review'), occurredAt: null },
    { id: 'generation_clicked', label: 'Gerar', proven: has('generation_clicked'), occurredAt: null },
    { id: 'generation_completed', label: 'Concluído', proven: has('generation_completed'), occurredAt: null },
  ].map(stage => {
    if (stage.occurredAt || !stage.proven) return stage
    const matching = timeline.find(event => (
      (stage.id === 'product_opened' && event.eventType === 'product_opened')
      || (stage.id === 'flow_started' && event.eventType === 'flow_step_reached' && event.stepId === 'flow_started')
      || (stage.id === 'steps' && event.eventType === 'flow_step_reached')
      || (stage.id === 'review' && event.eventType === 'flow_step_reached' && event.stepId === 'review')
      || (stage.id === 'generation_clicked' && event.eventType === 'generation_clicked')
      || (stage.id === 'generation_completed' && event.eventType === 'generation_completed')
    ))
    return { ...stage, occurredAt: matching?.occurredAt ?? null }
  })
  const maximumProven = [...stages].reverse().find(stage => stage.proven) ?? null
  return Object.freeze({ stages: Object.freeze(stages.map(Object.freeze)), maximumProven: maximumProven?.id ?? null })
}

export function publicCreditLot(lot: Record<string, any>) {
  return Object.freeze({
    id: lot.id,
    source: lot.source,
    originalAmount: Number(lot.original_amount ?? 0),
    remainingAmount: Number(lot.remaining_amount ?? 0),
    status: lot.status,
    expiresAt: lot.expires_at ?? null,
    createdAt: lot.created_at,
  })
}

export function publicAdminAdjustment(row: Record<string, any>, admin: Record<string, any> = {}) {
  return Object.freeze({
    id: row.id,
    amount: Number(row.amount ?? 0),
    reason: row.reason,
    createdAt: row.created_at,
    adminName: admin.nome || 'Administrador',
    adminEmail: admin.email || '',
  })
}

export function publicAdminCourtesyEvent(row: Record<string, any>, admin: Record<string, any> = {}) {
  return Object.freeze({
    id: row.id,
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
    adminName: admin.nome || 'Administrador',
    adminEmail: admin.email || '',
  })
}

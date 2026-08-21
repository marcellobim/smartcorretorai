import { getEconomicSku } from '../_shared/economic-catalog.ts'

export const ADMIN_PERIODS = Object.freeze([7, 30, 0] as const)

export type AdminPeriod = typeof ADMIN_PERIODS[number]

export type ProductMetricDefinition = Readonly<{
  key: string
  label: string
  table: string
  productCodes?: readonly string[]
  includedStatuses: readonly string[]
  successStatus: string
  failureStatus: string
  smartTokensPerSuccess: number
  billableFilter?: Readonly<{ column: string; value: string }>
  tokenConsumptionAvailable?: boolean
}>

export const PRODUCT_METRIC_DEFINITIONS: readonly ProductMetricDefinition[] = Object.freeze([
  Object.freeze({
    key: 'video_imobiliario', label: 'Vídeo Imobiliário', table: 'gemini_video_economy_requests',
    productCodes: ['real_estate_video'], includedStatuses: ['processing', 'completed', 'failed'],
    successStatus: 'completed', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('real_estate_video', 'standard').smartTokenCost,
  }),
  Object.freeze({
    key: 'studio_ia', label: 'Studio IA', table: 'veo_video_economy_requests',
    productCodes: ['real_estate_commercial', 'creative_video'], includedStatuses: ['processing', 'completed', 'failed'],
    successStatus: 'completed', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('real_estate_commercial', 'standard').smartTokenCost,
    billableFilter: { column: 'admin_bypass', value: 'false' },
  }),
  Object.freeze({
    key: 'banner_imobiliario', label: 'Banner Imobiliário', table: 'real_estate_banner_items',
    includedStatuses: ['pending', 'processing', 'completed', 'failed'],
    successStatus: 'completed', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('real_estate_banner', 'item').smartTokenCost,
  }),
  Object.freeze({
    key: 'banners_rapidos', label: 'Banners Rápidos', table: 'quick_banner_delivery_items',
    includedStatuses: ['pending', 'rendering', 'completed', 'failed'],
    successStatus: 'completed', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('quick_banners', 'item').smartTokenCost,
    tokenConsumptionAvailable: false,
  }),
  Object.freeze({
    key: 'campanha_textos', label: 'Campanha de Textos', table: 'text_campaign_delivery_requests',
    includedStatuses: ['processing', 'completed', 'failed'],
    successStatus: 'completed', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('text_campaign', 'standard').smartTokenCost,
  }),
  Object.freeze({
    key: 'smart_carrossel', label: 'Smart Carrossel', table: 'smart_carousel_economy_requests',
    includedStatuses: ['processing', 'succeeded', 'failed'],
    successStatus: 'succeeded', failureStatus: 'failed', smartTokensPerSuccess: getEconomicSku('smart_carousel', 'standard').smartTokenCost,
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
    }))
    .sort((a, b) => b.generations - a.generations || a.label.localeCompare(b.label, 'pt-BR'))
}

export function theoreticalMonthlyBrlCents(activeByPlan: Readonly<Record<string, number>>) {
  return (activeByPlan.start ?? 0) * 12_700
    + (activeByPlan.pro ?? 0) * 21_700
    + (activeByPlan.elite ?? 0) * 54_700
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

export function publicAdminClient(profile: Record<string, any>, credit: Record<string, any> = {}, activity: Record<string, any> = {}) {
  const subscriptions = Array.isArray(profile.subscriptions)
    ? profile.subscriptions
    : profile.subscriptions ? [profile.subscriptions] : []
  const subscription = subscriptions.find((item: any) => item.status === 'ativo') ?? subscriptions[0] ?? null
  const creditMetricsAvailable = Boolean(credit && Object.keys(credit).length)
  const activityMetricsAvailable = Boolean(activity && Object.keys(activity).length)
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
  })
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

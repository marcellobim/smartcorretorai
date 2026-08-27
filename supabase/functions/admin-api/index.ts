import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveSupabaseAdminCredential } from '../_shared/supabase-admin-credential.ts'
import {
  AdminAuthorizationError,
  AdminMfaRequiredError,
  requireAdminAal2,
  requireAuthorizedAdmin,
} from '../_shared/admin-authorization.ts'
import { deliverTestimonialEmail } from '../_shared/testimonial-email.ts'
import {
  AdminInputError,
  PRODUCT_METRIC_DEFINITIONS,
  finalizeProductMetrics,
  normalizeAdminPeriod,
  periodStartIso,
  profilePlanValues,
  publicAdminAdjustment,
  publicAdminClient,
  publicAdminCourtesyEvent,
  publicCreditLot,
  sanitizeAdminSearch,
  theoreticalMonthlyBrlCents,
  validateAdminCreditInput,
  validateAdminCourtesyInput,
  executeTestimonialBonus,
  publicAdminTestimonial,
  publicAdminTestimonialDetail,
  validateTestimonialIdInput,
  validateTestimonialListInput,
  validateTestimonialRejectionInput,
  assertTestimonialCanBeRejected,
  testimonialApprovalTransition,
  testimonialPublicationTransition,
} from './runtime.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUBSCRIPTION_STATUSES = new Set(['ativo', 'pausado', 'cancelado'])
const CLIENT_PAGE_SIZE = 25
const TESTIMONIAL_PAGE_SIZE = 25
const TESTIMONIAL_FIELDS = 'id,user_id,body,profession_label,publication_consent,attribution_consent,status,submitted_at,approved_at,approved_by,rejected_at,rejected_by,rejection_reason,published_at,published_by,bonus_adjustment_id'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error('Configuracao administrativa indisponivel.')
  return value
}

type Filter = Readonly<{
  column: string
  operator: 'eq' | 'in'
  value: string | readonly string[]
}>

function applyFilters(query: any, filters: readonly Filter[], since: string | null) {
  let filtered = query
  for (const filter of filters) {
    filtered = filter.operator === 'in'
      ? filtered.in(filter.column, filter.value as readonly string[])
      : filtered.eq(filter.column, filter.value)
  }
  if (since) filtered = filtered.gte('created_at', since)
  return filtered
}

async function countRows(
  supabase: any,
  table: string,
  filters: readonly Filter[] = [],
  since: string | null = null,
) {
  const query = applyFilters(
    supabase.from(table).select('id', { count: 'exact', head: true }),
    filters,
    since,
  )
  const { count, error } = await query
  if (error) throw new Error(`Falha ao agregar ${table}.`)
  return Number(count ?? 0)
}

async function sumRows(supabase: any, table: string, column: string, filters: readonly Filter[], since: string | null) {
  let total = 0
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const query = applyFilters(supabase.from(table).select(column).range(from, from + pageSize - 1), filters, since)
    const { data, error } = await query
    if (error) throw new Error(`Falha ao somar ${table}.`)
    const rows = Array.isArray(data) ? data : []
    total += rows.reduce((sum, row) => sum + Number(row?.[column] ?? 0), 0)
    if (rows.length < pageSize) return total
  }
}

async function distinctValues(supabase: any, table: string, columns: readonly string[], filters: readonly Filter[], since: string | null) {
  if (!columns.length) return {} as Record<string, string[]>
  const values = Object.fromEntries(columns.map(column => [column, new Set<string>()])) as Record<string, Set<string>>
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const query = applyFilters(supabase.from(table).select(columns.join(',')).range(from, from + pageSize - 1), filters, since)
    const { data, error } = await query
    if (error) throw new Error(`Falha ao identificar provider/modelo de ${table}.`)
    const rows = Array.isArray(data) ? data : []
    for (const row of rows) for (const column of columns) {
      const value = String(row?.[column] ?? '').trim()
      if (value) values[column].add(value)
    }
    if (rows.length < pageSize) return Object.fromEntries(columns.map(column => [column, [...values[column]].sort()]))
  }
}

async function rpcData(supabase: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(`Falha ao agregar ${name}.`)
  return data
}

function isPendingAdminSchemaError(error: any) {
  return ['42883', '42P01', 'PGRST202', 'PGRST205'].includes(String(error?.code ?? ''))
}

async function optionalRpcData(supabase: any, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args)
  if (!error) return data
  if (isPendingAdminSchemaError(error)) return null
  throw new Error(`Falha ao agregar ${name}.`)
}

async function loadCourtesyEvents(supabase: any, userIds: readonly string[], limit = 100) {
  if (!userIds.length) return { available: true, rows: [] as any[] }
  const { data, error } = await supabase
    .from('admin_catalog_access_events')
    .select('id,user_id,admin_user_id,action,reason,created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (!error) return { available: true, rows: data ?? [] }
  if (isPendingAdminSchemaError(error)) return { available: false, rows: [] as any[] }
  throw new Error('Falha ao carregar acessos de cortesia.')
}

async function loadCourtesyStates(supabase: any, userIds: readonly string[]) {
  if (!userIds.length) return []
  return await optionalRpcData(supabase, 'admin_catalog_access_state', { p_user_ids: userIds }) ?? []
}

async function loadCreditOverview(supabase: any, since: string | null) {
  const aggregated = await optionalRpcData(supabase, 'admin_credit_overview', { p_since: since })
  if (aggregated) return { ...aggregated, schemaAvailable: true }

  const [purchaseLots, purchase2000, purchase4000, subscriptionLots] = await Promise.all([
    countRows(supabase, 'credit_lots', [{ column: 'source', operator: 'eq', value: 'purchase' }], since),
    countRows(supabase, 'credit_lots', [
      { column: 'source', operator: 'eq', value: 'purchase' },
      { column: 'original_amount', operator: 'eq', value: '2000' },
    ], since),
    countRows(supabase, 'credit_lots', [
      { column: 'source', operator: 'eq', value: 'purchase' },
      { column: 'original_amount', operator: 'eq', value: '4000' },
    ], since),
    countRows(supabase, 'credit_lots', [{ column: 'source', operator: 'eq', value: 'subscription' }], since),
  ])
  const recognizedPurchases = purchase2000 + purchase4000 === purchaseLots
  return {
    schemaAvailable: false,
    purchaseLots,
    purchase2000,
    purchase4000,
    subscriptionLots,
    recognizedPurchaseCatalogCents: recognizedPurchases ? purchase2000 * 4_990 + purchase4000 * 9_790 : null,
  }
}

async function loadProductMetrics(supabase: any, since: string | null) {
  const providerLabel = (value: string) => ({ google: 'Google', openai: 'OpenAI', creatomate: 'Creatomate' }[value.toLowerCase()] ?? value)
  const sourceCache = new Map<string, Promise<any>>()
  const loadSource = (source: any) => {
    const cacheKey = JSON.stringify(source)
    const cached = sourceCache.get(cacheKey)
    if (cached) return cached
    const pending = (async () => {
      const base = (source.filters ?? []).map((filter: any) => ({ column: filter.column, operator: Array.isArray(filter.value) ? 'in' : 'eq', value: filter.value })) as Filter[]
      const tokenFilters = source.tokenFilters
        ? source.tokenFilters.map((filter: any) => ({ column: filter.column, operator: Array.isArray(filter.value) ? 'in' : 'eq', value: filter.value })) as Filter[]
        : source.tokenTable && source.tokenTable !== source.table ? [] : base
      const statusFilters = [...base, { column: 'status', operator: 'in' as const, value: source.includedStatuses }]
      const [total, success, failures, consumed, identities] = await Promise.all([
        countRows(supabase, source.table, statusFilters, since),
        countRows(supabase, source.table, [...base, { column: 'status', operator: 'eq', value: source.successStatus }], since),
        countRows(supabase, source.table, [...base, { column: 'status', operator: 'eq', value: source.failureStatus }], since),
        source.tokenColumn ? sumRows(supabase, source.tokenTable ?? source.table, source.tokenColumn, tokenFilters, since) : Promise.resolve(null),
        distinctValues(supabase, source.table, [source.providerColumn, source.modelColumn].filter(Boolean), statusFilters, since),
      ])
      const recordedProviders = (identities[source.providerColumn] ?? []).map(providerLabel)
      const recordedModels = identities[source.modelColumn] ?? []
      return {
        total, success, failures, consumed: consumed ?? (source.tokenPerSuccess ? success * source.tokenPerSuccess : null),
        providers: [...new Set((recordedProviders.length ? recordedProviders : [source.provider]).filter(Boolean))],
        models: [...new Set((recordedModels.length ? recordedModels : [source.model]).filter(Boolean))],
      }
    })()
    sourceCache.set(cacheKey, pending)
    return pending
  }
  const loadSources = async (sources: readonly any[]) => {
    const rows = await Promise.all(sources.map(loadSource))
    return {
      total: rows.reduce((sum, row) => sum + row.total, 0), success: rows.reduce((sum, row) => sum + row.success, 0), failures: rows.reduce((sum, row) => sum + row.failures, 0),
      consumed: rows.some(row => row.consumed === null && row.total > 0)
        ? null
        : rows.every(row => row.consumed === null) ? null : rows.reduce((sum, row) => sum + Number(row.consumed ?? 0), 0),
      providers: [...new Set(rows.flatMap(row => row.providers))], models: [...new Set(rows.flatMap(row => row.models))],
    }
  }
  const raw = await Promise.all(PRODUCT_METRIC_DEFINITIONS.map(async definition => {
    const aggregate = await loadSources(definition.sources)
    const modules = await Promise.all((definition.modules ?? []).map(async item => {
      const metric = await loadSources(item.sources)
      return { key: item.key, label: item.label, total: metric.total, success: metric.success, failures: metric.failures, smartTokensConsumed: metric.consumed, providers: metric.providers, models: metric.models, historicalCoverage: item.historicalCoverage }
    }))
    return { key: definition.key, label: definition.label, total: aggregate.total, success: aggregate.success, failures: aggregate.failures, smartTokensConsumed: aggregate.consumed, providers: aggregate.providers, models: aggregate.models, modules }
  }))
  return finalizeProductMetrics(raw)
}

async function loadOverview(supabase: any, periodInput: unknown) {
  const period = normalizeAdminPeriod(periodInput)
  const since = periodStartIso(period)
  const productsPromise = loadProductMetrics(supabase, since)
  const creditsPromise = loadCreditOverview(supabase, since)
  const activityPromise = optionalRpcData(supabase, 'admin_generation_activity_overview', {})

  const [
    totalUsers, newUsers, freeUsers, startUsers, proUsers, eliteUsers,
    totalSubscriptions, activeSubscriptions, pausedSubscriptions, cancelledSubscriptions,
    activeStart, activePro, activeElite,
    failedEmails, failedJobs, products, credits, activity,
  ] = await Promise.all([
    countRows(supabase, 'profiles'),
    countRows(supabase, 'profiles', [], since),
    countRows(supabase, 'profiles', [{ column: 'plano', operator: 'in', value: ['free', 'starter'] }]),
    countRows(supabase, 'profiles', [{ column: 'plano', operator: 'eq', value: 'start' }]),
    countRows(supabase, 'profiles', [{ column: 'plano', operator: 'eq', value: 'pro' }]),
    countRows(supabase, 'profiles', [{ column: 'plano', operator: 'in', value: ['imobiliaria', 'elite', 'enterprise'] }]),
    countRows(supabase, 'subscriptions'),
    countRows(supabase, 'subscriptions', [{ column: 'status', operator: 'eq', value: 'ativo' }]),
    countRows(supabase, 'subscriptions', [{ column: 'status', operator: 'eq', value: 'pausado' }]),
    countRows(supabase, 'subscriptions', [{ column: 'status', operator: 'eq', value: 'cancelado' }]),
    countRows(supabase, 'subscriptions', [
      { column: 'status', operator: 'eq', value: 'ativo' },
      { column: 'plano', operator: 'eq', value: 'start' },
    ]),
    countRows(supabase, 'subscriptions', [
      { column: 'status', operator: 'eq', value: 'ativo' },
      { column: 'plano', operator: 'eq', value: 'pro' },
    ]),
    countRows(supabase, 'subscriptions', [
      { column: 'status', operator: 'eq', value: 'ativo' },
      { column: 'plano', operator: 'eq', value: 'elite' },
    ]),
    rpcData(supabase, 'admin_transactional_email_failure_count', { p_since: since }),
    countRows(supabase, 'video_jobs', [{ column: 'status', operator: 'eq', value: 'failed' }], since),
    productsPromise,
    creditsPromise,
    activityPromise,
  ])

  const activeByPlan = { start: activeStart, pro: activePro, elite: activeElite }
  const generations = products.reduce((sum, product) => sum + product.generations, 0)
  const failures = products.reduce((sum, product) => sum + product.failures, 0)

  return {
    period,
    users: {
      total: totalUsers,
      newInPeriod: newUsers,
      byPlan: { free: freeUsers, start: startUsers, pro: proUsers, elite: eliteUsers },
    },
    subscriptions: {
      total: totalSubscriptions,
      active: activeSubscriptions,
      paused: pausedSubscriptions,
      cancelled: cancelledSubscriptions,
      activeByPlan,
    },
    smartTokens: {
      purchaseGranted: credits.schemaAvailable ? Number(credits.purchaseGranted ?? 0) : null,
      subscriptionGranted: credits.schemaAvailable ? Number(credits.subscriptionGranted ?? 0) : null,
      adminGranted: credits.schemaAvailable ? Number(credits.adminGranted ?? 0) : null,
      consumed: credits.schemaAvailable ? Number(credits.consumed ?? 0) : null,
      purchaseConsumed: credits.schemaAvailable ? Number(credits.purchaseConsumed ?? 0) : null,
      purchaseRemaining: credits.schemaAvailable ? Number(credits.purchaseRemaining ?? 0) : null,
      circulation: credits.schemaAvailable ? Number(credits.circulation ?? 0) : null,
    },
    commerce: {
      rechargesSold: Number(credits.purchaseLots ?? 0),
      rechargeCustomers: credits.schemaAvailable ? Number(credits.purchaseUsers ?? 0) : null,
      rechargePackages: { brl_49_90: Number(credits.purchase2000 ?? 0), brl_97_90: Number(credits.purchase4000 ?? 0) },
      catalogRechargeValueBrlCents: credits.recognizedPurchaseCatalogCents == null ? null : Number(credits.recognizedPurchaseCatalogCents),
      averageRechargeCatalogCents: Number(credits.purchaseLots ?? 0) > 0 && credits.recognizedPurchaseCatalogCents != null
        ? Math.round(Number(credits.recognizedPurchaseCatalogCents) / Number(credits.purchaseLots))
        : null,
      purchaseLotsByStatus: {
        active: credits.schemaAvailable ? Number(credits.purchaseActiveFullLots ?? 0) : null,
        partial: credits.schemaAvailable ? Number(credits.purchasePartialLots ?? 0) : null,
        exhausted: credits.schemaAvailable ? Number(credits.purchaseExhaustedLots ?? 0) : null,
        expired: credits.schemaAvailable ? Number(credits.purchaseExpiredLots ?? 0) : null,
      },
      theoreticalMonthlyBrlCents: theoreticalMonthlyBrlCents(activeByPlan),
      realRevenueAvailable: false,
      smart15UsageAvailable: false,
    },
    generation: {
      total: generations,
      failures,
      activeUsersToday: activity ? Number(activity.usersToday ?? 0) : null,
      activeUsers7Days: activity ? Number(activity.users7Days ?? 0) : null,
      activeUsers30Days: activity ? Number(activity.users30Days ?? 0) : null,
    },
    products,
    attention: {
      pausedSubscriptions,
      failedEmails: Number(failedEmails ?? 0),
      failedJobs,
      failedGenerations: failures,
    },
    availability: {
      realRevenue: false,
      stripeFees: false,
      aiCost: false,
      smart15Usage: false,
      lastAccess: false,
      totalSmartTokensInCirculation: true,
      virtualStagingUnifiedMetrics: true,
      adminCreditOperations: credits.schemaAvailable,
      generationActivity: Boolean(activity),
    },
  }
}

async function loadClients(supabase: any, input: Record<string, unknown>) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(String(input.page ?? '1'), 10) || 1))
  const search = sanitizeAdminSearch(input.search)
  const planValues = profilePlanValues(input.plan)
  const requestedStatus = String(input.status ?? '').trim().toLowerCase()
  const status = SUBSCRIPTION_STATUSES.has(requestedStatus) ? requestedStatus : ''
  const subscriptionRelation = status
    ? 'subscriptions!inner(plano,status,current_period_end,stripe_customer_id)'
    : 'subscriptions(plano,status,current_period_end,stripe_customer_id)'

  let query = supabase
    .from('profiles')
    .select(`id,nome,email,plano,saldo_creditos,created_at,stripe_customer_id,${subscriptionRelation}`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * CLIENT_PAGE_SIZE, page * CLIENT_PAGE_SIZE - 1)

  if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
  if (planValues) query = query.in('plano', planValues)
  if (status) query = query.eq('subscriptions.status', status)

  const { data, count, error } = await query
  if (error) throw new Error('Falha ao carregar clientes.')

  const userIds = (data ?? []).map((profile: any) => profile.id)
  const [creditRows, activityRows, courtesyRows] = userIds.length ? await Promise.all([
    optionalRpcData(supabase, 'admin_client_credit_metrics', { p_user_ids: userIds }),
    optionalRpcData(supabase, 'admin_client_activity_metrics', { p_user_ids: userIds }),
    loadCourtesyStates(supabase, userIds),
  ]) : [[], [], []]
  const creditsByUser = new Map((creditRows ?? []).map((row: any) => [row.user_id, row]))
  const activityByUser = new Map((activityRows ?? []).map((row: any) => [row.user_id, row]))
  const courtesyByUser = new Map<string, any>()
  for (const row of courtesyRows ?? []) courtesyByUser.set(row.user_id, row)
  const clients = (data ?? []).map((profile: any) => publicAdminClient(
    profile,
    creditsByUser.get(profile.id),
    activityByUser.get(profile.id),
    courtesyByUser.get(profile.id),
  ))

  return {
    clients,
    pagination: {
      page,
      pageSize: CLIENT_PAGE_SIZE,
      total: Number(count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(count ?? 0) / CLIENT_PAGE_SIZE)),
    },
  }
}

async function loadClientDetail(supabase: any, input: Record<string, unknown>) {
  const userId = String(input.userId ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new AdminInputError('Cliente inválido.')
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,nome,email,plano,saldo_creditos,created_at,stripe_customer_id,subscriptions(plano,status,current_period_end,stripe_customer_id)')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw new Error('Falha ao carregar cliente.')
  if (!profile) throw new AdminInputError('Cliente não encontrado.')

  const [creditRows, activityRows, lotsResult, adjustmentsResult, courtesyEvents] = await Promise.all([
    optionalRpcData(supabase, 'admin_client_credit_metrics', { p_user_ids: [userId] }),
    optionalRpcData(supabase, 'admin_client_activity_metrics', { p_user_ids: [userId] }),
    supabase.from('credit_lots')
      .select('id,source,original_amount,remaining_amount,status,expires_at,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('admin_credit_adjustments')
      .select('id,amount,reason,created_at,admin_user_id')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    loadCourtesyEvents(supabase, [userId], 50),
  ])
  if (lotsResult.error) throw new Error('Falha ao carregar histórico do cliente.')
  const adjustmentsMissing = isPendingAdminSchemaError(adjustmentsResult.error)
  if (adjustmentsResult.error && !adjustmentsMissing) throw new Error('Falha ao carregar histórico do cliente.')
  const adminIds = [...new Set([
    ...(adjustmentsMissing ? [] : adjustmentsResult.data ?? []).map((row: any) => row.admin_user_id),
    ...courtesyEvents.rows.map((row: any) => row.admin_user_id),
  ])]
  let adminsById = new Map<string, any>()
  if (adminIds.length) {
    const { data: admins, error: adminsError } = await supabase
      .from('profiles').select('id,nome,email').in('id', adminIds)
    if (adminsError) throw new Error('Falha ao carregar histórico administrativo.')
    adminsById = new Map((admins ?? []).map((admin: any) => [admin.id, admin]))
  }

  return {
    client: publicAdminClient(profile, creditRows?.[0], activityRows?.[0], courtesyEvents.rows[0]),
    lots: (lotsResult.data ?? []).map(publicCreditLot),
    adjustments: (adjustmentsMissing ? [] : adjustmentsResult.data ?? []).map((row: any) => publicAdminAdjustment(row, adminsById.get(row.admin_user_id))),
    courtesyHistory: courtesyEvents.rows.map((row: any) => publicAdminCourtesyEvent(row, adminsById.get(row.admin_user_id))),
    activityDefinition: 'Gerações persistidas; não representa login ou permanência no site.',
    adminCreditOperationsAvailable: Boolean(creditRows) && !adjustmentsMissing,
    adminCourtesyOperationsAvailable: courtesyEvents.available,
  }
}

async function addSmartTokens(supabase: any, adminUserId: string, input: Record<string, unknown>) {
  const validated = validateAdminCreditInput(input)
  const { data, error } = await supabase.rpc('grant_admin_credit_lot', {
    p_admin_user_id: adminUserId,
    p_user_id: validated.userId,
    p_amount: validated.amount,
    p_reason: validated.reason,
    p_idempotency_key: validated.requestId,
  })
  if (error) throw new Error('Não foi possível adicionar Smart Tokens.')
  const result = Array.isArray(data) ? data[0] : data
  return {
    result: result?.result,
    smartTokenBalance: Number(result?.saldo_creditos ?? 0),
  }
}

async function setCatalogCourtesy(supabase: any, adminUserId: string, input: Record<string, unknown>) {
  const validated = validateAdminCourtesyInput(input)
  const { data, error } = await supabase.rpc('set_admin_catalog_courtesy', {
    p_admin_user_id: adminUserId,
    p_user_id: validated.userId,
    p_active: validated.active,
    p_reason: validated.reason || null,
    p_idempotency_key: validated.requestId,
  })
  if (error) throw new Error(validated.active
    ? 'Não foi possível liberar o acesso completo.'
    : 'Não foi possível revogar o acesso completo.')
  const result = Array.isArray(data) ? data[0] : data
  if (!['created', 'already_processed', 'already_active', 'already_inactive'].includes(String(result?.result ?? ''))) {
    throw new Error('Resultado administrativo inválido.')
  }
  return {
    result: result.result,
    active: Boolean(result.active),
    effectiveAt: result.effective_at ?? null,
  }
}

async function loginEmailsByUserId(supabase: any, userIds: readonly string[]) {
  const entries = await Promise.all(userIds.map(async userId => {
    const result = await supabase.auth.admin.getUserById(userId)
    return [userId, result.error ? '' : String(result.data.user?.email ?? '')] as const
  }))
  return new Map(entries)
}

async function loadTestimonialProfiles(supabase: any, userIds: readonly string[]) {
  if (!userIds.length) return new Map<string, any>()
  const { data, error } = await supabase.from('profiles').select('id,nome,plano').in('id', userIds)
  if (error) throw new Error('Falha ao carregar clientes dos depoimentos.')
  return new Map((data ?? []).map((profile: any) => [profile.id, profile]))
}

async function loadTestimonialBonusUsers(supabase: any, userIds: readonly string[]) {
  if (!userIds.length) return new Set<string>()
  const { data, error } = await supabase.from('credit_lots').select('user_id')
    .in('user_id', userIds).eq('source', 'admin').eq('catalog_version', 'testimonial-marketing-v1')
  if (error) throw new Error('Falha ao carregar bônus dos depoimentos.')
  return new Set((data ?? []).map((lot: any) => lot.user_id))
}

async function listTestimonials(supabase: any, input: Record<string, unknown>) {
  const validated = validateTestimonialListInput(input)
  const from = (validated.page - 1) * TESTIMONIAL_PAGE_SIZE
  let query = supabase.from('testimonials')
    .select(TESTIMONIAL_FIELDS, { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(from, from + TESTIMONIAL_PAGE_SIZE - 1)
  if (validated.status) query = query.eq('status', validated.status)
  const { data, error, count } = await query
  if (error) throw new Error('Falha ao carregar depoimentos.')

  const userIds = [...new Set((data ?? []).map((row: any) => row.user_id))] as string[]
  const [profiles, loginEmails, bonusUsers] = await Promise.all([
    loadTestimonialProfiles(supabase, userIds),
    loginEmailsByUserId(supabase, userIds),
    loadTestimonialBonusUsers(supabase, userIds),
  ])
  return {
    testimonials: (data ?? []).map((row: any) => publicAdminTestimonial(
      row,
      profiles.get(row.user_id),
      loginEmails.get(row.user_id),
      bonusUsers.has(row.user_id),
    )),
    pagination: {
      page: validated.page,
      pageSize: TESTIMONIAL_PAGE_SIZE,
      total: Number(count ?? 0),
      totalPages: Math.max(1, Math.ceil(Number(count ?? 0) / TESTIMONIAL_PAGE_SIZE)),
    },
  }
}

async function loadAdminTestimonialDetail(supabase: any, testimonialId: string) {
  const { data: row, error } = await supabase.from('testimonials')
    .select(TESTIMONIAL_FIELDS).eq('id', testimonialId).maybeSingle()
  if (error) throw new Error('Falha ao carregar depoimento.')
  if (!row) throw new AdminInputError('Depoimento não encontrado.')

  const adminIds = [...new Set([row.approved_by, row.rejected_by, row.published_by].filter(Boolean))] as string[]
  const [profiles, loginEmails, bonusUsers, adminsResult, adjustmentResult] = await Promise.all([
    loadTestimonialProfiles(supabase, [row.user_id]),
    loginEmailsByUserId(supabase, [row.user_id]),
    loadTestimonialBonusUsers(supabase, [row.user_id]),
    adminIds.length
      ? supabase.from('profiles').select('id,nome').in('id', adminIds)
      : Promise.resolve({ data: [], error: null }),
    row.bonus_adjustment_id
      ? supabase.from('admin_credit_adjustments').select('id,amount,reason,created_at')
        .eq('id', row.bonus_adjustment_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (adminsResult.error || adjustmentResult.error) throw new Error('Falha ao carregar auditoria do depoimento.')
  const admins = new Map((adminsResult.data ?? []).map((admin: any) => [admin.id, admin.nome || 'Administrador']))
  return publicAdminTestimonialDetail(
    row,
    profiles.get(row.user_id),
    loginEmails.get(row.user_id),
    {
      approvedBy: admins.get(row.approved_by),
      rejectedBy: admins.get(row.rejected_by),
      publishedBy: admins.get(row.published_by),
    },
    adjustmentResult.data,
    bonusUsers.has(row.user_id),
  )
}

async function getTestimonial(supabase: any, input: Record<string, unknown>) {
  const { testimonialId } = validateTestimonialIdInput(input)
  return { testimonial: await loadAdminTestimonialDetail(supabase, testimonialId) }
}

async function loadTestimonialForMutation(supabase: any, testimonialId: string) {
  const { data, error } = await supabase.from('testimonials')
    .select('id,status,publication_consent,bonus_adjustment_id')
    .eq('id', testimonialId).maybeSingle()
  if (error) throw new Error('Falha ao validar depoimento.')
  if (!data) throw new AdminInputError('Depoimento não encontrado.')
  return data
}

async function approveTestimonial(supabase: any, adminUserId: string, input: Record<string, unknown>) {
  const { testimonialId } = validateTestimonialIdInput(input)
  const current = await loadTestimonialForMutation(supabase, testimonialId)
  if (testimonialApprovalTransition(current) === 'unchanged') return getTestimonial(supabase, { testimonialId })
  const { data, error } = await supabase.from('testimonials').update({
    status: 'approved', approved_at: new Date().toISOString(), approved_by: adminUserId,
  }).eq('id', testimonialId).eq('status', 'pending').select('id').maybeSingle()
  if (error || !data) throw new Error('Não foi possível aprovar o depoimento.')
  return getTestimonial(supabase, { testimonialId })
}

async function rejectTestimonial(supabase: any, adminUserId: string, input: Record<string, unknown>) {
  const { testimonialId, reason } = validateTestimonialRejectionInput(input)
  const current = await loadTestimonialForMutation(supabase, testimonialId)
  assertTestimonialCanBeRejected(current)
  const { data, error } = await supabase.from('testimonials').update({
    status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: adminUserId,
    rejection_reason: reason,
  }).eq('id', testimonialId).eq('status', current.status).is('bonus_adjustment_id', null)
    .select('id').maybeSingle()
  if (error || !data) throw new Error('Não foi possível recusar o depoimento.')
  return getTestimonial(supabase, { testimonialId })
}

async function publishTestimonial(supabase: any, adminUserId: string, input: Record<string, unknown>) {
  const { testimonialId } = validateTestimonialIdInput(input)
  const current = await loadTestimonialForMutation(supabase, testimonialId)
  if (testimonialPublicationTransition(current) === 'unchanged') return getTestimonial(supabase, { testimonialId })
  const { data, error } = await supabase.from('testimonials').update({
    status: 'published', published_at: new Date().toISOString(), published_by: adminUserId,
  }).eq('id', testimonialId).eq('status', 'approved').eq('publication_consent', true)
    .select('id').maybeSingle()
  if (error || !data) throw new Error('Não foi possível publicar o depoimento.')
  return getTestimonial(supabase, { testimonialId })
}

async function approveTestimonialAndGrantBonus(
  supabase: any,
  adminUserId: string,
  input: Record<string, unknown>,
) {
  return executeTestimonialBonus(input, adminUserId, {
    grant: async validated => {
      const { data, error } = await supabase.rpc('approve_testimonial_and_grant_bonus', {
        p_testimonial_id: validated.testimonialId,
        p_admin_user_id: validated.adminUserId,
        p_idempotency_key: validated.requestId,
      })
      if (error) throw new Error('Não foi possível conceder o bônus do depoimento.')
      return (Array.isArray(data) ? data[0] : data) ?? {}
    },
    loadTestimonial: async testimonialId => {
      const { data, error } = await supabase.from('testimonials')
        .select('user_id,bonus_adjustment_id')
        .eq('id', testimonialId)
        .single()
      if (error || !data?.user_id) throw new Error('Não foi possível confirmar o bônus do depoimento.')
      return { userId: data.user_id, bonusAdjustmentId: data.bonus_adjustment_id }
    },
    notify: email => deliverTestimonialEmail(supabase, {
      ...email,
      template: 'bonus_granted',
    }),
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido.' }, 405)

  try {
    const supabase = createClient(
      requiredEnv('SUPABASE_URL'),
      resolveSupabaseAdminCredential().key,
      { auth: { persistSession: false } },
    )

    const authorization = req.headers.get('authorization') || ''
    if (!/^Bearer\s+/i.test(authorization)) return jsonResponse({ error: 'Sessao invalida.' }, 401)
    const token = authorization.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.id) return jsonResponse({ error: 'Sessao invalida.' }, 401)

    // Mandatory server-side gate before parsing actions or querying administrative data.
    await requireAuthorizedAdmin(supabase, user.id)
    await requireAdminAal2(supabase, token)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action || '')
    if (action === 'overview') return jsonResponse(await loadOverview(supabase, body.period))
    if (action === 'list_clients') return jsonResponse(await loadClients(supabase, body))
    if (action === 'get_client') return jsonResponse(await loadClientDetail(supabase, body))
    if (action === 'add_smart_tokens') return jsonResponse(await addSmartTokens(supabase, user.id, body))
    if (action === 'set_catalog_courtesy') return jsonResponse(await setCatalogCourtesy(supabase, user.id, body))
    if (action === 'list_testimonials') return jsonResponse(await listTestimonials(supabase, body))
    if (action === 'get_testimonial') return jsonResponse(await getTestimonial(supabase, body))
    if (action === 'approve_testimonial') return jsonResponse(await approveTestimonial(supabase, user.id, body))
    if (action === 'reject_testimonial') return jsonResponse(await rejectTestimonial(supabase, user.id, body))
    if (action === 'publish_testimonial') return jsonResponse(await publishTestimonial(supabase, user.id, body))
    if (action === 'approve_testimonial_and_grant_bonus') {
      return jsonResponse(await approveTestimonialAndGrantBonus(supabase, user.id, body))
    }
    return jsonResponse({ error: 'Acao administrativa invalida.' }, 400)
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return jsonResponse({ error: error.message }, error.status)
    if (error instanceof AdminMfaRequiredError) return jsonResponse({ error: error.message }, error.status)
    if (error instanceof AdminInputError) return jsonResponse({ error: error.message }, 400)
    console.error('admin-api failure', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Operacao administrativa indisponivel.' }, 500)
  }
})

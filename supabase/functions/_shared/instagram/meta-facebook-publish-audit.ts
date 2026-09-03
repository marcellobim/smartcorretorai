import { validateGraphApiVersion } from './oauth.ts'

const PAGE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/
const SCOPE_PATTERN = /^[a-z0-9_]{1,100}$/
const REQUIRED_SCOPES = Object.freeze(['pages_read_engagement', 'pages_manage_posts'] as const)

type GranularScope = Readonly<{
  scope: string
  targetIds: readonly string[]
}>

export type NormalizedMetaDebugToken = Readonly<{
  valid: boolean
  effectiveScopes: readonly string[]
  granularScopes: readonly GranularScope[]
  targetIds: readonly string[]
}>

export type FacebookPublishCapabilityAudit = Readonly<{
  capability: 'facebook_publish'
  ready: boolean
  publicCode: 'ready' | 'facebook_reconnect_required'
  pagesReadEngagement: boolean
  pagesManagePosts: boolean
  targetAuthorized: boolean
  tokenValid: boolean
  effectiveScopeCount: number
  granularScopeCount: number
  targetCount: number
}>

const safeScope = (value: unknown) => (
  typeof value === 'string' && SCOPE_PATTERN.test(value.trim()) ? value.trim() : null
)

const safeTargetId = (value: unknown) => (
  typeof value === 'string' && PAGE_ID_PATTERN.test(value.trim()) ? value.trim() : null
)

export function normalizeMetaDebugToken(
  data: unknown,
  options: { appId: string; nowSeconds: number },
): NormalizedMetaDebugToken {
  const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const effectiveScopes = new Set<string>()
  const granularByScope = new Map<string, Set<string>>()
  const targetIds = new Set<string>()

  if (Array.isArray(record.scopes)) {
    for (const rawScope of record.scopes) {
      const scope = safeScope(rawScope)
      if (scope) effectiveScopes.add(scope)
    }
  }

  if (Array.isArray(record.granular_scopes)) {
    for (const rawGranular of record.granular_scopes) {
      if (!rawGranular || typeof rawGranular !== 'object') continue
      const granular = rawGranular as Record<string, unknown>
      const scope = safeScope(granular.scope)
      if (!scope) continue
      effectiveScopes.add(scope)
      const targets = granularByScope.get(scope) ?? new Set<string>()
      if (Array.isArray(granular.target_ids)) {
        for (const rawTargetId of granular.target_ids) {
          const targetId = safeTargetId(rawTargetId)
          if (!targetId) continue
          targets.add(targetId)
          targetIds.add(targetId)
        }
      }
      granularByScope.set(scope, targets)
    }
  }

  const expiresAt = typeof record.expires_at === 'number'
    && Number.isSafeInteger(record.expires_at)
    && record.expires_at > 0
    ? record.expires_at
    : null
  const dataAccessExpiresAt = typeof record.data_access_expires_at === 'number'
    && Number.isSafeInteger(record.data_access_expires_at)
    && record.data_access_expires_at > 0
    ? record.data_access_expires_at
    : null
  const responseAppId = typeof record.app_id === 'string' || typeof record.app_id === 'number'
    ? String(record.app_id)
    : null
  const valid = record.is_valid === true
    && responseAppId === options.appId
    && (expiresAt === null || expiresAt > options.nowSeconds)
    && (dataAccessExpiresAt === null || dataAccessExpiresAt > options.nowSeconds)

  return Object.freeze({
    valid,
    effectiveScopes: Object.freeze([...effectiveScopes].sort()),
    granularScopes: Object.freeze([...granularByScope.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([scope, targets]) => Object.freeze({ scope, targetIds: Object.freeze([...targets].sort()) }))),
    targetIds: Object.freeze([...targetIds].sort()),
  })
}

export function inspectFacebookPublishCapability(
  normalized: NormalizedMetaDebugToken,
  pageId: string,
): FacebookPublishCapabilityAudit {
  const safePageId = safeTargetId(pageId)
  const granted = new Set(normalized.effectiveScopes)
  const targetScopes = new Map(normalized.granularScopes.map(item => [item.scope, new Set(item.targetIds)]))
  const pagesReadEngagement = granted.has('pages_read_engagement')
  const pagesManagePosts = granted.has('pages_manage_posts')
  const targetAuthorized = Boolean(safePageId)
    && REQUIRED_SCOPES.every(scope => targetScopes.get(scope)?.has(safePageId as string) === true)
  const ready = normalized.valid && pagesReadEngagement && pagesManagePosts && targetAuthorized

  return Object.freeze({
    capability: 'facebook_publish',
    ready,
    publicCode: ready ? 'ready' : 'facebook_reconnect_required',
    pagesReadEngagement,
    pagesManagePosts,
    targetAuthorized,
    tokenValid: normalized.valid,
    effectiveScopeCount: normalized.effectiveScopes.length,
    granularScopeCount: normalized.granularScopes.length,
    targetCount: normalized.targetIds.length,
  })
}

export async function auditExistingFacebookPublishCapability(input: {
  appId: string
  appSecret: string
  graphApiVersion: string
  userToken: string
  pageId: string
  now?: number
  fetcher?: typeof fetch
}): Promise<FacebookPublishCapabilityAudit> {
  const version = validateGraphApiVersion(input.graphApiVersion)
  const fetcher = input.fetcher ?? fetch
  const invalid = () => inspectFacebookPublishCapability(normalizeMetaDebugToken(null, {
    appId: input.appId,
    nowSeconds: Math.floor((input.now ?? Date.now()) / 1000),
  }), input.pageId)
  try {
    const url = new URL(`https://graph.facebook.com/${version}/debug_token`)
    url.searchParams.set('input_token', input.userToken)
    const response = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${input.appId}|${input.appSecret}` },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body || typeof body !== 'object' || 'error' in body) return invalid()
    const normalized = normalizeMetaDebugToken((body as Record<string, unknown>).data, {
      appId: input.appId,
      nowSeconds: Math.floor((input.now ?? Date.now()) / 1000),
    })
    return inspectFacebookPublishCapability(normalized, input.pageId)
  } catch {
    return invalid()
  }
}

export const sanitizeFacebookPublishCapabilityTelemetry = (audit: FacebookPublishCapabilityAudit) => Object.freeze({
  stage: 'facebook_publish_capability' as const,
  pages_read_engagement: audit.pagesReadEngagement,
  pages_manage_posts: audit.pagesManagePosts,
  page_target_authorized: audit.targetAuthorized,
  facebook_publish_ready: audit.ready,
  facebook_reconnect_required: !audit.ready,
  effective_scope_count: audit.effectiveScopeCount,
  granular_scope_count: audit.granularScopeCount,
  page_target_count: audit.targetCount,
})

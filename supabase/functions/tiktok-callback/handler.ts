import { deriveTikTokCapabilities } from '../_shared/tiktok/capabilities.ts'
import type { UpgradeBinding } from '../_shared/tiktok/upgrade.ts'
import { validateTikTokIdentity, type TikTokIdentity } from '../_shared/tiktok/environment.ts'
import {
  exchangeTikTokAuthorizationCode,
  fetchTikTokAccount,
  TikTokProviderError,
  type TikTokProviderDiagnostic,
  type TikTokFetch,
} from '../_shared/tiktok/client.ts'
import {
  consumeTikTokOAuthState,
  fingerprintTikTokAppId,
  fingerprintTikTokOAuthState,
  hashTikTokOAuthState,
} from '../_shared/tiktok/oauth.ts'
import {
  encryptTikTokConnectionForDatabase,
  type TikTokTokenKeyring,
} from '../_shared/tiktok/token-crypto.ts'
import {
  logTikTokOAuthEvent,
  type TikTokOAuthStage,
} from '../_shared/tiktok/telemetry.ts'
import {
  TIKTOK_LOGIN_SCOPES,
  type TikTokOAuthStateRepository,
} from '../_shared/tiktok/types.ts'

export type TikTokLoginPersistenceInput = TikTokIdentity & Readonly<{
  userId: string
  openId: string
  accessTokenCiphertext: string
  accessTokenNonce: string
  accessTokenAuthTag: string
  refreshTokenCiphertext: string
  refreshTokenNonce: string
  refreshTokenAuthTag: string
  keyVersion: string
  accessTokenExpiresIn: number
  refreshTokenExpiresIn: number
  scopes: readonly string[]
  account: Readonly<{
    openId: string
    displayName: string | null
    username: string | null
    avatarUrl: string | null
  }>
}>

export type TikTokCallbackDependencies = Readonly<{
  identity: TikTokIdentity
  clientKey: string
  clientSecret: string
  redirectUri: string
  frontendOrigin: string
  frontendReturnUri: string
  stateRepository: TikTokOAuthStateRepository
  tokenKeyring: TikTokTokenKeyring
  fetcher: TikTokFetch
  consumeUpgrade?: (state: string, redirectUri: string) => Promise<UpgradeBinding>
  persistUpgrade?: (input: TikTokLoginPersistenceInput, binding: UpgradeBinding) => Promise<void>
  persistLogin: (input: TikTokLoginPersistenceInput) => Promise<void>
  now?: () => number
  log?: (message: string) => void
}>

type PublicFailure =
  | 'authorization_denied'
  | 'callback_invalid'
  | 'code_missing'
  | 'scope_missing'
  | 'upgrade_scope_missing'
  | 'state_invalid'

type TikTokCallbackDiagnosticStage =
  | 'state_validation'
  | 'pkce_validation'
  | 'token_exchange'
  | 'scope_validation'
  | 'user_info'
  | 'persistence'
  | 'final_redirect'

type TikTokCallbackPreConsumeReason =
  | 'invalid_method_or_path'
  | 'state_missing'
  | 'state_duplicate'
  | 'state_empty'
  | 'state_too_long'
  | 'state_control_character'
  | 'error_duplicate'
  | 'code_missing'

type TikTokCallbackRequestDiagnostic = Readonly<{
  method: string
  origin: string
  path: string
  methodMatch: boolean
  originMatch: boolean
  pathMatch: boolean
}>

type TikTokStateCorrelation = Readonly<{
  createdStateFingerprint: string | null
  sentStateFingerprint: string | null
  receivedStateFingerprint: string | null
  environment: TikTokIdentity['environment']
  appIdMatch: boolean | null
  stateFound: boolean | null
  stateExpired: boolean | null
  stateAlreadyConsumed: boolean | null
}>

const TIKTOK_CALLBACK_PATH = '/functions/v1/tiktok-callback'
const TIKTOK_FRONTEND_RETURN_PATH = '/configuracoes/integracoes/tiktok'

export const validateTikTokConfiguredRedirectUri = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_redirect_uri')
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== TIKTOK_CALLBACK_PATH
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_redirect_uri')
  return url.toString()
}

export const validateTikTokFrontendOrigin = (value: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_frontend_origin')
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_frontend_origin')
  return url.origin
}

export const validateTikTokFrontendReturnUri = (value: string, expectedOrigin: string) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('invalid_tiktok_frontend_return_uri')
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.origin !== expectedOrigin
    || url.pathname !== TIKTOK_FRONTEND_RETURN_PATH
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_frontend_return_uri')
  return url.toString()
}

const redirect = (baseUri: string, outcome: 'connected' | 'error', reason?: PublicFailure, diagnosticStage?: TikTokCallbackDiagnosticStage, diagnostic?: TikTokProviderDiagnostic, correlation?: TikTokStateCorrelation, diagnosticReason?: TikTokCallbackPreConsumeReason, requestDiagnostic?: TikTokCallbackRequestDiagnostic) => {
  const location = new URL(baseUri)
  location.searchParams.set('tiktok', outcome)
  if (reason) location.searchParams.set('reason', reason)
  if (diagnosticReason) location.searchParams.set('diagnostic_reason', diagnosticReason)
  if (requestDiagnostic) {
    location.searchParams.set('diagnostic_method', requestDiagnostic.method)
    location.searchParams.set('diagnostic_origin', requestDiagnostic.origin)
    location.searchParams.set('diagnostic_path', requestDiagnostic.path)
    location.searchParams.set('diagnostic_method_match', String(requestDiagnostic.methodMatch))
    location.searchParams.set('diagnostic_origin_match', String(requestDiagnostic.originMatch))
    location.searchParams.set('diagnostic_path_match', String(requestDiagnostic.pathMatch))
  }
  if (diagnosticStage) {
    location.searchParams.set('diagnostic_stage', diagnosticStage)
    if (diagnostic) {
      location.searchParams.set('provider_http_status', String(diagnostic.httpStatus))
      if (diagnostic.providerCode) location.searchParams.set('provider_error_code', diagnostic.providerCode)
      if (diagnostic.providerMessage) location.searchParams.set('provider_error_message', diagnostic.providerMessage)
      if (diagnostic.providerLogId) location.searchParams.set('provider_log_id', diagnostic.providerLogId)
    }
  }
  if (correlation) {
    const set = (name: string, value: string | boolean | null) => {
      location.searchParams.set(name, value === null ? 'unknown' : String(value))
    }
    set('created_state_fp', correlation.createdStateFingerprint)
    set('sent_state_fp', correlation.sentStateFingerprint)
    set('received_state_fp', correlation.receivedStateFingerprint)
    set('environment', correlation.environment)
    set('app_id_match', correlation.appIdMatch)
    set('state_found', correlation.stateFound)
    set('state_expired', correlation.stateExpired)
    set('state_already_consumed', correlation.stateAlreadyConsumed)
  }
  return new Response(null, {
    status: 303,
    headers: {
      'Cache-Control': 'no-store',
      Location: location.toString(),
      'Referrer-Policy': 'no-referrer',
    },
  })
}

const singleParameter = (url: URL, name: string, maximumLength: number) => {
  const values = url.searchParams.getAll(name)
  if (values.length !== 1) return null
  const value = values[0]
  if (!value || value.length > maximumLength || /[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

const safeMethod = (value: string) => /^[A-Z]{1,16}$/.test(value) ? value : 'unknown'
const safeOrigin = (url: URL | null) => url && url.protocol === 'https:' && url.origin.length <= 255 ? url.origin : 'unknown'
const safePath = (url: URL | null) => url && url.pathname.length <= 255 && /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/.test(url.pathname) ? url.pathname : 'unknown'

const callbackRequestDiagnostic = (request: Request, expectedRedirectUri: string): TikTokCallbackRequestDiagnostic => {
  let received: URL | null = null
  try { received = new URL(request.url) } catch { /* preserve the existing GET validation path */ }
  const expected = new URL(expectedRedirectUri)
  const method = safeMethod(request.method)
  const origin = safeOrigin(received)
  const path = safePath(received)
  return {
    method,
    origin,
    path,
    methodMatch: method === 'GET',
    originMatch: received?.origin === expected.origin,
    pathMatch: received?.pathname === expected.pathname,
  }
}

const safeNow = (dependencies: TikTokCallbackDependencies) => {
  const now = dependencies.now?.() ?? Date.now()
  if (!Number.isFinite(now)) throw new Error('invalid_tiktok_callback_time')
  return now
}

const remainingLifetime = (started: number, current: number, seconds: number) => {
  const remaining = seconds - Math.ceil(Math.max(0, current - started) / 1000)
  if (!Number.isSafeInteger(remaining) || remaining <= 0 || remaining > 315360000) throw new Error('invalid_tiktok_token_expiration')
  return remaining
}

export function createTikTokCallbackHandler(dependencies: TikTokCallbackDependencies) {
  const identity = validateTikTokIdentity(dependencies.identity)
  const redirectUri = validateTikTokConfiguredRedirectUri(dependencies.redirectUri)
  const frontendOrigin = validateTikTokFrontendOrigin(dependencies.frontendOrigin)
  const frontendReturnUri = validateTikTokFrontendReturnUri(dependencies.frontendReturnUri, frontendOrigin)
  const log = dependencies.log ?? (() => undefined)

  const correlationEvent = async (state: string | null): Promise<TikTokStateCorrelation | undefined> => {
    if (!state) return undefined
    let receivedStateFingerprint: string
    try {
      receivedStateFingerprint = await fingerprintTikTokOAuthState(state)
    } catch {
      return undefined
    }
    const appIdFingerprint = await fingerprintTikTokAppId(identity.appId)
    const base: TikTokStateCorrelation = {
      createdStateFingerprint: null,
      sentStateFingerprint: null,
      receivedStateFingerprint,
      environment: identity.environment,
      appIdMatch: null,
      stateFound: null,
      stateExpired: null,
      stateAlreadyConsumed: null,
    }
    try {
      const inspected = await dependencies.stateRepository.inspectChallenge?.({
        stateHash: await hashTikTokOAuthState(state),
      })
      if (!inspected) {
        const correlation = { ...base, stateFound: false }
        log(JSON.stringify({ event: 'tiktok_oauth_state_correlation', created_state_fp: null, sent_state_fp: null, received_state_fp: receivedStateFingerprint, environment: identity.environment, app_id_fp: appIdFingerprint, app_id_match: null, state_found: false, state_expired: null, state_already_consumed: null }))
        return correlation
      }
      const correlation = {
        ...base,
        createdStateFingerprint: inspected.stateHash.slice(0, 16),
        sentStateFingerprint: inspected.stateHash.slice(0, 16),
        appIdMatch: inspected.appId === identity.appId,
        stateFound: true,
        stateExpired: Date.parse(inspected.expiresAt) <= Date.now(),
        stateAlreadyConsumed: inspected.consumedAt !== null,
      }
      log(JSON.stringify({ event: 'tiktok_oauth_state_correlation', created_state_fp: correlation.createdStateFingerprint, sent_state_fp: correlation.sentStateFingerprint, received_state_fp: receivedStateFingerprint, environment: identity.environment, app_id_fp: appIdFingerprint, app_id_match: correlation.appIdMatch, state_found: true, state_expired: correlation.stateExpired, state_already_consumed: correlation.stateAlreadyConsumed }))
      return correlation
    } catch {
      log(JSON.stringify({ event: 'tiktok_oauth_state_correlation', created_state_fp: null, sent_state_fp: null, received_state_fp: receivedStateFingerprint, environment: identity.environment, app_id_fp: appIdFingerprint, app_id_match: null, state_found: null, state_expired: null, state_already_consumed: null }))
      return base
    }
  }

  const failure = (reason: PublicFailure, stage: TikTokOAuthStage, diagnosticStage: TikTokCallbackDiagnosticStage, status: number, stateConsumed?: boolean, diagnostic?: TikTokProviderDiagnostic, correlation?: TikTokStateCorrelation, diagnosticReason?: TikTokCallbackPreConsumeReason, requestDiagnostic?: TikTokCallbackRequestDiagnostic) => {
    logTikTokOAuthEvent(log, { stage, http_status: status, state_consumed: stateConsumed })
    return redirect(frontendReturnUri, 'error', reason, diagnosticStage, diagnostic, correlation, diagnosticReason, requestDiagnostic)
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return failure('callback_invalid', 'state', 'state_validation', 405, undefined, undefined, undefined, 'invalid_method_or_path', callbackRequestDiagnostic(request, redirectUri))

    const url = new URL(request.url)
    if(url.origin !== new URL(redirectUri).origin || url.pathname !== new URL(redirectUri).pathname) return failure('callback_invalid','state','state_validation',400,false,undefined,undefined,'invalid_method_or_path',callbackRequestDiagnostic(request, redirectUri))
    const stateValues = url.searchParams.getAll('state')
    if (stateValues.length === 0) return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'state_missing')
    if (stateValues.length !== 1) return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'state_duplicate')
    const state = stateValues[0]
    if (!state) return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'state_empty')
    if (state.length > 128) return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'state_too_long')
    if (/[\u0000-\u001f\u007f]/.test(state)) return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'state_control_character')

    const providerErrors = url.searchParams.getAll('error')
    if (providerErrors.length > 1) return failure('callback_invalid', 'state', 'state_validation', 400, false, undefined, undefined, 'error_duplicate')

    const code = singleParameter(url, 'code', 2048)
    if (!code && providerErrors.length === 0) return failure('code_missing', 'state', 'state_validation', 400, false, undefined, undefined, 'code_missing')

    let userId: string
    let upgradeBinding: UpgradeBinding | undefined
    const upgrading = state.startsWith('dp.')
    try {
      if(upgrading) {
        if(identity.environment !== 'sandbox' || !dependencies.consumeUpgrade || !dependencies.persistUpgrade) throw new Error('upgrade_unavailable')
        upgradeBinding = await dependencies.consumeUpgrade(state,redirectUri)
        userId = upgradeBinding.userId
      } else {
      const consumed = await consumeTikTokOAuthState({
        state,
        expectedRedirectUri: redirectUri,
        identity,
      }, dependencies.stateRepository)
      userId = consumed.userId
      }
    } catch {
      return failure('state_invalid', 'state', 'state_validation', 400, false, undefined, await correlationEvent(state))
    }

    if (providerErrors.length === 1) {
      return failure('authorization_denied', 'state', 'state_validation', 400, true)
    }

    let stage: TikTokOAuthStage = 'token_exchange'
    let diagnosticStage: TikTokCallbackDiagnosticStage = 'token_exchange'
    try {
      const now = safeNow(dependencies)
      const tokenSet = await exchangeTikTokAuthorizationCode({
        clientKey: dependencies.clientKey,
        clientSecret: dependencies.clientSecret,
        code: code!,
        redirectUri,
        fetcher: dependencies.fetcher,
        capability: upgrading ? 'direct_post_upgrade' : 'login_basic',
      })
      diagnosticStage = 'scope_validation'
      if(upgrading && !deriveTikTokCapabilities(tokenSet.scopes).direct_post) return failure('upgrade_scope_missing','token_exchange','scope_validation',400,true)
      if (TIKTOK_LOGIN_SCOPES.some(scope => !tokenSet.scopes.includes(scope))) {
        return failure('scope_missing', 'token_exchange', 'scope_validation', 400, true)
      }

      stage = 'account'
      diagnosticStage = 'user_info'
      const account = await fetchTikTokAccount({
        accessToken: tokenSet.accessToken,
        fetcher: dependencies.fetcher,
      })
      if (account.openId !== tokenSet.openId) throw new Error('tiktok_account_identity_mismatch')

      stage = 'database'
      diagnosticStage = 'persistence'
      const sealed = await encryptTikTokConnectionForDatabase({
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
      }, dependencies.tokenKeyring, { ...identity, userId, openId: tokenSet.openId })
      const current = safeNow(dependencies)
      const persist = upgradeBinding
        ? (input: TikTokLoginPersistenceInput) => dependencies.persistUpgrade!(input,upgradeBinding!)
        : dependencies.persistLogin
      await persist({
        ...identity,
        userId,
        openId: tokenSet.openId,
        accessTokenCiphertext: sealed.access_token_ciphertext,
        accessTokenNonce: sealed.access_token_nonce,
        accessTokenAuthTag: sealed.access_token_auth_tag,
        refreshTokenCiphertext: sealed.refresh_token_ciphertext,
        refreshTokenNonce: sealed.refresh_token_nonce,
        refreshTokenAuthTag: sealed.refresh_token_auth_tag,
        keyVersion: sealed.key_version,
        accessTokenExpiresIn: remainingLifetime(now, current, tokenSet.accessTokenExpiresIn),
        refreshTokenExpiresIn: remainingLifetime(now, current, tokenSet.refreshTokenExpiresIn),
        scopes: tokenSet.scopes,
        account: {
          openId: account.openId,
          displayName: account.displayName,
          username: null,
          avatarUrl: account.avatarUrl,
        },
      })

      logTikTokOAuthEvent(log, {
        stage: 'success',
        http_status: 303,
        scope_count: tokenSet.scopes.length,
        state_consumed: true,
        account_resolved: true,
      })
      return redirect(frontendReturnUri, 'connected', undefined, 'final_redirect')
    } catch (error) {
      const scopeFailure = error instanceof Error && error.message === 'tiktok_required_scope_missing'
      const reason = scopeFailure
        ? 'scope_missing'
        : 'callback_invalid'
      const providerDiagnostic = error instanceof TikTokProviderError ? error.diagnostic : undefined
      return failure(reason, stage, scopeFailure ? 'scope_validation' : diagnosticStage, 400, true, providerDiagnostic)
    }
  }
}

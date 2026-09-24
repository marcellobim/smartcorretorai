import { deriveTikTokCapabilities } from '../_shared/tiktok/capabilities.ts'
import type { UpgradeBinding } from '../_shared/tiktok/upgrade.ts'
import { validateTikTokIdentity, type TikTokIdentity } from '../_shared/tiktok/environment.ts'
import {
  exchangeTikTokAuthorizationCode,
  fetchTikTokAccount,
  type TikTokFetch,
} from '../_shared/tiktok/client.ts'
import { consumeTikTokOAuthState } from '../_shared/tiktok/oauth.ts'
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

const redirect = (baseUri: string, outcome: 'connected' | 'error', reason?: PublicFailure) => {
  const location = new URL(baseUri)
  location.searchParams.set('tiktok', outcome)
  if (reason) location.searchParams.set('reason', reason)
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

  const failure = (reason: PublicFailure, stage: TikTokOAuthStage, status: number, stateConsumed?: boolean) => {
    logTikTokOAuthEvent(log, { stage, http_status: status, state_consumed: stateConsumed })
    return redirect(frontendReturnUri, 'error', reason)
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return failure('callback_invalid', 'state', 405)

    const url = new URL(request.url)
    if(url.origin !== new URL(redirectUri).origin || url.pathname !== new URL(redirectUri).pathname) return failure('callback_invalid','state',400,false)
    const state = singleParameter(url, 'state', 128)
    if (!state) return failure('state_invalid', 'state', 400, false)

    const providerErrors = url.searchParams.getAll('error')
    if (providerErrors.length > 1) return failure('callback_invalid', 'state', 400, false)

    const code = singleParameter(url, 'code', 2048)
    if (!code && providerErrors.length === 0) return failure('code_missing', 'state', 400, false)

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
      return failure('state_invalid', 'state', 400, false)
    }

    if (providerErrors.length === 1) {
      return failure('authorization_denied', 'state', 400, true)
    }

    let stage: TikTokOAuthStage = 'token_exchange'
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
      if(upgrading && !deriveTikTokCapabilities(tokenSet.scopes).direct_post) return failure('upgrade_scope_missing','token_exchange',400,true)
      if (TIKTOK_LOGIN_SCOPES.some(scope => !tokenSet.scopes.includes(scope))) {
        return failure('scope_missing', 'token_exchange', 400, true)
      }

      stage = 'account'
      const account = await fetchTikTokAccount({
        accessToken: tokenSet.accessToken,
        fetcher: dependencies.fetcher,
      })
      if (account.openId !== tokenSet.openId) throw new Error('tiktok_account_identity_mismatch')

      stage = 'database'
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
      return redirect(frontendReturnUri, 'connected')
    } catch (error) {
      const reason = error instanceof Error && error.message === 'tiktok_required_scope_missing'
        ? 'scope_missing'
        : 'callback_invalid'
      return failure(reason, stage, 400, true)
    }
  }
}

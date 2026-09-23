import type { TikTokIdentity } from './environment.ts'
export const TIKTOK_OAUTH_PROVIDER = 'tiktok' as const
export const TIKTOK_LOGIN_FLOW = 'tiktok_login_kit' as const
export const TIKTOK_LOGIN_SCOPES = Object.freeze(['user.info.basic'] as const)

export type TikTokLoginScope = typeof TIKTOK_LOGIN_SCOPES[number]

export type TikTokTokenSet = Readonly<{
  openId: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: number
  refreshTokenExpiresIn: number
  scopes: readonly string[]
  tokenType: 'Bearer'
}>

export type TikTokAccount = Readonly<{
  openId: string
  displayName: string | null
  avatarUrl: string | null
}>

export type TikTokOAuthStateRecord = Readonly<{
  stateHash: string
  userId: string
  redirectUriHash: string
  provider: typeof TIKTOK_OAUTH_PROVIDER
  flow: typeof TIKTOK_LOGIN_FLOW
  environment: TikTokIdentity['environment']
  appId: string
}>

export type TikTokOAuthStateRepository = Readonly<{
  persistChallenge(record: TikTokOAuthStateRecord): Promise<void>
  consumeChallenge(input: {
    stateHash: string
    redirectUriHash: string
    provider: typeof TIKTOK_OAUTH_PROVIDER
    flow: typeof TIKTOK_LOGIN_FLOW
    environment: TikTokIdentity['environment']
    appId: string
  }): Promise<{ userId: string } | null>
}>

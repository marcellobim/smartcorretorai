import { validateGraphApiVersion, validatePublicUrl } from './oauth.ts'

type FetchLike = typeof fetch

export type InstagramConnectionRecord = {
  user_id: string
  platform: 'instagram'
  access_token: string
  page_access_token: string
  page_id: string
  ig_user_id: string
  ig_username: string | null
  token_expires_at: string | null
}

const requireText = (value: unknown, code: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code)
  return value.trim()
}

const requestJson = async (fetcher: FetchLike, url: URL) => {
  const response = await fetcher(url, { method: 'GET', headers: { Accept: 'application/json' } })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body || typeof body !== 'object' || 'error' in body) throw new Error('meta_request_failed')
  return body as Record<string, unknown>
}

const appSecretProof = async (token: string, appSecret: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token)))
  return [...signature].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function resolveInstagramConnection(input: {
  code: string
  userId: string
  appId: string
  appSecret: string
  redirectUri: string
  graphApiVersion: string
  fetcher?: FetchLike
  now?: number
}): Promise<InstagramConnectionRecord> {
  const fetcher = input.fetcher || fetch
  const version = validateGraphApiVersion(input.graphApiVersion)
  const redirectUri = validatePublicUrl(input.redirectUri, 'meta_redirect_uri')
  const code = requireText(input.code, 'missing_oauth_code')

  const shortUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  shortUrl.searchParams.set('client_id', input.appId)
  shortUrl.searchParams.set('client_secret', input.appSecret)
  shortUrl.searchParams.set('redirect_uri', redirectUri)
  shortUrl.searchParams.set('code', code)
  const shortResponse = await requestJson(fetcher, shortUrl)
  const shortToken = requireText(shortResponse.access_token, 'missing_user_access_token')

  const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', input.appId)
  longUrl.searchParams.set('client_secret', input.appSecret)
  longUrl.searchParams.set('fb_exchange_token', shortToken)
  const longResponse = await requestJson(fetcher, longUrl)
  const userToken = requireText(longResponse.access_token, 'missing_long_lived_access_token')
  const expiresIn = Number(longResponse.expires_in)

  const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`)
  pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}')
  pagesUrl.searchParams.set('limit', '100')
  pagesUrl.searchParams.set('access_token', userToken)
  pagesUrl.searchParams.set('appsecret_proof', await appSecretProof(userToken, input.appSecret))
  const pagesResponse = await requestJson(fetcher, pagesUrl)
  const pages = Array.isArray(pagesResponse.data) ? pagesResponse.data : []
  const eligible = pages.filter((page): page is Record<string, unknown> => {
    if (!page || typeof page !== 'object') return false
    const candidate = page as Record<string, unknown>
    const instagram = candidate.instagram_business_account
    return typeof candidate.id === 'string' && typeof candidate.access_token === 'string' && Boolean(instagram && typeof instagram === 'object' && typeof (instagram as Record<string, unknown>).id === 'string')
  })
  if (eligible.length !== 1) throw new Error(eligible.length ? 'multiple_instagram_accounts' : 'instagram_account_not_found')

  const page = eligible[0]
  const instagram = page.instagram_business_account as Record<string, unknown>
  const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date((input.now ?? Date.now()) + expiresIn * 1000).toISOString()
    : null

  return {
    user_id: input.userId,
    platform: 'instagram',
    access_token: userToken,
    page_access_token: requireText(page.access_token, 'missing_page_access_token'),
    page_id: requireText(page.id, 'missing_page_id'),
    ig_user_id: requireText(instagram.id, 'missing_instagram_user_id'),
    ig_username: typeof instagram.username === 'string' && instagram.username.trim() ? instagram.username.trim() : null,
    token_expires_at: tokenExpiresAt,
  }
}

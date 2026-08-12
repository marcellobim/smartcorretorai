import { validateGraphApiVersion } from './oauth.ts'

type FetchLike = typeof fetch

export type InstagramPublishFailureCode = 'instagram_reconnect_required' | 'instagram_publish_failed'

export class InstagramPublishError extends Error {
  readonly publicCode: InstagramPublishFailureCode
  readonly httpStatus?: number
  readonly metaCode?: number
  readonly metaSubcode?: number

  constructor(input: {
    publicCode: InstagramPublishFailureCode
    httpStatus?: unknown
    metaCode?: unknown
    metaSubcode?: unknown
  }) {
    super(input.publicCode)
    this.name = 'InstagramPublishError'
    this.publicCode = input.publicCode
    this.httpStatus = Number.isInteger(input.httpStatus) ? Number(input.httpStatus) : undefined
    this.metaCode = Number.isInteger(input.metaCode) ? Number(input.metaCode) : undefined
    this.metaSubcode = Number.isInteger(input.metaSubcode) ? Number(input.metaSubcode) : undefined
  }
}

const requireMetaId = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new InstagramPublishError({ publicCode: 'instagram_publish_failed' })
  }
  return value
}

const requestMeta = async (fetcher: FetchLike, url: URL, body: URLSearchParams) => {
  let response: Response
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch {
    throw new InstagramPublishError({ publicCode: 'instagram_publish_failed' })
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== 'object' || 'error' in payload) {
    const error = payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object'
      ? payload.error as Record<string, unknown>
      : null
    const metaCode = error?.code
    throw new InstagramPublishError({
      publicCode: Number(metaCode) === 190 ? 'instagram_reconnect_required' : 'instagram_publish_failed',
      httpStatus: response.status,
      metaCode,
      metaSubcode: error?.error_subcode,
    })
  }
  return payload as Record<string, unknown>
}

export async function createInstagramImageContainer(input: {
  fetcher?: FetchLike
  graphApiVersion: string
  instagramUserId: string
  pageAccessToken: string
  imageUrl: string
  caption?: string
}) {
  const version = validateGraphApiVersion(input.graphApiVersion)
  const instagramUserId = requireMetaId(input.instagramUserId)
  const imageUrl = new URL(input.imageUrl)
  if (imageUrl.protocol !== 'https:') throw new InstagramPublishError({ publicCode: 'instagram_publish_failed' })

  const body = new URLSearchParams({ image_url: imageUrl.toString(), access_token: input.pageAccessToken })
  if (input.caption) body.set('caption', input.caption)
  const payload = await requestMeta(input.fetcher || fetch, new URL(`https://graph.facebook.com/${version}/${instagramUserId}/media`), body)
  return requireMetaId(payload.id)
}

export async function publishInstagramContainer(input: {
  fetcher?: FetchLike
  graphApiVersion: string
  instagramUserId: string
  pageAccessToken: string
  creationId: string
}) {
  const version = validateGraphApiVersion(input.graphApiVersion)
  const instagramUserId = requireMetaId(input.instagramUserId)
  const creationId = requireMetaId(input.creationId)
  const body = new URLSearchParams({ creation_id: creationId, access_token: input.pageAccessToken })
  const payload = await requestMeta(input.fetcher || fetch, new URL(`https://graph.facebook.com/${version}/${instagramUserId}/media_publish`), body)
  return requireMetaId(payload.id)
}

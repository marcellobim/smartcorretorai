import { validateGraphApiVersion } from '../instagram/oauth.ts'

const PAGE_ID_PATTERN = /^\d+$/
const POST_ID_PATTERN = /^\d+(?:_\d+)?$/

export async function publishFacebookPagePhoto(input: {
  pageId: string
  pageAccessToken: string
  imageUrl: string
  caption: string
  graphApiVersion: string
  fetcher?: typeof fetch
}): Promise<{ postId: string; permalink: string }> {
  const version = validateGraphApiVersion(input.graphApiVersion)
  if (!PAGE_ID_PATTERN.test(input.pageId) || !input.pageAccessToken) throw new Error('invalid_facebook_page')
  const imageUrl = new URL(input.imageUrl)
  if (imageUrl.protocol !== 'https:') throw new Error('invalid_facebook_media_url')

  const body = new URLSearchParams()
  body.set('url', imageUrl.toString())
  body.set('caption', input.caption)
  body.set('published', 'true')

  const response = await (input.fetcher ?? fetch)(
    `https://graph.facebook.com/${version}/${input.pageId}/photos`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.pageAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
    },
  )
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload || 'error' in payload) throw new Error('facebook_photo_publish_failed')
  const postId = typeof payload.post_id === 'string'
    ? payload.post_id
    : typeof payload.id === 'string' ? payload.id : ''
  if (!POST_ID_PATTERN.test(postId)) throw new Error('invalid_facebook_photo_result')
  const permalink = postId.includes('_')
    ? `https://www.facebook.com/${postId}`
    : `https://www.facebook.com/photo.php?fbid=${postId}`
  return { postId, permalink }
}

export async function publishFacebookPageVideo(input: {
  pageId: string
  pageAccessToken: string
  videoUrl: string
  caption: string
  graphApiVersion: string
  fetcher?: typeof fetch
}): Promise<{ postId: string; permalink: string }> {
  const version = validateGraphApiVersion(input.graphApiVersion)
  if (!PAGE_ID_PATTERN.test(input.pageId) || !input.pageAccessToken) throw new Error('invalid_facebook_page')
  const videoUrl = new URL(input.videoUrl)
  if (videoUrl.protocol !== 'https:') throw new Error('invalid_facebook_media_url')

  const body = new URLSearchParams({ file_url: videoUrl.toString(), description: input.caption, published: 'true' })
  const response = await (input.fetcher ?? fetch)(`https://graph.facebook.com/${version}/${input.pageId}/videos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${input.pageAccessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload || 'error' in payload) throw new Error('facebook_video_publish_failed')
  const postId = typeof payload.id === 'string' ? payload.id : ''
  if (!PAGE_ID_PATTERN.test(postId)) throw new Error('invalid_facebook_video_result')
  return { postId, permalink: `https://www.facebook.com/${input.pageId}/videos/${postId}` }
}

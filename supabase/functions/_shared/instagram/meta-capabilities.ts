export const META_INSTAGRAM_CONNECT_REQUIRED_SCOPES = Object.freeze([
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
] as const)

export const META_INSTAGRAM_IMAGE_PUBLISH_REQUIRED_SCOPES = Object.freeze([
  'instagram_content_publish',
] as const)

export const META_FACEBOOK_PAGE_IMAGE_PUBLISH_REQUIRED_SCOPES = Object.freeze([
  'pages_read_engagement',
  'pages_manage_posts',
] as const)

export type MetaCapability =
  | 'instagram_connect'
  | 'instagram_image_publish'
  | 'instagram_video_publish'
  | 'facebook_page_image_publish'
  | 'facebook_page_video_publish'

const REQUIRED_SCOPES: Readonly<Record<MetaCapability, readonly string[]>> = Object.freeze({
  instagram_connect: META_INSTAGRAM_CONNECT_REQUIRED_SCOPES,
  instagram_image_publish: META_INSTAGRAM_IMAGE_PUBLISH_REQUIRED_SCOPES,
  instagram_video_publish: META_INSTAGRAM_IMAGE_PUBLISH_REQUIRED_SCOPES,
  facebook_page_image_publish: META_FACEBOOK_PAGE_IMAGE_PUBLISH_REQUIRED_SCOPES,
  facebook_page_video_publish: META_FACEBOOK_PAGE_IMAGE_PUBLISH_REQUIRED_SCOPES,
})

const normalizeScopes = (scopes: Iterable<unknown>) => new Set(
  [...scopes].filter((scope): scope is string => typeof scope === 'string' && Boolean(scope.trim())),
)

export function inspectMetaCapability(scopes: Iterable<unknown>, capability: MetaCapability) {
  const granted = normalizeScopes(scopes)
  const missingScopes = REQUIRED_SCOPES[capability].filter(scope => !granted.has(scope))
  return Object.freeze({
    capability,
    ready: missingScopes.length === 0,
    missingScopes: Object.freeze(missingScopes),
  })
}

export class MetaCapabilityError extends Error {
  readonly publicCode: 'instagram_reconnect_required' | 'facebook_reconnect_required'
  readonly capability: MetaCapability

  constructor(capability: MetaCapability) {
    super(capability.startsWith('facebook_') ? 'facebook_reconnect_required' : 'instagram_reconnect_required')
    this.name = 'MetaCapabilityError'
    this.capability = capability
    this.publicCode = capability.startsWith('facebook_')
      ? 'facebook_reconnect_required'
      : 'instagram_reconnect_required'
  }
}

export function requireMetaCapability(scopes: Iterable<unknown>, capability: MetaCapability) {
  const inspection = inspectMetaCapability(scopes, capability)
  if (!inspection.ready) throw new MetaCapabilityError(capability)
  return inspection
}

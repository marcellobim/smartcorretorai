export const DIRECT_POST_SCOPES = Object.freeze(['user.info.basic', 'video.publish'] as const)
export const INBOX_UPLOAD_SCOPES = Object.freeze(['user.info.basic', 'video.upload'] as const)
const KNOWN_SCOPES = Object.freeze(['user.info.basic','video.publish','video.upload'] as const)
export function deriveTikTokCapabilities(scopes: readonly string[]) {
  const allowed = new Set(scopes).size===scopes.length && scopes.every(s => KNOWN_SCOPES.includes(s as typeof KNOWN_SCOPES[number]))
  const login_basic = allowed && scopes.includes('user.info.basic')
  return Object.freeze({ login_basic, direct_post: login_basic && scopes.includes('video.publish'), inbox_upload: login_basic && scopes.includes('video.upload') })
}
export function validateUpgradeScopes(scopes: readonly string[]) {
  if (new Set(scopes).size !== scopes.length || scopes.some(s => !DIRECT_POST_SCOPES.includes(s as typeof DIRECT_POST_SCOPES[number])) ||
      !scopes.includes('user.info.basic')) throw new Error('tiktok_required_scope_missing')
  return DIRECT_POST_SCOPES.filter(scope=>scopes.includes(scope))
}

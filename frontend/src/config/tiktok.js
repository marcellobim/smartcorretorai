export const isTikTokLoginKitEnabled = (environment) => (
  environment?.VITE_TIKTOK_LOGIN_KIT_ENABLED === 'true'
)

export const TIKTOK_LOGIN_KIT_ENABLED = isTikTokLoginKitEnabled(import.meta.env)

const TIKTOK_CALLBACK_PATH = '/functions/v1/tiktok-callback'

export const getTikTokCallbackUri = (environment = import.meta.env) => {
  const value = environment?.VITE_SUPABASE_URL
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('missing_tiktok_supabase_url')
  }

  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('invalid_tiktok_supabase_url')
  }

  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) throw new Error('invalid_tiktok_supabase_url')

  return new URL(TIKTOK_CALLBACK_PATH, url.origin).toString()
}

export type TikTokEnvironment = 'sandbox' | 'production'
export type TikTokIdentity = Readonly<{ environment: TikTokEnvironment; appId: string }>

export function validateTikTokIdentity(value: TikTokIdentity): TikTokIdentity {
  if (!value || !['sandbox', 'production'].includes(value.environment)
      || !/^[0-9a-f]{64}$/.test(value.appId)) throw new Error('invalid_tiktok_identity')
  return Object.freeze({ environment: value.environment, appId: value.appId })
}

// Read once on startup. Never accept environment/app identity from HTTP input.
export async function loadTikTokConfiguration(read: (name: string) => string | undefined) {
  const required = (name: string) => {
    const value = read(name)?.trim()
    if (!value) throw new Error('missing_' + name.toLowerCase())
    return value
  }
  const environment = required('TIKTOK_ACTIVE_ENVIRONMENT')
  if (environment !== 'sandbox' && environment !== 'production') throw new Error('invalid_tiktok_environment')
  const prefix = 'TIKTOK_' + environment.toUpperCase() + '_'
  const clientKey = required(prefix + 'CLIENT_KEY')
  if (!/^[A-Za-z0-9._-]{6,128}$/.test(clientKey)) throw new Error('invalid_tiktok_client_key')
  const appId = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientKey)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
  return Object.freeze({
    ...validateTikTokIdentity({ environment, appId }),
    clientKey, clientSecret: required(prefix + 'CLIENT_SECRET'),
    redirectUri: required(prefix + 'REDIRECT_URI'),
    frontendOrigin: required('TIKTOK_FRONTEND_ORIGIN'),
    frontendReturnUri: required('TIKTOK_FRONTEND_RETURN_URI'),
  })
}

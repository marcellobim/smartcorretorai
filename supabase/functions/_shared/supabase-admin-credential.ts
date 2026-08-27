export type SupabaseAdminCredentialSource = 'modern' | 'legacy'

export type SupabaseAdminCredential = Readonly<{
  key: string
  source: SupabaseAdminCredentialSource
}>

type EnvironmentReader = (name: string) => string | undefined
type CredentialSourceLogger = (source: SupabaseAdminCredentialSource) => void

const defaultEnvironmentReader: EnvironmentReader = name => Deno.env.get(name)
const defaultSourceLogger: CredentialSourceLogger = source => {
  console.info('[supabase-admin] credential_source', JSON.stringify({ source }))
}

function readModernSecret(rawValue: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new Error('supabase_secret_keys_invalid')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('supabase_secret_keys_invalid')
  }
  const key = (parsed as Record<string, unknown>).default
  if (typeof key !== 'string' || !key.trim().startsWith('sb_secret_')) {
    throw new Error('supabase_default_secret_missing')
  }
  return key.trim()
}

export function resolveSupabaseAdminCredential(
  readEnvironment: EnvironmentReader = defaultEnvironmentReader,
  logSource: CredentialSourceLogger = defaultSourceLogger,
): SupabaseAdminCredential {
  const modernSecrets = readEnvironment('SUPABASE_SECRET_KEYS')?.trim()
  if (modernSecrets) {
    const credential = { key: readModernSecret(modernSecrets), source: 'modern' as const }
    logSource(credential.source)
    return credential
  }

  // Transitional fallback: remove after every production consumer has moved to SUPABASE_SECRET_KEYS.
  const legacyKey = readEnvironment('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (legacyKey) {
    const credential = { key: legacyKey, source: 'legacy' as const }
    logSource(credential.source)
    return credential
  }

  throw new Error('supabase_admin_credential_missing')
}

function constantTimeEqual(left: string, right: string) {
  const size = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

export function authorizeSupabaseAdminRequest(
  headers: Headers,
  credential: SupabaseAdminCredential,
  readEnvironment: EnvironmentReader = defaultEnvironmentReader,
) {
  const apiKey = headers.get('apikey')?.trim() || ''
  if (apiKey && constantTimeEqual(apiKey, credential.key)) return credential.source

  // Transitional fallback for existing schedulers that still send the legacy JWT as Bearer.
  const legacyKey = readEnvironment('SUPABASE_SERVICE_ROLE_KEY')?.trim() || ''
  const bearer = (headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (legacyKey && bearer && constantTimeEqual(bearer, legacyKey)) return 'legacy' as const

  return null
}

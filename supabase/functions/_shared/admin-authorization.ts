type AdminLookupResult = {
  data: { user_id?: string | null } | null
  error: { message?: string } | null
}

type AdminLookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<AdminLookupResult>
      }
    }
  }
}

type AdminMfaClient = {
  auth: {
    mfa: {
      getAuthenticatorAssuranceLevel: (jwt: string) => PromiseLike<{
        data: { currentLevel?: string | null; nextLevel?: string | null } | null
        error: { message?: string } | null
      }>
    }
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class AdminAuthorizationError extends Error {
  status = 403

  constructor() {
    super('Acesso administrativo nao autorizado.')
    this.name = 'AdminAuthorizationError'
  }
}

export class AdminMfaRequiredError extends Error {
  status = 403

  constructor() {
    super('Autenticacao multifator administrativa obrigatoria.')
    this.name = 'AdminMfaRequiredError'
  }
}

export async function isAuthorizedAdmin(client: AdminLookupClient, userId: string) {
  if (!UUID_PATTERN.test(String(userId || '').trim())) return false

  const { data, error } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return false
  return data?.user_id === userId
}

export async function requireAuthorizedAdmin(client: AdminLookupClient, userId: string) {
  if (!await isAuthorizedAdmin(client, userId)) {
    throw new AdminAuthorizationError()
  }
}

export async function requireAdminAal2(client: AdminMfaClient, jwt: string) {
  if (!String(jwt || '').trim()) throw new AdminMfaRequiredError()
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(jwt)
  if (error || data?.currentLevel !== 'aal2') throw new AdminMfaRequiredError()
}

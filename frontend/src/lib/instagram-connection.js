export const INSTAGRAM_CONNECTION_FUNCTION = 'instagram-connection'

const SAFE_CONNECTION_ERROR = 'Não foi possível consultar a conexão do Instagram. Tente novamente.'
const SAFE_CONNECT_ERROR = 'Não foi possível iniciar a conexão com o Instagram. Tente novamente.'
const SAFE_DISCONNECT_ERROR = 'Não foi possível desconectar o Instagram. Tente novamente.'

async function invokeInstagramConnection(client, method, safeError) {
  const { data, error } = await client.functions.invoke(INSTAGRAM_CONNECTION_FUNCTION, { method })
  if (error || !data?.ok) throw new Error(safeError)
  return data
}

export function normalizeInstagramConnection(data = {}) {
  const connected = data.connected === true
  return {
    connected,
    instagramUsername: connected && typeof data.instagram_username === 'string'
      ? data.instagram_username.trim().replace(/^@+/, '')
      : '',
    tokenExpiresAt: connected && typeof data.token_expires_at === 'string'
      ? data.token_expires_at
      : null,
    status: connected ? 'connected' : 'disconnected',
  }
}

export function validateInstagramAuthorizationUrl(value) {
  let url
  try {
    url = new URL(String(value || ''))
  } catch {
    throw new Error(SAFE_CONNECT_ERROR)
  }

  if (
    url.protocol !== 'https:'
    || url.hostname !== 'www.facebook.com'
    || !/^\/v\d+\.\d+\/dialog\/oauth$/.test(url.pathname)
    || !url.searchParams.get('state')
  ) throw new Error(SAFE_CONNECT_ERROR)

  return url.toString()
}

export async function getInstagramConnection(client) {
  const data = await invokeInstagramConnection(client, 'GET', SAFE_CONNECTION_ERROR)
  return normalizeInstagramConnection(data)
}

export async function startInstagramConnection(client, navigate) {
  const data = await invokeInstagramConnection(client, 'POST', SAFE_CONNECT_ERROR)
  const authorizationUrl = validateInstagramAuthorizationUrl(data.authorization_url)
  navigate(authorizationUrl)
}

export async function deleteInstagramConnection(client) {
  await invokeInstagramConnection(client, 'DELETE', SAFE_DISCONNECT_ERROR)
  return normalizeInstagramConnection()
}
